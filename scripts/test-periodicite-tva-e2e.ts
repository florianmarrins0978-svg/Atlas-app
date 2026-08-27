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
  // La périodicité a rejoint le régime de TVA dans « Mon entreprise » le
  // 14 août 2026 : deux réglages fiscaux à deux endroits (ARCHITECTURE.md §96).
  await page.goto(`${BASE}/reglages/identite`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Votre TVA", { timeout: 30_000 });
  await page.getByRole("button", { name: libelle, exact: true }).click();

  // **On RECHARGE pour vérifier, au lieu de croire le bouton.** L'écran coche
  // la case avant que le serveur réponde — c'est voulu, le doigt doit voir tout
  // de suite. Mais attendre `aria-pressed` revient alors à attendre l'optimisme
  // de l'écran, pas l'enregistrement : le 13 août 2026, ce contrôle est passé à
  // l'écran suivant avant que la base ait bougé, et a lu « 3e trimestre » après
  // avoir demandé le mois.
  //
  // Après rechargement, la case cochée vient du SERVEUR. On laisse trois
  // chances, en donnant à l'action le temps qu'il lui faut sous la charge des
  // cinquante suites.
  let enregistre = false;
  for (const essai of [1, 2, 3]) {
    await page.waitForTimeout(essai * 400);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Votre TVA", { timeout: 30_000 });
    const coche = await page
      .getByRole("button", { name: libelle, exact: true })
      .getAttribute("aria-pressed");
    if (coche === "true") {
      enregistre = true;
      break;
    }
  }
  if (!enregistre) throw new Error(`« ${libelle} » n'a pas été enregistré : la case n'est pas cochée après rechargement.`);
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

  // ─── SON GESTE À LUI, ET LA RAISON POUR LAQUELLE RIEN NE LE VOYAIT ───────
  //
  // **Sa plainte du 26 août 2026 :** *« quand je change entre tous les mois et
  // tous les trois mois, c'est pareil, rien ne se passe »*.
  //
  // Tout ce qui précède passe par **Réglages**, puis rouvre `/termines/tva` par
  // une navigation neuve — et c'est exactement ce qui rendait le défaut
  // invisible : une page rouverte est toujours juste. Lui bascule **depuis
  // l'écran de TVA**, sans le quitter, et c'est là que rien ne bougeait.
  //
  // Ce cas ne recharge donc RIEN. Il touche les deux mots soulignés du haut et
  // regarde le titre.
  await test("SON GESTE : basculer depuis l'écran de TVA change le titre, sans recharger", async () => {
    await choisir(page, "Tous les mois");
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });
    const avant = (await page.locator("h1").first().textContent())?.trim() ?? "";
    assert.ok(!/trimestre/i.test(avant), `l'écran ne part pas d'un mois : « ${avant} »`);

    await page.getByRole("button", { name: "Tous les trois mois", exact: true }).click();

    // **On attend le TITRE, pas un délai.** Un `waitForTimeout` mesurerait la
    // vitesse de la machine ; ce qu'on veut savoir est si l'écran finit par
    // dire le trimestre.
    try {
      await page.waitForFunction(
        () => /trimestre/i.test(document.querySelector("h1")?.textContent ?? ""),
        null,
        { timeout: 15_000 }
      );
    } catch {
      const apres = (await page.locator("h1").first().textContent())?.trim() ?? "";
      throw new Error(
        `l'écran dit toujours « ${apres} » après être passé au trimestre : ` +
          "c'est très exactement ce qu'il signale — rien ne se passe."
      );
    }

    // Et le retour au mois doit marcher pareil : une correction qui ne
    // fonctionnerait que dans un sens laisserait la moitié du défaut.
    await page.getByRole("button", { name: "Tous les mois", exact: true }).click();
    await page.waitForFunction(
      () => !/trimestre/i.test(document.querySelector("h1")?.textContent ?? ""),
      null,
      { timeout: 15_000 }
    );
  });

  // **Ce que l'application refuse de faire, et qui doit le rester.** Le seuil
  // des 4 000 € porte sur la TVA due ; Atlas ne connaît que la collectée. Un
  // écran qui conseillerait « passez au trimestre » inventerait une donnée
  // (`CLAUDE.md` §4).
  await test("L'écran ne conseille JAMAIS une périodicité", async () => {
    // La périodicité a rejoint le régime de TVA dans « Mon entreprise » le
  // 14 août 2026 : deux réglages fiscaux à deux endroits (ARCHITECTURE.md §96).
  await page.goto(`${BASE}/reglages/identite`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Votre TVA", { timeout: 30_000 });
    const texte = (await page.locator("section:has-text('Votre TVA')").last().textContent()) ?? "";
    // **CE CONTRÔLE A ÉTÉ RE-VISÉ le 24 août 2026, pas assoupli.**
    //
    // Il exigeait deux phrases — « votre comptable dit lequel vous concerne » et
    // « mensuelle par défaut » — que le patron a fait retirer le même jour :
    // *« le trimestre est une option (toute la phrase) »*. Un contrôle qui
    // réclame ce qu'il a fait enlever rend son écran impossible à changer
    // (`CLAUDE.md` §5 bis).
    //
    // Ce qu'il défendait vraiment survit, et c'est la seule chose qui compte :
    // **l'écran ne conseille JAMAIS une périodicité**. Le seuil des 4 000 €
    // porte sur la TVA due ; Atlas ne connaît que la collectée. Conseiller
    // reviendrait à inventer une donnée (`CLAUDE.md` §4) — et c'est cela qu'on
    // mesure désormais, sur le texte, pas sur un libellé qu'il peut vouloir
    // réécrire demain.
    assert.ok(texte.trim().length > 0, "la rubrique « Votre TVA » est vide : rien n'est mesuré");
    // **Le mois reste annoncé comme le DÉFAUT** — sa phrase courte du 24 août.
    // Sans cela, les deux boutons se lisent comme un choix libre, et le mauvais
    // coûte un rappel de l'administration. Le motif est volontairement large :
    // ce qu'on défend est le FAIT, pas la formule, qu'il peut réécrire demain.
    assert.ok(
      /(mois[^.]{0,40}défaut|défaut[^.]{0,40}mois)/i.test(texte),
      `l'écran ne dit plus que le mois est le défaut : ${texte.slice(0, 160)}`
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
