import type { Page } from "playwright";

/**
 * Créer un chantier depuis la fiche client, et rendre son identifiant.
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
 * **Ce qu'elle garde de l'ancien geste :** on repart avec un chantier créé.
 * Ce qu'elle change : le chemin, qui passe désormais par le devis — c'est là
 * que mène le seul bouton de l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **ELLE N'OUVRE PLUS LA FICHE DU CHANTIER — 4 septembre 2026.**
 *
 * Cet écran est retiré (`ARCHITECTURE.md` §254), et son adresse ne rend plus
 * qu'une redirection. La suivre coûtait un aller-retour à chacune des
 * quatre-vingt-deux suites qui passent par ici, pour arriver sur un écran
 * qu'aucune ne demandait : elles réclament un chantier, pas une page.
 *
 * **Le devis est laissé ouvert**, puisque c'est là que le bouton dépose. Une
 * suite qui veut un autre écran y va elle-même, par son adresse — c'est déjà
 * ce que font les quatre-vingts autres.
 *
 * **Elle ne remplace PAS un contrôle du parcours réel.** Ce que le patron fait,
 * lui, est éprouvé là où c'est son sujet : `test-nouveau-chantier-e2e.ts` pour
 * l'écran, et les suites de l'anneau pour la dictée.
 */
export async function creerPuisFiche(page: Page, _base = "http://localhost:3000"): Promise<string> {
  await page.click('[data-atlas="action-ecrire"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 30_000 });

  const id = page.url().match(/\/chantiers\/([0-9a-f-]{36})/)?.[1];
  if (!id) throw new Error(`création : l'adresse n'annonce aucun chantier — ${page.url()}`);

  // Le paramètre survit à son usage : quatre-vingt-deux suites le passent, et
  // les corriger toutes pour une adresse qu'on ne visite plus aurait fait
  // quatre-vingt-deux diffs pour aucun changement de comportement.
  return id;
}
