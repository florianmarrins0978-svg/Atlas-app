import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { arriverAFroid } from "./_arriver-a-froid";
import { ADRESSE } from "./_adresse";

// **« Le bouton retour doit marcher comme un vrai bouton marche arrière. »**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 9 septembre 2026, capture à l'appui : *« j'ai cliqué sur ouvrir
// le devis, une fois sur le devis je clique sur retour, j'arrive sur la page de
// la fiche client — or le bouton retour […] doit toujours renvoyer à la page
// d'où l'on vient juste avant. »*
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE TIENT, ET QUE LA SUITE PURE NE PEUT PAS VOIR.**
// `test-journal-de-navigation.ts` éprouve la règle ; ici on éprouve qu'elle est
// BRANCHÉE — que le journal se tient pour de bon dans le navigateur, et que la
// flèche le lit. C'est la leçon du 28 août 2026 (`CLAUDE.md` §5 quater) : six
// gestes livrés avec leurs contrôles verts, et aucun atteignable.
//
// **Et les DEUX moitiés comptent** : la page d'avant quand il y en a une, et la
// sortie déclarée de l'écran quand il n'y en a pas. La seconde est sa règle du
// 31 août 2026, et elle ne cesse pas d'exister parce qu'un journal la couvre le
// reste du temps.

const BASE = ADRESSE;

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

const chemin = (url: string) => new URL(url).pathname;

async function main() {
  console.log("=== La flèche ramène à la page d'où l'on vient ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const chantierId = await creerPuisFiche(page, BASE);
  const devis = `${BASE}/chantiers/${chantierId}/devis-complet`;
  const fleche = page.locator('[data-atlas="retour-du-devis"]');

  await cas("SON CAS : venu de l'accueil, le devis renvoie à l'accueil", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    // La flèche rendue par le serveur porte la sortie déclarée : le journal vit
    // dans le navigateur. On attend donc qu'elle se soit corrigée — c'est ce
    // que le patron voit, lui, à la première image.
    await page.waitForFunction(
      () => document.querySelector('[data-atlas="retour-du-devis"]')?.getAttribute("href") === "/",
      undefined,
      { timeout: 15_000 }
    );
    await fleche.click();
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    assert.equal(chemin(page.url()), "/", `la flèche a déposé sur ${page.url()}`);
  });

  await cas("venu de VOS CLIENTS, le même devis renvoie chez les clients", async () => {
    // La même flèche, le même écran, une autre porte : c'est ce qu'aucune
    // destination écrite d'avance ne savait faire — et c'est la raison des cinq
    // signalements (20 août, 31 août, 7, 8 et 9 septembre).
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-atlas="retour-du-devis"]')?.getAttribute("href") ===
        "/clients",
      undefined,
      { timeout: 15_000 }
    );
  });

  await cas("deux retours de suite reculent de deux écrans, sans tourner en rond", async () => {
    // La boucle du 7 septembre 2026 : deux flèches qui se pointaient l'une
    // l'autre, et aucune sortie (`src/lib/retour-du-devis.ts`).
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-atlas="retour-du-devis"]')?.getAttribute("href") ===
        "/clients",
      undefined,
      { timeout: 15_000 }
    );
    await fleche.click();
    await page.waitForURL(/\/clients\/?$/, { timeout: 30_000 });

    const suivante = page.locator('a[aria-label^="Retour"]').first();
    await suivante.waitFor({ state: "visible", timeout: 30_000 });
    await suivante.click();
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    assert.equal(chemin(page.url()), "/", `le second retour a mené à ${page.url()}`);
  });

  await cas("SANS page d'avant, l'écran garde la sortie qu'il déclare", async () => {
    // Sa règle du 31 août 2026 : *« je veux tout le temps revenir à cette page
    // et seulement celle-là ! La page fiche client »*. Elle n'est pas abandonnée
    // — elle devient le repli, celui d'un signet ou d'une notification ouverte
    // à froid.
    await arriverAFroid(page, devis);
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    const cible = await fleche.getAttribute("href");
    assert.ok(
      cible?.startsWith(`/chantiers/${chantierId}/coordonnees`),
      `à froid, la flèche mène à « ${cible} » : sa sortie du 31 août a disparu`
    );
  });

  await cas("recharger ne coûte pas un retour de plus", async () => {
    // Son onglet reste ouvert des heures et son banc redémarre plusieurs fois
    // par soirée (`HANDOVER.md`, piège 0) : si chaque rechargement comptait pour
    // un pas, il faudrait appuyer autant de fois pour sortir.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    for (let i = 0; i < 3; i++) await page.reload({ waitUntil: "networkidle" });
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      () => document.querySelector('[data-atlas="retour-du-devis"]')?.getAttribute("href") === "/",
      undefined,
      { timeout: 15_000 }
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La flèche et la page d'avant — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
