import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **Le port privé — la troisième fois que la même méprise coûte une soirée.**
//
// Le 10 août 2026, le diagnostic du patron a rapporté ceci : l'application
// saine de l'intérieur (200, `text/html`), et à l'adresse publique une page
// `/pf-signin?...` — **GitHub qui répond à la place d'Atlas**. Le port était
// privé ; depuis son téléphone, non connecté à GitHub, il n'y avait rien.
//
// Or `devcontainer.json` déclare `visibility: "public"` depuis le 6 août. La
// déclaration n'était pas fausse : elle était **inerte**, parce que ce fichier
// n'est appliqué qu'à la CRÉATION de l'espace de travail, et que le sien est
// plus ancien. C'est exactement le piège d'`ATLAS_BANC_ESSAI` dans
// `docker-compose.yml` (voir `src/profil-banc.ts`), pour la troisième fois.
//
// D'où `ouvrir-port.sh`, rejoué à chaque allumage. Cette suite l'éprouve avec un
// FAUX `gh` posé devant le vrai dans le PATH : l'agent n'a pas d'espace GitHub,
// et un contrôle qu'on ne peut pas jouer ne prouve rien. Ce que le faux `gh`
// permet de tenir, et qui compte :
//
//   1. la commande envoyée est bien celle qui publie le port, avec le nom de
//      l'espace — une commande approchante ne ferait rien, en silence ;
//   2. `gh` absent ou en échec ne fait JAMAIS tomber le démarrage, et se dit —
//      un banc pénible vaut mieux qu'un banc mort, mais un banc pénible qui se
//      tait renvoie chercher ailleurs pendant une soirée ;
//   3. hors d'un espace GitHub, on n'invente rien.

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "ouvrir-port.sh");
const DEMARRER = path.join(__dirname, "..", ".devcontainer", "demarrer.sh");

let echecs = 0;
const dossier = mkdtempSync(path.join(tmpdir(), "atlas-port-"));
const TRACE = path.join(dossier, "appel.txt");

/** Pose un faux `gh` devant le vrai, et rend le dossier à placer en tête du PATH. */
function fauxGh(codeSortie: number): string {
  const bac = path.join(dossier, `gh-${codeSortie}`);
  execFileSync("mkdir", ["-p", bac]);
  const faux = path.join(bac, "gh");
  writeFileSync(faux, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${TRACE}"\nexit ${codeSortie}\n`);
  chmodSync(faux, 0o755);
  return bac;
}

function jouer(env: Record<string, string>, chemin?: string): string {
  return execFileSync("bash", [SCRIPT, "3000"], {
    env: {
      NODE_ENV: "test",
      PATH: chemin ? `${chemin}:${process.env.PATH ?? "/usr/bin:/bin"}` : "/usr/bin:/bin",
      ...env,
    },
    encoding: "utf8",
  }).trim();
}

function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le port du banc, ouvert à chaque allumage ===\n");

cas("hors d'un espace GitHub, on n'invente rien", () => {
  assert.equal(jouer({}), "hors-codespace");
});

cas("dans un espace, le port est publié — et la commande est la bonne", () => {
  if (existsSync(TRACE)) rmSync(TRACE);
  const sortie = jouer({ CODESPACE_NAME: "reimagined-space-yodel" }, fauxGh(0));
  assert.equal(sortie, "ouvert", `attendu « ouvert », reçu « ${sortie} »`);
  const appel = readFileSync(TRACE, "utf8").trim();
  assert.equal(
    appel,
    "codespace ports visibility 3000:public -c reimagined-space-yodel",
    `la commande envoyée à gh n'est pas celle qui publie le port : « ${appel} »`
  );
});

cas("gh en échec : on le DIT, et le démarrage continue", () => {
  const sortie = jouer({ CODESPACE_NAME: "reimagined-space-yodel" }, fauxGh(1));
  assert.equal(sortie, "échec", `attendu « échec », reçu « ${sortie} »`);
});

cas("gh absent : on le dit aussi, sans tomber", () => {
  // PATH réduit à un dossier vide, pour que `gh` soit introuvable **quelle que
  // soit la machine** : se fier à son absence ici rendrait le contrôle vert
  // pour une mauvaise raison sur un poste où `gh` est installé.
  //
  // `bash` est donc appelé par son chemin absolu — le chercher dans un PATH
  // vide le rendrait introuvable lui aussi, et l'erreur accuserait le script.
  const vide = path.join(dossier, "vide");
  execFileSync("mkdir", ["-p", vide]);
  const bash = execFileSync("bash", ["-c", "command -v bash"], { encoding: "utf8" }).trim();
  const sortie = execFileSync(bash, [SCRIPT, "3000"], {
    env: { NODE_ENV: "test", PATH: vide, CODESPACE_NAME: "reimagined-space-yodel" },
    encoding: "utf8",
  }).trim();
  assert.equal(sortie, "sans-gh", `attendu « sans-gh », reçu « ${sortie} »`);
});

// **Le contrôle qui empêche ce correctif de redevenir inerte.** Un script juste
// que personne n'appelle ne répare rien — c'est précisément le défaut d'origine,
// une déclaration exacte et sans effet.
cas("le démarrage appelle réellement ce script, et dit ce qu'il en advient", () => {
  // **Les commentaires sont retirés avant de regarder.** Première version, ce
  // contrôle restait vert alors que l'appel avait été supprimé : le commentaire
  // qui le surplombe nomme `ouvrir-port.sh`, et cela suffisait. C'est le même
  // piège que le test de l'annonce d'adresse (`ARCHITECTURE.md` §50) — un
  // contrôle qui vise un texte au lieu d'un geste ne contrôle rien.
  const code = readFileSync(DEMARRER, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  assert.match(
    code,
    // Le chemin passe par `$(dirname "$0")` : la parenthèse fermante interne
    // interdit un `[^)]*`, qui rendait ce contrôle rouge sur du code juste.
    /PORT_PUBLIC="?\$\(\s*bash[^\n]{0,80}ouvrir-port\.sh/,
    "demarrer.sh n'APPELLE pas ouvrir-port.sh (un commentaire qui le nomme ne suffit pas)"
  );
  assert.match(
    code,
    /case\s+"\$PORT_PUBLIC"/,
    "demarrer.sh appelle ouvrir-port.sh sans rien dire de son verdict : un port privé resterait muet"
  );
  assert.match(
    code,
    /gh codespace ports visibility 3000:public/,
    "demarrer.sh ne donne pas au patron la commande de secours quand gh manque"
  );
});

rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} Port du banc — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
