// Les jours fériés : sans base de données.
//
// Pâques se vérifie sur des dates connues, dont les deux bornes extrêmes du
// calendrier (le 22 mars et le 25 avril) : une formule qui tient en 2026 mais
// glisse en 2038 marquerait faux l'Ascension et la Pentecôte cette année-là,
// et personne ne le verrait avant.

import assert from "node:assert/strict";
import { dimancheDePaques, estEnAlsaceMoselle, feriesDeLAnnee, feriesNouveaux, nomDuFerie, phraseDesFeries } from "../src/lib/jours-feries";
import { creneauxDuChantier, jourRetenable } from "../src/lib/disponibilites";
import { CHARTES, contraste } from "../src/lib/chartes";
import {
  AUCUNE_COULEUR_CHOISIE,
  RACCOURCIS_DU_PLANNING,
  VARIABLE_TEXTE_DU_FERIE,
  couleurDApparence,
  variableDeLEtat,
  variablesDesEtats,
} from "../src/lib/couleurs-planning";

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

console.log("=== Les jours fériés ===");

essai("Pâques tombe juste, bornes du calendrier comprises", () => {
  assert.equal(dimancheDePaques(2026), "2026-04-05");
  assert.equal(dimancheDePaques(2027), "2027-03-28");
  assert.equal(dimancheDePaques(2024), "2024-03-31");
  assert.equal(dimancheDePaques(2025), "2025-04-20");
  assert.equal(dimancheDePaques(2038), "2038-04-25");
  assert.equal(dimancheDePaques(2285), "2285-03-22");
});

essai("onze fériés partout, treize en Alsace et en Moselle", () => {
  assert.equal(feriesDeLAnnee(2026).size, 11);
  assert.equal(feriesDeLAnnee(2026, true).size, 13);
});

essai("les fériés de 2026 et de 2027 qui suivent Pâques", () => {
  assert.equal(nomDuFerie("2026-04-06"), "Lundi de Pâques");
  assert.equal(nomDuFerie("2026-05-14"), "Ascension");
  assert.equal(nomDuFerie("2026-05-25"), "Lundi de Pentecôte");
  assert.equal(nomDuFerie("2027-05-06"), "Ascension");
  assert.equal(nomDuFerie("2027-05-17"), "Lundi de Pentecôte");
});

essai("le 11 novembre est l'Armistice, le 12 n'est rien", () => {
  assert.equal(nomDuFerie("2026-11-11"), "Armistice 1918");
  assert.equal(nomDuFerie("2026-11-12"), null);
});

essai("le Vendredi saint et le 26 décembre ne valent qu'en Alsace et en Moselle", () => {
  assert.equal(nomDuFerie("2026-04-03"), null);
  assert.equal(nomDuFerie("2026-04-03", true), "Vendredi saint");
  assert.equal(nomDuFerie("2026-12-26"), null);
  assert.equal(nomDuFerie("2026-12-26", true), "Saint-Étienne");
});

essai("l'Alsace et la Moselle se lisent au code postal, et seulement là", () => {
  assert.equal(estEnAlsaceMoselle("3 rue Serpenoise, 57000 Metz"), true);
  assert.equal(estEnAlsaceMoselle("10 place Kléber, 67000 Strasbourg"), true);
  assert.equal(estEnAlsaceMoselle("1 rue des Clefs, 68000 Colmar"), true);
  assert.equal(estEnAlsaceMoselle("10 rue des Artisans, 44000 Nantes"), false);
  // Sans code postal, la liste nationale : le côté sûr.
  assert.equal(estEnAlsaceMoselle("Derrière l'église"), false);
  assert.equal(estEnAlsaceMoselle(null), false);
});

essai("UN FÉRIÉ RESTE PROPOSABLE ET POSABLE : sa règle du 6 novembre 2026", () => {
  // *« Dans tous les cas, tous les jours fériés, on doit quand même pouvoir
  // mettre des chantiers dessus si jamais on veut travailler ce jour-là. »*
  // Le jour ne se refuse pas, et un chantier ne le saute pas.
  const novembre = { debut: "2026-11-01", fin: "2026-11-30" };
  assert.equal(jourRetenable("2026-11-11", 2, new Map(), 1, novembre), true, "l'Armistice est refusé");
  assert.equal(jourRetenable("2027-05-17", 2, new Map(), 1, { debut: "2027-05-01", fin: "2027-05-31" }), true, "le lundi de Pentecôte est refusé");
  assert.deepEqual(
    creneauxDuChantier({ jour: "2026-11-10", moment: "matin" }, 4).map((c) => c.jour),
    ["2026-11-10", "2026-11-10", "2026-11-11", "2026-11-11"],
    "un chantier de deux jours parti la veille saute le férié"
  );
});

essai("LA COULEUR DU FÉRIÉ SE RÈGLE, et son chiffre reste lisible sur les huit chartes", () => {
  // Rien de choisi : aucune variable, la case garde le bleu de l'apparence.
  for (const c of CHARTES) assert.equal(variablesDesEtats(AUCUNE_COULEUR_CHOISIE, c)[variableDeLEtat("ferie")], undefined, c.nom);
  // Chaque choix proposé, et un fond foncé : le chiffre tient 4,5 sur son fond.
  const choix = [...RACCOURCIS_DU_PLANNING.ferie.map(([t]) => t), "#22456d", "#1c1c1a"];
  for (const c of CHARTES) {
    for (const t of [couleurDApparence("ferie", c), ...choix]) {
      const v = variablesDesEtats({ ...AUCUNE_COULEUR_CHOISIE, ferie: t }, c);
      const fond = v[variableDeLEtat("ferie")];
      const texte = v[VARIABLE_TEXTE_DU_FERIE];
      assert.ok(fond && texte, `${c.nom}, ${t} : une variable manque`);
      assert.ok(contraste(fond, texte) >= 4.5, `${c.nom}, ${t} : le chiffre ne se lit pas (${contraste(fond, texte).toFixed(2)})`);
    }
  }
});

essai("PRÉVENIR SANS BLOQUER : ce qu'un geste vient de poser sur un férié se dit", () => {
  // Sa règle du 6 novembre 2026 : « ça doit nous prévenir mais jamais nous bloquer ».
  const poseLe10 = ["2026-11-10", "2026-11-10"];
  const pose10et11 = ["2026-11-10", "2026-11-10", "2026-11-11", "2026-11-11"];
  assert.equal(phraseDesFeries(feriesNouveaux([], pose10et11)), "Le 11 novembre est férié (Armistice 1918).");
  // Un férié déjà couvert avant le geste ne se redit pas à chaque retouche.
  assert.equal(phraseDesFeries(feriesNouveaux(pose10et11, [...pose10et11, "2026-11-12"])), null);
  assert.equal(phraseDesFeries(feriesNouveaux([], poseLe10)), null);
  assert.equal(phraseDesFeries(feriesNouveaux([], ["2026-05-01"])), "Le 1ᵉʳ mai est férié (Fête du Travail).");
  assert.equal(phraseDesFeries(feriesNouveaux([], ["2026-12-25", "2026-12-28", "2027-01-01"])), "Le 25 décembre et le 1ᵉʳ janvier sont fériés.");
});

if (echecs) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Les jours fériés tombent juste.");
