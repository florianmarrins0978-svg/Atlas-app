/**
 * ─── UN RAPPORT D'ENTRETIEN SE RELIT DANS L'APPLICATION ─────────────────────
 *
 * **Sa capture du 24 septembre 2026 :** *« j'ai aucun moyen de faire
 * retour ! »*, sur un rapport ouvert depuis « Rapports envoyés » ou le dossier
 * d'un client. Les deux liens menaient à `/entretien/<jeton>`, la page que son
 * CLIENT reçoit par SMS : elle ne porte volontairement ni en-tête, ni flèche,
 * ni journal (`layout.tsx`, `estPageDuClient`), et le dossier l'ouvrait en
 * plus dans un onglet neuf, qui n'a rien derrière lui.
 *
 * C'est la panne du PDF du 11 septembre, sur une page au lieu d'un fichier, et
 * la réponse est la même (`visionneuse-pdf.ts`) : un écran de l'application,
 * avec sa flèche, qui montre le rapport tel que le client l'a reçu. La page du
 * client, elle, ne change pas d'un pixel.
 *
 * **Le partage garde l'adresse publique.** C'est elle qu'on envoie au client ;
 * celle-ci demande un compte, et il n'en a pas.
 */

/** L'écran de l'application qui montre un rapport envoyé. */
export const CHEMIN_RAPPORT_DANS_L_APPLI = "/documents/entretien";

/** La page que le client reçoit : `/entretien/<jeton>`, rien d'autre. */
const ADRESSE_DU_CLIENT = /^\/entretien\/([A-Za-z0-9_-]+)$/;

/** L'adresse, dans l'application, du rapport qui porte ce jeton. */
export function adresseDuRapportDansLAppli(jeton: string): string {
  return `${CHEMIN_RAPPORT_DANS_L_APPLI}/${encodeURIComponent(jeton)}`;
}

/**
 * Le même rapport, vu depuis l'application, pour une adresse du client — ou
 * `null` si ce n'en est pas une. Le dossier d'un client range l'adresse
 * publique (c'est celle qu'il partage) ; seul « Ouvrir » la traduit.
 */
export function rapportDansLAppli(adresseDuClient: string): string | null {
  const trouve = ADRESSE_DU_CLIENT.exec(adresseDuClient);
  return trouve ? adresseDuRapportDansLAppli(trouve[1]) : null;
}
