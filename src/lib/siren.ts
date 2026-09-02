/**
 * Le SIREN ne se saisit jamais : ce sont les neuf premiers chiffres du SIRET.
 *
 * Deux saisies seraient deux façons de se contredire — et c'est celui qui
 * saisit qui paierait l'écart (voir `IdentiteClient.tsx`, où ce calcul sert
 * déjà à l'afficher sous le champ SIRET). Le RCS (migration 0072) le
 * réutilise pour la même raison : son numéro EST le SIREN, jamais un second.
 */
export function sirenDepuisSiret(siret: string | null | undefined): string | null {
  const chiffres = (siret ?? "").replace(/\D/g, "");
  if (chiffres.length < 9) return null;
  return chiffres.slice(0, 9).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}
