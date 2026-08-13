// Capture des deux pastilles « Mr » / « Mme », là où il les a demandées.
//
// **Le patron, le 13 août 2026 :** *« il faut intégrer une case
// monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable,
// on choisit au-dessus du nom. »*
//
// Ce que ce script rend, et qu'un contrôle ne peut pas dire : à quoi ça
// ressemble. La position et le comportement sont mesurés par
// `test-choix-civilite-e2e` ; ici on regarde.
//
// Trois images : l'écran de création au repos, le même avec « Mme » pris, et
// l'écran du devis — la seconde porte, celle qui corrige un client d'avant.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-choix-civilite.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-atlas="civilite-mme"]', { timeout: 40_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/civilite-au-repos.png` });

await page.locator('[data-atlas="civilite-mme"]').click();
await page.locator('input[placeholder="Bernard"]').fill("Roux");
await page.waitForTimeout(300);
await page.screenshot({ path: `${dossier}/civilite-mme-prise.png` });

// L'écran du devis : la seconde porte, celle qui corrige.
await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
await page.click('button:has-text("Créer le chantier")');
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = page.url().split("/").pop()!.split("?")[0];

await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-atlas="civilite-mme"]', { timeout: 40_000 });
await page.locator('[data-atlas="civilite-mme"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/civilite-sur-le-devis.png` });

// **Le script sait échouer**, et il nomme le défaut plutôt que l'écran.
if ((await page.locator('[data-atlas="civilite-mme"]').getAttribute("aria-pressed")) !== "true") {
  echecs.push("le devis ne rappelle pas le choix : la pastille y est éteinte alors que « Mme » a été pris");
}
// **Ce que cet écran montre, et ce qu'il ne montre pas.** Il est l'ATELIER du
// devis : le nom s'y saisit nu, dans son champ, et la civilité se prend à la
// pastille — les deux ne se recollent qu'à l'impression et à l'envoi. Chercher
// « Mme Roux » ici accuserait le produit d'un défaut qui n'en est pas un ;
// c'est `test-choix-civilite-e2e` qui suit le nom jusqu'au message et à la page
// de la cliente.
// Le nom vit dans un CHAMP : `innerText` ne rend pas la valeur d'un `input`,
// et chercher là accusait l'écran d'un nom absent qui s'y trouvait très bien.
const nomSaisi = await page.getByLabel("Nom du client").inputValue();
if (nomSaisi !== "Roux") {
  echecs.push(`le champ du nom porte « ${nomSaisi} » au lieu de « Roux »`);
}
const ecran = await page.locator("body").innerText();
if (/CIVILITÉ/i.test(ecran)) {
  echecs.push("l'étiquette « Civilité » est revenue sur l'écran du devis, qui est à l'image du papier");
}

console.log(`Captures dans ${dossier}/ :`);
console.log("  civilite-au-repos.png      l'écran de création, rien de pris");
console.log("  civilite-mme-prise.png     « Mme » choisi, au-dessus du nom");
console.log("  civilite-sur-le-devis.png  la seconde porte, pour corriger");

await navigateur.close();

if (echecs.length > 0) {
  console.error(`\n❌ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.error(`   • ${e}`);
  process.exit(1);
}
console.log("\n✅ Les deux pastilles sont au-dessus du nom, et le choix se relit sur le devis.");
