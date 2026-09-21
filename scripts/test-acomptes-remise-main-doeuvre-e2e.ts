import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * ─── SES TROIS ACOMPTES SURVIVENT À LA REMISE ET À LA MAIN D'ŒUVRE ──────────
 *
 * **Sa panne du 17 septembre 2026, capture à l'appui :** *« lorsque j'ai la
 * remise et la main d'œuvre de sélectionner, ça prend qu'un seul acompte, ça
 * m'a supprimé mes 2 autres et je n'arrive pas à les remettre »*. Son devis
 * portait 30 / 50 / 75 (la capture du PDF le montre) ; trois minutes plus tard,
 * l'écran n'en portait plus qu'un.
 *
 * **Ce que cette suite rejoue, c'est SA séquence** — pas la fonction qu'on
 * vient d'écrire (`CLAUDE.md` §5 quater) : poser les trois acomptes, puis la
 * remise, puis la main d'œuvre, et regarder ce qui reste. Puis le second
 * grief, qui compte autant : « + Ajouter un acompte » doit savoir les remettre.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

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
  console.log("=== Les acomptes, la remise et la main d'œuvre ===\n");
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const { rows: demo } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(demo[0]?.entreprise_id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const entrepriseId: string = demo[0].entreprise_id;
  const { rows: avant } = await pool.query(`SELECT acompte_pourcent FROM entreprises WHERE id = $1`, [entrepriseId]);
  await pool.query(`UPDATE entreprises SET acompte_pourcent = 30 WHERE id = $1`, [entrepriseId]);

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Linotte ${Date.now()}`);
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
  const chantierId = url.split("/").pop()!;
  await page.waitForLoadState("networkidle");

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  for (const [rang, [libelle, prix]] of [
    ["Terrasse bois", "5600"],
    ["Taille de haie de laurier", "750"],
  ].entries()) {
    const zones = page.locator('textarea[aria-label*="escription"]');
    // La feuille s'ouvre déjà avec sa PREMIÈRE ligne (20 septembre 2026) :
    // on n'ajoute que celles qui manquent.
    if ((await zones.count()) <= rang) await page.click('button:has-text("Ajouter une ligne")');
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > rang) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(rang).fill(libelle);
    const champPrix = page.locator('input[aria-label*="Prix unitaire"]').nth(rang);
    await champPrix.click();
    await champPrix.fill(prix);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  }
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

  /** Les taux cumulés que la BASE porte, dans l'ordre des rangs. */
  async function enBase(): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT a.taux_cumule FROM acomptes_devis a
         JOIN devis d ON d.id = a.devis_id
        WHERE d.chantier_id = $1 ORDER BY d.numero_version DESC, a.rang ASC`,
      [chantierId]
    );
    return rows.map((r) => r.taux_cumule);
  }
  async function quandLaBasePorte(n: number): Promise<string[]> {
    let lus: string[] = [];
    for (const essai of [0, 1, 2, 3, 4]) {
      if (essai > 0) await page.waitForTimeout(essai * 600);
      lus = await enBase();
      if (lus.length === n) break;
    }
    return lus;
  }

  const boutonAcompte = () => page.getByRole("button", { name: /Ajouter un acompte/ });

  await cas("les trois acomptes se posent — 30, 50, 75", async () => {
    for (const _ of [1, 2]) {
      await boutonAcompte().click();
      await page.waitForTimeout(900);
    }
    assert.deepEqual(await quandLaBasePorte(3), ["30.00", "50.00", "75.00"]);
  });

  // ── SA SÉQUENCE, dans son ordre : la remise, puis la main d'œuvre ─────────
  await cas("la remise de 5 % ne touche PAS aux acomptes", async () => {
    await page.getByRole("button", { name: /^\+ Remise$/ }).click();
    const champ = page.locator('input[aria-label*="emise"]').first();
    await champ.fill("5");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    assert.deepEqual(
      await quandLaBasePorte(3),
      ["30.00", "50.00", "75.00"],
      "la remise a emporté des acomptes"
    );
  });

  await cas("la main d'œuvre ne touche PAS aux acomptes", async () => {
    await page.click('[data-atlas="poser-main-doeuvre"]');
    const champ = page.locator('[data-atlas="montant-main-doeuvre"]');
    await champ.fill("2546");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    assert.deepEqual(
      await quandLaBasePorte(3),
      ["30.00", "50.00", "75.00"],
      "la main d'œuvre a emporté des acomptes"
    );
  });

  // **La seconde TVA, et la ligne qu'elle ouvre** — sa capture en porte deux
  // (20 % et 10 %), et la ligne de 42 € est arrivée entre les deux captures.
  await cas("une seconde TVA, et sa ligne, ne touchent PAS aux acomptes", async () => {
    await page.getByRole("button", { name: /Ajouter une TVA/ }).click();
    await page.waitForTimeout(1000);
    const zones = page.locator('textarea[aria-label*="escription"]');
    const rang = (await zones.count()) - 1;
    await zones.nth(rang).fill("Fleurs de saison");
    const qte = page.locator('input[aria-label*="Quantité"]').nth(rang);
    await qte.click();
    await qte.fill("12");
    const prix = page.locator('input[aria-label*="Prix unitaire"]').nth(rang);
    await prix.click();
    await prix.fill("3,50");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    assert.deepEqual(
      await quandLaBasePorte(3),
      ["30.00", "50.00", "75.00"],
      "la seconde TVA a emporté des acomptes"
    );
  });

  await cas("après un rechargement, l'écran porte encore ses TROIS acomptes", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const lignes = await page.locator('input[data-atlas="taux-acompte"]').count();
    assert.equal(lignes, 3, `l'écran n'en montre plus que ${lignes}`);
  });

  // ── Le second grief : « je n'arrive pas à les remettre » ──────────────────
  await cas("après un retrait, « + Ajouter un acompte » les REMET", async () => {
    for (const _ of [1, 2]) {
      await page.locator('button[data-atlas="retirer-acompte"]').last().click();
      await page.waitForTimeout(800);
    }
    assert.deepEqual(await quandLaBasePorte(1), ["30.00"], "le retrait n'a pas laissé le premier");
    for (const _ of [1, 2]) {
      assert.equal(await boutonAcompte().count(), 1, "le geste d'ajout a disparu alors qu'il reste un moment");
      await boutonAcompte().click();
      await page.waitForTimeout(900);
    }
    assert.deepEqual(
      await quandLaBasePorte(3),
      ["30.00", "50.00", "75.00"],
      "les acomptes ne se remettent pas"
    );
    const lignes = await page.locator('input[data-atlas="taux-acompte"]').count();
    assert.equal(lignes, 3, `l'écran n'en montre que ${lignes} après les avoir remis`);
  });

  // **Le double appui — 17 septembre 2026.** Sa relecture : *« j'ai tout
  // supprimé et ça a marché lorsque j'ai remis, c'était peut-être un bug,
  // vérifie quand même »*. Un geste qui ne répond pas se presse deux fois : ce
  // que l'écran montre doit alors rester ce que la base porte, et pas un
  // quatrième acompte ni une ligne fantôme.
  await cas("deux appuis coup sur coup ne posent pas deux acomptes de plus", async () => {
    for (const _ of [1, 2, 3]) {
      await page.locator('button[data-atlas="retirer-acompte"]').last().click();
      await page.waitForTimeout(700);
    }
    assert.deepEqual(await quandLaBasePorte(0), [], "le retrait n'a pas tout enlevé");

    const bouton = boutonAcompte();
    await bouton.click();
    await bouton.click();
    await page.waitForTimeout(1500);
    const enBase2 = await enBase();
    const aLEcran = await page.locator('input[data-atlas="taux-acompte"]').count();
    assert.equal(
      aLEcran,
      enBase2.length,
      `l'écran montre ${aLEcran} acompte(s) et la base en porte ${enBase2.length} : ils ont divergé`
    );
    assert.ok(enBase2.length <= 3, `${enBase2.length} acomptes en base : le maximum est trois`);
  });

  await pool.query(`UPDATE entreprises SET acompte_pourcent = $2 WHERE id = $1`, [entrepriseId, avant[0]?.acompte_pourcent ?? null]);
  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Acomptes, remise et main d'œuvre — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
