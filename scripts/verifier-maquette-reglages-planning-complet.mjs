/*
  RÉGLAGES — CE QUE « 2 CHANTIERS PAR JOUR » DONNE AU PLANNING.

  Sa demande du 31 août 2026, capture des Réglages à l'appui : *« écrit deux
  chantiers par jour, planning complet, et met le petit carré vert foncé avec
  écrit "complet" du planning »*, puis *« c'est sur cette page que doit se faire
  la modification »*.

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DE LA PLANCHE.

    1. **La vue « Aujourd'hui » dit MOT POUR MOT ce que l'écran dit** — la
       phrase est comparée à `phraseDuCompteur` (`src/lib/equipes.ts`), lue
       dans le fichier. Une planche qui partirait d'une phrase approchante
       ferait choisir sur un écran qui n'existe pas.
    2. **Chaque proposition porte le carré ET le mot** qu'il demande, et le
       carré a EXACTEMENT la couleur du planning — `colors.rust`, lue dans
       `src/lib/design-tokens.ts`. Un vert redessiné à l'œil ne serait plus
       celui de la légende qu'il montre.
    3. **Le chiffre suit le compteur** dans les trois propositions : un réglage
       qui ne se relit qu'à 2 ne prouve rien.
    4. **À un seul chantier par jour, aucune ligne « incomplet »** : entre rien
       et complet il n'y a pas de place, et une ligne qui prétendrait le
       contraire serait fausse.
    5. **Les bornes se voient** : le − est inerte à 1, le + à 20 (`MAX_EQUIPES`).
    6. **Rien ne déborde** à 390 px, la largeur de son téléphone.

  Il sait échouer : éprouvé en changeant un mot de la phrase d'aujourd'hui (1
  rougit), en peignant le carré d'un autre vert (2 rougit), en figeant le
  chiffre des propositions (3 rougit), et en gardant la ligne « incomplet » à
  1 chantier par jour (4 rougit).

  Usage : node scripts/verifier-maquette-reglages-planning-complet.mjs
*/
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PAGE = "file://" + path.resolve("appli/reglages-planning-complet.html");
const PROPOSITIONS = ["phrase", "echelle", "jour"];

const soucis = [];
const dire = (ok, quoi) => { if (!ok) soucis.push(quoi); };

/* Ce que le PRODUIT dit, lu dans le produit — jamais recopié ici. */
const equipes = readFileSync("src/lib/equipes.ts", "utf8");
const finDePhrase = equipes.match(/return `\$\{combien\} (par jour\.[^`]*)`/);
dire(finDePhrase !== null, "`phraseDuCompteur` a changé de forme : le contrôle ne sait plus quoi comparer");
const jetons = readFileSync("src/lib/design-tokens.ts", "utf8");
const vertDuPlanning = jetons.match(/rust: "var\(--atlas-rust, (#[0-9a-fA-F]{6})\)"/);
dire(vertDuPlanning !== null, "`colors.rust` a changé de forme : le vert du planning ne se lit plus");

const enRvb = (hex) =>
  `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => soucis.push(`erreur JS : ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") soucis.push(`console : ${m.text()}`); });

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(200);

const voir = async (vue) => {
  await page.click(`.choix button[data-vue="${vue}"]`);
  await page.waitForTimeout(100);
};
const dessous = async () => (await page.textContent("#dessous")).replace(/\s+/g, " ").trim();

// 1 — la phrase d'aujourd'hui, mot pour mot
await voir("avant");
if (finDePhrase) {
  const attendue = `2 chantiers ${finDePhrase[1]}`;
  dire(
    (await dessous()) === attendue,
    `la vue « Aujourd'hui » dit « ${await dessous()} » là où l'écran dit « ${attendue} »`
  );
}

// 2 — le carré du planning et le mot « complet », dans chaque proposition
for (const vue of PROPOSITIONS) {
  await voir(vue);
  const texte = await dessous();
  dire(/complet/.test(texte), `vue « ${vue} » : le mot « complet » n'y est pas`);
  const vert = await page.evaluate(() => {
    // Le carré plein de la proposition : le carré « complet » de l'échelle, la
    // pastille de la phrase, ou le segment rempli de la case du jour.
    const e = document.querySelector("#dessous .carre.complet, #dessous .marque .seg");
    if (!e) return null;
    const boite = e.getBoundingClientRect();
    return { fond: getComputedStyle(e).backgroundColor, largeur: boite.width, hauteur: boite.height };
  });
  dire(vert !== null, `vue « ${vue} » : aucun carré vert`);
  if (vert && vertDuPlanning) {
    dire(
      vert.largeur > 0 && vert.hauteur > 0,
      `vue « ${vue} » : le carré mesure zéro pixel — la mesure ne prouve rien`
    );
    dire(
      vert.fond === enRvb(vertDuPlanning[1]),
      `vue « ${vue} » : le carré est ${vert.fond} au lieu du vert du planning ${enRvb(vertDuPlanning[1])}`
    );
  }
}

// 3 — le chiffre suit le compteur
await page.click('[data-pas="1"]');
for (const vue of PROPOSITIONS) {
  await voir(vue);
  dire(/3 chantiers/.test(await dessous()), `vue « ${vue} » : le chiffre ne suit pas le compteur (3 attendu)`);
}
dire((await page.textContent("#valeur")).trim() === "3", "le compteur n'affiche pas 3");

// 4 — à un seul chantier par jour, pas de ligne « incomplet »
await voir("echelle");
await page.click('[data-pas="-1"]');
await page.click('[data-pas="-1"]');
dire(!/incomplet/.test(await dessous()), "à 1 chantier par jour, l'échelle invente un « incomplet » qui n'existe pas");
dire(/1 chantier/.test(await dessous()), "à 1 chantier par jour, l'échelle ne dit plus ce que vaut « complet »");

// 5 — les bornes
dire(await page.isDisabled('[data-pas="-1"]'), "le − reste actif à 1 chantier par jour");
const max = Number(equipes.match(/MAX_EQUIPES = (\d+)/)?.[1] ?? 0);
dire(max > 0, "`MAX_EQUIPES` ne se lit plus dans `src/lib/equipes.ts`");
for (let i = 1; i < max; i++) await page.click('[data-pas="1"]');
dire((await page.textContent("#valeur")).trim() === String(max), `le compteur ne monte pas jusqu'à ${max}`);
dire(await page.isDisabled('[data-pas="1"]'), `le + reste actif à ${max}, le plafond du produit`);

// 6 — rien ne déborde
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
dire(debord <= 0, `la planche déborde de ${debord} px sur la largeur de son téléphone`);

await navigateur.close();

if (soucis.length) {
  console.error("❌ Réglages · le planning complet — la planche ne tient pas :");
  for (const s of soucis) console.error(`   · ${s}`);
  process.exit(1);
}
console.log("✅ Réglages · le planning complet — le carré et le mot du planning, sur la page du réglage.");
