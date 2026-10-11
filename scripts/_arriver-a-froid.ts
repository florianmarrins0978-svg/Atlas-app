import type { Page } from "playwright";

/**
 * Ouvrir un écran comme s'il était le PREMIER de l'onglet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette pièce existe — 9 septembre 2026.** Depuis que la flèche de
 * retour ramène à la page d'où l'on vient (`src/lib/journal-de-navigation.ts`),
 * une suite qui s'est connectée puis promenée a forcément un journal : elle ne
 * peut plus voir la sortie DÉCLARÉE d'un écran, celle qui sert quand il n'y a
 * pas de page d'avant — un signet, une notification ouverte à froid,
 * l'application relancée depuis l'écran d'accueil du téléphone.
 *
 * Ce sont ses règles du 17 et du 31 août 2026 qui vivent là, et elles ne
 * doivent pas cesser d'être éprouvées parce qu'un journal les couvre le reste
 * du temps.
 *
 * **Le journal est vidé, puis la page rechargée** : à l'arrivée, il ne porte
 * que l'écran où l'on est, donc aucune page d'avant. C'est exactement l'état
 * d'un onglet neuf, sans avoir à ouvrir un contexte et à se reconnecter — cinq
 * secondes par cas, et une connexion de plus contre la limite de débit.
 */
export async function arriverAFroid(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      window.sessionStorage.clear();
    } catch {
      // Rangement refusé : il n'y a alors aucun journal, ce qui est justement
      // l'état qu'on cherche.
      return;
    }
  });
  await page.reload({ waitUntil: "networkidle" });
}
