import assert from "node:assert/strict";
import { devices, type Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE, ACCUEIL_EXACT, echapper } from "./_adresse";

/**
 * La facture d'un client SUPPRIMÉ part vers ce qu'il tape, pour cet envoi seulement.
 *
 * *Le patron, le 3 novembre 2026, capture à l'appui :* **« Cas exceptionnel,
 * j'ai supprimé le client, mais je ne l'ai pas encore facturé. Donc là, je ne
 * peux plus lui envoyer la facture. […] il faut que je puisse du coup reprendre
 * les coordonnées, écrire les coordonnées pour lui envoyer la facture. »** Son
 * choix : « Pour cet envoi seulement ». Sa planche : `appli/soignee/facture.html`,
 * état « Client supprimé ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **SON GESTE, du premier au dernier** : le client se supprime par sa fiche
 * (« Supprimer ce client »), la facture en brouillon reste ; sur elle, la case
 * prend la place de « Aucune coordonnée pour ce canal. », suit le canal, et
 * « Envoyer la facture » s'allume quand elle est juste. L'envoi part vers ce
 * qu'il a tapé, la trace le porte, et la fiche supprimée n'a rien reçu.
 *
 * La règle elle-même, et l'isolation entre entreprises, sont tenues sous
 * `atlas_app` par `test-coordonnee-de-cet-envoi-db.ts` : ce serveur-ci traverse
 * la RLS (`CLAUDE.md` §5).
 */

const BASE = ADRESSE;
const EMAIL = "jean.martin@exemple.fr";

let reussis = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const bouton = (page: Page) => page.locator('[data-atlas="envoyer-la-facture"]');
const caseEnvoi = (page: Page) => page.locator('[data-atlas="coordonnee-de-cet-envoi"]');
const nomDeLaCase = async (page: Page) =>
  (await page.locator('[data-atlas="case-de-cet-envoi"] span').first().innerText()).trim();

