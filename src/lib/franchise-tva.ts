/**
 * La franchise en base de TVA, et la phrase qu'elle impose.
 *
 * **Une seule lecture pour le devis et la facture** (`CLAUDE.md` §3). Elle
 * vivait dans `facture-pdf.ts` seul : le devis d'un compte en franchise partait
 * donc sans la mention, avec une colonne « TVA % » à 0 que rien n'expliquait
 * au client (relevé le 3 octobre 2026, `docs/lot-mentions-facture-devis.md`).
 */
export const MENTION_FRANCHISE = "TVA non applicable, art. 293 B du CGI.";

/**
 * Le document est-il sous franchise ?
 *
 * Le régime FIGÉ sur le document décide. Un document d'avant qu'il soit figé
 * (`null`) se lit à son taux : 0 % voulait dire franchise, c'est ce que la
 * facture faisait depuis la migration 0039, et les pièces déjà parties ne
 * changent pas.
 */
export function sousFranchise(
  regimeTva: "assujettie" | "franchise" | null | undefined,
  tauxTva: string | number | null | undefined
): boolean {
  if (regimeTva != null) return regimeTva === "franchise";
  return Number(tauxTva) === 0;
}
