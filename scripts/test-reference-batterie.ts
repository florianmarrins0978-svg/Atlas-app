import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  cheminDeLaReference,
  commitCourant,
  ecrireReference,
  estAncetre,
  estSurMain,
  lireReference,
} from "./_reference-batterie.mjs";

/**
 * L'ÉTAT DE RÉFÉRENCE NE S'ENREGISTRE QUE SUR `main`, ET IL SE PARTAGE ENTRE
 * LES DOSSIERS DE SESSION.
 *
 * Tout se joue dans un dépôt jetable avec son propre `origin` : ce qui compte
 * ici, c'est la condition d'écriture — un lot ne doit jamais pouvoir devenir
 * sa propre référence — et l'endroit où elle vit, le `.git` commun.
 */

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

const bac = mkdtempSync(path.join(tmpdir(), "atlas-reference-"));
const origine = path.join(bac, "origine.git");
const depot = path.join(bac, "depot");
const autre = path.join(bac, "autre-dossier");

function git(dossier: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dossier, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

try {
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origine]);
  execFileSync("git", ["init", "-q", "-b", "main", depot]);
  git(depot, "config", "user.email", "suite@atlas.local");
  git(depot, "config", "user.name", "Suite");
  git(depot, "remote", "add", "origin", origine);
  writeFileSync(path.join(depot, "a.txt"), "un\n");
  git(depot, "add", "a.txt");
  git(depot, "commit", "-q", "-m", "premier");
  git(depot, "push", "-q", "origin", "main");
  const commitDeMain = commitCourant(depot)!;

  console.log("=== Quand la batterie devient la référence ===");

  cas("sur un arbre propre qui EST origin/main : oui", () => {
    assert.equal(estSurMain(depot), true);
  });

  cas("avec un fichier en attente : non — ce n'est plus main", () => {
    writeFileSync(path.join(depot, "b.txt"), "deux\n");
    assert.equal(estSurMain(depot), false);
    rmSync(path.join(depot, "b.txt"));
  });

  cas("sur un commit qui n'est pas encore sur origin/main : non — un lot ne s'absout pas lui-même", () => {
    writeFileSync(path.join(depot, "a.txt"), "un lot\n");
    git(depot, "commit", "-q", "-am", "le lot");
    assert.equal(estSurMain(depot), false);
  });

  console.log("\n=== Où elle vit, et ce qu'elle dit ===");

  cas("écrite dans le .git COMMUN, jamais dans l'arbre de travail", () => {
    const chemin = cheminDeLaReference(depot)!;
    assert.ok(chemin.startsWith(path.join(depot, ".git")), `la référence vit ailleurs : ${chemin}`);
    assert.ok(ecrireReference(depot, { quand: 1_000, commit: commitDeMain, rouges: ["test-b.ts", "test-a.ts"], niveau: 3 }));
    assert.deepEqual(lireReference(depot), { quand: 1_000, commit: commitDeMain, rouges: ["test-a.ts", "test-b.ts"], niveau: 3 });
  });

  cas("un dossier de session (git worktree) lit la MÊME référence, sans copie", () => {
    git(depot, "worktree", "add", "-q", "--detach", autre);
    assert.equal(lireReference(autre)?.commit, commitDeMain);
    assert.equal(cheminDeLaReference(autre), cheminDeLaReference(depot));
  });

  cas("le commit de main est un ancêtre du lot ; l'inverse est faux", () => {
    assert.equal(estAncetre(depot, commitDeMain), true);
    assert.equal(estAncetre(depot, commitCourant(depot)), true, "un commit est son propre ancêtre");
    // Une référence prise sur un commit que ce lot ne contient pas — une
    // autre branche — ne dit rien de ce lot.
    git(autre, "commit", "-q", "--allow-empty", "-m", "ailleurs");
    assert.equal(estAncetre(depot, commitCourant(autre)!), false);
    assert.equal(estAncetre(depot, ""), false);
  });

  cas("une référence illisible ou d'un autre niveau vaut une absence", () => {
    writeFileSync(cheminDeLaReference(depot)!, "{ pas du json");
    assert.equal(lireReference(depot), null);
    writeFileSync(cheminDeLaReference(depot)!, JSON.stringify({ quand: 1, commit: "x", rouges: ["a.ts"], niveau: 2 }));
    assert.equal(lireReference(depot), null, "un niveau 2 n'est pas un état de référence");
    writeFileSync(cheminDeLaReference(depot)!, JSON.stringify({ quand: 1, commit: "x", rouges: [3], niveau: 3 }));
    assert.equal(lireReference(depot), null, "une liste qui n'est pas de noms ne se lit pas");
  });

  cas("hors d'un dépôt git : rien à lire, rien à écrire, et rien ne plante", () => {
    const nulle = path.join(bac, "pas-un-depot");
    assert.equal(existsSync(nulle), false);
    assert.equal(lireReference(nulle), null);
    assert.equal(estSurMain(nulle), false);
    assert.equal(ecrireReference(nulle, { quand: 1, commit: "x", rouges: [], niveau: 3 }), false);
  });
} finally {
  try {
    git(depot, "worktree", "remove", "--force", autre);
  } catch {
    // Le worktree n'a peut-être jamais été créé si un cas a échoué avant.
  }
  rmSync(bac, { recursive: true, force: true });
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} L'état de référence — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
