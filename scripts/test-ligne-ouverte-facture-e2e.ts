import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * **« Quand je crée une facture il devrait déjà avoir une ligne d'ouverte ! Je
 * ne dois pas avoir besoin d'ajouter une ligne au début ! »** — le patron,
 * 22 septembre 2026, capture à l'appui.
 *
 * Cette suite éprouve SON geste, pas la fonction qu'on vient d'écrire
 * (`CLAUDE.md` §5 quater) : elle part de Terminés, crée la facture comme lui,
 * ouvre la feuille où il la remplit, et écrit dans la case qui l'attend — sans
 * jamais toucher « + Ajouter une ligne ».
 *
 * **Et elle tient l'autre moitié, celle qui ne se voit pas :** tant qu'il n'a
 * rien écrit, la base ne porte AUCUNE ligne. Une ligne vide posée à l'ouverture
 * s'imprimerait sur la facture du client, en face d'un montant à zéro — sur une
 * pièce comptable qui ne se corrige que par un avoir.
 */

const BASE = ADRESSE;

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** Sa porte : Terminés → « Créer une facture » → la fiche → la facture. */
async function creerUneFacture(page: Page, nomClient: string): Promise<string> {
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.click('[data-atlas="creer-une-facture"]');
  await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.fill('input[placeholder="Bernard"]', nomClient);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 14 22 87 30");
  await page.click('[data-atlas="action-facture-directe"]');
  await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: 20000 });
  // On attend la chose qu'on va lire, jamais « le réseau s'est calmé » : le bas
  // de l'écran présent, tout ce qui est au-dessus l'est aussi.
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 20000 });
  return page.url().split("/").slice(-2)[0];
}

/** La feuille où il remplit sa facture — « Remplir la facture », en doré. */
async function ouvrirLaFeuille(page: Page) {
  await page.click('[data-atlas="ajouter-travaux-supplementaires"]');
  await page.waitForURL(/travaux-supplementaires/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

async function main() {
  const navigateur = await lancerNavigateur();
  const context = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  const chantierId = await creerUneFacture(page, `M. Ligne ouverte ${Date.now()}`);
  const lignesEnBase = () =>
    pool.query(
      `SELECT lf.libelle, lf.montant
         FROM lignes_facture lf
         JOIN factures f ON f.id = lf.facture_id
        WHERE f.chantier_id = $1`,
      [chantierId]
    );

  await test("la feuille s'ouvre avec sa première ligne, sans un geste de plus", async () => {
    await ouvrirLaFeuille(page);
    const cases = page.locator('[data-atlas="ligne-supplement"] textarea');
    assert.strictEqual(
      await cases.count(),
      1,
      "la facture s'ouvre sans case à écrire : il faut encore appuyer sur « + Ajouter une ligne »"
    );
    assert.strictEqual(await cases.first().inputValue(), "", "la case ouverte d'avance porte déjà quelque chose");
    // **Une boîte de zéro pixel ne prouve rien** : la case doit être là ET
    // visible, sinon ce contrôle rend un vert sur un écran qu'il n'a pas vu.
    const boite = await cases.first().boundingBox();
    assert.ok(boite && boite.height > 0, "la case ouverte fait zéro pixel : rien n'est mesuré");
  });

  await test("TRAVERSER LES CASES N'ÉCRIT AUCUNE LIGNE VIDE EN BASE", async () => {
    // **C'est ici que se joue le danger propre à la facture.** L'écran
    // enregistre à la sortie de chaque champ, qu'il ait changé ou non : sans la
    // question « y a-t-il quelque chose à écrire ? », poser le doigt sur la
    // description puis le retirer poserait une ligne vide en base — et elle
    // s'imprimerait chez son client, en face de 0,00 €.
    const avant = await lignesEnBase();
    assert.strictEqual(avant.rowCount, 0, `la facture porte déjà ${avant.rowCount} ligne(s), sans un mot écrit`);

    const description = page.locator('[data-atlas="ligne-supplement"] textarea').first();
    const prix = page.locator('[data-atlas="ligne-supplement"] input[aria-label^="Prix unitaire"]').first();
    await description.click();
    await prix.click();
    await prix.blur();
    await page.waitForTimeout(1500);

    const apres = await lignesEnBase();
    assert.strictEqual(
      apres.rowCount,
      0,
      `traverser les cases a écrit ${apres.rowCount} ligne(s) vide(s) : elles partiraient chez le client`
    );
  });

  await test("son premier mot fait naître la ligne, une seule fois", async () => {
    const description = page.locator('[data-atlas="ligne-supplement"] textarea').first();
    const prix = page.locator('[data-atlas="ligne-supplement"] input[aria-label^="Prix unitaire"]').first();
    await description.fill("Dépannage arrosage — remplacement électrovanne");
    await description.blur();
    await prix.fill("145");
    await prix.blur();

    // **On attend le MONTANT, pas une durée.** Les deux sorties de champ
    // partent l'une derrière l'autre ; lue trop tôt, la base ne porte encore
    // que la description, et le rouge accuserait un produit juste.
    const fin = Date.now() + 20_000;
    let ecrites = await lignesEnBase();
    while (ecrites.rows[0]?.montant !== "145.00" && Date.now() < fin) {
      await page.waitForTimeout(250);
      ecrites = await lignesEnBase();
    }
    assert.strictEqual(
      ecrites.rowCount,
      1,
      `la facture porte ${ecrites.rowCount} ligne(s) : la ligne ouverte a été écrite plusieurs fois`
    );
    assert.strictEqual(ecrites.rows[0].montant, "145.00", `montant enregistré : ${ecrites.rows[0].montant}`);
    assert.match(ecrites.rows[0].libelle, /électrovanne/i, `libellé enregistré : ${ecrites.rows[0].libelle}`);
  });

  await test("au rechargement, sa ligne — et pas une case de plus", async () => {
    await page.reload({ waitUntil: "networkidle" });
    const cases = page.locator('[data-atlas="ligne-supplement"] textarea');
    assert.strictEqual(
      await cases.count(),
      1,
      "une case vide s'ajoute sous son travail : la ligne ouverte revient sur une facture déjà remplie"
    );
    assert.match(await cases.first().inputValue(), /électrovanne/i, "la ligne écrite ne se retrouve pas au rechargement");
  });

  // **CE QUE CETTE SUITE NE MESURE PAS ICI, et il faut le dire.** Qu'une
  // facture NÉE D'UN DEVIS n'ouvre aucune case d'avance se joue sur une facture
  // qu'aucun geste de cette suite ne produit : l'amorçage n'en pose pas, et en
  // fabriquer une demanderait un devis envoyé puis un chantier terminé. Ce
  // cas-là est tenu par la suite pure — `test-ligne-ouverte-facture.ts`, le
  // deuxième cas —, et l'écran n'a pas de seconde règle : il appelle cette
  // fonction-là et rien d'autre (`CLAUDE.md` §3).

  await context.close();
  await navigateur.close();
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(
      `\n${failed === 0 ? "✅" : "❌"} La ligne de la facture est ouverte d'avance — ${passed} réussi(s), ${failed} échec(s).`
    );
    process.exit(failed === 0 ? 0 : 1);
  });
