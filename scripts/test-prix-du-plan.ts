import assert from "node:assert/strict";
import { lesMoinsChers, prixDesFournisseurs, type PieceDuPlan } from "../src/lib/arrosage/prix-du-plan";
import { prixDeLigne, totalDeLaListe } from "../src/lib/arrosage/prix-de-la-liste";

// Quel prix d'achat va à quelle pièce de la liste du plan (`prix-du-plan.ts`) :
// par la référence, jamais par un nom voisin ; l'unité concorde ; le moins cher
// de ses fournisseurs. La colonne et le total sont ceux de la liste
// (`prix-de-la-liste.ts`), éprouvés ici sur ce qu'on leur donne.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const pieces: PieceDuPlan[] = [
  { ref: "RA3504", nom: "Turbine 3504", q: 13, u: "u", reference: "RA3504" },
  { ref: "te-taraude-25-34-25", nom: "Plasson Té 90° taraudé 25×3/4\"×25", q: 14, u: "u", reference: "OPL71402520" },
  { ref: "pe25", nom: "PEHD Ø25", q: 83, u: "ml", reference: null },
];
const fournisseurs = [
  { id: "a", nom: "Aqua Plus" },
  { id: "f", nom: "France Bonhomme" },
];
const achat = (societeId: string, nom: string, reference: string | null, prixHt: string, unite = "pièce") => ({
  societeId, societeNom: societeId, reference, nom, prixHt, unite, releveLe: "2026-10-19",
});
const achats = [
  achat("a", "Turbine Rain Bird", "RA 3504", "12.40"),
  achat("f", "3504", "RA3504", "11.90"),
  achat("a", "pehd ø25", null, "0.80", "m"),
  // Un nom voisin, sans référence : il ne doit PAS prendre le prix du té taraudé.
  achat("a", "Plasson Té 90° 25×25×25", null, "2.10"),
];

test("par référence (espaces et casse mis à part), sinon par nom identique, jamais par un nom voisin", () => {
  const [a] = prixDesFournisseurs(pieces, achats, fournisseurs);
  assert.deepEqual(Object.keys(a.prix).sort(), ["RA3504", "pe25"]);
});

test("le moins cher de ses fournisseurs, pièce par pièce", () => {
  assert.deepEqual(lesMoinsChers(prixDesFournisseurs(pieces, achats, fournisseurs)), { RA3504: 11.9, pe25: 0.8 });
});

test("un prix au mètre ne vaut que pour une longueur, et une couronne n'est pas un mètre", () => {
  const couronne = [achat("a", "PEHD Ø25", null, "45.00", "pièce")];
  assert.deepEqual(lesMoinsChers(prixDesFournisseurs(pieces, couronne, fournisseurs)), {});
  const auMetre = [achat("a", "Turbine 3504", "RA3504", "12.00", "m")];
  assert.deepEqual(lesMoinsChers(prixDesFournisseurs(pieces, auMetre, fournisseurs)), {});
});

test("la liste le compte : 13 × 11,90 + 83 × 0,80, la pièce sans prix à part", () => {
  const table = lesMoinsChers(prixDesFournisseurs(pieces, achats, fournisseurs));
  const groupes = [{ titre: "Réseau 1", lignes: Object.fromEntries(pieces.map((p) => [p.ref, { nom: p.nom, q: p.q, u: p.u }])), retirees: {}, barrees: {} }];
  const t = totalDeLaListe(groupes, table);
  assert.equal(t.total, 221.1);
  assert.equal(t.sansPrix, 1);
  assert.equal(prixDeLigne("RA3504", groupes[0].lignes.RA3504, table), 154.7);
});

test("sans aucun prix d'achat, aucun prix : jamais un prix inventé", () => {
  assert.deepEqual(lesMoinsChers(prixDesFournisseurs(pieces, [], fournisseurs)), {});
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
