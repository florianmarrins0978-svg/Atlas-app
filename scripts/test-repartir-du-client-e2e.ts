import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// Repartir d'un client — PAR SON PARCOURS À LUI, pas par les fonctions.
//
// **CE QUE CETTE SUITE TIENT, ET QUE LES AUTRES NE VOIENT PAS.** La règle des
// prix est éprouvée à part, sans base (`test-reprise-des-prix.ts`), et elle
// resterait verte même si aucun bouton n'existait sur la fiche du client — le
// défaut du 28 août 2026, six gestes livrés verts et aucun atteignable
// (`CLAUDE.md` §5 quater).
//
// Ici on part de là où LE PATRON part : la fiche d'un client, et on touche
// les deux boutons.
//
// Sa décision du 8 septembre 2026 : *« il faut la E car si c'est un client déjà
// enregistré en tant que client on ne va pas recréer une fiche client ! »*, et
// *« si on clique sur refaire il faut que ça se mette au prix d'aujourd'hui »*.

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
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Un patronyme unique par exécution : la base n'est pas vidée entre deux
  // passages, et un homonyme laissé par la précédente fausserait le compte.
  const nom = `Roussel ${Date.now()}`;

  // ── Un premier chantier chez lui, avec une ligne de prix ────────────────
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  const premier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });

  // La ligne est posée en base plutôt qu'à l'écran : ce que cette suite éprouve
  // est la REPRISE, pas la saisie d'un devis, qui a ses propres suites.
  const { rows: infoChantier } = await pool.query(
    `SELECT entreprise_id, client_id FROM chantiers WHERE id = $1`,
    [premier]
  );
  assert.equal(infoChantier.length, 1, "le premier chantier n'est pas en base");
  const entrepriseId = infoChantier[0].entreprise_id as string;
  const clientId = infoChantier[0].client_id as string;
  assert.ok(clientId, "le premier chantier n'a pas de client rattaché");

  // Un tarif à SON nom, et une ligne posée SOUS ce tarif : c'est ce couple qui
  // permet de voir la retarification.
  const intitule = `Taille de haie ${Date.now()}`;
  await pool.query(
    `INSERT INTO tarifs (entreprise_id, intitule, prix, unite) VALUES ($1, $2, '17.50', 'ml')`,
    [entrepriseId, intitule]
  );
  await pool.query(
    `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant, unite, ordre)
     VALUES ($1, $2, $3, '40', '17.50', '700.00', 'ml', 0)`,
    [entrepriseId, premier, intitule]
  );
  // Une ligne chiffrée À LA MAIN, qu'aucun tarif ne porte : c'est le cas
  // ordinaire, et c'est celui qu'un zèle mal placé transformerait en « à
  // chiffrer », obligeant à ressaisir presque tout le devis.
  await pool.query(
    `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant, ordre)
     VALUES ($1, $2, 'Traitement anti-mousse', '1', '120.00', '120.00', 1)`,
    [entrepriseId, premier]
  );

  // ── LE CHANTIER EST TERMINÉ : sans ça, « Refaire » n'existe pas ─────────
  //
  // **Cette suite jouait un cas impossible, et c'est elle qui avait tort.**
  // Elle visitait la fiche d'un client dont le chantier venait de naître, et
  // réclamait « Refaire ». Or la fiche ne connaît « la dernière fois » que
  // pour un chantier TERMINÉ (`fiche-client.ts`) — une règle apprise à l'écran
  // le 3 septembre : un chantier créé le matin même porte la date du jour, et
  // s'annonçait comme une prestation où personne n'était encore allé.
  //
  // Le bouton se tient sous ce bloc et parle de lui : le montrer sans lui
  // aurait proposé de refaire un travail qui n'a pas eu lieu.
  //
  // La fin de chantier se pose ici en base plutôt qu'à l'écran : `terminer`
  // exige un devis parti et CRÉE la facture — tout un cycle comptable, qui a
  // ses propres suites. Ce qu'on éprouve ici commence APRÈS.
  await pool.query(`UPDATE chantiers SET termine_at = now() WHERE id = $1`, [premier]);

  // ── LE TARIF MONTE, entre les deux chantiers ────────────────────────────
  await pool.query(`UPDATE tarifs SET prix = '18.20' WHERE entreprise_id = $1 AND intitule = $2`, [
    entrepriseId,
    intitule,
  ]);

  // ── Sa fiche porte-t-elle les deux gestes ? ─────────────────────────────
  await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });

  await cas("la fiche du client offre « Refaire » et « Autre chantier »", async () => {
    await assert.doesNotReject(
      page.getByRole("button", { name: "Refaire" }).waitFor({ state: "visible", timeout: 10_000 }),
      "le bouton « Refaire » n'est pas sur la fiche du client"
    );
    await assert.doesNotReject(
      page
        .getByRole("button", { name: "Autre chantier" })
        .waitFor({ state: "visible", timeout: 10_000 }),
      "le bouton « Autre chantier » n'est pas sur la fiche du client"
    );
  });

  // ── « Refaire » : la VRAIE page du devis, aux prix d'aujourd'hui ────────
  let refait: string | null = null;

  await cas("« Refaire » ouvre la VRAIE page du devis, pas un récapitulatif", async () => {
    await page.getByRole("button", { name: "Refaire" }).click();
    // Sa règle du 8 septembre : *« si l'utilisateur veut rajouter des lignes,
    // modifier des prix, rajouter une TVA ou faire un prix au client, il peut
    // le faire qu'à partir de la page devis la vraie ! »*
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 20_000 });
    refait = page.url().match(/chantiers\/([0-9a-f-]{36})/)?.[1] ?? null;
    assert.ok(refait, "l'adresse ne porte pas d'identifiant de chantier");
    assert.notEqual(refait, premier, "« Refaire » a rouvert l'ANCIEN chantier au lieu d'en créer un");
  });

  await cas("le chantier refait est chez LE MÊME client — aucune fiche recréée", async () => {
    const { rows } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [refait]);
    assert.equal(rows.length, 1, "le chantier refait n'est pas en base");
    assert.equal(
      rows[0].client_id,
      clientId,
      "le chantier refait porte un AUTRE client : une fiche a été recréée"
    );
    // Et l'on compte les fiches à ce nom : sa crainte exacte, mesurée.
    const { rows: doublons } = await pool.query(
      `SELECT count(*)::int AS n FROM clients WHERE entreprise_id = $1 AND nom = $2 AND deleted_at IS NULL`,
      [entrepriseId, nom]
    );
    assert.equal(doublons[0].n, 1, `il existe ${doublons[0].n} fiches au nom de ${nom}`);
  });

  await cas("le tarif qui a monté est repris à SON prix d'aujourd'hui", async () => {
    const { rows } = await pool.query(
      `SELECT prix_unitaire, montant FROM lignes_prix WHERE chantier_id = $1 AND libelle = $2`,
      [refait, intitule]
    );
    assert.equal(rows.length, 1, "la ligne du tarif n'a pas été reprise");
    assert.equal(Number(rows[0].prix_unitaire), 18.2, "la ligne est repartie à l'ancien prix");
    assert.equal(Number(rows[0].montant), 728, "le montant n'a pas suivi le nouveau prix");
  });

  await cas("la ligne chiffrée à la main GARDE son prix — elle n'est pas effacée", async () => {
    const { rows } = await pool.query(
      `SELECT prix_unitaire, a_chiffrer FROM lignes_prix WHERE chantier_id = $1 AND libelle = 'Traitement anti-mousse'`,
      [refait]
    );
    assert.equal(rows.length, 1, "la ligne sans tarif n'a pas été reprise");
    assert.equal(Number(rows[0].prix_unitaire), 120, "son prix a été perdu");
    assert.equal(rows[0].a_chiffrer, false, "elle a été marquée « à chiffrer » sans raison");
  });

  await cas("la quantité relevée sur le chantier n'a pas bougé", async () => {
    const { rows } = await pool.query(
      `SELECT quantite FROM lignes_prix WHERE chantier_id = $1 AND libelle = $2`,
      [refait, intitule]
    );
    assert.equal(Number(rows[0].quantite), 40, "la quantité a été recalculée");
  });

  // ── « Autre chantier » : ses coordonnées déjà posées ────────────────────
  await cas("« Autre chantier » ouvre la fiche client avec son nom déjà écrit", async () => {
    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Autre chantier" }).click();
    await page.waitForURL(/\/chantiers\/nouveau\?client=/, { timeout: 20_000 });
    const saisi = await page.inputValue('input[placeholder="Bernard"]');
    assert.equal(saisi, nom, `la case du nom porte « ${saisi} » au lieu de « ${nom} »`);
  });

  // **L'anneau de dictée doit être là**, c'est le point de sa phrase : *« c'est
  // exactement la page fiche client qui doit apparaître avec la note vocale
  // verte ! »* Un écran de coordonnées sans l'anneau ne serait pas cette page.
  await cas("la note vocale est bien sur cet écran", async () => {
    const anneau = page.locator('[data-atlas="anneau-note-vocale"], [data-atlas="dictee-envoyer"], .atlas-dictee');
    assert.ok(
      (await anneau.count()) > 0,
      "aucun objet de dictée sur l'écran ouvert par « Autre chantier »"
    );
  });

  await cas("aucun chantier fantôme n'est né du simple appui", async () => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM chantiers WHERE client_id = $1 AND deleted_at IS NULL`,
      [clientId]
    );
    // Le premier, et celui de « Refaire ». Pas un troisième : « Autre chantier »
    // ne crée qu'au premier geste réel (`assurerChantier`).
    assert.equal(rows[0].n, 2, `${rows[0].n} chantiers chez ce client au lieu de 2`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Repartir d'un client — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
