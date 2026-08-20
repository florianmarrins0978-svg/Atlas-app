import assert from "node:assert/strict";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

/**
 * Le message du devis figé mène quelque part.
 *
 * **Le patron, le 13 août 2026, capture à l'appui :** *« le message dit de
 * consulter la case devis mais aucune case devis existe »*.
 *
 * Il avait raison sur le fond. L'écran Devis existe bien
 * (`/chantiers/[id]/export`), mais il vit dans le **tiroir** de la fiche du
 * chantier : depuis la page du devis, **aucune porte n'y menait**. La phrase
 * décrivait un itinéraire à reconstituer seul — exactement ce que ce dépôt
 * s'interdit, puisque renvoyer quelqu'un vers une porte qu'il ne voit pas coûte
 * plus cher que de se taire.
 *
 * Et deux écrans s'appellent « Devis » de son point de vue : celui qu'il
 * regarde, et celui où l'on corrige. « Ouvrez l'écran Devis » était donc
 * introuvable ET ambigu.
 *
 * Ce que cette suite tient :
 *
 *   1. sur un devis PARTI, le message est là — sans lui, toucher un prix ne
 *      ferait rien et rien ne dirait pourquoi ;
 *   2. **il porte un vrai lien**, et ce lien mène à l'écran Devis. C'est le
 *      cœur : une phrase qui décrit un chemin se dégrade en silence, un lien
 *      qui mène ailleurs se voit tout de suite ;
 *   3. il ne dit plus « ouvrez l'écran Devis » — les mots qu'il a signalés ;
 *   4. sur un devis PAS ENCORE parti, rien de tout cela n'apparaît : la page
 *      s'écrit, et un message d'interdiction y serait faux.
 */
const BASE = "http://localhost:3000";

async function seConnecter(contexte: BrowserContext): Promise<Page> {
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost:3000\/(?!login)/, { timeout: 30_000 });
  return page;
}

/** Un chantier neuf, son devis chiffré — et parti chez le client si demandé. */
async function chantierAvecDevis(page: Page, envoyer: boolean): Promise<string> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Porte ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const url = page.url();

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Taille haie de laurier");
  await champs.nth(1).fill("700.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(600);

  if (envoyer) {
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 30_000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForSelector("text=Devis prêt pour", { timeout: 30_000 });
  }
  return url;
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await seConnecter(contexte);

  try {
    // ── Le devis PARTI : le message, et sa porte ─────────────────────────
    const url = await chantierAvecDevis(page, true);
    const chantierId = url.split("/").pop()!;
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    const message = page.locator("text=/il ne se modifie plus/");
    await message.first().waitFor({ state: "visible", timeout: 20_000 });
    console.log("  ✓ le devis parti dit qu'il ne se modifie plus");

    // **Le cœur du contrôle.** Une phrase qui décrit un chemin se dégrade en
    // silence le jour où le chemin bouge ; un lien, lui, se voit.
    const porte = page.getByRole("link", { name: /corriger/i });
    assert.equal(
      await porte.count(),
      1,
      "Le message ne porte aucun lien : il décrit de nouveau un itinéraire que le patron doit reconstituer seul — le défaut du 13 août."
    );
    assert.equal(
      await porte.getAttribute("href"),
      `/chantiers/${chantierId}/export`,
      "Le lien ne mène pas à l'écran Devis."
    );
    console.log("  ✓ il porte un lien, et ce lien vise l'écran Devis");

    // ── Les mots qu'il a signalés ont disparu ────────────────────────────
    assert.equal(
      await page.locator("text=/ouvrez l'écran Devis/i").count(),
      0,
      "Le message renvoie encore vers « l'écran Devis » : c'est la formulation que le patron a signalée comme introuvable, et deux écrans portent ce nom."
    );
    console.log("  ✓ il ne renvoie plus vers un nom d'écran introuvable");

    // ── Et la porte s'ouvre pour de bon ──────────────────────────────────
    await porte.click();
    await page.waitForURL(`${BASE}/chantiers/${chantierId}/devis-complet`, { timeout: 30_000 });
    console.log("  ✓ elle s'ouvre : on arrive sur l'écran Devis");

    // ── Le devis PAS ENCORE parti : rien de tout cela ────────────────────
    const brouillon = await chantierAvecDevis(page, false);
    await page.goto(`${brouillon}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=/Devis n/i", { timeout: 20_000 });
    assert.equal(
      await page.locator("text=/il ne se modifie plus/").count(),
      0,
      "Un devis qui n'est pas encore parti s'annonce comme figé : le patron croirait ne pas pouvoir l'écrire."
    );
    console.log("  ✓ un devis pas encore parti ne s'annonce pas figé");

    console.log("✅ Le message du devis figé est devenu la porte.");
  } finally {
    await contexte.close();
    await navigateur.close();
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
