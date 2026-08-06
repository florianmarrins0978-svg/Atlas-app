import assert from "node:assert";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";

// La mémoire des corrections, parcourue comme le patron la parcourt.
//
// **Ce qu'aucune autre suite ne verrait.** Les règles de rapprochement sont
// éprouvées sans base (`test-lecons-prix.ts`), la persistance aussi
// (`test-lecons-prix-db.ts`). Ce qui n'existe nulle part ailleurs, c'est la
// boucle entière : il chiffre un chantier, puis sur le suivant l'agent lui
// rappelle ce qu'il avait retenu — et il reprend ce prix d'un geste.
//
// C'est aussi le seul contrôle qui verrait un rappel calculé correctement et
// jamais affiché, ou un bouton qui ne persiste pas.

const LIBELLE_PASSE = "Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm";
// Diamètre voisin, volontairement différent : c'est le rapprochement par
// tranche de dix centimètres qu'on éprouve ici, pas une égalité de chaînes.
const LIBELLE_DU_JOUR = "Abattage d'un chêne mort — démontage avec rétention, ⌀ 68 cm";

type Terrain = { passe: string; duJour: string; lignePasse: string };

/** Deux chantiers à elle : un déjà chiffré, un à chiffrer. */
async function preparerTerrain(): Promise<Terrain> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: e } = await client.query(`SELECT id FROM entreprises ORDER BY created_at LIMIT 1`);
    assert.ok(e[0], "Aucune entreprise en base : le jeu de démonstration n'a pas été semé.");
    const entrepriseId = e[0].id as string;
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);

    const creerChantier = async (nom: string) => {
      const { rows } = await client.query(
        `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`,
        [entrepriseId, `${nom} ${process.pid}`]
      );
      return rows[0].id as string;
    };
    const passe = await creerChantier("Chêne déjà chiffré");
    const duJour = await creerChantier("Chêne du jour");

    // Le chantier passé porte une ligne encore à zéro : c'est le patron qui
    // posera le prix par l'écran, pour que la leçon vienne de SON geste et non
    // d'une écriture directe en base. Sans quoi la suite éprouverait la base,
    // pas le produit.
    const { rows: l } = await client.query(
      `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant)
       VALUES ($1,$2,$3,1,0,0) RETURNING id`,
      [entrepriseId, passe, LIBELLE_PASSE]
    );
    await client.query(
      `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant)
       VALUES ($1,$2,$3,1,0,0)`,
      [entrepriseId, duJour, LIBELLE_DU_JOUR]
    );
    return { passe, duJour, lignePasse: l[0].id as string };
  } finally {
    await client.end();
  }
}

const BASE = "http://localhost:3000";

async function main() {
  const terrain = await preparerTerrain();
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30000 });

    // --- 1. Il chiffre son chantier, à la main ------------------------------
    await page.goto(`${BASE}/chantiers/${terrain.passe}/devis-complet`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });
    const prixUnitaire = page.getByLabel("Prix unitaire 1");
    await prixUnitaire.fill("1400");
    // L'enregistrement part quand il quitte le champ — c'est là que l'agent
    // apprend. On attend la réponse du serveur, jamais un chrono : sur une
    // machine chargée, un délai en dur ferait rougir un produit correct.
    const enregistre = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/devis-complet"),
      { timeout: 30000 }
    );
    await prixUnitaire.blur();
    await enregistre;

    // --- 2. Sur le chantier suivant, l'agent s'en souvient ------------------
    await page.goto(`${BASE}/chantiers/${terrain.duJour}/devis-complet`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });

    const ecran = await page.locator("body").innerText();
    assert.match(
      ecran,
      /La dernière fois/i,
      "Aucun rappel : ce qu'il vient de chiffrer n'a rien appris à l'agent."
    );
    assert.match(ecran, /1400 € HT/, "Le rappel ne porte pas le prix qu'il avait retenu.");
    assert.match(
      ecran,
      /⌀ 70 cm/,
      "Le rappel ne dit pas de quel chantier il vient — un chiffre sans source se lit comme un calcul."
    );

    // --- 3. Il le reprend d'un geste, et ça tient ---------------------------
    const reprendre = page.locator("text=Reprendre ce prix").first();
    assert.equal(await reprendre.count(), 1, "Le rappel s'affiche mais ne se reprend pas d'un geste.");
    const reprise = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/devis-complet"),
      { timeout: 30000 }
    );
    await reprendre.click();
    await reprise;

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });
    // Comparé en nombre, jamais en chaîne : « 1400 » et « 1400.00 » sont le
    // même prix, et l'écran est libre de choisir sa mise en forme. Un contrôle
    // qui exige une écriture précise rougit à la première retouche d'affichage
    // et accuse le produit d'un tort qu'il n'a pas.
    const repris = await page.getByLabel("Prix unitaire 1").inputValue();
    assert.equal(
      Number(repris.replace(",", ".")),
      1400,
      `Le prix repris n'a pas survécu au rechargement : « ${repris} »`
    );

    // --- 4. Et l'agent ne se cite jamais lui-même ---------------------------
    // Le chantier du jour porte maintenant 1 400 € : afficher « la dernière
    // fois : 1 400 € » juste au-dessus n'apprendrait rien et donnerait
    // l'impression d'un agent qui radote.
    const apres = await page.locator("body").innerText();
    const rappels = apres.match(/La dernière fois/gi) ?? [];
    assert.ok(
      rappels.length <= 1,
      `${rappels.length} rappels sur une seule ligne : l'agent se cite lui-même.`
    );

    console.log("✅ Il chiffre, l'agent retient, et le lui rappelle sur le chantier suivant.");
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
