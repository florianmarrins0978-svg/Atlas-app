import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

/**
 * Les écrans du diagnostic végétal — **REGARDÉS, pas seulement testés**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Pourquoi une suite navigateur en plus des quatre autres.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *« Et surtout : regarder l'écran. Trois défauts réels de ce projet ont été
 * trouvés en regardant une capture, jamais par un test vert. »* (`CLAUDE.md` §5)
 *
 * Cette suite prend donc des **captures** des deux écrans, en plus de vérifier
 * ce qui s'y trouve. Elles sont déposées dans `captures/` et regardées avant de
 * livrer — c'est du travail, pas de la finition.
 *
 * **Ce qu'elle vérifie et qu'aucune autre ne peut :**
 *
 *  1. L'outil est bien ATTEIGNABLE depuis l'onglet Paysage. Une page parfaite
 *     dont aucun lien ne mène nulle part est une page qui n'existe pas — et ce
 *     dépôt a déjà payé trois fois un bouton qui ne répond pas.
 *  2. L'écran d'entrée dit ce qu'il doit dire, et **rien d'autre** : sa règle
 *     produit interdit le formulaire et le questionnaire.
 *  3. **L'état dégradé s'affiche PROPREMENT.** Cet environnement n'a aucune clé
 *     d'IA : une photo envoyée ici mène forcément au refus « personne n'a
 *     regardé ». C'est précisément l'occasion de vérifier que ce refus est un
 *     écran fini, et non une trace d'erreur — parce que c'est l'écran que verra
 *     quiconque essaie sans avoir configuré de fournisseur.
 *
 * **Ce qu'elle NE peut PAS vérifier :** le parcours avec un vrai diagnostic. Il
 * lui faudrait une clé de vision ET des fiches validées, et il n'y a ni l'une
 * ni les autres ici. Le moteur, lui, est éprouvé bout en bout contre les
 * fixtures par `test-diagnostic-base.ts`, sans navigateur.
 */

const BASE = "http://localhost:3000";
const CAPTURES = "captures";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  mkdirSync(CAPTURES, { recursive: true });
  const browser = await lancerNavigateur();
  // 390 px : la largeur d'un téléphone courant. C'est là qu'il regarde, et
  // c'est la seule largeur où un défaut de mise en page compte.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  console.log("\n=== L'outil est atteignable depuis Paysage ===");

  await cas("la liste Paysage porte « Diagnostic végétal », et le lien mène quelque part", async () => {
    await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
    const lien = page.locator('a[href="/paysage/diagnostic"]');
    await lien.waitFor({ state: "visible", timeout: 10000 });
    assert.match(await lien.innerText(), /Diagnostic végétal/);
    await page.screenshot({ path: `${CAPTURES}/paysage-liste.png`, fullPage: true });
  });

  console.log("\n=== L'écran d'entrée : une phrase, un bouton, une précision ===");

  await cas("il dit ce qu'il doit dire", async () => {
    await page.goto(`${BASE}/paysage/diagnostic`, { waitUntil: "networkidle" });
    const ecran = page.locator('[data-atlas="ecran-diagnostic"]');
    await ecran.waitFor({ state: "visible", timeout: 10000 });
    const texte = (await ecran.innerText()).replace(/\s+/g, " ");
    assert.match(texte, /Diagnostic végétal/);
    assert.match(texte, /Photographiez la zone qui vous semble anormale/);
    assert.match(texte, /Prendre une photo/);
    assert.match(texte, /Feuille, écorce, branche ou champignon/);
  });

  await cas("il ne porte AUCUN formulaire — c'est sa règle produit, pas un détail", async () => {
    const ecran = page.locator('[data-atlas="ecran-diagnostic"]');
    // L'entrée de fichier est cachée et pilotée par le bouton : elle ne compte
    // pas comme un formulaire. Tout le reste en serait un.
    assert.equal(await ecran.locator("select").count(), 0, "aucune liste déroulante");
    assert.equal(await ecran.locator("textarea").count(), 0, "aucune zone de saisie");
    assert.equal(
      await ecran.locator('input:not([type="file"])').count(),
      0,
      "aucun champ à remplir : il ouvre, il photographie, il attend"
    );
  });

  await cas("le bouton ouvre l'appareil photo arrière, pas la bibliothèque", async () => {
    const entree = page.locator('[data-atlas="prendre-photo"] input[type="file"]');
    assert.equal(await entree.getAttribute("capture"), "environment");
    assert.match((await entree.getAttribute("accept")) ?? "", /image\/jpeg/);
  });

  await cas("capture de l'écran d'entrée", async () => {
    await page.screenshot({ path: `${CAPTURES}/diagnostic-entree.png`, fullPage: true });
  });

  console.log("\n=== L'état dégradé est un ÉCRAN FINI, pas une trace d'erreur ===");

  await cas("sans fournisseur de vision, l'analyse aboutit à un écran propre", async () => {
    // Une image minuscule mais VALIDE : le contrôle de format doit passer, pour
    // que ce soit bien l'absence de fournisseur qu'on éprouve — et non le refus
    // du fichier, qui se produirait plus tôt et ne prouverait rien de l'écran.
    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
        "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
        "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
      "base64"
    );
    await page.setInputFiles('[data-atlas="prendre-photo"] input[type="file"]', {
      name: "essai.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await page.waitForURL(/\/paysage\/diagnostic\/[0-9a-f-]{36}/, { timeout: 30000 });
    await page.waitForLoadState("networkidle");

    const ecran = page.locator('[data-atlas="ecran-diagnostic-resultat"]');
    await ecran.waitFor({ state: "visible", timeout: 10000 });
    const texte = (await ecran.innerText()).replace(/\s+/g, " ");

    // **Une PHRASE en français, jamais une pile d'appels ni un identifiant
    // opaque.** C'est le piège 0 ter du dépôt : le message d'une exception
    // levée par une action serveur n'arrive jamais jusqu'au patron.
    assert.match(texte, /Analyse impossible|Sans conclusion/);
    assert.doesNotMatch(texte, /Error|undefined|\[object/i);

    // Une boîte de zéro pixel ne prouve rien (`CLAUDE.md` §5, le défaut du
    // 15 août) : on refuse de conclure sur une mesure impossible.
    const boite = await ecran.boundingBox();
    assert.ok(boite && boite.height > 50, `l'écran mesure ${boite?.height ?? 0} px de haut`);

    await page.screenshot({ path: `${CAPTURES}/diagnostic-sans-fournisseur.png`, fullPage: true });
  });

  await cas("« Nouvelle photo » ramène à l'écran d'entrée", async () => {
    await page.click('text=Nouvelle photo');
    await page.waitForURL(`${BASE}/paysage/diagnostic`, { timeout: 10000 });
  });

  await browser.close();
  console.log(
    echecs === 0
      ? `\n✅ Écrans du diagnostic — 0 échec(s). Captures dans ${CAPTURES}/.`
      : `\n❌ ${echecs} échec(s).`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
