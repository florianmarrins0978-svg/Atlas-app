import type { Page } from "playwright";

/**
 * OUVRIR LE TIROIR DU BAS DU PLANNING — celui qui porte « Sans date » et
 * « En attente du client ».
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce geste existe depuis le 3 septembre 2026** (`ARCHITECTURE.md`
 * §243). Ces deux listes vivaient au bas d'un écran qui compte déjà le mois, la
 * journée ouverte et la semaine des planifiés : poser un chantier — le geste le
 * plus actif du planning — était le plus loin du pouce. Elles sont désormais
 * clouées au bord bas, sous une poignée qui les nomme et les compte.
 *
 * **Les suites rejouent donc son geste — un appui de plus — au lieu d'un écran
 * qui n'existe plus** (`CLAUDE.md` §5 bis). Ce qu'elles fixent, c'est la RÈGLE :
 * un chantier sans date reçoit son jour depuis cette liste. Réclamer qu'elle
 * soit visible sans un geste rendrait son écran impossible à changer.
 *
 * **Écrit ICI et pas dans trois suites.** Trois copies auraient divergé au
 * premier changement de la poignée, et deux d'entre elles seraient restées
 * vertes en n'ouvrant rien (`CLAUDE.md` §3).
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Idempotent, et ce n'est pas un confort** : la poignée BASCULE. Appelée deux
 * fois, une version naïve refermerait le tiroir qu'on s'apprête à mesurer, et
 * le contrôle accuserait le produit d'un défaut qu'il vient de fabriquer.
 *
 * **Muet quand le tiroir n'existe pas** : il n'est pas rendu du tout quand il
 * n'a rien à porter (sa règle du 23 août 2026), ni pour un salarié. Une
 * exception ici ferait rougir les suites qui vérifient justement son absence.
 */
export async function ouvrirLeTiroirDuPlanning(page: Page): Promise<boolean> {
  const poignee = page.locator('[data-atlas="poignee-tiroir"]');
  if ((await poignee.count()) === 0) return false;
  if ((await poignee.getAttribute("aria-expanded")) === "true") return true;
  await poignee.click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-atlas="poignee-tiroir"]')?.getAttribute("aria-expanded") ===
      "true",
    undefined,
    { timeout: 5_000 }
  );
  // **Le dépliage dure 420 ms.** Mesurer pendant l'animation rend des hauteurs
  // qui ne sont celles de rien — le défaut du 15 août 2026, où une boîte de
  // zéro pixel rendait un vert (`CLAUDE.md` §5).
  await page.waitForTimeout(450);
  return true;
}

/**
 * REFERMER LE TIROIR DU BAS — pour éprouver ce qu'il recouvre.
 *
 * **Il est cloué au bord bas, en `fixed`.** Ouvert, il passe DEVANT le bas de
 * la carte du jour : le « + Ajouter un chantier » d'une journée qui tombe
 * dessous n'est alors plus visable, et le clic échoue au bout de
 * quarante-cinq secondes en accusant le produit d'un défaut que le décor vient
 * de fabriquer. Vu le 9 septembre 2026, dans la batterie seulement — la suite
 * jouée seule tombait sur un jour placé plus haut, et passait.
 *
 * Une suite qui éprouve le chemin PAR LA CARTE DU JOUR commence donc par
 * refermer ce que la précédente a ouvert. Idempotent, comme son jumeau : la
 * poignée bascule.
 */
export async function fermerLeTiroirDuPlanning(page: Page): Promise<void> {
  const poignee = page.locator('[data-atlas="poignee-tiroir"]');
  if ((await poignee.count()) === 0) return;
  if ((await poignee.getAttribute("aria-expanded")) !== "true") return;
  await poignee.click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-atlas="poignee-tiroir"]')?.getAttribute("aria-expanded") !==
      "true",
    undefined,
    { timeout: 5_000 }
  );
  // Le repli dure 420 ms : mesurer pendant l'animation rend des boîtes qui ne
  // sont celles de rien (`CLAUDE.md` §5).
  await page.waitForTimeout(450);
}
