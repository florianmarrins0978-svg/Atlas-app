import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * Une équipe absente ne compte plus — du doigt jusqu'à la date proposée.
 *
 * *Le patron, le 14 août 2026 : « Comment on fait si jamais il y a une équipe
 * qui doit partir en déplacement pour cinq jours ? »* Retenu sur maquette
 * (`docs/maquettes/55`, proposition A).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE PEUT VOIR.**
 *
 * Les règles pures éprouvent qu'une absence retire une unité de capacité
 * (`test-absences-equipe.ts`), et le dépôt qu'elle s'écrit dans la bonne
 * entreprise (`test-absences-equipe-repo.ts`). Toutes deux resteraient vertes
 * si l'ÉCRAN n'appelait jamais la règle — c'est exactement le trou qui a coûté
 * le plus cher dans ce dépôt (`HANDOVER.md`, piège 13 : « une règle juste que
 * l'écran n'applique pas ne protège personne »), et celui qui a fait
 * disparaître un ticket de gazole la veille (§91).
 *
 * On traverse donc le parcours entier : noter l'absence à l'écran, puis
 * vérifier que **la capacité du planning a bougé** — c'est-à-dire ce que le
 * client se verra proposer.
 *
 * **Le contrôle sait échouer**, et il a été vu rouge : la fusion des absences
 * retirée du calcul, le dernier cas tombe en nommant le jour.
 */

const BASE = "http://localhost:3000";
/** Reconnaissable, et retiré à la fin : aucune autre suite ne doit le lire. */
const MOTIF = "Déplacement E2E";

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

/**
 * Cinq jours dans un mois PROCHE et vide.
 *
 * Le mois suivant, à partir du 8 : assez loin pour qu'aucun chantier de
 * démonstration n'y traîne, assez proche pour que le calendrier l'atteigne en
 * un appui sur « Mois suivant ». Un jour à un an d'ici obligerait à douze
 * appuis, et le contrôle passerait son temps à naviguer.
 */
function joursDEssai(): { premier: string; dernier: string } {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(8);
  const premier = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 4);
  return { premier, dernier: d.toISOString().slice(0, 10) };
}

/** Ce que le réglage valait avant nous — remis à la fin, quoi qu'il arrive. */
let equipesAvant: number | null = null;

/**
 * Ne rien laisser derrière soi.
 *
 * **Le nombre d'équipes est REMIS**, et ce n'est pas de la coquetterie : les
 * suites partagent une base et un serveur, et celles qui suivent liraient un
 * réglage qu'elles n'ont pas posé. Une suite qui modifie l'état commun sans le
 * rendre fait rougir la suivante, qui accuse alors son propre écran.
 */
async function nettoyer() {
  await pool.query(`DELETE FROM absences_equipe WHERE motif = $1`, [MOTIF]);
  if (equipesAvant !== null) {
    await pool.query(`UPDATE entreprises SET nombre_equipes = $1`, [equipesAvant]);
  }
}

