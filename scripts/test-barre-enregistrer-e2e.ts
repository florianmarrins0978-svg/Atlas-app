import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// LA BARRE D'ENREGISTREMENT N'EXISTE QUE S'IL Y A QUELQUE CHOSE À ENREGISTRER.
//
// **Ce que ce contrôle défend, et ce qu'il a coûté de ne pas l'avoir.**
//
// Sur « Devis & factures », la barre du bas était rendue **en permanence**,
// opaque, haute de 85 px — même quand elle ne disait que « Enregistré ✓ ». Le
// contenu passait dessous : sur le PREMIER écran, elle coupait « Moyens de
// paiement acceptés » en deux, son interrupteur compris. Mesuré au navigateur
// à 390 × 664 le 6 septembre 2026 : entre elle, la barre du bas et l'aperçu
// collé de l'allure, **392 px des 664 étaient pris**.
//
// Aucun test ne le voyait, et aucun ne pouvait : les suites de cet écran
// cliquent des réglages, elles ne mesurent pas ce qui recouvre quoi.
//
// **Elle ne servait qu'au message.** Tout le reste s'enregistre seul — les
// interrupteurs, l'allure, le format. Une barre permanente pour un bloc, qui
// recouvrait les cinq autres.
//
// **CE CONTRÔLE SAIT ÉCHOUER**, et c'est le seul moyen de le croire : rendre
// la barre en permanence — retirer la condition dans `DocumentsClient.tsx` —
// fait rougir le premier cas ; ne jamais la rendre fait rougir le second.
//
// Usage : npm run test:e2e -- --seulement barre-enregistrer

const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  // Sa mesure à lui : 390 × 664 (`PRODUCT.md`).
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const barre = page.locator('[data-atlas="barre-enregistrer"]');

  /**
   * **LES TROIS ÉCRANS, ET NON PLUS UN SEUL — 6 septembre 2026.**
   *
   * Cette barre était écrite TROIS FOIS : ici, dans « Mon entreprise » et dans
   * « Mon compte ». Le correctif du §264 n'avait donc atteint qu'un écran sur
   * trois, et rien dans le code ne le disait — c'est la faute du §263, en pire :
   * il n'y avait même pas de pièce partagée, il y avait trois jumelles.
   *
   * Éprouver le seul écran d'origine laisserait le défaut revenir par les deux
   * autres. On les parcourt donc tous les trois.
   */
  for (const [nom, url, attendre] of [
    ["Ce qui s'imprime", "/reglages/documents/conditions", "text=Durée de validité"],
    ["Mon message au client", "/reglages/documents/message", '[data-atlas="message-client"]'],
    ["Mon entreprise", "/reglages/identite", "text=Votre régime de TVA"],
    ["Mon compte", "/reglages/compte", "text=Mon compte"],
  ] as const) {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    // **Attendre la MISE EN PAGE, pas seulement le document.** Une boîte de zéro
    // pixel n'est pas un succès, c'est une mesure impossible (`CLAUDE.md` §5).
    await page.waitForSelector(attendre, { timeout: 30_000 });
    await page.waitForTimeout(500);

    await cas(`${nom} — rien à enregistrer, aucune barre ne mange l'écran`, async () => {
      assert.equal(await barre.count(), 0, "la barre est là alors qu'il n'y a rien à enregistrer");
    });
  }

  // **L'écran des messages, depuis le découpage du 7 septembre 2026.** Il y
  // en a trois ; on touche le premier, et la barre doit suffire pour tous.
  await page.goto(`${BASE}/reglages/documents/message`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="message-client"]', { timeout: 30_000 });
  await page.waitForTimeout(600);

  /**
   * **UN TROISIÈME CAS A ÉTÉ ÉCRIT, PUIS RETIRÉ — 6 septembre 2026.**
   *
   * Il devait vérifier qu'« aucun réglage n'est recouvert par une bande
   * collée ». Écrit d'abord comme « la ligne descend-elle plus bas que
   * 616 px ? », il rendait le MÊME verdict avec et sans la barre : une bande
   * posée par-dessus ne déplace rien, elle recouvre. Il ne mesurait donc rien.
   *
   * Réécrit sur le vrai recouvrement, il n'avait **plus rien à mesurer** : en
   * haut de cet écran, la seule bande restante est la barre de navigation, qui
   * est le cadre de tous les écrans. Et plus bas, la seule autre bande est
   * l'aperçu collé de l'allure — que le patron a CHOISI (sa réponse B du
   * 25 août) : un contrôle qui rougirait dessus accuserait sa décision.
   *
   * **On ne livre pas un contrôle qui ne peut pas mesurer.** Le recouvrement
   * est mesuré à la main, écrit dans `docs/lot-devis-et-factures.md` avec ses
   * chiffres — c'est plus honnête qu'un vert qui ne prouve rien
   * (`CLAUDE.md` §5).
   */


  await cas("dès qu'on touche au message, la barre revient et propose d'enregistrer", async () => {
    const cible = page.locator('[data-atlas="message-client"]').first();
    await cible.scrollIntoViewIfNeeded();
    await cible.click();
    await page.keyboard.type(" Merci.");
    await page.waitForTimeout(400);
    assert.equal(await barre.count(), 1, "le message a changé et rien ne propose de l'enregistrer");
    const mot = (await barre.locator("button").textContent())?.trim();
    assert.equal(mot, "Enregistrer", `le bouton dit « ${mot} » au lieu de « Enregistrer »`);
  });

  await navigateur.close();
  if (echecs > 0) {
    console.error(`\n❌ Barre d'enregistrement — ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ La barre d'enregistrement ne prend l'écran que quand elle sert.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
