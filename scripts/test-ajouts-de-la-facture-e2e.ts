/**
 * ─── LES AJOUTS DU DEVIS SUR LA FACTURE, PAR SON GESTE ──────────────────────
 *
 * Sa remarque du 3 novembre 2026 : *« Pourquoi la facture, quand on crée une
 * facture, elle n'a pas été modifiée comme la facture suivie d'un devis. Le
 * bouton ma TVA, main d'œuvre, est le même qu'à l'ancienne. »* Sa planche
 * (`appli/soignee/facture.html`, page « ts », état « Facture sans devis »),
 * puis son « oui » : « Main d'œuvre », « Ajouter une TVA » et « Remise » en
 * pastilles, qui ouvrent LES MÊMES FEUILLES QUE LE DEVIS.
 *
 * Ce que la suite éprouve, par SA porte (`CLAUDE.md` §5 quater) : Terminés,
 * « Créer une facture », « Remplir la facture », puis chaque pastille. La
 * feuille s'ouvre, rien n'est posé avant l'appui, ce que l'ajout produira se
 * montre avant, et APRÈS : la base porte la ligne, la TVA ou la remise, et le
 * Total TTC de l'écran suit. Les repères visés sont des `data-atlas`, jamais
 * un libellé (`CLAUDE.md` §5 bis).
 */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
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

/** Les montants portent une espace fine et une insécable : on les ramène à l'espace. */
const lisible = (t: string) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

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

/** Attend que l'écran dise ce qu'on attend : la réponse du serveur repeint après coup. */
async function quandLEcran(page: Page, repere: string, voulu: (t: string) => boolean): Promise<string> {
  let t = "";
  for (const essai of [0, 1, 2, 3, 4, 5, 6]) {
    if (essai > 0) await page.waitForTimeout(essai * 400);
    t = lisible((await page.locator(`[data-atlas="${repere}"]`).first().textContent()) ?? "");
    if (voulu(t)) return t;
  }
  return t;
}

/**
 * Un compteur de la feuille, réglé au doigt jusqu'à la valeur voulue : le
 * geste des « − » et « + », comme `test-feuille-main-oeuvre-e2e`. « ½ » vaut
 * une demi-journée ; « 1 journée » et « 2 jours » se lisent par leur chiffre.
 */
