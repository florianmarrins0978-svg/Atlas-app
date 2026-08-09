import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **Un correctif livré une fois ne doit pas demander deux redémarrages.**
//
// `demarrer.sh` récupère le code neuf à chaque allumage, puis continue de
// s'exécuter — dans sa version ANCIENNE, celle qui était sur le disque quand
// bash l'a ouvert. Tout ce que le lot du jour change au démarrage n'entre donc
// en vigueur qu'au démarrage SUIVANT. Le patron aurait redémarré, constaté
// qu'il ne se passe rien, et conclu — encore — que le correctif ne marche pas.
// C'est le défaut d'`ARCHITECTURE.md` §24 déplacé d'un cran : l'espace se met
// bien à jour, mais il ne se sert pas de ce qu'il vient de récupérer.
//
// D'où la relance : après une mise à jour effective, le script se rejoue dans
// sa version neuve, une fois et une seule.
//
// Cette suite monte de VRAIS dépôts git, comme `test-mise-a-jour-espace.ts` :
// un espace en retard d'un commit, et l'on regarde ce qui est réellement lu au
// second passage. Le garde-fou anti-boucle est éprouvé au même endroit — un
// script qui se relance sans fin laisserait un espace de travail inutilisable.

const RACINE = path.join(__dirname, "..");
const MISE_A_JOUR = path.join(RACINE, ".devcontainer", "mettre-a-jour.sh");

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const git = (dossier: string, ...args: string[]) =>
  execFileSync("git", ["-C", dossier, ...args], { encoding: "utf8" }).trim();

/**
 * Reproduit le motif de relance de `demarrer.sh`, réduit à ce qu'il éprouve.
 * Le script réel démarre un serveur : l'exécuter ici mettrait dix minutes et
 * n'apprendrait rien de plus. La divergence entre les deux est attrapée par le
 * dernier cas, qui relit le vrai fichier.
 */
const HARNAIS = `set -uo pipefail
CD="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CD" || exit 0
echo "passage:\${ATLAS_DEMARRAGE_RELANCE:-0}:$(cat marqueur.txt)"
MISE_A_JOUR="$(bash "$(dirname "$0")/mettre-a-jour.sh" "$CD")"
if [ "$MISE_A_JOUR" = "faite" ]; then
  if [ "\${ATLAS_DEMARRAGE_RELANCE:-}" != "1" ]; then
    export ATLAS_DEMARRAGE_RELANCE=1
    exec bash "$0" "$@"
  fi
fi
echo "demarrage:$(cat marqueur.txt)"
`;

function monterEspace(enRetard: boolean): { espace: string; nettoyer: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), "atlas-relance-"));
  const distant = path.join(base, "distant.git");
  const source = path.join(base, "source");
  const espace = path.join(base, "espace");

  execFileSync("git", ["init", "-q", "--bare", "-b", "main", distant]);
  execFileSync("git", ["clone", "-q", distant, source]);
  git(source, "config", "user.email", "essai@atlas.local");
  git(source, "config", "user.name", "Essai");

  mkdirSync(path.join(source, ".devcontainer"), { recursive: true });
  copyFileSync(MISE_A_JOUR, path.join(source, ".devcontainer", "mettre-a-jour.sh"));
  writeFileSync(path.join(source, ".devcontainer", "demarrer.sh"), HARNAIS);
  writeFileSync(path.join(source, "marqueur.txt"), "ancien\n");
  git(source, "add", "-A");
  git(source, "commit", "-qm", "version 1");
  git(source, "push", "-q", "origin", "main");

  execFileSync("git", ["clone", "-q", distant, espace]);

  if (enRetard) {
    writeFileSync(path.join(source, "marqueur.txt"), "NEUF\n");
    git(source, "commit", "-qam", "version 2");
    git(source, "push", "-q", "origin", "main");
  }

  return { espace, nettoyer: () => rmSync(base, { recursive: true, force: true }) };
}

function demarrer(espace: string): string[] {
  // Délai borné : une relance sans fin doit se traduire par un échec net, pas
  // par une suite qui tourne indéfiniment.
  return execFileSync("timeout", ["60", "bash", path.join(espace, ".devcontainer", "demarrer.sh")], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => l.startsWith("passage:") || l.startsWith("demarrage:"));
}

