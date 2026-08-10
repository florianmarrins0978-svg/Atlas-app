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

essai("l'adresse ne se dit pas APRÈS la construction", () => {
  // **Le défaut du 10 août 2026, au soir.** Depuis « servir d'abord, bâtir
  // ensuite », l'annonce était passée derrière `next build` : le patron avait
  // une application qui répondait sans savoir où l'ouvrir, pendant des minutes,
  // et le banc rougissait sur un serveur parfaitement vivant.
  //
  // On lit l'ORDRE dans le fichier : l'annonce doit être lancée avant qu'on
  // attende la construction. Un commentaire ne suffirait pas — c'est justement
  // une réorganisation qui l'a déplacée.
  const banc = readFileSync("scripts/banc.mjs", "utf8");
  // **L'APPEL, pas la définition.** Première version, ce contrôle cherchait
  // « annoncerDesQueCaRepond( » : il tombait sur la déclaration de la fonction,
  // qui vient toujours en tête de fichier. Retirer l'appel ne le faisait donc
  // pas rougir — un contrôle qui ne sait pas échouer ne prouve rien.
  const annonce = banc.indexOf("void annoncerDesQueCaRepond(");
  const build = banc.indexOf('await jouer("npx", ["next", "build"]');
  assert.notEqual(annonce, -1, "banc.mjs n'appelle plus l'annonce sans attendre la construction");
  assert.notEqual(build, -1, "banc.mjs ne construit plus : ce contrôle n'éprouve plus rien");
  assert.ok(
    annonce < build,
    "l'annonce de l'adresse vient après la construction : le patron attend des minutes devant une application qui répond déjà"
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

// **L'annonce ne doit RIEN affirmer qu'elle n'a vérifié.**
//
// Elle écrivait « Ouvrable depuis un téléphone, telle quelle » et « cette
// adresse est publique ». Le 10 août 2026, elle l'a écrit alors que le port
// était PRIVÉ : GitHub servait sa page de connexion, le téléphone du patron ne
// montrait rien, et le terminal lui affirmait le contraire. Il a cherché
// ailleurs pendant des heures. Un message qui affirme sans savoir coûte plus
// cher qu'un silence.
//
// Ce module ne PEUT pas savoir : il faudrait interroger l'adresse depuis le
// dehors, ce que fait `diagnostiquer-banc.mjs`. Il doit donc décrire la panne
// et sa sortie, jamais promettre.
essai("l'annonce ne promet pas une adresse joignable, et dit comment en sortir", () => {
  const avant = process.env.CODESPACE_NAME;
  process.env.CODESPACE_NAME = "atlas-essai";
  try {
    const texte = annoncePrete({ port: "3000" });
    for (const promesse of ["Ouvrable depuis un téléphone", "adresse est\n   publique"]) {
      assert.ok(
        !texte.includes(promesse),
        `l'annonce affirme « ${promesse} » sans l'avoir vérifié — c'est ce qui a envoyé chercher ailleurs`
      );
    }
    assert.match(
      texte,
      /onglet PORTS/,
      "l'annonce ne dit pas comment sortir d'un port privé, qui est la panne la plus fréquente ici"
    );
  } finally {
    if (avant === undefined) delete process.env.CODESPACE_NAME;
    else process.env.CODESPACE_NAME = avant;
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Annonce de l'adresse — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
