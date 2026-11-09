import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **Compléter `.env.local` au démarrage du banc, pas seulement à l'allumage —
 * 9 novembre 2026.**
 *
 * Il a écrit une idée, et le lendemain du correctif qui devait la lui faire
 * lire (`ATLAS_EDITEUR_EMAIL`, 8 novembre), la ligne « Les idées reçues »
 * n'était toujours pas là. Son espace servait bien le code du correctif ; son
 * `.env.local` ne portait pas la ligne.
 *
 * `demarrer.sh` complète ce fichier à l'allumage, **avant** d'aller chercher le
 * code neuf : l'allumage qui apporte un nom neuf joue l'ANCIEN
 * `completer-env-local.sh`. Et le bouton « Mettre à jour » des Réglages
 * récupère le code puis coupe le serveur sans jamais repasser par
 * `demarrer.sh`. Un nom ajouté au modèle n'atteignait donc son serveur qu'au
 * deuxième allumage après sa livraison.
 *
 * Les deux chemins se rejoignent ici : le veilleur relance `npm run banc`, qui
 * relit ce fichier-ci depuis le disque, donc celui du code qui vient
 * d'arriver. `next start` lit ensuite `.env.local` lui-même pour toute
 * variable que l'environnement ne porte pas (`@next/env`), et l'éditeur est
 * nommé dès cette relance.
 *
 * **Complète, ne crée jamais.** La batterie lance ce banc chez l'agent et en
 * CI (`verifier-connexion-avec-serveur.mts`) : y faire naître le fichier y
 * nommerait le compte de démonstration éditeur pour les serveurs suivants du
 * même dossier. La naissance reste à `demarrer.sh`, sur son espace.
 *
 * Le modèle est celui qui est posé à côté de CE fichier, jamais un chemin
 * relatif au dossier courant : c'est lui qui vient d'arriver avec le code.
 *
 * @param {string} racine le dossier où vit `.env.local`
 * @returns {boolean} `true` si un fichier existait et a été complété
 */
export function completerReglagesDuBanc(racine) {
  const fichier = path.join(racine, ".env.local");
  if (!existsSync(fichier)) return false;
  const modele = fileURLToPath(new URL("../.devcontainer/completer-env-local.sh", import.meta.url));
  execFileSync("bash", [modele, fichier], { stdio: ["ignore", "ignore", "inherit"], timeout: 10_000 });
  return true;
}
