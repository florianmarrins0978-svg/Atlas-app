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
    await pool.query(`UPDATE entreprises SET nombre_equipes = $1, nombre_salaries = $1`, [equipesAvant]);
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
 * UN JOUR QUE PERSONNE D'AUTRE N'OCCUPE — ni chantier, ni absence d'équipe —,
 * choisi dans la base plutôt que supposé.
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
async function joursLibresDEssai(): Promise<[string, string]> {
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

  // **LES ABSENCES OCCUPENT AUSSI, ET LES OUBLIER A COÛTÉ DEUX BATTERIES.**
  // Une équipe partie retire de la place exactement comme un chantier
  // (`useOccupation`) : un jour sans le moindre chantier peut n'avoir plus
  // personne à envoyer. La première version ne lisait que `chantiers` — seule
  // elle passait, et en batterie complète `test-absence-equipe-e2e`, qui tourne
  // avant celle-ci, laissait une absence sur le jour choisi. Le rouge accusait
  // alors l'écran de « parler à tort » sur un jour où il disait vrai : le pire
  // des rouges, il envoie corriger du code juste (`AGENTS.md`).
  const abs = await pool.query<{ premier: string; dernier: string }>(
    `SELECT premier_jour::text AS premier, dernier_jour::text AS dernier
       FROM absences_equipe WHERE deleted_at IS NULL`
  );
  for (const a of abs.rows) {
    const d = new Date(a.premier);
    const fin = new Date(a.dernier);
    while (d <= fin) {
      pris.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }
  // Assez loin pour que le délai minimal d'envoi l'accepte, assez proche pour
  // être DANS le mois sur lequel le calendrier s'ouvre.
  // **TROIS JOURS D'AVANCE, PAS CINQ.** C'est le plancher que le serveur accepte
  // (`test-envoi-client-e2e` retient le même), et cinq jours ne laissaient que
  // deux dates candidates quand le mois se termine — le 25 août, le 30 et le 31.
  // Il a suffi qu'une suite antérieure en occupe une pour que celle-ci s'arrête
  // faute de matière (batterie du 25 août au soir).
  //
  // **Et l'on déborde sur le mois SUIVANT** plutôt que de renoncer : le
  // calendrier sait avancer d'un mois, et une fin de mois chargée ne doit pas
  // rendre ce contrôle muet. Un contrôle qui se tait selon la date du jour
  // s'apprend à être ignoré (`ARCHITECTURE.md`, la suite qui rougissait le
  // samedi).
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const libres: string[] = [];
  for (let i = 0; i < 70 && libres.length < 2; i++) {
    const jour = d.toISOString().slice(0, 10);
    if (!pris.has(jour)) libres.push(jour);
    d.setDate(d.getDate() + 1);
  }
  if (libres.length < 2) {
    throw new Error(
      "moins de deux jours libres sur les dix semaines à venir : rien à mesurer, et ce " +
        "n'est pas un succès. Ce n'est pas un défaut du produit — c'est une base d'essai " +
        "trop chargée."
    );
  }
  return [libres[0], libres[1]];
}

/**
 * Amène le calendrier sur le mois d'un jour donné, et rend sa case.
 *
 * **Le calendrier s'ouvre sur le mois courant** : une date choisie au-delà n'a
 * pas de case, et le contrôle s'arrêterait sur « rien à mesurer » alors que le
 * produit va très bien.
 */
async function caseDuJour(page: import("playwright").Page, jour: string) {
  for (let i = 0; i < 4; i++) {
    const c = page.locator(`[data-jour="${jour}"]`);
    if (await c.count()) return c.first();
    await page.getByRole("button", { name: "Mois suivant" }).click();
    await page.waitForTimeout(350);
  }
  throw new Error(`le ${jour} reste introuvable après quatre mois : rien à mesurer`);
}

async function main() {
  await nettoyer();
  // **Le week-end n'est pas écarté**, et c'est sa règle du 23 août 2026 : il y
  // travaille en extra, et une journée de week-end porte sa charge comme les
  // autres (`useOccupation`).
  //
  // **Le nettoyage passe AVANT le choix** : sans cela, un reliquat d'une
  // exécution précédente ferait écarter un jour parfaitement libre.
  const [jour, jourLibre] = await joursLibresDEssai();
  equipesAvant =
    (await pool.query(`SELECT nombre_equipes FROM entreprises LIMIT 1`)).rows[0]?.nombre_equipes ?? 1;

  // **Deux équipes, sinon la mention ne s'écrit JAMAIS** — et c'est voulu :
  // « Reste 0 équipe sur 1 » n'apprend rien à qui n'a personne d'autre à
  // envoyer. Posé ici plutôt que supposé.
  // **Les deux compteurs, depuis le 26 août 2026** : les équipes disent la
  // capacité du planning, les salariés décident des noms cochables sur une
  // demi-journée. Ne poser que le premier laisserait l'écran sans case.
  await pool.query(`UPDATE entreprises SET nombre_equipes = 2, nombre_salaries = 2`);

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
    const case_ = await caseDuJour(page, jour);
    await case_.click();
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

  // ─── LA CONTRE-ÉPREUVE, DANS LA MÊME PAGE ───────────────────────────────
  //
  // **TROIS VERSIONS DE CE CAS ONT ROUGI SUR DU CODE JUSTE**, le 25 août 2026 :
  //
  //   1. elle supposait le jour voisin libre — une autre suite y avait posé un
  //      chantier ; cette base est partagée ;
  //   2. elle supprimait le chantier puis rechargeait la page — et l'écran
  //      servait encore le planning d'avant, donc « Reste 1 équipe sur 2 » sur
  //      un jour que la base disait libre.
  //
  // Les trois fois, le message accusait l'écran de « parler à tort » sur un jour
  // où il disait vrai. **Le pire des rouges : il envoie corriger du code juste**
  // (`AGENTS.md`).
  //
  // **D'où cette version : deux jours LUS LIBRES DANS LA BASE, un seul occupé
  // par nous, et les deux retenus dans la MÊME page.** Rien n'est supposé, rien
  // n'est rechargé — il n'y a plus ni état commun ni fraîcheur à espérer. Et
  // c'est une preuve plus forte : la mention suit le JOUR, elle ne se pose pas
  // sur toutes les lignes.
  await cas("le jour libre retenu à côté n'en porte aucune", async () => {
    const case_ = await caseDuJour(page, jourLibre);
    await case_.click();
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
