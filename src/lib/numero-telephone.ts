/**
 * Le numéro qu'il tape d'une traite, espacé au fur et à mesure.
 *
 * **Sa demande du 21 août 2026 :** *« Il faut que je puisse taper les dix
 * chiffres à la suite et qu'ils se mettent automatiquement avec les bons
 * espaces. »* Sur un chantier, devant le client, on tape le numéro qu'on lit ou
 * qu'on entend — on ne s'arrête pas toutes les deux touches pour un espace.
 *
 * **Par PAIRES, comme un numéro français s'écrit et se dicte :** 06 79 98 45 14.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX RÈGLES QUI NE SE DEVINENT PAS, ET QUI ONT ÉTÉ MESURÉES.
 *
 * **1. Un numéro qui commence par « + » n'est PAS retouché.** Espacer
 * « +33679984514 » par paires rend « +33 67 99 84 51 4 », qui n'est le numéro
 * de personne : un indicatif ne se découpe pas comme un numéro français, et il
 * y en a autant que de pays. Celui qui tape un « + » sait ce qu'il écrit — on
 * le laisse écrire.
 *
 * **2. Le curseur ne saute pas à la fin.** Corriger un chiffre au milieu d'un
 * numéro déjà saisi est le geste le plus courant après la frappe elle-même ; un
 * curseur renvoyé au bout à chaque touche rend la correction impossible. On
 * compte donc les CHIFFRES à gauche du curseur, et on le repose au même rang
 * une fois les espaces refaits.
 *
 * **Le groupement vient de `numero-lisible.ts`**, où il servait déjà à écrire un
 * numéro sur un écran. Ce fichier-ci ne peut pas appeler `numeroLisible` — elle
 * rend le texte intact tant qu'il n'y a pas dix chiffres, et ici on espace un
 * numéro EN COURS de frappe —, mais la règle du deux-par-deux ne s'écrit qu'une
 * fois.
 *
 * **Fonction pure, hors de tout écran** (`CLAUDE.md` §3) : c'est ce qui la rend
 * éprouvable sans navigateur, et c'est là que vivent les vrais pièges.
 */

import { grouperParDeux } from "./numero-lisible";

/** Au-delà, ce n'est plus un numéro français : on cesse d'ajouter. */
export const CHIFFRES_MAX = 10;

export type NumeroEspace = {
  /** Ce qui s'affiche dans la case. */
  valeur: string;
  /** Où reposer le curseur, en nombre de caractères depuis le début. */
  curseur: number;
};

export function espacerNumero(brut: string, curseurAvant = brut.length): NumeroEspace {
  // L'international part intact — voir la règle 1 en tête de fichier.
  if (brut.trim().startsWith("+")) return { valeur: brut, curseur: curseurAvant };

  const chiffresAGauche = (brut.slice(0, curseurAvant).match(/\d/g) ?? []).length;
  const chiffres = (brut.match(/\d/g) ?? []).join("").slice(0, CHIFFRES_MAX);
  const valeur = grouperParDeux(chiffres);

  // Le curseur retrouve sa place : juste après le n-ième chiffre.
  let curseur = 0;
  let vus = 0;
  while (curseur < valeur.length && vus < chiffresAGauche) {
    if (/\d/.test(valeur[curseur])) vus++;
    curseur++;
  }
  return { valeur, curseur };
}

/**
 * Le numéro tel qu'on l'ENREGISTRE — les chiffres, sans les espaces d'affichage.
 *
 * **Pourquoi la base ne garde pas la jolie forme.** Le numéro s'espace pour être
 * lu et corrigé à l'écran ; en base, il est comparé, composé et envoyé. Y écrire
 * « 06 79 98 45 14 » obligerait chaque consommateur à savoir le renettoyer —
 * le rapprochement de clients (`telephoneRapproche`), le lien d'appel, l'envoi
 * du devis — et il suffirait qu'un seul l'oublie pour qu'un client cesse d'être
 * reconnu, en silence, sur une donnée qui n'a pourtant pas changé.
 *
 * L'écran garde donc l'espacement, l'enregistrement garde les chiffres, et
 * `numeroLisible` sait déjà réafficher proprement ce qui est relu.
 *
 * **Un numéro international part intact**, comme à la frappe : ses espaces à lui
 * sont les siens, et personne ici ne sait où les remettre.
 */
export function numeroEnregistre(valeur: string): string {
  const brut = valeur.trim();
  if (brut.startsWith("+")) return brut;
  return brut.replace(/\D/g, "");
}
