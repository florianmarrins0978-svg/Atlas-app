// Prend la capture de l'écran d'envoi quand l'identité est incomplète.
//   npx tsx scripts/capture-envoi-bloque.mts <dossier>
//
// SERT À REGARDER L'ÉCRAN, et c'est une obligation du dépôt : trois défauts
// réels d'Atlas n'ont été trouvés que là, jamais par un test vert
// (`CLAUDE.md` §5). Sur l'écran d'identité, deux traits redoublés — pourtant
// interdits sur les planches — n'ont été vus que sur une capture (§94), et sur
// l'écran de refus une phrase sortait collée, faute d'espace en JSX.
//
// **L'état dégradé est le sujet.** Le jeu de démonstration pose une entreprise
// complète : sans vider ces champs, on capturerait un écran qui ne bloque rien
// et l'on croirait avoir vu le blocage.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-envoi";
mkdirSync(dossier, { recursive: true });

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

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

// Un chantier qui a un devis ET un client joignable : sans cela, c'est le canal
// qui bloquerait, et l'on capturerait le mauvais écran.
const chantierId = await surBase(async (c) => {
  const { rows } = await c.query(
    `SELECT ch.id
       FROM chantiers ch
       JOIN devis d ON d.chantier_id = ch.id
       JOIN clients cl ON cl.id = ch.client_id
      WHERE cl.canal_communication IS NOT NULL
        AND COALESCE(cl.email, cl.telephone) IS NOT NULL
      LIMIT 1`
  );
  if (!rows[0]) throw new Error("aucun chantier avec un devis et un client joignable");
  return rows[0].id as string;
});

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

async function capturer(nom: string) {
  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.getByText("Envoyer au client", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(dossier, `envoi-${nom}.png`) });
}

// **On rend son identité à l'entreprise dans tous les cas**, sans quoi la base
// resterait dégradée pour les suites suivantes — et elles accuseraient
// l'identité en croyant éprouver autre chose.
const avant = await surBase(async (c) => {
  const { rows } = await c.query("SELECT id, siret, iban FROM entreprises");
  return rows as { id: string; siret: string | null; iban: string | null }[];
});

try {
  await surBase((c) => c.query("UPDATE entreprises SET siret = NULL, iban = NULL"));
  await capturer("bloque");

  await surBase((c) =>
    c.query("UPDATE entreprises SET siret = $1, iban = $2", [avant[0].siret, avant[0].iban])
  );
  await capturer("complet");
} finally {
  for (const e of avant) {
    await surBase((c) =>
      c.query("UPDATE entreprises SET siret = $1, iban = $2 WHERE id = $3", [e.siret, e.iban, e.id])
    );
  }
}

await navigateur.close();
console.log(`Captures dans ${dossier}`);
