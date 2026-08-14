// Prend les captures du sommaire des réglages et de ses rubriques.
//   npx tsx scripts/capture-reglages.mts <dossier>
//
// SERT À REGARDER L'ÉCRAN, et c'est une obligation du dépôt : trois défauts
// réels d'Atlas n'ont été trouvés que là, jamais par un test vert
// (`CLAUDE.md` §5). Sur l'écran d'identité, deux traits redoublés — pourtant
// interdits sur les planches — n'ont été vus que sur une capture
// (`ARCHITECTURE.md` §94).
//
// **La vue du SALARIÉ compte autant que celle du patron.** C'est la seule qui
// prouve que les neuf rubriques de l'entreprise ne sortent pas du serveur, et
// personne ne l'avait jamais regardée.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-reglages";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/**
 * Rétrograde le compte de démonstration en simple membre, le temps d'une
 * capture. **Le rôle se lit en base à chaque appel** (`getRole`), donc il n'y a
 * rien à recharger d'autre que la page.
 */
async function poserRole(role: "proprietaire" | "membre") {
  const client = new Client({
    connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("UPDATE membres_entreprise SET role = $1", [role]);
  } finally {
    await client.end();
  }
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

for (const [nom, adresse] of [
  ["sommaire", "/reglages"],
  ["entreprise", "/reglages/identite"],
  ["tarifs", "/reglages/tarifs"],
  ["planning", "/reglages/planning"],
  ["ia", "/reglages/ia"],
  ["donnees", "/reglages/donnees"],
] as const) {
  await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, `reglages-${nom}.png`), fullPage: true });
}

// La vue du salarié — puis on rend son entreprise au patron, sans quoi la base
// resterait dégradée pour toutes les suites suivantes.
try {
  await poserRole("membre");
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, "reglages-salarie.png"), fullPage: true });

  await page.goto(`${BASE}/reglages/tarifs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, "reglages-salarie-refus.png"), fullPage: true });
} finally {
  await poserRole("proprietaire");
}

await navigateur.close();
console.log(`Captures dans ${dossier}`);
