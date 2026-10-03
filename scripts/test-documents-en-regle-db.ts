import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  genererPdfFacturePourApercu,
  getFacturePourChantier,
  majAutoliquidationFacture,
  majDateTravauxFacture,
  majLigneDeFacture,
  majTvaClientFacture,
  manquesDeLaFactureAEmettre,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, clients } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import { IDENTITE_EN_REGLE } from "./_entreprise-en-regle";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE EN RÈGLE, EN BASE — ses choix du 3 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// La date des travaux (6A), la sous-traitance sans TVA et le numéro du
// donneur d'ordre retenu (5B), ce qui manque pour émettre (1A). Tout tourne
// sous `atlas_app`, comme chez lui : une écriture refusée par la RLS ne
// rendrait rien, sans un mot (`CLAUDE.md` §5).

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

async function contexte(suffixe: string, enRegle = true): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Jardins de l'Erdre" },
    { email: `en-regle-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  if (enRegle) await entreprisesRepo.mettreAJourEntreprise(ctx, IDENTITE_EN_REGLE);
  return ctx;
}

/** Une facture directe, sur un chantier posé jeudi et vendredi derniers. */
async function factureDuChantier(ctx: Ctx, nom = "Jardins Ribault", adresse: string | null = "4 rue de la Garenne, Rezé") {
  const client = await clientsRepo.creerClient(ctx, { nom, adresse: adresse ?? undefined });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez ${nom}`, clientId: client.id });
  // Posé par la base : l'application ne propose que des dates à venir, et un
  // chantier facturé est derrière soi.
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(chantiers)
      .set({ datePlanifiee: "2026-09-24", creneauDebut: "matin", dureeDemiJournees: 4 })
      .where(eq(chantiers.id, chantier.id))
  );
  const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-10-03T09:00:00Z"));
  return { client, chantier, facture };
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  // ── 6A : LA DATE DES TRAVAUX ─────────────────────────────────────────────

  await test("la facture naît avec le dernier jour du planning", async () => {
    const { facture } = await factureDuChantier(ctx);
    assert.equal(facture.dateTravaux, "2026-09-25");
  });

  await test("il la change, et une date qui n'en est pas une se refuse avec ses mots", async () => {
    const { facture } = await factureDuChantier(ctx);
    const r = await majDateTravauxFacture(ctx, facture.id, "2026-09-26");
    assert.deepEqual(r, { ok: true, dateTravaux: "2026-09-26" });
    const faux = await majDateTravauxFacture(ctx, facture.id, "demain");
    assert.equal(faux.ok, false);
  });

  // ── 5B : LA SOUS-TRAITANCE, SANS TVA ─────────────────────────────────────

  await test("l'activer met la pièce sans TVA, lignes ajoutées et corrigées comprises", async () => {
    const { chantier, facture } = await factureDuChantier(ctx);
    const a = await ajouterLigneDeFacture(ctx, facture.id, "10.00");
    assert.ok(a.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Massifs", prixUnitaire: "1000" });

    const on = await majAutoliquidationFacture(ctx, facture.id, true);
    assert.ok(on.ok, on.ok ? "" : on.raison);
    let lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.equal(lue.facture.tauxTva, "0.00");
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["0.00"]);

    // Pendant : une ligne neuve naît sans TVA, et un taux posé ne prend pas.
    const b = await ajouterLigneDeFacture(ctx, facture.id, "20.00");
    assert.ok(b.ok);
    assert.equal(b.ligne.tauxTva, "0.00");
    await majLigneDeFacture(ctx, facture.id, b.ligne.id, { tauxTva: "20.00" });
    lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["0.00", "0.00"]);

    // L'enlever rend la ligne à 10 % à 10 %, et la neuve au taux de la facture.
    const off = await majAutoliquidationFacture(ctx, facture.id, false);
    assert.ok(off.ok);
    lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.equal(lue.facture.tauxTva, facture.tauxTva);
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["10.00", null]);
  });

  await test("en franchise, le bouton se refuse", async () => {
    const franchise = await contexte("franchise");
    await entreprisesRepo.mettreAJourEntreprise(franchise, { regimeTva: "franchise" });
    const { facture } = await factureDuChantier(franchise);
    const r = await majAutoliquidationFacture(franchise, facture.id, true);
    assert.equal(r.ok, false);
  });

  await test("le numéro du donneur d'ordre est retenu sur sa fiche, et revient sur sa facture suivante", async () => {
    const { client, facture } = await factureDuChantier(ctx, "Paysages Lebrun");
    await majAutoliquidationFacture(ctx, facture.id, true);
    const r = await majTvaClientFacture(ctx, facture.id, "fr 12 345 678 901");
    assert.deepEqual(r, { ok: true, clientNumeroTva: "FR12345678901" });
    const [fiche] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ numeroTva: clients.numeroTva }).from(clients).where(eq(clients.id, client.id))
    );
    assert.equal(fiche?.numeroTva, "FR12345678901");

    // Un second chantier pour le même client : le numéro se reprend.
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chez Lebrun, bis", clientId: client.id });
    const seconde = await creerFactureSansDevis(ctx, autre.id);
    const on = await majAutoliquidationFacture(ctx, seconde.id, true);
    assert.ok(on.ok);
    assert.equal(on.ok && on.clientNumeroTva, "FR12345678901");

    assert.equal((await majTvaClientFacture(ctx, facture.id, "12345")).ok, false);
  });

  await test("le papier : ni TVA ni 293 B, la mention, le numéro du client, la date des travaux", async () => {
    const { facture } = await factureDuChantier(ctx, "Jardins Ribault bis");
    const a = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(a.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Création de massifs", prixUnitaire: "1200" });
    await majAutoliquidationFacture(ctx, facture.id, true);
    await majTvaClientFacture(ctx, facture.id, "FR00123456789");

    // Les lignes du pied se coupent où la largeur le veut : on lit le texte d'un tenant.
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, facture.id)).replace(/\s+/g, " ");
    assert.match(texte, /Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI\./);
    assert.match(texte, /TVA intracommunautaire FR00123456789/);
    assert.match(texte, /TVA intracommunautaire FR12123456789/, "le numéro de l'artisan manque");
    assert.match(texte, /Travaux réalisés/);
    assert.match(texte, /25\/09\/2026/);
    assert.match(texte, /Total à payer/);
    assert.doesNotMatch(texte, /293 B/);
    assert.doesNotMatch(texte, /TVA 20/);

    const emise = await emettreFacture(ctx, facture.id, new Date("2026-10-03T10:00:00Z"));
    assert.equal(emise.totalTva, "0.00");
    assert.equal(emise.totalTtc, "1200.00");
    assert.equal(emise.autoliquidation, true);
  });

  // ── 1A : CE QUI MANQUE POUR ÉMETTRE ──────────────────────────────────────

  await test("une entreprise incomplète : ce qui manque se nomme", async () => {
    const nue = await contexte("nue", false);
    const { facture } = await factureDuChantier(nue);
    const cles = (await manquesDeLaFactureAEmettre(nue, facture.id)).map((m) => m.cle);
    assert.deepEqual(cles, ["adresse", "siret", "forme", "tva"]);
  });

  await test("l'adresse complétée sur la fiche du client lève le refus du brouillon", async () => {
    const { client, facture } = await factureDuChantier(ctx, "Mme Sans Adresse", null);
    assert.deepEqual((await manquesDeLaFactureAEmettre(ctx, facture.id)).map((m) => m.cle), ["client-adresse"]);
    await clientsRepo.mettreAJourClient(ctx, client.id, { adresse: "7 allée des Pins, Orvault" });
    assert.deepEqual(await manquesDeLaFactureAEmettre(ctx, facture.id), []);
    const emise = await emettreFacture(ctx, facture.id);
    assert.equal(emise.clientAdresse, "7 allée des Pins, Orvault", "la pièce est partie sans l'adresse");
  });

  await test("en sous-traitance sans numéro du donneur d'ordre, la facture ne part pas", async () => {
    const { facture } = await factureDuChantier(ctx, "Paysages Sans Numéro");
    await majAutoliquidationFacture(ctx, facture.id, true);
    assert.deepEqual((await manquesDeLaFactureAEmettre(ctx, facture.id)).map((m) => m.cle), ["tva-client"]);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
