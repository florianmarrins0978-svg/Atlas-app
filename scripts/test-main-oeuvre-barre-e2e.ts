import assert from "node:assert";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;

// LA BARRE DE LA MAIN D'ŒUVRE, parcourue comme le patron la parcourt.
//
// **Sa planche du 27 octobre 2026** (`appli/soignee/main-oeuvre-curseur.html`),
// choisie le soir même : une barre pour tout le total, une poignée entre deux
// travaux, un montant qui se touche pour s'écrire. Et sa réponse sur
// l'arrondi : *« si la main d'œuvre c'est 397, ça pourra pas être arrondi à
// 10 »*. Un montant écrit reste à l'euro près.
//
// **Ce qu'aucune autre suite ne verrait** (`CLAUDE.md` §5 quater) : les règles
// sont éprouvées sans écran (`test-repartir-main-oeuvre.ts`), le devis sans
// navigateur (`test-main-oeuvre-dictee-db.ts`). Ce qui n'existe qu'ici, c'est
// la chaîne par la porte d'entrée : il dicte, il écrit un montant, il tire une
// poignée, et le devis porte au centime ce que la barre lui a montré. Avant ce
// lot, 297 € écrits devenaient 300 € en route, sans que rien ne le dise.

const DICTEE = `Alors il y a une taille de haie de laurier, vingt mètres de long, un chêne mort à abattre, de vingt mètres de haut. On coupe le bois en cinquante centimètres, on le laisse sur place, on le fend. Pour ce faire, on aura besoin d'un camion, un broyeur et une fendeuse. J'estime le temps de travail à deux jours deux hommes.`;

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
      [entrepriseId, `Essai barre main d'œuvre ${process.pid}`]
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

async function lignesDuChantier(chantierId: string): Promise<{ libelle: string; montant: number }[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
    return rows.map((r) => ({ libelle: r.libelle as string, montant: Number(r.montant) }));
  } finally {
    await client.end();
  }
}

/** « 1 297 € » : l'écran sépare les milliers d'une espace fine. */
const lireEuros = (texte: string) => Number(texte.replace(/[^0-9,]/g, "").replace(",", "."));

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
    const reparti = carte.locator("button", { hasText: /^Répartis sur les travaux$/ });
    if ((await reparti.getAttribute("aria-pressed")) !== "true") await reparti.click();
    await carte.locator('[data-atlas="barre-main-oeuvre"]').waitFor();

    const lignes = carte.locator('[data-atlas="travail-main-oeuvre"]');
    const lire = async () => {
      const n = await lignes.count();
      const vus: { nom: string; montant: number }[] = [];
      for (let i = 0; i < n; i++) {
        const l = lignes.nth(i);
        const montant = await l.locator('[data-atlas="montant-main-oeuvre"]').innerText();
        vus.push({ nom: (await l.locator("span").nth(1).innerText()).trim(), montant: lireEuros(montant) });
      }
      return vus;
    };
    const totalAffiche = lireEuros(
      await carte.locator("span", { hasText: /^Total main d.œuvre$/ }).locator("xpath=following-sibling::span").innerText()
    );
    const depart = await lire();
    console.log(`   au départ : ${depart.map((v) => `${v.nom} ${v.montant}`).join(", ")} sur ${totalAffiche} €`);
    assert.ok(depart.length >= 2, `il faut deux travaux pour répartir, la carte en montre ${depart.length}`);
    assert.equal(await carte.locator('[data-atlas="poignee-main-oeuvre"]').count(), depart.length - 1, "une poignée par joint");
    // Les pourcentages sont partis avec l'ancien curseur : ils faisaient 101 %.
    assert.doesNotMatch(await carte.innerText(), /\d\s*%/, "un pourcentage s'affiche encore");

    // --- Il touche un montant et l'écrit, à l'euro près ---------------------
    const premier = depart[0].montant;
    const ecrit = premier >= 20 ? Math.floor(premier / 10) * 10 - 3 : premier + 7;
    await lignes.first().locator('[data-atlas="montant-main-oeuvre"]').click();
    const champ = carte.locator('input[aria-label^="Montant de"]');
    await champ.fill(String(ecrit));
    await champ.press("Enter");
    const apresEcrit = await lire();
    assert.equal(apresEcrit[0].montant, ecrit, `il a écrit ${ecrit} €, la ligne montre ${apresEcrit[0].montant} €`);
    assert.equal(
      apresEcrit.reduce((s, v) => s + v.montant, 0),
      totalAffiche,
      `le total ne tombe plus juste : ${JSON.stringify(apresEcrit)}`
    );

    // --- Il tire la dernière poignée vers la gauche --------------------------
    //
    // **La dernière, exprès** : quand des travaux sont « à chiffrer » (0 €),
    // leurs poignées s'empilent au bout de la barre, et c'est celle du dessus
    // que le doigt attrape. Le premier passage de cette suite a rougi là, sur
    // « la poignée n'a rien déplacé » : elle séparait deux travaux vides.
    const k = depart.length - 2;
    const poignee = carte.locator('[data-atlas="poignee-main-oeuvre"]').nth(k);
    const boite = (await poignee.boundingBox())!;
    const x = boite.x + boite.width / 2;
    const y = boite.y + boite.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x - i * 5, y);
    await page.mouse.up();
    const apresGlisse = await lire();
    console.log(`   après la poignée : ${apresGlisse.map((v) => `${v.nom} ${v.montant}`).join(", ")}`);
    const bouges = apresGlisse.map((v, i) => (v.montant !== apresEcrit[i].montant ? i : -1)).filter((i) => i >= 0);
    assert.ok(bouges.length > 0, "la poignée n'a rien déplacé");
    assert.ok(
      bouges.length === 2 && bouges[1] === bouges[0] + 1,
      `une poignée ne change que deux travaux voisins, ici : ${bouges.map((i) => apresGlisse[i].nom).join(", ")}`
    );
    assert.equal(apresGlisse.reduce((s, v) => s + v.montant, 0), totalAffiche, "le total ne tombe plus juste après la poignée");

    // --- Et le devis porte ce que la barre a montré -------------------------
    await page.locator("button", { hasText: /^Continuer/ }).first().click();
    await page.waitForURL(`**/chantiers/${chantierId}/devis-complet`, { timeout: 60000 });
    const ecrites = await lignesDuChantier(chantierId);
    for (const vu of apresGlisse) {
      const ligne = ecrites.find((l) => l.libelle === vu.nom);
      assert.ok(ligne, `« ${vu.nom} » n'est pas sur le devis : ${ecrites.map((l) => l.libelle).join(" || ")}`);
      assert.equal(ligne.montant, vu.montant, `la barre montrait ${vu.montant} € pour « ${vu.nom} », le devis écrit ${ligne.montant} €`);
    }

    console.log("✅ Il écrit un montant à l'euro près, tire une poignée, et le devis porte exactement ce que la barre a montré.");
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
