import assert from "node:assert/strict";
import { devices } from "playwright";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { fermerLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { pool } from "../src/server/db/client";
import { jourDuPatron } from "./_jour-e2e";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// POSER UN CLIENT SUR UN JOUR, SANS DEVIS — sa planche du 10 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Si j'ai un chantier à rajouter ou quelque chose, que je puisse le faire
// sans devoir passer par la fiche client et le devis. »* Puis sa correction, en
// essayant `appli/bloquer-sans-devis.html` : *« à côté de Bernard il faut une
// touche annuler si on veut retourner sur les deux propositions, et pareil pour
// écrire ce que c'est — change le nom en un client. Et si le client n'est pas
// reconnu, il faut qu'il ajoute aussi sa fiche client automatiquement, comme
// pour les autres. »*
//
// **ON ENTRE PAR SA PORTE** (`CLAUDE.md` §5 quater). Les règles du geste sont
// tenues sans navigateur (`test-poser-un-client-db.ts`) ; ici on éprouve qu'il
// est ATTEIGNABLE : le +, les deux voies, « Annuler » à chaque étape, la fiche
// qui s'ouvre sur un inconnu, et ce que la base porte après l'appui.
//
// Usage : npm run test:e2e -- --seulement bloquer-sans-devis

const BASE = ADRESSE;
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

/** Un nom que personne ne porte : ce lot doit lui créer une fiche. */
const INCONNUE = `Mme Renard ${Date.now() % 100000}`;

async function main() {
  console.log("=== Poser un client sur un jour, sans devis ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  /** Un jour ouvrable à venir, entièrement libre — et l'on feuillette. */
  const jourLibre = async (): Promise<string> => {
    const aujourdHui = jourDuPatron();
    const ouvrable = (iso: string) => ![0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
    for (let mois = 0; mois < 4; mois++) {
      if (mois > 0) {
        await page.click('button[aria-label="Mois suivant"]');
        await page.waitForTimeout(150);
      }
      const jours = await page.$$eval('[data-atlas="grille-mois"] [data-jour]', (l) =>
        l.map((e) => ({
          jour: e.getAttribute("data-jour"),
          matin: e.querySelector('[data-demi="matin"]')?.getAttribute("data-etat"),
          apres: e.querySelector('[data-demi="apres_midi"]')?.getAttribute("data-etat"),
        }))
      );
      const libre = jours.find(
        (j) =>
          j.jour && j.jour > aujourdHui && ouvrable(j.jour) && j.matin === "libre" && j.apres === "libre"
      );
      if (libre?.jour) return libre.jour;
    }
    throw new Error("aucun jour ouvrable à venir entièrement libre, sur quatre mois");
  };

  const ouvrirLeJour = async (jour: string) => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await fermerLeTiroirDuPlanning(page);
    for (let i = 0; i < 4; i++) {
      if ((await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) > 0) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, { timeout: 15_000 });
    await page.waitForTimeout(400);
    return page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
  };

  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const jour = await jourLibre();
  console.log(`  · jour visé : ${jour}`);

  await cas("« + Ajouter » propose DEUX voies, et « Annuler » les referme", async () => {
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    await page.waitForTimeout(300);
    assert.ok(
      (await carte.locator('[data-atlas="voie-client"]').count()) >= 1,
      "« Un client » manque : la seconde voie n'existe pas"
    );
    await carte.locator('[data-atlas="annuler-ajout"]').first().click();
    await page.waitForTimeout(300);
    assert.equal(
      await carte.locator('[data-atlas="voie-client"]').count(),
      0,
      "« Annuler » ne referme pas le geste"
    );
    assert.ok((await carte.locator('[data-atlas="ajouter"]').count()) >= 1, "le + n'est pas revenu");
  });

  await cas("« Annuler » RAMÈNE AUX DEUX VOIES depuis le client — sa demande", async () => {
    // *« À côté de Bernard il faut une touche annuler si on veut retourner sur
    // les deux propositions »* — et la même chose depuis « Un client ».
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    await page.waitForTimeout(300);
    await carte.locator('[data-atlas="voie-client"]').click();
    await page.waitForTimeout(300);
    assert.equal(await carte.locator('[data-atlas="nom-du-client"]').count(), 1, "le champ du nom manque");
    await carte.locator('[data-atlas="annuler-ajout"]').first().click();
    await page.waitForTimeout(300);
    assert.ok(
      (await carte.locator('[data-atlas="voie-client"]').count()) >= 1,
      "« Annuler » a refermé le geste au lieu de revenir aux deux voies"
    );
  });

  await cas("un client INCONNU : sa fiche s'ouvre, et le geste la crée", async () => {
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    await page.waitForTimeout(300);
    await carte.locator('[data-atlas="voie-client"]').click();
    await page.waitForTimeout(300);
    await carte.locator('[data-atlas="nom-du-client"]').fill(INCONNUE);
    // **On attend la RÉPONSE du serveur**, jamais un délai : tant qu'il
    // cherche, l'écran ne dit rien — et c'est voulu, sinon « Inconnu »
    // clignoterait à chaque lettre.
    await carte.locator('[data-atlas="fiche-a-creer"]').waitFor({ state: "visible", timeout: 15_000 });
    await carte.locator('[data-atlas="fiche-telephone"]').fill("06 11 22 33 44");
    await carte.locator('[data-atlas="fiche-adresse"]').fill("5 rue des Lilas, Mantes");
    // **IL SE VISE, une fois amené sous les yeux.** Le tiroir du bas est
    // `fixed` : ce qui tombe dessous se clique très bien depuis un script et
    // pas du tout avec un pouce. On mesure donc le RECOUVREMENT — c'est ce
    // défaut qui a fait publier au tiroir sa propre hauteur (`--atlas-tiroir`).
    await carte
      .locator('[data-atlas="poser-le-client"]')
      .evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    const vise = await page.evaluate(() => {
      const cible = document.querySelector<HTMLElement>('[data-atlas="poser-le-client"]');
      if (!cible) return null;
      const b = cible.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return null;
      const bandes = [...document.querySelectorAll<HTMLElement>("*")]
        .filter((e) => getComputedStyle(e).position === "fixed")
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 8);
      return {
        recouvert: bandes.some(
          (r) => b.top < r.bottom && b.bottom > r.top && b.left < r.right && b.right > r.left
        ),
        hauteur: b.height,
      };
    });
    assert.ok(vise, "« Poser » n'a pas de boîte mesurable : rien n'est mesuré");
    assert.ok(!vise.recouvert, "« Poser » passe sous une bande fixe : il ne se vise pas");
    assert.ok(vise.hauteur >= 34, `« Poser » ne fait que ${Math.round(vise.hauteur)} px de haut`);

    await carte.locator('[data-atlas="quand-poser"] [data-quand="apres_midi"]').click();
    await carte.locator('[data-atlas="poser-le-client"]').click();

    // **Ce que la BASE porte, et non ce que l'écran espère.**
    const lu = async () => {
      const { rows } = await pool.query(
        `SELECT c.id, c.date_planifiee::text AS jour, c.duree_demi_journees AS duree,
                c.devis_envoye_at, cl.telephone, cl.adresse
           FROM chantiers c JOIN clients cl ON cl.id = c.client_id
          WHERE cl.nom = $1`,
        [INCONNUE]
      );
      return rows[0];
    };
    let ligne = await lu();
    for (let i = 0; i < 40 && !ligne; i++) {
      await page.waitForTimeout(250);
      ligne = await lu();
    }
    assert.ok(ligne, "aucun chantier ni aucune fiche : le geste n'a rien écrit");
    assert.equal(ligne.jour, jour, "le chantier n'est pas sur le jour touché");
    assert.equal(ligne.duree, 1, "« Après-midi » a réservé autre chose qu'une demi-journée");
    assert.equal(ligne.devis_envoye_at, null, "un devis est parti alors qu'on n'en a rédigé aucun");
    assert.equal(ligne.telephone, "06 11 22 33 44", "le numéro n'est pas dans sa fiche");
    assert.equal(ligne.adresse, "5 rue des Lilas, Mantes", "l'adresse n'est pas dans sa fiche");

    const creneaux = await pool.query(
      `SELECT jour::text AS jour, demi FROM creneaux_chantier WHERE chantier_id = $1`,
      [ligne.id]
    );
    assert.deepEqual(
      creneaux.rows.map((r) => `${r.jour} ${r.demi}`),
      [`${jour} apres_midi`],
      "la demi-journée prise n'est pas celle qu'il a choisie"
    );
  });

  await cas("rechargé, le chantier est sur la journée — et l'après-midi est pris", async () => {
    const carte = await ouvrirLeJour(jour);
    const dit = (await carte.innerText()).replace(/\s+/g, " ");
    assert.ok(
      dit.includes(INCONNUE),
      `la journée ne montre pas le chantier posé — lu : « ${dit.slice(0, 160)} »`
    );
    const apres = carte.locator('[data-atlas="demi"][data-bloc="apres_midi"]').first();
    assert.notEqual(
      await apres.getAttribute("data-sans-chantier"),
      "1",
      "l'après-midi s'annonce libre alors qu'il vient d'être pris"
    );
  });

  await cas("un client CONNU se retrouve au nom, et ne se dédouble pas", async () => {
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    await page.waitForTimeout(300);
    await carte.locator('[data-atlas="voie-client"]').click();
    await page.waitForTimeout(300);
    await carte.locator('[data-atlas="nom-du-client"]').fill(INCONNUE);
    const propose = carte.locator('[data-atlas="client-trouve"]');
    await propose.first().waitFor({ state: "visible", timeout: 15_000 });
    await propose.first().click();
    await page.waitForTimeout(300);
    assert.equal(
      await carte.locator('[data-atlas="fiche-a-creer"]').count(),
      0,
      "l'écran propose de créer une fiche à quelqu'un qu'il vient de reconnaître"
    );
    await carte.locator('[data-atlas="poser-le-client"]').click();

    const compte = async () =>
      Number(
        (await pool.query(`SELECT count(*) AS n FROM clients WHERE nom = $1`, [INCONNUE])).rows[0].n
      );
    for (let i = 0; i < 40 && (await compte()) === 1; i++) await page.waitForTimeout(250);
    assert.equal(await compte(), 1, "une seconde fiche a été créée pour le même client");
  });

  // **On rend la base comme on l'a trouvée** : ces deux chantiers occupent un
  // jour que les autres suites cherchent libre (`CLAUDE.md` §5).
  await pool.query(
    `DELETE FROM creneaux_chantier WHERE chantier_id IN
       (SELECT c.id FROM chantiers c JOIN clients cl ON cl.id = c.client_id WHERE cl.nom = $1)`,
    [INCONNUE]
  );
  await pool.query(
    `UPDATE chantiers SET date_planifiee = NULL, creneau_debut = NULL, deleted_at = now()
      WHERE client_id IN (SELECT id FROM clients WHERE nom = $1)`,
    [INCONNUE]
  );

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ Bloquer sans devis — ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Un client se pose sur un jour, sans devis — et sa fiche se crée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
