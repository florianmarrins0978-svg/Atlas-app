/**
 * L'anti-rejeu du retour de la banque, et la durée de l'accord demandé.
 *
 * **Ici et non dans `actions.ts`** : un module `"use server"` n'exporte que des
 * fonctions asynchrones, et une constante y fait perdre TOUS ses exports
 * (`reglages/agenda/temoin.ts` l'a payé).
 *
 * Le témoin empêche qu'on fasse ouvrir au patron une adresse de retour portant
 * le code de SON compte : Atlas lirait alors les virements d'un inconnu en les
 * présentant comme les siens.
 *
 * **La liaison elle-même n'est plus dans un témoin** depuis le 23 octobre
 * 2026 : elle vit en base (`liaisons_bancaires`), pour que l'accueil et Ma TVA
 * la lisent sans que cet écran soit ouvert.
 */
export const TEMOIN_ETAT_BANQUE = "atlas_banque_etat";

/**
 * Quatre-vingt-dix jours d'accord demandés à la banque.
 *
 * La règle européenne en permet cent quatre-vingts depuis juillet 2023, mais
 * toutes les banques n'acceptent pas encore plus de quatre-vingt-dix : une
 * demande refusée ne relierait rien. L'accueil prévient sept jours avant la
 * fin, et Ma banque dit la date.
 */
export const DUREE_DE_L_ACCORD_JOURS = 90;
