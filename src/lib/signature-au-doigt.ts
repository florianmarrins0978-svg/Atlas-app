/**
 * CE QUI COMPTE COMME UNE SIGNATURE AU DOIGT — une seule règle pour les trois
 * papiers qui en portent une : la fiche de sécurité (21 septembre 2026), le
 * devis signé depuis son lien et la fiche d'entretien signée sur place (ses
 * deux planches du 17 novembre 2026).
 *
 * Elle vivait dans `fiche-securite.ts`. Recopiée pour le devis, elle aurait
 * fini par accepter ici ce qu'elle refuse là (`CLAUDE.md` §3).
 *
 * **Une signature est un vrai PNG, tracé au doigt** : sinon le PDF qui
 * l'embarque reçoit ce qu'on lui a donné, et une image qui n'en est pas une le
 * fait tomber, sur le papier même qui fait foi.
 */

/** Une signature au doigt compte quand elle a plus de quelques points : un tap n'est pas une signature. */
export const POINTS_MINIMUM_D_UNE_SIGNATURE = 8;

/**
 * Le trait mesure 600 sur 260 (`pngDeLaSignature`) : même dense, il tient très
 * en dessous. Au-delà, ce n'est pas une signature, c'est un envoi qui remplit
 * la base.
 */
export const LONGUEUR_MAX_D_UNE_SIGNATURE = 500_000;

const ENTETE_PNG = "data:image/png;base64,";
/** Les huit octets qui ouvrent tout PNG, écrits en base64. */
const MAGIE_PNG = "iVBORw0KGgo";

/**
 * Vrai quand `png` est une image PNG en `data:` de taille raisonnable, tracée
 * d'au moins quelques points. Chaque papier dit son propre refus : la phrase
 * n'est pas la même sur une fiche et sur un devis.
 */
export function signatureAuDoigtValable(png: unknown, points: unknown): png is string {
  if (typeof points !== "number" || points < POINTS_MINIMUM_D_UNE_SIGNATURE) return false;
  if (typeof png !== "string" || !png.startsWith(ENTETE_PNG) || png.length > LONGUEUR_MAX_D_UNE_SIGNATURE) return false;
  const donnees = png.slice(ENTETE_PNG.length);
  return donnees.startsWith(MAGIE_PNG) && /^[A-Za-z0-9+/]+={0,2}$/.test(donnees);
}

/**
 * Ce que le client lit s'il accepte son devis sans avoir signé : la même phrase
 * à l'écran, avant l'envoi, et au retour du serveur, qui la redit si le
 * formulaire a été rejoué sans trait.
 */
export const SIGNEZ_AVANT_D_ACCEPTER = "Signez dans le cadre, au doigt, avant d'accepter le devis.";

/** La même, pour le contrat d'entretien (sa planche B du 18 novembre 2026). */
export const SIGNEZ_AVANT_D_ACCEPTER_LE_CONTRAT = "Signez dans le cadre, au doigt, avant d'accepter le contrat.";
