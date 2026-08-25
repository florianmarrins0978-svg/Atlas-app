// « RESTE 1 ÉQUIPE SUR 2 » S'ÉCRIT SUR LA DATE QU'IL S'APPRÊTE À PROPOSER.
//
// **Sa colère du 22 août 2026 :** *« je peux proposer le 24 alors qu'un client a
// validé le 24 — corrige-moi ça ! Ça ne doit jamais se reproduire, c'est une
// erreur gravissime !!!! »* Le défaut de code a été réparé le jour même. Ce qui
// restait n'en était pas un : avec deux équipes, un jour à moitié pris reste
// proposable — mais rien ne le disait.
//
// **Sa réponse du 25 août : B**, avec une réserve sur le libellé, corrigée en
// « Reste 1 équipe sur 2 ».
//
// **POURQUOI CETTE SUITE EXISTE EN PLUS DE LA SUITE PURE.**
//
// `test-reste-equipes.ts` éprouve la RÈGLE, et elle est exhaustive. Elle
// resterait verte si personne n'appelait la règle depuis l'écran — c'est
// exactement le défaut du 25 août sur les conditions du devis :
// `lignesConditionsDevis` composait les bonnes phrases depuis onze jours, et
// aucun document ne les portait (`ARCHITECTURE.md` §174). *Un contrôle qui
// éprouve la règle ne voit pas une pièce débranchée.* Celle-ci parcourt le
// chemin : deux équipes en base, un chantier posé un jour, et la mention lue à
// l'écran.
//
// Usage : npm run test:e2e -- --seulement reste-equipes
import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MARQUE = "essai-reste-equipes";

let echecs = 0;
const cas = async (nom: string, verifier: () => Promise<void>) => {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
};

/**
 * **L'état commun se REND**, sans quoi la suite d'après lit un réglage qu'elle
 * n'a pas posé et accuse son propre écran (le piège de
 * `test-absence-equipe-e2e.ts`).
 */
let equipesAvant: number | null = null;
async function nettoyer() {
  await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);
  if (equipesAvant !== null) {
    await pool.query(`UPDATE entreprises SET nombre_equipes = $1`, [equipesAvant]);
  }
}

/**
 * Un jour ouvré assez loin pour que le serveur l'accepte, assez proche pour être
 * DANS le mois affiché.
 *
 * **Les deux bornes ont été payées.** Trop près, le délai minimal d'envoi le
 * refuse et la suite rougit sur un refus parfaitement juste — le pire des
 * rouges (`AGENTS.md`). Trop loin, la case n'est pas au calendrier, qui ouvre
 * sur le mois courant : le premier essai visait trois semaines et ne trouvait
 * rien à mesurer.
 */
function joursDEssai(): { pris: string; libre: string } {
  const base = new Date();
  base.setDate(base.getDate() + 5);
  const suivant = new Date(base);
  suivant.setDate(suivant.getDate() + 1);
  // **Les deux doivent tomber dans le MÊME mois**, celui sur lequel le
  // calendrier s'ouvre : à cheval, la seconde case n'existe pas et la
  // contre-épreuve ne mesure rien. On recule les deux plutôt que d'en perdre
  // une.
  if (suivant.getMonth() !== base.getMonth()) {
    base.setDate(base.getDate() - 1);
    suivant.setDate(suivant.getDate() - 1);
  }
  return { pris: base.toISOString().slice(0, 10), libre: suivant.toISOString().slice(0, 10) };
}

