import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// Deux chantiers chez le même homme, une seule fiche — par son parcours à lui.
//
// **CE QUE CETTE SUITE TIENT, ET QUE LES SUITES BASE NE VOIENT PAS.** La règle
// est éprouvée à part (`test-rapprochement-client.ts`,
// `test-rapprochement-client-db.ts`) et resterait verte même si l'écran de
// création n'appelait pas `trouverOuCreerClient` — c'est le raccord qui casse,
// jamais la formule. Ici on remplit VRAIMENT le formulaire, deux fois, et on
// regarde ce que sa fiche client annonce ensuite.
//
// C'est exactement sa demande du 17 août 2026 : *« si je crée un nouveau
// chantier, mais que c'est monsieur Martins et qu'on a déjà une fiche client
// monsieur Martins, [il faut que] le devis, la facture s'ajoute à la fiche
// client de monsieur Martins qui est déjà créé. »*

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Un patronyme unique par exécution : la base n'est pas vidée entre deux
  // passages, et un « Martins » laissé par la précédente fausserait le compte.
  const nom = `Martins ${Date.now()}`;

  /** Crée un chantier par le formulaire, et rend son id. */
  async function creerChantier(nomSaisi: string): Promise<string> {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', nomSaisi);
    const idChantier = await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    return idChantier;
  }

  const premier = await creerChantier(nom);
  // La deuxième fois, il tape la civilité — c'est ce qu'il fait vraiment, et
  // c'est ce qui faisait deux fiches.
  const second = await creerChantier(`M. ${nom}`);

  await cas("les deux chantiers pointent sur LA MÊME fiche client", async () => {
    const { rows } = await pool.query(
      `SELECT client_id FROM chantiers WHERE id = ANY($1::uuid[])`,
      [[premier, second]]
    );
    assert.equal(rows.length, 2, "les deux chantiers n'ont pas été retrouvés");
    assert.ok(rows[0].client_id, "le premier chantier n'a pas de client");
    assert.equal(
      rows[0].client_id,
      rows[1].client_id,
      "deux fiches pour le même homme : sa fiche client dira « 1 chantier » à vie"
    );
  });

  await cas("une seule fiche porte ce nom en base", async () => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM clients WHERE nom LIKE $1 AND deleted_at IS NULL`,
      [`%${nom}`]
    );
    assert.equal(rows[0].n, 1, `${rows[0].n} fiches créées pour un seul client`);
  });

  // **CE CONTRÔLE A CHANGÉ DE FORME DEUX FOIS, ET SON OBJET N'A JAMAIS BOUGÉ.**
  //
  // Il lisait d'abord « 2 chantiers » sur la fiche du client ; le patron a fait
  // retirer ce compte le 20 août 2026 — *« tout le reste, tu enlèves, c'est du
  // trop »*. Il a alors visé la PORTE que chaque chantier ouvrait vers
  // `/clients/[id]` : cette porte vivait dans le tiroir de la fiche du
  // chantier, retirée le 4 septembre (`ARCHITECTURE.md` §254).
  //
  // **Il vise donc l'IDENTIFIANT, que rien ne peut faire retirer** — c'est ce
  // que `CLAUDE.md` §5 bis demande, et ce que les deux versions d'écran
  // cherchaient à approcher sans l'atteindre. Ce qui reste à prouver est
  // exactement le même : **les deux chantiers ont été rapprochés sous UN seul
  // client**, et sa fiche s'ouvre pour de bon.
  await cas("les deux chantiers portent LE MÊME client, et sa fiche répond", async () => {
    const { rows } = await pool.query(
      `SELECT id, client_id FROM chantiers WHERE id = ANY($1::uuid[])`,
      [[premier, second]]
    );
    assert.equal(rows.length, 2, "les deux chantiers ne sont pas tous les deux en base");
    const clients = new Set(rows.map((r) => r.client_id));
    assert.ok(!clients.has(null), "un des deux chantiers n'a pas de client rattaché");
    assert.equal(
      clients.size,
      1,
      `les deux chantiers portent DEUX clients : ${[...clients].join(" ≠ ")}`
    );

    // **Et cette fiche-là s'ouvre vraiment.** Un identifiant partagé qui mènerait
    // à une page d'erreur prouverait le rapprochement et rien de plus — le
    // patron, lui, doit pouvoir la lire.
    const clientId = [...clients][0] as string;
    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
    const texte = await page.locator("body").innerText();
    assert.ok(texte.includes(nom), `la fiche ouverte ne porte pas « ${nom} » :\n${texte.slice(0, 300)}`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Un seul client pour deux chantiers — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