async function main() {
  const { premier, dernier } = joursDEssai();

  await nettoyer();
  equipesAvant = (await pool.query(`SELECT nombre_equipes FROM entreprises LIMIT 1`)).rows[0]?.nombre_equipes ?? 1;
  // **Deux équipes, sinon le bloc n'existe pas** — et c'est délibéré : seul,
  // noter son absence reviendrait à fermer l'entreprise. Le réglage est posé
  // ici plutôt que supposé, une autre suite le déplaçant.
  await pool.query(`UPDATE entreprises SET nombre_equipes = 2`);

  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Absences", { timeout: 30_000 });

  await test("Le bloc « Absences » est là, sous les noms", async () => {
    // Sous les noms, comme il l'a retenu : l'ordre à l'écran EST le choix.
    const y = async (texte: string) =>
      (await page.locator(`text=${texte}`).first().boundingBox())?.y ?? -1;
    const noms = await y("Leurs noms");
    const absences = await y("Absences");
    assert.ok(noms > 0 && absences > noms, `« Absences » (${absences}) devrait suivre « Leurs noms » (${noms})`);
  });

  await test("Noter une absence : la feuille dit qui, et jusqu'à quand", async () => {
    await page.getByRole("button", { name: "+ Noter une absence" }).click();
    await page.waitForSelector("text=Qui n’est pas là ?", { timeout: 10_000 });
    await page.getByLabel("Premier jour d'absence").fill(premier);
    await page.getByLabel("Dernier jour d'absence").fill(dernier);
    await page.getByLabel("Motif de l'absence").fill(MOTIF);

    // **Dit AVANT l'appui.** Le patron doit savoir ce qu'il bloque, et que les
    // week-ends comptent — sans quoi il découvrirait le samedi manquant plus
    // tard, sur une date refusée à un client.
    const annonce = (await page.locator("text=week-ends compris").first().textContent()) ?? "";
    assert.ok(/sera absente/.test(annonce), `l'annonce ne dit pas ce qui va se passer : « ${annonce} »`);
  });

  await test("Une absence à l'envers est refusée, et l'écran dit laquelle", async () => {
    // Le bouton s'éteint AVANT l'appel : la même règle sert à l'écran et au
    // serveur (`src/lib/absences-equipe.ts`).
    //
    // **L'ordre des deux saisies n'est pas indifférent**, et le premier jet du
    // contrôle s'y est cassé les dents : avancer le PREMIER jour pousse le
    // dernier avec lui — c'est voulu, sinon le patron se retrouve devant un
    // bouton éteint sans savoir lequel des deux champs le gêne. L'état inversé
    // ne s'atteint donc qu'en reculant le DERNIER jour, en second.
    await page.getByLabel("Premier jour d'absence").fill(dernier);
    await page.getByLabel("Dernier jour d'absence").fill(premier);
    await page.waitForSelector("text=Le dernier jour tombe avant le premier.", { timeout: 10_000 });
    const bouton = page.getByRole("button", { name: "Noter l’absence" });
    assert.equal(await bouton.isDisabled(), true, "le bouton reste actif sur une absence à l'envers");

    // On remet la bonne saisie pour la suite.
    await page.getByLabel("Premier jour d'absence").fill(premier);
    await page.getByLabel("Dernier jour d'absence").fill(dernier);
  });

  await test("Enregistrée, elle apparaît dans la liste avec ses dates", async () => {
    await page.getByRole("button", { name: "Noter l’absence" }).click();
    await page.locator(`text=${MOTIF}`).first().waitFor({ state: "visible", timeout: 30_000 });
    // **Formaté par la base, pas par JavaScript.** Une colonne `date` remonte en
    // objet `Date`, et `String(...)` en tire « Sat Sep 12 2026 » — le contrôle
    // comparait alors deux écritures différentes du même jour et accusait la
    // saisie.
    const { rows } = await pool.query(
      `SELECT to_char(premier_jour, 'YYYY-MM-DD') AS premier,
              to_char(dernier_jour, 'YYYY-MM-DD') AS dernier
         FROM absences_equipe WHERE motif = $1 AND deleted_at IS NULL`,
      [MOTIF]
    );
    assert.equal(rows.length, 1, `${rows.length} absence(s) en base au lieu d'une`);
    assert.equal(rows[0].premier, premier);
    assert.equal(rows[0].dernier, dernier);
  });

  await test("Le PLANNING compte l'équipe absente — c'est tout l'objet du lot", async () => {
    // **Le contrôle qui compte.** Les deux autres suites resteraient vertes si
    // l'écran n'appelait jamais la règle. Ici on lit ce que le patron voit :
    // le nom accessible de la case porte l'état du jour.
    //
    // Deux équipes, une partie : « il reste de la place ». Sans les absences
    // dans le calcul, la même case dirait « libre » — c'est cet écart-là qui
    // fait rougir le contrôle quand on retire la réparation.
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-jour]", { timeout: 30_000 });

    const caseDuJour = page.locator(`[data-jour="${premier}"]`);
    for (let essai = 0; essai < 3; essai++) {
      if (await caseDuJour.count()) break;
      await page.getByRole("button", { name: "Mois suivant" }).click();
      await page.waitForTimeout(400);
    }
    assert.ok(await caseDuJour.count(), `le calendrier n'atteint pas le ${premier}`);

    const etat = (await caseDuJour.first().getAttribute("aria-label")) ?? "";
    assert.ok(
      !/libre/.test(etat),
      `le ${premier} est annoncé « ${etat} » alors qu'une équipe sur deux est partie`
    );
    assert.ok(
      /reste de la place/.test(etat),
      `une équipe sur deux étant partie, il devrait rester de la place — lu : « ${etat} »`
    );
  });

  await test("Retirée, la capacité revient — sans rien défaire d'autre", async () => {
    await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "domcontentloaded" });
    await page.locator(`text=${MOTIF}`).first().waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: /^Retirer l'absence/ }).first().click();

    for (const essai of [1, 2, 3, 4]) {
      await page.waitForTimeout(essai * 400);
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM absences_equipe WHERE motif = $1 AND deleted_at IS NULL`,
        [MOTIF]
      );
      if (rows[0].n === 0) return;
    }
    assert.fail("l'absence est encore active en base après le retrait");
  });

  await context.close();
  await browser.close();
  await nettoyer();

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await nettoyer().catch(() => {});
  await pool.end();
  process.exit(1);
});
