// « Corrige-moi ça » : le rappel de la racine part-il, et se tait-il à propos ?
//
// **Ce contrôle garde un garde-fou.** Le 7 septembre 2026, le patron pose sa
// règle d'or — pas de pansement, on corrige à la racine — et demande qu'elle
// soit « incontournable, non franchissable ». Elle vit en prose
// (`CLAUDE.md` §4 quater), dans la batterie (`test-pas-de-pansement.ts`) et
// dans ce déclencheur, qui la remet sous les yeux au moment où elle sert.
//
// Deux façons de la perdre, et ce sont les deux bouts que ces cas tiennent :
//
//  - **Il se tait quand il faut parler.** Une tournure qu'il emploie vraiment
//    n'est plus reconnue, et la règle redevient une prose oubliée au bout de
//    trois heures — exactement l'état qui a coûté deux redites sur les flèches.
//  - **Il parle quand il faut se taire.** Un rappel qui se déclenche sur des
//    demandes ordinaires s'apprend à être ignoré, et le garde-fou est perdu
//    pour de bon — silencieusement, celui-là.
//
// Le câblage est vérifié aussi : un script juste que rien n'appelle ne protège
// personne, et son absence ne se voit nulle part.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { demandeUneCorrection, RAPPEL } from "./rappel-racine.mjs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le rappel « on corrige à la racine » ===");

cas("les phrases QU'IL A RÉELLEMENT ÉCRITES déclenchent le rappel", () => {
  // Relevées dans ses messages des 11 août, 12 août et 7 septembre 2026. Une
  // tournure inventée prouverait que le contrôle passe, pas qu'il sera entendu.
  const siennes = [
    "Ça marche pas j'arrive pas à me connecter corrige ça vite",
    "Ça ne marche pas, je vais me coucher, corrige tout seul et répare moi ça",
    "il y a un bug sur le planning",
    "répare moi ça stp",
  ];
  for (const p of siennes) {
    assert.ok(demandeUneCorrection(p), `raté : « ${p} »`);
  }
});

cas("une demande ordinaire ne le déclenche pas", () => {
  // Toutes tirées de vraies demandes : maquettes, questions, livraison. Si
  // l'une d'elles se met à parler, le rappel devient du bruit.
  const ordinaires = [
    "fais moi une maquette de la page de connexion",
    "je veux un lien cliquable",
    "ajoute le capital social sur le devis",
    "où en est la batterie ?",
    "tu peux me mettre ça sur main",
  ];
  for (const p of ordinaires) {
    assert.ok(!demandeUneCorrection(p), `parle à tort : « ${p} »`);
  }
});

cas("le rappel dit ce qu'il faut faire, pas seulement ce qui est interdit", () => {
  // Un rappel qui n'énoncerait qu'une interdiction laisse le lecteur sans
  // geste : c'est ainsi qu'on obtient un contournement plus discret.
  for (const attendu of ["racine", "Retirer la couche", "TODO.md", "§4 quater"]) {
    assert.ok(RAPPEL.includes(attendu), `le rappel ne porte pas « ${attendu} »`);
  }
});

cas("il est BRANCHÉ sur chaque message", () => {
  const reglages = readFileSync(path.join(__dirname, "..", ".claude", "settings.json"), "utf8");
  assert.ok(
    reglages.includes("rappel-racine.mjs"),
    "`.claude/settings.json` ne l'appelle pas : le script serait juste, et muet"
  );
  const config = JSON.parse(reglages);
  const surMessage = JSON.stringify(config.hooks?.UserPromptSubmit ?? []);
  assert.ok(
    surMessage.includes("rappel-racine.mjs"),
    "branché ailleurs que sur UserPromptSubmit : il ne verrait jamais ses demandes"
  );
});

cas("la règle qu'il rappelle existe bien dans CLAUDE.md", () => {
  // Un rappel qui renvoie à un paragraphe disparu envoie chercher dans le vide.
  const regles = readFileSync(path.join(__dirname, "..", "CLAUDE.md"), "utf8");
  assert.ok(regles.includes("## 4 quater."), "CLAUDE.md n'a plus de §4 quater");
  assert.ok(
    regles.toLowerCase().includes("pansement"),
    "CLAUDE.md ne parle plus de pansement : la règle a été retirée sous le rappel"
  );
});

console.log(echecs === 0 ? "\n✅ Le rappel de la racine tient." : `\n❌ ${echecs} cas en échec.`);
process.exit(echecs === 0 ? 0 : 1);
