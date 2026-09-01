import assert from "node:assert";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures as facturesTable, lignesFacture } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  ajouterTravailSupplementaire,
  emettreFacture,
  getFacturePourChantier,
  retirerTravailSupplementaire,
  terminerChantier,
} from "../src/server/repositories/factures";
import { nettoyerBase } from "./_test-db";

// LES TRAVAUX EN PLUS, AJOUTÉS SUR LA FACTURE AVANT SON ENVOI.
//
// **Son constat du 31 août 2026 :** « si on effectue des travaux en plus chez
// un client, on n'a aucun moyen de rajouter les TS sur la facture ». Puis son
// idée, capture de l'écran à l'appui : le faire depuis l'écran de la facture,
// avant l'envoi, « et comme ça on a déjà toute la chaîne de production de
// créée pour l'envoyer au client ».
//
// **Ce que cette suite protège :**
//
// · l'argent — les totaux se recalculent en base, jamais à l'écran seul ;
// · la TVA — un supplément peut porter SON taux, et l'article 268 bis du CGI
//   taxe en entier au taux le plus élevé une facture qui ne ventile pas ;
// · l'immuabilité — une facture émise ne se modifie plus, il faut un avoir ;
// · le devis — ses lignes ne se retirent pas par cette porte ;
// · l'isolation — une facture d'à côté n'existe pas pour cette requête.
//
// **Elle entre par la porte du patron** (`CLAUDE.md` §5 quater) : le dépôt,
// c'est-à-dire ce que l'action serveur appelle. Le parcours à l'écran, lui, est
// éprouvé par `test-facture-travaux-supplementaires-e2e.ts`.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier des travaux en plus" },
    { email: `ts-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier devisé, clôturé : sa facture en brouillon, comme sur son écran. */
async function factureEnBrouillon(ctx: Ctx, montantHt = "500.00") {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Grospiron", telephone: "0679984514" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Entretien du jardin",
    adresseChantier: "12 rue des Tilleuls",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Tonte du gazon", montantHt);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  return { chantierId: chantier.id, factureId: facture.id };
}

async function main() {
  await nettoyerBase();

  // ── Le geste qui manquait ────────────────────────────────────────────────

  await test("un travail en plus s'ajoute, et les totaux suivent", async () => {
    const ctx = await contexte("ajout");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);

    const r = await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Dessouchage d'un cerisier",
      quantite: "1",
      unite: "forfait",
      prixUnitaire: "320.00",
      tauxTva: "20",
    });
    assert.ok(r.ok, "l'ajout aurait dû être accepté");

    const apres = await getFacturePourChantier(ctx, chantierId);
    assert.equal(apres!.facture.totalHt, "820.00");
    assert.equal(apres!.facture.totalTva, "164.00");
    assert.equal(apres!.facture.totalTtc, "984.00");

    const ajoutee = apres!.lignes.find((l) => l.origine === "supplement");
    assert.ok(ajoutee, "la ligne ajoutée doit porter l'origine « supplement »");
    assert.equal(ajoutee!.montant, "320.00");
    assert.equal(ajoutee!.unite, "forfait");
    assert.equal(ajoutee!.tauxTva, "20.00");
    // Les lignes du devis, elles, ne bougent pas d'un centime.
    assert.equal(apres!.lignes.filter((l) => l.origine === "devis").length, 1);
  });

  await test("la quantité multiplie le prix — « 12 m² × 6,00 € »", async () => {
    const ctx = await contexte("quantite");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);
    await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Bêchage massif",
      quantite: "12",
      unite: "m²",
      prixUnitaire: "6.00",
      tauxTva: "20",
    });
    const apres = await getFacturePourChantier(ctx, chantierId);
    const l = apres!.lignes.find((x) => x.origine === "supplement")!;
    assert.equal(l.montant, "72.00");
    assert.equal(apres!.facture.totalHt, "572.00");
  });

  await test("le supplément se lit APRÈS le devis, jamais avant", async () => {
    const ctx = await contexte("ordre");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);
    await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Terrasse bois",
      quantite: "1",
      unite: null,
      prixUnitaire: "580.00",
      tauxTva: "20",
    });
    const apres = await getFacturePourChantier(ctx, chantierId);
    const ordonnees = apres!.lignes.slice().sort((a, b) => a.ordre - b.ordre);
    assert.equal(ordonnees[ordonnees.length - 1].origine, "supplement");
  });

  // ── Sa question du 1ᵉʳ septembre : un autre taux ─────────────────────────

  await test("un supplément à 20 % sur un devis à 10 % : deux socles, pas un taux moyen", async () => {
    const ctx = await contexte("taux");
    const { chantierId, factureId } = await factureEnBrouillon(ctx, "1000.00");
    // Le devis passe à 10 % — les travaux sur un logement de plus de deux ans.
    // La facture, née avant, porte encore 20 % : on la remet d'aplomb comme le
    // ferait un chantier réellement devisé à 10 %.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      await tx
        .update(facturesTable)
        .set({ tauxTva: "10.00", totalTva: "100.00", totalTtc: "1100.00" })
        .where(eq(facturesTable.id, factureId));
      await tx
        .update(lignesFacture)
        .set({ tauxTva: "10.00" })
        .where(eq(lignesFacture.factureId, factureId));
    });

    await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Terrasse bois",
      quantite: "1",
      unite: null,
      prixUnitaire: "500.00",
      tauxTva: "20",
    });

    const apres = await getFacturePourChantier(ctx, chantierId);
    // 1 000 à 10 % = 100 ; 500 à 20 % = 100 ; total 200 de TVA.
    assert.equal(apres!.facture.totalHt, "1500.00");
    assert.equal(apres!.facture.totalTva, "200.00");
    assert.equal(apres!.facture.totalTtc, "1700.00");
    // Le taux porté par la facture est le PLUS ÉLEVÉ : aucun taux unique n'est
    // juste ici, et le plus élevé est celui qui ne sous-déclare pas.
    assert.equal(apres!.facture.tauxTva, "20.00");
  });

  await test("un taux hors bornes est ramené, jamais enregistré tel quel", async () => {
    const ctx = await contexte("borne");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);
    await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Saisie de travers",
      quantite: "1",
      unite: null,
      prixUnitaire: "100.00",
      tauxTva: "2000",
    });
    const apres = await getFacturePourChantier(ctx, chantierId);
    const l = apres!.lignes.find((x) => x.origine === "supplement")!;
    assert.equal(l.tauxTva, "100.00");
  });

  // ── Les refus, rendus en valeur et jamais en exception ───────────────────

  await test("une facture ÉMISE ne se modifie plus — il faut un avoir", async () => {
    const ctx = await contexte("emise");
    const { factureId } = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, factureId);

    const r = await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Trop tard",
      quantite: "1",
      unite: null,
      prixUnitaire: "100.00",
      tauxTva: "20",
    });
    assert.equal(r.ok, false);
    assert.match((r as { raison: string }).raison, /arrêtée/);
  });

  await test("une ligne du DEVIS ne se retire pas par cette porte", async () => {
    const ctx = await contexte("devis-fige");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);
    const avant = await getFacturePourChantier(ctx, chantierId);
    const ligneDuDevis = avant!.lignes.find((l) => l.origine === "devis")!;

    const r = await retirerTravailSupplementaire(ctx, ligneDuDevis.id);
    assert.equal(r.ok, false);
    assert.match((r as { raison: string }).raison, /devis/);

    // Et elle est toujours là.
    const apres = await getFacturePourChantier(ctx, chantierId);
    assert.equal(apres!.lignes.length, 1);
    assert.equal(apres!.facture.id, factureId);
  });

  await test("un libellé vide et un prix qui n'est pas un nombre sont refusés", async () => {
    const ctx = await contexte("saisie");
    const { factureId } = await factureEnBrouillon(ctx);

    const sansLibelle = await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "   ",
      quantite: "1",
      unite: null,
      prixUnitaire: "100.00",
      tauxTva: "20",
    });
    assert.equal(sansLibelle.ok, false);

    const sansPrix = await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Une chose",
      quantite: "1",
      unite: null,
      prixUnitaire: "beaucoup",
      tauxTva: "20",
    });
    assert.equal(sansPrix.ok, false);
  });

  // ── Le retrait ───────────────────────────────────────────────────────────

  await test("un supplément se retire, et les totaux redescendent", async () => {
    const ctx = await contexte("retrait");
    const { chantierId, factureId } = await factureEnBrouillon(ctx);
    const r = await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Dessouchage",
      quantite: "1",
      unite: null,
      prixUnitaire: "320.00",
      tauxTva: "20",
    });
    assert.ok(r.ok);

    const retrait = await retirerTravailSupplementaire(ctx, (r as { ligneId: string }).ligneId);
    assert.ok(retrait.ok);

    const apres = await getFacturePourChantier(ctx, chantierId);
    assert.equal(apres!.facture.totalHt, "500.00");
    assert.equal(apres!.facture.totalTtc, "600.00");
    assert.equal(apres!.lignes.length, 1);
  });

  // ── L'émission emporte ce qui a été ajouté ───────────────────────────────

  await test("la facture émise porte le supplément, et son PDF est archivé", async () => {
    const ctx = await contexte("emission");
    const { factureId } = await factureEnBrouillon(ctx);
    await ajouterTravailSupplementaire(ctx, factureId, {
      libelle: "Dessouchage",
      quantite: "1",
      unite: null,
      prixUnitaire: "320.00",
      tauxTva: "20",
    });
    const emise = await emettreFacture(ctx, factureId);
    assert.equal(emise.totalHt, "820.00");
    assert.equal(emise.totalTtc, "984.00");
    assert.ok(emise.pdfStorageKey, "la pièce émise doit être archivée");
  });

  // ── L'isolation entre entreprises ────────────────────────────────────────

  await test("la facture d'à côté n'existe pas — ni pour ajouter, ni pour retirer", async () => {
    const ctxA = await contexte("iso-a");
    const ctxB = await contexte("iso-b");
    const { factureId } = await factureEnBrouillon(ctxA);
    const r = await ajouterTravailSupplementaire(ctxA, factureId, {
      libelle: "Dessouchage",
      quantite: "1",
      unite: null,
      prixUnitaire: "320.00",
      tauxTva: "20",
    });
    assert.ok(r.ok);
    const ligneId = (r as { ligneId: string }).ligneId;

    const vol = await ajouterTravailSupplementaire(ctxB, factureId, {
      libelle: "Chez le voisin",
      quantite: "1",
      unite: null,
      prixUnitaire: "999.00",
      tauxTva: "20",
    });
    assert.equal(vol.ok, false);

    const suppression = await retirerTravailSupplementaire(ctxB, ligneId);
    assert.equal(suppression.ok, false);

    // Et rien n'a bougé chez A.
    const restee = await withEntreprise(ctxA.utilisateurId, ctxA.entrepriseId, async (tx) =>
      tx.select().from(lignesFacture).where(eq(lignesFacture.id, ligneId))
    );
    assert.equal(restee.length, 1);
    assert.equal(restee[0].montant, "320.00");
  });

  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
