/**
 * Où se pose la perle du fil des chantiers.
 *
 * **La règle, et pourquoi elle est ici plutôt que dans l'écran.** Une seule
 * perle, sur le PREMIER chantier qui attend un geste du patron. C'est la règle
 * de charte née des maquettes du 10 août 2026 : *une couleur qui ne veut rien
 * dire est une couleur en trop*. En poser une devant chaque chantier en attente
 * reviendrait à n'en désigner aucun, et l'écran redeviendrait le tableau de
 * bord qu'il refuse.
 *
 * Elle vit dans une fonction pure parce qu'elle se casse là où personne ne
 * regarde : liste vide, aucun chantier en attente, plusieurs en attente,
 * l'attente en dernière position. Aucun de ces cas ne s'atteint en cliquant sur
 * un écran de démonstration — celui du banc n'en contient pas un seul.
 */
export function chantierQuiPorteLaPerle<T extends { id: string; attend: boolean }>(
  chantiers: readonly T[],
): string | null {
  return chantiers.find((c) => c.attend)?.id ?? null;
}
