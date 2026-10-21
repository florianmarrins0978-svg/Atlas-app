import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { poserPrixGrille } from "../src/server/repositories/grille-prix";
import { lireGrilles } from "../src/server/repositories/grilles-reglables";
import { celluleFendage } from "../src/lib/grille-prix";
import { chiffrerLesAjouts } from "../src/server/chiffrage/ajouts-dictes";
import { direRetouche, resoudreRetouches, type Retouche } from "../src/lib/retouches-devis";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Une ligne dictée DANS le devis va chercher ses prix à lui** — son
// signalement du 21 octobre 2026, captures à l'appui : il dicte, depuis le
// micro en haut à droite du devis, « on évacue le gros bois, il y a 15 tonnes,
// et on a un fût de 10 mètres à fendre en 50 cm, le fût fait 80 cm de
// diamètre ». Les trois lignes arrivaient « Aucun prix dicté, à vous de la
// chiffrer » alors que « Évacuation » est dans ses tarifs à 150 € le forfait.
//
// Ce chemin ne consultait QUE le prix prononcé : ni sa grille, ni ses tarifs,
// ni ses prix d'achat. Sous `atlas_app`, avec ses chiffres.

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

async function sonEntreprise(n: string) {
  const { entreprise: e, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Ajouts ${n}` },
    { email: `ajouts-${n}-${Date.now()}@t.test` }
  );
  const A = { entrepriseId: e.id, utilisateurId };
  // Ses tarifs, recopiés de sa capture du 21 octobre 2026.
  for (const [intitule, prix, unite] of [
    ["Broyeur", "250", "forfait"],
    ["Mini pelle", "400", "forfait"],
    ["Fendeuse", "150", "forfait"],
    ["Mains d'œuvre plus mini pelle", "500", "forfait"],
    ["Évacuation", "150", "forfait"],
    ["Main d'œuvre", "400", "jour/homme"],
  ] as const) {
    await tarifsRepo.creerTarif(A, { intitule, prix, unite });
  }
  const c = await chantiersRepo.creerChantier(A, { nom: "Chêne en rétention" });
  return { A, c };
}

const ajout = (libelle: string, quantite: string | null = null, unite: string | null = null): Retouche => ({
  type: "ajouter",
  libelle,
  quantite,
  unite,
  prixUnitaire: null,
});

async function main() {
  await nettoyerBase();

  await test("« Évacuation du gros bois, 15 tonnes » prend son tarif Évacuation : 150 € le forfait, pas 15 × 150", async () => {
    const { A, c } = await sonEntreprise("evac");
    const [r] = await chiffrerLesAjouts(A, c.id, resoudreRetouches([], [ajout("Évacuation du gros bois", "15", "tonne")]));
    assert.ok(r.retouche.type === "ajouter");
    assert.equal(r.retouche.prixUnitaire, "150.00");
    assert.equal(r.retouche.quantite, "1", "un forfait ne se multiplie pas par des tonnes");
    assert.match(r.retouche.libelle, /15 tonnes/, "les 15 tonnes qu'il a dites restent écrites");
    assert.match(direRetouche(r).detail, /Évacuation/, "l'écran dit d'où vient le prix");
  });

  await test("la fente d'un fût de 10 m et 80 cm prend la case de SA grille de fendage", async () => {
    const { A, c } = await sonEntreprise("fente");
    const { axes } = await lireGrilles(A);
    const cellule = celluleFendage(10, 80, axes);
    assert.ok(cellule, "la grille d'origine a une case pour 10 m × 80 cm");
    await poserPrixGrille(A, "fendage", cellule.cle, "900");
    const [r] = await chiffrerLesAjouts(
      A,
      c.id,
      resoudreRetouches([], [ajout("Fente du fût en billons de 50 cm, fût de 10 m de long et 80 cm de diamètre")])
    );
    assert.ok(r.retouche.type === "ajouter");
    assert.equal(Number(r.retouche.prixUnitaire), 900);
  });

  await test("un prix qu'il a dicté n'est jamais remplacé par un tarif", async () => {
    const { A, c } = await sonEntreprise("dicte");
    const dicte: Retouche = { ...ajout("Évacuation du gros bois"), prixUnitaire: "300" } as Retouche;
    const [r] = await chiffrerLesAjouts(A, c.id, resoudreRetouches([], [dicte]));
    assert.ok(r.retouche.type === "ajouter");
    assert.equal(r.retouche.prixUnitaire, "300");
  });

  await test("un travail qu'aucun de ses prix ne connaît reste à chiffrer, jamais à zéro", async () => {
    const { A, c } = await sonEntreprise("rien");
    const [r] = await chiffrerLesAjouts(A, c.id, resoudreRetouches([], [ajout("Plantation d'une glycine")]));
    assert.ok(r.retouche.type === "ajouter");
    assert.equal(r.retouche.prixUnitaire, null);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
