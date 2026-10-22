import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { ajouterPrestation as ajouterPrestationEntretien } from "../src/server/repositories/prestations-entretien";
import {
  ouvrirPassage,
  lirePassage,
  cocherLigne,
  nommerClient,
  figerPassage,
} from "../src/server/repositories/passages-entretien";

// « Tout télécharger » sur la fiche d'un client — sa demande du 22 octobre
// 2026, planche `appli/telecharger-un-client.html`, réponse « la A, et tout en
// PDF ».
//
// **Le geste du patron, de bout en bout** (`CLAUDE.md` §5 quater) : il ouvre la
// fiche, appuie, et reçoit un fichier. Ce qu'on vérifie est ce qu'il ouvrira
// dans l'app Fichiers : un zip que `unzip` accepte, un dossier par onglet, et
// des PDF qui sont des PDF. Un fichier de zéro pièce ne prouverait rien : le
// montage pose un devis, une facture et un compte rendu, et la suite refuse
// de conclure s'il en manque un.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

async function main() {
  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me JOIN users us ON us.id = me.utilisateur_id
      WHERE us.email = 'demo@atlas.local' AND me.role = 'proprietaire' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const ctx = { utilisateurId: rows[0].u as string, entrepriseId: rows[0].e as string };

  const nomClient = `M. Dossier ${Date.now()}`;
  const client = await creerClient(ctx, { nom: nomClient });
  const c = await creerChantier(ctx, { nom: "Taille de haie", clientId: client.id });
  await ajouterLignePrix(ctx, c.id, "Taille de haie de laurier", "340.00");
  const d = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, d.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);

  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
  const ouvert = await ouvrirPassage(ctx, "2026-07-04");
  assert.ok(ouvert.ok, "la fiche d'entretien n'a pas pu s'ouvrir");
  const passage = await lirePassage(ctx, ouvert.id);
  await cocherLigne(ctx, ouvert.id, passage!.lignes[0].id, true);
  await nommerClient(ctx, ouvert.id, client.id);
  const fige = await figerPassage(ctx, ouvert.id);
  assert.ok(fige.ok, "la fiche d'entretien n'est pas partie");

  const navigateur = await lancerNavigateur();
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-dossier-client-"));
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  const page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

    await page.goto(`${BASE}/clients/${client.id}`, { waitUntil: "networkidle" });
    const bouton = page.locator('[data-atlas="tout-telecharger"]');
    assert.ok(await bouton.isVisible(), "« Tout télécharger » est absent de la fiche du client");

    // **Sous « Modifier ses coordonnées »**, la place qu'il a choisie (A).
    const yCoord = (await page.locator('[data-atlas="modifier-le-client"]').boundingBox())?.y ?? 0;
    const yBouton = (await bouton.boundingBox())?.y ?? 0;
    assert.ok(yCoord > 0 && yBouton > yCoord, `le bouton n'est pas sous « Modifier ses coordonnées » (${yCoord}, ${yBouton})`);

    const nomSurLeLien = await bouton.getAttribute("download");
    assert.match(nomSurLeLien ?? "", /^M\. Dossier \d+, \d+(er)? \S+ \d{4}\.zip$/, `le lien annonce « ${nomSurLeLien} »`);

    const attente = page.waitForEvent("download", { timeout: 60_000 });
    await bouton.click();
    const telechargement = await attente;
    assert.match(telechargement.suggestedFilename(), /\.zip$/, `nom proposé : « ${telechargement.suggestedFilename()} »`);

    const archive = path.join(dossier, "dossier.zip");
    await telechargement.saveAs(archive);
    const controle = execFileSync("unzip", ["-t", archive]).toString();
    assert.match(controle, /No errors detected/, `unzip refuse l'archive :\n${controle}`);
    execFileSync("unzip", ["-q", archive, "-d", path.join(dossier, "sortie")]);

    // **Le séparateur du système**, ramené à « / » : sous Windows, readdirSync
    // rend « Devis\x.pdf » pour une archive qui porte « Devis/x.pdf ».
    const chemins = readdirSync(path.join(dossier, "sortie"), { recursive: true })
      .map((c) => String(c).split(path.sep).join("/"))
      .filter((c) => c.endsWith(".pdf"))
      .sort();
    for (const onglet of ["Devis/", "Factures/", "Fiches/"]) {
      assert.ok(chemins.some((c) => c.startsWith(onglet)), `rien dans « ${onglet} » : ${chemins.join(", ")}`);
    }
    for (const c of chemins) {
      const tete = readFileSync(path.join(dossier, "sortie", c)).subarray(0, 5).toString("latin1");
      assert.equal(tete, "%PDF-", `« ${c} » n'est pas un PDF`);
    }
    const absents = readdirSync(path.join(dossier, "sortie")).includes("A lire.txt");
    assert.ok(!absents, "une pièce manque au dossier alors que toutes viennent d'être archivées");

    console.log(`✅ Dossier téléchargé et ouvert : ${chemins.join(", ")}`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
    await navigateur.close();
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
