// La grille du mois, et les cinq marques — sans base de données.
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
  marqueDuJour,
  estWeekEndIso,
  jourLisibleCourt,
  repartirParEquipe,
  JOURS_COURTS,
} from "../src/lib/mois";
import { cleCreneau } from "../src/server/disponibilites";

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

console.log("\n=== Les cinq marques — « complet » se compte PAR ÉQUIPE ===");

const occ = (paires: [string, "matin" | "apres_midi", number][]) =>
  new Map(paires.map(([jour, moment, n]) => [cleCreneau({ jour, moment }), n]));

essai("rien de posé : aucune marque", () => {
  assert.equal(marqueDuJour("2026-08-10", new Map(), 2), "libre");
});

essai("une équipe sur deux prise le matin : il RESTE de la place", () => {
  // Le cœur du compteur de Réglages : ce jour reste proposable.
  const o = occ([["2026-08-10", "matin", 1]]);
  assert.equal(marqueDuJour("2026-08-10", o, 2), "reste");
});

essai("la même occupation, à UNE équipe, rend le matin complet", () => {
  const o = occ([["2026-08-10", "matin", 1]]);
  assert.equal(marqueDuJour("2026-08-10", o, 1), "matin");
});

essai("les deux équipes prises le matin : demi-disque haut", () => {
  const o = occ([["2026-08-10", "matin", 2]]);
  assert.equal(marqueDuJour("2026-08-10", o, 2), "matin");
});

essai("l'après-midi seul : demi-disque bas", () => {
  const o = occ([["2026-08-10", "apres_midi", 2]]);
  assert.equal(marqueDuJour("2026-08-10", o, 2), "apres_midi");
});

essai("les deux demi-journées complètes : disque plein", () => {
  const o = occ([
    ["2026-08-10", "matin", 2],
    ["2026-08-10", "apres_midi", 2],
  ]);
  assert.equal(marqueDuJour("2026-08-10", o, 2), "plein");
});

essai("une demi-journée pleine et l'autre entamée : ce n'est PAS un jour plein", () => {
  const o = occ([
    ["2026-08-10", "matin", 2],
    ["2026-08-10", "apres_midi", 1],
  ]);
  assert.equal(marqueDuJour("2026-08-10", o, 2), "matin");
});

essai("un compteur aberrant ne rend pas tout complet", () => {
  const o = occ([["2026-08-10", "matin", 1]]);
  assert.equal(marqueDuJour("2026-08-10", o, 0), "matin");
  assert.equal(marqueDuJour("2026-08-10", o, Number.NaN), "matin");
});

essai("la date de la journée s'écrit en français, capitale en tête", () => {
  assert.equal(jourLisibleCourt("2026-08-20"), "Jeudi 20 août");
  assert.equal(jourLisibleCourt("2026-08-01"), "Samedi 1 août");
});

console.log("\n=== Qui occupe quelle équipe ===");

essai("un chantier attribué garde SON rang", () => {
  const l = repartirParEquipe([{ id: "b", rangEquipe: 2 }], 2);
  assert.equal(l[0].occupe, null);
  assert.equal(l[1].occupe?.id, "b");
});

essai("un chantier sans équipe prend le premier rang libre, sans qu'on lui en invente une", () => {
  const l = repartirParEquipe([{ id: "x", rangEquipe: null }], 2);
  assert.equal(l[0].occupe?.id, "x");
  assert.equal(l[1].occupe, null);
});

essai("les attribués passent d'abord — un sans-équipe ne prend pas leur place", () => {
  const l = repartirParEquipe(
    [{ id: "aaa", rangEquipe: null }, { id: "zzz", rangEquipe: 1 }],
    2
  );
  assert.equal(l[0].occupe?.id, "zzz");
  assert.equal(l[1].occupe?.id, "aaa");
});

essai("deux rendus successifs montrent la même chose", () => {
  const entree = [{ id: "b", rangEquipe: null }, { id: "a", rangEquipe: null }];
  const un = repartirParEquipe(entree, 2).map((l) => l.occupe?.id);
  const deux = repartirParEquipe([...entree].reverse(), 2).map((l) => l.occupe?.id);
  assert.deepEqual(un, deux, "l'ordre d'entrée change l'affichage : le planning bougerait tout seul");
});

essai("un rang devenu hors bornes ne fait pas disparaître le chantier", () => {
  // Le compteur est passé de 3 à 2 : l'équipe C n'existe plus à l'écran.
  const l = repartirParEquipe([{ id: "c", rangEquipe: 3 }], 2);
  assert.equal(l[0].occupe?.id, "c", "le chantier a disparu de l'écran");
});

essai("à une seule équipe, il n'y a qu'une ligne", () => {
  assert.equal(repartirParEquipe([{ id: "a", rangEquipe: null }], 1).length, 1);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le mois et ses marques — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
