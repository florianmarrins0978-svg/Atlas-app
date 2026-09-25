import assert from "node:assert/strict";
import type { CDPSession, Page } from "playwright";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// GLISSER VERS LA DROITE POUR REVENIR : sa « B » du 25 septembre 2026
// (`appli/glisser-pour-revenir.html`, `src/components/atlas/GesteRetour.tsx`).
//
// Le doigt est joué pour de bon (des touchers, pas des clics), parce que c'est
// par là qu'il arrive. Ce que la suite tient :
//   - de n'importe où sur la page, glisser vers la droite recule d'UN écran,
//     exactement où mène la flèche ;
//   - faire défiler, glisser trop peu, ou partir du bord (laissé à Safari) ne
//     recule pas ;
//   - un onglet du bas, sans flèche, ne recule pas ;
//   - une ligne dont « Retirer » est découvert garde son geste ; fermée, elle
//     laisse reculer.
//
// **Le recul de Chromium est coupé** : sur un glissement de côté, le
// navigateur de la suite recule de lui-même, ce que Safari ne fait pas au
// milieu d'une page. Sans cela, la suite mesurerait son geste à lui, pas le
// nôtre (c'est ainsi qu'un double recul a été vu, puis corrigé, le 25 septembre).

const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur({
    args: ["--overscroll-history-navigation=0", "--disable-features=OverscrollHistoryNavigation"],
  });
  const contexte = await navigateur.newContext({ hasTouch: true, isMobile: true });
  const page = await contexte.newPage();
  const pannes: string[] = [];
  page.on("pageerror", (e) => pannes.push(e.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const cdp = await contexte.newCDPSession(page);
  const chemin = () => new URL(page.url()).pathname;

  // ── Le parcours des réglages : trois écrans empilés par leurs liens ──
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.click('a[href="/reglages/documents"]');
  await page.waitForURL("**/reglages/documents");
  await page.click('a[href="/reglages/documents/numero"]');
  await page.waitForURL("**/reglages/documents/numero");
  await page.waitForLoadState("networkidle");

  await glisser(page, cdp, 180, 300, 190, 600);
  assert.equal(chemin(), "/reglages/documents/numero", "faire défiler ne doit pas reculer");

  await glisser(page, cdp, 120, 300, 170, 302, 40);
  assert.equal(chemin(), "/reglages/documents/numero", "un geste court et lent se rend");

  await glisser(page, cdp, 8, 300, 300, 302);
  assert.equal(chemin(), "/reglages/documents/numero", "le bord est laissé au navigateur, dans un onglet");

  await glisser(page, cdp, 100, 300, 340, 305);
  await page.waitForURL("**/reglages/documents");
  assert.equal(chemin(), "/reglages/documents", "du milieu de la page, on recule d'UN écran");
  assert.equal(
    await page.evaluate(() => document.querySelector("main")?.style.transform ?? ""),
    "",
    "la page doit être revenue à sa place"
  );

  await glisser(page, cdp, 100, 300, 340, 305);
  await page.waitForURL("**/reglages");
  await glisser(page, cdp, 100, 300, 340, 305);
  assert.equal(chemin(), "/reglages", "un onglet du bas n'a pas de flèche, donc pas de geste");

  // ── Une ligne qu'on glisse pour retirer ──
  const ligne = await ouvrirDesPrix(page);
  await ligne.evaluate((e) => e.scrollIntoView({ block: "center" }));
  const cadre = await ligne.boundingBox();
  assert.ok(cadre, "la ligne des prix doit être à l'écran");
  const y = cadre.y + cadre.height / 2;
  const prix = chemin();

  await ligne.evaluate((e) => {
    e.scrollLeft = e.scrollWidth;
  });
  await page.waitForTimeout(400);
  assert.ok((await ligne.evaluate((e) => e.scrollLeft)) > 0, "la ligne doit être ouverte pour ce cas");
  await glisser(page, cdp, 140, y, 340, y + 2);
  assert.equal(chemin(), prix, "une ligne dont « Retirer » est découvert garde son geste");

  await ligne.evaluate((e) => {
    e.scrollLeft = 0;
  });
  await page.waitForTimeout(400);
  await glisser(page, cdp, 140, y, 340, y + 2);
  await page.waitForURL((u) => u.pathname !== prix, { timeout: 15000 });

  assert.deepEqual(pannes, [], "aucune erreur dans la page");
  await navigateur.close();
  console.log("✅ Glisser vers la droite pour revenir : tous les cas tiennent.");
}

async function glisser(page: Page, cdp: CDPSession, x0: number, y0: number, x1: number, y1: number, attente = 16) {
  const pas = 12;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pas; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + ((x1 - x0) * i) / pas, y: y0 + ((y1 - y0) * i) / pas }],
    });
    await page.waitForTimeout(attente);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
}

/**
 * Les prix de « Reprise de toiture », du jeu de démonstration : ses lignes se
 * glissent pour retirer. Lu en base, parce que l'accueil ne montre pas un
 * chantier dont le devis est parti.
 */
async function ouvrirDesPrix(page: Page) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ id: string }>(
    `SELECT c.id FROM chantiers c
      WHERE c.nom = 'Reprise de toiture' LIMIT 1`
  );
  await pool.end();
  assert.ok(rows[0], "le chantier « Reprise de toiture » est absent : la base n'est pas amorcée");
  await page.goto(`${BASE}/chantiers/${rows[0].id}/prix`, { waitUntil: "networkidle" });
  const ligne = page.locator(".atlas-glisse").first();
  assert.ok((await ligne.count()) > 0, "les prix de « Reprise de toiture » n'ont plus de ligne à retirer");
  return ligne;
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
