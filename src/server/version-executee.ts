import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getEnv } from "./env";
import { versionServie, type VersionServie } from "@/lib/version-servie";
import { estBancDEssai } from "@/profil-banc";

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
 * **Et la BRANCHE se dit, pas seulement la date — c'est le défaut du 11 août
 * 2026 au soir.** Le bouton « Nouveau chantier » venait d'être livré sur une
 * branche de travail ; l'espace du patron, lui, suit `main`, où le bouton
 * n'était pas. Il a ouvert Réglages, lu une date de la même heure — `main`
 * avançait en parallèle — et conclu, à juste titre : *« j'ai la nouvelle
 * dernière mise à jour »*. Puis : *« la modification n'est pas effectuée »*.
 *
 * Les deux affirmations étaient vraies. Son espace était parfaitement à jour, et
 * le travail était ailleurs. Une date et un commit court ne pouvaient pas
 * l'arbitrer : deux branches vivantes le même soir portent la même heure et des
 * empreintes également illisibles sur six pouces. **Le nom de la branche est le
 * seul mot de cette ligne qui répond vraiment à « est-ce que j'ai ce qui vient
 * d'être fait ».**
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
  return (await versionEtRetard()).ligne;
}

/**
 * La même chose, plus ce que la ligne seule ne peut pas dire : **du code neuf
 * attend-il d\'être construit ?**
 *
 * **Ajouté le 21 août 2026, après une soirée perdue.** Le patron : *« Ça n\'a
 * pas marché, j\'ai encore l\'ancienne version. Pourtant j\'ai rechargé les mises
 * à jour. »* Les deux étaient vrais en même temps — le disque avait avancé, le
 * serveur bâti non — et cet écran, en lisant le disque, confirmait la mise à
 * jour au moment précis où il aurait dû signaler qu\'elle n\'était pas servie.
 *
 * Le raisonnement vit dans `src/lib/version-servie.ts`, sans base ni serveur :
 * c\'est là qu\'il est éprouvé, y compris sur le cas qu\'il a vécu.
 */
export async function versionEtRetard(): Promise<VersionServie> {
  // **Les DEUX marques du banc**, jamais une seule : `.devcontainer/demarrer.sh`
  // ne pose que `ATLAS_PROFIL`, et cet écran annonçait donc « version inconnue »
  // sur un banc reconnu partout ailleurs (constat M12, 25 août 2026).
  const surLeBanc = estBancDEssai();
  return versionServie({
    // Le dépôt n\'existe que sur son banc : une application déployée n\'en a pas.
    duDepot: surLeBanc ? await versionDuDepot(process.cwd()) : null,
    duDemarrage: getEnv().versionAffichee ?? null,
    // **`next start` impose `NODE_ENV=production`** : c\'est donc ce qui
    // distingue un serveur qui compile à la demande d\'un serveur qui sert du
    // code figé. Le mode développement, lui, EST le dépôt.
    versionBatie: process.env.NODE_ENV === "production",
  });
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
    const version = stdout.trim();
    if (!version) return null;
    const branche = await brancheDuDepot(racine);
    return branche ? `${version} · ${branche}` : version;
  } catch {
    return null;
  }
}

/**
 * La branche suivie par le dépôt servi.
 *
 * Rend `null` — et non « inconnue » — quand git ne répond pas ou que la tête est
 * détachée : la ligne Version perd alors son dernier mot, ce qui est exactement
 * l'état d'avant. Mieux vaut une ligne incomplète qu'une ligne qui affirme une
 * branche fausse ; c'est précisément la confiance qu'on cherche à rétablir ici.
 */
async function brancheDuDepot(racine: string): Promise<string | null> {
  try {
    const { stdout } = await executer(
      "git",
      ["-c", `safe.directory=${racine}`, "rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: racine, timeout: 5_000 }
    );
    const branche = stdout.trim();
    return branche && branche !== "HEAD" ? branche : null;
  } catch {
    return null;
  }
}
