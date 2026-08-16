import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// **Le bandeau qui propose de compléter une demi-journée, vu à l'écran.**
//
// Sa demande du 13 août 2026, sa composition retenue le 16 : le bandeau sous la
// journée (proposition 2), avec plusieurs candidats (comme la 3), et les
// distances par la route.
//
// **Ce que cette suite ajoute à `test-appariement-chantiers.ts`**, qui couvre
// déjà les règles, l'isolation et les pannes : elle regarde l'écran. Trois
// défauts réels de ce projet ont été trouvés sur une capture et jamais par un
// test vert (`CLAUDE.md` §5) — un bandeau qui n'apparaît pas, un nom coupé, un
// bouton qui ne pose rien se voient là, pas ailleurs.
//
// **La phrase de distance est acceptée dans ses DEUX formes.** Le service de
// l'IGN n'est pas joignable depuis l'environnement de développement, dont le
// mandataire refuse les services extérieurs ; le produit retombe alors sur le
// vol d'oiseau, et c'est précisément le comportement voulu. Exiger « de route »
// ici ferait rougir une suite pour une absence de réseau — ce qui est déjà
// vérifié, service par service, dans la suite base.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Deux places de mairie des monts du Lyonnais — jamais une adresse de client. */
const CHAPONOST = { adresse: "Place de la Mairie, 69630 Chaponost", lat: 45.7, lon: 4.7167 };
const SOUCIEU = { adresse: "Place de la Mairie, 69510 Soucieu-en-Jarrest", lat: 45.6667, lon: 4.7 };
const BRUSSIEU = { adresse: "Place de la Mairie, 69690 Brussieu", lat: 45.75, lon: 4.5 };

/** Le jour d'essai : loin devant, pour ne croiser aucun chantier de démonstration. */
const JOUR = "2027-03-11";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const marque = Date.now();
  async function creer(nom: string) {
    await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', nom);
    await page.click('button:has-text("Créer le chantier")');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
    return page.url().split("/").pop()!;
  }

  const nomMatin = `Abattage ${marque}`;
  const nomProche = `Haie ${marque}`;
  const nomLoin = `Élagage ${marque}`;
  const idMatin = await creer(nomMatin);
  const idProche = await creer(nomProche);
  const idLoin = await creer(nomLoin);

  // **Les coordonnées sont posées ICI, et c'est délibéré.** Le rattrapage
  // passe par la Base Adresse Nationale, qu'aucune machine de contrôle ne
  // joint : le faire dépendre d'elle ferait rougir cette suite pour une panne
  // de réseau. Ce que l'écran doit montrer une fois les coordonnées connues est
  // ce qu'on vérifie ici ; leur obtention est vérifiée dans la suite base.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT id FROM entreprises ORDER BY created_at ASC LIMIT 1`);
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [rows[0].id]);
    const poser = async (
      id: string,
      lieu: { adresse: string; lat: number; lon: number },
      planifie: string | null
    ) => {
      await client.query(
        `UPDATE chantiers
            SET devis_envoye_at = now(),
                duree_prevue = 'une demi-journée',
                adresse_chantier = $2,
                adresse_situee = $2,
                latitude = $3,
                longitude = $4,
                date_planifiee = $5,
                creneau_debut = CASE WHEN $5::date IS NULL THEN NULL ELSE 'matin' END,
                duree_demi_journees = CASE WHEN $5::date IS NULL THEN NULL ELSE 1 END
          WHERE id = $1`,
        [id, lieu.adresse, lieu.lat, lieu.lon, planifie]
      );
    };
    await poser(idMatin, CHAPONOST, JOUR);
    await poser(idProche, SOUCIEU, null);
    await poser(idLoin, BRUSSIEU, null);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });

  // Avancer jusqu'au mois du jour d'essai — le calendrier s'ouvre sur le mois
  // courant, et le supposer affiché rendrait la suite fausse en mars.
  for (let i = 0; i < 30; i++) {
    if ((await page.locator(`[data-atlas="grille-mois"] button[data-jour="${JOUR}"]`).count()) > 0) break;
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(120);
  }
  await page.click(`[data-atlas="grille-mois"] button[data-jour="${JOUR}"]`);

  // Le bandeau attend deux services extérieurs : on lui laisse le temps de
  // renoncer, plutôt que de conclure à son absence.
  const bandeau = page.locator('[data-atlas="appariement"]');
  await bandeau.waitFor({ state: "visible", timeout: 25_000 });

  const texte = (await bandeau.innerText()).replace(/\s+/g, " ");
  assert.ok(
    /est libre/.test(texte),
    `Le bandeau ne dit pas quelle demi-journée est libre : « ${texte} »`
  );
  assert.ok(texte.includes(nomProche), `Le candidat le plus proche manque : « ${texte} »`);
  assert.ok(
    texte.includes(nomLoin),
    `Un seul candidat proposé alors qu'il en existe deux — sa demande était « plusieurs propositions » : « ${texte} »`
  );

  // **L'ordre est ce qui fait tout l'intérêt de la fonction.** Soucieu est plus
  // proche de Chaponost que Brussieu ; si l'écran les inverse, le patron
  // traverse le département pour rien.
  assert.ok(
    texte.indexOf(nomProche) < texte.indexOf(nomLoin),
    `Les candidats ne sont pas classés du plus proche au plus lointain : « ${texte} »`
  );

  assert.ok(
    /de route|vol d’oiseau|vol d'oiseau/.test(texte),
    `Aucune distance affichée, ou une distance qui ne dit pas ce qu'elle mesure : « ${texte} »`
  );

  // **Rien ne se coupe à 390 px** — la dalle de son téléphone. Un nom de client
  // long qui déborde rend la ligne illisible sans qu'aucun test ne bronche.
  const debord = await page.evaluate(() => {
    const el = document.querySelector('[data-atlas="appariement"]');
    if (!el) return null;
    return { visible: el.scrollWidth, reel: el.clientWidth };
  });
  assert.ok(debord && debord.visible <= debord.reel + 1, `Le bandeau déborde : ${JSON.stringify(debord)}`);

  await page.screenshot({ path: "/tmp/appariement-bandeau.png" });

  // --- Le geste : caler le plus proche sur l'après-midi ---
  await page.locator(`[data-atlas="caler"][data-chantier="${idProche}"]`).click();
  await page.waitForTimeout(1500);

  const apres = await pool.query(
    `SELECT date_planifiee::text AS jour, creneau_debut, duree_demi_journees FROM chantiers WHERE id = $1`,
    [idProche]
  );
  assert.equal(apres.rows[0].jour, JOUR, "Le chantier calé n'a pas pris le bon jour.");
  assert.equal(
    apres.rows[0].creneau_debut,
    "apres_midi",
    "Le chantier calé n'a pas pris la demi-journée libre — celle du matin était déjà prise."
  );
  assert.equal(Number(apres.rows[0].duree_demi_journees), 1, "Une demi-journée proposée a réservé plus qu'une.");

  // **Et le bandeau disparaît** : la journée est complète, il n'y a plus rien à
  // compléter. Un bandeau qui survivrait à son motif proposerait de remplir une
  // demi-journée déjà prise.
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator('[data-atlas="appariement"]').count(),
    0,
    "Le bandeau reste affiché alors que la journée est complète."
  );

  console.log("✅ Le bandeau d'appariement propose, classe et cale — capture : /tmp/appariement-bandeau.png");

  await pool.end();
  await browser.close();
}

main().catch(async (e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  await pool.end().catch(() => {});
  process.exit(1);
});
