/**
 * Où vit la photo de la nourrice éclatée, vue du dessus, pour une nourrice de
 * `voies` voies dont `goutte` en goutte-à-goutte. Le script qui la prend
 * (`scripts/rendre-nourrice-eclatee.mts`), le PDF qui la pose
 * (`plan-arrosage-pdf.ts`) et le contrôle qui vérifie qu'elle existe lisent ce
 * même chemin : trois façons de l'écrire finiraient par en perdre une.
 */
export function photoDeLaNourrice(voies: number, goutte: number): string {
  return `/arrosage-photos/nourrice-3d/eclatee-${voies}-${goutte}.jpg`;
}

/**
 * Où chaque pièce tombe sur cette photo, de 0 à 1 depuis le coin haut gauche :
 * la boîte que la scène 3D lui donne. Le PDF y pose son numéro, celui de la
 * liste (sa demande du 22 novembre 2026 : savoir tout de suite à quoi
 * correspond chaque ligne). `ref` est la référence du catalogue.
 */
export type PlaceSurLaPhoto = { ref: string; x0: number; y0: number; x1: number; y1: number };

/** Les places de toutes les photos, rangées par « voies-goutte » (`3-1`). */
export const FICHIER_DES_PLACES = "/arrosage-photos/nourrice-3d/places.json";
