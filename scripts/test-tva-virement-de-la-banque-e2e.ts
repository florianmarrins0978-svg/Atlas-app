import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE, ACCUEIL_EXACT } from "./_adresse";

// **SA B DU 28 OCTOBRE 2026** (`appli/banque-numero-et-termines.html`, « A ou
// B, dans Terminés ») : quand la banque a vu un virement pour une facture en
// attente, la ligne de Ma TVA garde « J'ai reçu le paiement » et « J'ai reçu
// une partie », déjà remplis avec la date et le montant de la banque.
//
// Ce que cette suite tient, et que la règle pure (`test-virement-en-mots.ts`)
// ne peut pas tenir : le geste du patron range CE virement (la carte de
// l'accueil ne le repose plus), et un virement qui ne paie qu'une partie ne
// solde rien d'un appui.

const BASE = ADRESSE;

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** Une facture émise et non payée, de `montant` € HT, et son numéro. */
async function factureEnAttente(page: Page, suffixe: string, montant: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Banque ${suffixe} ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', "10 rue des Lilas, Nantes");
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
  const chantierId = url.split("/").pop()!;
  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Taille de haie");
  await champs.nth(1).fill(montant);
  await champs.nth(1).blur();
  await page.waitForTimeout(500);
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(ACCUEIL_EXACT, { timeout: 15000 });
  await pool.query("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId]);
  await page.goto(`${url}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector('[data-atlas="ajouter-travaux-supplementaires"]', { timeout: 15000 });
  await page.click('[data-atlas="envoyer-la-facture"]');
  await page.waitForSelector("text=arrêtée", { timeout: 15000 });
  const { rows } = await pool.query(
    "SELECT id, entreprise_id, numero_commercial, total_ttc FROM factures WHERE chantier_id = $1",
    [chantierId]
  );
  assert.equal(rows.length, 1, "la facture n'a pas été émise : rien n'est mesuré");
  return rows[0] as { id: string; entreprise_id: string; numero_commercial: string; total_ttc: string };
}

/** Ce que la lecture de la banque aurait rangé : un virement d'aujourd'hui, le numéro dans le libellé. */
async function virementVu(f: { entreprise_id: string; numero_commercial: string }, montant: string) {
  const { rows } = await pool.query(
    `INSERT INTO virements_recus (entreprise_id, cle, jour, montant, payeur, libelle)
     VALUES ($1, $2, CURRENT_DATE, $3, 'M BANQUE', $4) RETURNING id, to_char(jour, 'YYYY-MM-DD') AS jour`,
    [f.entreprise_id, `essai-${Date.now()}-${Math.random()}`, montant, `VIR ${f.numero_commercial}`]
  );
  return rows[0] as { id: string; jour: string };
}

async function attendreLaReponse(virementId: string) {
  for (let i = 0; i < 40; i++) {
    const { rows } = await pool.query("SELECT etat FROM virements_recus WHERE id = $1", [virementId]);
    if (rows[0]?.etat !== "nouveau") return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

const ligneDe = (page: Page, numero: string) => page.locator("li").filter({ hasText: numero });

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await seConnecter(contexte);
  await pool.query("UPDATE entreprises SET tva_exigibilite = 'encaissements'");

  await test("la banque a vu le virement entier : les deux boutons restent, et « J'ai reçu le paiement » range CE virement", async () => {
    const f = await factureEnAttente(page, "entier", "200");
    const v = await virementVu(f, f.total_ttc);
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = ligneDe(page, f.numero_commercial);
    await ligne.locator('[data-atlas="virement-sur-la-facture"]').waitFor({ timeout: 15000 });
    assert.equal(await ligne.locator('[data-atlas="oui-virement"]').count(), 0, "la question Oui ou Non est revenue (variante A)");
    assert.ok(await ligne.locator('[data-atlas="noter-un-reglement"]').isVisible(), "« J'ai reçu une partie » a disparu");
    assert.ok(await ligne.getByText("Date et montant de la banque déjà remplis.").isVisible());
    await ligne.locator('[data-atlas="solder-la-facture"]').click();
    // Attendre que la base le dise, jamais un délai fixe (`CLAUDE.md` §5). Le
    // numéro, lui, reste à l'écran : la facture payée rejoint la TVA collectée.
    await attendreLaReponse(v.id);
    const { rows } = await pool.query("SELECT etat, facture_id, paiement_id FROM virements_recus WHERE id = $1", [v.id]);
    assert.equal(rows[0].etat, "confirme", "le virement n'a pas reçu sa réponse : l'accueil le reposerait");
    assert.equal(rows[0].facture_id, f.id);
    assert.ok(rows[0].paiement_id, "aucun paiement n'est relié au virement");
  });

  await test("un virement qui n'en paie qu'une partie : rien ne se solde d'un appui, la saisie part remplie par la banque", async () => {
    const f = await factureEnAttente(page, "partie", "1000");
    const v = await virementVu(f, "300.00");
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = ligneDe(page, f.numero_commercial);
    await ligne.locator('[data-atlas="virement-sur-la-facture"]').waitFor({ timeout: 15000 });
    assert.ok(
      await ligne.locator('[data-atlas="solder-la-facture"]').isDisabled(),
      "« J'ai reçu le paiement » solderait toute la facture sur un virement de 300 €"
    );
    await ligne.locator('[data-atlas="noter-un-reglement"]').click();
    const montant = ligne.getByLabel("Montant reçu, en euros");
    assert.equal(await montant.inputValue(), "300,00", "le montant de la banque n'est pas rempli");
    assert.equal(await ligne.getByLabel("Date du paiement").inputValue(), v.jour, "la date de la banque n'est pas remplie");
    await ligne.getByRole("button", { name: "Enregistrer ce règlement" }).click();
    await attendreLaReponse(v.id);
    const { rows } = await pool.query(
      "SELECT v.etat, v.facture_id, p.montant FROM virements_recus v LEFT JOIN paiements_facture p ON p.id = v.paiement_id WHERE v.id = $1",
      [v.id]
    );
    assert.equal(rows[0].etat, "confirme", "la saisie remplie par la banque n'a pas rangé le virement");
    assert.equal(rows[0].facture_id, f.id);
    assert.equal(rows[0].montant, "300.00");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await contexte.close();
  await navigateur.close();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
