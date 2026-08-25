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
// aucun document ne les portait (`ARCHITECTURE.md` §175). *Un contrôle qui
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
/**
 * UN JOUR QUE PERSONNE D'AUTRE N'OCCUPE, choisi dans la base plutôt que supposé.
 *
 * **Payé le 25 août 2026, en batterie complète.** La première version prenait
 * « aujourd'hui + 5 » et son voisin, en supposant le second libre. Seule, la
 * suite passait ; dans la batterie, une autre suite avait posé un chantier ce
 * jour-là, la mention s'écrivait sur les deux lignes, et le rouge accusait
 * l'écran de « parler partout » — alors que l'écran disait vrai.
 *
 * **Un contrôle ne suppose pas l'état commun, il le lit.** Les suites partagent
 * une base ; ce qui n'est pas posé par soi ne s'invente pas.
 */
async function jourLibreDEssai(): Promise<string> {
  const { rows } = await pool.query<{ jour: string; duree: number | null }>(
    `SELECT date_planifiee::text AS jour, duree_demi_journees AS duree
       FROM chantiers WHERE date_planifiee IS NOT NULL AND deleted_at IS NULL`
  );
  // Un chantier de plusieurs jours occupe aussi les suivants : compter son seul
  // jour de départ laisserait passer exactement le cas qu'il a signalé le
  // 22 août — « un chantier commencé avant et encore en cours ».
  const pris = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.jour);
    const jours = Math.max(1, Math.ceil((r.duree ?? 2) / 2));
    for (let i = 0; i < jours; i++) {
      pris.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }
  // Assez loin pour que le délai minimal d'envoi l'accepte, assez proche pour
  // être DANS le mois sur lequel le calendrier s'ouvre.
  const d = new Date();
  d.setDate(d.getDate() + 5);
  const mois = d.getMonth();
  while (d.getMonth() === mois) {
    const jour = d.toISOString().slice(0, 10);
    if (!pris.has(jour)) return jour;
    d.setDate(d.getDate() + 1);
  }
  throw new Error(
    "aucun jour libre dans le mois affiché : rien à mesurer. " +
      "Ce n'est pas un défaut du produit, c'est une base d'essai trop chargée."
  );
}

async function main() {
  await nettoyer();
  // **Le week-end n'est pas écarté**, et c'est sa règle du 23 août 2026 : il y
  // travaille en extra, et une journée de week-end porte sa charge comme les
  // autres (`useOccupation`).
  //
  // **Le nettoyage passe AVANT le choix** : sans cela, un reliquat d'une
  // exécution précédente ferait écarter un jour parfaitement libre.
  const jour = await jourLibreDEssai();
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

  // ─── LA CONTRE-ÉPREUVE, SUR LE MÊME JOUR ────────────────────────────────
  //
  // **Elle portait d'abord sur le jour VOISIN, supposé libre — et c'est ce qui
  // l'a fait rougir en batterie complète le 25 août 2026** : une autre suite y
  // avait posé un chantier, la mention s'écrivait donc sur les deux lignes, et
  // le message accusait l'écran de « parler partout » alors qu'il disait vrai.
  //
  // Sur le MÊME jour, avant et après retrait du chantier, il n'y a plus rien à
  // supposer : c'est l'occupation qui change, et elle seule. C'est aussi une
  // preuve plus forte — la mention suit la CHARGE du jour, pas la place de la
  // ligne dans la liste.
  await cas("le même jour, une fois libéré, n'en porte plus aucune", async () => {
    await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
    const case_ = page.locator(`[data-jour="${jour}"]`);
    assert.ok(await case_.count(), `le ${jour} n'est plus au calendrier : rien à mesurer`);
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
    assert.ok(retenues >= 1, "aucune date retenue : rien à mesurer, pas un succès");
    const mentions = await page.locator('[data-atlas="reste-equipes"]').count();
    assert.equal(
      mentions,
      0,
      `${mentions} mention(s) sur un jour redevenu entièrement libre : un avertissement ` +
        `qui parle à tort s'apprend à être ignoré, et l'on perd le garde-fou sans s'en ` +
        `apercevoir`
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
