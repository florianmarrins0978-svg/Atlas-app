/**
 * LES CONDITIONS GÉNÉRALES DE VENTE ET DE RÈGLEMENT — sa demande du
 * 12 septembre 2026 : *« dans les réglages, une case remplie d'un texte par
 * défaut qu'il peut effacer et réécrire, imprimée après le bon pour accord »*.
 *
 * **D'où vient le texte d'origine.** De la photo des CGV d'un menuisier qu'il a
 * envoyée, lue clause par clause sur la planche
 * `appli/devis-remise-main-d-oeuvre-conditions.html` : huit clauses reprises,
 * quatre laissées et dites (pénalités à 1,5 × périmées, « aucune indemnité »
 * abusive face à un particulier, tribunal imposé, camionnage), et trois
 * ajoutées que la loi attend d'un devis à un particulier — assurances,
 * rétractation, médiation. Il l'a vu, il l'a retenu tel quel.
 *
 * **Ce n'est PAS un texte juridique validé**, et ce fichier ne le prétend pas :
 * c'est le point de départ qu'il réécrit. Deux crochets restent à remplir par
 * lui — l'assureur et le médiateur —, et l'écran des réglages le lui dit tant
 * qu'ils y sont (`crochetsRestants`). Rien ne s'invente à leur place.
 *
 * **Une seule source.** L'écran des réglages, le devis et son PDF lisent ce
 * fichier ; le texte d'origine n'est recopié nulle part ailleurs.
 */

import { contenuDecennale, contenuMediateur, type DonneesMentionsObligatoires } from "./mentions-obligatoires";

export const TITRE_CONDITIONS_GENERALES = "CONDITIONS GÉNÉRALES DE VENTE ET DE RÈGLEMENT";

/**
 * LES DEUX CROCHETS, ÉCRITS UNE SEULE FOIS.
 *
 * Ils étaient jusqu'au 16 septembre 2026 noyés dans le texte ci-dessous, et
 * `conditionsGeneralesRemplies` aurait dû les y recopier pour les remplacer :
 * deux écritures de la même chaîne, dont l'une aurait vieilli en silence à la
 * première virgule corrigée (`CLAUDE.md` §3). Le texte les compose désormais.
 */
export const CROCHET_DECENNALE = "[assureur, n° de contrat, couverture géographique]";
export const CROCHET_MEDIATEUR = "[nom et coordonnées]";

export const TEXTE_ORIGINE_CONDITIONS_GENERALES = [
  "L’acceptation de nos devis implique l’adhésion aux conditions générales de vente et de règlement ci-après, qui prévalent sur toute autre condition, sauf dérogation écrite et expresse de notre part.",
  "1. Commande. Le devis, retourné daté et signé avec la mention « bon pour accord », vaut commande ferme des travaux qu’il décrit. Toute prestation non prévue fait l’objet d’un devis complémentaire accepté avant exécution.",
  "2. Prix et validité. Les prix sont établis selon les conditions économiques connues à la date du devis. Ils sont fermes pendant la durée de validité indiquée en tête ; au-delà, ils sont révisables.",
  "3. Règlement. Acompte à la commande selon le pourcentage indiqué, solde à réception de la facture. Aucun escompte n’est accordé pour paiement anticipé. Tout retard entraîne de plein droit des pénalités au taux de trois fois le taux d’intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du code de commerce).",
  "4. Délai d’exécution. Le délai indiqué sur le devis est donné à titre indicatif ; il est prolongé de plein droit en cas d’intempéries, de sol impraticable ou de cause indépendante de l’entreprise, sans que ce report puisse justifier l’annulation de la commande.",
  "5. Chantier. Le client assure l’accès au chantier, signale les réseaux enterrés et fait exécuter, sauf mention contraire au devis, les travaux relevant d’autres corps de métier. Les pertes de temps dues à des causes qui ne nous sont pas imputables font l’objet d’un supplément sur devis.",
  "6. Réception. La réception des travaux est faite par le client, ou son représentant, à la fin du chantier et en présence de l’entreprise. Les réserves sont formulées par écrit à ce moment ; aucune réclamation sur l’aspect des travaux n’est admise ultérieurement.",
  "7. Végétaux. Les végétaux fournis sont garantis à la plantation. Leur reprise dépend de l’arrosage et de l’entretien assurés par le client après réception. La garantie légale des vices cachés (art. 1641 et suivants du code civil) s’applique aux fournitures.",
  "8. Réserve de propriété. Les fournitures et végétaux restent la propriété de l’entreprise jusqu’au paiement intégral, en principal et intérêts. Nonobstant les articles 551 et 552 du code civil, l’entreprise demeure propriétaire de l’ouvrage exécuté jusqu’à complet paiement.",
  "9. Assurances. L’entreprise est titulaire d’une assurance responsabilité civile professionnelle et, pour les travaux qui y sont soumis, d’une assurance décennale : " + CROCHET_DECENNALE + ".",
  "10. Rétractation. Pour un devis signé hors de l’établissement de l’entreprise, le client particulier dispose d’un délai de rétractation de 14 jours (art. L221-18 du code de la consommation). Les travaux commencés avant ce terme le sont à sa demande écrite.",
  "11. Médiation et litiges. En cas de litige, le client particulier peut saisir gratuitement le médiateur de la consommation : " + CROCHET_MEDIATEUR + ". À défaut d’accord, les tribunaux compétents sont ceux désignés par le code de procédure civile.",
].join("\n\n");

