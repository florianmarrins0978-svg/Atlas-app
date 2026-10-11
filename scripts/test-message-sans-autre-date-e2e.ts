import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// **CASE DÉCOCHÉE, LE CLIENT NE LIT NULLE PART QU'IL PEUT PROPOSER UNE DATE.**
//
// Sa demande du 29 septembre 2026 : *« vérifie vraiment que si je décoche la
// possibilité de laisser le client me proposer une date, le message qu'il voit
// ne contient pas la mention : si aucune des dates proposées… »*.
//
// Deux endroits où il la lit, joués par SES gestes : le message tout prêt que
// l'envoi ouvre (SMS), et la page du devis qu'il ouvre par le lien. Le cas
// coché sert de témoin : un contrôle qui ne verrait jamais la phrase ne
// prouverait rien de son absence.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PHRASE = /si aucune des dates propos[ée]es ne vous convient/i;

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

/** Un devis envoyé par son chemin, la case réglée comme il le veut. Rend le SMS préparé et le jeton. */
async function envoyer(
  page: Page,
  autreDate: boolean,
): Promise<{ sms: string; jeton: string }> {
  const nom = `Sans autre date ${Date.now().toString().slice(-6)}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByLabel("Description 1").fill("Taille d'une haie de charmille");
  await page.getByLabel("Prix unitaire 1").fill("420");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, {
    waitUntil: "networkidle",
  });
  await page.click("text=Choisir la date");
  const interrupteur = page.getByRole("switch", {
    name: "Votre client peut proposer une autre date",
  });
  await interrupteur.waitFor({ state: "visible", timeout: 30_000 });
  if ((await interrupteur.getAttribute("aria-checked")) !== String(autreDate))
    await interrupteur.click();
  assert.equal(
    await interrupteur.getAttribute("aria-checked"),
    String(autreDate),
    "la case n'a pas pris l'état voulu",
  );
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();

  const porte = page.locator("a[data-transmission-directe]");
  await porte.waitFor({ state: "attached", timeout: 30_000 });
  const sms = decodeURIComponent((await porte.getAttribute("href")) ?? "");

  let jeton: string | undefined;
  for (let i = 0; i < 60 && !jeton; i++) {
    const { rows } = await pool.query(
      `SELECT e.jeton, e.autre_date_autorisee FROM envois_devis e WHERE e.chantier_id = $1`,
      [chantierId],
    );
    jeton = rows[0]?.jeton as string | undefined;
    if (jeton)
      assert.equal(
        rows[0].autre_date_autorisee,
        autreDate,
        "l'envoi n'a pas gardé le choix de la case",
      );
    else await page.waitForTimeout(500);
  }
  assert.ok(jeton, "aucun envoi après trente secondes");
  return { sms, jeton };
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 900 },
  });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const client = await navigateur.newContext({
    viewport: { width: 390, height: 900 },
  });
  const pageClient = await client.newPage();

  // **Le message d'Atlas, quoi qu'une suite précédente ait laissé.** Une autre
  // suite enregistre SON message et ne le retire pas : le témoin lisait alors un
  // texte sans la phrase, et accusait le produit. Remis tel quel à la fin.
  const { rows: avant } = await pool.query(
    `SELECT e.id, e.message_client FROM entreprises e JOIN membres_entreprise m ON m.entreprise_id = e.id
       JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`,
  );
  assert.ok(avant[0], "entreprise de démonstration introuvable");
  await pool.query(
    `UPDATE entreprises SET message_client = NULL WHERE id = $1`,
    [avant[0].id],
  );
  try {
    const coche = await envoyer(page, true);
    await cas("témoin, case cochée : le SMS porte la phrase", async () => {
      assert.match(
        coche.sms,
        PHRASE,
        "le témoin ne voit pas la phrase : ce contrôle ne prouverait rien",
      );
    });
    await cas(
      "témoin, case cochée : la page du client propose une autre date",
      async () => {
        await pageClient.goto(`${BASE}/devis/${coche.jeton}`, {
          waitUntil: "networkidle",
        });
        await pageClient
          .getByRole("button", { name: /J'accepte ce devis/i })
          .waitFor({ state: "visible", timeout: 30_000 });
        assert.equal(
          await pageClient
            .locator('input[name="choixDate"][value="autre"]')
            .count(),
          1,
        );
      },
    );

    const decoche = await envoyer(page, false);
    await cas(
      "case décochée : le SMS ne dit pas qu'il peut proposer une date",
      async () => {
        assert.doesNotMatch(
          decoche.sms,
          PHRASE,
          `le client lira : « ${decoche.sms.match(/Et si aucune[^.]*\./)?.[0]} »`,
        );
        assert.ok(
          decoche.sms.includes(`/devis/${decoche.jeton}`),
          "le SMS ne porte plus le lien",
        );
      },
    );
    // Sa décision du même jour, planche `appli/lien-valable-45-jours.html`, A :
    // sous le lien, jusqu'à quand il répond, et qu'ensuite il faudra appeler.
    await cas(
      "le SMS dit jusqu'à quand le lien répond, et qu'après il faudra appeler",
      async () => {
        assert.match(
          decoche.sms,
          /Ce lien est valable 45 jours, jusqu'au \S+ \d+ \S+( \d{4})?\. Passé ce délai, vous ne pourrez plus répondre depuis ce lien : il faudra appeler /,
          decoche.sms,
        );
      },
    );
    await cas(
      "case décochée : la page du client ne propose aucune autre date",
      async () => {
        await pageClient.goto(`${BASE}/devis/${decoche.jeton}`, {
          waitUntil: "networkidle",
        });
        await pageClient
          .getByRole("button", { name: /J'accepte ce devis/i })
          .waitFor({ state: "visible", timeout: 30_000 });
        assert.equal(
          await pageClient
            .locator('input[name="choixDate"][value="autre"]')
            .count(),
          0,
        );
        assert.doesNotMatch(
          await pageClient.locator("body").innerText(),
          PHRASE,
        );
      },
    );
  } finally {
    await pool.query(
      `UPDATE entreprises SET message_client = $2 WHERE id = $1`,
      [avant[0].id, avant[0].message_client],
    );
  }

  await pool.end();
  await navigateur.close();
  if (echecs > 0) {
    console.error(`❌ ${echecs} cas en échec`);
    process.exit(1);
  }
  console.log(
    "✅ Case décochée, le client ne lit nulle part qu'il peut proposer une date.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
