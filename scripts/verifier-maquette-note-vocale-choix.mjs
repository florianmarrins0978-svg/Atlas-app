#!/usr/bin/env node
/*
  Éprouve `appli/note-vocale-choix.html` — la note vocale telle qu'il l'a
  choisie le 30 août 2026 :

    *« Pour la largeur, le 4. Ensuite le 2, l'anneau. Et le B, le micro, mais
    avec des petites ondes de chaque côté, 1,5 cm max de chaque côté. »*

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT, ET POURQUOI.

  Cette planche ne pose plus de question : elle montre trois choix assemblés.
  Le risque a donc changé de nature — il n'est plus qu'une proposition soit
  mal dessinée, mais qu'**un de ses choix se perde en route**, sans que
  personne ne s'en aperçoive. Chacun est donc mesuré nommément.

  1. **LA LARGEUR — sa proposition 4.** Le bouton fait 66 % des cases du
     formulaire, à un point près. Un chiffre choisi qui dérive de dix pour cent
     à la réécriture suivante, c'est une réponse qu'on lui aura demandée pour
     rien.

  2. **LES ONDES — 1,5 cm AU PLUS de chaque côté.** Sa mesure est une longueur
     physique : elle se vérifie en centimètres, pas en pixels supposés. Le
     contrôle convertit comme le navigateur (1 cm = 96/2,54 px) et refuse tout
     dépassement — et refuse aussi une aile VIDE, car « au plus » n'a de sens
     que si quelque chose est dessiné.

     **Les deux côtés sont mesurés séparément**, et symétriques : une onde qui
     ne serait posée qu'à droite se verrait à l'œil, mais un contrôle qui somme
     les deux largeurs passerait au vert sur un côté nul et l'autre double.

  3. **LE GESTE — sa proposition 2.** Pendant qu'on dicte, l'objet RESTE au
     centre, la poubelle vient à sa gauche et l'avion à sa droite. Et au repos
     les deux gestes n'existent pas : il n'y a rien à jeter ni à envoyer.

  4. **LE BOUTON DISPARAÎT dès l'appui**, et revient si l'on jette — tranché le
     30 août. Retiré, pas grisé : le contrôle mesure `offsetParent`, pas
     l'opacité.

  5. **L'objet ne change jamais de FORME** — même taille, même rond, seul le
     signe passe du micro au carré d'arrêt. C'est sa règle la plus ancienne sur
     cet objet : *« il ne doit pas changer de visage »*.

  6. Et le reste, comme sur les planches précédentes : rien sous le pli à 700 et
     667 points, la teinte qui bascule dans les deux sens, l'avion qui mène au
     devis avec le nom SAISI, et aucun prix inventé (`CLAUDE.md` §4).

  **Il sait échouer.** Éprouvé en portant la largeur à 100 %, en poussant les
  ondes à 3 cm, en en vidant une, en montrant la poubelle au repos, en laissant
  le bouton pendant la dictée et en changeant la taille de l'objet à l'appui :
  chacun rougit, en nommant le point exact.

  Usage : node scripts/verifier-maquette-note-vocale-choix.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "note-vocale-choix.html"));

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

/** Ce que le navigateur entend par un centimètre : 96 points par pouce. */
const PX_PAR_CM = 96 / 2.54;

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => plaintes.push(`script en défaut : ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") plaintes.push(`erreur de console : ${m.text()}`);
});

await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La note vocale, ses trois choix réunis ===\n");

/** Le bouton est-il DANS la mise en page ? (« retiré », pas « pâli ») */
const boutonPresent = () =>
  page.evaluate(() => {
    const b = document.querySelector("#ecrire");
    return b !== null && b.offsetParent !== null;
  });

// ── 1. LA LARGEUR — sa proposition 4 ──────────────────────────────────────
console.log("  ── Son choix 4 : la largeur ──");
const bouton = page.locator("#ecrire");
const caseAdresse = page.locator('input[placeholder="12 rue des Lilas, Nantes"]');
const bB = await bouton.boundingBox();
const bC = await caseAdresse.boundingBox();
dire(
  bB !== null && bC !== null && bB.width > 0 && bC.width > 0,
  "le bouton et les cases sont dessinés (une boîte de zéro pixel ne se mesure pas)"
);
if (bB && bC) {
  const part = (bB.width / bC.width) * 100;
  dire(
    Math.abs(part - 66) <= 1,
    `il fait 66 % de la largeur des cases, sa proposition 4 (mesuré : ${part.toFixed(1)} %)`
  );
  dire(bB.height >= 44, `et il garde sa hauteur de doigt (${Math.round(bB.height)} px)`);
}
dire(
  (await bouton.innerText()).trim() === "Je rédige à la main",
  "le libellé est le sien, à la lettre"
);
const fond = await bouton.evaluate((el) => getComputedStyle(el).backgroundColor);
dire(/rgba\(.*,\s*0\)$/.test(fond), `il reste secondaire, sans aplat (mesuré : ${fond})`);

// ── 2. LES ONDES — 1,5 cm au plus de chaque côté ──────────────────────────
console.log("\n  ── Son choix B+ : les petites ondes ──");
for (const [cote, id] of [["gauche", "#aile-g"], ["droite", "#aile-d"]]) {
  const boite = await page.locator(id).boundingBox();
  const cm = boite ? boite.width / PX_PAR_CM : 0;
  dire(
    boite !== null && cm <= 1.5 + 0.02,
    `l'onde de ${cote} ne dépasse pas 1,5 cm (mesuré : ${cm.toFixed(2)} cm)`
  );
  // « Au plus » n'a de sens que si quelque chose est dessiné : une aile vide
  // passerait tous les seuils du monde.
  const barres = await page.locator(`${id} i`).count();
  dire(barres >= 4, `et elle porte bien des barreaux (${barres})`);
}
const [g, d] = await Promise.all([
  page.locator("#aile-g").boundingBox(),
  page.locator("#aile-d").boundingBox(),
]);
dire(
  g !== null && d !== null && Math.abs(g.width - d.width) < 1,
  `les deux côtés sont de même largeur (${Math.round(g?.width ?? 0)} px et ${Math.round(d?.width ?? 0)} px)`
);

