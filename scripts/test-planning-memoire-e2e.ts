// LA MÉMOIRE DU CALENDRIER — deux ans de jours passés, joués sur le vrai écran.
//
// **Sa question du 31 août 2026 :** *« est-ce que le planning garde en mémoire
// les chantiers passés ? Si non il faut qu'il les garde en mémoire au moins sur
// une année »*, capture de juillet à l'appui — trente et un jours sans une
// marque. Devant la planche 100 et les chiffres du poids : ***« la B »***, et
// ***deux ans***.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI CETTE SUITE EXISTE, alors que la règle est déjà éprouvée pure.**
//
// C'est la leçon du 8 août 2026, écrite en tête de `src/lib/onglet-chantier.ts` :
// la fonction était juste, `test-onglet-chantier.ts` était vert, et l'écran
// appliquait une COPIE fautive à côté. Un contrôle qui ne peut pas atteindre le
// code qui décide ne prouve rien.
//
// Ici, ce qui décide est un tamis posé dans `PlanningClient` et une borne posée
// dans la requête SQL. Les deux doivent tomber sur le même jour, et seul un
// parcours réel peut le dire : le chantier est planté en base, le navigateur
// ouvre le planning, et l'on regarde ce que la case PEINT.
// ═══════════════════════════════════════════════════════════════════════════

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { MEMOIRE_CALENDRIER_JOURS } from "../src/lib/onglet-chantier";

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Un jour à N jours en arrière — en évitant le week-end, que la planche teinte. */
function jourEnArriere(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Trois mois en arrière : franchement dans la mémoire, et à trois coups de
// flèche du mois courant.
const JOUR_RECENT = jourEnArriere(92);
// Au-delà de la butée. `MEMOIRE_CALENDRIER_JOURS + 40` plutôt qu'une date
// écrite en dur : le jour où il demandera trois ans, ce contrôle suivra tout
// seul au lieu de rougir sur une règle qui a changé exprès.
const JOUR_OUBLIE = jourEnArriere(MEMOIRE_CALENDRIER_JOURS + 40);

async function main() {
  console.log("=== Le planning se souvient — deux ans en arrière ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ deviceScaleFactor: 2 });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  /** Un chantier planté sur un jour donné, terminé et facturé — le cas ordinaire du passé. */
  async function chantierPasse(nomClient: string, jour: string) {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', nomClient);
    await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const id = page.url().split("/").pop()!;
    const r = await pool.query(
      `UPDATE chantiers
          SET devis_envoye_at = now() - interval '400 days',
              date_planifiee  = $2,
              creneau_debut   = 'matin',
              duree_demi_journees = 2,
              termine_at      = $2::date + time '17:00',
              facture_envoyee_at = $2::date + interval '3 days'
        WHERE id = $1`,
      [id, jour]
    );
    if (r.rowCount !== 1) {
      throw new Error(
        "Le montage n'a pas pu planter le chantier : le rôle de test ne traverse " +
          "probablement plus RLS (voir CLAUDE.md §5)."
      );
    }
    return id;
  }

  const nomRecent = `Mme Mémoire ${Date.now()}`;
  const nomOublie = `M. Oubli ${Date.now()}`;
  const idRecent = await chantierPasse(nomRecent, JOUR_RECENT);
  await chantierPasse(nomOublie, JOUR_OUBLIE);

  // **DEUX SALARIÉS NOMMÉS, ET UN COCHÉ SUR LE CHANTIER PASSÉ.**
  //
  // Ce n'est pas de la décoration de décor : sans personne de coché, la
  // pastille de lecture n'existe pas, et le contrôle « le salarié qui y était
  // s'affiche quand même » passait au vert **sur une carte vide**. Confronté à
  // l'écran d'avant ce lot, il ne rougissait pas — donc il ne prouvait rien.
  // C'est le contrôle qui mesure zéro de `CLAUDE.md` §5, retrouvé ici.
  await pool.query(
    `UPDATE entreprises SET nombre_equipes = 2, nombre_salaries = 2
      WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
    [idRecent]
  );
  await pool.query(
    `INSERT INTO equipes (entreprise_id, rang, nom)
     SELECT c.entreprise_id, x.rang, x.nom
       FROM chantiers c, (VALUES (1, 'Paul'), (2, 'Julien')) AS x(rang, nom)
      WHERE c.id = $1
     ON CONFLICT (entreprise_id, rang) DO UPDATE SET nom = EXCLUDED.nom`,
    [idRecent]
  );
  const pose = await pool.query(
    `INSERT INTO equipes_du_chantier (entreprise_id, chantier_id, demi, equipe_id)
     SELECT c.entreprise_id, c.id, 'matin', e.id
       FROM chantiers c
       JOIN equipes e ON e.entreprise_id = c.entreprise_id AND e.rang = 1
      WHERE c.id = $1
     ON CONFLICT ON CONSTRAINT equipes_du_chantier_uk DO NOTHING`,
    [idRecent]
  );
  if (pose.rowCount !== 1) {
    throw new Error("Le décor n'a pas pu cocher Paul sur la matinée passée.");
  }

  /** Ramène le calendrier sur le mois du jour visé, en reculant. */
  async function reculerJusquA(jour: string) {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-atlas="grille-mois"]', { timeout: 30_000 });
    for (let i = 0; i < 40; i++) {
      if (await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) return true;
      await page.click('button[aria-label="Mois précédent"]');
      await page.waitForTimeout(60);
    }
    return false;
  }

  console.log("── Ce que la case PEINT");

  await essai(`le ${JOUR_RECENT} porte de nouveau sa charge`, async () => {
    assert.ok(await reculerJusquA(JOUR_RECENT), `le calendrier n'atteint pas le ${JOUR_RECENT}`);
    const etat = await page.getAttribute(
      `[data-atlas="grille-mois"] [data-jour="${JOUR_RECENT}"] [data-demi="matin"]`,
      "data-etat"
    );
    // **Ce qu'on exige, c'est une barre QUI N'EST PAS « libre ».** Pas une
    // couleur nommée : la charge dépend du nombre d'équipes de l'entreprise de
    // démonstration, et fixer « plein » ferait rougir ce contrôle le jour où ce
    // décor change — sur un produit juste (`CLAUDE.md` §5 bis).
    assert.notEqual(etat, "libre", `la demi-journée du matin est rendue « ${etat} »`);
  });

  await essai("et la barre se voit vraiment — pas zéro pixel", async () => {
    // **Zéro n'est pas une mesure.** Un segment présent dans la page mais large
    // de rien ne se voit pas, et rendrait un vert mensonger : c'est le faux vert
    // du 15 août 2026, où `0 − 0 = 0` certifiait « rien n'est coupé » sur un
    // écran où trois noms l'étaient.
    const large = await page
      .locator(`[data-atlas="grille-mois"] [data-jour="${JOUR_RECENT}"] [data-demi="matin"] [data-atlas="seg"]`)
      .evaluate((n) => n.getBoundingClientRect().width);
    assert.ok(large > 2, `le segment mesure ${Math.round(large)} px`);
  });

  await essai(`le ${JOUR_OUBLIE}, au-delà de la mémoire, reste vide`, async () => {
    assert.ok(await reculerJusquA(JOUR_OUBLIE), `le calendrier n'atteint pas le ${JOUR_OUBLIE}`);
    const etat = await page.getAttribute(
      `[data-atlas="grille-mois"] [data-jour="${JOUR_OUBLIE}"] [data-demi="matin"]`,
      "data-etat"
    );
    assert.equal(etat, "libre", `la case porte « ${etat} » alors qu'elle est hors mémoire`);
  });

  console.log("\n── La fiche du jour passé : elle se LIT");

  await essai("elle nomme le chantier qui a eu lieu", async () => {
    assert.ok(await reculerJusquA(JOUR_RECENT));
    await page.click(`[data-atlas="grille-mois"] [data-jour="${JOUR_RECENT}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${JOUR_RECENT}"]`, { timeout: 10_000 });
    const dit = await page.innerText(`[data-atlas="carte-jour"][data-jour="${JOUR_RECENT}"]`);
    assert.ok(dit.includes(nomRecent), `la fiche dit : ${JSON.stringify(dit)}`);
  });

  await essai("aucun geste d'écriture n'y est offert", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR_RECENT}"]`);
    // **D'ABORD : il y a bien un chantier sur lequel on POURRAIT écrire.**
    // Sans cette ligne, « zéro bouton » est vrai d'une carte vide — et le
    // contrôle restait vert contre l'écran d'avant ce lot, qui n'affichait
    // rien. Une absence n'est une preuve que si la présence était possible.
    assert.ok(
      (await carte.locator('[data-atlas="bloc-chantier"]').count()) > 0,
      "la carte ne porte aucun chantier : « aucun geste » ne prouverait rien"
    );
    // Les trois portes d'écriture de la carte, nommées une par une : cocher un
    // salarié, déplacer une demi-journée, retirer le chantier du jour.
    for (const quoi of ["equipe", "deplacer", "retirer"]) {
      assert.equal(
        await carte.locator(`[data-atlas="${quoi}"]`).count(),
        0,
        `« ${quoi} » est encore proposé sur un jour passé`
      );
    }
  });

  await essai("et le « + Ajouter un chantier » a disparu de cette journée", async () => {
    // Même précaution : « zéro bouton » ne prouve rien sur une carte vide.
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR_RECENT}"]`);
    assert.ok(
      (await carte.locator('[data-atlas="bloc-chantier"]').count()) > 0,
      "la carte ne porte aucun chantier : l'absence du « + » ne prouverait rien"
    );
    assert.equal(
      await carte.locator('[data-atlas="ajouter"]').count(),
      0,
      "on peut encore ajouter un chantier à un jour passé"
    );
  });

  await essai("la liste « Planifiés » montre la semaine passée, sans son « + »", async () => {
    // Toucher un jour amène la liste sur SA semaine (`toucherLeJour`) : la
    // section des planifiés porte donc déjà la semaine passée. C'est un SECOND
    // endroit où le « + » est posé, et il a fallu l'éteindre là aussi — une
    // seule des deux portes fermée aurait laissé le geste accessible.
    const jourListe = page.locator(`[data-atlas="jour-planifie"]`).filter({ hasText: nomRecent });
    assert.ok(await jourListe.count(), "le chantier passé n'est pas listé dans « Planifiés »");
    assert.equal(
      await jourListe.first().locator('[data-atlas="ajouter"]').count(),
      0,
      "la liste propose encore d'ajouter un chantier à une journée passée"
    );
  });

  await essai("le salarié qui y était s'affiche quand même — « Paul », en lecture", async () => {
    // Le retrait des gestes ne doit pas emporter l'information : savoir QUI
    // était sur le chantier est précisément ce qu'on vient regarder.
    //
    // **On vise la pastille de LECTURE et son nom**, pas un compte de
    // demi-journées : une journée vide en rend deux, et le contrôle passait
    // au vert sans qu'aucun salarié soit affiché.
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR_RECENT}"]`);
    const lues = carte.locator('[data-atlas="equipe-lecture"]');
    assert.ok((await lues.count()) > 0, "aucun salarié n'est affiché sur la journée passée");
    assert.equal((await lues.first().innerText()).trim(), "Paul");
    // Et il n'est PAS cochable : la pastille d'écriture n'existe pas ici.
    assert.equal(await carte.locator('[data-atlas="equipe"]').count(), 0);
  });

  console.log("\n── Et la règle des onglets ne bouge PAS");

  await essai("…alors qu'un jour À VENIR garde son « + », lui", async () => {
    // **L'inverse, sans quoi tout ce qui précède serait vrai d'un écran cassé.**
    // Un planning qui n'offrirait plus jamais d'ajouter un chantier passerait
    // les trois contrôles ci-dessus au vert.
    const demain = new Date();
    demain.setUTCDate(demain.getUTCDate() + 3);
    const jour = demain.toISOString().slice(0, 10);
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-atlas="grille-mois"]', { timeout: 30_000 });
    for (let i = 0; i < 3; i++) {
      if (await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(60);
    }
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, { timeout: 10_000 });
    assert.equal(
      await page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"] [data-atlas="ajouter"]`).count(),
      1,
      "le « + » a disparu d'un jour à venir : ce lot a cassé le geste ordinaire"
    );
  });

  await essai("le chantier passé est TOUJOURS dans « Terminés »", async () => {
    // C'est la règle du 6 août 2026, et ce lot ne l'assouplit pas : le
    // calendrier le peint, mais il n'est rangé qu'à un seul endroit.
    //
    // **On FEUILLETTE jusqu'à son mois.** Première version : elle lisait la page
    // telle qu'elle s'ouvre. Or « Terminés » montre UN mois à la fois, et le
    // mois d'entrée dépend de ce que les autres suites ont laissé en base —
    // verte jouée seule, rouge dans la batterie, sur un produit juste. Un
    // contrôle dont le verdict dépend de ses voisines ne mesure pas ce qu'il
    // croit.
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    let trouve = false;
    for (let i = 0; i < 18; i++) {
      if ((await page.innerText("body")).includes(nomRecent)) {
        trouve = true;
        break;
      }
      const recul = page.locator('[data-atlas="mois-precedent"]');
      if (await recul.isDisabled()) break;
      await recul.click();
      await page.waitForTimeout(120);
    }
    assert.ok(trouve, "il a disparu de « Terminés », mois par mois jusqu'à la butée");
  });

  await essai("il n'est pas revenu dans « Chantiers »", async () => {
    await page.goto(`${BASE}/chantiers`, { waitUntil: "networkidle" });
    const dit = await page.innerText("body");
    assert.ok(!dit.includes(nomRecent), "il figure dans deux onglets à la fois");
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Mémoire du planning — ${reussis} réussi(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
