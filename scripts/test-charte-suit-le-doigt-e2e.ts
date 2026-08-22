import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { charte, type NomCharte } from "../src/lib/chartes";

/**
 * La couleur choisie suit le DOIGT — pas le rechargement.
 *
 * *Le patron, le 16 août 2026, capture de l'écran Apparence à l'appui, la
 * pastille « Nuit » cochée : **« l'apparence ne change pas »**.*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **POURQUOI CETTE SUITE EXISTE À CÔTÉ DE `test-chartes-e2e.ts`, QUI ÉTAIT
 * VERTE.** Celle-là éprouve la couleur avec un `page.goto()` entre chaque
 * vérification — c'est-à-dire un **rechargement complet** à chaque écran. Le
 * gabarit racine est alors rejoué, et la charte arrive.
 *
 * Le patron, lui, ne recharge jamais : il touche **les onglets du bas**. Une
 * navigation côté client ne rejoue pas le gabarit racine — elle ne remplace que
 * le contenu — donc l'attribut `style` de `<html>`, où vivent les couleurs,
 * restait celui du document initial. Le choix partait bien en base, et l'écran
 * ne bougeait pas.
 *
 * **Le contrôle était donc vert sur un chemin qu'il ne prend pas.** C'est la
 * même leçon que le 12 août (`AGENTS.md`) : reproduire SA séquence, pas le
 * geste isolé.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les quatre mesures, dans son ordre à lui :
 *
 *   1. l'appui repeint l'écran **tout de suite**, sans rechargement ;
 *   2. la couleur tient après un onglet du bas — **le geste qu'il fait** ;
 *   3. elle tient après un second onglet ;
 *   4. elle survit à un rechargement complet, donc elle est bien **enregistrée**
 *      et pas seulement peinte au navigateur.
 *
 * Elle sait échouer : retirer `repeindre()` de `ApparenceClient` fait tomber la
 * première mesure en donnant les deux couleurs, l'attendue et la trouvée.
 *
 * **Elle rend la charte d'ORIGINE en partant, même en cas d'échec.** Le compte
 * de démonstration sert aux quatre-vingts suites de la batterie : le laisser en
 * « Nuit » repeindrait les écrans de toutes les suivantes, et leurs contrôles de
 * couleur accuseraient leur propre écran.
 */

const BASE = "http://localhost:3000";
const NUIT: NomCharte = "nuit";
const ORIGINE: NomCharte = "origine";

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
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  /** Le fond que `<html>` porte RÉELLEMENT, calculé — jamais un nom de classe. */
  const fond = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--atlas-cream").trim()
    );

  const fondNuit = charte(NUIT).jetons.cream;
  const fondOrigine = charte(ORIGINE).jetons.cream;
  // **Deux chartes qui se ressembleraient ne mesureraient rien.** Le contrôle
  // le dit plutôt que de rendre un vert vide — c'est la règle du 15 août : une
  // comparaison sans écart possible n'est pas une mesure.
  assert.notEqual(fondNuit, fondOrigine, "Nuit et Origine ont le même fond : rien ne peut être mesuré");

  const remettreOrigine = async () => {
    await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
    await page.locator(`button[data-charte="${ORIGINE}"]`).click();
    await page.waitForTimeout(900);
  };

  try {
    // On part d'Origine pour que la suite soit rejouable sur la même base.
    await remettreOrigine();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await fond(), fondOrigine, "le montage n'a pas pris : l'écran n'est pas en Origine");

    await test("L'appui repeint l'écran TOUT DE SUITE, sans rechargement", async () => {
      await page.locator(`button[data-charte="${NUIT}"]`).click();
      await page.waitForTimeout(600);
      assert.equal(
        await fond(),
        fondNuit,
        `l'écran est resté en ${await fond()} au lieu de passer en ${fondNuit} — ` +
          "c'est exactement « l'apparence ne change pas »"
      );
    });

    await test("Elle tient après l'onglet Chantiers — SON geste, pas un rechargement", async () => {
      await page.getByRole("link", { name: /Chantiers/i }).first().click();
      await page.waitForTimeout(800);
      assert.equal(await fond(), fondNuit, `l'onglet Chantiers a rendu l'écran à ${await fond()}`);
    });

    await test("Elle tient après un second onglet", async () => {
      await page.getByRole("link", { name: /Planning/i }).first().click();
      await page.waitForTimeout(800);
      assert.equal(await fond(), fondNuit, `l'onglet Planning a rendu l'écran à ${await fond()}`);
    });

    await test("Elle survit à un rechargement : le choix est bien ENREGISTRÉ", async () => {
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await fond(),
        fondNuit,
        "après rechargement l'écran revient en Origine : la couleur n'était que peinte au navigateur"
      );
    });
  } finally {
    // Hors du `try` des mesures : un échec ne doit pas laisser le compte de
    // démonstration en Nuit pour les quatre-vingts suites suivantes.
    await remettreOrigine();
  }

  console.log(`\n${failed === 0 ? "✅" : "❌"} La couleur suit le doigt — ${passed} réussi(s), ${failed} échec(s).`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
