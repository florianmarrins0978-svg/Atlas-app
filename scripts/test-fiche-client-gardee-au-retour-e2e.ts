import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import type { Page } from "playwright";
import { ADRESSE } from "./_adresse";

/**
 * CE QU'IL A TAPÉ SUR LA FICHE CLIENT RESTE QUAND IL FAIT RETOUR — 22 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque :** *« Je crée un devis, je remplis la fiche client, je fais
 * retour, mais elle n'apparaît plus dans mes clients en cours !! »*
 *
 * Reproduit sur une version bâtie avant ce lot, les deux fois où il remplit la
 * fiche client :
 *
 * | la fiche | ce que la flèche faisait |
 * |---|---|
 * | la feuille « Créer un devis » de l'accueil | se refermait : aucun chantier, la saisie perdue |
 * | la fiche rouverte depuis le devis (« Renseigner la fiche client ») | revenait à l'accueil : le chantier restait « Chantier du … », sans son client |
 *
 * Depuis le 17 septembre 2026, seul « Je rédige à la main » enregistrait — la
 * flèche jetait tout, en silence. Ce contrôle fixe la PROMESSE (le nom tapé est
 * sur l'accueil au retour), jamais le mécanisme qui la tient (`CLAUDE.md` §5 bis).
 *
 * **Et la réciproque** : une feuille ouverte puis refermée SANS rien taper ne
 * crée rien. Sans elle, la correction pourrait fabriquer un chantier vide à
 * chaque ouverture par erreur, et ce contrôle resterait vert.
 *
 * **Sait échouer** : jouée sur le code d'avant ce lot, elle tombe sur « la
 * feuille refermée a perdu … ».
 */
const BASE = ADRESSE;

/** Sous le battement de trente secondes de `VeilleDesNouvelles`, qui sinon
 *  réparerait le défaut d'affichage — voir `test-chantier-neuf-au-retour-e2e.ts`. */
const PATIENCE_MS = 8_000;

async function compteEnCours(page: Page): Promise<number> {
  const compteur = page.locator('[data-atlas="compteur"]');
  await compteur.waitFor({ state: "visible", timeout: 15_000 });
  const n = Number(await compteur.getAttribute("data-compte"));
  assert.ok(Number.isFinite(n), "Le compteur de l'accueil ne se lit pas : rien n'est éprouvé");
  return n;
}

async function voitLaLigne(page: Page, nom: string): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${nom}`, { timeout: PATIENCE_MS });
    return true;
  } catch {
    return false;
  }
}

async function ouvrirLaFeuille(page: Page) {
  await page.click('[data-atlas="nouveau-chantier"]');
  await page.waitForSelector('[role="dialog"] input[placeholder="Bernard"]', { state: "visible", timeout: 15_000 });
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const feuille = page.locator('[role="dialog"]');
  const retourDeLaFeuille = feuille.getByRole("button", { name: "Retour à la liste des chantiers" });

  // ── 0. Ouverte puis refermée sans rien taper : rien ne naît ──────────────
  const avantRien = await compteEnCours(page);
  await ouvrirLaFeuille(page);
  await retourDeLaFeuille.click();
  await page.waitForTimeout(1_500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await compteEnCours(page),
    avantRien,
    "Une feuille ouverte puis refermée sans rien taper a créé un chantier"
  );

  // ── 1. La feuille de l'accueil : il tape, il fait retour ─────────────────
  const avant = await compteEnCours(page);
  const nomFeuille = `Feuille ${Date.now().toString().slice(-6)}`;
  await ouvrirLaFeuille(page);
  await feuille.locator('input[placeholder="Bernard"]').fill(nomFeuille);
  await feuille.locator('input[placeholder="06 12 34 56 78"]').fill("0612345678");
  await retourDeLaFeuille.click();

  if (!(await voitLaLigne(page, nomFeuille))) {
    await page.reload({ waitUntil: "networkidle" });
    const apresRechargement = await page.locator(`text=${nomFeuille}`).count();
    assert.fail(
      `La feuille refermée a perdu « ${nomFeuille} » : l'accueil ne le porte pas ` +
        `(au rechargement, ${apresRechargement} ligne(s)). C'est sa remarque du 22 septembre 2026.`
    );
  }
  assert.equal(await compteEnCours(page), avant + 1, "Le compteur « En cours » doit suivre la ligne");

  // ── 2. Le devis sans client : « Renseigner la fiche client », puis retour ─
  await ouvrirLaFeuille(page);
  await feuille.getByRole("button", { name: /Je rédige à la main/ }).click();
  await page.waitForURL(/\/devis-complet/, { timeout: 30_000 });
  const chantierId = page.url().match(/chantiers\/([^/]+)/)?.[1];
  assert.ok(chantierId, "Le devis ne dit pas de quel chantier il est");

  await page.getByRole("link", { name: "Renseigner la fiche client" }).click();
  await page.waitForURL(/\/coordonnees/, { timeout: 30_000 });
  const nomDevis = `Devis ${Date.now().toString().slice(-6)}`;
  await page.fill('input[placeholder="Bernard"]', nomDevis);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.getByRole("link", { name: "Retour à la liste des chantiers" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  if (!(await voitLaLigne(page, nomDevis))) {
    await page.reload({ waitUntil: "networkidle" });
    const apresRechargement = await page.locator(`text=${nomDevis}`).count();
    assert.fail(
      `La fiche client remplie depuis le devis a perdu « ${nomDevis} » au retour ` +
        `(au rechargement, ${apresRechargement} ligne(s)). C'est sa remarque du 22 septembre 2026.`
    );
  }
  // La ligne est bien CE chantier, et pas un second créé à côté.
  assert.ok(
    (await page.locator(`a[href*="${chantierId}"]`).filter({ hasText: nomDevis }).count()) > 0,
    `« ${nomDevis} » est à l'accueil, mais pas sur le chantier du devis`
  );

  await contexte.close();
  await navigateur.close();
  console.log("✅ La fiche client remplie reste quand il fait retour, et une feuille vide ne crée rien.");
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
