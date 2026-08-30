#!/usr/bin/env node
/*
  Éprouve `appli/note-vocale-au-repos.html` — les cinq visuels de la note vocale
  AVANT qu'on appuie, et le bouton qui disparaît pendant qu'on dicte.

  **D'où elle vient.** Sa demande du 30 août 2026 :

    *« Je veux que lorsque l'utilisateur clique sur le bouton de la note vocale,
    le bouton "Je rédige à la main" disparaisse pour ne plus avoir de confusion
    possible. […] Fais-moi plusieurs visuels pour changer la note vocale AVANT
    qu'on appuie dessus. Ne touche plus à la maquette que tu viens de me faire.
    Pas besoin de visuel pour le bouton qui disparaît, seulement des propositions
    pour le visuel de la note vocale. »*

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT.

  1. **LE BOUTON DISPARAÎT DÈS L'APPUI, dans les CINQ.** C'est la seule chose
     qu'il ait tranchée sans vouloir de proposition : elle doit donc valoir
     partout, et pas seulement là où l'on a pensé à l'écrire.

     **Et il DISPARAÎT — il ne se grise pas.** Le contrôle exige qu'il ne soit
     plus dans la mise en page du tout : un bouton éteint reste un bouton, on
     l'appuie, il ne répond pas, et l'on croit l'écran cassé.

  2. **Il REVIENT quand on jette la note.** L'autre moitié de la même règle :
     sans elle, jeter laisserait l'écran amputé de sa seule autre issue.

  3. **Les cinq repos existent, et un seul à la fois.** Deux visibles ensemble,
     ce serait deux micros pour un seul geste.

  4. **Chacun se touche : 44 px au moins.** C'est un écran de chantier, parfois
     avec des gants — la mesure vaut pour le dessin le plus discret comme pour
     le plus gros.

  5. **Rien d'autre ne change d'une proposition à l'autre** — même barre
     d'enregistrement, même devis. Sinon il choisirait un écran au lieu d'un
     dessin.

  6. **Tout tient sur un écran, sans défiler**, à 700 points (la bande utile
     mesurée sur sa capture) et à 667 (un iPhone SE), au repos ET en dictant,
     pour les cinq.

  7. **La teinte se bascule dans les deux sens**, depuis les deux réglages
     système : sur un téléphone déjà en sombre, une bascule écrite à la va-vite
     ne sait pas revenir au clair.

  8. **Aucun prix n'est inventé** (`CLAUDE.md` §4), et le devis porte le nom
     SAISI, pas un nom d'exemple.

  **Il sait échouer.** Éprouvé en laissant le bouton à l'écran pendant la
  dictée, en le grisant au lieu de le retirer, en oubliant de le rendre après
  un rejet, en rendant deux repos visibles à la fois, en rapetissant un repos
  sous 44 px, et en relâchant les espaces du formulaire : chacun rougit, en
  nommant le point exact.

  Usage : node scripts/verifier-maquette-note-vocale-au-repos.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "note-vocale-au-repos.html"));

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

const REPOS = ["A", "B", "C", "D", "E"];

const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => plaintes.push(`script en défaut : ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") plaintes.push(`erreur de console : ${m.text()}`);
});

// `networkidle` : sans la mise en page appliquée, toutes les largeurs valent
// zéro et le contrôle rendrait un vert qui ne prouve rien.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La note vocale avant qu'on appuie ===\n");

dire(
  (await page.locator(".onglets button[data-repos]").count()) === REPOS.length,
  `cinq repos sont proposés (${await page.locator(".onglets button[data-repos]").count()})`
);

/**
 * Le bouton est-il DANS la mise en page ?
 *
 * `offsetParent === null` dit « retiré », pas « pâli » : c'est exactement la
 * distinction qu'il demande. Un bouton `opacity:.3` resterait, lui, visible et
 * cliquable — donc toujours une occasion de se tromper.
 */
const boutonPresent = () =>
  page.evaluate(() => {
    const b = document.querySelector("#ecrire");
    return b !== null && b.offsetParent !== null;
  });

