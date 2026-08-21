#!/usr/bin/env node
/*
  Éprouve la maquette du planning en semaines — dans un vrai navigateur.

  **Pourquoi elle ne se relit pas, elle se joue.** Il a demandé une maquette
  « dynamique que je puisse essayer » : ce qu'elle promet, ce sont des gestes —
  les flèches changent de semaine, les trois calendriers se comparent, et la
  liste montre la MÊME semaine que le calendrier. Une promesse de ce genre ne se
  vérifie pas à la lecture du fichier.

  **Et elle refuse de conclure sur du vide.** Une case de zéro pixel n'est pas
  « rien n'est pris » : c'est une mesure impossible, le faux vert du 15 août
  2026 où 0 − 0 = 0 certifiait « rien n'est coupé » sur un écran où trois noms
  l'étaient.

      node scripts/verifier-maquette-planning-simple.mjs
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "planning-simple.html");
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
const page = await navigateur.newPage({ viewport: { width: 430, height: 1200 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const titre = () => page.locator("#semaine-titre").innerText();

verifier("la page se charge sans erreur de script", erreurs.length === 0);
if (erreurs.length) console.error("   ", erreurs[0]);

// ── La semaine d'arrivée est celle du jour figé (19 août 2026) ────────────
const semaineDepart = await titre();
verifier(
  `la semaine d'arrivée contient le 19 août — lu : « ${semaineDepart} »`,
  /17\s*–\s*23 août/.test(semaineDepart),
);
// **On lit en insensible à la casse, et c'est un piège payé ici.** Le titre du
// jour est écrit « vendredi 21 août » dans la page, mais la feuille de style le
// met en capitales : `innerText` rend ce que l'ŒIL voit, pas ce que le HTML
// porte. Un contrôle qui compare au texte source rougit sur une page juste.
const litPlanifies = async () => (await page.locator("#planifies").innerText()).toLowerCase();

verifier(
  "les deux Martins du vendredi 21 sont dans la liste, avec le jour NOMMÉ",
  (await litPlanifies()).includes("vendredi 21 août"),
);

// ── Les flèches changent vraiment de semaine ──────────────────────────────
await page.click("#apres");
const suivante = await titre();
verifier(`la flèche droite avance d'une semaine — « ${suivante} »`, /24\s*–\s*30 août/.test(suivante));
verifier(
  "l'abri de Pornic apparaît le mardi 25, avec sa demi-journée",
  (await litPlanifies()).includes("mardi 25 août") && (await litPlanifies()).includes("matin"),
);
await page.click("#avant");
verifier("la flèche gauche revient exactement où l'on était", (await titre()) === semaineDepart);

// ── Une semaine sans rien le DIT, au lieu de rendre une page muette ───────
await page.click("#avant");
await page.click("#avant");
verifier(
  "une semaine vide le dit en toutes lettres",
  (await litPlanifies()).includes("aucun chantier posé"),
);
await page.click("#apres");
await page.click("#apres");

// ── Les trois calendriers se dessinent, et ils sont différents ────────────
const mesures = {};
for (const [lettre, selecteur, cases] of [
  ["A", ".calA", ".calA .demi"],
  ["B", ".calB", ".calB .case"],
  ["C", ".calC", ".calC .rond"],
]) {
  await page.click(`[data-cal="${lettre}"]`);
  await page.waitForTimeout(120);
  const boites = await page.$$eval(cases, (n) => n.map((e) => e.getBoundingClientRect().height));
  mesures[lettre] = boites;
  verifier(
    `le calendrier ${lettre} se dessine (${boites.length} cases, aucune de zéro pixel)`,
    boites.length > 0 && boites.every((h) => h >= 1),
  );
  verifier(`le calendrier ${lettre} est le seul affiché`, (await page.locator(selecteur).count()) === 1);
}

// ── Ce que le calendrier montre doit être CE QUE LES DONNÉES DISENT ───────
//
// Le contrôle qui compte : le vendredi 21 porte deux chantiers à la journée,
// donc ses deux équipes sont prises — matin ET après-midi COMPLETS. Un
// calendrier joli mais faux passerait tous les contrôles ci-dessus.
await page.click('[data-cal="B"]');
await page.waitForTimeout(120);
const pleines = await page.$$eval(".calB .case.plein", (n) => n.length);
const moities = await page.$$eval(".calB .case.moitie", (n) => n.length);
verifier(
  `le vendredi 21 est complet matin ET après-midi (2 cases pleines lues : ${pleines})`,
  pleines === 2,
);
verifier(
  `mercredi après-midi et jeudi (une équipe sur deux) sont à moitié (3 lues : ${moities})`,
  moities === 3,
);

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n  La maquette du planning tient ses gestes.\n");