// ── 3. LE REPOS : un disque plein, et aucun autre geste ───────────────────
console.log("\n  ── Le repos ──");
const objet = page.locator("#dicter");
const auRepos = await objet.boundingBox();
dire(
  auRepos !== null && auRepos.width >= 44 && auRepos.height >= 44,
  `le micro se touche (${auRepos ? `${auRepos.width}×${auRepos.height}` : "rien à mesurer"})`
);
const fondObjet = await objet.evaluate((el) => getComputedStyle(el).backgroundColor);
dire(!/rgba\(.*,\s*0\)$/.test(fondObjet), `c'est un disque PLEIN, pas un anneau creux (${fondObjet})`);
dire(!(await page.locator("#jeter").isVisible()), "au repos, aucune poubelle — il n'y a rien à jeter");
dire(!(await page.locator("#envoyer").isVisible()), "au repos, aucun avion — il n'y a rien à envoyer");
dire(await boutonPresent(), "« Je rédige à la main » est là avant qu'on parle");

// ── 4. L'APPUI : sa proposition 2 ─────────────────────────────────────────
console.log("\n  ── Son choix 2 : le geste ──");
await objet.click();
// **400 ms, et ce n'est pas au hasard.** Les deux gestes arrivent par une
// animation de 260 ms qui part d'un `scale(.7)` : mesurer plus tôt, c'est
// mesurer un bouton en train de grandir — 45,7 px au lieu de 46, et un contrôle
// qui rougirait un jour sur deux sans qu'on sache pourquoi.
await page.waitForTimeout(400);

