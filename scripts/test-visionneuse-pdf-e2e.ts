import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";
import { CHEMIN_VISIONNEUSE } from "../src/lib/visionneuse-pdf";

// **« Quand j'ouvre le pdf pour voir la facture j'ai pas de touche retour. »**
//
// Sa capture du 11 septembre 2026, prise sur son iPhone : « Voir la facture en
// PDF » remettait le document à Safari dans un onglet neuf, sans en-tête ni
// flèche. Le PDF se peint désormais DANS l'application (`/documents/pdf`).
//
// Cette suite joue SON geste, pas la fonction qu'on vient d'écrire
// (`CLAUDE.md` §5 quater) : depuis l'écran du devis, appuyer sur « Aperçu du
// PDF », et vérifier
//
//   1. qu'on reste dans l'application — l'adresse est celle de la visionneuse,
//      et aucun onglet ne s'est ouvert ;
//   2. que l'en-tête porte le titre du document et SA flèche de retour ;
//   3. que le document est réellement PEINT : au moins une page, et d'une
//      largeur non nulle — un contrôle qui mesure zéro ne mesure rien
//      (`CLAUDE.md` §5) ;
//   4. que la flèche ramène à l'écran du devis ;
//   5. qu'une adresse étrangère ne se peint pas.
//
// Sur le gabarit de son téléphone : c'est là que le défaut a été vu.

const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Client visionneuse ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15000 });

  await page.goto(`${BASE}/chantiers/${idChantier}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Taille des graminées");
  await champs.nth(1).fill("250.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(400);

  const ecranDuDevis = `${BASE}/chantiers/${idChantier}/devis-complet`;
  await page.goto(ecranDuDevis, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Aperçu du PDF", { timeout: 30000 });

  // ─── 1. L'appui reste dans l'application ──────────────────────────────────
  const ongletsAvant = contexte.pages().length;
  await page.click("text=Aperçu du PDF");
  await page.waitForURL((u) => u.pathname === CHEMIN_VISIONNEUSE, { timeout: 30000 });
  assert.equal(contexte.pages().length, ongletsAvant, "un onglet s'est ouvert : il n'y a pas de flèche là-bas");
  console.log("  ✓ « Aperçu du PDF » ouvre la visionneuse de l'application, sans onglet");

  // ─── 2. L'en-tête, avec le titre et la flèche ─────────────────────────────
  await page.waitForSelector("h1", { timeout: 15000 });
  const titre = (await page.locator("h1").first().innerText()).trim();
  assert.match(titre, /^[0-9]{4}-[0-9]+$/, `l'en-tête dit « ${titre} » au lieu du numéro du devis`);
  assert.ok(await page.getByText("Devis", { exact: true }).count(), "le surtitre « Devis » manque");
  const fleche = page.locator('a[aria-label="Retour"]');
  assert.equal(await fleche.count(), 1, "aucune flèche de retour sur la visionneuse");
  console.log(`  ✓ l'en-tête porte « Devis ${titre} » et sa flèche`);

  // ─── 3. Le document est peint, et pas à zéro ──────────────────────────────
  await page.waitForSelector('canvas[data-atlas="page-pdf"], [data-atlas="refus-pdf"]', { timeout: 60000 });
  const refus = page.locator('[data-atlas="refus-pdf"]');
  assert.equal(await refus.count(), 0, `la visionneuse affiche un refus : « ${(await refus.allInnerTexts()).join(" · ")} »`);
  const pages = page.locator('canvas[data-atlas="page-pdf"]');
  const nombre = await pages.count();
  assert.ok(nombre >= 1, "aucune page peinte");
  const boite = await pages.first().boundingBox();
  assert.ok(boite && boite.width > 100 && boite.height > 100, `la page mesure ${JSON.stringify(boite)} : rien n'est peint`);
  // Un pixel qui n'est pas blanc quelque part sur la première page : la toile
  // a une taille, encore faut-il qu'elle porte de l'encre.
  const encre = await pages.first().evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let sombres = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 3] > 0) sombres++;
    return sombres;
  });
  assert.ok(encre > 100, `la première page ne porte que ${encre} pixel(s) d'encre : elle est blanche`);
  // La capture, à regarder : c'est elle qui attrape un libellé collé ou une
  // page qui déborde, jamais un vert (`CLAUDE.md` §5).
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/visionneuse-pdf.png", fullPage: true });
  console.log(`  ✓ ${nombre} page(s) peinte(s), ${Math.round(boite!.width)} px de large, ${encre} pixels d'encre`);

  // ─── 4. La flèche ramène au devis ─────────────────────────────────────────
  await fleche.click();
  await page.waitForURL((u) => u.pathname.endsWith("/devis-complet"), { timeout: 15000 });
  console.log("  ✓ la flèche ramène à l'écran du devis");

  // ─── 5. Une adresse étrangère ne se peint pas ─────────────────────────────
  // Le code HTTP ne se lit pas : `loading.tsx` fait partir la coquille avant
  // que la page ne refuse, et la réponse porte 200. Ce qui compte est ce qui
  // est À L'ÉCRAN : la page introuvable de Next, aucune toile, aucun appel
  // vers l'adresse étrangère.
  const appelsDehors: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://ailleurs.example")) appelsDehors.push(r.url());
  });
  await page.goto(
    `${BASE}${CHEMIN_VISIONNEUSE}?fichier=${encodeURIComponent("https://ailleurs.example/x/pdf")}&titre=x`,
    { waitUntil: "networkidle" }
  );
  assert.equal(await page.locator('canvas[data-atlas="page-pdf"]').count(), 0, "une adresse étrangère a été peinte");
  assert.equal(await page.locator("h1").filter({ hasText: "x" }).count(), 0, "l'en-tête de la visionneuse s'est ouvert sur une adresse étrangère");
  assert.match(await page.locator("body").innerText(), /404/, "la page introuvable ne s'affiche pas");
  assert.deepEqual(appelsDehors, [], `le navigateur a appelé ${appelsDehors.join(", ")}`);
  console.log("  ✓ une adresse étrangère ne se peint pas");

  await navigateur.close();
  console.log("\n✅ test-visionneuse-pdf-e2e : la facture se regarde dans l'application, avec sa flèche.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
