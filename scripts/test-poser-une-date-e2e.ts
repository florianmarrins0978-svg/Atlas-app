import { lancerNavigateur } from "./e2e-browser";
import { ouvrirLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { devices } from "playwright";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { jourDuPatron } from "./_jour-e2e";

// **« Je peux toujours pas poser de date sur les chantiers test. »**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 17 août 2026, capture de son planning à l'appui. **« Toujours »
// n'est pas une figure de style :** une autre session l'avait déjà constaté le
// même jour — *« le patron s'est retrouvé bloqué, la pose à la main lui
// échappant »* — et l'avait **contournée** en faisant pré-poser un chantier par
// un script, sans toucher au geste.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUI ÉTAIT CASSÉ, ET POURQUOI AUCUN TEST NE LE VOYAIT.**
//
// Le geste marchait de bout en bout : toucher le chantier, toucher un jour,
// choisir la demi-journée, poser. `test-planning-e2e` le parcourt entièrement et
// il est vert.
//
// Ce qui manquait n'était pas une fonction, c'était le RACCORD. En touchant un
// chantier de « Sans date », l'écran posait bien « À poser » — **et ne bougeait
// pas d'un pixel**. Mesuré sur son écran de 664 px : le calendrier se trouvait
// à **231 px AU-DESSUS** du haut de la fenêtre. Seule sa dernière rangée
// dépassait — les « 31 1 2 3 4 5 6 » de sa capture. Aucune journée ouverte,
// aucune phrase pour dire quoi faire. De cet écran-là, il n'y avait **aucun
// chemin visible** vers une date.
//
// **ET VOICI POURQUOI LA SUITE EXISTANTE ÉTAIT VERTE :** Playwright fait
// défiler un élément jusqu'à lui AVANT de cliquer dessus. Un contrôle qui
// « clique » n'éprouve donc jamais si la cible était ATTEIGNABLE — il éprouve
// qu'elle existe.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE LE PLANNING REFAIT A CHANGÉ, LE 21 AOÛT 2026** (planche 84, retenue
// par le patron après deux soirées d'essais).
//
// Le raccord n'a plus lieu d'être, parce que le geste ne part plus de là. Deux
// chemins, et le premier ne fait pas remonter l'écran :
//
//   · **depuis la fiche d'un jour** — on touche un jour, et « + Ajouter un
//     chantier » ouvre la liste des sans-date SUR PLACE. Le geste part de là où
//     l'œil est déjà. C'est le chemin principal, et c'est lui qui répond
//     vraiment au défaut du 17 août ;
//   · **depuis « Sans date »** — les trois moments s'arment dès qu'un jour est
//     touché, et **la liste DIT quoi faire** tant qu'aucun ne l'est.
//
// C'est cette dernière phrase qui remplace le raccord mesuré : ce qui l'avait
// bloqué n'était pas une fonction absente, c'était un écran qui n'offrait aucun
// chemin visible. Un écran qui le dit en offre un.
//
// **Le contrôle a donc changé de cible, jamais d'objet** — il défend toujours
// « de cet écran-là, une date se pose » (`CLAUDE.md` §5 bis).

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];

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

