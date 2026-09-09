import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur, ECRAN_DU_PATRON, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import type { Page } from "playwright";

/**
 * **LA FLÈCHE DE RETOUR REND LA PLACE OÙ L'ON ÉTAIT.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque du 9 septembre 2026 :** *« Si je clique sur un client tout en
 * bas de la liste, je fais retour, il me remet en haut de la liste. Je veux
 * rester où j'étais ! »*
 *
 * Il a trente-sept clients. Redescendre trente-sept lignes après chaque fiche
 * ouverte, c'est le geste qu'il refait à chaque fois — et rien ne le disait :
 * la batterie était verte, parce qu'aucune suite ne regardait OÙ l'on retombe.
 *
 * **CE QU'ELLE ÉPROUVE, ET QUE LES SUITES DE PIXELS NE VOIENT PAS.** Toutes les
 * autres regardent un écran arrêté. Celle-ci regarde un **enchaînement de
 * gestes** — descendre, ouvrir, revenir — et c'est le seul endroit où le défaut
 * existait (`CLAUDE.md` §5 quater : éprouver le geste du patron, pas la
 * fonction qu'on vient d'écrire).
 *
 * **Elle vise la RÈGLE, pas un libellé** (`CLAUDE.md` §5 bis) : une position de
 * défilement, une adresse. Rien ici ne réclame un mot qu'il pourrait faire
 * retirer demain.
 *
 * **Confrontée à la version d'avant, elle rougit** — mesuré le 9 septembre
 * 2026, sur la version bâtie : la flèche déposait à **0 px** là où le retour du
 * navigateur rendait **2 941 px**.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

/**
 * Assez de clients pour que la liste dépasse l'écran, quoi qu'il y ait déjà.
 *
 * **Posés par cette suite, jamais empruntés au jeu de démonstration.** Celui-ci
 * en porte sept : sur les 664 px de son téléphone, la liste tient tout juste, et
 * le contrôle mesurerait alors un défilement de zéro pixel — c'est-à-dire rien
 * du tout, en vert (`CLAUDE.md` §5).
 */
const COMBIEN = 30;

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

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });
}

/**
 * La page s'anime-t-elle ?
 *
 * **Sans cette question, le rouge accuse le mauvais coupable.** Un écran qui
 * n'est pas hydraté n'a pas de flèche vivante : l'appui suit alors le lien
 * ordinaire, la page se recharge, et le défilement se perd — exactement le
 * symptôme du défaut qu'on corrige, pour une raison qui n'a rien à voir.
 */
