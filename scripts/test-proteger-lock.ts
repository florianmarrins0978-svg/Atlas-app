import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **L'espace du patron s'était bloqué lui-même, et il est resté bloqué.**
//
// 12 septembre 2026 : son espace tournait, servait, répondait — avec le code de
// 3 h 38 alors que `main` était trois versions plus loin. Un `npm install` de
// repli avait réécrit `package-lock.json` ; `mettre-a-jour.sh` s'abstient
// devant un arbre sale ; et comme l'installation ne tourne qu'après une mise à
// jour réussie, plus rien ne pouvait remettre le fichier en état. Le blocage se
// nourrissait de lui-même, en silence, pour toujours.
//
// Ce contrôle existe parce qu'un script de démarrage n'est jamais relu et
// jamais vu échouer. Il confronte `.devcontainer/proteger-lock.sh` aux états
// qu'il prétend distinguer, et surtout il vérifie **le geste qui compte** : que
// la mise à jour, ensuite, repasse (`CLAUDE.md` §5 quater — éprouver le chemin
// du patron, pas la moitié qu'on vient d'écrire).
//
// La prudence compte autant que la réparation : un `package-lock.json` modifié
// AVANT l'installation peut être le travail de quelqu'un, et l'effacer pour
// livrer une mise à jour serait pire que le défaut.

const PROTEGER = path.join(__dirname, "..", ".devcontainer", "proteger-lock.sh");
const METTRE_A_JOUR = path.join(__dirname, "..", ".devcontainer", "mettre-a-jour.sh");

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

function git(dossier: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: dossier,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Essai",
      GIT_AUTHOR_EMAIL: "essai@local",
      GIT_COMMITTER_NAME: "Essai",
      GIT_COMMITTER_EMAIL: "essai@local",
    },
  });
}

function proteger(dossier: string, ...args: string[]): string {
  return execFileSync("bash", [PROTEGER, ...args], { encoding: "utf8", cwd: dossier }).trim();
}

function mettreAJour(dossier: string): string {
  return execFileSync("bash", [METTRE_A_JOUR, dossier], { encoding: "utf8" }).trim();
}

const LOCK_ENREGISTRE = '{ "name": "atlas", "lockfileVersion": 3 }\n';
/** Ce que `npm install` laisse derrière lui : le même fichier, réécrit. */
const LOCK_REECRIT_PAR_NPM = '{ "name": "atlas", "lockfileVersion": 3, "packages": {} }\n';

/** Un « distant » et un espace qui le suit, comme chez le patron. */
function monterEspace(): { espace: string; racine: string } {
  const racine = mkdtempSync(path.join(tmpdir(), "atlas-lock-"));
  const source = path.join(racine, "source");
  const distant = path.join(racine, "distant.git");

  execFileSync("git", ["init", "--quiet", "-b", "principale", source]);
  writeFileSync(path.join(source, "package-lock.json"), LOCK_ENREGISTRE);
  writeFileSync(path.join(source, "fichier.txt"), "version 1\n");
  git(source, "add", ".");
  git(source, "commit", "--quiet", "-m", "version 1");
  execFileSync("git", ["clone", "--quiet", "--bare", source, distant]);
  git(source, "remote", "add", "origin", distant);

  const espace = path.join(racine, "espace");
  execFileSync("git", ["clone", "--quiet", distant, espace]);
  return { espace, racine };
}

/** La livraison de la veille, celle qu'il n'a jamais vue arriver. */
function livrer(racine: string) {
  const source = path.join(racine, "source");
  writeFileSync(path.join(source, "fichier.txt"), "version 2\n");
  git(source, "commit", "--quiet", "-am", "livraison");
  git(source, "push", "--quiet", "origin", "principale");
}

/** Ce que fait le repli `npm install` de `demarrer.sh`. */
function npmReecritLeLock(espace: string) {
  writeFileSync(path.join(espace, "package-lock.json"), LOCK_REECRIT_PAR_NPM);
}

const aNettoyer: string[] = [];

console.log("=== L'espace ne se bloque plus lui-même sur package-lock.json ===");

cas("un lock intact est dit propre, un lock réécrit est dit sale", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  assert.equal(proteger(espace, "etat", espace), "propre");
  npmReecritLeLock(espace);
  assert.equal(proteger(espace, "etat", espace), "sale");
});

cas("ce que l'installation a sali est remis en état, à l'identique", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  const avant = proteger(espace, "etat", espace);
  npmReecritLeLock(espace);
  assert.equal(proteger(espace, "remettre", espace, avant), "remis");
  assert.equal(readFileSync(path.join(espace, "package-lock.json"), "utf8"), LOCK_ENREGISTRE);
  assert.equal(git(espace, "status", "--porcelain").trim(), "");
});

cas("un lock DÉJÀ modifié avant l'installation n'est pas touché", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  // Le travail de quelqu'un, présent avant qu'on installe quoi que ce soit.
  writeFileSync(path.join(espace, "package-lock.json"), '{ "à moi": true }\n');
  const avant = proteger(espace, "etat", espace);
  assert.equal(avant, "sale");
  npmReecritLeLock(espace);
  assert.equal(proteger(espace, "remettre", espace, avant), "laissé : déjà modifié avant l'installation");
  assert.equal(readFileSync(path.join(espace, "package-lock.json"), "utf8"), LOCK_REECRIT_PAR_NPM);
});

cas("sans état d'avant, on ne touche à rien", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  npmReecritLeLock(espace);
  assert.equal(proteger(espace, "remettre", espace), "laissé : déjà modifié avant l'installation");
  assert.equal(readFileSync(path.join(espace, "package-lock.json"), "utf8"), LOCK_REECRIT_PAR_NPM);
});

cas("une installation qui n'a rien réécrit ne déclenche rien", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  const avant = proteger(espace, "etat", espace);
  assert.equal(proteger(espace, "remettre", espace, avant), "rien à faire");
});

cas("hors d'un dépôt git, il se tait au lieu de casser le démarrage", () => {
  const ailleurs = mkdtempSync(path.join(tmpdir(), "atlas-sans-git-"));
  aNettoyer.push(ailleurs);
  assert.equal(proteger(ailleurs, "etat", ailleurs), "sans avis : pas un dépôt git");
  assert.equal(proteger(ailleurs, "remettre", ailleurs, "propre"), "sans avis : pas un dépôt git");
});

cas("un geste inconnu ne casse rien non plus", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  assert.equal(proteger(espace, "ranger", espace), "sans avis : geste inconnu");
});

// **Le contrôle qui compte : le chemin du patron, de bout en bout.** Les six
// précédents éprouvent la pièce ; celui-ci éprouve la panne — un espace en
// retard, sali par sa propre installation, qui recommence à recevoir le code.
cas("la panne du 12 septembre : la mise à jour repasse après la remise en état", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  livrer(racine);

  const avant = proteger(espace, "etat", espace);
  npmReecritLeLock(espace);

  // L'état où son espace est resté toute la journée.
  assert.equal(mettreAJour(espace), "impossible : des modifications non enregistrées sont présentes");
  assert.equal(readFileSync(path.join(espace, "fichier.txt"), "utf8"), "version 1\n");

  assert.equal(proteger(espace, "remettre", espace, avant), "remis");

  assert.equal(mettreAJour(espace), "faite");
  assert.equal(readFileSync(path.join(espace, "fichier.txt"), "utf8"), "version 2\n");
});

for (const dossier of aNettoyer) rmSync(dossier, { recursive: true, force: true });

if (echecs > 0) {
  console.error(`\n❌ ${echecs} cas en échec`);
  process.exit(1);
}
console.log("\n✅ tous les cas passent");
