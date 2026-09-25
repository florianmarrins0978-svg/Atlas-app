import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool, db } from "../src/server/db/client";
import { users, membresEntreprise } from "../src/server/db/schema";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, terminerChantier } from "../src/server/repositories/factures";
import { ADRESSE } from "./_adresse";

// **L'AVOIR ET « IL NE ME PAIERA PAS », PAR LE GESTE DU PATRON** — ses planches
// du 24 septembre 2026 (`appli/avoir.html`, `appli/il-ne-paiera-pas.html`).
//
// Éprouver par la porte d'entrée, jamais par une porte de service (`CLAUDE.md`
// §5 quater) : on part de Terminés, on touche la ligne, on suit le volet. Le
// calcul est tenu ailleurs (`test-avoir.ts`, `test-avoirs-db.ts`) ; ici, que
// chaque écran s'atteigne, et que ce qu'il affiche après soit juste.

const BASE = ADRESSE;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Une facture partie au nom de ce chantier, sur le compte de démonstration. */
async function facturePartie(nom: string): Promise<string> {
  const [demo] = await db.select().from(users).where(eq(users.email, "demo@atlas.local")).limit(1);
  if (!demo) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
  const [m] = await db
    .select({ e: membresEntreprise.entrepriseId })
    .from(membresEntreprise)
    .where(eq(membresEntreprise.utilisateurId, demo.id))
    .limit(1);
  const ctx = { utilisateurId: demo.id, entrepriseId: m!.e };
  const client = await clientsRepo.creerClient(ctx, { nom: `Client ${nom}`, telephone: "06 79 98 45 14" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie de thuyas", "456.00", { quantite: "38", prixUnitaire: "12.00", unite: "ml" });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Évacuation des déchets verts", "744.00");
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  await emettreFacture(ctx, (await terminerChantier(ctx, chantier.id)).id);
  return chantier.id;
}

async function factureDe(chantierId: string): Promise<string> {
  const { rows } = await pool.query("SELECT id FROM factures WHERE chantier_id = $1", [chantierId]);
  return rows[0]!.id as string;
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/** Le volet de la ligne de ce chantier, dans Terminés. */
async function ouvrirLeVolet(page: Page, nom: string) {
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.locator('[data-atlas="ligne-terminee"]', { hasText: nom }).first().click();
  await page.waitForSelector('[data-atlas="volet-choix"]', { timeout: 10_000 });
}

async function main() {
  const suffixe = Date.now();
  const nomAvoir = `Avoir ${suffixe}`;
  const nomImpaye = `Impayee ${suffixe}`;
  const chantierAvoir = await facturePartie(nomAvoir);
  const chantierImpaye = await facturePartie(nomImpaye);
  let adresseAvoirFait = "";

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await seConnecter(page);

  await cas("la ligne d'une facture partie ouvre un volet à trois choix, et « La facture » l'ouvre", async () => {
    await ouvrirLeVolet(page, nomAvoir);
    for (const cle of ["facture", "avoir", "non-payee"]) {
      assert.equal(await page.locator(`[data-atlas="volet-${cle}"]`).count(), 1, `« ${cle} » manque au volet`);
    }
    await page.click('[data-atlas="volet-facture"]');
    await page.waitForURL(new RegExp(`/chantiers/${chantierAvoir}/facture$`), { timeout: 15_000 });
  });

  await cas("un avoir sur la haie : le refus se dit, puis 100 € passent et « Net à payer » descend", async () => {
    await ouvrirLeVolet(page, nomAvoir);
    await page.click('[data-atlas="volet-avoir"]');
    await page.waitForSelector('[data-atlas="avoir-montant"]');
    await page.click('[data-atlas="avoir-portee"]');
    await page.locator("button", { hasText: "Taille de haie de thuyas" }).first().click();
    await page.fill('[data-atlas="avoir-montant"]', "600");
    assert.match(await page.locator('[role="alert"]').first().innerText(), /547,20/);
    assert.equal(await page.locator('[data-atlas="avoir-valider"]').isDisabled(), true);
    await page.fill('[data-atlas="avoir-montant"]', "100");
    assert.match(await page.locator('[data-atlas="avoir-nouveau"]').innerText(), /1\s340,00/);
    await page.click('[data-atlas="avoir-valider"]');
    await page.waitForSelector('[data-atlas="avoir-fait"]', { timeout: 30_000 });
    adresseAvoirFait = page.url();
    await page.goto(`${BASE}/chantiers/${chantierAvoir}/facture`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="avoir-de-la-facture"]').count(), 1);
    assert.match(await page.locator('[data-atlas="net-a-payer"]').innerText(), /1\s340,00/);
  });

  // **Sa demande du 25 septembre 2026, capture de « C'est fait » à l'appui :**
  // *« une fois envoyé il faut revenir sur la page d'accueil et, pareil que
  // pour le reste, une petite phrase s'affiche »*. L'écran marquait le départ
  // et ne montait pas le retour : il revenait sur « C'est fait », identique.
  await cas("l'avoir envoyé, le retour de la messagerie ramène à l'accueil avec « Avoir transmis »", async () => {
    assert.ok(adresseAvoirFait, "l'écran « C'est fait » n'a pas été atteint");
    await page.goto(adresseAvoirFait, { waitUntil: "networkidle" });
    const preparer = page.getByRole("button", { name: "Envoyer l'avoir au client" });
    if (await preparer.count()) await preparer.click();
    const capsule = page.locator('[data-atlas="transmission-sms"]');
    await capsule.waitFor({ state: "visible", timeout: 15_000 });
    // Le vrai appui, sans partir : `sms:` sortirait du navigateur. Le clic
    // passe par le geste du bouton (qui marque le départ), la navigation non.
    await capsule.evaluate((a) => {
      a.addEventListener("click", (e) => e.preventDefault(), { once: true });
      (a as HTMLElement).click();
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
    await page
      .locator('[role="status"]')
      .getByText(new RegExp(`Avoir transmis à .*${nomAvoir}`))
      .waitFor({ state: "visible", timeout: 10_000 });
  });

  await cas("« Il ne me paiera pas » : la catégorie Non payées naît, et le paiement l'efface", async () => {
    await ouvrirLeVolet(page, nomImpaye);
    assert.equal(await page.locator('[data-atlas="categorie-non-payees"]').count(), 0, "la catégorie existait avant le geste");
    await page.click('[data-atlas="volet-non-payee"]');
    await page.click('[data-atlas="noter-non-payee"]');
    await page.waitForURL(`${BASE}/termines`, { timeout: 15_000 });
    await page.click('[data-atlas="categorie-non-payees"]');
    await page.locator('[data-atlas="non-payee"]', { hasText: nomImpaye }).click();
    await page.waitForSelector('[data-atlas="facture-non-payee"]');

    // La mise en demeure s'atteint d'ici, et sa lettre réclame le reste dû.
    await page.click('[data-atlas="mise-en-demeure"]');
    await page.waitForSelector('[data-atlas="lettre-mise-en-demeure"]', { timeout: 30_000 });
    assert.match(await page.locator('[data-atlas="lettre-mise-en-demeure"]').innerText(), /la somme de 1\s440,00\s€/);
    const lettre = await page.request.get(page.url().replace(/\/chantiers\/.*/, "") + `/api/factures/${await factureDe(chantierImpaye)}/mise-en-demeure`);
    assert.equal(lettre.status(), 200, "le PDF de la lettre ne se télécharge pas");
    assert.equal((await lettre.body()).subarray(0, 4).toString(), "%PDF");
    await page.goBack();
    await page.waitForSelector('[data-atlas="facture-non-payee"]');

    await page.click('[data-atlas="recu-le-paiement"]');
    await page.click('[data-atlas="paiement-moyen"]');
    await page.locator("button", { hasText: "Chèque" }).last().click();
    await page.fill('[data-atlas="paiement-numero"]', "5800755");
    await page.click('[data-atlas="paiement-noter"]');
    await page.waitForURL(new RegExp(`/chantiers/${chantierImpaye}/facture$`), { timeout: 30_000 });
    assert.match(await page.locator('[data-atlas="net-a-payer"]').innerText(), /0,00/);
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="categorie-non-payees"]').count(), 0, "payée, la catégorie devait disparaître");
  });

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} L'avoir et « Il ne me paiera pas » — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
