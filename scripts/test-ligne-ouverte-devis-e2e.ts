import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * **« Quand j'ouvre la page du devis il doit avoir une ligne d'ouverte déjà, je
 * dois pas avoir besoin de cliquer sur ajouter une ligne. »** — le patron,
 * 20 septembre 2026, capture à l'appui.
 *
 * Cette suite éprouve SON geste, pas la fonction qu'on vient d'écrire
 * (`CLAUDE.md` §5 quater) : elle arrive sur le devis comme lui, et écrit dans
 * la case qui l'attend — sans jamais toucher « + Ajouter une ligne ».
 *
 * **Et elle tient l'autre moitié, celle qui ne se voit pas :** tant qu'il n'a
 * rien écrit, la base ne porte AUCUNE ligne. Une ligne vide posée à l'ouverture
 * ferait disparaître une dictée (`src/lib/ligne-ouverte-devis.ts`, la panne du
 * 7 août 2026) — c'est le défaut que ce contrôle surveille, et il ne se voit
 * qu'en regardant la base.
 */

async function attendreEnBase<T>(lire: () => Promise<T>, tient: (v: T) => boolean, msMax = 20_000): Promise<T> {
  const fin = Date.now() + msMax;
  let dernier = await lire();
  while (!tient(dernier) && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 200));
    dernier = await lire();
  }
  return dernier;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Ligne ouverte ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);

  const lignesEnBase = () =>
    pool.query(`SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);

  // --- 1. La case est là en arrivant --------------------------------------
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });
  const description = page.getByLabel("Description 1");
  assert.equal(
    await description.count(),
    1,
    "Le devis s'ouvre sans case à écrire : il faut encore appuyer sur « + Ajouter une ligne »."
  );
  assert.equal(await description.inputValue(), "", "La case ouverte d'avance porte déjà quelque chose.");
  const feuille = await page.locator("body").innerText();
  assert.ok(
    !/Aucune ligne pour l'instant/i.test(feuille),
    "Le devis annonce « Aucune ligne pour l'instant » alors qu'une ligne est ouverte."
  );
  console.log("  ✓ le devis s'ouvre avec sa première ligne, sans un geste de plus");

  // --- 2. Rien n'est écrit tant qu'il n'a rien écrit -----------------------
  //
  // **C'est ici que se joue la panne du 7 août.** Une ligne vide en base, et la
  // dictée qu'il enregistrerait ensuite n'écrirait plus rien sur ce devis.
  const avant = await lignesEnBase();
  assert.equal(avant.rowCount, 0, `Le devis porte déjà ${avant.rowCount} ligne(s) en base, sans un mot écrit.`);

  // Le doigt posé sur la case puis retiré : le devis enregistre à la sortie de
  // chaque champ, et cette sortie-là ne doit rien écrire.
  await description.click();
  await page.getByLabel("Prix unitaire 1").click();
  await page.getByLabel("Prix unitaire 1").blur();
  await page.waitForTimeout(1500);
  const traversee = await lignesEnBase();
  assert.equal(
    traversee.rowCount,
    0,
    `Traverser les cases a écrit ${traversee.rowCount} ligne(s) vide(s) : une dictée enregistrée ensuite serait perdue.`
  );
  console.log("  ✓ traverser les cases n'écrit aucune ligne vide en base");

  // --- 3. Le premier mot la fait naître, une seule fois --------------------
  await description.fill("Abattage d'un chêne mort");
  await description.blur();
  await page.getByLabel("Prix unitaire 1").fill("1250");
  await page.getByLabel("Prix unitaire 1").blur();

  const ecrites = await attendreEnBase(lignesEnBase, (r) => r.rows[0]?.montant === "1250.00");
  assert.equal(
    ecrites.rowCount,
    1,
    `Le devis porte ${ecrites.rowCount} ligne(s) : la ligne ouverte a été écrite plusieurs fois.`
  );
  assert.equal(ecrites.rows[0].montant, "1250.00", `Montant enregistré : ${ecrites.rows[0].montant}`);
  assert.match(ecrites.rows[0].libelle, /chêne mort/i, `Libellé enregistré : ${ecrites.rows[0].libelle}`);
  console.log("  ✓ ce qu'il écrit dans la ligne ouverte arrive en base, une seule fois");

  // --- 4. Au rechargement, sa ligne — et pas une case de plus --------------
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });
  assert.match(
    await page.getByLabel("Description 1").inputValue(),
    /chêne mort/i,
    "La ligne écrite ne se retrouve pas au rechargement."
  );
  assert.equal(
    await page.getByLabel("Description 2").count(),
    0,
    "Une case vide s'ajoute sous son travail : la ligne ouverte revient sur un devis déjà rempli."
  );
  console.log("  ✓ un devis qui porte déjà une ligne n'en ouvre pas une de plus");

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ La ligne du devis est ouverte d'avance, et rien n'est écrit avant son premier mot.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
