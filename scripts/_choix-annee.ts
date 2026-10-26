import type { Page } from "playwright";

/**
 * Mes dossiers : l'année se change avec deux flèches (planche du 25 octobre
 * 2026), plus avec un menu. On touche la flèche qui va vers l'année cherchée
 * jusqu'à la lire au milieu ; une année absente fait échouer, au lieu de
 * laisser la suite mesurer celle d'à côté.
 */
export async function allerALAnnee(page: Page, annee: number): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const lue = Number((await page.locator('[data-atlas="annee-choisie"]').innerText()).trim());
    if (lue === annee) return;
    const fleche = page.locator(`[data-atlas="${lue > annee ? "annee-d-avant" : "annee-d-apres"}"]`);
    if (await fleche.isDisabled()) break;
    await fleche.click();
  }
  throw new Error(`l'année ${annee} n'est pas proposée dans Mes dossiers`);
}
