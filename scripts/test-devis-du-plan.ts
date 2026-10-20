import assert from "node:assert/strict";
import { messageDuComplement, montageDuDevis, reconnaitreLeDevis } from "../src/lib/arrosage/devis-du-plan";

// L'import d'un devis fournisseur dans l'outil d'arrosage (`devis-du-plan.ts`) :
// reconnu par la référence, jamais par un nom voisin ; la nourrice validée au
// nombre de voies des électrovannes ; ce qui manque se dit.

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

const lu = (designation: string, reference: string | null, quantite: string | null, unite = "pièce") => ({ designation, reference, quantite, unite, prixHt: "1.00" });

test("par référence, sinon une ligne « pas dans le catalogue », jamais devinée", () => {
  const r = reconnaitreLeDevis([
    lu("Electrovanne 100DV MM 9V", "REV100DVM9V", "2"),
    lu("Électrovanne 100 DV FF", "REV 100DV9V", "1"),
    lu("Turbine", "RA3504", "13"),
    lu("Participation aux frais de port", null, "1"),
    lu("Turbine sans quantité", "RA3504", null),
  ]);
  assert.deepEqual(r.connues.map((c) => [c.cle, c.q]), [["electrovanne-100dv", 2], ["electrovanne-100dv-ff", 1], ["RA3504", 13]]);
  assert.deepEqual(r.inconnues.map((i) => i.lu), ["Participation aux frais de port", "Turbine sans quantité, RA3504"]);
});

test("trois électrovannes dont une FF : la nourrice 3 voies, dont 1 en goutte-à-goutte", () => {
  const { connues } = reconnaitreLeDevis([lu("EV", "REV100DVM9V", "2"), lu("EV FF", "REV100DV9V", "1")]);
  const m = montageDuDevis(connues, false);
  assert.equal(m.titre, "La nourrice 3 voies");
  assert.equal(m.phrase, "3 électrovannes sur le devis, donc 3 réseaux, dont 1 en goutte-à-goutte.");
  assert.ok(m.nourrice, "la nourrice validée doit se composer");
  // Le devis n'apporte que les électrovannes : tout le reste de la fiche manque, et se grise.
  assert.ok(m.manque.some((x) => x.cle === "union" && x.q === 4));
  assert.ok(!m.manque.some((x) => x.cle === "electrovanne-100dv"));
  assert.ok(m.absentes.size > 0);
  const complete = montageDuDevis(connues, true);
  assert.equal(complete.absentes.size, 0, "ce qui manque ajouté, rien ne reste gris");
});

test("le message au fournisseur dit ce qui manque, marque devant, référence derrière", () => {
  const msg = messageDuComplement([{ cle: "union", nom: "Manchon union 1\" FF", q: 4 }], [{ ref: "RA3504", nom: "Turbine 3504", q: 1 }]);
  assert.match(msg, /^Bonjour,\n\nEn complément de votre devis, merci de m’ajouter :\n\n4x Dura Manchon union 1" FF, réf\. ODU329010\n1x Turbine 3504, réf\. RA3504\n\nMerci\.$/);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
