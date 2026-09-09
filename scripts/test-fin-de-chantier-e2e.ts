// La fin de chantier, jouée à l'écran — du bouton vert au bouton figé.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE PEUT VOIR.**
//
// La règle du retour est éprouvée sans base (`test-retour-intervention.ts`), et
// son isolation en base (`test-retour-intervention-db.ts`). Les deux
// resteraient vertes si le bandeau ne s'ouvrait jamais, si la liste du devis
// restait affichée par-dessus les cases, ou si le bouton redevenait vert au
// rechargement.
//
// **Ses deux décisions du 9 septembre 2026 sont ici, et nulle part ailleurs :**
//
// · *« la liste s'efface quand on ouvre »* — sa proposition A ;
// · *« une fois qu'on clique sur c'est fini, la page se replie toute seule, le
//   bouton dit où c'est parti, et il passe en grisé, on ne peut plus appuyer
//   dessus. »*
//
// **Le dernier cas est le plus important**, et c'est celui qu'on a failli
// manquer : le bandeau ne chargeait son état qu'à l'ouverture, donc le verrou
// n'aurait tenu que le temps d'une session. En rouvrant sa fiche le lendemain,
// il aurait retrouvé un bouton vert sur un chantier déjà rendu.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LIGNE = "[data-atlas='ligne-planifiee']";
const FEUILLE = "[data-atlas='feuille']";
const OUVRIR = "[data-atlas='ouvrir-fin-de-chantier']";
const FIGE = "[data-atlas='retour-pose']";
const TACHE = "[data-atlas='tache-du-retour']";
const FINI = "[data-atlas='cest-fini']";

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

async function main() {
  console.log("=== La fin de chantier, du bouton vert au bouton figé ===\n");

  // Un chantier de la journée, sans retour : c'est l'état du matin.
  const { rows } = await pool.query<{ id: string }>(
    `SELECT c.id FROM chantiers c
       JOIN devis d ON d.chantier_id = c.id AND d.statut = 'envoye'
      WHERE c.deleted_at IS NULL AND c.termine_at IS NULL
      ORDER BY c.created_at DESC LIMIT 1`
  );
  assert.ok(rows.length === 1, "aucun chantier avec un devis envoyé dans le jeu de démonstration");
  const chantierId = rows[0].id;
  await pool.query(`UPDATE chantiers SET date_planifiee = CURRENT_DATE WHERE id = $1`, [chantierId]);
  await pool.query(`DELETE FROM retours_intervention WHERE chantier_id = $1`, [chantierId]);

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  async function ouvrirLaFiche() {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.locator(LIGNE).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(LIGNE).first().click();
    await page.locator(FEUILLE).first().waitFor({ state: "visible", timeout: 20_000 });
  }

  await ouvrirLaFiche();

  await cas("un chantier du jour offre « Fin de chantier », et les lignes du devis se lisent", async () => {
    await page.locator(OUVRIR).waitFor({ state: "visible", timeout: 20_000 });
    const texte = await page.locator(FEUILLE).innerText();
    // Insensible à la casse : le surtitre est mis en CAPITALES par la feuille
    // de style, et `innerText` rend ce qui est AFFICHÉ, pas la source.
    assert.match(texte, /fiche d'intervention/i);
    assert.equal(await page.locator(FIGE).count(), 0, "un chantier neuf s'annonce déjà rendu");
  });

  await cas("LA LISTE DU DEVIS S'EFFACE À L'OUVERTURE — sa proposition A", async () => {
    const avant = await page.locator(`${FEUILLE} > div:not([hidden])`).count();
    await page.locator(OUVRIR).click();
    await page.locator(TACHE).first().waitFor({ state: "visible", timeout: 20_000 });
    const cache = await page.locator(`${FEUILLE} > div[hidden]`).count();
    assert.ok(cache > 0, `la liste du devis reste affichée sous les cases (${avant} blocs visibles avant)`);
  });

  await cas("il coche, et « C'est fini » devient possible", async () => {
    for (const c of await page.locator(TACHE).all()) await c.click();
    assert.equal(await page.locator(FINI).isEnabled(), true, "« C'est fini » reste refusé");
  });

  await cas("une fois envoyé : la fiche se replie, et le bouton dit OÙ c'est parti", async () => {
    await page.locator(FINI).click();
    await page.locator(FIGE).waitFor({ state: "visible", timeout: 25_000 });
    const dit = (await page.locator(FIGE).innerText()).replace(/\n/g, " ");
    assert.match(dit, /C'est parti/);
    // **Il dit OÙ, et c'est tout l'objet** : savoir que c'est parti ne sert que
    // si l'on sait où le retrouver.
    assert.match(dit, /Retour d'intervention/, "le bouton ne dit pas où c'est parti");
    assert.equal(await page.locator(OUVRIR).count(), 0, "le bouton vert est encore là");
    assert.equal(await page.locator(TACHE).count(), 0, "le bandeau ne s'est pas replié");
  });

  await cas("LE BLOC FIGÉ SE DISTINGUE DE LA CARTE — vu à la capture, par aucune mesure", async () => {
    // Les deux couleurs étaient des jetons justes ; c'est leur RENCONTRE qui ne
    // l'était pas. Le bloc se fondait dans la carte et ne ressemblait plus à un
    // bouton éteint, mais à du texte flottant.
    const fond = await page.locator(FIGE).evaluate((e) => getComputedStyle(e).backgroundColor);
    const carte = await page.locator(FEUILLE).evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.notEqual(fond, carte, `le bloc figé a exactement la couleur de la carte (${fond})`);
    const boite = await page.locator(FIGE).boundingBox();
    assert.ok(boite && boite.height > 40, "le bloc figé est écrasé — une boîte plate ne prouve rien");
  });

  await cas("LE VERROU TIENT APRÈS RECHARGEMENT — pas seulement le temps d'une session", async () => {
    await ouvrirLaFiche();
    await page.locator(FIGE).waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(
      await page.locator(OUVRIR).count(),
      0,
      "le bouton vert revient en rouvrant la fiche : le verrou n'a tenu qu'une session"
    );
  });

  await pool.end();
  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} La fin de chantier — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
