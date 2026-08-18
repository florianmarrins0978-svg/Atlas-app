// Les deux boutons du devis, PHOTOGRAPHIÉS sur l'application.
//
// **Pourquoi une photo, et pas seulement des suites vertes.** Cinq défauts de
// ce dépôt sont sortis d'une image et d'aucun test. Les suites de ce lot disent
// que chaque bouton mène au bon endroit et que les libellés sont les siens ;
// aucune ne dit ce que DONNENT deux aplats verts empilés en bas d'un écran de
// téléphone — c'est précisément la réserve écrite sur la planche, et elle ne se
// juge qu'à l'œil.
//
// Deux images : l'écran de création, et le même écran en reprise (où un seul
// bouton « Enregistrer » subsiste, ce qui est une décision et non un oubli).
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-deux-boutons-devis.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

// L'écran de création, rempli comme sa propre capture du 18 août.
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="Bernard"]', "Bernard");
await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
await page.fill('input[placeholder="bernard@exemple.fr"]', "bernard@exemple.fr");
await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', "12 rue des Lilas, Nantes");
// La liste de suggestions d'adresse recouvre les boutons tant qu'elle est
// ouverte : la photographier ainsi montrerait un écran que personne ne voit au
// moment de choisir.
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
await page.screenshot({ path: `${dossier}/creation-deux-boutons.png`, fullPage: true });

// Le même écran en reprise : un seul bouton, et c'est voulu.
const chantierId: string = await (async () => {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  return page.url().split("/").pop()!.split("?")[0];
})();
await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${dossier}/reprise-un-bouton.png`, fullPage: true });

console.log(`Deux images écrites dans ${dossier}`);

await navigateur.close();
await pool.end();
