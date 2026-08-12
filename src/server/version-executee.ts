import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getEnv } from "./env";

const executer = promisify(execFile);

/**
 * Quelle version de l'application tourne, à cette seconde.
 *
 * **Pourquoi ce n'est plus une variable d'environnement, sur le banc d'essai.**
 *
 * `ATLAS_VERSION` est posée par `.devcontainer/demarrer.sh` juste avant de
 * lancer le serveur. Une variable est figée à la naissance du processus, et
 * cela produit deux mensonges, tous deux constatés :
 *
 *   1. **« inconnue — cette installation n'annonce pas sa version »** dès que le
 *      serveur n'a pas été lancé par ce script précis. Le patron a lu cette
 *      ligne le 7 août 2026 sur un espace tout neuf : l'écran ne pouvait donc
 *      plus répondre à la seule question qu'il sait poser — « est-ce que j'ai
 *      les corrections ? ».
 *   2. **une version périmée après « Chercher les dernières corrections »**. Ce
 *      bouton tire le code neuf sans redémarrer le serveur : la variable garde
 *      l'ancien commit, l'écran affiche l'ancien commit, et le patron conclut
 *      que le bouton n'a rien fait. C'est exactement le malentendu que ce
 *      bouton existait pour éteindre.
 *
 * Le dépôt, lui, ne peut pas se tromper : il EST le code servi. On l'interroge
 * donc à chaque affichage. Quelques millisecondes, sur un écran consulté trois
 * fois par semaine.
 *
 * `safe.directory` est passé à l'appel : dans un conteneur, le dossier de
 * travail appartient souvent à un autre compte que celui qui exécute, et git
 * refuse alors de répondre — panne muette qui aurait ramené « inconnue » par un
 * autre chemin.
 *
 * Hors banc d'essai, rien de tout cela : une application déployée n'a pas de
 * dépôt sous la main, et sa version vient de sa chaîne de livraison
 * (`ATLAS_VERSION`, `RELEASE_VERSION`).
 */
export async function versionExecutee(): Promise<string | null> {
  if (process.env.ATLAS_BANC_ESSAI === "1") {
    const duDepot = await versionDuDepot(process.cwd());
    if (duDepot) return duDepot;
  }
  return getEnv().versionAffichee ?? null;
}

/**
 * Le dernier commit du dépôt servi, écrit pour être lu sur une capture d'écran
 * de téléphone — pas par une machine.
 *
 * Rend `null` plutôt que de propager : un écran de réglages ne doit pas tomber
 * parce que git n'a pas répondu. L'appelant retombe alors sur la variable.
 */
async function versionDuDepot(racine: string): Promise<string | null> {
  try {
    const { stdout } = await executer(
      "git",
      ["-c", `safe.directory=${racine}`, "log", "-1", "--date=format:%d/%m/%Y %H:%M", "--format=%cd · %h"],
      { cwd: racine, timeout: 5_000 }
    );
    const commit = stdout.trim();
    if (!commit) return null;
    const branche = await brancheDuDepot(racine);
    return branche ? `${commit} · ${branche}` : commit;
  } catch {
    return null;
  }
}

/**
 * **La branche suivie — et c'est le manque qui a coûté la matinée du 12 août.**
 *
 * Le patron a envoyé une capture de son écran de création : c'était celui de la
 * veille. Ni son téléphone ni un cache : `.devcontainer/mettre-a-jour.sh`
 * récupère **la branche sur laquelle l'espace se trouve déjà**, et le travail
 * avait été livré sur une autre. La mise à jour a donc répondu « à jour », en
 * toute honnêteté, en servant du code d'avant-hier.
 *
 * L'écran des réglages existe précisément pour qu'« une capture d'écran réponde
 * à la question sans avoir à la poser ». Il répondait à « quelle version ? » et
 * pas à « quelle branche ? » — or c'est la seconde qui manquait. Le commit seul
 * ne suffit pas : `a1b2c3d` ne dit à personne qu'il vient du mauvais endroit.
 *
 * Rend `null` plutôt que de propager : la version reste affichable sans la
 * branche, et un écran de réglages ne doit pas tomber parce que git s'est tu.
 * `HEAD` détaché rend le mot « HEAD », qui est une réponse — et une réponse
 * utile, puisqu'un espace détaché ne se met plus à jour du tout.
 */
async function brancheDuDepot(racine: string): Promise<string | null> {
  try {
    const { stdout } = await executer(
      "git",
      ["-c", `safe.directory=${racine}`, "rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: racine, timeout: 5_000 }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
