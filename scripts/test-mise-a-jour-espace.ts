import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **Le défaut le plus coûteux de tous : le patron éprouvait du code d'hier.**
//
// Le 4 août 2026, il a signalé deux correctifs qui « ne marchaient toujours
// pas » — la bande déroulante des durées « disparue », le numéro du client
// « toujours pas rempli ». Les deux étaient corrigés, éprouvés et fusionnés la
// veille. Son espace de travail, lui, gardait le code du jour de sa création :
// un espace ne récupère jamais rien tout seul. Rien à l'écran ne le lui disait,
// et trois échanges ont été perdus à chercher un défaut déjà réparé.
//
// `.devcontainer/mettre-a-jour.sh` répare cela. Ce contrôle existe parce qu'un
// script de démarrage n'est jamais relu et jamais vu échouer : il le confronte
// donc, pour de bon, aux quatre états qu'il prétend distinguer — à jour, en
// retard, sale, divergent. Chacun est monté ici en vrais dépôts git.
//
// La prudence éprouvée compte autant que la mise à jour elle-même : **écraser
// le travail du patron pour lui livrer un correctif serait pire que le défaut**.

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "mettre-a-jour.sh");

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

function lancer(dossier: string): string {
  return execFileSync("bash", [SCRIPT, dossier], { encoding: "utf8" }).trim();
}

/** Un « distant » et un espace de travail qui le suit, comme chez le patron. */
function monterEspace(): { distant: string; espace: string; racine: string } {
  const racine = mkdtempSync(path.join(tmpdir(), "atlas-espace-"));
  const source = path.join(racine, "source");
  const distant = path.join(racine, "distant.git");

  execFileSync("git", ["init", "--quiet", "-b", "principale", source]);
  writeFileSync(path.join(source, "fichier.txt"), "version 1\n");
  git(source, "add", ".");
  git(source, "commit", "--quiet", "-m", "version 1");
  execFileSync("git", ["clone", "--quiet", "--bare", source, distant]);
  git(source, "remote", "add", "origin", distant);

  const espace = path.join(racine, "espace");
  execFileSync("git", ["clone", "--quiet", distant, espace]);
  return { distant, espace, racine };
}

/** Publie un nouveau commit sur le distant — la livraison de la veille. */
function livrer(racine: string, contenu: string) {
  const source = path.join(racine, "source");
  writeFileSync(path.join(source, "fichier.txt"), contenu);
  git(source, "commit", "--quiet", "-am", "livraison");
  git(source, "push", "--quiet", "origin", "principale");
}

const aNettoyer: string[] = [];

console.log("=== L'espace de travail se met à jour tout seul ===");

cas("un espace déjà à jour le dit, et ne touche à rien", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  const avant = git(espace, "rev-parse", "HEAD").trim();
  assert.equal(lancer(espace), "à jour");
  assert.equal(git(espace, "rev-parse", "HEAD").trim(), avant);
});

cas("UN ESPACE EN RETARD RATTRAPE — le défaut du 4 août", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  const avant = git(espace, "rev-parse", "HEAD").trim();

  livrer(racine, "version 2\n");

  assert.equal(lancer(espace), "faite", "L'espace n'a pas récupéré le code livré : le patron réessaie la veille.");
  assert.notEqual(
    git(espace, "rev-parse", "HEAD").trim(),
    avant,
    "Le script a dit « faite » sans que rien ne bouge — pire qu'un aveu d'échec."
  );
});

console.log("=== Ce à quoi il ne touche jamais ===");

cas("du travail non enregistré arrête tout, et le dit", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  livrer(racine, "version 2\n");

  // Le patron a modifié quelque chose sans l'enregistrer.
  writeFileSync(path.join(espace, "fichier.txt"), "ce que le patron était en train d'écrire\n");

  const issue = lancer(espace);
  assert.ok(issue.startsWith("impossible"), `Attendu un refus, reçu « ${issue} ».`);
  assert.equal(
    execFileSync("cat", [path.join(espace, "fichier.txt")], { encoding: "utf8" }),
    "ce que le patron était en train d'écrire\n",
    "Le travail non enregistré du patron a été écrasé par la mise à jour."
  );
});

cas("un historique divergent est refusé, jamais forcé", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  livrer(racine, "version 2\n");

  // Un commit local qui n'est pas sur le distant : avancer « en ligne droite »
  // est impossible, et forcer effacerait ce commit.
  writeFileSync(path.join(espace, "local.txt"), "travail fait sur place\n");
  git(espace, "add", ".");
  git(espace, "commit", "--quiet", "-m", "travail local");
  const local = git(espace, "rev-parse", "HEAD").trim();

  const issue = lancer(espace);
  assert.ok(issue.startsWith("impossible"), `Attendu un refus, reçu « ${issue} ».`);
  assert.equal(git(espace, "rev-parse", "HEAD").trim(), local, "Un commit local a été effacé par la mise à jour.");
});

cas("un distant injoignable ne fait pas planter le démarrage", () => {
  const { espace, racine } = monterEspace();
  aNettoyer.push(racine);
  git(espace, "remote", "set-url", "origin", path.join(racine, "nulle-part.git"));

  // L'issue importe moins que le fait de sortir proprement : ce script est joué
  // à chaque allumage, et une erreur non rattrapée priverait le patron de son
  // application pour une panne de réseau.
  const issue = lancer(espace);
  assert.ok(issue.startsWith("impossible"), `Attendu un refus explicite, reçu « ${issue} ».`);
});

cas("un dossier qui n'est pas un dépôt ne fait pas planter non plus", () => {
  const racine = mkdtempSync(path.join(tmpdir(), "atlas-espace-"));
  aNettoyer.push(racine);
  const issue = lancer(racine);
  assert.ok(issue.startsWith("impossible"), `Attendu un refus explicite, reçu « ${issue} ».`);
});

for (const d of aNettoyer) rmSync(d, { recursive: true, force: true });

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles de la mise à jour de l'espace sont passés.");
