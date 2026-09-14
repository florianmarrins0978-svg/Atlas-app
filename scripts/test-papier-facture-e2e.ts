import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { adresseDeLaVisionneuse } from "../src/lib/visionneuse-pdf";

/**
 * LE PAPIER, DU DEVIS À LA FACTURE — sa planche du 14 septembre 2026, par SON
 * chemin (`CLAUDE.md` §5 quater) : le devis a tous les boutons qui mènent à la
 * planche, la facture aussi, et le papier qui sort est celui qu'il a validé.
 *
 *   · devis : « Titre (optionnel) », « + Main d'œuvre », « + Remise »,
 *     « + Ajouter un acompte », la colonne Unité — tout y est ;
 *   · facture : le titre recopié, « + Main d'œuvre », « + Règlement reçu » qui
 *     pose « Acompte 30 % » avec le montant du devis, le moyen à choisir, le
 *     numéro du chèque, « Facture acquittée » qui met le net à zéro ;
 *   · le PDF se regarde dans la visionneuse, et il est capturé — c'est la
 *     capture qui se compare à la planche, pas un vert.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Les montants portent une espace fine (U+202F) et une insécable (U+00A0) : on les ramène à l'espace.
const lisible = (t: string) => t.replace(/[  ]/g, " ");

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();
  mkdirSync(CAPTURES, { recursive: true });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Le réglage de l'acompte, pour que le devis en pose un d'office.
  const { rows: demo } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(demo[0]?.entreprise_id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const entrepriseId: string = demo[0].entreprise_id;
  const { rows: avant } = await pool.query(`SELECT acompte_pourcent FROM entreprises WHERE id = $1`, [entrepriseId]);
  await pool.query(`UPDATE entreprises SET acompte_pourcent = 30 WHERE id = $1`, [entrepriseId]);

  try {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Mme Grospiron ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 98 76 54 32");
    const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
    const chantierId = url.split("/").pop()!;

    // Trois lignes par l'écran du devis — comme lui —, puis leur quantité et
    // leur unité posées en base : le devis se régénère depuis les prix.
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    for (const [rang, [libelle, prix]] of [
      ["Terrassement et préparation du sol", "380"],
      ["Fourniture de gazon en rouleau", "780"],
      ["Bordures acier corten", "432"],
    ].entries()) {
      await page.click('button:has-text("Ajouter une ligne")');
      const zones = page.locator('textarea[aria-label*="escription"]');
      for (const essai of [1, 2, 3, 4, 5]) {
        if ((await zones.count()) > rang) break;
        await page.waitForTimeout(essai * 300);
      }
      await zones.nth(rang).fill(libelle);
      // Un clic AVANT de remplir : le champ replace le curseur au bout et défait
      // le tout-sélectionner de fill() (`ChampsDuDevis.tsx`, « auBout »).
      const champPrix = page.locator('input[aria-label*="Prix unitaire"]').nth(rang);
      await champPrix.click();
      await champPrix.fill(prix);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(400);
    }
    await pool.query(
      `UPDATE lignes_prix SET quantite = CASE libelle WHEN 'Fourniture de gazon en rouleau' THEN 120 WHEN 'Bordures acier corten' THEN 24 ELSE 1 END,
         prix_unitaire = CASE libelle WHEN 'Fourniture de gazon en rouleau' THEN 6.50 WHEN 'Bordures acier corten' THEN 18 ELSE 380 END,
         unite = CASE libelle WHEN 'Fourniture de gazon en rouleau' THEN 'm²' WHEN 'Bordures acier corten' THEN 'ml' ELSE 'forfait' END
       WHERE chantier_id = $1`,
      [chantierId]
    );

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    await cas("le devis a tous les boutons qui mènent à la planche : titre, main d'œuvre, remise, acompte, unité", async () => {
      assert.equal(await page.locator('[data-atlas="titre-devis"]').count(), 1, "le champ « Titre (optionnel) » manque");
      assert.equal(await page.locator('[data-atlas="titre-devis"]').getAttribute("placeholder"), "Titre (optionnel)");
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 1, "« + Main d’œuvre » manque");
      assert.equal(await page.locator('[data-atlas="poser-prix-accorde"]').count(), 1, "« + Remise » manque");
      assert.ok((await page.locator('[data-atlas="taux-acompte"]').count()) >= 1, "l'acompte d'office manque");
      assert.ok((await page.locator('input[aria-label^="Unité"]').count()) >= 1, "la colonne Unité manque au devis");
    });

    await cas("le titre tapé sur le devis part en base, et la main d'œuvre aussi", async () => {
      const titre = page.locator('[data-atlas="titre-devis"]');
      await titre.fill("Aménagement du jardin");
      await page.keyboard.press("Tab");
      await page.click('[data-atlas="poser-main-doeuvre"]');
      const mo = page.locator('[data-atlas="montant-main-doeuvre"]');
      await mo.fill("450");
      await page.keyboard.press("Tab");
      let lu: { titre: string | null; mo: string | null } | undefined;
      for (const essai of [0, 1, 2, 3, 4, 5]) {
        if (essai > 0) await new Promise((r) => setTimeout(r, essai * 500));
        const { rows } = await pool.query(`SELECT titre, main_doeuvre_ht AS mo FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`, [chantierId]);
        lu = rows[0];
        if (lu?.titre === "Aménagement du jardin" && lu?.mo === "450.00") break;
      }
      assert.deepEqual(lu, { titre: "Aménagement du jardin", mo: "450.00" });
      await page.screenshot({ path: `${CAPTURES}/papier-devis-ecran.png`, fullPage: true });
    });

    // Le devis part chez le client — c'est ce qui autorise la facture.
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 10_000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
    await pool.query("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId]);

    await page.goto(`${url}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Créer la facture");
    await page.waitForSelector('[data-atlas="reglements-recus"]', { timeout: 20_000 });

    await cas("la facture recopie le titre et la main d'œuvre, et porte la planche : règlements, acquittée, net", async () => {
      assert.equal(await page.locator('[data-atlas="titre-facture"]').inputValue(), "Aménagement du jardin");
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').inputValue(), "450");
      assert.equal(await page.locator('[data-atlas="poser-reglement"]').count(), 1, "« + Règlement reçu » manque");
      assert.equal(await page.locator('[data-atlas="facture-acquittee"]').count(), 1, "l'interrupteur « Facture acquittée » manque");
      const net = lisible(await page.locator('[data-atlas="net-a-payer"]').innerText());
      assert.ok(net.includes("1 910,40"), `le net à payer devrait être le TTC entier : ${net}`);
    });

    await cas("« + Règlement reçu » pose « Acompte 30 % » avec ce que le devis prévoyait, chèque en tête", async () => {
      await page.click('[data-atlas="poser-reglement"]');
      await page.waitForSelector('[data-atlas="reglement-recu"]', { timeout: 10_000 });
      assert.equal(await page.locator('[data-atlas="nom-acompte"]').first().innerText(), "Acompte 30 %");
      assert.equal(await page.locator('[data-atlas="moyen-reglement"]').first().inputValue(), "cheque");
      assert.equal(await page.locator('[data-atlas="numero-cheque"]').count(), 1, "un chèque a sa case pour le numéro");
      assert.equal(await page.locator('[data-atlas="montant-reglement"]').first().inputValue(), "573,12");
      const net = lisible(await page.locator('[data-atlas="net-a-payer"]').innerText());
      assert.ok(net.includes("1 337,28"), `le net ne déduit pas l'acompte : ${net}`);
    });

    await cas("le numéro du chèque part en base ; un virement n'a pas de numéro", async () => {
      const numero = page.locator('[data-atlas="numero-cheque"]').first();
      await numero.fill("1806028");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(600);
      const { rows } = await pool.query(
        `SELECT p.numero, p.moyen FROM paiements_facture p JOIN factures f ON f.id = p.facture_id WHERE f.chantier_id = $1`,
        [chantierId]
      );
      assert.deepEqual(rows, [{ numero: "1806028", moyen: "cheque" }]);
      await page.locator('[data-atlas="moyen-reglement"]').first().selectOption("virement");
      await page.waitForTimeout(600);
      assert.equal(await page.locator('[data-atlas="numero-cheque"]').count(), 0, "un virement garde une case de numéro");
      await page.screenshot({ path: `${CAPTURES}/papier-facture-ecran.png`, fullPage: true });
    });

    await cas("« Facture acquittée » met le net à zéro, et l'éteindre le rend", async () => {
      await page.click('[data-atlas="facture-acquittee"]');
      await page.waitForTimeout(800);
      assert.equal(lisible(await page.locator('[data-atlas="net-a-payer"]').innerText()), lisible("0,00 €"));
      assert.equal(await page.locator('[data-atlas="acquittee"]').count(), 1);
      assert.equal(await page.locator('[data-atlas="nom-acompte"]').nth(1).innerText(), "Acompte");
      await page.click('[data-atlas="facture-acquittee"]');
      await page.waitForTimeout(800);
      assert.ok(lisible(await page.locator('[data-atlas="net-a-payer"]').innerText()).includes("1 337,28"));
    });

    await cas("le papier se regarde dans l'application, et il est capturé", async () => {
      const { rows } = await pool.query(`SELECT id, numero_commercial FROM factures WHERE chantier_id = $1`, [chantierId]);
      await page.goto(
        `${BASE}${adresseDeLaVisionneuse(`/api/factures/${rows[0].id}/pdf`, { surtitre: "Facture", titre: rows[0].numero_commercial })}`,
        { waitUntil: "networkidle" }
      );
      await page.waitForSelector("canvas", { timeout: 30_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${CAPTURES}/papier-facture-pdf.png`, fullPage: true });
      const { rows: d } = await pool.query(`SELECT id, numero_commercial FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`, [chantierId]);
      await page.goto(
        `${BASE}${adresseDeLaVisionneuse(`/api/devis/${d[0].id}/pdf`, { surtitre: "Devis", titre: d[0].numero_commercial })}`,
        { waitUntil: "networkidle" }
      );
      await page.waitForSelector("canvas", { timeout: 30_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${CAPTURES}/papier-devis-pdf.png`, fullPage: true });
    });
  } finally {
    await pool.query(`UPDATE entreprises SET acompte_pourcent = $2 WHERE id = $1`, [entrepriseId, avant[0]?.acompte_pourcent ?? null]);
    await navigateur.close();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le papier, du devis à la facture — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
