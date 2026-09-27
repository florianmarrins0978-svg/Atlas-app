// La hausse d'un devis repris, et la question du tarif du jour : les règles,
// sans base.
//
// **Ses décisions du 26 septembre 2026**, prises sur
// `appli/augmenter-un-devis-repris.html` : « + 5, 10, 30 % » ou un taux tapé,
// « l'arrondi », « équitablement aux lignes » ; puis « il faut reprendre les
// prix de l'ancien devis, à la limite demande s'il veut qu'on mette les prix à
// jour ». Ce qui se calcule ici part chez son client : un centime faux se
// relit sur un PDF qu'il ne peut plus retirer.

import assert from "node:assert/strict";
import {
  lireTauxDeHausse,
  prixAugmente,
  prixDeLaLigneReprise,
  lignesAMettreAJour,
  memeValeur,
} from "../src/lib/hausse-du-devis";

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

console.log("=== La hausse d'un devis repris ===\n");

// ─── Le taux qu'il tape ─────────────────────────────────────────────────────
essai("les trois pastilles et un taux tapé à la française se lisent", () => {
  assert.equal(lireTauxDeHausse("5"), 5);
  assert.equal(lireTauxDeHausse("10"), 10);
  assert.equal(lireTauxDeHausse(" 7,5 "), 7.5);
  assert.equal(lireTauxDeHausse("7.5"), 7.5);
  assert.equal(lireTauxDeHausse("100"), 100);
});

essai("une case vide veut dire « pas de hausse »", () => {
  assert.equal(lireTauxDeHausse(""), 0);
  assert.equal(lireTauxDeHausse("   "), 0);
});

// Au delà de 100 %, c'est une faute de frappe bien plus souvent qu'une
// intention, et un devis qui double sans qu'on le voie part chez le client.
essai("un taux illisible ou hors borne est REFUSÉ, jamais deviné", () => {
  for (const faux of ["150", "0", "-5", "7,55", "dix", "5%", "1e2", "0,0"]) {
    assert.equal(lireTauxDeHausse(faux), null, `« ${faux} » aurait dû être refusé`);
  }
});

// ─── L'arrondi ──────────────────────────────────────────────────────────────
// Le prix UNITAIRE s'arrondit au centime, demi vers le haut. Arrondir le seul
// montant laisserait un prix à trois décimales que le client ne recompte pas.
essai("le prix unitaire s'arrondit au centime, demi vers le haut", () => {
  assert.equal(prixAugmente("0.37", 5), "0.39"); // 0,3885
  assert.equal(prixAugmente("14.90", 7.5), "16.02"); // 16,0175
  assert.equal(prixAugmente("6.45", 10), "7.10"); // 7,095 : le demi monte
  assert.equal(prixAugmente("18.20", 7.5), "19.57"); // 19,565 : le demi monte
  assert.equal(prixAugmente("42", 30), "54.60");
});

// En flottants, 14,90 × 1,05 rend 15,645000000000001 ou 15,644999999999999
// selon l'ordre des opérations, et l'arrondi bascule d'un centime.
essai("aucun flottant ne décide d'un centime", () => {
  assert.equal(prixAugmente("14.90", 5), "15.65"); // 15,645 exact
  assert.equal(prixAugmente("1.005", 0), "1.01");
});

essai("sans hausse, le prix ne bouge pas", () => {
  assert.equal(prixAugmente("17.50", 0), "17.50");
});

// ─── La ligne reprise ───────────────────────────────────────────────────────
const haie = { prixAncien: "17.50", prixGrille: "18.20" };
const evacuation = { prixAncien: "90.00", prixGrille: null };

essai("sans réponse à la question, l'ancien prix reste", () => {
  assert.equal(prixDeLaLigneReprise(haie, null, 0), "17.50");
});

essai("« Garder les anciens » : l'ancien prix reste", () => {
  assert.equal(prixDeLaLigneReprise(haie, "non", 0), "17.50");
});

essai("« Mettre à jour » : le tarif du jour", () => {
  assert.equal(prixDeLaLigneReprise(haie, "oui", 0), "18.20");
  assert.equal(prixDeLaLigneReprise(evacuation, "oui", 0), "90.00");
});

// La hausse part du prix affiché APRÈS sa réponse : c'est lui qui a dit oui au
// tarif du jour, et les + 10 % s'appliquent à ce qu'il a sous les yeux.
essai("la hausse part du prix choisi, sur toutes les lignes reprises", () => {
  assert.equal(prixDeLaLigneReprise(haie, "oui", 10), "20.02");
  assert.equal(prixDeLaLigneReprise(haie, "non", 10), "19.25");
  assert.equal(prixDeLaLigneReprise(evacuation, null, 10), "99.00");
});

// Les taux ne s'additionnent pas : on repart toujours de la base.
essai("10 % après 5 % donne 10 %, jamais 15,5 %", () => {
  const apres5 = prixDeLaLigneReprise(evacuation, null, 5);
  assert.equal(apres5, "94.50");
  assert.equal(prixDeLaLigneReprise(evacuation, null, 10), "99.00");
});

// ─── La question ────────────────────────────────────────────────────────────
// Un avertissement qui parle à tort s'apprend à être ignoré : la question ne
// se pose que si un tarif du jour DIFFÈRE vraiment de l'ancien prix.
essai("la question liste les seules lignes dont le tarif a bougé", () => {
  const r = lignesAMettreAJour([
    { id: "a", libelle: "Taille de haie", prixAncien: "17.50", prixGrille: "18.20" },
    { id: "b", libelle: "Évacuation", prixAncien: "90.00", prixGrille: null },
    { id: "c", libelle: "Tonte", prixAncien: "0.37", prixGrille: "0.370" },
    { id: "d", libelle: "Saisie à la main", prixAncien: null, prixGrille: null },
  ]);
  assert.deepEqual(r.map((l) => l.id), ["a"]);
});

// L'écran renvoie le prix à chaque champ quitté, écrit à la française : ce
// n'est pas une retouche, et la ligne ne doit pas sortir de la reprise.
essai("« 17,5 » et « 17.50 » sont le même prix ; « 17,6 » ne l'est pas", () => {
  assert.equal(memeValeur("17,5", "17.50"), true);
  assert.equal(memeValeur(" 1 200,00 ", "1200"), true);
  assert.equal(memeValeur("17,6", "17.50"), false);
  assert.equal(memeValeur("", "17.50"), false);
  assert.equal(memeValeur("abc", "abc"), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Hausse d'un devis repris : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