async function main() {
  console.log("=== La facture d'un client supprimé ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Son propre chantier**, jamais celui d'une autre suite. Le montage est
  // celui de `test-envoyer-la-facture-e2e.ts` : un client, une ligne, le devis
  // parti, la facture créée.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.getByLabel(/Nom du client/i).fill(`Supprimé ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "07 11 22 33 44");
  await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', "10 rue des Lilas, Nantes");
  const chantierId = await creerPuisFiche(page, BASE);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier");
  await page.getByLabel("Prix unitaire 1").fill("850");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Choisir la date" }).click();
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(ACCUEIL_EXACT, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  const creer = page.getByRole("button", { name: /Créer la facture/i });
  if (await creer.count()) await creer.click();
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 60_000 });

  const { rows: lien } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [chantierId]);
  const clientId = lien[0]?.client_id as string | undefined;
  assert.ok(clientId, "le chantier n'a pas de client : rien à supprimer, rien à mesurer");

  // **Il supprime le client par sa fiche**, comme il l'a fait : la facture en
  // brouillon le retient (§542), sa fiche sort de la liste et perd ses
  // coordonnées.
  await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
  await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  await page.locator('[data-atlas="supprimer-client"]').click();
  const confirmer = page.locator('[data-atlas="confirmer-suppression"]');
  await confirmer.waitFor({ state: "visible", timeout: 15_000 });
  const sauvegarde = page.locator('[data-atlas="sauvegarde-ailleurs"]');
  if (await sauvegarde.count()) await sauvegarde.click();
  await confirmer.click();
  await page.waitForURL(new RegExp(`${echapper(BASE)}/clients/?$`), { timeout: 30_000 });

  const { rows: avant } = await pool.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
  assert.ok(avant[0]?.deleted_at, "la fiche n'est pas supprimée : la suite ne mesurerait rien");
  assert.equal(avant[0]?.email, null, "la suppression a laissé son e-mail : le cas n'est pas le sien");

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 60_000 });

  await cas("la case prend la place de « Aucune coordonnée pour ce canal. »", async () => {
    await caseEnvoi(page).waitFor({ state: "visible", timeout: 15_000 });
    const corps = await page.locator("body").innerText();
    assert.ok(!corps.includes("Aucune coordonnée pour ce canal."), "la phrase sans issue est encore là");
    assert.equal(await bouton(page).isDisabled(), true, "« Envoyer la facture » est allumé sur une case vide");
  });

  await cas("E-mail : la case s'appelle « Son e-mail », et une forme fausse le dit", async () => {
    await page.locator('[data-atlas="canal-email"]').click();
    assert.equal(await page.locator('[data-atlas="canal-email"]').isDisabled(), false, "« E-mail » est inerte");
    assert.equal(await nomDeLaCase(page), "Son e-mail");
    await caseEnvoi(page).fill("jean@");
    await page.waitForTimeout(200);
    assert.equal(await bouton(page).isDisabled(), true, "« Envoyer la facture » s'allume sur « jean@ »");
    assert.equal(
      await page.locator('[data-atlas="refus-de-cet-envoi"]').count(),
      1,
      "une adresse fausse ne dit rien sous la case"
    );
  });

  await cas("tapé juste, « Envoyer la facture » s'allume", async () => {
    await caseEnvoi(page).fill(EMAIL);
    await page.waitForTimeout(200);
    assert.equal(await bouton(page).isDisabled(), false, "« Envoyer la facture » reste éteint sur une adresse juste");
    assert.equal(await page.locator('[data-atlas="refus-de-cet-envoi"]').count(), 0, "le refus reste sous une adresse juste");
  });

  await cas("SMS : la case devient « Son numéro », vide, et le bouton s'éteint", async () => {
    await page.locator('[data-atlas="canal-sms"]').click();
    await page.waitForTimeout(200);
    assert.equal(await nomDeLaCase(page), "Son numéro");
    assert.equal(await caseEnvoi(page).inputValue(), "", "l'adresse tapée est restée dans la case du numéro");
    assert.equal(await caseEnvoi(page).getAttribute("type"), "tel", "la case du numéro n'ouvre pas le pavé de chiffres");
    assert.equal(await bouton(page).isDisabled(), true, "« Envoyer la facture » reste allumé sur une case vide");
    await caseEnvoi(page).fill("06 98 76 54 32");
    await page.waitForTimeout(200);
    assert.equal(await bouton(page).isDisabled(), false, "un numéro juste n'allume pas « Envoyer la facture »");
  });

  await cas("SON GESTE : l'envoi part vers l'e-mail tapé, et la trace le porte", async () => {
    await page.locator('[data-atlas="canal-email"]').click();
    await caseEnvoi(page).fill(EMAIL);
    await page.waitForTimeout(200);
    await bouton(page).click();

    const porte = page.locator("a[data-transmission-directe]");
    await porte.waitFor({ state: "attached", timeout: 30_000 });
    const adresse = (await porte.getAttribute("href")) ?? "";
    assert.ok(
      adresse.startsWith(`mailto:${encodeURIComponent(EMAIL)}?`),
      `la messagerie ne s'ouvre pas vers ce qu'il a tapé (« ${adresse.slice(0, 60)} »)`
    );
    assert.ok(decodeURIComponent(adresse).includes("/factures/"), "le message ne porte pas le lien de la facture");

    const { rows: f } = await pool.query(
      `SELECT f.statut, e.canal, e.destinataire
         FROM factures f JOIN envois_factures e ON e.facture_id = f.id
        WHERE f.chantier_id = $1`,
      [chantierId]
    );
    assert.deepEqual(
      f.map((r) => [r.statut, r.canal, r.destinataire]),
      [["emise", "email", EMAIL]],
      "la facture n'est pas arrêtée, ou sa trace ne porte pas l'adresse employée"
    );
  });

  await cas("la fiche supprimée n'a rien reçu", async () => {
    const { rows: apres } = await pool.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
    assert.deepEqual(apres[0], avant[0], "la fiche du client supprimé a changé pendant l'envoi");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? `\n✅ La facture d'un client supprimé : ${reussis} réussis, 0 échec.\n`
      : `\n❌ La facture d'un client supprimé : ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