async function regler(page: Page, repere: string, voulu: string) {
  const enNombre = (t: string) => (t.startsWith("½") ? 0.5 : Number(t.replace(/\D.*$/, "")) || 0);
  for (let essai = 0; essai < 400; essai++) {
    const lu = lisible((await page.locator(`[data-atlas="${repere}"]`).first().textContent()) ?? "");
    if (lu === voulu) return;
    await page.click(`[data-atlas="${repere}-${enNombre(lu) < enNombre(voulu) ? "plus" : "moins"}"]`);
  }
  throw new Error(`${repere} n'arrive pas à « ${voulu} »`);
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

    // ── SON CHEMIN : Terminés, « Créer une facture », « Remplir la facture » ──
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="creer-une-facture"]');
    await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await page.fill('input[placeholder="Bernard"]', `Mme Ajouts ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 14 22 87 30");
    await page.click('[data-atlas="action-facture-directe"]');
    await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: 20_000 });
    await page.waitForSelector('[data-atlas="ajouter-travaux-supplementaires"]', { timeout: 20_000 });
    const chantierId = page.url().split("/").slice(-2)[0];
    await page.click('[data-atlas="ajouter-travaux-supplementaires"]');
    await page.waitForURL(/travaux-supplementaires/, { timeout: 15_000 });
    await page.waitForSelector('[data-atlas="ligne-supplement"] textarea', { timeout: 15_000 });

    const lignes = async () =>
      (
        await pool.query(
          `SELECT lf.libelle, lf.quantite::text AS quantite, lf.unite, lf.prix_unitaire::text AS pu,
                  lf.montant::text AS montant, lf.taux_tva::text AS taux
             FROM lignes_facture lf JOIN factures f ON f.id = lf.facture_id
            WHERE f.chantier_id = $1 ORDER BY lf.ordre`,
          [chantierId]
        )
      ).rows as { libelle: string; quantite: string; unite: string | null; pu: string; montant: string; taux: string | null }[];
    const facture = async () =>
      (
        await pool.query(`SELECT main_doeuvre_ht::text AS mo, reduction_pourcent::text AS remise FROM factures WHERE chantier_id = $1`, [
          chantierId,
        ])
      ).rows[0] as { mo: string | null; remise: string | null };

    // La première ligne, celle qui l'attend ouverte : 400 € de taille.
    const description = page.locator('[data-atlas="ligne-supplement"] textarea').first();
    await description.fill("Taille de la haie");
    await description.blur();
    const prix = page.locator('[data-atlas="ligne-supplement"] input[aria-label^="Prix unitaire"]').first();
    await prix.fill("400");
    await prix.blur();
    await quandLaBase(lignes, (l) => l.some((x) => Number(x.montant) === 400));

    await cas("les ajouts du devis sont des pastilles, et plus des liens dorés", async () => {
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 1, "« Main d’œuvre » manque");
      assert.equal(await page.locator('[data-atlas="ajouter-tva-supplement"]').count(), 1, "« Ajouter une TVA » manque");
      assert.equal(await page.locator('[data-atlas="poser-prix-accorde"]').count(), 1, "« Remise » manque");
      // Le dessin de la pastille : arrondie et cernée, comme sur le devis.
      // Un lien doré n'a ni bord ni rayon, et c'est ce qu'il a signalé.
      for (const repere of ["poser-main-doeuvre", "ajouter-tva-supplement", "poser-prix-accorde"]) {
        const style = await page
          .locator(`[data-atlas="${repere}"]`)
          .evaluate((b) => ({ ombre: getComputedStyle(b).boxShadow, rayon: parseFloat(getComputedStyle(b).borderTopLeftRadius) }));
        assert.ok(style.ombre !== "none" && style.rayon >= 20, `« ${repere} » n'a pas le dessin d'une pastille : ${JSON.stringify(style)}`);
      }
    });

    // ── LA MAIN D'ŒUVRE ───────────────────────────────────────────────────
    await cas("« Main d’œuvre » ouvre la feuille du devis, le calcul AVANT, rien en base", async () => {
      await page.click('[data-atlas="poser-main-doeuvre"]');
      await page.locator('[data-atlas="feuille-mo"]').waitFor();
      await regler(page, "mo-hommes", "2");
      await regler(page, "mo-duree", "1 journée");
      await page.fill('[data-atlas="mo-tarif"]', "280");
      assert.equal(lisible(await page.locator('[data-atlas="mo-calcul"]').innerText()), "2 hommes × 1 journée × 280 €");
      assert.match(lisible(await page.locator('[data-atlas="mo-total"]').innerText()), /^560,00 €/);
      assert.equal((await lignes()).length, 1, "une ligne s'est posée avant l'appui");
    });

    await cas("« Ajouter la main d’œuvre » : la ligne en base, à l'écran, et le Total TTC suit", async () => {
      await page.click('[data-atlas="mo-valider"]');
      const l = await quandLaBase(lignes, (v) => v.length === 2);
      assert.deepEqual(
        { libelle: l[1]?.libelle, quantite: Number(l[1]?.quantite), unite: l[1]?.unite, pu: Number(l[1]?.pu), montant: Number(l[1]?.montant) },
        { libelle: "Main d’œuvre", quantite: 2, unite: "jour/homme", pu: 280, montant: 560 }
      );
      assert.equal(await page.locator('[data-atlas="ligne-supplement"]').count(), 2, "la ligne de main d'œuvre n'est pas à l'écran");
      // 400 + 560 = 960 HT, TVA 20 % : 1 152,00 TTC.
      const ttc = await quandLEcran(page, "total-ttc", (t) => t.includes("1 152,00"));
      assert.ok(ttc.includes("1 152,00"), `le Total TTC ne suit pas : « ${ttc} »`);
    });

    await cas("« dont main d’œuvre HT » la compte, en base comme sous le Total HT", async () => {
      const f = await quandLaBase(facture, (v) => v.mo === "560.00");
      assert.equal(f.mo, "560.00");
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').inputValue(), "560");
    });

    // ── LA TVA ────────────────────────────────────────────────────────────
    await cas("« Ajouter une TVA » ouvre la feuille ; un taux déjà sur la facture se refuse", async () => {
      await page.click('[data-atlas="ajouter-tva-supplement"]');
      await page.locator('[data-atlas="feuille-tva"]').waitFor();
      assert.equal(await page.locator('[data-atlas="feuille-tva-case"]').inputValue(), "10");
      await page.locator('[data-atlas="feuille-tva-case"]').fill("20");
      assert.match(lisible(await page.locator('[data-atlas="feuille-tva-refus"]').innerText()), /déjà sur cette facture/);
      assert.ok(await page.locator('[data-atlas="feuille-tva-valider"]').isDisabled(), "le bouton reste allumé sur un taux déjà pris");
      assert.equal((await lignes()).length, 2, "une catégorie s'est posée avant l'appui");
    });

    await cas("5,5 tapé : la catégorie naît à 5,5 %, en base comme à l'écran", async () => {
      await page.locator('[data-atlas="feuille-tva-case"]').fill("5,5");
      await page.click('[data-atlas="feuille-tva-valider"]');
      const l = await quandLaBase(lignes, (v) => v.some((x) => x.taux === "5.50"));
      assert.ok(l.some((x) => x.taux === "5.50"), `la base porte ${JSON.stringify(l.map((x) => x.taux))}`);
      const titres = page.locator('input[aria-label^="Taux de TVA à"]');
      await titres.nth(1).waitFor();
      assert.equal(await titres.nth(1).inputValue(), "5,5");
      // Toujours offerte : il en pose une troisième s'il veut.
      assert.equal(await page.locator('[data-atlas="ajouter-tva-supplement"]').count(), 1, "« Ajouter une TVA » a disparu");
    });

    // ── LA REMISE ─────────────────────────────────────────────────────────
    await cas("« Remise » montre ce qu'elle retire AVANT d'être posée", async () => {
      await page.click('[data-atlas="poser-prix-accorde"]');
      await page.locator('[data-atlas="feuille-remise"]').waitFor();
      assert.equal(lisible(await page.locator('[data-atlas="feuille-remise-montant"]').innerText()), "− 48,00 €");
      await page.locator('[data-atlas="feuille-remise-case"]').fill("10");
      assert.equal(lisible(await page.locator('[data-atlas="feuille-remise-montant"]').innerText()), "− 96,00 €");
      assert.equal((await facture()).remise, null, "la remise est en base avant l'appui sur le bouton");
    });

    await cas("10 % appliqués : la base les porte, la ligne dorée les dit, et le Total TTC suit", async () => {
      await page.click('[data-atlas="feuille-remise-valider"]');
      const f = await quandLaBase(facture, (v) => v.remise === "10.00");
      assert.equal(f.remise, "10.00");
      assert.equal(await page.locator('[data-atlas="taux-prix-accorde"]').inputValue(), "10");
      // 960 − 96 = 864 HT, TVA 20 % : 172,80 ; 1 036,80 TTC.
      const ttc = await quandLEcran(page, "total-ttc", (t) => t.includes("1 036,80"));
      assert.ok(ttc.includes("1 036,80"), `le Total TTC ne suit pas la remise : « ${ttc} »`);
      assert.equal(await page.locator('[data-atlas="poser-prix-accorde"]').count(), 0, "« Remise » reste offerte sur une facture qui en porte une");
    });

    await cas("la croix la retire, et la pastille revient", async () => {
      await page.click('[data-atlas="retirer-prix-accorde"]');
      const f = await quandLaBase(facture, (v) => v.remise === null);
      assert.equal(f.remise, null, "la remise retirée dort en base");
      await page.locator('[data-atlas="poser-prix-accorde"]').waitFor();
    });
  } finally {
    await contexte.close();
    await navigateur.close();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les ajouts du devis sur la facture — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
