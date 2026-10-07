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
import { ajouterJours, versJourIso } from "../src/lib/disponibilites";

// ═════════════════════════════════════════════════════════════════════════════
// POSER UN CLIENT À SA PLACE — son choix B du 7 octobre 2026.
//
// *« Si j'envoie un devis à un client, que c'est une personne âgée et qu'elle
// n'arrive pas à choisir ses dates via mon lien, est-ce que du planning, en
// faisant ajouter un chantier, je peux reprendre le client avec le devis ? »*
//
// Ce n'était pas possible : le planning le rangeait « en attente du client »,
// sans aucun geste. Cette suite joue SON chemin à lui, pas une porte de
// service (`CLAUDE.md` §5 quater) : un jour, « Ajouter », « Client en
// attente », le nom, puis comment il signera. Et le chemin de la cliente
// ensuite, sur son lien, sans compte.
//
// Les règles de fond (rien ne se déplace, papier, 14 jours, isolation) sont
// tenues sous la RLS par `test-pose-a-sa-place-db.ts`. Ici : que le geste
// existe à l'écran, et que les deux écrans disent la même chose.
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
  console.log("=== Poser un client à sa place ===\n");

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
    const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const envoi = await creerEnvoi(ctx, {
      chantierId: chantier.id,
      devisId: devis.id,
      canal: "sms",
      datesProposees: [versJourIso(ajouterJours(new Date(), 45))],
      contenuDevis: nom,
    });
    return { chantierId: chantier.id, jeton: envoi.jeton };
  };
  const LIEN = `Mme Roux ${SUFFIXE}`;
  const PAPIER = `M. Fauvel ${SUFFIXE}`;
  const roux = await devisParti(LIEN);
  const fauvel = await devisParti(PAPIER);

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

  await cas("« Client en attente » propose le client dont le devis est parti", async () => {
    const carte = await ouvrirLeJour(jour);
    await carte.locator('[data-atlas="ajouter"]').click();
    await carte.locator('[data-atlas="voie-chantier"]').click();
    const nom = carte.locator(`[data-qui-lien="${roux.chantierId}"]`);
    assert.equal(await nom.count(), 1, "le client n'est pas proposé");
    assert.match(await nom.innerText(), /devis envoyé/);
  });

  await cas("« Signe sur son lien » le pose, et le planning écrit « Pas encore signé »", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
    await carte.locator(`[data-qui-lien="${roux.chantierId}"]`).click();
    await carte.locator('[data-atlas="signe-sur-son-lien"]').click();
    await page.waitForTimeout(800);
    const pose = (
      await pool.query(`SELECT date_planifiee::text AS jour FROM chantiers WHERE id = $1`, [roux.chantierId])
    ).rows[0];
    assert.equal(pose?.jour, jour, `le chantier n'est pas posé sur ce jour (${pose?.jour})`);
    const envoi = (
      await pool.query(`SELECT reponse, dates_fixees_par_artisan FROM envois_devis WHERE chantier_id = $1`, [roux.chantierId])
    ).rows[0];
    assert.equal(envoi.reponse, null, "poser a valu accord");
    assert.equal(envoi.dates_fixees_par_artisan, true);
    const relue = await ouvrirLeJour(jour);
    assert.ok((await relue.locator('[data-atlas="pas-encore-signe"]').count()) >= 1, "« Pas encore signé » n'est pas écrit");
  });

  const client = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const sienne = await client.newPage();

  await cas("son lien ne lui fait plus choisir : il dit le jour, et elle accepte", async () => {
    await sienne.goto(`${BASE}/devis/${roux.jeton}`, { waitUntil: "networkidle" });
    const jours = sienne.locator('[data-atlas="jours-fixes"]');
    assert.equal(await jours.count(), 1, "le jour posé n'est pas écrit");
    assert.equal(await sienne.locator('input[type="radio"][name="choixDate"]').count(), 0, "des dates s'offrent encore");
    await sienne.getByRole("button", { name: "J'accepte ce devis" }).click();
    await sienne.waitForSelector("text=C'est noté", { timeout: 15_000 });
    const envoi = (
      await pool.query(`SELECT reponse, date_retenue::text AS jour FROM envois_devis WHERE chantier_id = $1`, [roux.chantierId])
    ).rows[0];
    assert.equal(envoi.reponse, "acceptee");
    assert.equal(envoi.jour, jour);
  });

  await cas("une fois signé, « Pas encore signé » s'efface du planning", async () => {
    const carte = await ouvrirLeJour(jour);
    assert.equal(await carte.locator('[data-atlas="pas-encore-signe"]').count(), 0);
  });

  const jourB = await jourLibre(jour);
  console.log(`  · second jour : ${jourB}`);

  await cas("« Signé sur papier » le pose accepté, et son lien est fermé", async () => {
    const carte = await ouvrirLeJour(jourB);
    await carte.locator('[data-atlas="ajouter"]').click();
    await carte.locator('[data-atlas="voie-chantier"]').click();
    await carte.locator(`[data-qui-lien="${fauvel.chantierId}"]`).click();
    await carte.locator('[data-atlas="signe-sur-papier"]').click();
    await page.waitForTimeout(800);
    const envoi = (
      await pool.query(
        `SELECT reponse, accord_sur_papier, vu_par_patron_at IS NOT NULL AS vu FROM envois_devis WHERE chantier_id = $1`,
        [fauvel.chantierId]
      )
    ).rows[0];
    assert.equal(envoi.reponse, "acceptee");
    assert.equal(envoi.accord_sur_papier, true);
    assert.equal(envoi.vu, true);
    const relue = await ouvrirLeJour(jourB);
    assert.equal(await relue.locator('[data-atlas="pas-encore-signe"]').count(), 0, "un accord papier se lit « pas signé »");
    await sienne.goto(`${BASE}/devis/${fauvel.jeton}`, { waitUntil: "networkidle" });
    assert.ok((await sienne.locator("text=Devis accepté").count()) >= 1, "son lien attend encore une réponse");
  });

  // **On rend la base comme on l'a trouvée** : ces deux chantiers occupent des
  // jours que les autres suites cherchent libres (`CLAUDE.md` §5).
  for (const id of [roux.chantierId, fauvel.chantierId]) {
    await pool.query(`DELETE FROM creneaux_chantier WHERE chantier_id = $1`, [id]);
    await pool.query(
      `UPDATE chantiers SET date_planifiee = NULL, creneau_debut = NULL, deleted_at = now() WHERE id = $1`,
      [id]
    );
  }

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ Poser à sa place : ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Un client qui n'arrive pas à choisir se pose à sa place, et son lien le suit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
