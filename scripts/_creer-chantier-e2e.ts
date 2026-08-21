import type { Page } from "playwright";

/**
 * Créer un chantier depuis la fiche client, puis ouvrir SA FICHE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction existe — le 21 août 2026.**
 *
 * La fiche client n'a plus qu'un bouton, à sa demande : *« garde un seul
 * bouton, garde je rédige mon devis »*. « Je dicte mon devis » a disparu avec
 * l'arrivée de l'anneau sur cet écran — on n'a plus besoin d'aller ailleurs
 * pour dicter.
 *
 * Or **soixante-treize suites** passaient par ce bouton, non pas pour dicter,
 * mais parce que c'était le chemin le plus court vers la fiche d'un chantier
 * neuf. Les réécrire une à une aurait produit soixante-treize façons de faire
 * la même chose ; la première divergence serait passée inaperçue.
 *
 * **Ce qu'elle garde de l'ancien geste :** on repart avec un chantier créé et
 * la fiche ouverte. Ce qu'elle change : le chemin, qui passe désormais par le
 * devis — c'est là que mène le seul bouton de l'écran.
 *
 * **Elle ne remplace PAS un contrôle du parcours réel.** Ce que le patron fait,
 * lui, est éprouvé là où c'est son sujet : `test-nouveau-chantier-e2e.ts` pour
 * l'écran, et les suites de l'anneau pour la dictée.
 */
export async function creerPuisFiche(page: Page, base = "http://localhost:3000"): Promise<string> {
  await page.click('[data-atlas="action-ecrire"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 30_000 });

  const id = page.url().match(/\/chantiers\/([0-9a-f-]{36})/)?.[1];
  if (!id) throw new Error(`création : l'adresse n'annonce aucun chantier — ${page.url()}`);

  await page.goto(`${base}/chantiers/${id}`, { waitUntil: "networkidle" });
  return id;
}