console.log("=== Un espace en retard se sert du code qu'il vient de récupérer ===");

cas("le second passage lit le code NEUF, et c'est lui qui démarre", () => {
  const { espace, nettoyer } = monterEspace(true);
  try {
    const lignes = demarrer(espace);
    assert.deepEqual(lignes, ["passage:0:ancien", "passage:1:NEUF", "demarrage:NEUF"]);
  } finally {
    nettoyer();
  }
});

cas("il ne se relance qu'une fois — jamais de boucle", () => {
  const { espace, nettoyer } = monterEspace(true);
  try {
    const passages = demarrer(espace).filter((l) => l.startsWith("passage:"));
    assert.equal(passages.length, 2, `Relancé ${passages.length} fois : ${passages.join(" / ")}`);
  } finally {
    nettoyer();
  }
});

cas("déjà à jour : un seul passage, aucune relance inutile", () => {
  const { espace, nettoyer } = monterEspace(false);
  try {
    const lignes = demarrer(espace);
    assert.deepEqual(lignes, ["passage:0:ancien", "demarrage:ancien"]);
  } finally {
    nettoyer();
  }
});

console.log("\n=== Ce que le vrai script fait DÉSORMAIS, et pourquoi ===");

// **Le mécanisme a changé le 9 août 2026 au soir, et le harnais ci-dessus
// documente celui d'avant.** `demarrer.sh` se rejouait dans sa version neuve
// par `exec bash "$0"`. C'est exactement là que le démarrage du patron mourait :
// le script est joué par `postStartCommand`, que l'environnement peut
// interrompre, et TOUT ce qui venait après — y compris le lancement du
// serveur — disparaissait avec lui. Son journal s'arrêtait sur
// « migrations : faites », et rien n'écoutait sur le port 3000.
//
// Le lancement est donc passé EN PREMIER, et l'`exec` a disparu. Ce qui compte
// est relu depuis le disque quand le veilleur est relancé : `veiller.sh`,
// `banc.mjs`, l'application. Seule la fin de `demarrer.sh` reste, pour un
// allumage, dans sa version d'avant — un bandeau, contre une application qui
// démarre.

cas("le serveur est lancé AVANT toute opération longue", () => {
  const lignes = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8")
    .split("\n")
    .map((texte, numero) => ({ numero, texte: texte.trim() }))
    .filter((l) => !l.texte.startsWith("#"));
  const ou = (motif: RegExp) => lignes.find((l) => motif.test(l.texte))?.numero ?? -1;

  const iLancement = ou(/^lancer_veilleur$/);
  const iMiseAJour = ou(/mettre-a-jour\.sh/);
  assert.ok(iLancement >= 0, "plus rien ne lance le veilleur : le banc ne démarrera pas seul");
  assert.ok(iMiseAJour >= 0, "la mise à jour a disparu du démarrage");
  assert.ok(
    iLancement < iMiseAJour,
    "le serveur est lancé APRÈS la mise à jour : une interruption pendant `npm ci` " +
      "laisse le patron sans application, exactement comme le 9 août au soir"
  );
});

cas("l'`exec` qui tuait le démarrage a bien disparu", () => {
  const lignes = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .filter((l) => /exec bash "\$0"/.test(l));
  assert.deepEqual(lignes, [], `la relance est revenue : ${lignes.join(" | ")}`);
});

cas("après une mise à jour, veilleur ET serveur sont remplacés", () => {
  // C'est ce qui remplace l'`exec` : sans cela, le code neuf arriverait sur le
  // disque pendant qu'un serveur d'hier continue de le servir.
  const source = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8");
  const apresMigration = source.slice(source.indexOf("appliquer-migrations.sh"));
  assert.match(apresMigration, /pkill -f "\[v\]eiller\.sh"/, "l'ancien veilleur survivrait à la mise à jour");
  assert.match(apresMigration, /atlas-veilleur\.pid/, "le verrou du veilleur empêcherait la relance");
  assert.match(apresMigration, /lancer_veilleur/, "rien ne relance le veilleur après la mise à jour");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Relance au démarrage — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
