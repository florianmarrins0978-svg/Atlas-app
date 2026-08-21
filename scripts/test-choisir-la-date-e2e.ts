import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

/**
 * Le raccourci vers les dates : trois écrans devenus deux.
 *
 * *Le patron, le 20 août 2026, trois captures à l'appui :* **« Le bouton
 * envoyer au client, tu vas me le modifier par "Choisir la date" […] sous forme
 * de bouton vert comme tous les autres […] j'arrive directement sur la page où
 * je peux choisir la date […] on supprime la page qui est entre les deux. On va
 * raccourcir les étapes. […] Et je ne veux pas de flèche. »*
 *
 * Retenu sur planche (`docs/maquettes/82-choisir-la-date.html`, proposition A).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VOIT.**
 *
 * Les suites d'envoi éprouvent ce que fait la feuille une fois ouverte
 * (`test-envoi-client-e2e.ts`). Elles resteraient toutes vertes si l'écran du
 * milieu revenait s'intercaler : elles y passeraient, cliqueraient, et rien ne
 * rougirait — le parcours serait simplement redevenu long, sans que personne ne
 * le remarque avant lui.
 *
 * Ce contrôle garde donc **le raccourci lui-même** : le nombre d'écrans, la
 * forme du bouton, son ordre, et le fait que l'ancienne adresse ne s'ouvre plus
 * avant l'envoi.
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
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  // **Son propre chantier, et non le premier venu.** Le premier jet prenait
  // `… WHERE devis_envoye_at IS NULL LIMIT 1` — sans ordre, et dans une base que
  // quatre-vingts suites remplissent au fur et à mesure. Jouée seule elle
  // gagnait ; jouée dans la batterie, elle tombait sur le chantier d'une autre
  // suite dont le devis venait de partir, `/export` ne renvoyait donc plus, et
  // le rouge accusait le raccourci — qui n'y était pour rien.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.getByLabel(/Nom du client/i).fill(`Choisir la date ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 40_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Abattage d'un chêne");
  await page.getByLabel("Prix unitaire 1").fill("1200");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Aperçu du PDF", { timeout: 60_000 });

  await test("Le devis porte « Choisir la date », en bouton plein et SANS flèche", async () => {
    const bouton = page.getByRole("button", { name: "Choisir la date" });
    assert.equal(await bouton.count(), 1, "le bouton manque, ou il y en a plusieurs");
    const dit = (await bouton.innerText()).trim();
    assert.ok(!/[→>]/.test(dit), `il porte encore une flèche : « ${dit} »`);

    // Plein, pas creux : c'est le geste principal de l'écran. `PrimaryButton`
    // pose l'encre de la charte en fond — un bouton transparent dirait
    // « secondaire », et c'est l'inverse.
    const fond = await bouton.evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.ok(
      fond !== "rgba(0, 0, 0, 0)" && fond !== "transparent",
      `le bouton n'est pas plein (fond « ${fond} »)`
    );
  });

  await test("Il est AU-DESSUS de l'aperçu du PDF — son ordre, pas le nôtre", async () => {
    const places = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Choisir la date");
      const a = [...document.querySelectorAll("a")].find((x) => x.innerText.trim() === "Aperçu du PDF");
      if (!b || !a) return null;
      return { bouton: b.getBoundingClientRect().top, apercu: a.getBoundingClientRect().top };
    });
    assert.ok(places, "l'un des deux gestes manque de l'écran");
    assert.ok(
      places.bouton < places.apercu,
      `l'aperçu passe avant le bouton (${Math.round(places.apercu)} < ${Math.round(places.bouton)})`
    );
  });

  await test("Un seul appui ouvre le calendrier — plus d'écran entre les deux", async () => {
    // **Le cœur du lot.** Avant, il fallait passer par un récapitulatif qui
    // redisait le devis qu'on venait de fermer. L'adresse ne doit pas changer :
    // la feuille s'ouvre PAR-DESSUS le devis.
    const avant = page.url();
    await page.getByRole("button", { name: "Choisir la date" }).click();
    await page.waitForSelector("text=Envoyer le devis", { timeout: 30_000 });
    assert.equal(page.url(), avant, "l'appui a changé d'écran : un intermédiaire s'est réintercalé");

    const corps = await page.locator("body").innerText();
    assert.ok(
      /Envoyer le devis/.test(corps),
      "la feuille ouverte n'est pas celle de l'envoi"
    );
  });

  await test("La feuille se referme, et son « Annuler » ne se confond plus avec l'autre", async () => {
    // Le devis porte déjà un « Annuler » — celui qui reprend le retrait d'une
    // ligne. Depuis que la feuille vit ici, les deux cohabitent : sans nom
    // distinct, un lecteur d'écran annonce deux fois la même chose.
    await page.getByRole("button", { name: "Annuler l’envoi" }).click();
    await page.waitForSelector("text=Envoyer le devis", { state: "hidden", timeout: 15_000 });
  });

  await test("L'ancienne adresse ne s'ouvre plus avant l'envoi : elle renvoie au devis", async () => {
    // **On ATTEND l'arrivée, on ne compte pas 600 ms.** Le renvoi est posé côté
    // serveur, mais l'écran d'arrivée se compile à la demande : sous la
    // batterie, six cents millisecondes ne suffisaient pas et l'adresse lue
    // était encore l'ancienne. Le contrôle accusait alors le renvoi — qui
    // fonctionnait parfaitement. Deuxième fois que cette même faute se paie
    // dans ce lot ; c'est la dernière.
    await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "domcontentloaded" });
    await page
      .waitForURL(new RegExp(`/chantiers/${chantierId}/devis-complet$`), { timeout: 30_000 })
      .catch(() => undefined);
    assert.match(
      page.url(),
      new RegExp(`/chantiers/${chantierId}/devis-complet$`),
      `on reste sur « ${page.url().replace(BASE, "")} » : l'écran du milieu existe encore`
    );
  });

  await test("Rien ne déborde de son écran — c'est le dernier qu'il voit avant d'envoyer", async () => {
    // **Repris de `test-synthese-devis-e2e.ts`, supprimée avec l'écran qu'elle
    // mesurait.** Cette garde-là, elle, a changé de sujet plutôt que de
    // disparaître : le devis est désormais le dernier écran avant l'envoi, et
    // c'est sur lui qu'un débordement en largeur se paierait.
    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(debord <= 1, `la page déborde de ${debord} px en largeur`);
  });

  await test("Et cet écran-là ne propose plus d'envoyer : le geste vit sur le devis", async () => {
    const corps = await page.locator("body").innerText();
    assert.ok(
      !/Envoyer au client/.test(corps),
      "l'ancien bouton d'envoi est encore offert quelque part : deux portes vers la même pièce"
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