/**
 * Le texte tel qu'il s'imprime, en paragraphes. Une ligne vide sépare deux
 * paragraphes ; les retours simples restent dans le paragraphe, le papier
 * replie lui-même. Rien quand le texte est vide : il l'a effacé, on n'imprime
 * rien — pas même le titre.
 */
export function paragraphesConditionsGenerales(texte: string | null | undefined): string[] {
  if (!texte) return [];
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/**
 * Combien de crochets « [à remplir] » restent dans son texte.
 *
 * L'écran des réglages le dit tant qu'il y en a : un « [assureur, n° de
 * contrat] » imprimé chez un client est le genre de chose qu'on ne voit qu'une
 * fois le devis parti.
 */
export function crochetsRestants(texte: string | null | undefined): number {
  if (!texte) return 0;
  return (texte.match(/\[[^\]]*\]/g) ?? []).length;
}

/**
 * Le texte, ses deux crochets remplis par ce que « Mon entreprise » sait.
 *
 * **Son accord du 14 septembre 2026** (`appli/decennale-et-mediateur.html`) :
 * l'assureur et le médiateur ne se ressaisissent plus ici. Ils sont saisis une
 * fois, et les articles 9 et 11 se remplissent tout seuls — comme le SIRET, qui
 * ne se retape pas sur chaque devis.
 *
 * **Un crochet dont la valeur manque RESTE un crochet**, et c'est délibéré :
 * l'écran des réglages le compte (`crochetsRestants`) et le dit tant qu'il y en
 * a. Le faire disparaître à vide laisserait partir « d'une assurance
 * décennale : . » chez un client, c'est-à-dire une phrase fausse à la place
 * d'un manque visible (`docs/AGENT.md` §3).
 *
 * **Elle s'applique à l'impression, jamais à ce qu'il a tapé.** Ce qui est
 * rangé en base reste SON texte, crochets compris : sinon changer d'assureur
 * ne changerait plus rien aux devis suivants, l'ancien nom étant déjà figé
 * dans la case.
 */
export function conditionsGeneralesRemplies(
  texte: string | null | undefined,
  mentions: DonneesMentionsObligatoires
): string {
  if (!texte) return "";
  const decennale = contenuDecennale(mentions);
  const mediateur = contenuMediateur(mentions);
  return texte
    .split(CROCHET_DECENNALE)
    .join(decennale ?? CROCHET_DECENNALE)
    .split(CROCHET_MEDIATEUR)
    .join(mediateur ?? CROCHET_MEDIATEUR);
}
