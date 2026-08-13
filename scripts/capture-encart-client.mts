// Capture de la page du CLIENT — l'encart qui l'invite à laisser un mot.
//
// **Le patron, le 13 août 2026 :** *« écris une petite phrase sur l'encart pour
// laisser un mot, qu'il sache qu'il peut le faire »*. Ce qu'il demande ne se
// lit pas dans un test : ça se regarde. La suite qui mesure la position est
// `test-devis-client-e2e` ; celle-ci rend l'image.
//
// Elle imprime aussi **le message tout prêt tel qu'il partira** — « Bonjour
// Mr. Martins », « vous pouvez en proposer une autre » — parce que c'est le
// seul texte que le client voit avant d'ouvrir le devis, et qu'aucune capture
// ne le montrait jusqu'ici.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { composerMessageClient } from "../src/lib/message-client";
import { avecCivilite } from "../src/lib/civilite";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-encart-client.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

const CLIENT = `Martins ${Date.now()}`;

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="Bernard"]', CLIENT);
await page.fill('input[placeholder="06 12 34 56 78"]', "0679984514");
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
await page.click("text=Envoyer au client");
await page.getByRole("button", { name: /Envoyer le devis/i }).click();
await page.waitForTimeout(3500);

const { rows } = await pool.query(
  `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
  [chantierId]
);
if (!rows[0]) {
  console.error("aucun envoi : le devis n'est pas parti, rien à capturer");
  await navigateur.close();
  await pool.end();
  process.exit(1);
}

// ─── La page du client ───────────────────────────────────────────────────────
await page.goto(`${BASE}/devis/${rows[0].jeton}`, { waitUntil: "networkidle" });
await page.waitForSelector("#precision", { timeout: 30_000 });
await page.locator("#precision").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/client-encart.png` });

const invite = page.locator("text=/vous pouvez laisser un mot/i");
if ((await invite.count()) === 0) {
  echecs.push("aucune phrase n'invite le client à écrire — c'est ce qu'il a demandé le 13 août");
}

// **La page nomme le client comme le message qui l'y a mené.** Il lit « Bonjour
// Mr. Martins » dans son SMS ; trouver « Pour Martins » en tête de la page
// ouverte juste après ferait douter qu'elle lui soit destinée. C'est ici que ça
// s'éprouve, et non dans `test-devis-client-e2e` : la préparation de cette
// suite-là ne nomme aucun client, donc la ligne n'y existe pas et le contrôle
// serait vert sans rien avoir vu.
const ecranClient = await page.locator("body").innerText();
if (!ecranClient.includes(`Pour ${avecCivilite(CLIENT)}`)) {
  const vu = /Pour\s+.*/.exec(ecranClient)?.[0] ?? "(aucune ligne « Pour … »)";
  echecs.push(`la page du client dit « ${vu} » au lieu de « Pour ${avecCivilite(CLIENT)} »`);
}

// ─── Le message tout prêt, tel qu'il partira ─────────────────────────────────
const message = composerMessageClient({
  clientNom: CLIENT,
  entrepriseNom: "Atelier Démo",
  lien: `${BASE}/devis/${rows[0].jeton}`,
});
console.log("\n─── Le message tout prêt ───────────────────────────────────────");
console.log(message.corps);
console.log("────────────────────────────────────────────────────────────────\n");

if (!message.corps.startsWith(`Bonjour Mr. ${CLIENT},`)) {
  echecs.push(`le message s'ouvre sur « ${message.corps.split("\n")[0]} »`);
}
if (!message.corps.includes("vous pouvez en proposer une autre")) {
  echecs.push("la phrase des dates n'est pas au présent");
}

console.log(`Capture dans ${dossier}/ :`);
console.log("  client-encart.png   la page du client, à hauteur de l'encart");

await navigateur.close();
await pool.end();

if (echecs.length > 0) {
  console.error(`\n❌ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.error(`   • ${e}`);
  process.exit(1);
}
console.log("\n✅ L'encart invite, et le message aborde le client par sa civilité.");
