// LES CRÉDITS IA DU MOIS : la règle pure (sa décision du 26 octobre 2026).
//
// Le plafond par formule, l'état que la barre affiche, la date de reprise, et
// le coût estimé d'un appel. Sans base : c'est la règle qu'on fixe ici, la
// coupure et l'écran la lisent.

import assert from "node:assert/strict";
import {
  MICRO,
  coutDUnAppel,
  coutDUneEcoute,
  entreprisesSansPlafond,
  etatDesCreditsIA,
  jourDeReprise,
  moisDu,
  plafondIA,
} from "../src/lib/credits-ia";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Les crédits IA du mois ===\n");
const LE_26 = new Date("2026-10-26T15:00:00Z");

essai("ses plafonds : essai 5, Artisan 10, Entreprise 20, Illimité 60, sans abonnement 10", () => {
  assert.equal(plafondIA({ statut: "essai", formule: "illimite", periodeFin: new Date("2026-11-05T00:00:00Z") }, false, LE_26), 5 * MICRO, "l'essai hérite des 60 € d'Illimité");
  assert.equal(plafondIA({ statut: "actif", formule: "artisan", periodeFin: null }, false, LE_26), 10 * MICRO);
  assert.equal(plafondIA({ statut: "actif", formule: "entreprise", periodeFin: null }, false, LE_26), 20 * MICRO);
  assert.equal(plafondIA({ statut: "actif", formule: "illimite", periodeFin: null }, false, LE_26), 60 * MICRO);
  assert.equal(plafondIA(null, false, LE_26), 10 * MICRO);
});

essai("essai fini ou abonnement résilié : zéro, l'IA ne sert plus à rien qui s'écrive", () => {
  assert.equal(plafondIA({ statut: "essai", formule: "illimite", periodeFin: new Date("2026-10-20T00:00:00Z") }, false, LE_26), 0);
  assert.equal(plafondIA({ statut: "resilie", formule: "artisan", periodeFin: null }, false, LE_26), 0);
  assert.equal((etatDesCreditsIA(0, 0, LE_26) as { etat: string }).etat, "epuise");
});

essai("l'entreprise désignée par le réglage de l'espace n'a pas de plafond", () => {
  assert.equal(plafondIA({ statut: "actif", formule: "artisan", periodeFin: null }, true, LE_26), null);
  assert.deepEqual(etatDesCreditsIA(999 * MICRO, null, LE_26), { plafonne: false });
});

essai("le réglage n'accepte que des identifiants : une faute de frappe n'exempte personne", () => {
  const id = "68e4f690-55c1-46e5-be8e-54c7eb094b16";
  assert.deepEqual([...entreprisesSansPlafond(` ${id.toUpperCase()} , tout, *`)], [id]);
  assert.equal(entreprisesSansPlafond(undefined).size, 0);
});

essai("normal, presque à 80 %, épuisé à 100 %, et la reprise au 1er du mois suivant", () => {
  const p = 10 * MICRO;
  const n = etatDesCreditsIA(4.2 * MICRO, p, LE_26);
  assert.deepEqual(n, { plafonne: true, pourcent: 42, etat: "normal", reprise: new Date("2026-11-01T00:00:00Z") });
  assert.equal((etatDesCreditsIA(8 * MICRO, p, LE_26) as { etat: string }).etat, "presque");
  assert.equal((etatDesCreditsIA(10 * MICRO, p, LE_26) as { etat: string }).etat, "epuise");
  assert.equal((etatDesCreditsIA(12 * MICRO, p, LE_26) as { pourcent: number }).pourcent, 100);
});

essai("à 99,2 %, la barre dit 100 et « presque », jamais un 99 rassurant", () => {
  const e = etatDesCreditsIA(9.92 * MICRO, 10 * MICRO, LE_26) as { pourcent: number; etat: string };
  assert.equal(e.pourcent, 100);
  assert.equal(e.etat, "presque");
});

essai("décembre repart en janvier, et le mois se compte en temps universel", () => {
  assert.deepEqual((etatDesCreditsIA(0, MICRO, new Date("2026-12-31T12:00:00Z")) as { reprise: Date }).reprise, new Date("2027-01-01T00:00:00Z"));
  assert.equal(moisDu(LE_26), "2026-10-01");
});

essai("le coût d'un devis dicté reste de l'ordre de quelques centimes (son estimation)", () => {
  // Une consigne de 4 000 jetons, une réponse de 1 000, chez Anthropic : 0,027 €.
  const appel = coutDUnAppel("anthropic", 4000, 1000);
  assert.equal(appel, 27_000);
  // Deux minutes de dictée au poids d'un téléphone (32 kbit/s, 480 Ko).
  const ecoute = coutDUneEcoute("openai", 480_000);
  assert.ok(ecoute > 0 && ecoute < 0.05 * MICRO, `écoute estimée à ${ecoute} micro-euros`);
});

essai("la reprise se lit « 1er novembre », comme sur la planche", () => {
  assert.equal(jourDeReprise(new Date("2026-11-01T00:00:00Z")), "1er novembre");
  assert.equal(jourDeReprise(new Date("2027-01-01T00:00:00Z")), "1er janvier");
});

essai("un fournisseur inconnu est compté au plus cher, jamais à zéro", () => {
  assert.equal(coutDUnAppel("inconnu", 1000, 1000), coutDUnAppel("anthropic", 1000, 1000));
  assert.ok(coutDUneEcoute("inconnu", 480_000) >= coutDUneEcoute("openai", 480_000));
});

console.log(`\nCrédits IA — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
