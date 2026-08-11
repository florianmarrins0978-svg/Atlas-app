import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { lancerNavigateur } from "./e2e-browser";

// Le parcours entier du patron, du bouton au fichier ouvert.
//
// **Pourquoi une suite navigateur et pas un appel HTTP.** Ce qui a coûté cher
// dans ce dépôt, ce sont trois livraisons « prêtes » dont personne n'avait
// parcouru le chemin réel : un script absent, une adresse ouverte trop tôt, un
// port fermé. « La fonction rend les bonnes lignes » ne dit rien de ce qui
// arrive quand il appuie. On appuie donc pour de bon, on récupère le fichier
// que son téléphone recevrait, et on l'ouvre avec l'outil du système.
//
// Ce que cette suite attraperait et qu'aucune autre ne verrait : un lien qui
// mène à une page d'erreur, une archive illisible, un en-tête qui ferait
// afficher le ZIP dans l'onglet au lieu de le télécharger, une sauvegarde vide.

async function main() {
  const browser = await lancerNavigateur();
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-mes-donnees-"));
  const context = await browser.newContext({
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

    await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });

    const bouton = page.locator("text=Télécharger mes données");
    assert.ok(await bouton.isVisible(), "Le bouton « Télécharger mes données » est absent de Réglages.");

    // **Le nom doit être porté par le LIEN, pas seulement par l'en-tête.**
    //
    // Ce contrôle manquait, et son absence a coûté une sauvegarde inutilisable.
    // Le 7 août 2026, sur un iPhone, Safari a proposé au patron un fichier nommé
    // « reglages », sans extension — le nom de la page. L'archive était pourtant
    // complète et `Content-Disposition` correct : un attribut `download` vide
    // laisse Safari se rabattre sur le document courant. Le fichier arrivait
    // dans Fichiers sans extension, donc impossible à ouvrir.
    //
    // Chrome, lui, lit l'en-tête — d'où un `suggestedFilename()` juste (vérifié
    // plus bas) sur un lien pourtant muet. Contrôler l'un ne contrôle pas
    // l'autre.
    const nomSurLeLien = await page.getAttribute('a[href="/api/mes-donnees"]', "download");
    assert.match(
      nomSurLeLien ?? "",
      /^atlas-.+-\d{4}-\d{2}-\d{2}\.zip$/,
      `Le lien annonce « ${nomSurLeLien ?? "(rien)"} » : sur iPhone, la sauvegarde arrivera sous le nom de la page, sans extension, et ne s'ouvrira pas.`
    );

    // --- Le geste, et le fichier qui en sort -------------------------------
    const attenteTelechargement = page.waitForEvent("download", { timeout: 60000 });
    await bouton.click();
    const telechargement = await attenteTelechargement;

    const nomPropose = telechargement.suggestedFilename();
    assert.match(
      nomPropose,
      /^atlas-.+-\d{4}-\d{2}-\d{2}\.zip$/,
      `Le fichier arrive sous un nom que le patron ne reconnaîtra pas : « ${nomPropose} ».`
    );

    const archive = path.join(dossier, "sauvegarde.zip");
    await telechargement.saveAs(archive);
    const taille = readFileSync(archive).length;
    assert.ok(taille > 0, "L'archive téléchargée est vide.");

    // --- Elle s'ouvre avec l'outil du système, pas avec le nôtre -----------
    const controle = execFileSync("unzip", ["-t", archive]).toString();
    assert.match(controle, /No errors detected/, `unzip refuse l'archive :\n${controle}`);

    execFileSync("unzip", ["-q", archive, "-d", path.join(dossier, "sortie")]);

    const modeEmploi = readFileSync(path.join(dossier, "sortie", "LISEZ-MOI.txt"), "utf8");
    assert.match(modeEmploi, /SAUVEGARDE ATLAS/, "Le mode d'emploi manque ou ne se présente pas.");
    assert.match(
      modeEmploi,
      /CE QU'IL CONTIENT DE SENSIBLE/,
      "L'avertissement sur les coordonnées des clients a disparu du mode d'emploi."
    );

    const brut = readFileSync(path.join(dossier, "sortie", "donnees.json"), "utf8");
    const donnees = JSON.parse(brut) as {
      versionFormat: number;
      exporteLe: string;
      tables: Record<string, unknown[]>;
      compte: Record<string, number>;
    };

    assert.equal(donnees.versionFormat, 1);
    assert.ok(Date.parse(donnees.exporteLe) > 0, "La date d'export n'est pas une date.");

    // Le jeu de démonstration porte au moins une entreprise et un chantier :
    // une archive syntaxiquement valable mais vide de tout serait le pire des
    // résultats, puisqu'elle rassurerait à tort.
    assert.equal(donnees.compte.entreprises, 1, "La fiche de l'entreprise manque à la sauvegarde.");
    assert.ok(donnees.compte.chantiers > 0, "Aucun chantier dans la sauvegarde du compte de démonstration.");
    assert.ok(Array.isArray(donnees.tables.clients), "La table des clients n'est pas là.");

    // Ce qui ne doit jamais s'y trouver — le contrôle vaut pour le fichier
    // entier, seul objet que le patron enverra réellement.
    assert.ok(!("users" in donnees.tables), "Les comptes de connexion sont dans la sauvegarde.");
    assert.doesNotMatch(brut, /passwordHash|password_hash/, "Une empreinte de mot de passe est dans la sauvegarde.");

    console.log(`✅ Sauvegarde téléchargée (${taille} octets), ouverte, et conforme.`);
    console.log(`   ${Object.entries(donnees.compte).filter(([, n]) => n > 0).map(([t, n]) => `${t}=${n}`).join(", ")}`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
