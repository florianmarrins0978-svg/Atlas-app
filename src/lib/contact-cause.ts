/**
 * L'ADRESSE OÙ L'ON ÉCRIT À CAUSE, celle des conditions générales (article 1)
 * et des mentions légales du site.
 *
 * **Provisoire**, sa décision du 24 novembre 2026 : *« garde
 * florian.martins0978@laposte.net et on changera ensuite »*, le temps qu'OVH
 * lui ouvre l'adresse de son domaine. Une seule ligne à changer ce jour-là
 * pour l'appli (les deux pages publiées se changent avec elle).
 */
export const COURRIEL_DE_CAUSE = "florian.martins0978@laposte.net";

/** Un message à Cause, prêt à partir : l'objet et le corps sont dans l'adresse. */
export function ecrireACause(objet: string, corps: string): string {
  return `mailto:${COURRIEL_DE_CAUSE}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
}
