import { ceQueLeDevisDira, type Conditions } from "./conditions-documents";
import { TEINTES_ACCENT, teinteProposee } from "./allure-documents";
import { formatDe } from "./numero-documents";
import { GENRES } from "./message-client";

/**
 * CE QUE DIT CHAQUE LIGNE DU SOMMAIRE DE « DEVIS & FACTURES ».
 *
 * **Sa planche des Réglages soignés, 26 octobre 2026**
 * (`appli/soignee/reglages-documents.html`) : les quatre lignes du 7 septembre
 * restent, et chacune dit déjà ce qu'elle porte, « Validité 30 jours,
 * acompte 30 % », « Année et 6 chiffres », « Votre logo, le doré ». Il les
 * lit sans ouvrir les quatre écrans.
 *
 * **Tout se calcule sur ses réglages, rien ne s'écrit en dur** : une ligne qui
 * annoncerait trente jours sur le devis d'un couvreur réglé à quinze serait
 * pire qu'une ligne muette. Chaque phrase lit les mêmes fonctions que l'écran
 * qu'elle résume, jamais une copie.
 */

/** Une ligne du sommaire : ce qu'elle dit, et si c'est une chose à faire (ambre). */
export type Resume = { texte: string; aFaire: boolean };

/** Les deux morceaux qui comptent le plus, au-delà la ligne passerait à trois. */
const MORCEAUX_AU_PLUS = 2;

/**
 * « Validité 30 jours, acompte 30 % », ou ce qui reste à faire.
 *
 * **Un crochet à remplir passe devant tout le reste** : c'est le seul défaut
 * qui part chez le client sans que rien ne l'arrête, imprimé tel quel dans les
 * conditions générales. `crochets` est ce qui RESTE une fois Mon entreprise
 * versée dans le texte (`conditionsGeneralesRemplies`), compté par l'appelant
 * comme l'écran le compte.
 *
 * **« Les lignes et les totaux seulement » ne se dit que si c'est vrai** : la
 * même règle que « Ce que votre devis dira » (`ceQueLeDevisDira`), sans quoi le
 * sommaire referait le mensonge que cet écran-là ne fait plus.
 */
export function resumeConditions(c: Conditions, crochets: number): Resume {
  if (crochets > 0) {
    return { texte: `${crochets} crochet${crochets > 1 ? "s" : ""} à remplir`, aFaire: true };
  }
  const dira = ceQueLeDevisDira(c);
  if (dira.rien) return { texte: "Les lignes et les totaux seulement", aFaire: false };
  // Dans l'ordre de l'écran : ce qui engage le plus d'abord.
  const morceaux = [
    dira.validite ? `validité ${dira.validite}` : null,
    c.acomptePourcent !== null ? `acompte ${c.acomptePourcent} %` : null,
    c.delaiPaiementJours === null ? null : c.delaiPaiementJours === 0 ? "comptant" : `paiement à ${c.delaiPaiementJours} jours`,
    c.moyensPaiement ? "moyens de paiement" : null,
    c.rappelerPenalites ? "pénalités rappelées" : null,
    c.textePied ? "votre texte en bas" : null,
    dira.conditionsGenerales ? "conditions générales" : null,
  ]
    .filter((m): m is string => m !== null)
    .slice(0, MORCEAUX_AU_PLUS)
    .join(", ");
  return { texte: morceaux.charAt(0).toUpperCase() + morceaux.slice(1), aFaire: false };
}

/** Le compte en toutes lettres : « 3 messages » se lit comme un code. */
const NOMBRES = ["Aucun", "Un", "Deux", "Trois", "Quatre", "Cinq"];

/** « Trois messages » : un par document, et c'est la liste des genres qui le dit. */
export function resumeMessages(): string {
  return `${NOMBRES[GENRES.length] ?? GENRES.length} messages`;
}

/** « Année et 6 chiffres » : le nom que la liste des formats lui montre. */
export function resumeNumero(formatNumero: string | null | undefined): string {
  return formatDe(formatNumero).nom;
}

/**
 * « Votre logo, le doré » : ce qui se voit d'abord sur le papier.
 *
 * Une teinte prise au nuancier libre n'a pas de nom ; « une autre couleur » le
 * dit sans inventer un nom qu'elle ne porte pas.
 */
export function resumeAllure(avecLogo: boolean, accent: string): string {
  const prise = teinteProposee(TEINTES_ACCENT, accent);
  const couleur = prise ? (prise.court ?? prise.nom.toLowerCase()) : "une autre couleur";
  return `${avecLogo ? "Votre logo" : "Sans logo"}, ${couleur}`;
}
