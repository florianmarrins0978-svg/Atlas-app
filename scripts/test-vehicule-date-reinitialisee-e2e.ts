import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/**
 * « Réinitialiser » du sélecteur de date d'iPhone doit VIDER la case — sa
 * capture du 20 octobre 2026 : *« je ne peux pas réinitialiser la date »*.
 *
 * Ce que fait l'iPhone, lu dans WebKit (`WKDateTimeInputControl.mm`) : ouvrir
 * une case de date VIDE y écrit aussitôt la date du jour (`_dateChanged`), et
 * « Réinitialiser » la vide ensuite (`setFocusedElementValue` à ""), chaque fois
 * avec les évènements `input` et `change`. L'écran recevait donc « aujourd'hui »
 * puis « », et comparait le vide à la valeur affichée AVANT l'ouverture, encore
 * vide elle aussi : le vide ne partait jamais, et la date du jour restait.
 *
 * Chromium n'a pas ce sélecteur : la suite rejoue la même suite d'évènements.
 */

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  const entrepriseId = rows[0]?.entreprise_id as string | undefined;
  assert.ok(entrepriseId, "le compte de démonstration est absent : la base n'est pas amorcée");
  const v = await pool.query(`INSERT INTO vehicules (entreprise_id, nom) VALUES ($1, 'Camion date e2e') RETURNING id`, [entrepriseId]);
  const id = v.rows[0].id as string;

  const browser = await lancerNavigateur();
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });

    await page.goto(`${BASE}/reglages/vehicules/${id}`, { waitUntil: "networkidle" });
    const caseDate = page.locator('[data-atlas="champ-controleTechniqueAvant"] input');
    await caseDate.waitFor();
    assert.equal(await caseDate.inputValue(), "", "la case doit partir vide");

    const aujourdhui = new Date().toISOString().slice(0, 10);
    // Comme WebKit : la valeur est posée par le moteur, sans passer par le
    // setter que React surveille, puis `input` et `change` partent.
    const poser = (valeur: string) =>
      caseDate.evaluate((el, val) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, valeur);

    await caseDate.focus();
    await poser(aujourdhui); // l'ouverture
    await poser(""); // « Réinitialiser »
    await caseDate.blur(); // le ✓
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const apres = await pool.query(`SELECT controle_technique_avant::text AS d FROM vehicules WHERE id = $1`, [id]);
    assert.equal(apres.rows[0].d, null, `« Réinitialiser » doit vider la case, elle vaut ${apres.rows[0].d}`);

    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await caseDate.inputValue(), "", "après rechargement, la case doit rester vide");
    console.log("✅ « Réinitialiser » vide la date d'un véhicule.");
  } finally {
    await browser.close();
    await pool.query(`DELETE FROM vehicules WHERE id = $1`, [id]);
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
