/**
 * Les deux témoins de l'essai bancaire.
 *
 * **Ici et non dans `actions.ts`** : un module `"use server"` n'exporte que des
 * fonctions asynchrones, et une constante y fait perdre TOUS ses exports
 * (`reglages/agenda/temoin.ts` l'a payé).
 *
 * `ETAT` est l'anti-rejeu du retour de la banque, comme pour l'agenda : sans
 * lui, quelqu'un pourrait faire ouvrir au patron une adresse de retour portant
 * le code de SON compte, et Atlas lirait les virements d'un inconnu en les
 * présentant comme les siens.
 *
 * `LIAISON` garde la session ouverte chez Enable Banking, et les comptes
 * qu'elle couvre. Elle ne vaut rien sans la clé de l'application, qui ne
 * quitte jamais l'espace : c'est elle qui signe chaque appel.
 */
export const TEMOIN_ETAT_BANQUE = "atlas_banque_etat";
export const TEMOIN_LIAISON_BANQUE = "atlas_banque_liaison";
