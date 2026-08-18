import assert from "node:assert";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * La fiche de chantier, du premier geste au rapport reçu par le client.
 *
 * *Sa demande du 16 août 2026 : « une fiche où ils cochent ce qu'ils ont fait
 * ou non sur le chantier et ensuite qu'ils peuvent enregistrer et envoyer
 * directement au client ».* Puis, le 17 : **« Fait la C »** — le client est
 * nommable à tout moment, et la fiche se replie alors sur ses prestations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE PEUT VOIR.**
 *
 * `test-passage-entretien.ts` éprouve les règles et le dépôt : le repli,
 * l'invariant du rapport figé, l'isolation, la lecture par jeton. Toutes
 * resteraient vertes si l'ÉCRAN n'appelait jamais ces fonctions — c'est le
 * piège 13 du dépôt, « une règle juste que l'écran n'applique pas ne protège
 * personne ».
 *
 * On traverse donc le parcours entier, au doigt : ouvrir, cocher, nommer le
 * client, poser le temps à la molette, envoyer — puis **ouvrir la page du
 * client dans un contexte SANS session**, ce qu'aucune suite base ne peut
 * faire. C'est là qu'on vérifie que ce qui n'a pas été fait n'y figure pas.
 *
 * **Et les captures sont prises en passant** (`ATLAS_CAPTURES`) : quatre
 * défauts réels de ce dépôt sont sortis d'une image et d'aucun test vert
 * (`CLAUDE.md` §5).
 */

const BASE = "http://localhost:3000";
/** Reconnaissable, et retiré à la fin : aucune autre suite ne doit le lire. */
const CLIENT = "Chantier E2E Fiche";
const DOSSIER_CAPTURES = process.env.ATLAS_CAPTURES ?? null;

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

async function capturer(page: Page, nom: string) {
  if (!DOSSIER_CAPTURES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  // `networkidle` et non `domcontentloaded` : la feuille de style n'est pas
  // appliquée au second, et une capture prise là ne montre pas l'écran servi
  // (leçon du 15 août 2026, `CLAUDE.md` §5).
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `${nom}.png`), fullPage: true });
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

/**
 * Efface ce que cette suite a écrit — elle tourne sur la base de démonstration.
 *
 * **Appelée au DÉBUT, jamais à la fin, et c'est délibéré.** Le rapport envoyé
 * qu'elle laisse derrière elle est ce dont
 * `test-pages-publiques-sans-navigation-e2e` a besoin pour éprouver que
 * `/entretien` ne montre pas la barre du patron : sans lui, cette garde-là
 * passerait au vert sans avoir ouvert la page. C'est le même arrangement que le
 * devis et la facture, dont les suites fabriquent leurs liens pour les
 * suivantes. Le nettoyage d'ouverture suffit à ne rien accumuler.
 */
async function nettoyer() {
  await pool.query(
    `DELETE FROM passages_entretien
      WHERE client_id IN (SELECT id FROM clients WHERE nom = $1)`,
    [CLIENT]
  );
  await pool.query(`DELETE FROM clients WHERE nom = $1`, [CLIENT]);
}

