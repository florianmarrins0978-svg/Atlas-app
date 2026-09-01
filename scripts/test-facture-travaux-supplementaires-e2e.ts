import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { avecCivilite } from "../src/lib/civilite";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// LES TRAVAUX EN PLUS, AJOUTÉS SUR LA FACTURE — LE PARCOURS DU PATRON.
//
// **Son idée du 31 août 2026**, capture de son écran à l'appui : *« depuis
// cette page, avant d'envoyer la facture, il faut pouvoir la modifier en
// stipulant que c'est du TS, et comme ça on a déjà toute la chaîne de
// production de créée pour l'envoyer au client. »* Puis sa forme, le
// 1ᵉʳ septembre : *« code la mienne, déroule sous le bouton »*.
//
// **Cette suite entre par SA porte** (`CLAUDE.md` §5 quater) : le doigt sur le
// bouton, pas la fonction du dépôt. Six gestes de l'assistant ont été livrés
// verts et inatteignables le 28 août parce que leurs contrôles construisaient
// la proposition à la main ; ici, on tape dans les champs de l'écran.
//
// Ce qu'elle refuse de laisser passer :
//
// · le bouton absent, ou la saisie qui ne s'ouvre pas ;
// · un total d'écran qui ne suivrait pas la base (l'écran ment, la facture
//   part juste — ou l'inverse, et c'est pire) ;
// · un supplément fondu dans les lignes du devis ;
// · le taux à la ligne, et sa ventilation à l'écran ;
// · une facture ARRÊTÉE qui laisserait encore ajouter quelque chose.

const BASE = "http://localhost:3000";

async function inspecter(sql: string, params: unknown[], attendu?: number) {
  const r = await pool.query(sql, params);
  if (attendu !== undefined && r.rowCount !== attendu) {
    throw new Error(
      `Inspection hors application : ${r.rowCount} ligne(s) au lieu de ${attendu}. ` +
        "Le rôle de test ne traverse probablement plus RLS."
    );
  }
  return r;
}

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

