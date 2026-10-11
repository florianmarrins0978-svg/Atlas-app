import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { fermerLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { pool } from "../src/server/db/client";
import { jourDuPatron } from "./_jour-e2e";
import { ADRESSE } from "./_adresse";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi } from "../src/server/repositories/envois-devis";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { ajouterJours, versJourIso } from "../src/lib/disponibilites";

// ═════════════════════════════════════════════════════════════════════════════
// UN DEVIS EXPIRÉ QUI REVIENT — ses planches du 7 octobre 2026
// (`appli/devis-expires.html`, `appli/relancer-un-devis-expire.html`).
//
// 45 jours sans réponse, le lien est mort. Il tombait dans « Sans date », d'où
// il se posait sans aucune signature. Cette suite joue SON chemin : le tiroir
// le range à part, « Ajouter » d'un jour a sa porte « Devis expiré », et les
// trois gestes (poser sans renvoyer, renvoyer par un lien neuf, relire)
// mènent où il faut. La règle pure est tenue par `test-etat-envoi.ts`, la
// relecture aux prix du jour par `test-reprise-du-devis-db.ts`.
// ═════════════════════════════════════════════════════════════════════════════

const BASE = ADRESSE;
const ECRAN_DU_PATRON = devices["iPhone 13"];

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Un devis expiré qui revient ===\n");

  const [moi] = (
    await pool.query(
      `SELECT m.utilisateur_id, m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id
        WHERE u.email = 'demo@atlas.local' AND m.role = 'proprietaire' LIMIT 1`
    )
  ).rows;
  if (!moi) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
  const ctx = { utilisateurId: moi.utilisateur_id as string, entrepriseId: moi.entreprise_id as string };

  /** Un chantier d'une journée dont le devis est parti, sans réponse. */
  const SUFFIXE = Date.now();
  const devisParti = async (nom: string) => {
    const client = await clientsRepo.creerClient(ctx, { nom, telephone: "06 11 22 33 44" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue: "1 jour" });
    // Un devis qui est parti portait des lignes : vide, l'envoi le refuserait.
    await ajouterLignePrix(ctx, chantier.id, "Taille de haie", "300.00", { quantite: "1", prixUnitaire: "300.00" });
    const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const envoi = await creerEnvoi(ctx, {
      chantierId: chantier.id,
      devisId: devis.id,
      canal: "sms",
      datesProposees: [versJourIso(ajouterJours(new Date(), 45))],
      contenuDevis: nom,
    });
    // **Son lien est mort** : envoyé il y a 50 jours, expiré il y a 5, sans réponse.
    await pool.query(
      `UPDATE envois_devis SET envoye_at = now() - interval '50 days', expire_at = now() - interval '5 days' WHERE id = $1`,
      [envoi.id]
    );
    return { chantierId: chantier.id, jeton: envoi.jeton };
  };
  const SANS = `Mme Ferrand ${SUFFIXE}`;
  const LIEN = `M. Bastide ${SUFFIXE}`;
  const RELU = `Mme Morel ${SUFFIXE}`;
  const ferrand = await devisParti(SANS);
  const bastide = await devisParti(LIEN);
  const morel = await devisParti(RELU);

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  /**
   * Un jour ouvrable entièrement libre, AU-DELÀ de ses 14 jours de
   * rétractation : la case de la demande écrite a son cas à elle, en base.
   */
  const seuil = versJourIso(ajouterJours(new Date(`${jourDuPatron()}T12:00:00Z`), 15));
  const jourLibre = async (sauf?: string): Promise<string> => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await fermerLeTiroirDuPlanning(page);
    const ouvrable = (iso: string) => ![0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
    for (let mois = 0; mois < 5; mois++) {
      if (mois > 0) {
        await page.click('button[aria-label="Mois suivant"]');
        await page.waitForTimeout(150);
      }
      const jours = await page.$$eval('[data-atlas="grille-mois"] [data-jour]', (l) =>
        l.map((e) => ({
          jour: e.getAttribute("data-jour"),
          matin: e.querySelector('[data-demi="matin"]')?.getAttribute("data-etat"),
          apres: e.querySelector('[data-demi="apres_midi"]')?.getAttribute("data-etat"),
        }))
      );
      const libre = jours.find(
        (j) => j.jour && j.jour >= seuil && j.jour !== sauf && ouvrable(j.jour) && j.matin === "libre" && j.apres === "libre"
      );
      if (libre?.jour) return libre.jour;
    }
    throw new Error("aucun jour ouvrable libre au-delà de 14 jours, sur cinq mois");
  };

  const ouvrirLeJour = async (jour: string) => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await fermerLeTiroirDuPlanning(page);
    for (let i = 0; i < 5; i++) {
      if ((await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) > 0) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, { timeout: 15_000 });
    await page.waitForTimeout(400);
    return page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
  };

  const jour = await jourLibre();
  console.log(`  · jour visé : ${jour}`);

  await cas("le tiroir le range dans « Devis expirés », et nulle part ailleurs", async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const tiroir = page.locator('[data-atlas="tiroir-planning"]');
    if ((await page.locator('[data-atlas="poignee-tiroir"]').getAttribute("aria-expanded")) !== "true") {
      await page.locator('[data-atlas="poignee-tiroir"]').click();
      await page.waitForTimeout(500);
    }
    assert.ok((await tiroir.locator('[data-atlas="titre-devis-expires"]').count()) === 1, "pas de catégorie « Devis expirés »");
    assert.ok(
      (await tiroir.locator('[data-atlas="devis-expire"]', { hasText: SANS }).count()) === 1,
      "le devis expiré n'est pas dans sa catégorie"
    );
    assert.equal(await tiroir.locator('[data-atlas="sans-date"]', { hasText: SANS }).count(), 0, "il est aussi dans « Sans date »");
    assert.match(await tiroir.innerText(), /n.est valable que 45 jours/);
  });

  await cas("« Client en attente » ne le propose pas ; « Devis expiré » si", async () => {
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    if ((await carte.locator('[data-atlas="voie-chantier"]').count()) > 0) {
      await carte.locator('[data-atlas="voie-chantier"]').click();
      assert.equal(await carte.locator(`[data-qui="${ferrand.chantierId}"]`).count(), 0, "il se pose encore depuis « Client en attente »");
      await carte.locator('[data-atlas="annuler-ajout"]').click();
    }
    await carte.locator('[data-atlas="voie-expire"]').click();
    assert.equal(await carte.locator(`[data-qui-expire="${ferrand.chantierId}"]`).count(), 1, "la porte « Devis expiré » ne le propose pas");
  });

  await cas("« Le poser sans le renvoyer » le pose, sans « Pas encore signé »", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
    await carte.locator(`[data-qui-expire="${ferrand.chantierId}"]`).click();
    assert.match(await carte.locator('[data-atlas="relance-du-devis"]').innerText(), /a expiré le/);
    await carte.locator('[data-atlas="poser-sans-renvoyer"]').click();
    await page.waitForTimeout(1000);
    const pose = (await pool.query(`SELECT date_planifiee::text AS jour FROM chantiers WHERE id = $1`, [ferrand.chantierId])).rows[0];
    assert.equal(pose?.jour, jour);
    const relue = await ouvrirLeJour(jour);
    assert.equal(
      await relue.locator(`[data-atlas="bloc-chantier"][data-chantier="${ferrand.chantierId}"] [data-atlas="pas-encore-signe"]`).count(),
      0,
      "sa décision : rien n'écrit « Pas encore signé »"
    );
  });

  const jourB = await jourLibre(jour);
  console.log(`  · second jour : ${jourB}`);

  await cas("« Le renvoyer tel quel », par son lien : un lien neuf sur ce seul jour, et l'écran d'envoi", async () => {
    const carte = await ouvrirLeJour(jourB);
    await carte.locator('[data-atlas="ajouter"]').click();
    await carte.locator('[data-atlas="voie-expire"]').click();
    await carte.locator(`[data-qui-expire="${bastide.chantierId}"]`).click();
    await carte.locator('[data-atlas="renvoyer-tel-quel"]').click();
    await carte.locator('[data-atlas="signe-sur-son-lien"]').click();
    // **Un refus se lit, il ne se devine pas** : sans lui, un délai dépassé
    // n'accuserait personne.
    await Promise.race([
      page.waitForURL(new RegExp(`/chantiers/${bastide.chantierId}/export`), { timeout: 30_000 }),
      carte.locator('[data-atlas="refus-du-geste"]').waitFor({ timeout: 30_000 }).then(async () => {
        throw new Error(`refusé : ${await carte.locator('[data-atlas="refus-du-geste"]').innerText()}`);
      }),
    ]);
    const neuf = (
      await pool.query(
        `SELECT dates_proposees::text[] AS dates, autre_date_autorisee, dates_fixees_par_artisan, reponse, expire_at > now() AS vivant
           FROM envois_devis WHERE chantier_id = $1 ORDER BY envoye_at DESC LIMIT 1`,
        [bastide.chantierId]
      )
    ).rows[0];
    assert.deepEqual(neuf.dates, [jourB]);
    assert.equal(neuf.autre_date_autorisee, false);
    assert.equal(neuf.dates_fixees_par_artisan, true);
    assert.equal(neuf.reponse, null, "renvoyer a valu accord");
    assert.equal(neuf.vivant, true);
    const pose = (await pool.query(`SELECT date_planifiee::text AS jour FROM chantiers WHERE id = $1`, [bastide.chantierId])).rows[0];
    assert.equal(pose?.jour, jourB);
  });

  await cas("« Relire le devis » ouvre le devis, et « Continuer » ramène à sa signature, sur ce jour", async () => {
    const carte = await ouvrirLeJour(jourB);
    await carte.locator('[data-atlas="ajouter"]').click();
    await carte.locator('[data-atlas="voie-expire"]').click();
    await carte.locator(`[data-qui-expire="${morel.chantierId}"]`).click();
    await carte.locator('[data-atlas="relire-le-devis"]').click();
    await page.waitForURL(new RegExp(`/chantiers/${morel.chantierId}/devis-complet\\?relance=${jourB}`), { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForURL(/\/planning/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    const retour = page.locator(`[data-atlas="carte-jour"][data-jour="${jourB}"]`);
    await retour.locator('[data-atlas="signe-sur-son-lien"]').waitFor({ timeout: 15_000 });
    assert.match(await retour.innerText(), new RegExp(`${RELU} n.a pas encore signé`));
  });

  // **On rend la base comme on l'a trouvée** : ces chantiers occupent des
  // jours que les autres suites cherchent libres (`CLAUDE.md` §5).
  for (const id of [ferrand.chantierId, bastide.chantierId, morel.chantierId]) {
    await pool.query(`DELETE FROM creneaux_chantier WHERE chantier_id = $1`, [id]);
    await pool.query(
      `UPDATE chantiers SET date_planifiee = NULL, creneau_debut = NULL, deleted_at = now() WHERE id = $1`,
      [id]
    );
  }

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ Devis expiré : ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Un devis expiré se range à part, se supprime, et se repose par sa porte.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
