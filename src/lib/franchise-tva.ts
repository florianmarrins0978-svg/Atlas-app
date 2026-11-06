/**
 * La franchise en base de TVA, et la phrase qu'elle impose.
 *
 * **Une seule lecture pour le devis et la facture** (`CLAUDE.md` §3). Elle
 * vivait dans `facture-pdf.ts` seul : le devis d'un compte en franchise partait
 * donc sans la mention, avec une colonne « TVA % » à 0 que rien n'expliquait
 * au client (relevé le 3 octobre 2026, `docs/lot-mentions-facture-devis.md`).
 */
/**
 * Le jour où la franchise change d'article, et la phrase avec.
 *
 * **Vérifié le 6 novembre 2026** (sa consigne : « si t'as vérifié, change la
 * phrase tout de suite ») : l'article L. 233-3 du code des impositions sur les
 * biens et services, créé par l'ordonnance n° 2026-671 du 27 juillet 2026, est
 * en vigueur le 1er janvier 2027 (Légifrance, LEGIARTI000054524584). Le citer
 * plus tôt, c'est citer un article qui n'existe pas encore ; la phrase change
 * donc d'elle-même, au jour de la pièce. Les renvois au CGI restent permis sur
 * les factures jusqu'au 31 décembre 2027 (BOFiP, BOI-RES-TVA-000253, version
 * du 7 octobre 2026) : une pièce de 2026 rééditée en 2027 garde la sienne.
 * La formule nouvelle est celle d'impots.gouv.fr (« En tant que
 * micro-entrepreneur, puis-je être redevable de la TVA ? », lue le même jour).
 */
export const PASSAGE_AU_CIBS = "2027-01-01";

/** La phrase de la franchise au jour d'une pièce (« AAAA-MM-JJ », à Paris). */
export function mentionFranchise(jour: string): string {
  return jour >= PASSAGE_AU_CIBS
    ? "TVA non applicable, article L. 233-3 du code des impositions sur les biens et services (CIBS)."
    : "TVA non applicable, art. 293 B du CGI.";
}

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
