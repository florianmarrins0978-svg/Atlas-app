// Le client qu'Atlas reconnaît pendant qu'il tape — PAR SON PARCOURS À LUI.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE PEUT VOIR.**
//
// La règle est éprouvée à part, sans base (`test-rapprochement-client.ts`), et
// elle resterait verte si l'écran ne l'appelait jamais — c'est le défaut du
// 28 août 2026 : six gestes livrés verts, aucun atteignable (`CLAUDE.md`
// §5 quater). Ici on entre par où le patron entre : « Nouveau chantier », et
// l'on tape un nom.
//
// **Sa demande du 9 septembre 2026 :** *« lorsque je clique sur créer un devis
// j'écris Martins, il reconnaît et entre les infos de lui-même — mais il ne va
// donc pas me créer un deuxième client appelé Martins ? »* Le dernier cas de
// cette suite répond à cette question-là, en base : **un seul client**.
//
// **Les captures sont prises en passant** (`ATLAS_CAPTURES`) : quatre défauts
// réels de ce dépôt sont sortis d'une image et d'aucun test vert.

import { mkdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DOSSIER_CAPTURES = process.env.ATLAS_CAPTURES ?? null;

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

async function capturer(page: Page, nom: string) {
  if (!DOSSIER_CAPTURES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  // `networkidle`, jamais `domcontentloaded` : la feuille de style n'est pas
  // appliquée au second, et une capture prise là ne montre pas l'écran servi
  // (leçon du 15 août 2026, `CLAUDE.md` §5).
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `${nom}.png`) });
}

const NOM_CASE = 'input[placeholder="Bernard"]';
const NOM_TEL = 'input[placeholder="06 12 34 56 78"]';
const BANDEAU = '[data-atlas="client-reconnu"]';
const LISTE = '[data-atlas="clients-proposes"]';
const PROPOSE = '[data-atlas="client-propose"]';

