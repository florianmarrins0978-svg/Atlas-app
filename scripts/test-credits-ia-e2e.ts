// LA BARRE DES CRÉDITS IA, DANS UN VRAI NAVIGATEUR (sa planche du 26 octobre
// 2026, `appli/soignee/abonnement-credits-ia.html`, l'épuisé en rouge).
//
// Elle pose une dépense en base et regarde ce que l'écran Abonnement affiche :
// le pourcentage, l'état, la phrase. Elle ne recalcule rien : l'état vient de
// la règle (`src/lib/credits-ia.ts`), et c'est elle que l'écran doit suivre.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
  console.log("=== La barre des crédits IA, sur Abonnement ===\n");
  const { rows } = await pool.query(
    `SELECT me.entreprise_id AS e FROM membres_entreprise me JOIN users u ON u.id = me.utilisateur_id
      WHERE u.email = 'demo@atlas.local' AND me.role = 'proprietaire' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const entreprise = rows[0].e as string;
  const { rows: abo } = await pool.query(`SELECT 1 FROM abonnements WHERE entreprise_id = $1`, [entreprise]);
  assert.equal(abo.length, 0, "le compte de démonstration a un abonnement : le plafond de 10 € ne vaut plus");
  const poser = async (euros: number) => {
    await pool.query(`DELETE FROM consommation_ia WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(
      `INSERT INTO consommation_ia (entreprise_id, mois, microeuros) VALUES ($1, date_trunc('month', now() AT TIME ZONE 'utc')::date, $2)`,
      [entreprise, Math.round(euros * 1_000_000)]
    );
  };

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`${ADRESSE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30_000 });

  const lire = async () => {
    await page.goto(`${ADRESSE}/reglages/abonnement`, { waitUntil: "networkidle" });
    const bloc = page.locator('[data-atlas="credits-ia"]');
    await bloc.waitFor({ timeout: 15_000 });
    return {
      etat: await bloc.getAttribute("data-etat"),
      valeur: await bloc.locator('[role="meter"]').getAttribute("aria-valuenow"),
      texte: await bloc.innerText(),
    };
  };

  try {
    await cas("sans abonnement, 4,20 € sur 10 € : 42 %, et la date de reprise", async () => {
      await poser(4.2);
      const l = await lire();
      assert.equal(l.etat, "normal");
      assert.equal(l.valeur, "42");
      assert.match(l.texte, /Crédits IA du mois/);
      assert.match(l.texte, /Repart à zéro le 1er \S+\./);
      assert.doesNotMatch(l.texte, /€/, "LA BARRE MONTRE DES EUROS");
    });

    await cas("à 88 %, « presque » et « Il en reste peu »", async () => {
      await poser(8.8);
      const l = await lire();
      assert.equal(l.etat, "presque");
      assert.match(l.texte, /Il en reste peu/);
    });

    await cas("au plafond, « Crédits IA épuisés », en rouge, et la main reprend", async () => {
      await poser(10);
      const l = await lire();
      assert.equal(l.etat, "epuise");
      assert.equal(l.valeur, "100");
      assert.match(l.texte, /Crédits IA épuisés/);
      assert.match(l.texte, /tout s'écrit à la main/);
      const rouge = await page.locator('[data-atlas="credits-ia"] [role="meter"] span').evaluate((s) => getComputedStyle(s).backgroundColor);
      const alerte = await page.evaluate(() => {
        const t = document.createElement("span");
        t.style.color = "var(--atlas-alerte, #9C3B2E)";
        document.body.appendChild(t);
        const c = getComputedStyle(t).color;
        t.remove();
        return c;
      });
      assert.equal(rouge, alerte, "l'épuisé n'est pas dans le rouge de l'alerte");
    });
  } finally {
    await pool.query(`DELETE FROM consommation_ia WHERE entreprise_id = $1`, [entreprise]);
    await navigateur.close();
    await pool.end();
  }

  console.log(echecs === 0 ? "\n✅ La barre suit la règle, dans ses trois états." : `\n❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
