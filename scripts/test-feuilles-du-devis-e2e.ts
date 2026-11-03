/**
 * ─── UNE TVA, UN ACOMPTE, UNE REMISE : LE CHIFFRE QU'IL TAPE ─────────────────
 *
 * Sa réponse du 1er novembre 2026 devant la planche du devis : *« TVA,
 * acompte, remise, je dois pouvoir écrire ce que je veux »*, puis *« laisse
 * comme tu as fait, ensuite code ça »*. Planche :
 * `appli/soignee/chantier.html?ecran=devis`.
 *
 * Ce que la suite éprouve, par SON geste (`CLAUDE.md` §5 quater) : la pastille,
 * la feuille, le chiffre tapé, le refus en ambre qui éteint le bouton, ce que
 * l'ajout produira montré AVANT, et ce que la base porte APRÈS. Un chiffre
 * tapé qui n'arriverait pas en base serait le pire des défauts : l'écran
 * dirait 12 %, le client paierait 5.
 */
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

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

/** Attend que la base dise ce qu'on attend, et rend ce qu'elle disait. */
async function quandLaBase<T>(lire: () => Promise<T>, voulu: (v: T) => boolean): Promise<T> {
  let v = await lire();
  for (const essai of [1, 2, 3, 4, 5, 6]) {
    if (voulu(v)) return v;
    await new Promise((r) => setTimeout(r, essai * 600));
    v = await lire();
  }
  return v;
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Feuilles ${Date.now()}`);
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  const lignesVoulues = [
    ["Taille de la haie", "450"],
    ["Broyage des branches", "180"],
    ["Évacuation des déchets verts", "240"],
  ];
  for (const [rang, [libelle, prix]] of lignesVoulues.entries()) {
    const zones = page.locator('textarea[aria-label*="escription"]');
    if ((await zones.count()) <= rang) await page.click('button:has-text("Ajouter une ligne")');
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > rang) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(rang).fill(libelle);
    await page.locator('input[aria-label*="Prix unitaire"]').nth(rang).fill(prix);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  }
  for (const essai of [1, 2, 3, 4]) {
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    if ((await page.locator("body").innerText()).includes("870,00")) break;
    await page.waitForTimeout(essai * 500);
  }

  const texte = async (sel: string) => ((await page.locator(sel).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
  const valider = (q: string) => page.locator(`[data-atlas="feuille-${q}-valider"]`);

  // ── LA TVA ────────────────────────────────────────────────────────────────
  await cas("la TVA s'ouvre sur une feuille, pas sur une catégorie posée d'office", async () => {
    await page.getByRole("button", { name: "+ Ajouter une TVA" }).click();
    await page.locator('[data-atlas="feuille-tva"]').waitFor();
    assert.equal(await page.locator('[data-atlas="feuille-tva-case"]').inputValue(), "10", "la case n'est pas à 10");
    assert.equal(
      await page.locator('input[aria-label*="Taux de TVA de la catégorie"]').count(),
      0,
      "une catégorie est apparue avant qu'il ait validé"
    );
  });

  await cas("un raccourci écrit dans la case, et le bouton le dit", async () => {
    await page.getByRole("button", { name: "5,5 %" }).click();
    assert.equal(await page.locator('[data-atlas="feuille-tva-case"]').inputValue(), "5,5");
    assert.equal(await texte('[data-atlas="feuille-tva-valider"]'), "Ajouter la TVA à 5,5 %");
  });

  await cas("ce qui n'est pas un taux se dit en ambre, et éteint le bouton", async () => {
    await page.locator('[data-atlas="feuille-tva-case"]').fill("dix");
    assert.ok((await texte('[data-atlas="feuille-tva-refus"]')).length > 0, "aucun refus écrit");
    assert.ok(await valider("tva").isDisabled(), "le bouton reste allumé sur un taux illisible");
    // La TVA du devis est déjà là : en ouvrir une seconde au même taux ferait
    // deux catégories pour une seule TVA.
    await page.locator('[data-atlas="feuille-tva-case"]').fill("20");
    assert.match(await texte('[data-atlas="feuille-tva-refus"]'), /déjà sur ce devis/);
    assert.ok(await valider("tva").isDisabled());
  });

  await cas("8,5 tapé : la catégorie naît à 8,5 %, à l'écran comme en base", async () => {
    await page.locator('[data-atlas="feuille-tva-case"]').fill("8,5");
    await valider("tva").click();
    const taux = await quandLaBase(
      async () =>
        (
          await pool.query(`SELECT DISTINCT taux_tva::text AS t FROM lignes_prix WHERE chantier_id = $1 AND taux_tva IS NOT NULL`, [
            chantierId,
          ])
        ).rows.map((r) => r.t as string),
      (v) => v.includes("8.50")
    );
    assert.ok(taux.includes("8.50"), `la base porte ${JSON.stringify(taux)}`);
    const titres = page.locator('input[aria-label*="Taux de TVA de la catégorie"]');
    await titres.nth(1).waitFor();
    assert.equal(await titres.nth(1).inputValue(), "8,5");
  });

  // ── LA REMISE ─────────────────────────────────────────────────────────────
  await cas("la remise montre ce qu'elle retire AVANT d'être posée", async () => {
    await page.locator('[data-atlas="poser-prix-accorde"]').click();
    await page.locator('[data-atlas="feuille-remise"]').waitFor();
    assert.equal(await texte('[data-atlas="feuille-remise-montant"]'), "− 43,50 €");
    await page.locator('[data-atlas="feuille-remise-case"]').fill("12");
    assert.equal(await texte('[data-atlas="feuille-remise-montant"]'), "− 104,40 €");
    const reduction = (await pool.query(`SELECT reduction_pourcent FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`, [chantierId])).rows[0]
      ?.reduction_pourcent;
    assert.equal(reduction ?? null, null, "la remise est en base avant l'appui sur le bouton");
  });

  await cas("0 % n'est pas une remise : refus, bouton éteint", async () => {
    await page.locator('[data-atlas="feuille-remise-case"]').fill("0");
    assert.ok((await texte('[data-atlas="feuille-remise-refus"]')).length > 0);
    assert.ok(await valider("remise").isDisabled());
  });

  await cas("12 % tapé : la base porte 12 %, et le devis le dit", async () => {
    await page.locator('[data-atlas="feuille-remise-case"]').fill("12");
    await valider("remise").click();
    const reduction = await quandLaBase(
      async () =>
        (await pool.query(`SELECT reduction_pourcent FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`, [chantierId]))
          .rows[0]?.reduction_pourcent as string | null,
      (v) => v === "12.00"
    );
    assert.equal(reduction, "12.00");
    assert.equal(await page.locator('input[aria-label="Remise, en pourcentage"]').inputValue(), "12");
  });

  // ── L'ACOMPTE ─────────────────────────────────────────────────────────────
  const acomptes = async () =>
    (
      await pool.query(
        `SELECT a.taux_cumule::text AS t FROM acomptes_devis a JOIN devis d ON d.id = a.devis_id
          WHERE d.chantier_id = $1 ORDER BY a.rang`,
        [chantierId]
      )
    ).rows.map((r) => r.t as string);

  await cas("l'acompte dit QUAND il tombe, et refuse un taux sous le cumul d'avant", async () => {
    const avant = await acomptes();
    await page.locator('[data-atlas="ajouter-acompte"]').click();
    await page.locator('[data-atlas="feuille-acompte"]').waitFor();
    const moment = avant.length === 0 ? "à la signature" : avant.length === 1 ? "à mi-parcours" : "à l'avancement";
    assert.ok((await texte('[data-atlas="feuille-acompte"]')).includes(`Versé ${moment}`), `le moment « ${moment} » manque`);
    if (avant.length > 0) {
      await page.locator('[data-atlas="feuille-acompte-case"]').fill(String(Math.floor(Number(avant[avant.length - 1]))));
      assert.match(await texte('[data-atlas="feuille-acompte-refus"]'), /déjà/);
      assert.ok(await valider("acompte").isDisabled());
    }
  });

  await cas("un taux tapé arrive en base tel quel, et la feuille montre le reste avant", async () => {
    const avant = await acomptes();
    const voulu = avant.length === 0 ? "35" : String(Math.min(95, Math.floor(Number(avant[avant.length - 1])) + 15));
    await page.locator('[data-atlas="feuille-acompte-case"]').fill(voulu);
    assert.match(await texte('[data-atlas="feuille-acompte"]'), /Reste à régler : /);
    await valider("acompte").click();
    const apres = await quandLaBase(acomptes, (v) => v.length === avant.length + 1);
    assert.equal(apres[apres.length - 1], `${voulu}.00`, `la base porte ${JSON.stringify(apres)}`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les feuilles du devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
