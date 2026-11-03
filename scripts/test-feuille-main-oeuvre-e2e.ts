/**
 * ─── LA FEUILLE « MAIN D'ŒUVRE » DU DEVIS, PAR SON GESTE ─────────────────────
 *
 * Sa planche du 1er novembre 2026, choisie le soir même (*« laisse comme tu as
 * fait, ensuite code ça »*) : « Main d'œuvre » ouvre une feuille qui montre le
 * calcul avant d'ajouter, et « Mes partenaires », à droite du titre, prend le
 * prix d'un partenaire avec sa marge (son idée du même soir).
 *
 * Ce que la suite éprouve, de la pastille à la base (`CLAUDE.md` §5 quater) :
 * son équipe arrive en jours d'homme au prix du jour ; un partenaire arrive à
 * son nom, dans son unité, à son prix multiplié par la marge LUE EN BASE ; sa
 * marge à lui passe avant celle de la main d'œuvre ; une heure se tape.
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

type LigneMO = { libelle: string; quantite: string; unite: string | null; prix_unitaire: string; montant: string; a_chiffrer: boolean };

async function main() {
  const marque = Date.now();
  const ent = (
    await pool.query(
      `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
    )
  ).rows[0].entreprise_id as string;

  // Deux partenaires à lui : l'un suit la marge de la main d'œuvre, l'autre a
  // la sienne. La marge générale est posée pour l'essai, puis rendue.
  const margeAvant = (await pool.query(`SELECT main_oeuvre FROM marges_achat WHERE entreprise_id = $1`, [ent])).rows[0];
  await pool.query(
    `INSERT INTO marges_achat (entreprise_id, main_oeuvre) VALUES ($1, 1.20)
       ON CONFLICT (entreprise_id) DO UPDATE SET main_oeuvre = 1.20`,
    [ent]
  );
  const morin = `Carrelage Morin ${marque}`;
  const durand = `Élagage Durand ${marque}`;
  const societe = async (nom: string, marge: string | null) =>
    (
      await pool.query(
        `INSERT INTO societes_achat (entreprise_id, rubrique, nom, marge) VALUES ($1, 'partenaire', $2, $3) RETURNING id`,
        [ent, nom, marge]
      )
    ).rows[0].id as string;
  const prix = async (societeId: string, nom: string, unite: string, prixHt: string) =>
    (
      await pool.query(
        `INSERT INTO prix_achat (entreprise_id, societe_id, nom, unite, prix_ht, source) VALUES ($1, $2, $3, $4, $5, 'essai') RETURNING id`,
        [ent, societeId, nom, unite, prixHt]
      )
    ).rows[0].id as string;
  const idMorin = await societe(morin, null);
  const idDurand = await societe(durand, "1.35");
  const prixFaience = await prix(idMorin, "Pose de faïence", "journée", "380");
  const prixElagage = await prix(idDurand, "Élagage", "heure", "60");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Mme Main ${marque}`);
    const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
    const chantierId = url.split("/").pop()!;
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    const lignesMO = async () =>
      (
        await pool.query(
          `SELECT libelle, quantite::text, unite, prix_unitaire::text, montant::text, a_chiffrer
             FROM lignes_prix WHERE chantier_id = $1 AND main_doeuvre ORDER BY ordre`,
          [chantierId]
        )
      ).rows as LigneMO[];
    const quandIlYEnA = async (n: number) => {
      let l = await lignesMO();
      for (const essai of [1, 2, 3, 4, 5, 6]) {
        if (l.length >= n) break;
        await page.waitForTimeout(essai * 500);
        l = await lignesMO();
      }
      return l;
    };
    const texte = async (sel: string) => ((await page.locator(sel).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
    const ouvrir = async () => {
      await page.click('[data-atlas="poser-main-doeuvre"]');
      await page.locator('[data-atlas="feuille-mo"]').waitFor();
    };
    const regler = async (repere: string, voulu: string) => {
      for (let essai = 0; essai < 400; essai++) {
        const lu = await texte(`[data-atlas="${repere}"]`);
        if (lu === voulu) return;
        const n = Number(lu.replace(/\D.*$/, "").replace("½", "0.5")) || (lu.startsWith("½") ? 0.5 : 0);
        const cible = Number(voulu.replace(/\D.*$/, "")) || 0.5;
        await page.click(`[data-atlas="${repere}-${n < cible ? "plus" : "moins"}"]`);
      }
      throw new Error(`${repere} n'arrive pas à « ${voulu} »`);
    };

    await cas("son équipe : 2 hommes × 2 jours × 280 €, montré AVANT, puis posé en jours d'homme", async () => {
      await ouvrir();
      await regler("mo-hommes", "2");
      await regler("mo-duree", "2 jours");
      await page.fill('[data-atlas="mo-tarif"]', "280");
      assert.equal(await texte('[data-atlas="mo-calcul"]'), "2 hommes × 2 jours × 280 €");
      assert.match(await texte('[data-atlas="mo-total"]'), /^1 120,00 €/);
      assert.deepEqual(await lignesMO(), [], "une ligne posée avant l'appui");
      await page.click('[data-atlas="mo-valider"]');
      const [l] = await quandIlYEnA(1);
      assert.deepEqual(
        { libelle: l.libelle, quantite: Number(l.quantite), unite: l.unite, pu: Number(l.prix_unitaire), montant: Number(l.montant), aChiffrer: l.a_chiffrer },
        { libelle: "Main d’œuvre", quantite: 4, unite: "jour/homme", pu: 280, montant: 1120, aChiffrer: false }
      );
    });

    await cas("« Mes partenaires » à droite du titre ouvre ses prix, rangés sous chaque partenaire", async () => {
      await ouvrir();
      await page.click('[data-atlas="mo-partenaires"]');
      await page.locator('[data-atlas="mo-liste"]').waitFor();
      const liste = await texte('[data-atlas="mo-liste"]');
      assert.ok(liste.includes(morin) && liste.includes(durand), `ses partenaires manquent :\n${liste}`);
      assert.ok(liste.includes("380 € la journée") && liste.includes("60 € l’heure"), `ses prix manquent :\n${liste}`);
      assert.ok(liste.includes("× 1,35"), "la marge propre de Durand n'est pas dite");
    });

    await cas("un partenaire à la journée : son prix × la marge lue en base, la ligne dit son nom", async () => {
      await page.click(`[data-atlas="mo-prix-${prixFaience}"]`);
      await regler("mo-duree", "3 jours");
      assert.equal(await texte('[data-atlas="mo-calcul"]'), "3 jours × 380 € × 1,20");
      assert.match(await texte('[data-atlas="mo-total"]'), /^1 368,00 €/);
      await page.click('[data-atlas="mo-valider"]');
      const l = (await quandIlYEnA(2))[1];
      assert.ok(l, "la ligne du partenaire n'est pas en base");
      assert.deepEqual(
        { libelle: l.libelle, quantite: Number(l.quantite), unite: l.unite, pu: Number(l.prix_unitaire), montant: Number(l.montant) },
        { libelle: `Main d’œuvre : ${morin}`, quantite: 3, unite: "jour", pu: 456, montant: 1368 }
      );
    });

    await cas("un partenaire à l'heure : la quantité se tape, et SA marge passe avant", async () => {
      await ouvrir();
      await page.click('[data-atlas="mo-partenaires"]');
      await page.click(`[data-atlas="mo-prix-${prixElagage}"]`);
      await page.fill('[data-atlas="mo-quantite"]', "6,5");
      assert.equal(await texte('[data-atlas="mo-calcul"]'), "6,5 heures × 60 € × 1,35");
      assert.match(await texte('[data-atlas="mo-total"]'), /^526,50 €/);
      await page.click('[data-atlas="mo-valider"]');
      const l = (await quandIlYEnA(3))[2];
      assert.ok(l, "la ligne à l'heure n'est pas en base");
      assert.deepEqual(
        { quantite: Number(l.quantite), unite: l.unite, pu: Number(l.prix_unitaire), montant: Number(l.montant) },
        { quantite: 6.5, unite: "h", pu: 81, montant: 526.5 }
      );
    });

    await cas("la croix ramène à son équipe, et un tarif effacé arrive À CHIFFRER, jamais à zéro", async () => {
      await ouvrir();
      await page.click('[data-atlas="mo-partenaires"]');
      await page.click(`[data-atlas="mo-prix-${prixFaience}"]`);
      await page.click('[data-atlas="mo-revenir"]');
      await page.locator('[data-atlas="mo-tarif"]').waitFor();
      await page.fill('[data-atlas="mo-tarif"]', "");
      assert.equal(await texte('[data-atlas="mo-total"]'), "à chiffrer");
      await page.click('[data-atlas="mo-valider"]');
      const l = (await quandIlYEnA(4))[3];
      assert.ok(l, "la ligne à chiffrer n'est pas en base");
      assert.equal(l.a_chiffrer, true, "une main d'œuvre sans prix ne retient pas le devis");
      assert.equal(Number(l.montant), 0);
    });

    // ── RÉPARTIE SUR LES TRAVAUX — la même feuille, l'autre choix ───────────
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `M. Reparti ${marque}`);
    const url2 = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
    const chantier2 = url2.split("/").pop()!;
    await page.goto(`${url2}/devis-complet`, { waitUntil: "networkidle" });
    const travaux = [
      ["Taille de la haie", "2", "100"],
      ["Broyage des branches", "1", "180"],
    ];
    for (const [rang, [libelle, qte, pu]] of travaux.entries()) {
      const zones = page.locator('textarea[aria-label*="escription"]');
      if ((await zones.count()) <= rang) await page.click('button:has-text("Ajouter une ligne")');
      for (const essai of [1, 2, 3, 4, 5]) {
        if ((await zones.count()) > rang) break;
        await page.waitForTimeout(essai * 300);
      }
      await zones.nth(rang).fill(libelle);
      await page.locator('input[aria-label*="Quantité"]').nth(rang).fill(qte);
      await page.locator('input[aria-label*="Prix unitaire"]').nth(rang).fill(pu);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
    }
    for (const essai of [1, 2, 3, 4]) {
      await page.goto(`${url2}/devis-complet`, { waitUntil: "networkidle" });
      if ((await page.locator("body").innerText()).includes("380,00")) break;
      await page.waitForTimeout(essai * 500);
    }
    const lignes2 = async () =>
      (
        await pool.query(
          `SELECT libelle, quantite::text, prix_unitaire::text, montant::text, part_main_doeuvre::text AS part, main_doeuvre
             FROM lignes_prix WHERE chantier_id = $1 AND libelle <> '' ORDER BY ordre`,
          [chantier2]
        )
      ).rows as { libelle: string; quantite: string; prix_unitaire: string; montant: string; part: string | null; main_doeuvre: boolean }[];

    await cas("répartie : la barre de l'appli s'ouvre dans la feuille, sur les travaux chiffrés", async () => {
      await ouvrir();
      await regler("mo-hommes", "1");
      await regler("mo-duree", "1 journée");
      await page.fill('[data-atlas="mo-tarif"]', "280");
      await page.getByRole("button", { name: "Répartis sur les travaux" }).click();
      await page.locator('[data-atlas="barre-main-oeuvre"]').waitFor();
      const noms = await page.locator('[data-atlas="mo-ou"]').innerText();
      assert.ok(noms.includes("Taille de la haie") && noms.includes("Broyage des branches"), `les travaux manquent :\n${noms}`);
      assert.equal(await texte('[data-atlas="mo-valider"]'), "Répartir la main d’œuvre");
      assert.deepEqual(
        (await lignes2()).map((l) => l.part),
        [null, null],
        "une part posée avant l'appui"
      );
    });

    await cas("chaque travail reçoit sa part DANS son prix, la quantité ne bouge pas, et la base la garde", async () => {
      await page.click('[data-atlas="mo-valider"]');
      let l = await lignes2();
      for (const essai of [1, 2, 3, 4, 5, 6]) {
        if (l.every((x) => x.part !== null)) break;
        await page.waitForTimeout(essai * 500);
        l = await lignes2();
      }
      assert.deepEqual(
        l.map((x) => ({ q: Number(x.quantite), pu: Number(x.prix_unitaire), montant: Number(x.montant), part: Number(x.part), mo: x.main_doeuvre })),
        [
          { q: 2, pu: 170, montant: 340, part: 140, mo: false },
          { q: 1, pu: 320, montant: 320, part: 140, mo: false },
        ]
      );
    });

    await cas("le devis dit la part sous chaque travail, et « dont main d'œuvre HT » la compte", async () => {
      await page.goto(`${url2}/devis-complet`, { waitUntil: "networkidle" });
      const parts = await page.locator('[data-atlas="part-main-doeuvre"]').allInnerTexts();
      assert.deepEqual(
        parts.map((p) => p.replace(/\s+/g, " ")),
        ["dont 140,00 € de main d’œuvre", "dont 140,00 € de main d’œuvre"]
      );
      const totaux = (await page.locator("section").filter({ hasText: "Total TTC" }).last().innerText()).replace(/\s+/g, " ");
      assert.ok(totaux.includes("660,00"), `le total HT n'a pas pris la main d'œuvre :\n${totaux}`);
      assert.match(totaux, /dont main d’œuvre HT/);
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').inputValue(), "280", "« dont » ne compte pas la main d'œuvre répartie");
    });
  } finally {
    await contexte.close();
    await navigateur.close();
    await pool.query(`DELETE FROM prix_achat WHERE id = ANY($1)`, [[prixFaience, prixElagage]]);
    await pool.query(`DELETE FROM societes_achat WHERE id = ANY($1)`, [[idMorin, idDurand]]);
    await pool.query(`UPDATE marges_achat SET main_oeuvre = $2 WHERE entreprise_id = $1`, [ent, margeAvant?.main_oeuvre ?? null]);
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La feuille de la main d'œuvre — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
