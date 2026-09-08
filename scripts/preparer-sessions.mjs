import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import path from "node:path";

/**
 * UN DOSSIER DE TRAVAIL PAR SESSION.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 8 septembre 2026 :** *« crée un dossier de travail par
 * session »*, pour pouvoir faire tourner ses cinq sessions en même temps.
 *
 * **Et ce n'est pas un confort : c'est la condition.** Les ateliers
 * (`scripts/_atelier.ts`) donnent à chaque session son port, sa base et son
 * coin de Redis — nécessaire, mais insuffisant. Mesuré le 8 septembre, journal
 * du banc à l'appui :
 *
 *     ⨯ Another next dev server is already running.
 *       Dir: C:\Users\Flori\Desktop\atlas-real-app\atlas-app
 *
 * **Next.js 16 refuse un second serveur de développement dans le même
 * DOSSIER**, quel que soit le port. Tant que les sessions partagent l'arbre,
 * une seule peut jouer ses suites navigateur — les autres attendent dix
 * minutes pour rien.
 *
 * S'y ajoute ce que le dépôt paie depuis des semaines : ses modifications de
 * `CHANGELOG.md` effacées le 4 septembre, mon module laissé trois jours dans un
 * arbre partagé en cassant `tsc` pour tout le monde. Un dossier par session
 * règle les deux d'un coup.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Ce que ça NE change pas.** `main` reste le seul bien commun : chaque
 * session fusionne et pousse comme avant (`CLAUDE.md` §6). Un worktree n'est
 * pas un clone — c'est le même dépôt, le même historique, les mêmes
 * remontées ; seul le répertoire de travail diffère.
 *
 * **Sa condition, du 5 septembre :** *« faut pas que j'aie de manip à faire en
 * plus »*. Ce script est le seul geste, et il se fait UNE fois : il crée les
 * dossiers et affiche la liste. Ensuite il ouvre une session dans chacun, et
 * tout le reste — port, base, Redis — se choisit tout seul.
 *
 *     npm run sessions:preparer        # cinq dossiers, le défaut
 *     npm run sessions:preparer 3      # trois
 *     npm run sessions:preparer --liste
 */

const RACINE = process.cwd();
const NOM = path.basename(RACINE);
const PARENT = path.dirname(RACINE);

function git(...args) {
  const r = spawnSync("git", args, { cwd: RACINE, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} a échoué :\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return (r.stdout ?? "").trim();
}

/** Les dossiers de travail que git connaît déjà. */
function worktreesExistants() {
  const sortie = git("worktree", "list", "--porcelain");
  return sortie
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length).trim());
}

function lister() {
  const liste = worktreesExistants();
  console.log("Dossiers de travail :\n");
  for (const [i, dossier] of liste.entries()) {
    const marque = path.resolve(dossier) === path.resolve(RACINE) ? "  ← celui-ci" : "";
    console.log(`  ${i + 1}. ${dossier}${marque}`);
  }
  console.log("");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--liste")) {
    lister();
    return;
  }

  const demande = Number(args.find((a) => /^\d+$/.test(a)) ?? 5);
  if (!Number.isInteger(demande) || demande < 1 || demande > 8) {
    console.error("❌ On prépare de 1 à 8 sessions. Au-delà, la machine ne suit pas.");
    process.exit(1);
  }

  // **Le dossier courant compte pour la première session.** On ne le déplace
  // pas et on ne le touche pas : c'est celui qu'il a déjà ouvert.
  const aCreer = demande - 1;
  if (aCreer === 0) {
    console.log("Rien à préparer : ce dossier suffit pour une seule session.");
    return;
  }

  console.log(`Préparation de ${demande} dossiers de travail (celui-ci compris).\n`);
  const branche = git("rev-parse", "--abbrev-ref", "HEAD");

  for (let n = 2; n <= demande; n++) {
    const dossier = path.join(PARENT, `${NOM}-s${n}`);
    if (existsSync(dossier)) {
      console.log(`  ${n}. ${dossier}  (déjà là)`);
      continue;
    }
    // **Une branche par dossier, et c'est git qui l'impose** : deux worktrees
    // ne peuvent pas avoir la même branche sortie. Elles partent toutes de la
    // branche courante, et se fusionnent sur `main` comme d'habitude.
    const nomBranche = `session-${n}`;
    const branchesConnues = git("branch", "--list", nomBranche);
    git("worktree", "add", ...(branchesConnues ? [] : ["-b", nomBranche]), dossier, ...(branchesConnues ? [nomBranche] : [branche]));

    // **`.env` suit le dossier — sinon rien ne démarre, et le message accuse
    // la base.** Il n'est pas versionné (il porte ses mots de passe), donc un
    // worktree neuf n'en a aucun : la première commande y échoue sur
    // « Variable d'environnement obligatoire manquante : DATABASE_URL », ce qui
    // envoie chercher au mauvais endroit. Sa condition du 5 septembre — aucune
    // manip en plus — vaut aussi pour ce fichier-là.
    for (const nomFichier of [".env", ".env.local"]) {
      const source = path.join(RACINE, nomFichier);
      if (existsSync(source)) copyFileSync(source, path.join(dossier, nomFichier));
    }
    console.log(`  ${n}. ${dossier}  (branche ${nomBranche})`);
  }

  console.log(`
Ce qu'il reste à faire, une seule fois :

  · ouvrir une session dans CHACUN de ces dossiers ;
  · y lancer « npm install » la première fois — les dépendances ne se
    partagent pas entre dossiers de travail.

Ensuite, plus rien : chaque session prend son port, sa base et son coin de
Redis toute seule, et « npm run verifier:avant-livraison » ne change pas.
`);
}

try {
  main();
} catch (erreur) {
  console.error(`❌ ${erreur.message}`);
  process.exit(1);
}
