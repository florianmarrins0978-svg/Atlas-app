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

/**
 * Le SIRET d'une entreprise cliente, tel qu'il s'imprime : « 812 345 678 00021 ».
 *
 * Vide rend `""` (il n'en a pas donné : rien ne s'imprime). Tout autre nombre
 * de chiffres que quatorze rend `null`, et l'écran le refuse avec ses mots :
 * un SIRET tronqué sur une facture est pire qu'aucun.
 */
export function siretLu(saisi: string | null | undefined): string | null {
  const chiffres = (saisi ?? "").replace(/\D/g, "");
  if (chiffres === "" && (saisi ?? "").trim() === "") return "";
  if (chiffres.length !== 14) return null;
  return chiffres.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
}
