// Ajouter une photo depuis la FICHE, sans changer d'écran.
//
// **Le geste du patron, le 11 août 2026 :** *« quand je clique sur l'encadré
// avec le plus là des photos, ça me ramène encore sur cette page-là. »* Sa case
// « + » était un simple lien vers l'écran Photos : il fallait donc changer
// d'écran, puis appuyer sur un second bouton, pour prendre une photo depuis la
// fiche du chantier.
//
// Ce contrôle éprouve le PARCOURS, pas la règle : que la case ouvre le choix
// sur place, que la photo choisie parte, qu'elle apparaisse dans la pellicule
// sans recharger, et **qu'on soit resté sur la fiche**. Une suite qui vérifie
// seulement « la photo est en base » aurait été verte avec l'ancien lien.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

// Un PNG d'un pixel, écrit ici plutôt que lu sur le disque : une suite qui
// dépend d'un fichier d'exemple casse le jour où quelqu'un range le dossier.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`✅ ${nom}`);
  } else {
    echecs++;
    console.log(`❌ ${nom}${detail ? `\n   ${detail}` : ""}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nom = `Photo depuis la fiche ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nom);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const ficheUrl = page.url();

  // Le tiroir s'ouvre : au repos, seule la prise dépasse et la pellicule est
  // hors d'atteinte du doigt.
  await page.click('[data-atlas="tiroir-fiche"] button[aria-expanded]');
  await page.waitForTimeout(700);

  const plus = page.locator('a[aria-label="Ajouter des photos"]');
  verifier("la case « + » est là, dans la pellicule", (await plus.count()) === 1);

  // **Le cœur du contrôle.** Un appui ordinaire ne doit PAS naviguer : il ouvre
  // le choix sur place. C'est précisément ce qui manquait.
  await plus.click();
  await page.waitForTimeout(500);
  verifier(
    "un appui sur « + » ne quitte pas la fiche",
    page.url() === ficheUrl,
    `on s'est retrouvé sur ${page.url()}`
  );
  verifier(
    "le choix « prendre / choisir » s'ouvre sur place",
    await page.locator('button:has-text("Prendre une photo")').isVisible()
  );

  // On passe par le champ de la photothèque : celui de l'appareil photo ouvre
  // une caméra qu'aucun navigateur d'essai ne possède.
  await page.setInputFiles('input[aria-label="Choisir dans mes photos"]', {
    name: "chantier.png",
    mimeType: "image/png",
    buffer: PIXEL,
  });
  await page.waitForTimeout(2500);

  verifier("on est TOUJOURS sur la fiche après l'envoi", page.url() === ficheUrl, `on est sur ${page.url()}`);

  const vignettes = page.locator('a[aria-label^="Photo "]');
  verifier(
    "la photo apparaît dans la pellicule, sans recharger",
    (await vignettes.count()) === 1,
    `${await vignettes.count()} vignette(s) au lieu d'une`
  );

  // Et elle est bien ENREGISTRÉE, pas seulement affichée : un ajout qui ne
  // survit pas au rechargement est un ajout qui n'a pas eu lieu.
  await page.reload({ waitUntil: "networkidle" });
  await page.click('[data-atlas="tiroir-fiche"] button[aria-expanded]');
  await page.waitForTimeout(700);
  verifier(
    "elle est toujours là après rechargement",
    (await page.locator('a[aria-label^="Photo "]').count()) === 1
  );

  // Le lien reste un lien : ouvert dans un nouvel onglet, ou sans JavaScript,
  // il mène à l'écran Photos. C'est la porte de secours, et elle doit tenir.
  verifier(
    "la case « + » reste un lien vers l'écran Photos",
    (await plus.getAttribute("href")) === `${new URL(ficheUrl).pathname}/photos`
  );

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Ajouter une photo depuis la fiche — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
