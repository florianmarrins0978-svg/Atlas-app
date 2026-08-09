/**
 * Le nom du témoin qui porte l'anti-rejeu du raccordement d'agenda.
 *
 * **Pourquoi ce fichier existe au lieu d'une ligne dans `actions.ts`.** Un
 * module marqué `"use server"` ne peut exporter QUE des fonctions asynchrones.
 * Y ajouter cette constante ne provoque pas une erreur sur elle seule : le
 * module entier perd tous ses exports, et la page tombe avec
 * « The module has no exports at all ».
 *
 * Le piège est que ni `tsc` ni le lint ne le voient — les deux étaient verts.
 * Seule la suite navigateur l'a attrapé, en ouvrant vraiment l'écran
 * (`CLAUDE.md` §5 : regarder l'écran fait partie du travail).
 *
 * **Ce que le témoin empêche.** Sans lui, quelqu'un pourrait faire ouvrir à
 * l'artisan une adresse de retour fabriquée, portant un code d'autorisation
 * obtenu sur SON propre compte Google — et l'agenda d'un inconnu se
 * retrouverait branché sur l'Atlas de l'artisan, à lire ses disponibilités.
 * C'est une attaque connue de ce parcours ; elle se pare par un jeton tiré au
 * hasard, déposé avant le départ et comparé au retour.
 */
export const TEMOIN_ETAT_AGENDA = "atlas_agenda_etat";