async function main() {
  console.log("=== Le client qu'Atlas reconnaît ===\n");
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un patronyme unique par exécution : la base n'est pas vidée entre deux
  // passages, et un homonyme laissé par le précédent empêcherait justement la
  // reconnaissance qu'on vient éprouver.
  const NOM = `Roussel ${Date.now()}`;

  // ── Une fiche à reconnaître ────────────────────────────────────────────────
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill(NOM_CASE, NOM);
  await page.fill(NOM_TEL, "06 79 98 45 14");
  const premier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });

  // Son adresse et son mail posés en base : ce qu'on éprouve ici est la
  // RECONNAISSANCE, pas la saisie, qui a ses propres suites.
  await pool.query(
    `UPDATE clients SET adresse = '12 rue des Lilas, Saint-Marc', email = 'roussel@exemple.fr'
       WHERE id = (SELECT client_id FROM chantiers WHERE id = $1)`,
    [premier]
  );
  const { rows: sonId } = await pool.query(
    `SELECT client_id FROM chantiers WHERE id = $1`,
    [premier]
  );
  const clientId = sonId[0].client_id as string;

  // ── L'écran neuf ne montre RIEN ────────────────────────────────────────────
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });

  await cas("un écran neuf n'annonce personne — pas de ligne qui parle pour rien", async () => {
    await page.waitForTimeout(900);
    assert.equal(await page.locator(BANDEAU).count(), 0, "un bandeau s'affiche sans nom tapé");
    await capturer(page, "client-reconnu-01-avant");
  });

  // ── Il tape son nom ────────────────────────────────────────────────────────
  await cas("il tape son nom, et Atlas dit qu'il le reconnaît", async () => {
    await page.fill(NOM_CASE, NOM);
    await page.locator(BANDEAU).waitFor({ state: "visible", timeout: 15_000 });
    const dit = await page.locator(BANDEAU).innerText();
    assert.match(dit, /Repris de sa fiche/);
    // **Ce qui le DISTINGUE, pas seulement qu'il est reconnu** : il a quatre
    // Martins, et « repris de sa fiche » tout seul ne dit pas lequel.
    assert.match(dit, /Saint-Marc/, "le bandeau ne dit pas OÙ il habite");
    assert.match(dit, /1 chantier/, "le bandeau ne dit pas combien de chantiers");
  });

  await cas("les cases se remplissent seules — il ne retape rien", async () => {
    assert.equal(await page.inputValue(NOM_TEL), "06 79 98 45 14", "le téléphone n'a pas été repris");
    await capturer(page, "client-reconnu-02-reconnu");
  });

  // **Ce que la mesure seule ne voit pas.** Un bandeau plus large que l'écran,
  // ou écrasé à zéro, passerait tous les contrôles ci-dessus.
  await cas("le bandeau tient dans la largeur du téléphone, et il a une hauteur", async () => {
    const cadre = await page.locator(BANDEAU).boundingBox();
    assert.ok(cadre, "le bandeau n'a pas de boîte");
    assert.ok(cadre.height > 24, `bandeau écrasé : ${Math.round(cadre.height)} px de haut`);
    assert.ok(cadre.width <= 390, `bandeau trop large : ${Math.round(cadre.width)} px`);
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    assert.equal(deborde, false, "la page défile horizontalement");
  });

  // ── « Ce n'est pas lui » ───────────────────────────────────────────────────
  await cas("« Ce n'est pas lui » retire ce qu'Atlas avait posé", async () => {
    await page.locator('[data-atlas="ce-n-est-pas-lui"]').click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator(BANDEAU).count(), 0, "le bandeau reste après le refus");
    assert.equal(await page.inputValue(NOM_TEL), "", "le téléphone repris n'a pas été retiré");
    await capturer(page, "client-reconnu-03-ce-n-est-pas-lui");
  });

  await cas("LE REFUS TIENT — Atlas ne répond pas « si, c'est lui »", async () => {
    // Sans le verrou, la reconnaissance repartait à la frappe suivante : il
    // aurait vu Atlas lui reproposer l'homme qu'il venait d'écarter.
    await page.fill(NOM_CASE, "");
    await page.fill(NOM_CASE, NOM);
    await page.waitForTimeout(1800);
    assert.equal(await page.locator(BANDEAU).count(), 0, "le refus n'a pas tenu");
  });

  // ── SA QUESTION DU 9 SEPTEMBRE, en base ───────────────────────────────────
  await cas("le chantier reconnu va sur SA fiche — aucun second client n'est né", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill(NOM_CASE, NOM);
    await page.locator(BANDEAU).waitFor({ state: "visible", timeout: 15_000 });
    const second = await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });

    const { rows: fiches } = await pool.query(
      `SELECT id FROM clients WHERE nom = $1 AND deleted_at IS NULL`,
      [NOM]
    );
    assert.equal(fiches.length, 1, `${fiches.length} fiches pour un seul homme`);

    const { rows: ou } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [second]);
    assert.equal(ou[0].client_id, clientId, "le second chantier n'est pas sur sa fiche");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LE PRÉNOM SEUL — sa demande du 20 septembre 2026, capture à l'appui :
  // *« quand on passe par la première photo et que je tape le prénom d'un
  // client qui existe, il ne me le reconnaît pas ; il doit me le proposer et
  // remplir le champ direct »*.
  //
  // **On entre par SA porte**, celle de la capture : l'accueil, puis « Créer un
  // devis » — la feuille, pas l'adresse `/chantiers/nouveau` tapée à la main.
  // Six gestes livrés verts et inatteignables le 28 août 2026 ont appris ce
  // qu'un contrôle qui entre par la porte de service ne prouve pas
  // (`CLAUDE.md` §5 quater).
  // ═══════════════════════════════════════════════════════════════════════
  const PRENOM = `Julien${Date.now()}`;
  const NOM_COMPLET = `${PRENOM} Bernard`;

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill(NOM_CASE, NOM_COMPLET);
  await page.fill(NOM_TEL, "06 11 22 33 44");
  const sien = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const { rows: saFiche } = await pool.query(
    `SELECT client_id FROM chantiers WHERE id = $1`,
    [sien]
  );
  const sonClient = saFiche[0].client_id as string;
  await pool.query(`UPDATE clients SET adresse = '4 rue Haute, Nantes' WHERE id = $1`, [sonClient]);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('[data-atlas="nouveau-chantier"]').click();
  await page.locator(NOM_CASE).waitFor({ state: "visible", timeout: 15_000 });

  await cas("le prénom seul PROPOSE son client — le défaut du 20 septembre", async () => {
    await page.fill(NOM_CASE, PRENOM);
    await page.locator(PROPOSE).first().waitFor({ state: "visible", timeout: 15_000 });
    const dit = await page.locator(PROPOSE).first().innerText();
    assert.match(dit, new RegExp(NOM_COMPLET), "la proposition ne porte pas son nom entier");
    // Ce qui le DISTINGUE : sur quatre homonymes, le nom seul ne dit pas lequel.
    assert.match(dit, /Nantes/, "la proposition ne dit pas où il habite");
    await capturer(page, "client-propose-01-liste");
  });

  await cas("la liste tient dans la largeur du téléphone, et elle a une hauteur", async () => {
    // Un contrôle qui mesure ZÉRO ne mesure rien (`CLAUDE.md` §5) : une liste
    // écrasée passerait tous les contrôles ci-dessus.
    const cadre = await page.locator(LISTE).boundingBox();
    assert.ok(cadre, "la liste n'a pas de boîte");
    assert.ok(cadre.height > 24, `liste écrasée : ${Math.round(cadre.height)} px de haut`);
    assert.ok(cadre.width <= 390, `liste trop large : ${Math.round(cadre.width)} px`);
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    assert.equal(deborde, false, "la page défile horizontalement");
  });

  await cas("on la touche : le nom se complète et les cases se remplissent", async () => {
    await page.locator(PROPOSE).first().click();
    await page.locator(BANDEAU).waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(await page.inputValue(NOM_CASE), NOM_COMPLET, "le nom n'a pas été complété");
    assert.equal(await page.inputValue(NOM_TEL), "06 11 22 33 44", "le téléphone n'a pas été repris");
    await capturer(page, "client-propose-02-choisi");
  });

  await cas("la liste ne se rouvre pas sous son doigt", async () => {
    // Poser son nom entier relance la recherche : sans la mémoire du choix, le
    // bandeau s'éteindrait et la liste reviendrait sur l'homme qu'il désigne.
    await page.waitForTimeout(1800);
    assert.equal(await page.locator(LISTE).count(), 0, "la liste s'est rouverte");
    assert.equal(await page.locator(BANDEAU).count(), 1, "le bandeau s'est éteint");
  });

  await cas("le chantier créé depuis la feuille va sur SA fiche — pas de client en double", async () => {
    const troisieme = await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const { rows: fiches } = await pool.query(
      `SELECT id FROM clients WHERE nom = $1 AND deleted_at IS NULL`,
      [NOM_COMPLET]
    );
    assert.equal(fiches.length, 1, `${fiches.length} fiches pour un seul homme`);
    const { rows: ou } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [troisieme]);
    assert.equal(ou[0].client_id, sonClient, "le chantier n'est pas allé sur sa fiche");
  });

  await pool.end();
  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le client qu'Atlas reconnaît — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
