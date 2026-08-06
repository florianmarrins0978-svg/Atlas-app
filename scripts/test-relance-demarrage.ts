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

console.log("\n=== Le vrai script porte bien ce motif ===");

cas("demarrer.sh se relance après une mise à jour, sous garde-fou", () => {
  // Sans ce contrôle, le harnais ci-dessus pourrait rester vert pendant que le
  // vrai script perd sa relance — l'éprouvé et l'exécuté auraient divergé.
  const reel = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8");
  assert.match(reel, /ATLAS_DEMARRAGE_RELANCE/, "Le garde-fou anti-boucle a disparu de demarrer.sh.");
  assert.match(reel, /exec bash "\$0"/, "La relance a disparu de demarrer.sh.");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Relance au démarrage — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
