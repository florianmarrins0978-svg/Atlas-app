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
import { jourIso } from "../src/lib/jour";

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
async function joursLibresDEssai(): Promise<string[]> {
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
  //
  // **ET L'ON EN REND PLUSIEURS, PAS DEUX.** Payé le 27 août 2026 : la base
  // disait le 31 août libre, l'écran a refusé de le retenir, et le contrôle
  // annonçait « 1 date au lieu de 2 » sans dire laquelle ni pourquoi. C'est
  // `verifierJourProposeAction` qui tranche — pas cette requête, qui n'en est
  // qu'une approximation. On propose donc une réserve de candidats, et c'est le
  // SERVEUR qui choisit lequel tient (voir `retenirUnJourQueLeServeurACCEPTE`).
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const libres: string[] = [];
  for (let i = 0; i < 70; i++) {
    const jour = jourIso(d);
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
  return libres;
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
  const candidats = await joursLibresDEssai();
  const jour = candidats[0];
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
  // L'adresse se bâtit sur l'identifiant que l'aide rend : la relire dans
  // le navigateur donnait « devis-complet » depuis que la fiche du chantier
  // est retirée (`ARCHITECTURE.md` §254).
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
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

  /**
   * Retient un jour au calendrier, en s'assurant que la feuille est OUVERTE.
   *
   * **Payé le 27 août 2026.** Les deux cas retenaient chacun leur jour, et le
   * second cliquait sans rouvrir : la feuille des dates s'était refermée
   * entre-temps, et le clic est tombé sur le « Retirer » d'une ligne de prix,
   * derrière. L'écran annonçait alors « Retiré à l'instant », une seule date
   * était retenue, et le contrôle accusait la mention de ne pas suivre le jour
   * — alors qu'aucun second jour n'avait été posé.
   *
   * **Un contrôle qui clique sans vérifier ce qu'il y a sous le doigt mesure ce
   * qu'il a cassé.**
   */
  async function retenir(quand: string) {
    // **On regarde si le CALENDRIER est visible, pas si un repère existe.**
    // Première version : elle testait la présence de `invite-dates`, qui reste
    // dans la page même feuille refermée. Le contrôle croyait donc la feuille
    // ouverte, cliquait dans le vide, et concluait plus loin qu'une mention
    // manquait — alors qu'aucune date n'avait été posée.
    const grille = page.locator("[data-jour]").first();
    if (!(await grille.isVisible().catch(() => false))) {
      await page.click("text=Choisir la date");
      await page.waitForSelector("[data-jour]", { state: "visible", timeout: 30_000 });
    }
    const c = await caseDuJour(page, quand);
    await c.click();
    await page
      .locator("text=Vérification de votre planning…")
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
    // **On attend que la case se MARQUE, comme le fait la suite d'envoi.** Un
    // délai ne dit pas si le serveur a accepté le jour : rougir ici désigne le
    // bon coupable — la date a été refusée — au lieu de laisser le contrôle
    // conclure plus loin qu'une mention manque.
    await page
      .locator(`[data-jour="${quand}"][data-etat="retenu"]`)
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(async () => {
        const etat = await page.locator(`[data-jour="${quand}"]`).first().getAttribute("data-etat");
        const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        const apres = txt.indexOf("Choisir la date");
        throw new Error(
          `le ${quand} n'a pas été retenu (état « ${etat} »). Écran : ` +
            txt.slice(apres > 0 ? apres : 0, (apres > 0 ? apres : 0) + 420)
        );
      });
    await page.waitForTimeout(400);
  }

  // **LES DEUX JOURS SE RETIENNENT D'AFFILÉE, avant toute mesure.**
  //
  // Payé le 27 août 2026 : chaque cas retenait son jour, et le second n'y
  // arrivait jamais. La feuille des dates se referme après un choix, et la
  // rouvrir ne rend pas la sélection — le second clic tombait alors dans le
  // vide, ou pire sur le « Retirer » d'une ligne de prix qui se trouvait
  // dessous. L'écran annonçait « Retiré à l'instant », et le contrôle accusait
  // la mention de ne pas suivre le jour alors qu'aucun second jour n'avait été
  // posé.
  //
  // C'est le geste de `test-envoi-client-e2e`, qui retient deux dates de suite
  // sans difficulté : on ne l'invente pas, on le reprend.
  // ─── UNE SEULE DATE, ET C'EST DÉLIBÉRÉ ──────────────────────────────────
  //
  // **Ce cas a été réécrit CINQ fois, et les quatre premières ont rougi sur du
  // code juste** (25 et 27 août 2026) : le jour voisin supposé libre ; la
  // suppression suivie d'un rechargement, l'écran servant encore le planning
  // d'avant ; le clic sur une feuille refermée, qui tombait sur le « Retirer »
  // d'une ligne de prix ; le plafond de deux dates de l'écran, qui refusait
  // notre troisième à juste titre. **Le pire des rouges : il envoie corriger ce
  // qui marche** (`AGENTS.md`).
  //
  // Toutes ces versions avaient le même défaut de conception : elles voulaient
  // DEUX dates retenues pour montrer que la mention suit le jour. Or l'écran
  // d'envoi a ses propres règles — un plafond, une feuille qui se referme, une
  // date déjà posée à l'ouverture — et chacune produisait un faux rouge.
  //
  // **Une seule date suffit, et prouve la même chose :** on vérifie que la
  // mention est DANS la ligne qui porte ce jour-là. Ce que la seconde date
  // apportait — « elle ne se pose pas sur toutes les lignes » — est déjà tenu,
  // et exhaustivement, par `scripts/test-reste-equipes.ts`, qui balaie toutes
  // les combinaisons sans navigateur.
  //
  // Ce qui reste ICI est ce qu'aucune règle pure ne peut voir : **que l'écran
  // appelle vraiment la règle.** C'est la leçon du 25 août — un contrôle qui
  // éprouve la règle ne voit pas une pièce débranchée (`ARCHITECTURE.md` §175).
  const case_ = await caseDuJour(page, jour);
  await case_.click();
  await page
    .locator("text=Vérification de votre planning…")
    .waitFor({ state: "hidden", timeout: 20_000 })
    .catch(() => undefined);
  // **On attend que la case se MARQUE.** Un délai ne dit pas si le serveur a
  // accepté le jour : rougir ici nomme le bon coupable — la date a été refusée
  // — au lieu de laisser conclure plus loin qu'une mention manque.
  await page
    .locator(`[data-jour="${jour}"][data-etat="retenu"]`)
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(async () => {
      const etat = await page.locator(`[data-jour="${jour}"]`).first().getAttribute("data-etat");
      throw new Error(
        `le ${jour} n'a pas été retenu (état « ${etat} ») : la date a été refusée, ` +
          "et rien de ce qui suit ne mesurerait ce qu'il annonce"
      );
    });
  await page.waitForTimeout(500);

  await cas("le jour à moitié pris annonce ce qu'il reste", async () => {
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
    /**
     * **C'EST LE SERVEUR QUI DIT SI UN JOUR TIENT, PAS NOTRE REQUÊTE.**
     *
     * **Payé le 27 août 2026.** La base disait le 31 août libre — aucun
     * chantier, aucune absence —, `verifierJourProposeAction` l'a refusé, et la
     * case est restée éteinte. Le contrôle annonçait alors « 1 date retenue au
     * lieu de deux » sans dire laquelle manquait ni pourquoi, et il envoyait
     * chercher un défaut dans un écran qui obéissait exactement à son serveur.
     *
     * On essaie donc les candidats l'un après l'autre et **on garde celui que
     * l'écran retient vraiment**. Le contrôle reste entier : si aucun ne tient,
     * il rougit — en citant la raison que le serveur affiche, plutôt qu'un
     * nombre.
     */
    let jourLibre = "";
    let derniereRaison = "";
    const aEssayer = candidats.slice(1, 9);
    for (const candidat of aEssayer) {
      const case_ = await caseDuJour(page, candidat);
      await case_.click();
      await page
        .locator("text=Vérification de votre planning…")
        .waitFor({ state: "hidden", timeout: 20_000 })
        .catch(() => undefined);
      await page.waitForTimeout(700);
      if (await page.locator(`[data-jour="${candidat}"][data-etat="retenu"]`).count()) {
        jourLibre = candidat;
        break;
      }
      derniereRaison =
        (await page.locator('[data-atlas="verdict-du-jour"]').first().innerText().catch(() => "")) ||
        derniereRaison;
    }
    assert.ok(
      jourLibre,
      `aucun des ${aEssayer.length} jours libres n'a pu être retenu par l'écran.\n` +
        `      essayés : ${aEssayer.join(", ")}\n` +
        `      dernière raison affichée : ${derniereRaison.replace(/\s+/g, " ").trim() || "(aucune)"}`
    );

    const chips = page.locator('button[aria-pressed="true"]').filter({ hasText: /proposée/ });
    const retenues = await chips.count();
    // **Un message qui NOMME les dates, pas seulement leur nombre.** « 1 au lieu
    // de 2 » ne dit pas laquelle manque, et il a fallu trois rejouages pour
    // l'apprendre. Un contrôle qui échoue doit désigner le bon coupable
    // (`AGENTS.md`).
    const libelles = retenues > 0 ? (await chips.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()) : [];
    assert.equal(
      retenues,
      2,
      `${retenues} date(s) retenues au lieu de deux : rien à comparer.\n` +
        `      demandées : ${jour} puis ${jourLibre}\n` +
        `      retenues à l'écran : ${libelles.join(" | ") || "aucune"}`
    );

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
