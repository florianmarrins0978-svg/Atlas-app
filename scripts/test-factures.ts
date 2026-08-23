import assert from "node:assert";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers as chantiersTable, lignesFacture } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
  listerChantiersTermines,
  releveTvaCollectee,
  FinChantierImpossibleError,
  FactureDejaEmiseError,
} from "../src/server/repositories/factures";
import {
  trimestre,
  trimestreCourant,
  trimestrePrecedent,
  trimestreSuivant,
  libelleTrimestre,
} from "../src/server/trimestre";
import { reglerExigibilite } from "../src/server/repositories/paiements-facture";
import { nettoyerBase } from "./_test-db";

// Fin de chantier, facture et relevé de TVA — docs/AGENT.md §2.3.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const MAINTENANT = new Date("2026-05-20T09:00:00Z");
type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Facture" },
    { email: `fact-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier au devis envoyé, prêt à être clôturé. */
async function chantierDevise(ctx: Ctx, montantHt: string, datePlanifiee?: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Bernard", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Reprise de toiture",
    adresseChantier: "5 rue des Lilas",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Main d'œuvre", montantHt);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  if (datePlanifiee) await chantiersRepo.planifierChantier(ctx, chantier.id, datePlanifiee);
  return { chantierId: chantier.id, devisId: brouillon.id };
}

/** Relit un chantier dans son contexte : la table est cloisonnée. */
async function relireChantier(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(chantiersTable).where(eq(chantiersTable.id, id)).limit(1);
    return row ?? null;
  });
}

async function main() {
  await nettoyerBase();

  // ---- Découpage en trimestres (fonctions pures)
  await test("les bornes d'un trimestre couvrent ses trois mois entiers", async () => {
    assert.deepStrictEqual(
      { debut: trimestre(2026, 1).debut, fin: trimestre(2026, 1).fin },
      { debut: "2026-01-01", fin: "2026-03-31" }
    );
    assert.deepStrictEqual(
      { debut: trimestre(2026, 4).debut, fin: trimestre(2026, 4).fin },
      { debut: "2026-10-01", fin: "2026-12-31" }
    );
    // Février bissextile : le calcul ne doit rien supposer de la longueur des mois.
    assert.strictEqual(trimestre(2024, 1).fin, "2024-03-31");
  });

  await test("passer d'un trimestre au suivant franchit l'année", async () => {
    assert.deepStrictEqual(trimestreSuivant(trimestre(2026, 4)), trimestre(2027, 1));
    assert.deepStrictEqual(trimestrePrecedent(trimestre(2026, 1)), trimestre(2025, 4));
    assert.strictEqual(libelleTrimestre(trimestre(2026, 1)), "1er trimestre 2026");
    assert.strictEqual(libelleTrimestre(trimestre(2026, 3)), "3e trimestre 2026");
  });

  await test("le trimestre courant se déduit du mois", async () => {
    assert.strictEqual(trimestreCourant(new Date("2026-05-20T09:00:00Z")).numero, 2);
    assert.strictEqual(trimestreCourant(new Date("2026-01-01T00:00:00Z")).numero, 1);
    assert.strictEqual(trimestreCourant(new Date("2026-12-31T23:00:00Z")).numero, 4);
  });

  // ---- Fin de chantier
  await test("la facture reprend les montants du devis, ligne à ligne", async () => {
    const ctx = await contexte("reprise");
    const { chantierId, devisId } = await chantierDevise(ctx, "1000.00");

    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);

    assert.strictEqual(facture.devisId, devisId, "la facture ne pointe pas vers son devis");
    assert.strictEqual(facture.statut, "brouillon", "la facture ne doit pas partir seule");
    assert.strictEqual(facture.totalHt, "1000.00");
    assert.strictEqual(facture.totalTva, "200.00");
    assert.strictEqual(facture.totalTtc, "1200.00");
    assert.strictEqual(facture.clientNom, "M. Bernard", "l'instantané client n'est pas repris du devis");

    const complet = await getFacturePourChantier(ctx, chantierId);
    assert.strictEqual(complet?.lignes.length, 1, "les lignes du devis ne sont pas reportées");
    assert.strictEqual(complet?.lignes[0].libelle, "Main d'œuvre");
  });

  await test("le chantier est marqué terminé, pas facturé", async () => {
    const ctx = await contexte("jalons");
    const { chantierId } = await chantierDevise(ctx, "500.00");
    await terminerChantier(ctx, chantierId, MAINTENANT);

    const chantier = await relireChantier(ctx, chantierId);
    assert.ok(chantier?.termineAt, "le jalon de fin de chantier n'est pas posé");
    assert.strictEqual(
      chantier?.factureEnvoyeeAt,
      null,
      "le chantier est marqué facturé alors que le patron n'a rien confirmé"
    );
  });

  await test("un double appui ne crée jamais deux factures", async () => {
    const ctx = await contexte("idempotent");
    const { chantierId } = await chantierDevise(ctx, "300.00");

    const a = await terminerChantier(ctx, chantierId, MAINTENANT);
    const b = await terminerChantier(ctx, chantierId, MAINTENANT);

    assert.strictEqual(a.id, b.id, "deux factures pour un chantier doubleraient la TVA collectée");
  });

  await test("un devis resté brouillon ne peut pas être facturé", async () => {
    const ctx = await contexte("brouillon");
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Roche" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Terrasse", clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Dalle", "800.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    await assert.rejects(
      () => terminerChantier(ctx, chantier.id, MAINTENANT),
      (err: unknown) =>
        err instanceof FinChantierImpossibleError && err.motif === "devis_non_envoye",
      "facturer un prix que le client n'a jamais vu devrait être refusé"
    );
  });

  await test("un chantier sans devis ne peut pas être facturé", async () => {
    const ctx = await contexte("sansdevis");
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Sans devis" });
    await assert.rejects(
      () => terminerChantier(ctx, chantier.id, MAINTENANT),
      (err: unknown) => err instanceof FinChantierImpossibleError && err.motif === "devis_absent"
    );
  });

  // ---- Émission
  await test("l'émission fige la facture et marque le chantier", async () => {
    const ctx = await contexte("emission");
    const { chantierId } = await chantierDevise(ctx, "1000.00");
    const brouillon = await terminerChantier(ctx, chantierId, MAINTENANT);

    const emise = await emettreFacture(ctx, brouillon.id, MAINTENANT);

    assert.strictEqual(emise.statut, "emise");
    assert.ok(emise.emiseLe, "la date d'émission n'est pas posée");
    const chantier = await relireChantier(ctx, chantierId);
    assert.ok(chantier?.factureEnvoyeeAt, "le jalon de facturation n'est pas posé");
  });

  await test("les totaux sont recalculés depuis les lignes, jamais recopiés", async () => {
    const ctx = await contexte("recalcul");
    const { chantierId } = await chantierDevise(ctx, "1000.00");
    const brouillon = await terminerChantier(ctx, chantierId, MAINTENANT);

    // Le chantier a coûté moins cher que prévu : une ligne est corrigée avant
    // confirmation. Un total recopié du devis facturerait l'ancien montant.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      await tx
        .update(lignesFacture)
        .set({ montant: "600.00" })
        .where(eq(lignesFacture.factureId, brouillon.id));
    });

    const emise = await emettreFacture(ctx, brouillon.id, MAINTENANT);
    assert.strictEqual(emise.totalHt, "600.00");
    assert.strictEqual(emise.totalTva, "120.00");
    assert.strictEqual(emise.totalTtc, "720.00");
  });

  await test("une facture émise ne repart pas une seconde fois", async () => {
    const ctx = await contexte("rejeu");
    const { chantierId } = await chantierDevise(ctx, "400.00");
    const brouillon = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, brouillon.id, MAINTENANT);

    await assert.rejects(
      () => emettreFacture(ctx, brouillon.id, MAINTENANT),
      (err: unknown) => err instanceof FactureDejaEmiseError
    );
  });

  await test("une facture émise est immuable jusque dans ses lignes", async () => {
    const ctx = await contexte("immuable");
    const { chantierId } = await chantierDevise(ctx, "900.00");
    const brouillon = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, brouillon.id, MAINTENANT);

    // C'est cette immuabilité qui autorise le relevé de TVA à être calculé
    // plutôt que stocké : sans elle, le relevé pourrait changer sous les pieds
    // du patron après sa déclaration.
    await assert.rejects(() =>
      withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
        await tx
          .update(lignesFacture)
          .set({ montant: "1.00" })
          .where(eq(lignesFacture.factureId, brouillon.id));
      })
    );
  });

  // ---- Onglet « Chantiers terminés »
  await test("l'onglet ne montre que les chantiers dont la date est passée", async () => {
    const ctx = await contexte("onglet");
    const passe = await chantierDevise(ctx, "100.00", "2026-05-04");
    const futur = await chantierDevise(ctx, "200.00", "2026-06-30");
    const sansDate = await chantierDevise(ctx, "300.00");

    const liste = await listerChantiersTermines(ctx, "2026-05-20");
    const ids = liste.map((c) => c.id);

    assert.ok(ids.includes(passe.chantierId), "un chantier réalisé n'apparaît pas");
    assert.ok(!ids.includes(futur.chantierId), "un chantier à venir apparaît comme terminé");
    assert.ok(!ids.includes(sansDate.chantierId), "un chantier jamais planifié apparaît comme terminé");
  });

  await test("les chantiers sont rangés par date, le plus récent en tête", async () => {
    const ctx = await contexte("tri");
    await chantierDevise(ctx, "100.00", "2026-03-02");
    await chantierDevise(ctx, "100.00", "2026-05-11");
    await chantierDevise(ctx, "100.00", "2026-04-07");

    const dates = (await listerChantiersTermines(ctx, "2026-05-20")).map((c) => c.datePlanifiee);
    assert.deepStrictEqual(dates, ["2026-05-11", "2026-04-07", "2026-03-02"]);
  });

  await test("l'onglet distingue ce qui reste à facturer de ce qui l'est", async () => {
    const ctx = await contexte("etats");
    const aFaire = await chantierDevise(ctx, "100.00", "2026-05-04");
    const fait = await chantierDevise(ctx, "250.00", "2026-05-05");
    const brouillon = await terminerChantier(ctx, fait.chantierId, MAINTENANT);
    await emettreFacture(ctx, brouillon.id, MAINTENANT);

    const liste = await listerChantiersTermines(ctx, "2026-05-20");
    const parId = new Map(liste.map((c) => [c.id, c]));

    assert.strictEqual(parId.get(aFaire.chantierId)?.factureStatut, null);
    assert.strictEqual(parId.get(fait.chantierId)?.factureStatut, "emise");
    assert.strictEqual(parId.get(fait.chantierId)?.totalTtc, "300.00");
  });

  // ---- Relevé de TVA
  await test("le relevé ne compte que les factures émises de la période", async () => {
    const ctx = await contexte("releve");
    // **Sous le régime des DÉBITS**, et c'est délibéré : ce contrôle porte sur
    // QUELLES factures comptent — les émises, pas les brouillons —, jamais sur
    // le MOMENT où elles comptent. Depuis le 14 août 2026, le défaut est
    // l'encaissement (migration 0045) et une facture non réglée n'entre plus au
    // relevé : sans cette ligne, le contrôle rougirait pour une raison qui n'est
    // pas la sienne. Le moment a sa propre suite, `test-paiements-facture-db`.
    await reglerExigibilite(ctx, "debits");
    const a = await chantierDevise(ctx, "1000.00", "2026-05-04");
    const b = await chantierDevise(ctx, "500.00", "2026-05-05");
    const c = await chantierDevise(ctx, "700.00", "2026-05-06");

    const fa = await terminerChantier(ctx, a.chantierId, MAINTENANT);
    await emettreFacture(ctx, fa.id, MAINTENANT);
    const fb = await terminerChantier(ctx, b.chantierId, MAINTENANT);
    await emettreFacture(ctx, fb.id, MAINTENANT);
    // Celle-ci reste en brouillon : le patron ne l'a pas confirmée.
    await terminerChantier(ctx, c.chantierId, MAINTENANT);

    const t2 = trimestre(2026, 2);
    const releve = await releveTvaCollectee(ctx, t2.debut, t2.fin);

    assert.strictEqual(releve.lignes.length, 2, "une facture non confirmée figure au relevé");
    assert.strictEqual(releve.totalHt, "1500.00");
    assert.strictEqual(releve.totalTva, "300.00");
    assert.strictEqual(releve.totalTtc, "1800.00");
  });

  await test("un trimestre sans facture donne un relevé à zéro, pas une erreur", async () => {
    const ctx = await contexte("vide");
    const t1 = trimestre(2026, 1);
    const releve = await releveTvaCollectee(ctx, t1.debut, t1.fin);
    assert.strictEqual(releve.lignes.length, 0);
    assert.strictEqual(releve.totalTva, "0.00");
  });

  // ---- Isolation
  await test("une entreprise ne voit ni les factures ni la TVA d'une autre", async () => {
    const a = await contexte("iso-a");
    const b = await contexte("iso-b");
    const chez = await chantierDevise(a, "1000.00", "2026-05-04");
    const facture = await terminerChantier(a, chez.chantierId, MAINTENANT);
    await emettreFacture(a, facture.id, MAINTENANT);

    assert.strictEqual(await getFacturePourChantier(b, chez.chantierId), null);
    assert.strictEqual((await listerChantiersTermines(b, "2026-05-20")).length, 0);

    const t2 = trimestre(2026, 2);
    assert.strictEqual((await releveTvaCollectee(b, t2.debut, t2.fin)).totalTva, "0.00");
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
