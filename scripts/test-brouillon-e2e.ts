import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// Parcours mobile principal du lot : dictée transcrite → brouillon structuré →
// correction humaine → persistance → confirmation explicite → le chantier
// propose « Calculer le prix ».
//
// L'enregistrement micro lui-même n'est pas pilotable depuis un navigateur
// headless sans périphérique audio : la note et sa transcription sont donc
// posées en base (comme le ferait l'écran Note vocale), et le test exerce tout
// ce qui suit, c'est-à-dire précisément ce que ce lot ajoute.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DICTEE =
  "Élagage du sapin devant la maison, deux jours, deux hommes, 10 sacs de gravats à évacuer, évacuation des branchages";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier brouillon e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // --- Sans transcription : l'écran invite à la note vocale, aucun brouillon ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  assert.ok(
    await page.locator("text=Enregistrez une note vocale").isVisible(),
    "Sans transcription, l'écran doit renvoyer vers la note vocale"
  );

  // --- Pose la note et sa transcription, comme le ferait l'écran Note vocale ---
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum,
                                  transcription, transcription_statut)
       VALUES ($1, $2, 'e2e/brouillon.webm', 'audio/webm', 100, 'chk', $3, 'reussie')`,
      [entrepriseId, chantierId, DICTEE]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Génération du brouillon ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=Générer le brouillon");
  await page.waitForSelector("text=Confirmer et ajouter au chantier", { timeout: 10000 });

  // Rien n'a encore touché les données métier : la liste réelle reste vide.
  const avant = await pool.query(`SELECT count(*) FROM prestations WHERE chantier_id = $1`, [chantierId]);
  assert.equal(Number(avant.rows[0].count), 0, "Aucune prestation ne doit exister avant confirmation");

  // --- Correction humaine, puis rechargement : le brouillon doit survivre ---
  const champDuree = page.getByLabel("Durée (brouillon)");
  await champDuree.fill("3 jours (corrigé)");
  await champDuree.blur();
  await page.waitForTimeout(600);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Durée (brouillon)").inputValue(),
    "3 jours (corrigé)",
    "La correction humaine doit être persistée et relue après rechargement"
  );

  // --- Une régénération ne doit jamais écraser cette correction en silence ---
  await page.click("text=Régénérer depuis la dictée");
  await page.waitForSelector("text=Remplacer vos corrections ?", { timeout: 10000 });
  await page.click("text=Conserver mes corrections");
  await page.waitForTimeout(400);
  assert.equal(
    await page.getByLabel("Durée (brouillon)").inputValue(),
    "3 jours (corrigé)",
    "Après refus du remplacement, la correction humaine doit rester intacte"
  );

  // --- Confirmation explicite : le brouillon entre dans les données métier ---
  await page.click("text=Confirmer et ajouter au chantier");
  await page.waitForTimeout(1200);

  const apres = await pool.query(`SELECT count(*) FROM prestations WHERE chantier_id = $1`, [chantierId]);
  assert.ok(Number(apres.rows[0].count) > 0, "La confirmation doit créer les prestations du brouillon");

  const duree = await pool.query(`SELECT duree_prevue FROM chantiers WHERE id = $1`, [chantierId]);
  assert.equal(
    duree.rows[0].duree_prevue,
    "3 jours (corrigé)",
    "C'est la valeur corrigée par le patron qui doit être appliquée, jamais celle proposée par la machine"
  );

  // --- Validation finale : la fiche dit ce qui reste à faire ---------------
  //
  // **Ce contrôle visait « Calculer le prix », et ce libellé a disparu de la
  // fiche le 11 août 2026** — à la demande du patron : *« informations, prix,
  // devis peuvent disparaître du petit bandeau »*. Les trois décrivaient un
  // travail que la chaîne de la dictée fait désormais seule.
  //
  // Ce qu'il tenait vraiment n'a pas changé, et reste tenu ici : **une fois les
  // informations vérifiées, la fiche doit dire ce qui suit.** Elle le dit
  // maintenant sous l'anneau — « Mon devis → », qui chiffre et rédige d'un
  // seul geste. L'écran du prix, lui, reste joignable par son adresse ; c'est
  // `test-anneau-vers-devis-e2e.ts` qui l'éprouve.
  await page.click("text=Valider et calculer le prix");
  await page.waitForURL(/\/prix$/, { timeout: 10000 });

  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  assert.ok(
    await page.locator('[data-atlas="mon-devis"]').first().isVisible(),
    "Une fois les informations vérifiées, la fiche ne dit plus ce qui suit : « Mon devis » devrait être sous l'anneau"
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Brouillon d'informations réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
