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
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
