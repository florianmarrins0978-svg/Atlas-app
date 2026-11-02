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

/**
 * L'échéance qui passe, comme elle passerait chez lui. Une facture émise est
 * immuable (trigger) et part avec trente jours devant elle : aucun geste de
 * l'écran ne peut la rendre échue. Le verrou ne se lève que dans CETTE
 * transaction de montage (`session_replication_role`, réservé au rôle de test,
 * comme `vieillirLaFacture` de `test-facture-impayee-e2e.ts`), jamais dans le
 * produit. Elle DOIT toucher sa ligne, sinon la suite accuserait l'écran.
 */
async function echoirLaFacture(chantierId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    const r = await client.query(
      "UPDATE factures SET date_emission = CURRENT_DATE - 31, date_echeance = CURRENT_DATE - 1 WHERE chantier_id = $1 AND statut = 'emise'",
      [chantierId]
    );
    if (r.rowCount !== 1) throw new Error(`Montage : ${r.rowCount} facture(s) émise(s) échue(s) au lieu d'une.`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
    // « Sur » en deux cartes depuis la planche du 2 novembre 2026 : « Une
    // ligne » montre les lignes, on en touche une. Chacune annonce ce qu'elle
    // permet encore, et c'est le plafond même du refus qui suit.
    await page.click('[data-atlas="avoir-sur-ligne"]');
    const haie = page.locator('[data-atlas="avoir-ligne"]', { hasText: "Taille de haie de thuyas" });
    await haie.click();
    assert.equal(await haie.getAttribute("aria-pressed"), "true", "la ligne touchée n'est pas prise");
    assert.match(await haie.innerText(), /547,20/);
    await page.fill('[data-atlas="avoir-montant"]', "600");
    assert.match(await page.locator('[role="alert"]').first().innerText(), /547,20/);
    assert.equal(await page.locator('[data-atlas="avoir-valider"]').isDisabled(), true);
    await page.fill('[data-atlas="avoir-montant"]', "100");
    assert.match(await page.locator('[data-atlas="avoir-nouveau"]').innerText(), /1\s340,00/);
    await page.click('[data-atlas="avoir-valider"]');
    await page.waitForSelector('[data-atlas="avoir-fait"]', { timeout: 30_000 });
    assert.match(await page.locator('[data-atlas="avoir-fait"]').innerText(), /ne doit plus que 1\s340,00/);
    assert.equal(await page.locator('[data-atlas="avoir-voir-pdf"]').count(), 1, "« Voir l'avoir » manque à « C'est fait »");
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

    // **Avant le lendemain de l'échéance, la lettre attend** (défaut du
    // 2 novembre 2026) : la facture vient de partir, elle n'est pas impayée.
    // L'écran le dit et éteint le bouton ; la route refuse, en clair.
    const adresseDuPdf = page.url().replace(/\/chantiers\/.*/, "") + `/api/factures/${await factureDe(chantierImpaye)}/mise-en-demeure`;
    assert.match(await page.locator('[data-atlas="mise-en-demeure-attend"]').innerText(), /L'échéance tombe le .*la lettre attend le lendemain/);
    assert.equal(await page.locator('[data-atlas="telecharger-mise-en-demeure"]').isDisabled(), true, "la lettre se télécharge avant l'échéance");
    const tropTot = await page.request.get(adresseDuPdf);
    assert.equal(tropTot.status(), 409, "la route produit la lettre avant l'échéance");
    assert.match(String((await tropTot.json()).error), /la lettre attend le lendemain/);

    // L'échéance passée, la même page s'allume et la lettre part.
    await echoirLaFacture(chantierImpaye);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="mise-en-demeure-attend"]').count(), 0, "la phrase d'attente reste après l'échéance");
    assert.equal(await page.locator('[data-atlas="telecharger-mise-en-demeure"]').isDisabled(), false, "le bouton reste éteint après l'échéance");
    const lettre = await page.request.get(adresseDuPdf);
    assert.equal(lettre.status(), 200, "le PDF de la lettre ne se télécharge pas");
    assert.equal((await lettre.body()).subarray(0, 4).toString(), "%PDF");
    await page.goBack();
    await page.waitForSelector('[data-atlas="facture-non-payee"]');

    // Le chantier est rangé deux mois plus tôt : c'est ce qui prouve que le
    // retour ouvre SON mois, et pas celui du jour.
    const ilYADeuxMois = new Date();
    ilYADeuxMois.setDate(15);
    ilYADeuxMois.setMonth(ilYADeuxMois.getMonth() - 2);
    await pool.query("UPDATE chantiers SET date_planifiee = $1 WHERE id = $2", [ilYADeuxMois.toISOString().slice(0, 10), chantierImpaye]);

    await page.click('[data-atlas="recu-le-paiement"]');
    // Le ruban de sa planche du 2 novembre 2026 : le montant arrive rempli de
    // ce qui reste, et le numéro n'existe que pour un chèque.
    await page.waitForSelector('[data-atlas="paiement-montant"]');
    assert.match(await page.inputValue('[data-atlas="paiement-montant"]'), /^1\s440,00$/);
    await page.click('[data-atlas="paiement-moyen-virement"]');
    assert.equal(await page.locator('[data-atlas="paiement-numero"]').count(), 0, "le n° de chèque reste pour un virement");
    await page.click('[data-atlas="paiement-moyen-cheque"]');
    assert.equal(await page.getAttribute('[data-atlas="paiement-moyen-cheque"]', "aria-pressed"), "true");
    await page.fill('[data-atlas="paiement-numero"]', "5800755");
    await page.click('[data-atlas="paiement-noter"]');
    // **Sa demande du 25 septembre 2026 :** *« une fois validé, on quitte la
    // page de la facture et on retourne sur Terminés, devant la case de
    // Monsieur Martins qui se trouvait en août »*. Il restait sur la facture,
    // et Terminés rouvrait sur le mois du jour.
    await page.waitForURL(new RegExp(`/termines\\?chantier=${chantierImpaye}$`), { timeout: 30_000 });
    const saLigne = page.locator('[data-atlas="ligne-terminee"]', { hasText: nomImpaye });
    await saLigne.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await saLigne.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    }), true, "la ligne du chantier n'est pas à l'écran : il faut la chercher");
    await page.goto(`${BASE}/chantiers/${chantierImpaye}/facture`, { waitUntil: "networkidle" });
    assert.match(await page.locator('[data-atlas="net-a-payer"]').innerText(), /0,00/);
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="categorie-non-payees"]').count(), 0, "payée, la catégorie devait disparaître");
  });

  // **Sa décision du 25 septembre 2026 :** *« une facture déjà payée, tu peux
  // masquer Il ne me paiera pas »*. Le bouton menait à un écran qui renvoyait
  // en silence sur la facture acquittée.
  await cas("une facture payée ne propose plus « Il ne me paiera pas », mais garde l'avoir", async () => {
    await page.goto(`${BASE}/termines?chantier=${chantierImpaye}`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="ligne-terminee"]', { hasText: nomImpaye }).first().click();
    await page.waitForSelector('[data-atlas="volet-choix"]', { timeout: 10_000 });
    assert.equal(await page.locator('[data-atlas="volet-non-payee"]').count(), 0, "« Il ne me paiera pas » est proposé sur une facture payée");
    assert.equal(await page.locator('[data-atlas="volet-avoir"]').count(), 1, "l'avoir a disparu du volet");
    assert.equal(await page.locator('[data-atlas="volet-facture"]').count(), 1, "« La facture » a disparu du volet");
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
