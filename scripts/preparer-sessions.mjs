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

const SOUS_WINDOWS = process.platform === "win32";
const RACINE = process.cwd();
const NOM = path.basename(RACINE);
const PARENT = path.dirname(RACINE);

function git(...args) {
  const r = spawnSync("git", args, { cwd: RACINE, encoding: "utf8" });
  if (r.status !== 0) {
    const dit = (r.stderr || r.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} a échoué :\n${dit}\n\n${remede(dit)}`);
  }
  return (r.stdout ?? "").trim();
}

/**
 * CE QU'IL FAUT FAIRE, pas seulement ce que git a dit.
 *
 * **Payé le 9 septembre 2026 :** *« je viens de le faire, il m'a dit erreur »*.
 * Le message rendait la phrase de git — « is already used by worktree », « is
 * already checked out » — et rien d'autre : un message qui NOMME le défaut sans
 * dire quoi en faire renvoie le patron poser la question, et c'est exactement
 * ce que ce script existe pour éviter (sa condition du 5 septembre : aucune
 * manip en plus).
 *
 * Les trois refus que git oppose ici sont connus, et chacun a un remède d'une
 * ligne. Ce qu'on ne reconnaît pas se dit tel quel — inventer un remède serait
 * pire que d'avouer qu'on n'en a pas.
 */
function remede(ditParGit) {
  const t = ditParGit.toLowerCase();
  if (t.includes("already used by worktree") || t.includes("missing but already registered")) {
    return (
      "Un dossier de travail a été supprimé à la main : git le compte encore.\n" +
      "   Remède :  git worktree prune   puis relancer cette commande."
    );
  }
  if (t.includes("already checked out")) {
    return (
      "Cette branche est déjà sortie dans un autre dossier — git n'en autorise\n" +
      "   qu'un par branche. Relancer : les dossiers suivants prendront les rangs\n" +
      "   libres, ou supprimer le dossier qui la tient (git worktree remove)."
    );
  }
  if (t.includes("permission denied") || t.includes("read-only")) {
    return `Le dossier parent n'accepte pas d'écriture : ${PARENT}`;
  }
  return "Cette erreur-là n'est pas connue du script : recopiez-la telle quelle.";
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

  // **On émonde d'abord, et c'est la panne la plus probable.** Un dossier de
  // travail supprimé depuis l'explorateur reste inscrit dans `.git/worktrees` :
  // `git worktree add` refuse alors le même chemin — « is already used by
  // worktree » — sur un dossier qui n'existe plus. `prune` retire les fiches
  // orphelines et ne touche à rien de vivant ; le relancer sur un dépôt sain
  // ne fait rien du tout.
  git("worktree", "prune");

  const branche = git("rev-parse", "--abbrev-ref", "HEAD");
  /** Ceux qu'on vient de créer, et qui attendent leurs dépendances. */
  const neufs = [];

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
    neufs.push(dossier);
  }

  // **Les dépendances s'installent ICI, pas dans une consigne.** Sa condition
  // du 5 septembre : aucune manip en plus. Un mode d'emploi en trois points
  // est une manip — et celui-ci se serait payé au premier essai, sur une
  // erreur de module introuvable qui accuse le code.
  //
  // Elles ne se partagent pas entre dossiers de travail : `next` et ses
  // binaires se résolvent depuis la racine du projet, et un lien vers le
  // `node_modules` du voisin ferait servir deux dossiers par la même
  // installation — exactement le partage qu'on vient de supprimer.
  /** Ceux dont l'installation a échoué — dits ensemble, à la fin. */
  const rates = [];
  for (const dossier of neufs) {
    console.log(`\nInstallation des dépendances dans ${path.basename(dossier)}…`);
    const r = spawnSync(SOUS_WINDOWS ? "npm.cmd" : "npm", ["install"], {
      cwd: dossier,
      stdio: "inherit",
      shell: SOUS_WINDOWS,
    });
    if (r.status !== 0) {
      // **On ne s'arrête PAS au premier échec.** Les dossiers sont déjà créés :
      // sortir ici laissait les suivants sans dépendances, et le patron devait
      // deviner lesquels. On les fait tous, et l'on dit à la fin ce qui reste.
      console.error(
        `❌ « npm install » a échoué dans ${dossier} (code ${r.status}).\n` +
          "   Le dossier existe : il suffit d'y relancer « npm install »."
      );
      rates.push(dossier);
    }
  }

  if (rates.length > 0) {
    console.error(
      `\n❌ ${rates.length} dossier(s) sans dépendances. Dans chacun : npm install\n` +
        rates.map((d) => `   ${d}`).join("\n")
    );
    process.exit(1);
  }

  console.log(`
✅ Tout est prêt. Il n'y a plus rien à faire.

Ouvre une session dans chacun de ces dossiers, et travaille comme d'habitude :
chaque session prend son port, sa base et son coin de Redis toute seule, et
« npm run verifier:avant-livraison » ne change pas.
`);
}

try {
  main();
} catch (erreur) {
  console.error(`❌ ${erreur.message}`);
  process.exit(1);
}
