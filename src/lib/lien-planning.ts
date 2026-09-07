/**
 * ─── OUVRIR LE PLANNING SUR LA JOURNÉE D'UN CHANTIER ────────────────────────
 *
 * **Sa réponse du 4 septembre 2026, devant les deux options : « sa journée ».**
 *
 * Un chantier posé n'a plus d'écran à lui depuis le retrait de la fiche
 * (`ARCHITECTURE.md` §254). Le renvoyer vers `/planning` tout court le
 * déposerait sur le mois courant, à lui de retrouver sa ligne — c'est
 * exactement l'errance qu'il signalait le 8 août 2026, *« comment moi je fais
 * pour avoir accès au devis ? »*.
 *
 * **L'IDENTIFIANT VOYAGE, PAS LA DATE.** Le planning connaît déjà la date de
 * chaque chantier ; la lui répéter dans l'adresse ferait deux vérités sur la
 * même journée, et la plus vieille des deux serait celle du lien — un signet
 * gardé une semaine ouvrirait le mois d'avant, sur une journée où le chantier
 * n'est plus.
 *
 * **POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST VIDE DE TOUT LE RESTE.**
 * Trois pièces doivent s'accorder sur le nom de ce paramètre — la règle de
 * reprise (`chantier-etat.ts`), la route retirée (`/chantiers/[id]`) et l'écran
 * du planning. Posée dans l'une des trois, elle aurait été recopiée dans les
 * deux autres, et un nom recopié finit par diverger. Posée dans
 * `portes-du-planning.ts`, elle refermait un cycle d'imports
 * (`chantier-etat` → `portes-du-planning` → `onglet-chantier` → `chantier-etat`)
 * : ce module-ci n'importe rien, donc il ne peut en fermer aucun.
 */

/** Le nom du paramètre, écrit une seule fois. */
const PARAM = "chantier";

/** L'adresse qui ouvre le planning sur la journée d'un chantier, portes levées. */
export function lienVersLeChantierAuPlanning(chantierId: string): string {
  return `/planning?${PARAM}=${encodeURIComponent(chantierId)}`;
}

/**
 * Ce que l'écran du planning relit dans son adresse.
 *
 * Rien n'est vérifié ici, et c'est délibéré : un identifiant qui ne désigne
 * aucun chantier VISIBLE ne lève simplement aucune feuille — l'écran reste
 * celui du jour. Le refuser par un message d'erreur ferait rougir un signet
 * dont le chantier a seulement été retiré, ce qui n'est pas une panne.
 */
export function chantierDemandeAuPlanning(
  valeur: string | string[] | null | undefined
): string | null {
  const lu = Array.isArray(valeur) ? valeur[0] : valeur;
  return lu && lu.length > 0 ? lu : null;
}
