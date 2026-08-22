// La grille du mois — sans base de données.
//
// **Le contrôle des colonnes n'est pas une précaution de principe.** Le 1er
// août 2026 est un SAMEDI, et une grille qui se cale mal pose quatre cases de
// juillet au lieu de cinq : tous les chiffres sont là, aucun n'est en trop,
// et pourtant TOUT LE MOIS a glissé d'un jour. C'est invisible à la relecture
// et évident sur une capture — d'où des contrôles sur les colonnes du 1er, du
// 10, du 15 et du 31.

import assert from "node:assert/strict";
import {
  grilleDuMois,
  estWeekEndIso,
  JOURS_COURTS,
} from "../src/lib/mois";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Dans quelle colonne (0 = lundi) tombe ce jour du mois ? */
function colonne(cases: ReturnType<typeof grilleDuMois>, numero: number): number {
  const i = cases.findIndex((c) => !c.horsMois && c.numero === numero);
  assert.notEqual(i, -1, `le ${numero} n'est pas dans la grille`);
  return i % 7;
}

console.log("=== La grille du mois dit-elle vrai ? ===");

essai("la semaine commence LUNDI, pas dimanche", () => {
  assert.deepEqual(JOURS_COURTS, ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]);
});

essai("août 2026 : le 1er tombe un SAMEDI — colonne 5", () => {
  const aout = grilleDuMois(2026, 7);
  assert.equal(colonne(aout, 1), 5, "le 1er août 2026 n'est pas en colonne du samedi");
});

essai("août 2026 : le 10, le 15 et le 31 tombent où il faut", () => {
  const aout = grilleDuMois(2026, 7);
  // 10 août 2026 = lundi, 15 = samedi, 31 = lundi.
  assert.equal(colonne(aout, 10), 0, "le 10 août n'est pas un lundi");
  assert.equal(colonne(aout, 15), 5, "le 15 août n'est pas un samedi");
  assert.equal(colonne(aout, 31), 0, "le 31 août n'est pas un lundi");
});

essai("un mois qui commence un samedi porte CINQ cases de dépassement", () => {
  const aout = grilleDuMois(2026, 7);
  const avant = aout.findIndex((c) => !c.horsMois);
  assert.equal(avant, 5, `${avant} cases de juillet avant le 1er août, au lieu de cinq`);
});

essai("un mois qui commence un lundi n'en porte aucune", () => {
  // Juin 2026 commence un lundi.
  const juin = grilleDuMois(2026, 5);
  assert.equal(juin.findIndex((c) => !c.horsMois), 0);
  assert.equal(colonne(juin, 1), 0);
});

essai("février bissextile : 29 jours, et pas un de plus", () => {
  const fev = grilleDuMois(2028, 1);
  const dedans = fev.filter((c) => !c.horsMois);
  assert.equal(dedans.length, 29);
  assert.equal(dedans[dedans.length - 1].numero, 29);
});

essai("la grille est toujours faite de semaines entières", () => {
  for (let mois = 0; mois < 12; mois++) {
    const g = grilleDuMois(2026, mois);
    assert.equal(g.length % 7, 0, `mois ${mois} : ${g.length} cases`);
    assert.ok(g.length >= 28 && g.length <= 42, `mois ${mois} : ${g.length} cases`);
  }
});

essai("chaque case sait si elle est un week-end, et elle dit vrai", () => {
  const aout = grilleDuMois(2026, 7);
  for (const c of aout) {
    assert.equal(c.weekEnd, estWeekEndIso(c.jour), `${c.jour} : week-end mal marqué`);
  }
  // Et le 1er août 2026 en est un.
  assert.ok(aout.find((c) => c.jour === "2026-08-01")!.weekEnd);
});

essai("aucun jour n'est en double, et ils se suivent", () => {
  const g = grilleDuMois(2026, 7);
  assert.equal(new Set(g.map((c) => c.jour)).size, g.length);
  for (let i = 1; i < g.length; i++) {
    const veille = new Date(`${g[i - 1].jour}T12:00:00Z`).getTime();
    const jour = new Date(`${g[i].jour}T12:00:00Z`).getTime();
    assert.equal(jour - veille, 86_400_000, `trou entre ${g[i - 1].jour} et ${g[i].jour}`);
  }
});

// **LES CINQ MARQUES ET LA RÉPARTITION PAR ÉQUIPE ONT QUITTÉ CE FICHIER** le
// 21 août 2026, avec le planning refait (planche 84). Leurs contrôles n'ont pas
// disparu : ils ont suivi les règles qui les remplacent, dans
// `scripts/test-planning-jour.ts` — quatre états au lieu de cinq marques, une
// barre qui se remplit à la proportion, et des blocs bâtis sur le chantier.
//
// Les effacer sans le dire aurait laissé croire que ce fichier n'a jamais rien
// tenu de plus que la grille.

console.log(`\n${echecs === 0 ? "✅" : "❌"} La grille du mois — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
