import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

// Ce que devient un devis parti, vu du patron (docs/AGENT.md §2.2).
//
// Le cycle complet est déjà couvert ailleurs. Ce qui se joue ici est différent
// et n'était couvert nulle part : une fois le devis parti, l'application
// dit-elle au patron où il en est — et lui laisse-t-elle un chemin ?

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

/** Requête d'inspection hors application — voir test-facture-e2e.ts. */
async function inspecter(sql: string, params: unknown[], attendu?: number) {
  const r = await pool.query(sql, params);
  if (attendu !== undefined && r.rowCount !== attendu) {
    throw new Error(
      `Inspection hors application : ${r.rowCount} ligne(s) au lieu de ${attendu}. ` +
        "Le rôle de test ne traverse probablement plus RLS."
    );
  }
  return r;
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

/** Un chantier dont le devis vient de partir chez le client. */
async function devisParti(page: Page, suffixe: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const nom = `Suivi e2e ${suffixe} ${Date.now()}`;
  await page.fill('input[placeholder="Rénovation salle de bain"]', nom);
  await page.fill('input[placeholder="M. Bernard"]', "M. Bernard");
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("900.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

  const lien = await page.locator("text=/\\/devis\\/[A-Za-z0-9_-]+/").first().innerText();
  const jeton = lien.slice(lien.indexOf("/devis/") + "/devis/".length).trim();

  return { chantierId, nom, url, jeton };
}

/** Le client refuse, depuis sa page publique — sans session, comme en vrai. */
async function clientRefuse(browser: Awaited<ReturnType<typeof lancerNavigateur>>, jeton: string) {
  const contexte = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const p = await contexte.newPage();
  await p.goto(`${BASE}/devis/${jeton}`, { waitUntil: "networkidle" });
  await p.click('button:has-text("Je ne donne pas suite")');
  await p.waitForSelector("text=Votre réponse a bien été transmise", { timeout: 15000 });
  await contexte.close();
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await seConnecter(context);

  await test("un devis parti met le chantier en attente, pas en « à planifier »", async () => {
    const { nom } = await devisParti(page, "attente");

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const carte = page.locator(`text=${nom}`).locator("xpath=ancestor::a[1]");
    assert.ok(
      (await carte.locator("text=En attente de réponse").count()) > 0,
      "la liste ne dit pas que le chantier attend le client"
    );

    // Planifier soi-même une date que le client s'apprête à choisir préparerait
    // deux engagements sur le même jour.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const sectionAPlanifier = page.locator("text=À planifier").locator("xpath=..");
    assert.strictEqual(
      await sectionAPlanifier.locator(`text=${nom}`).count(),
      0,
      "le chantier est proposé à la planification alors que le client choisit"
    );
    assert.ok(
      await page.locator("text=En attente du client").isVisible(),
      "le chantier disparaît du planning au lieu d'y être annoncé en attente"
    );
  });

  await test("un refus est annoncé au patron sur son écran d'accueil", async () => {
    const { nom, jeton } = await devisParti(page, "refus");
    await clientRefuse(browser, jeton);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Devis retourné").first().isVisible(),
      "le refus n'est annoncé nulle part"
    );
    assert.ok(
      (await page.locator(`text=${nom}`).count()) > 0,
      "la notification ne dit pas de quel chantier il s'agit"
    );
  });

  await test("« J'ai vu » retire la notification, et pour de bon", async () => {
    const { jeton } = await devisParti(page, "vu");
    await clientRefuse(browser, jeton);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // Compté avant/après : les suites précédentes laissent leurs propres refus
    // non lus, et exiger zéro reviendrait à tester l'ordre d'exécution.
    const avant = await page.locator("text=Devis retourné").count();
    assert.ok(avant > 0, "aucune notification à marquer comme vue");

    await page.locator("text=J'ai vu").first().click();
    await page.waitForTimeout(1500);

    await page.reload({ waitUntil: "networkidle" });
    assert.strictEqual(
      await page.locator("text=Devis retourné").count(),
      avant - 1,
      "la notification revient après rechargement"
    );
  });

  await test("un devis retourné peut être repris et renvoyé", async () => {
    const { chantierId, url, jeton } = await devisParti(page, "reprise");
    await clientRefuse(browser, jeton);

    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Le client n'a pas donné suite").isVisible(),
      "l'écran devis ne dit pas que le client a refusé"
    );

    await page.click("text=Reprendre le devis");
    await page.waitForSelector("text=Envoyer au client", { timeout: 15000 });

    // Une nouvelle version, pas une modification de celle qui est partie : le
    // devis refusé reste la trace de ce qui avait été proposé.
    const { rows } = await inspecter(
      "SELECT numero_version, statut FROM devis WHERE chantier_id = $1 ORDER BY numero_version",
      [chantierId]
    );
    assert.strictEqual(rows.length, 2, "la reprise n'a pas ouvert de nouvelle version");
    assert.strictEqual(rows[0].statut, "envoye", "la version refusée a été modifiée");
    assert.strictEqual(rows[1].statut, "brouillon");

    // Et elle repart réellement : c'est tout l'objet de la reprise.
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    try {
      await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });
    } catch (e) {
      // Ce contrôle a échoué une fois dans la batterie complète, jamais seul :
      // l'attente expirait sans qu'on sache pourquoi. Un délai dépassé ne
      // désigne aucun coupable — l'écran, lui, porte le message de refus.
      // Sans cette capture, la prochaine occurrence coûterait la même enquête.
      console.error(
        "L'envoi n'a pas abouti. Ce que la feuille affichait :\n" +
          (await page.locator("body").innerText()).slice(0, 1500)
      );
      throw e;
    }

    const envois = await inspecter("SELECT count(*)::int AS n FROM envois_devis WHERE chantier_id = $1", [
      chantierId,
    ]);
    assert.strictEqual(envois.rows[0].n, 2, "le second envoi n'a pas été enregistré");
  });

  await test("un devis en attente affiche son lien, pour relancer sans le regénérer", async () => {
    const { url } = await devisParti(page, "relance");

    await page.reload({ waitUntil: "networkidle" });
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });

    // Sélecteurs restreints au paragraphe : en mode développement, une erreur
    // afficherait le code source de l'écran, où ces phrases figurent aussi.
    assert.strictEqual(
      await page.locator('p:text-is("En attente de réponse")').count(),
      1,
      "l'écran ne rappelle pas que le client n'a pas répondu"
    );
    assert.strictEqual(
      await page
        .locator('p:has-text("Le lien est toujours actif — renvoyez-le tel quel pour relancer.")')
        .count(),
      1,
      "le lien n'est pas proposé : relancer obligerait à renvoyer un nouveau devis"
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
