// Prend les captures des trois dernières rubriques des réglages.
//   npx tsx scripts/capture-trois-rubriques.mts <dossier>
//
// SERT À REGARDER L'ÉCRAN, et c'est une obligation du dépôt : trois défauts
// réels d'Atlas n'ont été trouvés que là, jamais par un test vert
// (`CLAUDE.md` §5).
//
// La dernière capture n'est pas un ornement : elle montre le rappel POSÉ SUR
// L'ACCUEIL. Un interrupteur qui ne produit rien à l'écran est exactement ce
// que le patron a interdit — « on le touche, rien ne bouge, et on croit à une
// panne ». Il faut donc voir la carte, pas seulement le réglage.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-trois-rubriques";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/**
 * Poser un chantier terminé et non facturé, pour voir la carte de rappel.
 *
 * **Sans ce geste, la capture ne montrerait RIEN** — et c'est exactement ce qui
 * s'est passé au premier essai : le jeu de démonstration ne porte AUCUN devis
 * parti ni aucun chantier terminé. On regardait un accueil vide en croyant
 * avoir vérifié le rappel. C'est le piège que `CLAUDE.md` §5 nomme : un
 * contrôle qui n'a jamais rien vu ne prouve rien.
 *
 * Le chantier est rendu tel qu'il était, quoi qu'il arrive : une capture qui
 * laisse la base modifiée fait mentir la suivante.
 */
async function chantierTermineNonFacture(): Promise<() => Promise<void>> {
  // **`DATABASE_URL` EN PREMIER, et ce n'est pas indifférent.** Les tables
  // portent `FORCE ROW LEVEL SECURITY` : la RLS s'applique même au rôle
  // PROPRIÉTAIRE. Interrogée sous `DATABASE_ADMIN_URL`, cette requête a rendu
  // « 0 chantier » sur une base qui en portait quatre — et la capture annonçait
  // tranquillement qu'il n'y avait rien à montrer. Les captures et les suites
  // navigateur emploient le rôle qui TRAVERSE la RLS (`CLAUDE.md` §5), et c'est
  // celui-là qu'il faut ici.
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? process.env.DATABASE_ADMIN_URL });
  await client.connect();
  const { rows } = await client.query(
    `SELECT id, termine_at FROM chantiers WHERE deleted_at IS NULL AND facture_envoyee_at IS NULL
     ORDER BY created_at LIMIT 1`
  );
  if (rows.length === 0) {
    await client.end();
    console.log("  (aucun chantier dans le jeu : la carte de rappel ne sera pas visible)");
    return async () => {};
  }
  const { id, termine_at } = rows[0];
  await client.query(`UPDATE chantiers SET termine_at = now() - interval '5 days' WHERE id = $1`, [id]);
  return async () => {
    await client.query(`UPDATE chantiers SET termine_at = $2 WHERE id = $1`, [id, termine_at]);
    await client.end();
  };
}

const rendre = await chantierTermineNonFacture();
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();

try {
  await connecter(page);

  const prendre = async (nom: string) => {
    await page.waitForTimeout(400);
    const chemin = path.join(dossier, `${nom}.png`);
    await page.screenshot({ path: chemin });
    console.log(`  · ${chemin}`);
  };

  await page.goto(`${BASE}/reglages/notifications`, { waitUntil: "networkidle" });
  await prendre("1-notifications");

  await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
  await prendre("2-apparence");

  await page.goto(`${BASE}/reglages/abonnement`, { waitUntil: "networkidle" });
  await prendre("3-abonnement");

  // LA CAPTURE QUI COMPTE : le réglage produit une carte, sur l'accueil.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await prendre("4-le-rappel-sur-l-accueil");

  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await prendre("5-sommaire-complet");
} finally {
  await navigateur.close();
  await rendre();
}
