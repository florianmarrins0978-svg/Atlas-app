#!/usr/bin/env node
/*
  Mesure les deux boutons du devis, à la largeur réelle de son téléphone.

  **Pourquoi mesurer plutôt qu’estimer.** La planche 79 affirme qu’une
  proposition tient sur une ligne et qu’une autre déborde sur deux. Écrit à
  l’œil, c’est une opinion ; et une opinion fausse ferait choisir au patron un
  dessin qui, chez lui, ne ressemblera pas à ce qu’il a vu. Les libellés
  « Je dicte mon devis → » et « J’écris mon devis → » font 17 et 16 signes en
  serif : à deux par ligne sur 390 px, cela se joue à quelques pixels.

  **Ce contrôle refuse de conclure sur du vide.** Une boîte de zéro pixel n’est
  pas « rien ne déborde » : c’est une mesure impossible — la feuille de style
  n’était pas appliquée. Payé le 15 août 2026 par une suite qui comparait deux
  largeurs valant toutes les deux 0 et rendait un vert sur un écran où trois
  noms étaient coupés. D’où `networkidle`, et le refus explicite plus bas.

      node scripts/mesurer-maquette-deux-boutons.mjs

  Il rend le nombre de LIGNES réellement occupées par chaque libellé — compté
  par les rectangles du texte, pas déduit d’une hauteur — et le débordement
  horizontal éventuel.
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "docs", "maquettes", "79-les-deux-boutons-du-devis.html");

// Chemin propre à cet environnement, utilisé seulement s’il existe : ailleurs,
// Playwright trouve son propre navigateur.
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const problemes = [];
function verifier(quoi, condition) {
  if (condition) console.log(`  ✓ ${quoi}`);
  else {
    console.error(`  ✗ ${quoi}`);
    problemes.push(quoi);
  }
}

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {},
);
const page = await navigateur.newPage({ viewport: { width: 1280, height: 1400 } });
// `networkidle`, jamais `domcontentloaded` : mesurer avant la mise en page,
// c’est mesurer des zéros.
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const mesures = await page.evaluate(() => {
  const releve = [];
  document.querySelectorAll("[data-mesure]").forEach((ecran, i) => {
    ecran.querySelectorAll("[data-bouton]").forEach((bouton) => {
      const boite = bouton.getBoundingClientRect();
      // Le nombre de rectangles du texte EST le nombre de lignes occupées :
      // une hauteur divisée par un interligne supposé se trompe dès qu’une
      // marge intérieure change.
      const plage = document.createRange();
      plage.selectNodeContents(bouton);
      // La place réellement disponible : l'écran moins ses deux marges de
      // 24 px. Une capsule empilée ne casse jamais ses mots (`nowrap`) — elle
      // GRANDIT, et sort de l'écran sans que rien dans le bouton lui-même ne
      // paraisse anormal. Sans cette mesure, un libellé trop long passait au
      // vert : vérifié en le rallongeant pour de bon, le 18 août 2026.
      const place = ecran.getBoundingClientRect().width - 48;
      releve.push({
        proposition: i + 1,
        texte: bouton.textContent.trim(),
        largeur: Math.round(boite.width * 10) / 10,
        place: Math.round(place * 10) / 10,
        hauteur: Math.round(boite.height * 10) / 10,
        lignes: plage.getClientRects().length,
        deborde: bouton.scrollWidth > bouton.clientWidth + 1,
        sortDeLEcran: boite.width > place + 0.5,
      });
    });
  });
  return releve;
});

console.log(`\n  ${mesures.length} boutons mesurés, écran de 390 px\n`);
for (const m of mesures) {
  console.log(
    `  prop. ${m.proposition} · « ${m.texte} » — ${m.largeur}×${m.hauteur} px, ` +
      `${m.lignes} ligne${m.lignes > 1 ? "s" : ""}${m.deborde ? ", DÉBORDE" : ""}` +
      `${m.sortDeLEcran ? ` — SORT DE L'ÉCRAN (${m.place} px disponibles)` : ""}`,
  );
}
console.log("");

verifier("des boutons ont été trouvés", mesures.length > 0);

// Le refus d’une mesure impossible. Sans lui, une feuille de style non
// appliquée rendrait « 0 ligne, aucun débordement » — un vert qui ne prouve
// rien, et le pire des contrôles.
const vides = mesures.filter((m) => m.largeur < 1 || m.hauteur < 1 || m.lignes === 0);
verifier(
  "aucune boîte de zéro pixel (sinon la mise en page n’était pas appliquée)",
  vides.length === 0,
);

verifier("aucun libellé ne déborde de sa capsule", mesures.every((m) => !m.deborde));

verifier(
  "aucune capsule ne sort de l'écran de 390 px",
  mesures.every((m) => !m.sortDeLEcran),
);

// Ce que la planche AFFIRME au patron, et qui doit donc être vrai : les
// propositions empilées (1, 2, 5 — soit les écrans 2, 3 et 6 de la page, dans
// l’ordre où ils s’y trouvent) tiennent sur une ligne.
const empilees = mesures.filter((m) => [1, 2, 5].includes(m.proposition));
verifier(
  "les propositions empilées tiennent chacune sur une seule ligne",
  empilees.length === 6 && empilees.every((m) => m.lignes === 1),
);

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("  Tout est mesuré, rien n’est supposé.\n");
