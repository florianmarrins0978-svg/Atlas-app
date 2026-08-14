// Prend les captures de l'écran « Identité » — rempli, puis vierge.
//   npx tsx scripts/capture-identite.mts <dossier>
//
// SERT À REGARDER L'ÉCRAN, et c'est une obligation du dépôt : trois défauts
// réels d'Atlas n'ont été trouvés que là, jamais par un test vert
// (`CLAUDE.md` §5). L'état VIERGE compte autant que l'état rempli — c'est celui
// qu'un artisan voit à son premier jour, et que personne n'avait jamais vu
// (`ARCHITECTURE.md` §87).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-identite";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

async function surBase<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Vide l'identité en base, pour voir l'écran du premier jour. */
async function viderIdentite() {
  await surBase((c) =>
    c.query("UPDATE entreprises SET adresse = NULL, siret = NULL, iban = NULL, forme_juridique = NULL")
  );
}

/**
 * Rend son identité à l'entreprise.
 *
 * **Sans cela, la base restait vidée après la capture** — et la prise suivante
 * montrait un écran « premier jour » en croyant montrer l'écran rempli. Vu le
 * 14 août 2026 : deux captures de suite ont affiché « SIRET — manquant » sur un
 * jeu de démonstration parfaitement complet. Une capture ne doit rien laisser
 * derrière elle, sinon c'est la suivante qui ment.
 */
async function rendreIdentite(avant: { id: string; adresse: string | null; siret: string | null; iban: string | null; forme_juridique: string | null }[]) {
  for (const e of avant) {
    await surBase((c) =>
      c.query(
        "UPDATE entreprises SET adresse = $1, siret = $2, iban = $3, forme_juridique = $4 WHERE id = $5",
        [e.adresse, e.siret, e.iban, e.forme_juridique, e.id]
      )
    );
  }
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

await page.goto(`${BASE}/reglages/identite`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(dossier, "identite-rempli.png"), fullPage: true });

// Le régime de TVA déplié : le numéro n'apparaît que pour un assujetti.
await page.getByRole("button", { name: /Franchise en base/ }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(dossier, "identite-franchise.png"), fullPage: true });

const avant = await surBase(async (c) => {
  const { rows } = await c.query("SELECT id, adresse, siret, iban, forme_juridique FROM entreprises");
  return rows;
});
try {
  await viderIdentite();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, "identite-vierge.png"), fullPage: true });
} finally {
  await rendreIdentite(avant);
}

await navigateur.close();
console.log(`Captures dans ${dossier}`);
