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

/** La clé de Luhn : chaque chiffre de rang pair depuis la droite est doublé. */
function cleDeLuhnJuste(chiffres: string): boolean {
  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let c = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      c *= 2;
      if (c > 9) c -= 9;
    }
    somme += c;
  }
  return somme % 10 === 0;
}

/** Le SIREN de La Poste : ses établissements suivent une autre clé (Insee). */
const SIREN_DE_LA_POSTE = "356000000";

/**
 * UN SIRET QUI PEUT EXISTER — sa question du 23 novembre 2026 : *« il n'y a pas
 * moyen de tricher, de taper un numéro au pif ? »*. Quatorze chiffres ne
 * suffisent pas : le SIREN (les neuf premiers) et le SIRET entier portent
 * chacun une clé de Luhn, et un numéro tapé au hasard la rate neuf fois sur
 * dix. Ce n'est pas encore « il existe » (le registre le dira) ; c'est « il
 * pourrait exister ».
 *
 * La Poste fait exception, et l'Insee le documente : ses établissements autres
 * que le siège ont une somme de chiffres multiple de 5, sans clé de Luhn.
 */
export function siretBienForme(saisi: string | null | undefined): boolean {
  const chiffres = (saisi ?? "").replace(/\D/g, "");
  if (chiffres.length !== 14) return false;
  const siren = chiffres.slice(0, 9);
  if (siren === SIREN_DE_LA_POSTE) {
    // Son siège garde la clé de Luhn ; ses autres établissements, la somme.
    return cleDeLuhnJuste(chiffres) || [...chiffres].reduce((t, c) => t + Number(c), 0) % 5 === 0;
  }
  return cleDeLuhnJuste(siren) && cleDeLuhnJuste(chiffres);
}

/**
 * Les neuf chiffres du SIREN, sans espace : la clé qui reconnaît l'entreprise
 * d'un essai à l'autre. Un déménagement change le SIRET, jamais le SIREN.
 * `null` si le SIRET n'est pas bien formé : rien ne se reconnaît sur un numéro
 * qui ne peut pas exister.
 */
export function sirenDeLEssai(saisi: string | null | undefined): string | null {
  if (!siretBienForme(saisi)) return null;
  return (saisi ?? "").replace(/\D/g, "").slice(0, 9);
}
