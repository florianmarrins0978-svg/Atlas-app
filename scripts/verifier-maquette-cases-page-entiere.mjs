#!/usr/bin/env node
/*
  Éprouve `appli/cases-page-entiere.html` — la fiche client entière, cinq fois.

  **Sa demande du 21 août 2026 :** *« Fais-moi une maquette dynamique, pas de
  photos, que je puisse essayer avec les cinq différentes cases. Toute la page
  de haut en bas avec les cinq différentes cases, comme ça ce sera plus visuel
  et je pourrai choisir. »*

  **Ce que ce contrôle défend, et ce n'est pas le goût.** Une comparaison n'est
  honnête que si les cinq écrans portent EXACTEMENT le même contenu : un champ
  qui disparaîtrait dans un dessin le ferait gagner par forfait. Il vérifie donc,
  dessin par dessin :

  1. **les mêmes champs, tous visibles** — aucun ne s'évapore d'un dessin à
     l'autre ;
  2. **rien n'est coupé** — le nom, le numéro, l'adresse tiennent dans leur case,
     et le contrôle refuse de conclure sur une boîte de zéro pixel
     (`CLAUDE.md` §5) ;
  3. **48 px de prise au minimum** — une case élégante qu'on rate deux fois sur
     trois n'est pas élégante, elle est ratée ;
  4. **l'écran reste entier** : Mr/Mme, l'envoi, les photos, l'anneau et le
     bouton sont là dans les cinq. C'est toute la page qu'il veut voir, pas les
     seuls champs.

  **Il sait échouer.** Éprouvé en masquant l'e-mail sur un seul dessin, et en
  ramenant la prise du dessin 3 à 40 px : les deux rougissent en nommant le
  dessin fautif.

  Usage : node scripts/verifier-maquette-cases-page-entiere.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "cases-page-entiere.html"));
if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
// `networkidle` : sans la mise en page appliquée, toutes les largeurs valent
// zéro et le contrôle rendrait un vert qui ne prouve rien.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

const NOMS = { 1: "le trait", 2: "la capsule", 3: "la ligne de fiche", 4: "la carte douce", 5: "le creux" };
/** Ce que l'écran doit porter dans les CINQ dessins, sans exception. */
const PIECES = [
  [".civilite button", 2, "Mr et Mme"],
  [".champ input", 4, "les quatre cases"],
  ["#par-sms", 1, "le choix de l'envoi"],
  ["#ajouter-photo", 1, "le carré photo"],
  ["#anneau span[data-cercle]", 2, "l'anneau et ses deux cercles"],
  ["button.principal", 1, "« Je rédige mon devis »"],
];

/**
 * Les intitulés qui ne vivent PAS au-dessus d'une case, et qu'un dessin ne doit
 * pas emporter avec lui.
 *
 * **Trouvé à la capture, pas à la mesure.** Le dessin « ligne de fiche » range
 * les intitulés à gauche des cases — et sa première version masquait TOUS les
 * petits titres, dont « Comment lui envoyer son devis ? » et « Photos du
 * chantier », qui ne coiffent aucune case. Il gagnait en légèreté ce qu'il
 * perdait en contenu, c'est-à-dire qu'il trichait.
 */
const TITRES = ["comment lui envoyer son devis", "photos du chantier"];

console.log("=== La fiche client entière, cinq dessins ===\n");

for (const n of [1, 2, 3, 4, 5]) {
  console.log(`\n— ${n} · ${NOMS[n]} —`);
  await page.click(`.choix button[data-c="${n}"]`);
  await page.waitForTimeout(120);

  dire(
    (await page.locator("#ecran").getAttribute("data-cases")) === String(n),
    `le dessin ${n} est bien celui qu'on regarde`
  );

  for (const [selecteur, combien, quoi] of PIECES) {
    dire((await page.locator(selecteur).count()) === combien, `${quoi} : toujours là`);
  }

  const texte = (await page.locator("form").innerText()).toLowerCase();
  for (const titre of TITRES) {
    dire(texte.includes(titre), `« ${titre} » n'a pas disparu avec le dessin`);
  }

  const mesures = await page.locator(".champ input").evaluateAll((cases) =>
    cases.map((c) => ({
      dehors: c.scrollWidth - c.clientWidth,
      hauteur: Math.round(c.getBoundingClientRect().height),
      largeur: Math.round(c.getBoundingClientRect().width),
      vu: c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().height > 0,
    }))
  );
  dire(mesures.length === 4 && mesures.every((m) => m.vu), "les quatre cases sont dessinées et visibles");
  const coupees = mesures.filter((m) => m.dehors > 1);
  dire(coupees.length === 0, `rien n'est coupé (le pire : ${Math.max(0, ...mesures.map((m) => m.dehors))} px dehors)`);
  const basse = Math.min(...mesures.map((m) => m.hauteur));
  dire(basse >= 48, `la prise la plus basse fait ${basse} px — 48 au minimum sous le pouce`);
}

// Le geste de la dictée doit vivre dans le dernier dessin regardé aussi : un
// écran qu'on ne peut plus manipuler après avoir changé de dessin ne se juge
// pas, il se regarde — et il voulait l'ESSAYER.
await page.click("#dicter");
await page.waitForTimeout(200);
dire((await page.locator("#anneau").getAttribute("data-lit")) === "oui", "l'anneau dicte encore après avoir changé de dessin");
await page.click("#dicter");
await page.waitForTimeout(200);
dire(await page.locator("#apres-dictee").isVisible(), "et « Mon devis → » apparaît toujours au second appui");

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ Les cinq dessins portent le même écran, entier et sans rien de coupé."
    : `\n❌ ${plaintes.length} manquement(s) :\n   · ${plaintes.join("\n   · ")}`
);
process.exit(plaintes.length === 0 ? 0 : 1);