for (const repos of REPOS) {
  console.log(`\n  ── Repos ${repos} ──`);
  await page.click(`.onglets button[data-repos="${repos}"]`);
  await page.waitForTimeout(80);

  // ── Un seul repos à l'écran ────────────────────────────────────────────
  const vus = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-repos-vue]"))
      .filter((v) => v.offsetParent !== null)
      .map((v) => v.id)
  );
  dire(
    vus.length === 1 && vus[0] === "r" + repos,
    `${repos} · un seul dessin à l'écran, et c'est le bon (${vus.join(" · ") || "aucun"})`
  );

  // ── Il se touche ───────────────────────────────────────────────────────
  const geste = page.locator(`#r${repos} [data-dicter], #r${repos}[data-dicter]`).first();
  const boite = await geste.boundingBox();
  dire(
    boite !== null && boite.width >= 44 && boite.height >= 44,
    `${repos} · le geste fait au moins 44 px (mesuré : ${boite ? `${boite.width}×${boite.height}` : "rien à mesurer"})`
  );

  // ── LE BOUTON : là avant, parti pendant, revenu après ──────────────────
  dire(await boutonPresent(), `${repos} · « Je rédige à la main » est là avant qu'on parle`);

  await geste.click();
  await page.waitForTimeout(150);
  dire(
    await page.locator("#enregistrement").isVisible(),
    `${repos} · l'appui ouvre l'enregistrement`
  );
  dire(
    !(await boutonPresent()),
    `${repos} · et « Je rédige à la main » DISPARAÎT — plus de confusion possible`
  );

  // Le rejet rend l'écran à ce qu'il était : c'est l'autre moitié de la règle.
  await page.click("#jeter");
  await page.waitForTimeout(120);
  dire(await boutonPresent(), `${repos} · jeter la note ramène le bouton`);
  dire(
    !(await page.locator("#enregistrement").isVisible()),
    `${repos} · et l'enregistrement a disparu`
  );

  // ── L'enregistrement est le MÊME pour les cinq ─────────────────────────
  await geste.click();
  await page.waitForTimeout(120);
  for (const [quoi, sel] of [["la poubelle", "#jeter"], ["la pause", "#pause"], ["l'avion", "#envoyer"]]) {
    dire(await page.locator(sel).isVisible(), `${repos} · ${quoi} est là, comme dans les autres`);
  }
  await page.fill("#nom", `M. Repos ${repos}`);
  await page.click("#envoyer");
  await page.waitForTimeout(1800);
  dire(
    await page.locator("#devis").evaluate((e) => e.classList.contains("actif")),
    `${repos} · l'avion mène au devis`
  );
  dire(
    (await page.locator("#devis-nom").innerText()).trim() === `M. Repos ${repos}`,
    `${repos} · et le devis porte le nom SAISI, pas un nom d'exemple`
  );
}

// ── Aucun prix inventé ─────────────────────────────────────────────────────
console.log("\n  ── Le devis ──");
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

// ── Tout tient sur un écran, pour les cinq ────────────────────────────────
console.log("\n  ── Tout sur un écran ──");
for (const hauteur of [700, 667]) {
  const vue = await navigateur.newContext({ viewport: { width: 390, height: hauteur } });
  const petit = await vue.newPage();
  await petit.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });
  for (const repos of REPOS) {
    await petit.click(`.onglets button[data-repos="${repos}"]`);
    await petit.waitForTimeout(80);
    const auRepos = await petit.evaluate(() => document.documentElement.scrollHeight);
    await petit.locator(`#r${repos} [data-dicter], #r${repos}[data-dicter]`).first().click();
    await petit.waitForTimeout(200);
    const enDictee = await petit.evaluate(() => document.documentElement.scrollHeight);
    const pire = Math.max(auRepos, enDictee);
    dire(
      pire <= hauteur,
      `${hauteur} px · repos ${repos} : rien ne passe sous le pli` +
        (pire > hauteur ? ` — il déborde de ${pire - hauteur} px` : ` (${pire} px)`)
    );
    await petit.click("#jeter");
    await petit.waitForTimeout(80);
  }
  await vue.close();
}

// ── La teinte se bascule dans les deux sens ───────────────────────────────
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

  // Le bouton doit être ENTIER à l'écran : cinq onglets débordent d'un écran de
  // téléphone, et une bascule partie avec eux ne se trouve pas au doigt.
  const cadre = await teinte.locator("#teinte").boundingBox();
  const large = await teinte.evaluate(() => window.innerWidth);
  dire(
    cadre !== null && cadre.x >= 0 && cadre.x + cadre.width <= large,
    `réglage « ${reglage} » : la bascule est entière à l'écran`
  );

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
console.log("✓ La planche tient : cinq repos essayables, le bouton disparaît dès l'appui dans les cinq et revient si l'on jette, et tout entre dans un écran.");
