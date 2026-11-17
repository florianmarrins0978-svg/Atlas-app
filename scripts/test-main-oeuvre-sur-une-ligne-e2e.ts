import assert from "node:assert";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;

// LA CARTE « AVANT DE CHIFFRER », SUR UNE LIGNE, parcourue comme le patron.
//
// **Sa planche du 16 novembre 2026, son « ok » du 17**
// (`appli/soignee/carte-main-d-oeuvre-sur-une-ligne.html`) : sur une ligne,
// la croix de chaque travail ne changeait rien au devis. Elle sort de ce mode ;
// à sa place, le prix que le travail aura sur le devis, sa grille sinon
// « À chiffrer ».
//
// **Ce qu'aucune autre suite ne verrait** (`CLAUDE.md` §5 quater) : la règle
// est éprouvée sans écran (`test-repartir-main-oeuvre.ts`) et le devis sans
// navigateur (`test-main-oeuvre-dictee-db.ts`). Ici, il barre un travail en
// « Répartis », passe « sur une ligne », et le devis porte exactement les prix
// que la carte lui a montrés.

const DICTEE = `Alors il y a une taille de haie de laurier, vingt mètres de long, un chêne mort à abattre, de vingt mètres de haut. On coupe le bois en cinquante centimètres, on le laisse sur place, on le fend. Pour ce faire, on aura besoin d'un camion, un broyeur et une fendeuse. On évacue tous les déchets verts du jardin jusqu'à la déchetterie de la commune voisine avec la remorque deux fois dans la journée. J'estime le temps de travail à deux jours deux hommes.`;

/** Un chantier À ELLE : récrire celui du seed abîmerait la suite d'une autre. */
async function preparerChantier(): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: e } = await client.query(`SELECT id FROM entreprises ORDER BY created_at LIMIT 1`);
    assert.ok(e[0], "Aucune entreprise en base : le jeu de démonstration n'a pas été semé.");
    const entrepriseId = e[0].id as string;
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);
    const { rows: ch } = await client.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1, $2) RETURNING id`,
      [entrepriseId, `Essai main d'œuvre sur une ligne ${process.pid}`]
    );
    const chantierId = ch[0].id as string;
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum, transcription, transcription_statut)
       VALUES ($1, $2, NULL, 'audio/webm', 0, 'essai', $3, 'reussie')`,
      [entrepriseId, chantierId, DICTEE]
    );
    console.log(`   chantier d'essai : ${chantierId}`);
    return chantierId;
  } finally {
    await client.end();
  }
}

async function lignesDuChantier(chantierId: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT libelle, montant::text, a_chiffrer, main_doeuvre FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
      [chantierId]
    );
    return rows as { libelle: string; montant: string | null; a_chiffrer: boolean; main_doeuvre: boolean }[];
  } finally {
    await client.end();
  }
}

/** « 1 297 € » : l'écran sépare les milliers d'une espace fine. */
const lireEuros = (texte: string) => Number(texte.replace(/[^0-9,]/g, "").replace(",", "."));
const espaces = (texte: string) => texte.replace(/\s+/g, " ").trim();

async function main() {
  const chantierId = await preparerChantier();
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });

    await page.goto(`${BASE}/chantiers/${chantierId}/transcription`, { waitUntil: "networkidle" });
    await page.click("text=Créer le devis à partir de ma dictée");

    const carte = page.locator('[data-atlas="question-main-oeuvre"]');
    await carte.waitFor({ timeout: 60000 });
    const lignes = carte.locator('[data-atlas="travail-main-oeuvre"]');
    const croix = carte.getByRole("button", { name: /^Retirer .+ de la main d.œuvre$/ });
    const remettre = carte.getByRole("button", { name: "Remettre" });

    // --- En « Répartis », il barre le premier travail ------------------------
    const reparti = carte.locator("button", { hasText: /^Répartis sur les travaux$/ });
    if ((await reparti.getAttribute("aria-pressed")) !== "true") await reparti.click();
    await carte.locator('[data-atlas="barre-main-oeuvre"]').waitFor();
    const combien = await lignes.count();
    assert.ok(combien >= 1, "aucun travail sur la carte : la mesure ne mesure rien");
    await croix.first().click();
    await remettre.waitFor();

    // --- Il passe « sur une ligne » -----------------------------------------
    await carte.locator("button", { hasText: /^Sur une ligne Main d.œuvre$/ }).click();
    await carte.locator('[data-atlas="barre-main-oeuvre"]').waitFor({ state: "detached" });
    assert.equal(await croix.count(), 0, "une croix reste sur une ligne, où elle ne change rien");
    assert.equal(await remettre.count(), 0, "le travail barré en « Répartis » reste barré sur une ligne");
    assert.equal(await lignes.count(), combien, "un travail a disparu de la carte");

    const vus: { nom: string; prix: string }[] = [];
    for (let i = 0; i < combien; i++) {
      const l = lignes.nth(i);
      vus.push({
        // Sur une ligne, pas de pastille de couleur : le premier texte est l'intitulé.
        nom: espaces(await l.locator("span").first().innerText()),
        prix: espaces(await l.locator('[data-atlas="prix-du-travail"]').innerText()),
      });
    }
    console.log(`   la carte : ${vus.map((v) => `${v.nom} ${v.prix}`).join(", ")}`);
    for (const v of vus) assert.match(v.prix, /^(\d[\d ]*(,\d+)? €|À chiffrer)$/, `« ${v.nom} » montre « ${v.prix} »`);

    // --- Et le devis porte ce que la carte a montré -------------------------
    await page.locator("button", { hasText: /^Continuer/ }).first().click();
    await page.waitForURL(`**/chantiers/${chantierId}/devis-complet`, { timeout: 60000 });
    const ecrites = await lignesDuChantier(chantierId);
    assert.ok(ecrites.some((l) => l.main_doeuvre), `aucune ligne Main d'œuvre : ${ecrites.map((l) => l.libelle).join(" || ")}`);
    for (const v of vus) {
      const ligne = ecrites.find((l) => !l.main_doeuvre && l.libelle.startsWith(v.nom));
      assert.ok(ligne, `« ${v.nom} » n'est pas sur le devis : ${ecrites.map((l) => l.libelle).join(" || ")}`);
      if (v.prix === "À chiffrer") {
        assert.ok(ligne.a_chiffrer, `la carte disait « ${v.nom} » à chiffrer, le devis écrit ${ligne.montant} €`);
      } else {
        assert.ok(!ligne.a_chiffrer, `la carte montrait ${v.prix} pour « ${v.nom} », le devis l'écrit à chiffrer`);
        assert.equal(Number(ligne.montant), lireEuros(v.prix), `la carte montrait ${v.prix} pour « ${v.nom} », le devis écrit ${ligne.montant} €`);
      }
    }

    console.log("✅ Sur une ligne, aucune croix : chaque travail montre son prix, et le devis porte exactement ces prix.");
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
