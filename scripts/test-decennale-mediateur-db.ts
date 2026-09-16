import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as devisRepo from "../src/server/repositories/devis";
import { eq } from "drizzle-orm";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { devis } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";

/** La ligne du devis, telle qu'elle est RANGÉE — c'est elle qui porte le figé. */
async function ligneDuDevis(ctx: { utilisateurId: string; entrepriseId: string }, devisId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx.select().from(devis).where(eq(devis.id, devisId)).limit(1);
    return d;
  });
}

/**
 * LA DÉCENNALE ET LE MÉDIATEUR SE FIGENT SUR LE DOCUMENT — migration 0093.
 *
 * **Pourquoi cette suite-ci existe, à côté de celle du PDF.** Celle du PDF
 * injecte les cinq champs à la main et prouve qu'ils s'impriment : elle serait
 * verte même si la création du devis ne les recopiait pas. C'est exactement la
 * faute du 28 août 2026 — éprouver la moitié qu'on vient d'écrire, jamais le
 * chemin que le patron emprunte (`CLAUDE.md` §5 quater).
 *
 * Ce qui se joue ici : **changer d'assureur ne doit rien réécrire sur un devis
 * déjà établi.** C'est la pièce qui prouve la couverture au moment du chantier.
 */

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

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages Atlas" },
    { email: "decennale@test.local", nom: "Flori" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };

  await test("les cinq champs s'enregistrent sur l'entreprise", async () => {
    await entreprisesRepo.mettreAJourEntreprise(ctx, {
      assureurDecennale: "AXA",
      contratDecennale: "0000020872696404",
      couvertureDecennale: "France métropolitaine",
      mediateurNom: "CM2C",
      mediateurCoordonnees: "49 rue de Ponthieu, 75008 Paris",
    });
    const relue = await entreprisesRepo.getEntreprise(ctx);
    assert.equal(relue?.assureurDecennale, "AXA");
    assert.equal(relue?.contratDecennale, "0000020872696404");
    assert.equal(relue?.couvertureDecennale, "France métropolitaine");
    assert.equal(relue?.mediateurNom, "CM2C");
    assert.equal(relue?.mediateurCoordonnees, "49 rue de Ponthieu, 75008 Paris");
  });

  await test("une chaîne vide EFFACE, elle ne laisse pas l'ancienne valeur", async () => {
    // Il doit pouvoir retirer un assureur saisi de travers.
    await entreprisesRepo.mettreAJourEntreprise(ctx, { couvertureDecennale: "" });
    assert.equal((await entreprisesRepo.getEntreprise(ctx))?.couvertureDecennale, null);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { couvertureDecennale: "France métropolitaine" });
  });

  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Jardin Bernard" });
  await lignesPrixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "560.00");

  let devisId = "";

  await test("LE DEVIS CRÉÉ RECOPIE LES CINQ CHAMPS", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    devisId = d.id;
    const pdf = await ligneDuDevis(ctx, d.id);
    assert.equal(pdf?.entrepriseAssureurDecennale, "AXA", "l'assureur n'a pas été figé sur le devis");
    assert.equal(pdf?.entrepriseContratDecennale, "0000020872696404");
    assert.equal(pdf?.entrepriseCouvertureDecennale, "France métropolitaine");
    assert.equal(pdf?.entrepriseMediateurNom, "CM2C", "le médiateur n'a pas été figé sur le devis");
    assert.equal(pdf?.entrepriseMediateurCoordonnees, "49 rue de Ponthieu, 75008 Paris");
  });

  await test("CHANGER D'ASSUREUR NE RÉÉCRIT PAS LE DEVIS DÉJÀ ÉTABLI", async () => {
    await entreprisesRepo.mettreAJourEntreprise(ctx, {
      assureurDecennale: "Groupama",
      contratDecennale: "999",
    });
    const pdf = await ligneDuDevis(ctx, devisId);
    assert.equal(pdf?.entrepriseAssureurDecennale, "AXA", "un devis parti a changé d'assureur tout seul");
    assert.equal(pdf?.entrepriseContratDecennale, "0000020872696404");
  });

  await test("une entreprise qui n'a rien saisi fige des valeurs NULLES, sans tomber", async () => {
    const { entreprise: e2, utilisateurId: u2 } = await entreprisesRepo.creerEntreprise(
      { nom: "Sans assurance" },
      { email: "vide@test.local", nom: "B" }
    );
    const ctx2 = { entrepriseId: e2.id, utilisateurId: u2 };
    const ch2 = await chantiersRepo.creerChantier(ctx2, { nom: "Jardin vide" });
    await lignesPrixRepo.ajouterLignePrix(ctx2, ch2.id, "Tonte", "80.00");
    const d2 = await devisRepo.getOuCreerDevisBrouillon(ctx2, ch2.id);
    const pdf = await ligneDuDevis(ctx2, d2.id);
    assert.equal(pdf?.entrepriseAssureurDecennale, null);
    assert.equal(pdf?.entrepriseMediateurNom, null);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