async function main() {
  console.log("=== Poser une date : le calendrier vient sous le doigt ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un chantier « sans date » par le vrai chemin : un devis parti, aucune date.
  const NOM = `Poser ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', NOM);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = idChantier;
  const marque = await pool.query(
    `UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`,
    [chantierId]
  );
  if (marque.rowCount !== 1) {
    throw new Error(
      "le montage n'a pas pu faire partir le devis — sans cela le chantier n'entre pas " +
        "dans « Sans date », et la suite accuserait l'écran d'un défaut qui serait le sien"
    );
  }

  const ligne = page.locator(`[data-atlas="sans-date"]:has-text("${NOM}")`).first();

  await cas("le chantier attend bien une date, sous « Sans date »", async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    // Depuis le 3 septembre 2026, la liste vit dans le tiroir du bas
    // (`ARCHITECTURE.md` §243) : on rejoue son appui plutôt que d'exiger un
    // écran qui n'existe plus.
    await ouvrirLeTiroirDuPlanning(page);
    if ((await ligne.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "le chantier n'est pas dans « Sans date ».\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
  });

  // **L'ÉCRAN DIT CE QU'IL MANQUE, il ne reste pas inerte.** C'est la leçon du
  // 17 août, et elle survit à la refonte : ce qui l'avait bloqué, ce n'était pas
  // une fonction absente — c'était une ligne qui annonçait « À poser » sans
  // offrir aucun chemin. Ici la liste le dit en toutes lettres tant qu'aucun
  // jour n'est touché.
  await cas("tant qu'aucun jour n'est touché, la liste DIT quoi faire", async () => {
    await ouvrirLeTiroirDuPlanning(page);
    await page.locator('[data-atlas="sans-date"]').last().scrollIntoViewIfNeeded();
    const dit = await page.locator('[data-atlas="ou-poser"]').innerText();
    if (!/Touchez d’abord un jour/.test(dit)) {
      throw new Error(`la liste ne dit pas quoi faire — lu : « ${dit} »`);
    }
    if ((await ligne.locator("[data-poser]").count()) !== 0) {
      throw new Error("des boutons de pose s'offrent alors qu'aucun jour n'est choisi");
    }
  });

  // **LE CHEMIN QUI NE FAIT PAS REMONTER L'ÉCRAN** — celui de la planche 84 :
  // on touche un jour, et l'on ajoute DEPUIS SA FICHE. C'est la réponse au
  // défaut du 17 août : le geste part de là où l'œil est déjà.
  await cas("depuis la fiche d'un jour, « Ajouter un chantier » le pose", async () => {
    const lireLeMois = () =>
      page.$$eval('[data-atlas="grille-mois"] [data-jour]', (l) =>
        l.map((e) => ({
          jour: e.getAttribute("data-jour"),
          matin: e.querySelector('[data-demi="matin"]')?.getAttribute("data-etat"),
          apres: e.querySelector('[data-demi="apres_midi"]')?.getAttribute("data-etat"),
        }))
      );
    let jours = await lireLeMois();
    // **On vise un jour OUVRABLE, et depuis le 23 août 2026 ce n'est plus
    // parce qu'un samedi refuserait quoi que ce soit** — il offre désormais les
    // mêmes gestes (sa règle : « s'il a des salariés qui font des extras »).
    // C'est simplement le cas ordinaire que ce contrôle décrit ; le samedi a le
    // sien, dans `test-planning-e2e.ts`.
    const ouvrable = (iso: string) => ![0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
    // **ET UN JOUR QUI N'EST PAS PASSÉ — depuis le 31 août 2026.**
    //
    // Ce contrôle prenait le PREMIER jour libre du mois affiché : le 31 août,
    // c'est le 3 août, un jour déjà passé. Il marchait tant que le planning
    // offrait « + Ajouter » sur n'importe quelle journée ; depuis que la
    // mémoire du calendrier existe, un jour passé se lit et ne s'écrit plus
    // (`ARCHITECTURE.md` §224), et le bouton n'y est plus.
    //
    // **On adapte le contrôle, on ne rend pas le bouton** (`CLAUDE.md` §5 bis) :
    // ce qu'il défend est *« de cet écran-là, une date se pose »*, et une date
    // se pose sur un jour à venir. Le jour retenu était incident, pas la règle.
    // **« Aujourd'hui » se lit comme l'ÉCRAN le lit, jamais en UTC.**
    //
    // Trouvé le 2 septembre 2026 à 23 h 36 UTC : cette suite cherchait la carte
    // du 2 septembre alors qu'il était déjà le 3 à l'atelier. Le calendrier
    // n'offre plus un jour passé (`ARCHITECTURE.md` §224), la carte n'existait
    // pas, et le contrôle rougissait — sur du code parfaitement juste, DEUX
    // HEURES CHAQUE NUIT.
    //
    // C'est exactement le piège que `_jour-e2e.ts` a été écrit pour fermer, et
    // que `CLAUDE.md` §3 nomme : deux définitions de la même règle finissent
    // toujours par diverger. Celle-ci n'avait jamais été branchée dessus.
    const aujourdHui = jourDuPatron();
    const chercher = (l: typeof jours) =>
      l.find(
        (j) =>
          j.jour && j.jour >= aujourdHui && ouvrable(j.jour) && j.matin === "libre" && j.apres === "libre"
      );
    // **ET L'ON FEUILLETTE, s'il ne reste rien dans le mois affiché.** Le
    // 31 août, le mois courant n'offre qu'un seul jour à venir — lui —, que les
    // suites d'avant ont déjà occupé. Le contrôle rougissait alors sur un
    // calendrier parfaitement sain, et son verdict dépendait du jour du mois où
    // la batterie tourne. Le mois suivant est à un doigt : c'est ce que le
    // patron ferait.
    let libre = chercher(jours);
    for (let i = 0; i < 3 && !libre; i++) {
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(120);
      jours = await lireLeMois();
      libre = chercher(jours);
    }
    if (!libre) throw new Error("aucun jour ouvrable à venir entièrement libre, sur quatre mois");

    await page.click(`[data-atlas="grille-mois"] [data-jour="${libre.jour}"]`);
    await page.waitForSelector('[data-atlas="carte-jour"]', { timeout: 15_000 });

    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${libre.jour}"]`);
    await carte.locator('[data-atlas="ajouter"]').click();
    // **D'abord QUI, ensuite QUAND** — sa demande du 21 août : se tromper de
    // client n'oblige plus à revenir en arrière.
    await page.waitForSelector(`[data-qui="${chantierId}"]`, { timeout: 10_000 });
    await page.locator(`[data-qui="${chantierId}"]`).click();
    await page.waitForSelector('[data-quand="journee"]', { timeout: 10_000 });
    await page.locator('[data-quand="journee"]').click();
    await page.waitForTimeout(1500);

    const { rows } = await pool.query(
      `SELECT date_planifiee AS jour, creneau_debut AS moment FROM chantiers WHERE id = $1`,
      [chantierId]
    );
    if (!rows[0]?.jour) throw new Error("aucune date en base : la pose n'a rien enregistré");
    const pose =
      rows[0].jour instanceof Date ? rows[0].jour.toISOString().slice(0, 10) : String(rows[0].jour);
    if (pose !== libre.jour) throw new Error(`posé le ${pose} au lieu du ${libre.jour}`);
  });

  await cas("et il quitte « Sans date » — il a sa date", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    if ((await ligne.count()) !== 0) {
      throw new Error("le chantier attend toujours une date alors qu'il vient d'en recevoir une");
    }
  });

  // **L'AUTRE CHEMIN, celui de la liste** — il existe aussi, et il faut qu'un
  // jour touché arme bien les trois boutons. On le rejoue en retirant le
  // chantier du planning, puis en le reposant depuis « Sans date ».
  await cas("un jour touché arme les trois boutons de « Sans date »", async () => {
    await pool.query(`UPDATE chantiers SET date_planifiee = NULL WHERE id = $1`, [chantierId]);
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const jours = await page.$$eval('[data-atlas="grille-mois"] [data-jour]', (l) =>
      l.map((e) => ({
        jour: e.getAttribute("data-jour"),
        matin: e.querySelector('[data-demi="matin"]')?.getAttribute("data-etat"),
      }))
    );
    const ouvrable2 = (iso: string) => ![0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
    const libre = jours.find((j) => j.jour && ouvrable2(j.jour) && j.matin === "libre");
    if (!libre) throw new Error("aucun jour ouvrable libre au calendrier");
    await page.click(`[data-atlas="grille-mois"] [data-jour="${libre.jour}"]`);
    await page.waitForTimeout(600);
    // **Le tiroir se rouvre APRÈS avoir touché le jour**, et l'ordre compte :
    // c'est le jour touché qui arme les trois boutons, donc les lire avant
    // n'éprouverait rien. La liste vit dans le tiroir du bas depuis le
    // 3 septembre 2026 (`ARCHITECTURE.md` §243).
    await ouvrirLeTiroirDuPlanning(page);

    const moments = await ligne.locator("[data-poser]").allInnerTexts();
    if (moments.length !== 3) {
      throw new Error(`la ligne offre ${moments.length} bouton(s) : ${JSON.stringify(moments)}`);
    }
    await ligne.locator('[data-poser="matin"]').click();
    await page.waitForTimeout(1500);

    const { rows } = await pool.query(
      `SELECT date_planifiee AS jour, creneau_debut AS moment, duree_demi_journees AS duree
         FROM chantiers WHERE id = $1`,
      [chantierId]
    );
    const pose =
      rows[0].jour instanceof Date ? rows[0].jour.toISOString().slice(0, 10) : String(rows[0].jour);
    if (pose !== libre.jour) throw new Error(`posé le ${pose} au lieu du ${libre.jour}`);
    if (rows[0].moment !== "matin") throw new Error(`posé sur « ${rows[0].moment} » et non le matin`);
    if (rows[0].duree !== 1) throw new Error(`un matin fait une demi-journée, pas ${rows[0].duree}`);
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Poser une date — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
