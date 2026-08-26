// OÙ APPUYER POUR SORTIR UN CHANTIER DU PLANNING — deux captures, pas une
// description.
//
// Sa question du 25 août 2026 : *« depuis quelle fiche ? »*, après qu'on lui a
// dit que « Créer la facture » termine le chantier tout de suite. Une phrase ne
// montre pas où est un bouton ; une image, si (`CLAUDE.md` §3 ter).
//
// Le parcours est le VRAI : un chantier planifié AUJOURD'HUI, devis chiffré et
// envoyé — sans quoi le bouton n'existe pas, et la capture mentirait.
//
// Usage : npx tsx scripts/capture-ou-est-creer-la-facture.mts <dossier>
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { pool } from "../src/server/db/client";
import { jourIso } from "../src/lib/jour";

const dossier = process.argv[2] ?? "/tmp/captures";
mkdirSync(dossier, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="Bernard"]', "Mr. Eric");
const chantierId = await creerPuisFiche(page, BASE);

// Une ligne chiffrée, puis le devis part : « Créer la facture » exige un devis
// réellement envoyé (`terminerChantier`), et le bouton ne s'affiche qu'une fois
// le chantier PLANIFIÉ.
await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Total TTC", { timeout: 40_000 });
await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
await page.waitForTimeout(1000);
await page.getByLabel("Description 1").fill("Taille de haie");
await page.getByLabel("Prix unitaire 1").fill("450");
await page.getByLabel("Description 1").click();
await page.waitForTimeout(1200);

// Planifié AUJOURD'HUI : c'est exactement le cas de sa capture — la journée est
// faite, le chantier est encore au planning jusqu'à minuit.
await pool.query(`UPDATE chantiers SET date_planifiee = $1 WHERE id = $2`, [jourIso(new Date()), chantierId]);

/** Un halo posé PAR NOUS sur la capture — il n'existe pas dans l'application. */
const entourer = (selecteur: string) =>
  page.evaluate((s) => {
    const e = document.querySelector(s) as HTMLElement | null;
    if (!e) return false;
    e.style.outline = "3px solid #c0392b";
    e.style.outlineOffset = "4px";
    e.style.borderRadius = "6px";
    return true;
  }, selecteur);

// ─── 1. Le planning : la ligne du chantier ──────────────────────────────────
await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// La liste des planifiés vit sous le calendrier : sans descendre, la capture
// montrerait le mois et pas la ligne qu'il doit toucher.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);
const ligne = await page.evaluate((id: string) => {
  // **Le nom n'est PAS dans le lien** : la ligne des planifiés ne met dans son
  // `<a>` que le chevron de droite. On entoure donc la RANGÉE — le parent qui
  // porte le nom —, sinon le halo se poserait sur un « › » de six pixels.
  const a = document.querySelector(`a[href="/chantiers/${id}"]`);
  let rangee = a?.parentElement ?? null;
  while (rangee && !rangee.textContent?.includes("Eric")) rangee = rangee.parentElement;
  if (!rangee) return false;
  const e = rangee as HTMLElement;
  e.scrollIntoView({ block: "center" });
  e.style.outline = "3px solid #c0392b";
  e.style.outlineOffset = "6px";
  e.style.borderRadius = "6px";
  return true;
}, chantierId);
if (!ligne) {
  console.error("✗ la ligne du chantier n'a pas été trouvée au planning : la capture ne montrerait rien.");
  console.error(
    (await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => `${a.getAttribute("href")} :: ${a.textContent?.trim().slice(0, 50)}`))).join("\n")
  );
  await navigateur.close();
  await pool.end();
  process.exit(1);
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/1-planning-la-ligne.png` });

// ─── 2. La fiche : le bouton ────────────────────────────────────────────────
await page.goto(`${BASE}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
const bouton = page.getByRole("link", { name: /Créer la facture/i }).first();
if ((await bouton.count()) === 0) {
  console.error("✗ Le bouton « Créer la facture » est ABSENT : la capture ne montrerait rien.");
  await navigateur.close();
  await pool.end();
  process.exit(1);
}
await entourer(`a[href="/chantiers/${chantierId}/facture"]`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${dossier}/2-fiche-le-bouton.png` });

console.log(`Captures dans ${dossier}`);
await navigateur.close();
await pool.end();
