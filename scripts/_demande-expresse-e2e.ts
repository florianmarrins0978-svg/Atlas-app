import type { Page } from "playwright";

/**
 * Coche la demande expresse du client, SI la page la montre.
 *
 * Son choix 3A du 3 octobre 2026 : une date dans les 14 jours de rétractation
 * ne s'accepte plus sans elle (`enregistrerReponse`). Un client qui accepte
 * une date proche la coche ; une suite qui accepte au navigateur fait le même
 * geste, sans quoi elle rougirait sur un refus juste. Absente (date lointaine,
 * sous-traitance), il n'y a rien à cocher.
 */
export async function cocherLaDemandeExpresse(page: Page): Promise<void> {
  const caseDemande = page.locator('input[name="demarrageAnticipe"]');
  if ((await caseDemande.count()) > 0) await caseDemande.check();
}