const enDictee = await objet.boundingBox();
dire(
  enDictee !== null && auRepos !== null &&
    Math.abs(enDictee.width - auRepos.width) < 1 && Math.abs(enDictee.height - auRepos.height) < 1,
  `l'objet ne change pas de taille en appuyant (${auRepos?.width}→${enDictee?.width} px)`
);
dire(
  (await page.locator("#signe .carre-stop").count()) === 1,
  "son micro est devenu un carré d'arrêt — le signe change, pas la forme"
);
// **Et le carré se VOIT.** Compter l'élément ne prouve rien : posé dans un
// `<span>` resté en ligne, il rendait une boîte de zéro pixel et le disque
// s'affichait vide. C'est la capture qui l'a montré, pas le contrôle — il le
// mesure désormais (`CLAUDE.md` §5 : une boîte de zéro pixel se refuse).
const carre = await page.locator("#signe .carre-stop").boundingBox();
dire(
  carre !== null && carre.width >= 12 && carre.height >= 12,
  `et il est dessiné, pas seulement présent (${carre ? `${carre.width}×${carre.height}` : "boîte nulle"})`
);

// **Les ondes de repos ne doivent pas recouvrir les deux gestes.** Chaque aile
// s'étend sur 1,5 cm de part et d'autre du disque ; la poubelle et l'avion se
// posent à une vingtaine de pixels. Sans effacement, les barreaux passent
// par-dessus, à l'endroit exact où il faut viser.
const chevauche = (a, b) =>
  a !== null && b !== null && a.x < b.x + b.width && b.x < a.x + a.width;
const [aileG, aileD] = await Promise.all([
  page.locator("#aile-g").boundingBox(),
  page.locator("#aile-d").boundingBox(),
]);
const opaque = await page.locator("#aile-g").evaluate((el) => Number(getComputedStyle(el).opacity) > 0.05);
const [pg, pd] = await Promise.all([
  page.locator("#jeter").boundingBox(),
  page.locator("#envoyer").boundingBox(),
]);
dire(
  !opaque || (!chevauche(aileG, pg) && !chevauche(aileD, pd)),
  opaque
    ? "les ondes ne recouvrent ni la poubelle ni l'avion"
    : "les ondes de repos s'effacent pendant la dictée — la place est aux deux gestes"
);

const poubelle = page.locator("#jeter");
const avion = page.locator("#envoyer");
dire(await poubelle.isVisible(), "la poubelle est venue");
dire(await avion.isVisible(), "l'avion est venu");
const [bp, bo, ba] = await Promise.all([poubelle.boundingBox(), objet.boundingBox(), avion.boundingBox()]);
dire(
  bp !== null && bo !== null && ba !== null && bp.x < bo.x && bo.x < ba.x,
  "poubelle à gauche, objet au centre, avion à droite — sa proposition 2"
);
for (const [quoi, boite] of [["la poubelle", bp], ["l'avion", ba]]) {
  dire(
    boite !== null && boite.width >= 44 && boite.height >= 44,
    `${quoi} fait au moins 44 px (${boite ? `${boite.width}×${boite.height}` : "rien"})`
  );
}
dire(!(await boutonPresent()), "et « Je rédige à la main » a DISPARU — plus de confusion possible");

// Le chrono tourne pour de bon.
await page.waitForTimeout(2200);
dire(
  (await page.locator("#chrono").innerText()).trim() !== "0:00",
  `le chrono avance (lu : ${(await page.locator("#chrono").innerText()).trim()})`
);

// La pause vit dans l'objet : un second appui suspend, un troisième reprend.
const fige = (await page.locator("#chrono").innerText()).trim();
await objet.click();
await page.waitForTimeout(1600);
dire(
  (await page.locator("#chrono").innerText()).trim() === fige,
  `un second appui suspend vraiment (resté à ${fige})`
);
await objet.click();
await page.waitForTimeout(1300);
dire((await page.locator("#chrono").innerText()).trim() !== fige, "et un troisième reprend");