async function main() {
  await nettoyer();

  // Un client à nous, pour ne dépendre d'aucun autre jeu de données — et avec
  // un téléphone, sans quoi l'écran n'offrirait pas le SMS tout prêt.
  //
  // **L'entreprise se déduit du COMPTE de démonstration, jamais d'un
  // `LIMIT 1`.** La base en porte plusieurs — les suites précédentes en
  // laissent —, et une entreprise prise au hasard fabrique un client que
  // l'écran ne montrera jamais : le contrôle rougirait alors en accusant le
  // repli, qui n'y serait pour rien. Payé une fois, le 18 août 2026.
  const { rows: entreprises } = await pool.query(
    `SELECT m.entreprise_id AS id FROM membres_entreprise m
       JOIN users u ON u.id = m.utilisateur_id
      WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(entreprises[0]?.id, "le compte de démonstration n'appartient à aucune entreprise");
  const entrepriseId = entreprises[0].id as string;
  await pool.query(
    `INSERT INTO clients (entreprise_id, nom, telephone) VALUES ($1, $2, '0612345678')`,
    [entrepriseId, CLIENT]
  );

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  await test("Le modèle se pose une fois, depuis les réglages", async () => {
    // `networkidle` : le bouton est un composant client, et un appui posé avant
    // l'hydratation ne déclenche rien. Sous la charge d'une batterie complète,
    // l'écart se compte en secondes — la suite passait seule et rougissait dans
    // la batterie, ce qui est le pire des deux états.
    await page.goto(`${BASE}/reglages/fiche-entretien`, { waitUntil: "networkidle" });
    const poser = page.getByRole("button", { name: "Partir du modèle Atlas" });
    if (await poser.isVisible().catch(() => false)) {
      await poser.click();
    }
    // Attente qui monte, plutôt qu'un délai fixe choisi au doigt mouillé.
    for (const essai of [1, 2, 3, 4, 5]) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM prestations_entretien WHERE entreprise_id = $1`,
        [entrepriseId]
      );
      if (rows[0].n > 0) return;
      await page.waitForTimeout(essai * 600);
    }
    assert.fail("le modèle est resté vide après le geste des réglages");
  });

  await test("L'onglet Paysage mène à la fiche, et elle s'ouvre", async () => {
    await page.goto(`${BASE}/paysage`, { waitUntil: "domcontentloaded" });
    await capturer(page, "01-onglet-paysage");
    await page.getByText("Fiche de chantier").first().click();
    await page.waitForURL(`${BASE}/paysage/fiche`, { timeout: 30_000 });
    await capturer(page, "02-liste-des-fiches");

    await page.waitForLoadState("networkidle");
    await page.locator('[data-atlas="ouvrir-fiche-chantier"]').click();
    await page.waitForURL(/\/paysage\/fiche\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await capturer(page, "03-fiche-nue");

    const cases = page.locator('[data-atlas="fiche-chantier"] button[aria-pressed]');
    assert.ok(
      (await cases.count()) > 0,
      "la fiche s'est ouverte sans une seule prestation à cocher"
    );
  });

  await test("Cocher tient : l'écran ET la base", async () => {
    const cases = page.locator('[data-atlas="fiche-chantier"] button[aria-pressed]');
    for (const i of [0, 1, 5]) await cases.nth(i).click();
    await page.waitForTimeout(900);
    await capturer(page, "04-fiche-cochee");

    // **Le contrôle regarde la BASE, pas seulement la coche à l'écran.** Un
    // écran qui bouge sans que rien ne s'écrive est exactement le défaut que
    // l'optimisme d'affichage peut fabriquer.
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM lignes_passage l
         JOIN passages_entretien p ON p.id = l.passage_id
        WHERE p.entreprise_id = $1 AND p.envoye_le IS NULL AND l.faite`,
      [entrepriseId]
    );
    assert.equal(rows[0].n, 3, "les coches ne sont pas arrivées en base");
  });

  await test("Nommer le client replie la fiche — et ne perd aucune coche", async () => {
    const avant = await page
      .locator('[data-atlas="fiche-chantier"] button[aria-pressed="true"]')
      .count();

    await page.locator('[data-atlas="pont-client"]').click();
    await capturer(page, "05-choix-du-client");
    await page.locator('[data-atlas="choix-du-client"]').getByText(CLIENT).click();
    await page.waitForTimeout(1200);
    await capturer(page, "06-fiche-repliee");

    const apres = await page
      .locator('[data-atlas="fiche-chantier"] button[aria-pressed="true"]')
      .count();
    assert.equal(apres, avant, "nommer le client a effacé une coche déjà posée");

    const { rows } = await pool.query(
      `SELECT p.id FROM passages_entretien p
         JOIN clients c ON c.id = p.client_id
        WHERE c.nom = $1`,
      [CLIENT]
    );
    assert.equal(rows.length, 1, "le client n'a pas été attaché au passage");
  });

  await test("Le temps se pose à la molette, et se relit tel quel", async () => {
    await page.selectOption('select[aria-label="Heures"]', "1");
    await page.selectOption('select[aria-label="Minutes"]', "45");
    await page.fill("textarea", "La haie du fond est à reprendre en octobre.");
    await page.locator("textarea").blur();
    await page.waitForTimeout(900);
    await capturer(page, "07-temps-et-observations");

    const { rows } = await pool.query(
      `SELECT p.minutes, p.observations FROM passages_entretien p
         JOIN clients c ON c.id = p.client_id WHERE c.nom = $1`,
      [CLIENT]
    );
    assert.equal(rows[0].minutes, 105, "le temps n'est pas arrivé en base");
    assert.match(rows[0].observations ?? "", /haie du fond/);
  });

  await test("Envoyer fige le rapport, et prépare le SMS de SA messagerie", async () => {
    await page.locator('[data-atlas="envoyer-fiche"]').click();
    await page.waitForTimeout(1500);
    await capturer(page, "08-rapport-fige");

    const { rows } = await pool.query(
      `SELECT p.envoye_le, p.empreinte, p.jeton, p.client_nom
         FROM passages_entretien p JOIN clients c ON c.id = p.client_id
        WHERE c.nom = $1`,
      [CLIENT]
    );
    assert.ok(rows[0].envoye_le, "le rapport n'a pas été figé");
    assert.equal((rows[0].empreinte ?? "").length, 64, "l'empreinte manque");
    assert.ok(rows[0].jeton, "le lien du client n'a pas été créé");
    assert.equal(rows[0].client_nom, CLIENT, "le nom du client n'est pas parti avec le rapport");

    // **Aucun fournisseur d'envoi, et c'est un choix** (`docs/A-FAIRE.md` §5) :
    // le message part de SA messagerie. Le bouton doit donc être un lien `sms:`.
    const lien = page.locator('[data-atlas="ouvrir-sms-fiche"]');
    await lien.waitFor({ state: "visible", timeout: 15_000 });
    const href = await lien.getAttribute("href");
    assert.ok(href?.startsWith("sms:"), `le bouton d'envoi n'ouvre pas un SMS — lu : ${href}`);
    assert.ok(href?.includes("%2Fentretien%2F"), "le SMS ne porte pas le lien du rapport");
    // **Le lien doit être ABSOLU dans le message.** Un chemin seul ne s'ouvre
    // nulle part depuis Messages, et le client n'aurait aucun moyen de le dire.
    assert.ok(
      href?.includes("http%3A%2F%2F") || href?.includes("https%3A%2F%2F"),
      "le lien du SMS n'est pas une adresse complète"
    );
    // Et le numéro part sans ses espaces : espacé, l'application de messagerie
    // n'y reconnaît plus un destinataire et ouvre un message vide.
    assert.ok(href?.startsWith("sms:0612345678"), `destinataire mal formé : ${href}`);
  });

  await test("Le CLIENT reçoit ce qui a été fait — et rien d'autre", async () => {
    const { rows } = await pool.query(
      `SELECT p.jeton FROM passages_entretien p JOIN clients c ON c.id = p.client_id
        WHERE c.nom = $1`,
      [CLIENT]
    );
    // **Un contexte neuf, SANS session** : c'est le seul moyen de prouver que
    // la page tient debout pour quelqu'un qui n'a pas de compte — et qu'elle ne
    // lui montre pas les écrans du patron.
    const anonyme = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageClient = await anonyme.newPage();
    await pageClient.goto(`${BASE}/entretien/${rows[0].jeton}`, { waitUntil: "domcontentloaded" });
    await pageClient.locator('[data-atlas="rapport-entretien"]').waitFor({ timeout: 30_000 });
    await capturer(pageClient, "09-ce-que-le-client-recoit");

    const texte = await pageClient.locator("body").innerText();
    // Insensible à la casse : le surtitre est mis en capitales par la feuille
    // de style, et `innerText` rend ce qui est AFFICHÉ, pas la source.
    assert.match(texte, /compte rendu de passage/i);
    assert.match(texte, /1 h 45/, "le temps passé n'apparaît pas");
    assert.match(texte, /haie du fond/, "les observations n'apparaissent pas");

    // Sa décision « B » du 16 août : le client lit ce qui a été FAIT chez lui.
    // Trois lignes cochées sur vingt : les dix-sept autres n'ont rien à y faire.
    const coches = (texte.match(/✓/g) ?? []).length;
    assert.equal(coches, 3, `${coches} lignes affichées au client, au lieu des 3 cochées`);

    // Et la barre de navigation du patron n'a rien à faire au bas de la page
    // d'un client — c'est sa remarque du 12 août, tenue par `CHEMINS_DU_CLIENT`.
    assert.doesNotMatch(texte, /PLANNING/i, "le client voit les onglets de l'application");

    // Le HTML lui-même ne doit pas porter ce qui n'a pas été fait : une page
    // qui filtrerait à l'affichage laisserait le reste à portée d'un clic droit.
    const html = await pageClient.content();
    assert.doesNotMatch(html, /Scarification/, "une prestation non faite est dans le HTML du client");

    await anonyme.close();
  });

  await test("Sans le jeton exact, la page du client ne dit rien", async () => {
    const anonyme = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageClient = await anonyme.newPage();
    await pageClient.goto(`${BASE}/entretien/pas-un-vrai-jeton`, {
      waitUntil: "networkidle",
    });
    // **Attendre le verdict, pas l'écran d'attente.** Lu trop tôt, le contrôle
    // rendait « Chargement… » et accusait la page de ne pas refuser le jeton :
    // une erreur qui envoie chercher au mauvais endroit (`AGENTS.md`).
    await pageClient.getByText(/n'est plus valable/).waitFor({ timeout: 30_000 });
    const texte = await pageClient.locator("body").innerText();
    assert.match(texte, /n'est plus valable/, `lu à la place : « ${texte.slice(0, 120)} »`);
    await anonyme.close();
  });

  await test("Le passage SUIVANT chez lui s'ouvre entier, puis se replie", async () => {
    // **Le cœur de l'arrangement C, et il ne se voit qu'au SECOND passage.**
    // Au premier, ce client n'a pas d'historique : la fiche garde tout, et une
    // capture prise là ne montre aucun repli. C'est exactement le genre de
    // contrôle qui reste vert sans rien prouver (`CLAUDE.md` §5).
    // `networkidle` : le bouton est un composant client, et un appui posé avant
    // l'hydratation ne déclenche rien — l'écran reste sur la liste sans un mot.
    await page.goto(`${BASE}/paysage/fiche`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="ouvrir-fiche-chantier"]').click();
    await page.waitForURL(/\/paysage\/fiche\/[0-9a-f-]{36}/, { timeout: 30_000 });

    const cases = page.locator('[data-atlas="fiche-chantier"] button[aria-pressed]');
    const entier = await cases.count();
    assert.ok(entier > 5, `la fiche ne s'ouvre pas sur le modèle entier (${entier} lignes)`);

    await page.locator('[data-atlas="pont-client"]').click();
    await page.locator('[data-atlas="choix-du-client"]').getByText(CLIENT).click();
    await page.waitForTimeout(1500);
    await capturer(page, "10-second-passage-replie");

    const replie = await cases.count();
    assert.ok(
      replie < entier,
      `la fiche ne s'est pas repliée sur ce client : ${replie} lignes sur ${entier}`
    );
    // Les trois prestations du premier rapport, et elles seules.
    const texte = await page.locator('[data-atlas="fiche-chantier"]').innerText();
    // **Le repli se DIT, et se dit comme un constat.** Une fiche qui perd
    // dix-sept lignes sans un mot passe pour une fiche amputée ; la même chose
    // écrite en rouge sous le bouton passe pour une panne.
    assert.match(texte, /repliée sur ce que/i, "le repli ne se dit nulle part");
    assert.match(texte, /Tonte et ébarbage/);
    assert.doesNotMatch(texte, /Scarification/, "une ligne jamais faite chez lui est revenue");

    // Et elles reviennent DÉCOCHÉES : c'est un nouveau passage, pas une copie.
    const cochees = await page
      .locator('[data-atlas="fiche-chantier"] button[aria-pressed="true"]')
      .count();
    assert.equal(cochees, 0, "le passage suivant arrive avec des coches déjà posées");

    await page.goBack();
  });

  await test("Un rapport parti ne se modifie plus, et l'écran le dit", async () => {
    // On revient sur le rapport figé — le brouillon du cas précédent n'a rien
    // à voir ici, et le viser par erreur rendrait ce contrôle vert sur du vide.
    const { rows } = await pool.query(
      `SELECT p.id FROM passages_entretien p JOIN clients c ON c.id = p.client_id
        WHERE c.nom = $1 AND p.envoye_le IS NOT NULL`,
      [CLIENT]
    );
    await page.goto(`${BASE}/paysage/fiche/${rows[0].id}`, { waitUntil: "domcontentloaded" });
    const cases = page.locator('[data-atlas="fiche-chantier"] button[aria-pressed]');
    await assert.rejects(
      () => cases.first().click({ timeout: 3_000 }),
      "une case reste cliquable sur un rapport déjà parti"
    );
    const texte = await page.locator('[data-atlas="fiche-chantier"]').innerText();
    assert.match(texte, /figé/, "l'écran ne dit pas que le rapport est figé");
  });

  await context.close();
  await browser.close();
  // Pas de `nettoyer()` ici : voir le commentaire de la fonction — le rapport
  // envoyé sert de matière à la garde des pages publiques.

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await nettoyer().catch(() => {});
  await pool.end();
  process.exit(1);
});
