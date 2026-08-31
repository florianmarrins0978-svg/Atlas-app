#!/usr/bin/env node
/*
  Éprouve la planche 98 — « le planning se souvient » — dans un vrai navigateur.

  **Pourquoi elle se joue plutôt qu'elle ne se relit.** Ce qu'elle promet, ce
  sont des gestes : trois vues qui se comparent d'un doigt, des mois qui se
  feuillettent, un jour passé qui s'ouvre. Une promesse de ce genre ne se
  vérifie pas à la lecture du fichier, et trois fois déjà c'est le patron qui a
  trouvé le défaut d'une adresse que personne n'avait ouverte (`AGENTS.md`).

  **Il refuse de conclure sur du vide.** Deux mesures ici valent zéro quand tout
  va bien et zéro quand rien n'est dessiné — la largeur d'un rectangle de
  légende, la part remplie d'une barre. C'est exactement le faux vert du 15 août
  2026, où `0 − 0 = 0` certifiait « rien n'est coupé » sur un écran où trois
  noms l'étaient. Ce contrôle exige donc une largeur NON NULLE, et c'est ce qui
  a attrapé le vrai défaut de cette planche : la paire « matin / après-midi »
  de la légende mesurait zéro — `align-items:center`, hérité, réduit un
  rectangle vide à rien dans une colonne.

      node scripts/verifier-maquette-planning-memoire.mjs
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "planning-memoire.html");
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
const contexte = await navigateur.newContext({ viewport: { width: 430, height: 1200 } });
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const vue = (quelle) => page.click(`.choix button[data-vue="${quelle}"]`);
/** Ce qu'une case du calendrier peint vraiment — mesuré, jamais déduit du code. */
async function segments(jour) {
  return page.$eval(`.case[data-jour="${jour}"]`, (c) =>
    [...c.querySelectorAll(".barre")].map((b) => {
      const seg = b.querySelector("i");
      return seg ? { classe: seg.className, large: seg.getBoundingClientRect().width } : null;
    }),
  );
}

console.log("\n  ── La planche s'ouvre");
verifier("aucune erreur de script", erreurs.length === 0);
verifier("elle s'ouvre sur juillet 2026, le mois de sa capture", (await page.innerText("#titreMois")) === "juillet 2026");
verifier("et sur la charte Nuit, celle de sa capture", (await page.getAttribute("body", "data-charte")) === "nuit");

console.log("\n  ── Le témoin : le calendrier OUBLIE (c'est le défaut montré)");
{
  await vue("temoin");
  const segs = await segments("2026-07-13");
  verifier("le 13 juillet, jour travaillé, ne porte AUCUNE marque", segs.every((s) => s === null));
  const carte = await page.innerText("#carte");
  verifier("et sa fiche annonce deux demi-journées libres", (carte.match(/libre/g) ?? []).length === 2);
}

console.log("\n  ── A : les jours passés gardent une trace grise");
{
  await vue("a");
  const segs = await segments("2026-07-13");
  // La largeur NON NULLE est le cœur du contrôle : une barre présente dans le
  // DOM mais large de zéro ne se voit pas, et rendrait un vert mensonger.
  verifier(
    `les deux demi-journées du 13 sont peintes « fait » et VISIBLES (${segs.map((s) => (s ? Math.round(s.large) : 0)).join(" / ")} px)`,
    segs.length === 2 && segs.every((s) => s && s.classe.includes("seg-fait") && s.large > 4),
  );
  const legende = await page.innerText("#legende");
  verifier("la légende gagne le mot « fait »", /fait/.test(legende));
  // Le 28 juillet portait trois chantiers le matin : en A, le passé ne rejoue
  // pas la charge — sans quoi « au-delà » réclamerait une place qui n'est plus
  // à prendre.
  const vingtHuit = await segments("2026-07-28");
  verifier("un matin surchargé du passé ne repeint pas le bordeaux", !vingtHuit.some((s) => s?.classe.includes("seg-dela")));
}

console.log("\n  ── B : les jours passés gardent leurs couleurs");
{
  await vue("b");
  const treize = await segments("2026-07-13");
  verifier("le 13 juillet retrouve « complet »", treize.every((s) => s && s.classe.includes("seg-plein") && s.large > 4));
  const vingtHuit = await segments("2026-07-28");
  verifier("et le 28 son « au-delà »", vingtHuit.some((s) => s?.classe.includes("seg-dela")));
  const legende = await page.innerText("#legende");
  verifier("la légende, elle, ne gagne rien", !/fait/.test(legende));
}

console.log("\n  ── Un jour passé se LIT, il ne s'écrit pas");
{
  await vue("a");
  // **Pas le 13 : il est DÉJÀ le jour touché à l'ouverture**, et le toucher le
  // referme. Le contrôle a rougi dessus, sur une planche juste — c'est ce qui
  // prouve qu'il sait échouer, et ce qui l'a corrigé.
  await page.click('.case[data-jour="2026-07-07"]');
  const carte = await page.innerText("#carte");
  verifier("sa fiche nomme le chantier", /Massif Guérande/.test(carte));
  verifier("elle dit qui y était", /Julien/.test(carte) && /Paul/.test(carte));
  verifier("aucun « + Ajouter » sur un jour passé", (await page.locator("#carte .ajouter").count()) === 0);
  verifier("une seule porte vers la fiche, pas une par demi-journée", (await page.locator("#carte .versfiche").count()) === 1);

  // Et l'inverse doit rester vrai, sans quoi le contrôle ne prouve rien : un
  // jour à venir garde son geste.
  await page.click("#retour");
  await page.click("#suiv");
  await page.click('.case[data-jour="2026-09-02"]');
  verifier("un jour à venir garde son « + Ajouter »", (await page.locator("#carte .ajouter").count()) === 1);
}

console.log("\n  ── La butée : douze mois, pas un de plus");
{
  for (let i = 0; i < 24; i++) {
    if (await page.locator("#prec").isDisabled()) break;
    await page.click("#prec");
  }
  verifier("on s'arrête sur septembre 2025", (await page.innerText("#titreMois")) === "septembre 2025");
  verifier("et la flèche du passé devient inerte", await page.locator("#prec").isDisabled());
}

console.log("\n  ── La légende se voit sur les deux chartes");
for (const charte of ["nuit", "origine"]) {
  if ((await page.getAttribute("body", "data-charte")) !== charte) await page.click("#basculeCharte");
  // **On mesure les RECTANGLES, pas leur boîte.** Première version : elle
  // mesurait `.paire`, qui garde ses 24 px même quand les deux rectangles se
  // sont réduits à rien — confrontée au défaut qu'elle prétendait attraper,
  // elle est restée VERTE. Un contrôle trop tolérant ne prouve rien
  // (`CLAUDE.md` §4 bis), et celui-ci ne l'a su qu'en le lui montrant.
  const larges = await page.$$eval("#legende .paire i", (els) =>
    els.map((e) => e.getBoundingClientRect().width),
  );
  verifier(
    `charte ${charte} : les rectangles « matin / après-midi » mesurent ${larges.map((l) => Math.round(l)).join(" / ")} px`,
    larges.length === 2 && larges.every((l) => l > 8),
  );
}

verifier("et toujours aucune erreur de script", erreurs.length === 0);

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n  La planche 98 tient ses gestes.\n");
