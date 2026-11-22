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
