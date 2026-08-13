// Capture de la synthèse du devis — la carte que le patron a photographiée.
//
// **Pourquoi ce script existe.** Le 13 août 2026, il envoie la capture de son
// écran Devis : « CHEZ MARTINS » en tête, et deux lignes réunies par un tiret
// cadratin — « Chez Martins — 10 rues d'enfer rocheux ros 78 200 nantes la
// jolie », « Martins — 0679984514 ». Sa demande porte sur la PRÉSENTATION :
// rien de tout cela ne se lit dans un test, ça se regarde.
//
// Le contrôle qui mesure l'empilement est `test-synthese-devis-e2e.ts`. Celui-ci
// rend l'image, sur son écran à lui — un iPhone 13, 390 px.
//
// Le 13 août au soir il a changé le mot : « Mr. » et non « Monsieur ». La
// capture ne le recopie donc pas, elle le demande à la règle.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-synthese-devis.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

// Un nom NU, comme celui qu'il saisit : c'est ce cas-là qui produisait « Chez ».
const CLIENT = `Martins ${Date.now()}`;
const ADRESSE = "10 rue d'Enfer rocheux, 78200 Nantes la Jolie";

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="M. Bernard"]', CLIENT);
await page.fill('input[placeholder="06 12 34 56 78"]', "0679984514");
await page.getByPlaceholder("12 rue des Lilas, Nantes").fill(ADRESSE);
await page.click('button:has-text("Créer le chantier")');
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = page.url().split("/").pop()!.split("?")[0];

await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Total TTC", { timeout: 40_000 });
await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
await page.waitForTimeout(900);
await page.getByLabel("Description 1").fill("Taille d'une haie de laurier (20 ml)");
await page.getByLabel("Prix unitaire 1").fill("350");
await page.getByLabel("Description 1").click();
await page.waitForTimeout(1400);

await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-atlas="ligne-chantier"]', { timeout: 40_000 });
await page.waitForTimeout(600);

await page.screenshot({ path: `${dossier}/devis-synthese.png` });
await page.locator('[data-atlas="ligne-chantier"]').locator("..").screenshot({
  path: `${dossier}/devis-synthese-carte.png`,
});

// **Le script sait échouer**, et il nomme le défaut plutôt que l'écran.
const ecran = await page.locator("body").innerText();
if (new RegExp(`Chez\\s+${CLIENT}`, "i").test(ecran)) {
  echecs.push(`l'écran porte encore « Chez ${CLIENT} » — c'est le défaut de sa capture du 13 août`);
}
for (const repere of ["ligne-chantier", "ligne-client"]) {
  const texte = (await page.locator(`[data-atlas="${repere}"]`).innerText()).trim();
  if (texte.includes("—")) {
    echecs.push(`le tiret est toujours dans « ${repere} » : ${texte.replace(/\n/g, " ⏎ ")}`);
  }
}

console.log(`Captures dans ${dossier}/ :`);
console.log("  devis-synthese.png        l'écran entier, sur son iPhone");
console.log("  devis-synthese-carte.png  la carte seule — chantier, puis client");

await navigateur.close();

if (echecs.length > 0) {
  console.error(`\n❌ ${echecs.length} défaut(s) retrouvé(s) :`);
  for (const e of echecs) console.error(`   • ${e}`);
  process.exit(1);
}
console.log("\n✅ Le nom est en tête, le détail dessous, sans tiret.");