async function vivante(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.body.firstElementChild;
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

async function attendreVivante(page: Page) {
  for (let reste = 40; reste > 0 && !(await vivante(page)); reste--) {
    await page.waitForTimeout(500);
  }
}

/**
 * Pose les clients de cette suite — **et AUCUN chantier**.
 *
 * **La base des suites navigateur est commune et s'accumule** : elle est semée
 * une fois, puis chaque suite y ajoute ce qu'elle fait. Une première version
 * posait un chantier planifié par client « pour les dater » : trente chantiers
 * de plus au planning, que les suites jouées APRÈS celle-ci auraient trouvés
 * sur leurs journées. Le rouge serait tombé ailleurs, sur du code juste — c'est
 * exactement le piège payé le 26 août 2026 (`CLAUDE.md` §5).
 *
 * Un client sans chantier tombe dans la bande « sans chantier » et se range en
 * fin de liste (`bandes-clients.ts`, `listerFichesClients`) : c'est tout ce
 * qu'il faut ici, puisqu'on descend jusqu'au bout.
 */
async function poserDesClients() {
  const { rows } = await pool.query<{ entreprise_id: string }>(
    `SELECT entreprise_id FROM clients WHERE deleted_at IS NULL LIMIT 1`
  );
  assert.ok(rows[0], "aucun client dans la base : le jeu de démonstration n'est pas posé");
  const entreprise = rows[0].entreprise_id;
  const marque = Date.now();
  for (let i = 0; i < COMBIEN; i++) {
    const nom = `Place ${marque}-${String(i).padStart(2, "0")}`;
    await pool.query(
      `INSERT INTO clients (entreprise_id, nom, adresse) VALUES ($1, $2, $3)`,
      [entreprise, nom, `${i} rue de la Place, 44000 Nantes`]
    );
  }
}

async function principal() {
  console.log("=== La flèche de retour rend la place où l'on était ===\n");

  await poserDesClients();

  const nav = await lancerNavigateur();
  const page = await (await nav.newContext({ ...ECRAN_DU_PATRON })).newPage();

  await seConnecter(page);
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-atlas="nom-client"]').first().waitFor();
  await attendreVivante(page);

  if (!(await vivante(page))) {
    console.log(
      "  ⚠️  La page ne s'anime pas : React n'est attaché nulle part. Ce n'est PAS\n" +
        "     la flèche — sans hydratation, aucun appui n'est entendu et rien ici ne\n" +
        "     mesurerait quoi que ce soit (`CLAUDE.md` §5)."
    );
    await nav.close();
    await pool.end();
    process.exit(1);
  }

  const defilable = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );

  await cas("la liste dépasse l'écran — sinon il n'y a aucune place à perdre", async () => {
    // **Refuser de conclure plutôt que de rendre un vert qui ne prouve rien.**
    // Sur une liste qui tient dans l'écran, « on est resté où l'on était » est
    // vrai de toute façon, et le contrôle mesurerait zéro (`CLAUDE.md` §5).
    assert.ok(
      defilable > 300,
      `la liste ne défile que de ${defilable} px : impossible de prouver qu'une place se garde`
    );
  });

  let place = 0;
  await cas("descendre au bas de la liste, ouvrir un client, revenir : on est resté", async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    place = await page.evaluate(() => window.scrollY);
    assert.ok(place > 300, `le défilement n'a pas pris (${place} px)`);

    await page.locator('[data-atlas="nom-client"]').last().click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: DELAI_PAR_DEFAUT_MS });
    await attendreVivante(page);

    await page.locator("header a[aria-label]").first().click();
    await page.waitForURL(`${BASE}/clients`, { timeout: DELAI_PAR_DEFAUT_MS });
    // Le navigateur rend la place APRÈS avoir repeint : on lui laisse le temps
    // de le faire plutôt que de mesurer un écran à moitié posé.
    await page.waitForTimeout(1200);

    const revenu = await page.evaluate(() => window.scrollY);
    assert.ok(
      Math.abs(revenu - place) <= 8,
      `il retombe à ${revenu} px au lieu de ${place} px — sa place est perdue`
    );
  });

  await cas("une fiche ouverte SANS écran d'avant garde une flèche qui mène quelque part", async () => {
    // **Le garde-fou du correctif.** Reculer à l'aveugle depuis une fiche
    // ouverte par un signet, ou rechargée, ferait un bouton qui ne fait rien —
    // ou qui rend la main au site précédent. Sans écran d'avant connu, la
    // flèche doit continuer de MENER à la liste.
    const href = await page.locator('[data-atlas="nom-client"]').first()
      .locator("xpath=ancestor::a[1]")
      .getAttribute("href");
    assert.ok(href, "aucune fiche à ouvrir");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await attendreVivante(page);
    await page.locator("header a[aria-label]").first().click();
    await page.waitForURL(`${BASE}/clients`, { timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(new URL(page.url()).pathname, "/clients");
  });

  await cas("l'aller-retour n'empile plus d'historique", async () => {
    // **Ce que le correctif RETIRE** (`CLAUDE.md` §4 quater) : la flèche
    // posait une entrée de plus à chaque retour, si bien que le retour du
    // navigateur ramenait sur la fiche qu'on venait de quitter — et qu'il
    // fallait appuyer autant de fois qu'on avait ouvert de clients pour sortir.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await attendreVivante(page);
    await page.evaluate(() => {
      const lien = document.querySelector('a[href="/clients"]');
      if (lien instanceof HTMLAnchorElement) lien.click();
    });
    await page.waitForURL(`${BASE}/clients`, { timeout: DELAI_PAR_DEFAUT_MS });
    await attendreVivante(page);

    await page.locator('[data-atlas="nom-client"]').first().click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: DELAI_PAR_DEFAUT_MS });
    await attendreVivante(page);

    await page.locator("header a[aria-label]").first().click();
    await page.waitForURL(`${BASE}/clients`, { timeout: DELAI_PAR_DEFAUT_MS });
    await page.waitForTimeout(600);

    await page.goBack();
    await page.waitForTimeout(1200);
    assert.equal(
      new URL(page.url()).pathname,
      "/",
      "le retour du navigateur ramène sur la fiche : la flèche a empilé une entrée de plus"
    );
  });

  await nav.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅ Tout est vert" : `❌ ${echecs} contrôle(s) rouge(s)`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal().catch((e) => {
  // La panne se DIT en entier : un contrôle muet envoie chercher au mauvais
  // endroit (`AGENTS.md`). La réserve de connexions meurt avec le processus.
  console.error(e);
  process.exit(1);
});
