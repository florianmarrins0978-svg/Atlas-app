/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE TÉMOIN : une copie propre du commit de `main` qui sert de base au lot
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa règle du 17 septembre 2026 :** *« rejouer CE contrôle sur une copie
 * propre du commit de référence de main »* — et rien d'autre. Pas de batterie,
 * pas d'état global : le commit git suffit.
 *
 * **Pourquoi un `git worktree` et pas un `git stash`.** Le dossier de travail
 * peut porter trois sessions (`CLAUDE.md` §1.0) : déplacer `HEAD` ou remiser
 * l'arbre emporterait le travail des autres. Un second dossier de travail ne
 * déplace rien — même dépôt, même `.git`, un répertoire à part.
 *
 * **Le `node_modules` se PRÊTE, il ne se réinstalle pas.** Un `npm ci` coûte
 * deux minutes et des centaines de mégaoctets, à chaque comparaison. Les deux
 * arbres sont le même dépôt, aux mêmes dépendances, à un commit près.
 *
 * **Mais un LIEN vers le dossier voisin ne marche pas**, et c'est mesuré : la
 * construction refuse un `node_modules` qui sort de la racine du projet —
 * *« Symlink [project]/node_modules is invalid, it points out of the
 * filesystem root »*. On lie donc fichier à fichier (`cp -al`) : le dossier
 * reste clos sur lui-même, et les liens durs ne recopient aucun octet.
 *
 * **Il vit dans `.git/`**, comme tout ce qui décrit une machine et non le
 * dépôt : il ne se versionne pas, et le `.git` commun est partagé par tous les
 * dossiers de travail.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const NOM = "atlas-temoin-de-main";

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

/** Le commit courant du dossier. */
export function commitCourant(racine) {
  return git(racine, "rev-parse", "HEAD");
}

/**
 * LA BASE DU LOT : le commit de `main` d'où il part réellement.
 *
 * `merge-base` et non `origin/main` : le lot a pu être préparé avant que
 * `main` avance, et c'est à ce qu'il CONNAÎT qu'on le compare. Comparer à un
 * `main` plus récent reviendrait à lui imputer les rouges arrivés depuis.
 */
export function baseDuLot(racine) {
  return git(racine, "merge-base", "HEAD", "origin/main");
}

/** Où le témoin est posé, qu'il existe ou non. */
export function cheminDuTemoin(racine) {
  const commun = git(racine, "rev-parse", "--git-common-dir");
  if (!commun) return null;
  return path.join(path.resolve(racine, commun), NOM);
}

/**
 * PRÉPARER LE TÉMOIN sur un commit donné, et rendre son chemin.
 *
 * Rend `null` si le dépôt ne s'y prête pas — et l'appelant bloque alors sur ce
 * cas précis plutôt que de conclure : ne pas savoir n'est pas « c'était déjà
 * rouge ».
 */
export function preparerLeTemoin(racine, commit) {
  const ou = cheminDuTemoin(racine);
  if (!ou || !commit) return null;

  if (existsSync(ou)) {
    // Déjà là : on le ramène sur le commit voulu plutôt que de le refaire.
    const remis = git(ou, "checkout", "--detach", commit);
    if (remis === null) {
      // Un témoin abîmé se jette : il ne se répare pas à moitié.
      git(racine, "worktree", "remove", "--force", ou);
      rmSync(ou, { recursive: true, force: true });
    }
  }
  if (!existsSync(ou)) {
    if (git(racine, "worktree", "add", "--detach", ou, commit) === null) return null;
  }

  // Les dépendances se prêtent — voir l'en-tête.
  const modules = path.join(ou, "node_modules");
  if (!existsSync(modules)) {
    try {
      execFileSync("cp", ["-al", path.join(racine, "node_modules"), modules], { stdio: "ignore" });
    } catch {
      return null; // sans dépendances, rien ne se joue : on ne conclut pas.
    }
  }
  return ou;
}