// ── 5. Jeter rend l'écran à ce qu'il était ────────────────────────────────
console.log("\n  ── Jeter, puis envoyer ──");
await poubelle.click();
await page.waitForTimeout(150);
dire(await boutonPresent(), "jeter ramène le bouton");
dire(!(await page.locator("#jeter").isVisible()), "et les deux gestes repartent");
dire(
  (await page.locator("#signe .carre-stop").count()) === 0,
  "le carré redevient un micro"
);
dire(
  await page.locator("#fiche").evaluate((e) => e.classList.contains("actif")),
  "jeter ne mène nulle part — on reste sur la fiche"
);

await objet.click();
await page.waitForTimeout(120);
await page.fill("#nom", "M. Chevallier");
await avion.click();
dire(await page.locator("#attente").isVisible(), "l'attente de la transcription se voit");
await page.waitForTimeout(1800);
dire(
  await page.locator("#devis").evaluate((e) => e.classList.contains("actif")),
  "l'avion mène au devis"
);
dire(
  (await page.locator("#devis-nom").innerText()).trim() === "M. Chevallier",
  "et le devis porte le nom SAISI, pas un nom d'exemple"
);

const lignes = page.locator("#devis .ligne-devis .prix");
const nb = await lignes.count();
dire(nb > 0, `le devis porte ses lignes (${nb})`);
for (let i = 0; i < nb; i++) {
  dire(
    (await lignes.nth(i).innerText()).trim() === "à chiffrer",
    `ligne ${i + 1} : « à chiffrer » — aucun montant dicté, aucun inventé`
  );
}
dire(!(await page.locator("#devis").innerText()).includes("€"), "aucun euro sur le devis");

// ── 6. Tout tient sur un écran ────────────────────────────────────────────
console.log("\n  ── Tout sur un écran ──");
for (const hauteur of [700, 667]) {
  const vue = await navigateur.newContext({ viewport: { width: 390, height: hauteur } });
  const petit = await vue.newPage();
  await petit.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });
  const repos = await petit.evaluate(() => document.documentElement.scrollHeight);
  await petit.click("#dicter");
  await petit.waitForTimeout(220);
  const dicte = await petit.evaluate(() => document.documentElement.scrollHeight);
  const pire = Math.max(repos, dicte);
  dire(
    pire <= hauteur,
    `${hauteur} px : rien ne passe sous le pli` +
      (pire > hauteur ? ` — il déborde de ${pire - hauteur} px` : ` (${pire} px)`)
  );
  await vue.close();
}

// ── 7. La teinte se bascule dans les deux sens ────────────────────────────
console.log("\n  ── Clair et fond noir ──");
for (const reglage of ["light", "dark"]) {
  const vue = await navigateur.newContext({
    viewport: { width: 390, height: 700 },
    colorScheme: reglage,
  });
  const teinte = await vue.newPage();
  await teinte.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });
  const fondPage = () => teinte.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const sombre = (c) => {
    const [r, v, b] = c.match(/\d+/g).map(Number);
    return (r + v + b) / 3 < 100;
  };
  const depart = await fondPage();
  dire(sombre(depart) === (reglage === "dark"), `réglage « ${reglage} » : la bonne teinte à l'arrivée`);
  await teinte.click("#teinte");
  const apres = await fondPage();
  dire(sombre(apres) !== sombre(depart), `réglage « ${reglage} » : un appui bascule (${depart} → ${apres})`);
  await teinte.click("#teinte");
  dire(sombre(await fondPage()) === sombre(depart), `réglage « ${reglage} » : un second appui revient`);
  await vue.close();
}

// ── Verdict ───────────────────────────────────────────────────────────────
await navigateur.close();
console.log("");
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} défaut(s) :`);
  plaintes.forEach((p) => console.error(`   · ${p}`));
  process.exit(1);
}
console.log("✓ Ses trois choix tiennent : le bouton à 66 %, les ondes sous 1,5 cm de chaque côté, l'objet au centre entre la poubelle et l'avion — et le bouton s'efface dès qu'on appuie.");
