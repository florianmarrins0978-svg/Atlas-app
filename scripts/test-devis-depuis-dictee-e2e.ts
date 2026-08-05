import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// **Le parcours que le patron réclamait : de la dictée au devis, en un geste.**
//
// Le 4 août 2026 : « toujours pas de devis créé tout seul à partir de la note
// vocale ! Problème qui traîne. Je veux vraiment que tu te consacres à fond pour
// régler ce problème une bonne fois pour toutes. »
//
// Chaque maillon existait et était éprouvé — brouillon, prestations, chiffrage,
// devis. Aucune suite ne les parcourait **à la file**, et c'est précisément
// l'enchaînement qui manquait : cinq boutons sur quatre écrans, dont aucun ne
// menait au suivant. Un contrôle par maillon peut rester vert pendant que le
// parcours, lui, ne mène nulle part.
//
// Ce que cette suite tient, et qui ne doit jamais se défaire :
//   1. depuis l'écran Transcription, **un seul appui** produit un devis chiffré ;
//   2. le devis porte les prestations dictées et un total non nul ;
//   3. **rien ne part au client** — l'arrêt avant l'envoi reste entier.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

const DICTEE =
  "Taille de haie de laurier, 20 mètres linéaire, chaîne mort à démonter, couper le bois en 50, " +
  "le laisser sur place, j'estime le temps de travaux à 2 jours, 2 hommes, un camion à broyeur et une fendeuse.";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nom = `Dictée vers devis ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nom);
  await page.fill('input[placeholder="M. Bernard"]', "M. Dupont");
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // L'enregistrement micro n'est pas pilotable dans un navigateur sans
  // périphérique audio : la note et sa transcription sont posées en base,
  // exactement comme le fait l'écran Note vocale. Tout ce qui suit — c'est-à-dire
  // ce que ce lot ajoute — est bien exercé par l'écran.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum,
                                  transcription, transcription_statut)
       VALUES ($1, $2, 'e2e/dictee-devis.webm', 'audio/webm', 100, 'chk', $3, 'reussie')`,
      [entrepriseId, chantierId, DICTEE]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Un seul geste ------------------------------------------------------
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  const bouton = page.getByRole("button", { name: "Créer le devis à partir de ma dictée" });
  assert.equal(
    await bouton.count(),
    1,
    "L'écran de la dictée ne propose pas d'aller au devis : le patron repart pour cinq boutons."
  );
  await bouton.click();
  await page.waitForSelector("text=Devis préparé", { timeout: 30000 });
  console.log("  ✓ un seul appui suffit, depuis l'écran de la dictée");

  const rapport = await page.locator("body").innerText();
  assert.ok(
    /taille de haie/i.test(rapport),
    "Le rapport ne montre pas ce qui a été retenu : le patron ne peut pas juger sur pièce."
  );
  assert.ok(
    !/0,00\s*€/.test(rapport),
    `Le devis est chiffré à zéro — c'est le devis vide d'avant. Rapport : ${rapport.slice(0, 400)}`
  );
  console.log("  ✓ le rapport montre les prestations dictées et un montant");

  // --- Ce qui est réellement en base --------------------------------------
  const enBase = await pool.query(
    `SELECT (SELECT count(*) FROM prestations WHERE chantier_id = $1) AS prestations,
            (SELECT count(*) FROM lignes_prix WHERE chantier_id = $1) AS lignes,
            (SELECT count(*) FROM devis WHERE chantier_id = $1) AS devis,
            (SELECT count(*) FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1) AS envois`,
    [chantierId]
  );
  const { prestations, lignes, devis, envois } = enBase.rows[0];
  assert.ok(Number(prestations) >= 3, `Les prestations dictées ne sont pas au chantier (${prestations}).`);
  assert.ok(Number(lignes) >= 1, "Aucune ligne de prix : le devis partirait à 0,00 €.");
  assert.equal(Number(devis), 1, "Le devis n'a pas été préparé.");
  console.log("  ✓ prestations, ligne de prix et devis existent réellement en base");

  // **L'arrêt avant l'envoi est intact.** C'est la seule promesse que ce
  // raccourci ne doit jamais entamer : préparer n'est pas envoyer.
  assert.equal(Number(envois), 0, "Un devis est parti au client sans que le patron l'ait décidé.");
  console.log("  ✓ rien n'est parti au client");

  // --- Le devis, tel que le patron le voit --------------------------------
  await page.getByRole("link", { name: "Voir le devis" }).click();
  await page.waitForURL(/\/export$/, { timeout: 15000 });
  await page.waitForSelector("text=Envoyer au client", { timeout: 15000 });
  const ecranDevis = await page.locator("body").innerText();
  assert.ok(/taille de haie/i.test(ecranDevis), "Le devis ne porte pas la prestation dictée.");
  assert.ok(
    !/TOTAL\s*0,00\s*€/i.test(ecranDevis),
    `Le devis affiche un total nul. Écran : ${ecranDevis.slice(0, 400)}`
  );
  console.log("  ✓ l'écran Devis porte les prestations et un total");

  // --- Rejouer le geste ne double rien -------------------------------------
  // Le défaut du 3 août — un devis passé de 1 674 à 3 348 € — est venu d'un
  // second appui. Le raccourci ne doit pas le rouvrir.
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  const rejouable = page.getByRole("button", { name: "Créer le devis à partir de ma dictée" });
  if (await rejouable.count()) {
    await rejouable.click();
    await page.waitForSelector("text=Devis préparé", { timeout: 30000 });
    const apres = await pool.query(`SELECT count(*) FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
    assert.equal(
      Number(apres.rows[0].count),
      Number(lignes),
      "Rejouer l'enchaînement a ajouté une seconde ligne de prix : le devis du patron a doublé."
    );
    console.log("  ✓ rejouer le geste n'ajoute pas une seconde ligne de prix");
  }

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ De la dictée au devis, en un seul geste — et rien n'est parti.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
