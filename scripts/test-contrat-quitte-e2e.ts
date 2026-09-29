import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// **UN CONTRAT COMMENCÉ PUIS QUITTÉ SE RETROUVE DANS « VOS CHANTIERS ».**
//
// Sa plainte du 29 septembre 2026 : *« lorsque j'ouvre un contrat d'entretien
// pour réaliser le devis, si je quitte, il ne s'enregistre pas dans mes
// chantiers en cours sur la page chantier »*.
//
// Deux défauts, et cette suite tient les deux par SON parcours à lui :
//   1. l'écran du contrat n'écrivait rien avant « Aperçu du PDF » ou
//      « Envoyer » : quitté, le contrat partait avec l'écran ;
//   2. l'accueil ne lisait que des chantiers : même enregistré, un brouillon
//      de contrat n'y figurait nulle part.
//
// Aucun bouton d'enregistrement n'est touché ici, et c'est le point : il n'y
// en a pas, et il n'a pas à en chercher un.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

/** Le brouillon en base, relu jusqu'à ce qu'il porte la prestation (neuf secondes au plus). */
async function brouillonEnBase(clientId: string, libelle: string): Promise<string | null> {
  for (let essai = 0; essai < 30; essai++) {
    const { rows } = await pool.query(
      `SELECT id, prestations FROM contrats_entretien WHERE client_id = $1 AND statut = 'brouillon'`,
      [clientId]
    );
    const trouve = rows.find((r) => JSON.stringify(r.prestations).includes(libelle));
    if (trouve) return trouve.id as string;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
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

  // Un client à lui, neuf à chaque passage : la base n'est pas vidée entre deux.
  const nom = `Lemaire ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  const chantierId = await creerPuisFiche(page);
  const { rows } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [chantierId]);
  const clientId = rows[0]?.client_id as string;
  assert.ok(clientId, "le chantier n'a pas de client rattaché");

  // ── Son geste : la fiche du client, « Contrat d'entretien », une prestation ──
  await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
  await page.locator('[data-atlas="geste-contrat"]').click();
  await page.waitForSelector('[data-atlas="ecran-contrat-entretien"]');
  const prestation = `Tonte ${Date.now()}`;
  await page.getByRole("button", { name: "+ Ajouter une prestation" }).click();
  await page.getByLabel("Écrire une prestation").fill(prestation);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.locator('[aria-label="avril"]').first().click();

  let contratId: string | null = null;
  await cas("le brouillon est en base sans qu'aucun bouton d'enregistrement soit touché", async () => {
    contratId = await brouillonEnBase(clientId, prestation);
    assert.ok(contratId, "rien n'est en base : quitter l'écran perdrait le contrat");
  });

  // ── Il quitte, par la barre du bas ──
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const ligne = page.locator(`a.atlas-brin[href="/clients/${clientId}/contrat"]`);

  await cas("« Vos chantiers » porte le contrat commencé, à son nom", async () => {
    assert.equal(await ligne.count(), 1, "aucune ligne ne ramène au contrat sur l'accueil");
    const texte = (await ligne.innerText()).replace(/\s+/g, " ");
    assert.match(texte, /Contrat d'entretien/);
    assert.match(texte, new RegExp(nom));
    assert.match(texte, /à compléter/i, `l'état ne dit pas qu'il reste à chiffrer. Lu : « ${texte} »`);
  });

  await cas("toucher la ligne rouvre le contrat où il l'a laissé", async () => {
    await ligne.click();
    await page.waitForURL(`${BASE}/clients/${clientId}/contrat`, { timeout: 15_000 });
    await page.waitForSelector('[data-atlas="prestation-contrat"]');
    const lu = await page.locator('[data-atlas="prestation-contrat"]').innerText();
    assert.match(lu, new RegExp(prestation));
    // Rouvrir sans rien toucher ne crée pas un second brouillon.
    const { rows: brouillons } = await pool.query(
      `SELECT count(*)::int AS n FROM contrats_entretien WHERE client_id = $1 AND statut = 'brouillon'`,
      [clientId]
    );
    assert.equal(brouillons[0].n, 1);
  });

  // **Sa règle du 29 septembre 2026** : *« tout ce qui est devis, contrat
  // d'entretien, dernier devis ou autre doivent arriver là »*. Un contrat parti
  // reste sur l'accueil tant que le client n'a pas accepté, comme un devis
  // envoyé ; accepté, ses passages vivent au planning.
  await cas("parti chez le client, il reste, sans réponse et avec son jour d'envoi", async () => {
    assert.ok(contratId);
    await pool.query(
      `UPDATE contrats_entretien SET statut = 'envoye', jeton = $2, empreinte = repeat('0', 64), envoye_le = now() WHERE id = $1`,
      [contratId, `jeton-${Date.now()}`]
    );
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const parti = page.locator(`a.atlas-brin[href="/clients/${clientId}/contrat"]`);
    assert.equal(await parti.count(), 1, "le contrat envoyé a quitté l'accueil");
    const texte = (await parti.innerText()).replace(/\s+/g, " ");
    assert.match(texte, /Contrat envoyé, sans réponse/i);
    assert.equal(await parti.locator('[data-atlas="precision-chantier"]').count(), 1, "le jour d'envoi manque");
  });

  await cas("accepté, il quitte la liste", async () => {
    await pool.query(`UPDATE contrats_entretien SET statut = 'accepte', repondu_le = now() WHERE id = $1`, [contratId]);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(`a.atlas-brin[href="/clients/${clientId}/contrat"]`).count(), 0);
  });

  await pool.end();
  await navigateur.close();
  if (echecs > 0) {
    console.error(`❌ ${echecs} cas en échec`);
    process.exit(1);
  }
  console.log("✅ Un contrat commencé puis quitté se retrouve dans « Vos chantiers ».");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
