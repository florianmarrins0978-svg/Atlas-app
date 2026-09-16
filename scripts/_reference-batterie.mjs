/**
 * L'ÉTAT DE RÉFÉRENCE : ce que la batterie a dit LA DERNIÈRE FOIS SUR `main`.
 *
 * **Sa règle du 16 septembre 2026 :** *« état de référence connu + nouveau lot
 * → aucun nouveau rouge autorisé. Un rouge préexistant identique ne doit pas
 * empêcher éternellement toutes les futures fusions. »*
 *
 * Elle est née d'un blocage réel : sur son PC, seize suites d'outillage
 * rougissent (elles veulent `bash`, `ps -o`, `gh`, `npx.cmd`) — toutes déjà
 * rouges sur `main`, toutes sans rapport avec le lot du jour. Le garde-fou de
 * `main` ne voyait qu'un verdict ROUGE et refusait tout, pour toujours. Et il
 * a refusé, à raison, une liste d'exceptions écrite à la main pour ces seize :
 * une liste qui abaisse le niveau vieillit, et le jour où elle oublie ou
 * absorbe un vrai rouge, personne ne le voit (`.claude/rules/testing.md`).
 *
 * **Ce qui remplace la liste : une MESURE.** La batterie, jouée sur un arbre
 * propre qui est sur `origin/main`, enregistre ici les suites qu'elle a vues
 * rouges. C'est l'état connu de `main` sur CETTE machine. Un lot est ensuite
 * comparé à cet état, jamais à zéro.
 *
 * **Pourquoi dans `.git/` et non à la racine.** Le fichier décrit une machine,
 * pas le dépôt : il ne se versionne pas (le committer ferait tolérer chez
 * quelqu'un les rouges d'un autre). Et le `.git` commun est partagé par tous
 * les `git worktree` de la machine (`npm run session`) : une référence mesurée
 * dans le dossier de batterie sert au garde-fou du dossier principal, sans
 * copie. Un fichier à la racine, lui, aurait été propre à un seul dossier —
 * et compté par l'empreinte de la batterie comme un fichier qui bouge.
 *
 * **Ce qu'elle ne fait pas.** Elle ne tolère jamais une étape hors suites
 * (types, lint, construction, connexion) : celles-là n'ont pas de « rouge
 * connu », un rouge y est toujours nouveau. Et elle ne se met à jour que sur
 * `main` : une batterie jouée sur un lot ne devient jamais la référence, sinon
 * le lot s'absoudrait lui-même.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const NOM = "atlas-reference-batterie.json";

function git(racine, ...args) {
  try {
    return execFileSync("git", ["-C", racine, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Le `.git` partagé par tous les dossiers de travail de ce dépôt. */
export function cheminDeLaReference(racine) {
  const commun = git(racine, "rev-parse", "--git-common-dir");
  if (!commun) return null;
  return path.join(path.resolve(racine, commun), NOM);
}

/**
 * La référence, ou `null` si elle manque ou ne se lit pas. **Absente, elle ne
 * tolère rien** : le garde-fou retombe sur « la batterie doit être verte »,
 * c'est-à-dire sur la règle d'avant. Un garde-fou en panne tombe du côté du
 * refus de tolérer, jamais du côté de la tolérance.
 */
export function lireReference(racine) {
  const chemin = cheminDeLaReference(racine);
  if (!chemin || !existsSync(chemin)) return null;
  try {
    const brut = JSON.parse(readFileSync(chemin, "utf8"));
    if (typeof brut.quand !== "number" || typeof brut.commit !== "string") return null;
    if (!Array.isArray(brut.rouges) || !brut.rouges.every((r) => typeof r === "string")) return null;
    if (brut.niveau !== 3) return null;
    return { quand: brut.quand, commit: brut.commit, rouges: [...brut.rouges].sort(), niveau: 3 };
  } catch {
    return null;
  }
}

export function ecrireReference(racine, reference) {
  const chemin = cheminDeLaReference(racine);
  if (!chemin) return false;
  try {
    mkdirSync(path.dirname(chemin), { recursive: true });
    writeFileSync(
      chemin,
      JSON.stringify({
        quand: reference.quand,
        commit: reference.commit,
        rouges: [...reference.rouges].sort(),
        niveau: 3,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/** Le commit mesuré. */
export function commitCourant(racine) {
  return git(racine, "rev-parse", "HEAD");
}

/**
 * L'arbre est-il exactement un commit de `origin/main`, sans rien en attente ?
 *
 * C'est la SEULE condition sous laquelle une batterie devient la référence.
 * `origin/main` tel que la machine le connaît : pas de `fetch` ici — une
 * mesure ne va pas sur le réseau —, donc une référence ne peut jamais décrire
 * un `main` que la machine n'a pas encore vu, ce qui est le côté sûr.
 */
export function estSurMain(racine) {
  const attente = git(racine, "status", "--porcelain");
  if (attente === null || attente !== "") return false;
  return git(racine, "merge-base", "--is-ancestor", "HEAD", "origin/main") !== null;
}

/** Le commit de la référence est-il dans l'histoire de l'arbre courant ? */
export function estAncetre(racine, commit) {
  if (!commit) return false;
  return git(racine, "merge-base", "--is-ancestor", commit, "HEAD") !== null;
}
