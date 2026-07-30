import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// Parcours mobile du lot : informations confirmées → calcul du prix → détail
// explicatif → validation humaine → étape suivante du chantier.
//
// Les assertions portent sur les valeurs métier réellement en base, pas sur la
// présence de texte : un écran peut afficher le bon nombre pour de mauvaises
// raisons.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Paramètres par défaut : 2 j × 2 ouvriers × 200 € + chef 2 × 280 € = 1360 €,
// + 35 € de déplacement = 1395 €, + 20 % de marge = 1674,00 €.
const PRIX_ATTENDU = "1674.00";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier calcul prix e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // --- Informations : une prestation sans tarif correspondant, durée et équipe ---
  // Posées en base comme le ferait l'écran Informations, pour que le calcul ait
  // de quoi s'exercer sans dépendre du micro.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO prestations (entreprise_id, chantier_id, libelle, ordre) VALUES ($1, $2, $3, 0)`,
      [entrepriseId, chantierId, "Démolition cloison e2e"]
    );
    await client.query(`UPDATE chantiers SET duree_prevue = '2 jours', taille_equipe = '2 hommes' WHERE id = $1`, [
      chantierId,
    ]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Validation des informations depuis l'écran dédié ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=Valider et calculer le prix");
  await page.waitForURL(/\/prix$/, { timeout: 10000 });

  const apresInfos = await pool.query(`SELECT informations_verifiees_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.ok(apresInfos.rows[0].informations_verifiees_at, "Les informations doivent être marquées vérifiées");

  // --- Origine du prix annoncée, détail consultable ---
  // waitForURL rend la main dès que l'URL change : le contenu rendu côté
  // serveur peut ne pas encore être peint. On attend donc l'élément lui-même.
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=Calculé depuis vos paramètres", { timeout: 10000 });

  await page.click("text=Voir le détail");
  await page.waitForSelector("text=Main-d'œuvre", { timeout: 5000 });

  // --- Rien n'est appliqué tant que le patron n'a pas agi ---
  const avant = await pool.query(`SELECT count(*) FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
  assert.equal(Number(avant.rows[0].count), 0, "Afficher une proposition ne doit créer aucune ligne");

  // --- Application explicite ---
  await page.click("text=Ajouter au détail");
  await page.waitForTimeout(1000);

  const apres = await pool.query(
    `SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
    [chantierId]
  );
  assert.equal(apres.rows.length, 1, "Une seule ligne doit avoir été créée");
  assert.equal(apres.rows[0].montant, PRIX_ATTENDU, "Le montant écrit doit être celui recalculé côté serveur");

  // --- Le prix n'est pas validé pour autant ---
  const avantValidation = await pool.query(`SELECT prix_valide_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.equal(avantValidation.rows[0].prix_valide_at, null, "Ajouter une ligne ne vaut pas validation du prix");

  // --- Validation humaine explicite ---
  await page.click("text=Préparer le devis");
  await page.waitForURL(/\/export$/, { timeout: 10000 });

  const apresValidation = await pool.query(`SELECT prix_valide_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.ok(apresValidation.rows[0].prix_valide_at, "Le prix doit être validé après action explicite");

  // --- Étape suivante du chantier ---
  // L'écran Devis crée le brouillon dès son ouverture (getOuCreerDevisBrouillon)
  // et horodate devis_genere_at : l'étape suivante est donc « Consulter le
  // devis », pas « Préparer le devis ». On vérifie le jalon en base avant de
  // vérifier ce que la fiche propose.
  const jalons = await pool.query(
    `SELECT prix_valide_at, devis_genere_at, devis_envoye_at FROM chantiers WHERE id = $1`,
    [chantierId]
  );
  assert.ok(jalons.rows[0].devis_genere_at, "L'ouverture de l'écran Devis doit avoir créé le brouillon");
  assert.equal(jalons.rows[0].devis_envoye_at, null, "Aucun devis ne doit être envoyé automatiquement");

  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Consulter le devis", { timeout: 10000 });
  assert.equal(
    await page.locator("text=Calculer le prix").count(),
    0,
    "Le prix étant validé, le chantier ne doit plus proposer de le calculer"
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Calcul du prix réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
