// L'annonce de l'adresse, et le script qui la cherche, disent-ils la même chose ?
//
// **Ce test existe à cause d'un défaut qui a rendu le banc rouge deux jours
// durant, en accusant le mauvais coupable.** `npm run banc` écrivait « Atlas
// répond » ; `.devcontainer/verifier.sh` cherchait « L'application répond ».
// Le message affiché était donc « ❌ l'adresse à ouvrir n'est annoncée nulle
// part » — alors qu'elle l'était, mot pour mot, deux lignes plus haut dans le
// même journal.
//
// Le contrôle ne lit donc pas une chaîne recopiée à la main : **il lit le
// fichier du conteneur** et vérifie que la phrase qu'il y cherche est bien
// celle que le module écrit. Recopier la phrase ici aurait reproduit la
// duplication qu'on vient de supprimer.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARQUEUR_PRET, annoncePrete, adressePubliquePossible } from "./annonce-adresse.mjs";

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

console.log("=== L'adresse annoncée, et le contrôle qui la cherche ===");

const verifieur = readFileSync(".devcontainer/verifier.sh", "utf8");

essai("le script du conteneur cherche exactement la phrase que le module écrit", () => {
  // La ligne du `grep`, telle qu'elle est écrite dans le fichier. On la vise
  // par ce qu'elle FAIT — chercher dans le journal de démarrage — et non par le
  // message d'échec : celui-ci a déjà été reformulé une fois, et le contrôle
  // s'est mis à chercher la mauvaise ligne.
  const ligne = verifieur
    .split("\n")
    .find((l) => l.trimStart().startsWith("grep -q") && l.includes("/tmp/essai.log"));
  assert.ok(ligne, "aucune ligne de verifier.sh ne cherche l'annonce dans /tmp/essai.log");
  assert.ok(
    ligne.includes(MARQUEUR_PRET),
    `verifier.sh cherche autre chose que « ${MARQUEUR_PRET} » :\n    ${ligne.trim()}`
  );
});

essai("l'annonce porte le marqueur, quel que soit le régime", () => {
  for (const precision of ["", "version bâtie, chaque écran est immédiat."]) {
    const texte = annoncePrete({ port: "3000", precision });
    assert.ok(
      texte.includes(MARQUEUR_PRET),
      `l'annonce ne porte pas le marqueur avec precision="${precision}"`
    );
  }
});

essai("l'annonce donne une adresse ouvrable et de quoi se connecter", () => {
  const texte = annoncePrete({ port: "3000" });
  assert.match(texte, /https?:\/\/\S+/, "aucune adresse dans l'annonce");
  assert.ok(texte.includes("demo@atlas.local"), "l'annonce ne dit pas avec quoi se connecter");
});

essai("hors espace de travail, on se rabat sur localhost plutôt que sur rien", () => {
  const nom = process.env.CODESPACE_NAME;
  delete process.env.CODESPACE_NAME;
  try {
    assert.equal(adressePubliquePossible("3000"), null);
    assert.ok(annoncePrete({ port: "3000" }).includes("http://localhost:3000"));
  } finally {
    if (nom !== undefined) process.env.CODESPACE_NAME = nom;
  }
});

essai("dans un espace de travail, l'adresse publique porte le port", () => {
  const avant = { nom: process.env.CODESPACE_NAME, domaine: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN };
  process.env.CODESPACE_NAME = "atlas-essai";
  delete process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  try {
    assert.equal(adressePubliquePossible("3000"), "https://atlas-essai-3000.app.github.dev");
  } finally {
    if (avant.nom === undefined) delete process.env.CODESPACE_NAME;
    else process.env.CODESPACE_NAME = avant.nom;
    if (avant.domaine !== undefined) process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN = avant.domaine;
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Annonce de l'adresse — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
