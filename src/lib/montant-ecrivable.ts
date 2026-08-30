/**
 * UN MONTANT VENU DU MODÈLE PEUT-IL S'ÉCRIRE SUR UN DEVIS ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CETTE FONCTION FERME** — lot de clôture, 29 août 2026.
 *
 * Sur le chemin de l'assistant, une ligne de prix sans `tarifId` prend son
 * montant **directement dans ce que le modèle a rendu**, et l'écrit. Le
 * commentaire qui tenait cette place affirmait le contraire — *« le montant
 * côté proposition n'est utilisé QUE pour les lignes calculées »* — et c'était
 * faux de ce chemin-là.
 *
 * La base refusait déjà le négatif (`CHECK (montant >= 0)`). Elle ne refusait
 * ni `NaN`, ni une chaîne ambiguë, ni un nombre à sept décimales, ni
 * 99 999 999,99 € — le plafond de `numeric(10,2)`, atteint sans jamais lever.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QU'ELLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ : ELLE N'INVENTE AUCUN PLAFOND
 * MÉTIER.**
 *
 * Refuser « au-dessus de 10 000 € » serait une règle qu'aucun artisan n'a
 * posée : un chantier de terrassement dépasse ce chiffre, un contrat
 * d'entretien annuel aussi. Une borne inventée refuserait du travail réel, et
 * l'on apprendrait à la contourner.
 *
 * Ce qui est borné ici est **factuel**, et rien d'autre :
 *
 * | Refusé | Pourquoi ce n'est pas un choix de notre part |
 * |---|---|
 * | ce qui n'est pas un nombre | `NaN` et `Infinity` ne sont pas des montants |
 * | le négatif | la base le refuse déjà, on le dit mieux |
 * | plus de deux décimales | l'euro n'en a pas trois ; la colonne les tronquerait en silence |
 * | au-delà de `numeric(10,2)` | **la colonne ne peut pas le contenir.** PostgreSQL lèverait, et le message accuserait « une modification impossible » au lieu de nommer le montant |
 *
 * **La borne haute n'est donc pas un jugement sur le métier**, c'est la
 * capacité réelle de la colonne. Un vrai plafond métier — « au-dessus de tant,
 * je veux confirmer » — reste une décision du patron, et elle est inscrite
 * comme telle dans le rapport de clôture.
 */

/** Ce que `numeric(10,2)` peut contenir : huit chiffres avant la virgule. */
export const MONTANT_MAXIMAL = 99_999_999.99;

export type MontantVerifie =
  | { ok: true; montant: string }
  | { ok: false; raison: string };

/**
 * Lit un montant rendu par le modèle, et refuse ce qui ne peut pas s'écrire.
 *
 * **Le refus NOMME le montant en cause.** Un « cette modification n'a pas pu
 * être appliquée » envoie chercher une panne là où il s'agit d'une valeur — et
 * une erreur qui accuse à tort coûte plus cher que pas d'erreur du tout
 * (`AGENTS.md`).
 *
 * Rend une chaîne, parce que c'est ce que la colonne `numeric` attend : passer
 * par un `number` ferait perdre la précision décimale sur les grands montants.
 */
export function montantEcrivable(brut: unknown): MontantVerifie {
  if (typeof brut === "number") {
    // **`Number.isFinite` d'abord.** `NaN > MAX` est faux et `NaN < 0` aussi :
    // sans cette ligne, `NaN` traverserait les deux comparaisons suivantes et
    // arriverait en base — le contrôle serait vert sur le cas qu'il existe pour
    // attraper.
    if (!Number.isFinite(brut)) return { ok: false, raison: "Ce montant n'est pas un nombre." };
    return verifierNombre(brut);
  }

  if (typeof brut !== "string") return { ok: false, raison: "Ce montant n'est pas lisible." };

  const texte = brut.trim();
  if (texte === "") return { ok: false, raison: "Aucun montant n'a été donné." };

  /**
   * **Un format STRICT, et non `Number()`.**
   *
   * `Number()` accepte `"0x1F"`, `"1e9"`, `"  12  "` et `"Infinity"` : autant
   * de façons d'écrire un montant que personne n'a tapé. On lit donc
   * exactement ce qu'un montant est — des chiffres, une virgule ou un point,
   * au plus deux décimales — et l'on refuse le reste en le disant.
   *
   * L'espace des milliers et l'euro collé au chiffre sont admis : c'est ainsi
   * qu'un artisan écrit, et `montantSaisi` les accepte déjà côté écran.
   */
  const propre = texte.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(propre)) {
    // On distingue les décimales du reste : c'est le cas le plus probable, et
    // le refus doit dire quoi corriger.
    if (/^\d+([.,]\d{3,})$/.test(texte.replace(/[\s €]/g, ""))) {
      return { ok: false, raison: `« ${texte} » a plus de deux décimales : un euro n'en a que deux.` };
    }
    return { ok: false, raison: `« ${texte} » n'est pas un montant.` };
  }

  return verifierNombre(Number(propre));
}

function verifierNombre(n: number): MontantVerifie {
  if (n < 0) return { ok: false, raison: "Un montant ne peut pas être négatif." };
  if (n > MONTANT_MAXIMAL) {
    return {
      ok: false,
      raison: `${n.toLocaleString("fr-FR")} € dépasse ce qu'une ligne peut porter.`,
    };
  }
  // Deux décimales exactement : la colonne les tronquerait sinon en silence.
  const arrondi = Math.round(n * 100) / 100;
  if (arrondi !== n) return { ok: false, raison: "Un euro n'a que deux décimales." };
  return { ok: true, montant: arrondi.toFixed(2) };
}