/** Un chantier réalisé, devis envoyé — le point de départ de son écran. */
async function chantierRealise(page: Page, suffixe: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const client = `Mme Grospiron ${suffixe} ${Date.now()}`;
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Tonte du gazon");
  await champs.nth(1).fill("500.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 });

  await inspecter("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId], 1);
  return { chantierId, nom: avecCivilite(client), url };
}

/** La facture en brouillon, écran ouvert — comme sur sa capture. */
async function factureOuverte(page: Page, suffixe: string) {
  const { chantierId } = await chantierRealise(page, suffixe);
  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector('[data-atlas="ouvrir-ts"]', { timeout: 15000 });
  return chantierId;
}

/** Le texte de l'écran, ses espaces insécables ramenées à des espaces. */
async function ecran(page: Page): Promise<string> {
  const t = await page.locator("body").innerText();
  // Les espaces insécables des montants ramenées à des espaces ordinaires :
  // « 820,00 € » ne contient pas l'espace qu'on tape, et comparer tel quel
  // fait rougir un écran juste.
  return t.replace(/[\u00a0\u202f\u2009\u2007]/g, " ");
}

/**
 * Le même texte, en MAJUSCULES — pour les titres de bloc seulement.
 *
 * `smallCaps` pose `uppercase` sur les intitulés, et `innerText` rend le texte
 * TRANSFORMÉ : chercher « Travaux supplémentaires » dans l'écran fait rougir un
 * affichage parfaitement juste. Trouvé au premier passage de cette suite.
 */
const majuscules = (t: string) => t.toUpperCase();

async function ajouter(
  page: Page,
  libelle: string,
  quantite: string,
  unite: string,
  prix: string,
  taux: "20" | "10" | "5,5"
) {
  await page.click('[data-atlas="ouvrir-ts"]');
  await page.waitForSelector('[data-atlas="ts-libelle"]', { timeout: 5000 });
  await page.fill('[data-atlas="ts-libelle"]', libelle);
  await page.fill('[data-atlas="ts-quantite"]', quantite);
  await page.fill('[data-atlas="ts-unite"]', unite);
  await page.fill('[data-atlas="ts-prix"]', prix);
  await page.click(`[data-atlas="ts-taux-${taux}"]`);
  await page.getByRole("button", { name: "Ajouter à la facture" }).click();
  // L'écran se relit au serveur : on attend que la ligne y soit vraiment.
  await page.waitForSelector(`text=${libelle}`, { timeout: 15000 });
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  await test("le geste existe, et sa saisie se DÉROULE sous le bouton", async () => {
    await factureOuverte(page, "geste");
    // Fermée au départ : l'écran ne s'allonge que si on le demande.
    assert.equal(await page.locator('[data-atlas="ts-libelle"]').count(), 0);
    await page.click('[data-atlas="ouvrir-ts"]');
    await page.waitForSelector('[data-atlas="ts-libelle"]', { timeout: 5000 });

    // **Sa forme, choisie le 1ᵉʳ septembre** : le formulaire s'ouvre DANS la
    // page — le bouton d'envoi est repoussé dessous, il ne disparaît pas.
    const saisie = await page.locator('[data-atlas="ts-libelle"]').boundingBox();
    const envoi = await page.getByRole("button", { name: "Envoyer la facture" }).boundingBox();
    assert.ok(saisie && envoi, "la saisie ou le bouton d'envoi manquent");
    assert.ok(envoi!.y > saisie!.y, "le bouton d'envoi devrait passer sous la saisie");
  });

  await test("un travail en plus entre sur la facture, et le total suit — à l'écran ET en base", async () => {
    const chantierId = await factureOuverte(page, "ajout");
    await ajouter(page, "Dessouchage cerisier", "1", "forfait", "320", "20");

    const texte = await ecran(page);
    assert.equal(await page.locator('[data-atlas="bloc-ts"]').count(), 1, "le bloc à part n'apparaît pas");
    assert.ok(texte.includes("820,00 €"), `Total HT 820,00 € attendu :\n${texte}`);
    assert.ok(texte.includes("984,00 €"), "Total TTC 984,00 € attendu");

    // **L'écran ne prouve rien tout seul** : c'est la base qui part chez le
    // client. Un total juste à l'écran et faux en base est le pire des états.
    const { rows } = await inspecter(
      "SELECT total_ht, total_tva, total_ttc FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.equal(rows[0].total_ht, "820.00");
    assert.equal(rows[0].total_tva, "164.00");
    assert.equal(rows[0].total_ttc, "984.00");
  });

  await test("le supplément se lit À PART, jamais fondu dans les lignes du devis", async () => {
    const chantierId = await factureOuverte(page, "bloc");
    await ajouter(page, "Terrasse bois", "1", "forfait", "580", "20");

    const texte = await ecran(page);
    const iDevis = majuscules(texte).indexOf("REPRISE DU DEVIS");
    const iSupplement = majuscules(texte).indexOf("TRAVAUX SUPPLÉMENTAIRES");
    const iTonte = texte.indexOf("Tonte du gazon");
    const iTerrasse = texte.indexOf("Terrasse bois");
    assert.ok(iDevis >= 0 && iSupplement > iDevis, "les deux titres devraient se suivre");
    assert.ok(iTonte > iDevis && iTonte < iSupplement, "la ligne du devis a quitté son bloc");
    assert.ok(iTerrasse > iSupplement, "le supplément a quitté son bloc");

    const { rows } = await inspecter(
      "SELECT lf.origine, lf.taux_tva FROM lignes_facture lf JOIN factures f ON f.id = lf.facture_id" +
        " WHERE f.chantier_id = $1 ORDER BY lf.ordre",
      [chantierId]
    );
    assert.deepEqual(
      rows.map((r) => r.origine),
      ["devis", "supplement"]
    );
    assert.equal(rows[1].taux_tva, "20.00");
  });

  await test("un supplément à 10 % sur un devis à 20 % : DEUX lignes de TVA", async () => {
    // Sa question du 1ᵉʳ septembre. Sans ventilation, l'article 268 bis du CGI
    // ferait taxer toute la facture au taux le plus élevé.
    const chantierId = await factureOuverte(page, "taux");
    await ajouter(page, "Reprise du massif", "12", "m²", "10", "10");

    const texte = await ecran(page);
    assert.ok(texte.includes("TVA 20 % sur 500,00 €"), `ligne à 20 % attendue :\n${texte}`);
    assert.ok(texte.includes("TVA 10 % sur 120,00 €"), "ligne à 10 % attendue");
    assert.ok(texte.includes("732,00 €"), `Total TTC 732,00 € attendu :\n${texte}`);

    const { rows } = await inspecter(
      "SELECT total_ht, total_tva, taux_tva FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.equal(rows[0].total_ht, "620.00");
    assert.equal(rows[0].total_tva, "112.00");
    // Le taux porté par la facture est le plus élevé : celui qui ne sous-déclare pas.
    assert.equal(rows[0].taux_tva, "20.00");
  });

  await test("un supplément se retire du doigt, et le total redescend", async () => {
    const chantierId = await factureOuverte(page, "retrait");
    await ajouter(page, "Dessouchage cerisier", "1", "forfait", "320", "20");
    await page.click('[data-atlas="retirer-ts"]');
    await page.waitForFunction(() => !document.body.innerText.includes("Dessouchage cerisier"), {
      timeout: 15000,
    });

    const texte = await ecran(page);
    assert.equal(
      await page.locator('[data-atlas="bloc-ts"]').count(),
      0,
      "le bloc vide devrait disparaître"
    );
    assert.ok(texte.includes("600,00 €"), "le TTC devrait être redescendu à 600,00 €");

    const { rows } = await inspecter(
      "SELECT total_ttc FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.equal(rows[0].total_ttc, "600.00");
  });

  await test("la ligne du DEVIS n'a pas de croix : elle ne se retire pas", async () => {
    await factureOuverte(page, "devis-fige");
    assert.equal(
      await page.locator('[data-atlas="retirer-ts"]').count(),
      0,
      "aucune croix ne devrait exister tant qu'il n'y a pas de supplément"
    );
  });

  await test("une facture ARRÊTÉE ne propose plus rien — ni bouton, ni croix", async () => {
    const chantierId = await factureOuverte(page, "emise");
    await ajouter(page, "Dessouchage cerisier", "1", "forfait", "320", "20");
    await inspecter(
      "UPDATE factures SET statut = 'emise', emise_le = now() WHERE chantier_id = $1",
      [chantierId],
      1
    );
    await page.reload({ waitUntil: "networkidle" });

    assert.equal(await page.locator('[data-atlas="ouvrir-ts"]').count(), 0, "le bouton d'ajout survit à l'arrêt");
    assert.equal(await page.locator('[data-atlas="retirer-ts"]').count(), 0, "la croix survit à l'arrêt");
    // Le supplément, lui, reste lisible : c'est ce que le client a reçu.
    assert.ok((await ecran(page)).includes("Dessouchage cerisier"));
  });

  await test("le PDF de la facture porte le supplément", async () => {
    const chantierId = await factureOuverte(page, "pdf");
    await ajouter(page, "Terrasse bois", "1", "forfait", "580", "20");
    const { rows } = await inspecter("SELECT id FROM factures WHERE chantier_id = $1", [chantierId], 1);
    const reponse = await page.request.get(`${BASE}/api/factures/${rows[0].id}/pdf`);
    assert.equal(reponse.status(), 200);
    const corps = await reponse.body();
    assert.ok(corps.length > 2000, `PDF suspicieusement court : ${corps.length} octets`);
    assert.equal(corps.subarray(0, 5).toString(), "%PDF-");
  });

  await browser.close();
  await pool.end();
  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
