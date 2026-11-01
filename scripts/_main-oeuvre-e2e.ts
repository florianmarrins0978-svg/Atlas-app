import type { Page } from "playwright";

/**
 * Poser, par la feuille « Main d'œuvre » du devis (planche du 1er novembre
 * 2026), une main d'œuvre d'UNE journée d'UN homme au prix donné : le montant
 * de la ligne vaut alors ce prix, et les suites qui comptaient sur « main
 * d'œuvre 500 € » gardent leur arithmétique. La feuille doit être ouverte.
 *
 * Écrit une fois pour les suites qui en ont besoin : deux boucles recopiées
 * divergent au premier remaniement de la feuille (`CLAUDE.md` §3).
 */
export async function poserUneJourneeA(page: Page, prix: string): Promise<void> {
  await page.locator('[data-atlas="feuille-mo"]').waitFor();
  const moinsHommes = page.locator('[data-atlas="mo-hommes-moins"]');
  while (await moinsHommes.isEnabled()) await moinsHommes.click();
  const duree = page.locator('[data-atlas="mo-duree"]');
  for (let essai = 0; essai < 400; essai++) {
    const lue = ((await duree.textContent()) ?? "").trim();
    if (lue === "1 journée") break;
    await page.click(lue.startsWith("½") ? '[data-atlas="mo-duree-plus"]' : '[data-atlas="mo-duree-moins"]');
  }
  await page.fill('[data-atlas="mo-tarif"]', prix);
  await page.click('[data-atlas="mo-valider"]');
}
