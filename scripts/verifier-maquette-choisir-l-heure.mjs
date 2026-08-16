#!/usr/bin/env node
/*
  Garde la molette du temps passé.

  **Ce que ce contrôle doit attraper, et qu'aucun œil ne verra sur une capture :**

  1. **Aucun JavaScript.** Le lecteur du patron n'en exécute pas ; une planche
     bâtie en JS lui arrive vide en passant tous les contrôles ordinaires.
  2. **La molette s'accroche VRAIMENT.** Une bande qui défile librement paraît
     identique sur une image et se révèle imprécise au doigt : le cran choisi
     n'est jamais tout à fait sous le repère.
  3. **Le repère est au centre de la fenêtre.** C'est le piège consigné le
     10 août 2026 : un rembourrage posé sur le CONTENEUR au lieu du CONTENU
     décale le repère de la moitié, et rien ne le montre sur une capture.

  ─── ET IL REFUSE DE CONCLURE SUR DU VIDE ────────────────────────────────────
  **Payé le 15 août 2026** : une suite comparait deux largeurs valant toutes
  deux ZÉRO — la feuille de style n'était pas appliquée — et rendait « rien
  n'est coupé », en vert, sur un écran où trois noms l'étaient. Ici, une boîte
  de zéro pixel fait ÉCHOUER le contrôle au lieu de le faire passer.
  ─────────────────────────────────────────────────────────────────────────────
*/

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLANCHE = join(RACINE, "docs", "maquettes", "65-choisir-l-heure.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
async function cas(nom, verifier) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("=== La molette du temps passé ===");

const source = readFileSync(PLANCHE, "utf8");

await cas("aucun JavaScript", () => {
  assert(!/<script/i.test(source), "la planche porte une balise <script>");
  assert(!/javascript:/i.test(source), "la planche porte un lien javascript:");
  assert(!/\son[a-z]+\s*=\s*["']/i.test(source), "la planche porte un gestionnaire en ligne");
});

await cas("le pas est de cinq minutes, et rien d'autre", () => {
  const crans = [...source.matchAll(/<div class="v">(\d) h (\d\d)<\/div>/g)].map((m) => m[2]);
  assert(crans.length > 20, `seulement ${crans.length} crans : la molette est-elle encore là ?`);
  const mauvais = crans.filter((m) => Number(m) % 5 !== 0);
  assert(mauvais.length === 0, `des crans hors du pas de cinq minutes : ${mauvais.join(", ")}`);
});

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
// Sans JavaScript, comme chez lui.
const contexte = await navigateur.newContext({ javaScriptEnabled: false });
const page = await contexte.newPage();
// **`networkidle`, pas `domcontentloaded`.** Mesurer avant que la feuille de
// style ne soit appliquée rend des boîtes de zéro pixel — et un contrôle qui
// mesure zéro ne mesure rien (CLAUDE.md §5).
await page.goto(`file://${PLANCHE}`, { waitUntil: "networkidle" });
await page.locator('label[for="h-c"]').click();
await page.waitForTimeout(300);

await cas("les trois gestes existent, et C s'ouvre le premier", async () => {
  for (const v of ["h-a", "h-b", "h-c"]) {
    assert((await page.locator(`label[for="${v}"]`).count()) === 1, `le geste ${v} a disparu`);
  }
  assert(
    /id="h-c" class="etat" checked/.test(source),
    "la planche ne s'ouvre plus sur la molette Atlas"
  );
});

await cas("la molette a bien une matière à mesurer", async () => {
  const boite = await page.locator(".bande").boundingBox();
  assert(boite, "la bande n'existe pas");
  // **Le refus de conclure sur du vide.** Sans cette borne, tout ce qui suit
  // rendrait « juste » sur une page dont la mise en forme n'a pas pris.
  assert(
    boite.height > 100 && boite.width > 100,
    `la bande mesure ${Math.round(boite.width)}×${Math.round(boite.height)} px : ` +
      "la mise en forme n'est pas appliquée, aucune mesure ne prouve rien"
  );
});

await cas("le repère est au CENTRE de la fenêtre, pas ailleurs", async () => {
  const bande = await page.locator(".bande").boundingBox();
  const repere = await page.locator(".repere").boundingBox();
  assert(repere, "le repère a disparu");
  // Le repère a une hauteur nulle et dessine sa bande en `::before` : on vise
  // donc son sommet, qui doit tomber à un demi-cran au-dessus du milieu.
  const milieuBande = bande.y + bande.height / 2;
  const hautRepere = repere.y;
  const ecart = Math.abs(hautRepere + 24 - milieuBande);
  assert(
    ecart < 6,
    `le repère est à ${Math.round(ecart)} px du centre : le rembourrage a dû glisser ` +
      "du contenu vers le conteneur (piège du 10 août 2026)"
  );
});

await cas("la molette s'accroche : le cran choisi tombe SOUS le repère", async () => {
  // Le défilement programmé subit bien l'accroche, contrairement à une molette
  // synthétique — c'est le procédé retenu le 10 août 2026.
  await page.locator(".bande").evaluate((n) => {
    n.scrollTop = 20 * 48 + 11; // volontairement DÉCALÉ de 11 px
  });
  await page.waitForTimeout(500);
  const bande = await page.locator(".bande").boundingBox();
  const milieu = bande.y + bande.height / 2;
  const crans = await page.locator(".v").all();
  let meilleur = null;
  for (const cran of crans) {
    const b = await cran.boundingBox();
    if (!b || b.height === 0) continue;
    const centre = b.y + b.height / 2;
    const d = Math.abs(centre - milieu);
    if (!meilleur || d < meilleur.d) meilleur = { d, texte: (await cran.innerText()).trim() };
  }
  assert(meilleur, "aucun cran mesurable : la molette est vide");
  assert(
    meilleur.d < 8,
    `le cran le plus proche (« ${meilleur.texte} ») est à ${Math.round(meilleur.d)} px du repère : ` +
      "l'accroche ne rattrape plus le décalage, et le choix sera imprécis au doigt"
  );
});

await contexte.close();
await navigateur.close();

console.log(`\n${echecs === 0 ? "✅" : "❌"} La molette — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