async function main() {
  // **Le week-end n'est pas écarté**, et c'est sa règle du 23 août 2026 : il y
  // travaille en extra, et une journée de week-end porte sa charge comme les
  // autres (`useOccupation`). L'écarter aurait rétréci la fenêtre au point de
  // faire sortir la seconde case du mois affiché.
  const { pris: jour, libre: jourLibre } = joursDEssai();
  await nettoyer();
  equipesAvant =
    (await pool.query(`SELECT nombre_equipes FROM entreprises LIMIT 1`)).rows[0]?.nombre_equipes ?? 1;

  // **Deux équipes, sinon la mention ne s'écrit JAMAIS** — et c'est voulu :
  // « Reste 0 équipe sur 1 » n'apprend rien à qui n'a personne d'autre à
  // envoyer. Posé ici plutôt que supposé.
  await pool.query(`UPDATE entreprises SET nombre_equipes = 2`);

  const { rows: ent } = await pool.query<{ id: string }>(`SELECT id FROM entreprises LIMIT 1`);
  const entrepriseId = ent[0].id;

  // Un chantier D'UNE SEULE équipe posé ce jour-là : il en reste donc une.
  await pool.query(
    `INSERT INTO chantiers (entreprise_id, nom, date_planifiee, creneau_debut, duree_demi_journees)
     VALUES ($1, $2, $3, 'matin', 2)`,
    [entrepriseId, `${MARQUE} — voisin`, jour]
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  console.log("=== Ce qui reste d'équipes, sur la date qu'il propose ===\n");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un chantier à envoyer : un client joignable, et une ligne de prix — un devis
  // à zéro euro n'ouvre pas l'écran des dates.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', "M. Bernard");
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const url = page.url();
  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("800.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });

  await cas("le jour à moitié pris annonce ce qu'il reste", async () => {
    const case_ = page.locator(`[data-jour="${jour}"]`);
    assert.ok(await case_.count(), `le ${jour} n'est pas au calendrier : rien à mesurer`);
    await case_.first().click();
    await page
      .locator("text=Vérification de votre planning…")
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(600);

    const mention = page.locator('[data-atlas="reste-equipes"]');
    assert.ok(
      await mention.count(),
      `aucune mention sur le ${jour}, où une équipe sur deux est déjà prise.\n` +
        `      C'est le jour de sa colère du 22 août : rien ne distingue un jour vide ` +
        `d'un jour à moitié pris.`
    );
    const texte = (await mention.first().innerText()).trim();
    assert.equal(
      texte,
      "Reste 1 équipe sur 2",
      `l'écran écrit « ${texte} » — la règle en dit une autre, ou l'écran la réécrit à sa façon`
    );
  });

  // **ET RIEN SUR UN JOUR VIDE — la contre-épreuve, et elle compte autant.**
  // Un avertissement qui parle à tort s'apprend à être ignoré, et l'on perd le
  // garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter). On retient donc le jour
  // LIBRE en plus du jour pris : deux dates à l'écran, une seule mention.
  //
  // **Deux dates, et pas une seule dans une seconde suite** : c'est la même
  // liste qui doit porter les deux cas, sinon rien ne prouve que la mention
  // suit le JOUR plutôt que d'être posée sur toutes les lignes.
  await cas("le jour libre d'à côté n'en porte aucune", async () => {
    const case_ = page.locator(`[data-jour="${jourLibre}"]`);
    assert.ok(await case_.count(), `le ${jourLibre} n'est pas au calendrier : rien à mesurer`);
    await case_.first().click();
    await page
      .locator("text=Vérification de votre planning…")
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(700);

    const retenues = await page
      .locator('button[aria-pressed="true"]')
      .filter({ hasText: /proposée/ })
      .count();
    assert.equal(retenues, 2, `${retenues} date(s) retenues au lieu de deux : rien à comparer`);
    const mentions = await page.locator('[data-atlas="reste-equipes"]').count();
    // **Le message doit désigner le BON coupable** : zéro et deux sont deux
    // défauts opposés, et un seul message pour les deux enverrait chercher au
    // mauvais endroit (`CLAUDE.md` §5). Vu en débranchant la mention exprès.
    assert.equal(
      mentions,
      1,
      mentions === 0
        ? "aucune mention sur les deux dates : celle du jour à moitié pris a disparu"
        : `${mentions} mentions pour deux dates dont une seule est prise : la mention ne suit ` +
          `pas le jour, elle se pose sur toutes les lignes — et un avertissement qui parle ` +
          `partout s'apprend à être ignoré`
    );
  });

  await navigateur.close();
  await nettoyer();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ Ce qui reste d'équipes s'écrit sur la date proposée — sa réponse B."
      : `\n❌ Ce qui reste d'équipes — ${echecs} échec(s).`
  );
  if (echecs > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await nettoyer().catch(() => undefined);
  process.exit(1);
});
