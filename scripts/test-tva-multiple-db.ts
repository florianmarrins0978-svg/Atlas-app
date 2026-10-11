// Plusieurs TVA, du devis jusqu'à la facture émise et au relevé.
//
// **CE QUE CETTE SUITE EMPÊCHE, ET ÇA FINIT DANS UNE DÉCLARATION.** Sa demande
// du 1er septembre 2026 : la main d'œuvre à 20 %, les plantes à 10 %, sur le
// même devis. Le taux vit désormais sur la LIGNE (migration 0073), et il doit
// voyager — ligne de prix → devis → PDF → facture → relevé de TVA. **Chaque
// étape oubliée est une TVA fausse**, et celle qu'on oublierait en premier est
// la facture, parce qu'elle est écrite loin du devis.
//
// **Une suite navigateur ne verrait rien de tout cela** : l'écran du devis
// afficherait fièrement ses deux catégories pendant que la facture se réglerait
// sur un seul taux. C'est en LISANT LA BASE, des deux côtés, que l'écart
// apparaît — la même leçon que `test-reduction-parcours-db.ts`.
//
// Ce qu'elle tient, dans l'ordre du parcours :
//
//   1. le taux se pose par CATÉGORIE, et toutes les lignes suivent d'un geste ;
//   2. les totaux du devis ventilent, et la somme retombe juste ;
//   3. retirer une catégorie ne supprime pas ses lignes ;
//   4. le taux arrive sur le devis envoyé, puis sur la facture, puis à
//      l'émission — où les totaux sont refigés une dernière fois ;
//   5. un devis à un seul taux — c'est-à-dire tous ceux d'avant — ne change
//      pas d'un centime.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import {
  ajouterLignePrix,
  changerTauxCategorie,
  retirerCategorieTva,
  listerLignesPrix,
} from "../src/server/repositories/lignes-prix";
import {
  getOuCreerDevisBrouillon,
  mettreAJourEnTeteDevis,
  envoyerDevis,
} from "../src/server/repositories/devis";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
} from "../src/server/repositories/factures";
import { lignesDevis } from "../src/server/db/schema";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { eq } from "drizzle-orm";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Son chantier de la maquette : 2 220 € de main d'œuvre à 20 %, 1 096,80 € de
 * végétaux à 10 %.
 */
