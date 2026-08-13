import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * Le rythme de la TVA — au mois ou au trimestre — et le calendrier qui suit.
 *
 * *Le patron, le 12 août 2026 : « la TVA collectée, ça doit être mois par mois
 * et pas trimestre par trimestre […] et si jamais c'est à nous de choisir, il
 * faut que l'utilisateur ait le choix. »*
 *
 * **Ce que cette suite garde, et qu'aucun test unitaire ne peut voir :** que le
 * réglage traverse VRAIMENT jusqu'à l'écran. Les bornes des périodes sont
 * éprouvées à part (`test-periode-tva.ts`), et elles resteraient vertes même si
 * l'écran ignorait le réglage et découpait tout en trimestres — le patron
 * verrait alors « 3e trimestre » après avoir coché « tous les mois », sans que
 * rien ne rougisse.
 *
 * **Elle vérifie aussi ce que l'application refuse de faire :** conseiller une
 * périodicité. Le seuil qui ouvre le trimestre porte sur la TVA *due* — que
 * Atlas ne connaît pas. L'écran doit renvoyer au comptable, et le dire.
 */

const BASE = "http://localhost:3000";

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

async function choisir(page: Page, libelle: "Tous les mois" | "Tous les trimestres") {
  await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Votre TVA", { timeout: 30_000 });
  await page.getByRole("button", { name: libelle, exact: true }).click();
  // Le réglage part en action serveur : on attend qu'il soit ENREGISTRÉ, pas
  // que le bouton ait changé de couleur — l'affichage est optimiste.
  await page.waitForFunction(
    (l) => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === l);
      return b?.getAttribute("aria-pressed") === "true";
    },
    libelle,
    { timeout: 10_000 }
  );
}

async function titreTva(page: Page): Promise<string> {
  await page.goto(`${BASE}/termines/tva`, { waitUntil: "domcontentloaded" });
  // **« Reste à payer », et non le surtitre.** Celui-ci est passé de « TVA
  // collectée » à « Ma TVA » le 13 août 2026, l'écran portant désormais trois
  // chiffres et non plus un seul — ce contrôle a attendu trente secondes un
  // texte disparu. Un repère d'attente doit viser ce que l'écran EST, pas
  // comment il s'appelait.
  await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });
  return (await page.locator("h1").first().textContent())?.trim() ?? "";
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  // **Le mois est le défaut légal.** Une entreprise créée avant la migration
  // 0035 doit l'hériter, sans quoi le patron déclarerait au mois en lisant un
  // écran découpé en trimestres.
  await test("Par défaut, la TVA se lit au mois", async () => {
    const { rows } = await pool.query(`SELECT periodicite_tva FROM entreprises LIMIT 1`);
    assert.equal(rows[0]?.periodicite_tva, "mensuelle", "le défaut en base n'est pas le mois");
    const titre = await titreTva(page);
    assert.ok(/^[A-ZÉÛ]/.test(titre) && !/trimestre/i.test(titre), `le titre annonce « ${titre} »`);
  });

  await test("Le réglage passe l'écran au trimestre, et le titre le dit", async () => {
    await choisir(page, "Tous les trimestres");
    const titre = await titreTva(page);
    assert.ok(/trimestre \d{4}$/.test(titre), `le titre devait annoncer un trimestre, il dit « ${titre} »`);
  });

  await test("Le calendrier montre quatre trimestres, pas douze mois", async () => {
    await page.getByRole("button", { name: "Choisir une période" }).click();
    await page.waitForSelector("text=Revenir à la période en cours", { timeout: 10_000 });
    // Le nom accessible d'un pavé de trimestre porte AUSSI ses mois
    // (« 1er trimestre janv. – mars ») : c'est précisément ce qu'on a voulu y
    // mettre, « 3e trimestre » ne disant pas à qui cherche une facture d'août
    // que c'est là qu'il faut regarder. Le contrôle ne doit donc pas ancrer la
    // fin de la chaîne.
    assert.equal(await page.getByRole("button", { name: /^\d(er|e) trimestre/ }).count(), 4);
    assert.equal(await page.getByRole("button", { name: "Janvier", exact: true }).count(), 0);
  });

  await test("Le calendrier emmène vraiment où l'on touche, sans passer par les flèches", async () => {
    await page.getByRole("button", { name: "Année précédente" }).click();
    await page.getByRole("button", { name: /^1er trimestre/ }).click();
    await page.waitForFunction(() => /1er trimestre/.test(document.querySelector("h1")?.textContent ?? ""), null, {
      timeout: 10_000,
    });
    const titre = (await page.locator("h1").first().textContent())?.trim() ?? "";
    const anneeAttendue = new Date().getUTCFullYear() - 1;
    assert.equal(titre, `1er trimestre ${anneeAttendue}`, `arrivé sur « ${titre} »`);
  });

  await test("Le réglage ramène l'écran au mois, et le calendrier avec", async () => {
    await choisir(page, "Tous les mois");
    const titre = await titreTva(page);
    assert.ok(!/trimestre/i.test(titre), `le titre dit encore « ${titre} »`);
    await page.getByRole("button", { name: "Choisir une période" }).click();
    await page.waitForSelector("text=Revenir à la période en cours", { timeout: 10_000 });
    assert.equal(await page.getByRole("button", { name: "Décembre", exact: true }).count(), 1);
    assert.equal(await page.getByRole("button", { name: /trimestre/ }).count(), 0);
  });

  // **Une adresse bricolée ne doit pas produire un écran vide et
  // inexplicable.** « 12 » est un mois valide et un trimestre absurde : au
  // trimestre, l'écran doit retomber sur la période courante plutôt que
  // d'inventer un douzième trimestre.
  await test("Une période impossible ramène à la période en cours, sans écran mort", async () => {
    await choisir(page, "Tous les trimestres");
    await page.goto(`${BASE}/termines/tva?annee=2026&t=12`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });
    const titre = (await page.locator("h1").first().textContent())?.trim() ?? "";
    assert.ok(/^[1-4](er|e) trimestre \d{4}$/.test(titre), `titre inattendu : « ${titre} »`);
    await choisir(page, "Tous les mois");
  });

  // **Ce que l'application refuse de faire, et qui doit le rester.** Le seuil
  // des 4 000 € porte sur la TVA due ; Atlas ne connaît que la collectée. Un
  // écran qui conseillerait « passez au trimestre » inventerait une donnée
  // (`CLAUDE.md` §4).
  await test("L'écran renvoie au comptable, et ne conseille jamais de périodicité", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Votre TVA", { timeout: 30_000 });
    const texte = (await page.locator("section:has-text('Votre TVA')").last().textContent()) ?? "";
    assert.ok(/comptable/i.test(texte), "l'écran doit renvoyer au comptable");
    assert.ok(
      /mensuelle par défaut/i.test(texte),
      "l'écran doit dire que le mois est le défaut, sinon le trimestre paraît équivalent"
    );
    assert.ok(
      !/vous pouvez passer|nous vous conseillons|éligible|vous avez droit/i.test(texte),
      `l'écran conseille une périodicité qu'il ne peut pas connaître : ${texte.slice(0, 160)}`
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
