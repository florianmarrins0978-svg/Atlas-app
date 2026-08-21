import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
// qu'elle existe. Ce contrôle-ci ne clique pas pour vérifier : il MESURE la
// position du calendrier dans la fenêtre après l'appui, ce qu'aucun clic ne
// peut dire.

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
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];
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
    if ((await ligne.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "le chantier n'est pas dans « Sans date ».\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
  });

  await cas("LE RACCORD : le toucher amène le calendrier sous les yeux", async () => {
    // **On descend jusqu'à la liste comme lui**, sans passer par un clic
    // Playwright qui ferait défiler tout seul — c'est ce défilement automatique
    // qui rendait le défaut invisible à la suite existante.
    await page.locator('[data-atlas="sans-date"]').last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const avant = await page.evaluate(() => {
      const g = document.querySelector('[data-atlas="grille-mois"]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { haut: Math.round(r.top), bas: Math.round(r.bottom), ecran: window.innerHeight };
    });
    if (!avant) throw new Error("aucun calendrier sur l'écran du planning");
    // Le décor de son cas : de la liste, le calendrier est bel et bien parti en
    // haut. Si ce n'était pas vrai, le contrôle ne prouverait rien.
    if (avant.haut > 0) {
      throw new Error(
        `le calendrier est déjà visible avant l'appui (haut à ${avant.haut} px) : ` +
          "la scène n'est pas la sienne, et ce contrôle ne mesurerait rien"
      );
    }

    await ligne.click();
    await page.waitForTimeout(1200);

    const apres = await page.evaluate(() => {
      const g = document.querySelector('[data-atlas="grille-mois"]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { haut: Math.round(r.top), bas: Math.round(r.bottom), ecran: window.innerHeight };
    });
    if (!apres) throw new Error("le calendrier a disparu après l'appui");

    // **LE CONTRÔLE QUI PORTE CE LOT.** Le calendrier doit être ENTIÈREMENT
    // dans la fenêtre : à moitié dedans, il faut deviner qu'il faut remonter,
    // et c'est exactement ce qui l'a bloqué deux fois.
    if (apres.haut < 0 || apres.bas > apres.ecran) {
      throw new Error(
        `le calendrier n'est pas venu sous les yeux : ${apres.haut} → ${apres.bas} ` +
          `pour ${apres.ecran} px d'écran (il était à ${avant.haut} avant l'appui)`
      );
    }
  });

  await cas("et de là, la date se pose pour de bon", async () => {
    const jours = await page.$$eval('[data-atlas="grille-mois"] button', (l) =>
      l.map((e) => ({ jour: e.getAttribute("data-jour"), marque: e.getAttribute("data-marque") }))
    );
    const libre = jours.find((j) => j.marque === "libre" && j.jour);
    if (!libre) throw new Error("aucun jour libre au calendrier");

    await page.click(`[data-atlas="grille-mois"] button[data-jour="${libre.jour}"]`);
    await page.waitForTimeout(700);
    const journee = page.locator('[data-atlas="journee"]');
    if ((await journee.count()) === 0) throw new Error("toucher un jour n'ouvre rien");
    // L'écran doit NOMMER ce qu'il va poser : sans cela, on ne sait pas lequel
    // des cinq chantiers de la liste est en jeu.
    const dit = (await journee.innerText()).replace(/\s+/g, " ");
    if (!dit.includes(NOM)) {
      throw new Error(`la journée ouverte ne nomme pas le chantier visé : « ${dit.slice(0, 120)} »`);
    }

    await page.locator('[data-atlas="creneau"][data-libre="oui"]').first().click();
    await page.waitForTimeout(400);
    const bouton = page.locator('[data-atlas="poser"]');
    if (await bouton.isDisabled()) throw new Error("le bouton reste éteint après le choix du créneau");
    await bouton.click();
    await page.waitForTimeout(1500);

    const { rows } = await pool.query(
      `SELECT date_planifiee AS jour, creneau_debut AS moment FROM chantiers WHERE id = $1`,
      [chantierId]
    );
    if (!rows[0]?.jour) throw new Error("aucune date en base : la pose n'a rien enregistré");
    const pose = rows[0].jour instanceof Date ? rows[0].jour.toISOString().slice(0, 10) : String(rows[0].jour);
    if (pose !== libre.jour) throw new Error(`posé le ${pose} au lieu du ${libre.jour}`);
  });

  await cas("et il quitte « Sans date » — il a sa date", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    if ((await ligne.count()) !== 0) {
      throw new Error("le chantier attend toujours une date alors qu'il vient d'en recevoir une");
    }
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
