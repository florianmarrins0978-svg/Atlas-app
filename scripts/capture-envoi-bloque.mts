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

// Un chantier qui a un devis, et un client JOIGNABLE.
//
// **Le jeu de démonstration n'en fournit pas.** Son client n'a ni canal ni
// adresse — c'est le cas d'un chantier dicté, dont le client reste « non
// renseigné ». Sans canal, c'est `canal_absent` qui bloquerait, et l'on
// capturerait le mauvais écran en croyant avoir vu le blocage d'identité. On le
// rend donc joignable le temps de la capture, et on lui rend son état après.
const cible = await surBase(async (c) => {
  // **Un chantier dont le devis n'est PAS encore parti.** Le seul devis du jeu
  // de démonstration a déjà été envoyé puis retourné pour correction : son écran
  // ne porte donc pas de bouton d'envoi, et la capture attendait un bouton qui
  // n'existait pas. On prend un chantier sans envoi — le brouillon se crée tout
  // seul à l'ouverture de l'écran (`getOuCreerDevisBrouillon`) — et de
  // préférence un qui porte des prestations, pour que le devis ait un contenu.
  const { rows } = await c.query(
    `SELECT ch.id AS chantier_id, cl.id AS client_id,
            cl.canal_communication, cl.email,
            (SELECT count(*) FROM prestations p WHERE p.chantier_id = ch.id) AS lignes
       FROM chantiers ch
       JOIN clients cl ON cl.id = ch.client_id
      WHERE NOT EXISTS (
              SELECT 1 FROM devis d
                JOIN envois_devis e ON e.devis_id = d.id
               WHERE d.chantier_id = ch.id)
      ORDER BY lignes DESC
      LIMIT 1`
  );
  if (!rows[0]) throw new Error("aucun chantier dont le devis n'est pas encore parti");
  return rows[0] as {
    chantier_id: string;
    client_id: string;
    canal_communication: string | null;
    email: string | null;
  };
});
const chantierId = cible.chantier_id;

await surBase((c) =>
  c.query(
    `UPDATE clients SET canal_communication = COALESCE(canal_communication, 'email'),
                        email = COALESCE(email, 'client@capture.local')
      WHERE id = $1`,
    [cible.client_id]
  )
);

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
  // Le client retrouve exactement ce qu'il avait : une capture ne doit rien
  // laisser derrière elle, sinon la suite suivante éprouve un jeu modifié.
  await surBase((c) =>
    c.query("UPDATE clients SET canal_communication = $1, email = $2 WHERE id = $3", [
      cible.canal_communication,
      cible.email,
      cible.client_id,
    ])
  );
}

await navigateur.close();
console.log(`Captures dans ${dossier}`);
