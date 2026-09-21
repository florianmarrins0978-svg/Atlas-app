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

  // **Ce que le navigateur ENVOIE, et pas seulement ce que la base garde.**
  // Un prix qui n'arrive pas a deux causes possibles — la requête n'est pas
  // partie, ou elle est partie avec l'ancienne valeur — et le rouge doit dire
  // laquelle. Six enquêtes ont été payées faute de cette ligne
  // (`DevisCompletClient.tsx`, 30 août 2026).
  const envois: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "POST") return;
    const corps = r.postData() ?? "";
    if (corps.includes("prixUnitaire")) envois.push(corps.slice(0, 160));
  });

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

  // --- 4 bis. Deux champs enchaînés : le prix ne se fait pas écraser -------
  //
  // **Son geste réel, et c'est lui qui perdait l'argent.** Il écrit la
  // description, passe au prix, tape 850, quitte : deux sorties de champ
  // rapprochées, qui envoient chacune la ligne ENTIÈRE. Parties ensemble,
  // elles arrivent dans l'ordre du réseau — et celle de la description repose
  // un prix à zéro par-dessus les 850 €. La facture partait alors à 0,00 €,
  // bouton « Envoyer » éteint.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Deux champs ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierPrix = await creerPuisFiche(page);
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });

  // Sans attente entre les deux : c'est l'enchaînement qui fabrique la course.
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier");
  await page.getByLabel("Prix unitaire 1").fill("850");
  await page.getByLabel("Description 1").click();

  const prixEcrit = await attendreEnBase(
    () => pool.query(`SELECT montant FROM lignes_prix WHERE chantier_id = $1`, [chantierPrix]),
    (r) => r.rows[0]?.montant === "850.00"
  );
  assert.equal(
    prixEcrit.rows[0]?.montant,
    "850.00",
    `Le prix tapé n'est pas arrivé : la base porte « ${prixEcrit.rows[0]?.montant} ».\n` +
      `Ce que le navigateur a envoyé :\n  ${envois.join("\n  ") || "(aucune écriture de ligne)"}`
  );
  console.log("  ✓ la description puis le prix, enchaînés : le prix tient");

  // --- 5. L'ordre qu'il voit est l'ordre que son client lira ---------------
  //
  // **Le piège de la ligne ouverte, et il ne se voit qu'au rechargement.** Son
  // rang en base se décide à l'ÉCRITURE : s'il appuie sur « + Ajouter une
  // ligne » avant d'avoir écrit, la ligne du dessous est écrite la première et
  // passe devant. Les deux se croisent, et c'est le devis du client qui change
  // d'ordre.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Deux lignes ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierDeux = await creerPuisFiche(page);
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });

  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Abattage — la première");
  await page.getByLabel("Description 1").blur();
  await page.getByLabel("Description 2").fill("Évacuation — la seconde");
  await page.getByLabel("Description 2").blur();

  const deux = await attendreEnBase(
    () => pool.query(`SELECT libelle FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`, [chantierDeux]),
    (r) => r.rowCount === 2
  );
  assert.equal(deux.rowCount, 2, `Le devis porte ${deux.rowCount} ligne(s) au lieu de deux.`);
  assert.match(
    deux.rows[0].libelle,
    /première/i,
    `Les lignes se sont croisées : la base lit « ${deux.rows.map((l) => l.libelle).join(" | ")} ».`
  );
  console.log("  ✓ la ligne ouverte garde son rang quand il en ajoute une seconde");

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ La ligne du devis est ouverte d'avance, et rien n'est écrit avant son premier mot.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