async function monterDevisMixte() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai TVA multiple" },
    { email: `tva-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await creerChantier(ctx, { nom: "Haie de charmille" });

  // La main d'œuvre suit le taux du devis : aucune ligne ne porte « 20 » écrit
  // à la main, exactement comme un devis existant.
  await ajouterLignePrix(ctx, chantier.id, "Taille de haie de charmille", "1400.00");
  await ajouterLignePrix(ctx, chantier.id, "Évacuation des déchets verts", "180.00");
  await ajouterLignePrix(ctx, chantier.id, "Plantation et mise en place", "640.00");
  // Les végétaux, eux, entrent dans leur catégorie.
  await ajouterLignePrix(ctx, chantier.id, "Charmille en motte", "990.00", { tauxTva: "10.00" });
  await ajouterLignePrix(ctx, chantier.id, "Terreau de plantation", "106.80", { tauxTva: "10.00" });

  const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
  return { ctx, chantierId: chantier.id, devisId: devis.id, devis };
}

async function main() {
  console.log("=== Plusieurs TVA, du devis à la facture ===\n");

  // ── Le devis ─────────────────────────────────────────────────────────────

  await essai("les totaux du devis ventilent par taux, et la somme retombe juste", async () => {
    const { devis } = await monterDevisMixte();
    assert.equal(devis.totalHt, "3316.80");
    // 444,00 (20 % de 2 220) + 109,68 (10 % de 1 096,80)
    assert.equal(devis.totalTva, "553.68");
    assert.equal(devis.totalTtc, "3870.48");
    // Tout à 20 % aurait donné 663,36 € : c'est l'écart qu'on cherche à éviter.
    assert.notEqual(devis.totalTva, "663.36", "le devis a tout compté à 20 %");
  });

  await essai("la remise se répartit, et la TVA de chaque catégorie suit SA base", async () => {
    const { ctx, devisId } = await monterDevisMixte();
    const d = await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "10" });
    assert.ok(d);
    assert.equal(d.reductionMontant, "331.68");
    assert.equal(d.totalHt, "2985.12");
    // 399,60 sur la base à 20 % (1 998,00) + 98,71 sur celle à 10 % (987,12).
    assert.equal(d.totalTva, "498.31");
    assert.notEqual(d.totalTva, "553.68", "la TVA a été calculée sur le prix plein");
    assert.equal(d.totalTtc, "3483.43");
  });

  // ── Les gestes de catégorie ──────────────────────────────────────────────

  await essai("changer le taux d'une catégorie emmène TOUTES ses lignes", async () => {
    // C'est tout l'intérêt du geste : c'est précisément ce qu'il ne voulait pas
    // refaire ligne par ligne.
    const { ctx, chantierId } = await monterDevisMixte();
    await changerTauxCategorie(ctx, chantierId, "10.00", "5.50", "20.00");

    const lignes = await listerLignesPrix(ctx, chantierId);
    const bougees = lignes.filter((l) => l.tauxTva === "5.50");
    assert.equal(bougees.length, 2, "les deux lignes de la catégorie devaient suivre");
    assert.equal(lignes.filter((l) => l.tauxTva === "10.00").length, 0);

    const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
    // 444,00 + 60,32 (5,5 % de 1 096,80)
    assert.equal(devis.totalTva, "504.32");
  });

  await essai("changer la catégorie D'ACCUEIL emmène les lignes sans taux", async () => {
    // **Le piège qui rendait le geste inopérant.** Les lignes de main d'œuvre
    // portent `null` — elles suivent le devis. Chercher « les lignes à 20 »
    // sans le savoir n'en aurait trouvé aucune, et le taux n'aurait pas bougé.
    const { ctx, chantierId } = await monterDevisMixte();
    await changerTauxCategorie(ctx, chantierId, "20.00", "5.50", "20.00");

    const lignes = await listerLignesPrix(ctx, chantierId);
    assert.equal(lignes.filter((l) => l.tauxTva === "5.50").length, 3);
    assert.equal(lignes.filter((l) => l.tauxTva === null).length, 0);
  });

  await essai("RETIRER une catégorie ne supprime pas ses lignes", async () => {
    // La faute à ne pas commettre : il retire une TVA posée par erreur et perd
    // du même geste le travail qu'il venait de chiffrer, sans un mot.
    const { ctx, chantierId } = await monterDevisMixte();
    await retirerCategorieTva(ctx, chantierId, "10.00", "20.00");

    const lignes = await listerLignesPrix(ctx, chantierId);
    assert.equal(lignes.length, 5, "des lignes ont disparu avec la catégorie");
    assert.equal(lignes.filter((l) => l.tauxTva === null).length, 5);

    const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
    // Tout revient au taux du devis : 20 % de 3 316,80.
    assert.equal(devis.totalTva, "663.36");
  });

  await essai("la catégorie d'accueil ne se retire pas — tout y retombe", async () => {
    const { ctx, chantierId } = await monterDevisMixte();
    await retirerCategorieTva(ctx, chantierId, "20.00", "20.00");
    const lignes = await listerLignesPrix(ctx, chantierId);
    assert.equal(lignes.filter((l) => l.tauxTva === "10.00").length, 2, "la catégorie à 10 % a été emportée");
  });

  // ── Le taux voyage jusqu'au bout ─────────────────────────────────────────

  await essai("le taux descend sur les lignes du devis envoyé", async () => {
    const { ctx, devisId } = await monterDevisMixte();
    await envoyerDevis(ctx, devisId);

    const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId))
    );
    assert.equal(lignes.filter((l) => l.tauxTva === "10.00").length, 2, "le devis n'a pas gardé les taux");
    assert.equal(lignes.filter((l) => l.tauxTva === null).length, 3);
  });

  await essai("LE TAUX ARRIVE SUR LA FACTURE — l'étape qu'on oublie en premier", async () => {
    const { ctx, chantierId, devisId } = await monterDevisMixte();
    await envoyerDevis(ctx, devisId);
    await terminerChantier(ctx, chantierId);

    const trouvee = await getFacturePourChantier(ctx, chantierId);
    assert.ok(trouvee, "aucune facture");
    assert.equal(
      trouvee.lignes.filter((l) => l.tauxTva === "10.00").length,
      2,
      "la facture a perdu la catégorie à 10 % : elle se réglera sur un seul taux"
    );
    assert.equal(trouvee.facture.totalTva, "553.68");
    assert.notEqual(trouvee.facture.totalTva, "663.36", "la facture a tout compté à 20 %");
  });

  await essai("et il survit à l'émission, où les totaux sont refigés", async () => {
    const { ctx, chantierId, devisId } = await monterDevisMixte();
    await envoyerDevis(ctx, devisId);
    await terminerChantier(ctx, chantierId);
    const avant = await getFacturePourChantier(ctx, chantierId);
    assert.ok(avant);
    await emettreFacture(ctx, avant.facture.id);

    const emise = await getFacturePourChantier(ctx, chantierId);
    assert.ok(emise);
    assert.equal(emise.facture.statut, "emise");
    assert.equal(emise.facture.totalTva, "553.68", "l'émission a recalculé sur un seul taux");
    assert.equal(emise.facture.totalTtc, "3870.48");
  });

  // ── Ce qui existait ne bouge pas ─────────────────────────────────────────

  await essai("un devis à un seul taux ne change pas d'un centime", async () => {
    await nettoyerBase();
    const { entreprise, utilisateurId } = await creerEntreprise(
      { nom: "Essai taux unique" },
      { email: `uni-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
    );
    const ctx = { utilisateurId, entrepriseId: entreprise.id };
    const chantier = await creerChantier(ctx, { nom: "Élagage" });
    await ajouterLignePrix(ctx, chantier.id, "Élagage — 3 chênes", "450.00");
    await ajouterLignePrix(ctx, chantier.id, "Broyage des branches", "180.00");
    await ajouterLignePrix(ctx, chantier.id, "Évacuation", "240.00");

    const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(devis.totalHt, "870.00");
    assert.equal(devis.totalTva, "174.00");
    assert.equal(devis.totalTtc, "1044.00");

    const lignes = await listerLignesPrix(ctx, chantier.id);
    assert.ok(lignes.every((l) => l.tauxTva === null), "une ligne a pris un taux qu'on ne lui a pas donné");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
