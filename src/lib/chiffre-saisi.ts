import { Decimal } from "decimal.js";

/**
 * CE QU'UN CHIFFRE TAPÉ AU DOIGT VEUT DIRE — une seule lecture, pour tous.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa capture du 15 septembre 2026 :** *« une ligne érigeron est bloquée, je
 * peux pas écrire »* — 12 × 2,50, « Montant HT 0,00 € », et « La correction
 * n'a pas pu être enregistrée. Réessayez. » Le champ est en
 * `inputMode="decimal"` : sur un clavier français, le doigt tombe sur la
 * VIRGULE. PostgreSQL refuse « 2,50 » dans une colonne numérique, et l'écran
 * ne recevait de l'exception que cette phrase.
 *
 * **Pourquoi la règle vit ICI, et pas dans l'écran.** L'écran du devis
 * normalisait avant d'envoyer ; celui de la facture ne le faisait pas — c'est
 * exactement le piège du §4 quater : *une correction dans l'appelant, et le
 * prochain appelant refait le même défaut*. La lecture se fait donc à
 * l'endroit où le chiffre entre pour de bon — le dépôt —, et l'écran peut se
 * tromper sans que rien ne casse.
 *
 * **Ce qu'elle lit, et ce qu'elle refuse.** « 2,50 », « 2.5 », « 12 », avec ou
 * sans espaces autour : un nombre. « douze », « 1,000,5 », vide : `null` — et
 * c'est à l'appelant de dire ce qu'il en fait (un défaut, un refus), jamais à
 * cette fonction d'inventer un zéro.
 */
export function chiffreCanonique(valeur: string | number | null | undefined): string | null {
  const propre = String(valeur ?? "").trim().replace(",", ".");
  if (propre === "") return null;
  try {
    const n = new Decimal(propre);
    return n.isFinite() ? n.toString() : null;
  } catch {
    return null;
  }
}

/** Le même chiffre, lu comme un nombre du langage — pour ce qui s'affiche, jamais pour ce qui se paie. */
export function nombreSaisi(valeur: string | number | null | undefined): number {
  const canon = chiffreCanonique(valeur);
  return canon === null ? 0 : Number(canon);
}
