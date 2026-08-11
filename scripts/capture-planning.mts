// Capture du planning — le mois, la journée ouverte, la pose.
//
// **Sur ce lot, tous les défauts réels se sont vus à l'œil.** Ce script mesure
// ce que l'œil a fini par voir, pour que la prochaine fois il le voie avant.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page arrive alors JAMAIS hydratée.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
if (!dossier) { console.error("usage: capture-planning.mts <dossier>"); process.exit(1); }
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome` : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"], isMobile: true, hasTouch: true,
});
const page = await contexte.newPage();
const echecs: string[] = [];

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);

/**
 * **`checkVisibility` et jamais `display` sur l'élément seul** : vingt lignes
 * gardaient `display:flex` sous un parent caché, et le contrôle restait vert
 * sur un écran vide.
 */
const SONDE = `(() => {
  const vis = (e) => !!e && e.checkVisibility({opacityProperty:true, visibilityProperty:true});
  const grille = document.querySelector("[data-atlas='grille-mois']");
  const cases = [...(grille?.children ?? [])];
  const journee = document.querySelector("[data-atlas='journee']");
  const creneaux = [...document.querySelectorAll("[data-atlas='creneau']")].filter(vis);
  const poser = document.querySelector("[data-atlas='poser']");
  return {
    cases: cases.length,
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(" ").length : null,
    journeeVisible: vis(journee),
    jourOuvert: journee?.getAttribute("data-jour") ?? null,
    creneaux: creneaux.length,
    creneauxAllumes: creneaux.filter((c) => c.getAttribute("aria-pressed") === "true").length,
    libelles: creneaux.map((c) => c.innerText.replace(/\\s+/g, " ").trim()),
    poserVisible: vis(poser),
    poserTexte: poser ? poser.innerText.replace(/\\s+/g, " ").trim() : null,
    quipeQuelquePart: /quipe/i.test(document.body.innerText),
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

async function sonder(quoi: string) {
  const e = (await page.evaluate(SONDE)) as Record<string, unknown>;
  console.log(`  ${quoi} — ${JSON.stringify(e)}`);
  return e;
}

// ─── 1. Le mois ─────────────────────────────────────────────────────────────
let etat = await sonder("le mois");
await page.screenshot({ path: `${dossier}/planning-1-mois.png` });
if (etat.colonnes !== 7) echecs.push(`le calendrier a ${etat.colonnes} colonnes au lieu de sept.`);
if ((etat.cases as number) % 7 !== 0) echecs.push(`${etat.cases} cases : la grille n'est pas faite de semaines entières.`);
if (etat.debordement) echecs.push("la page déborde latéralement.");

/**
 * **Le trait du bandeau doit tomber sous l'onglet ACTIF.** Recopié d'un écran à
 * l'autre, il est resté sous « CHANTIERS » pendant que « PLANNING » était le
 * mot allumé : 77 px d'écart, vu par le patron sur une capture pendant que le
 * contrôle du libellé restait vert. On mesure l'étendue du TEXTE — la boîte du
 * libellé vaut sa colonne entière et masque l'écart.
 */
const trait = (await page.evaluate(`(() => {
  const nav = document.querySelector(".atlas-nav-basse");
  if (!nav) return null;
  const actif = [...nav.querySelectorAll("a")].find((a) => a.getAttribute("aria-current") === "page");
  const barre = nav.querySelector("span[aria-hidden] > span") ?? nav.querySelector("span[aria-hidden]");
  if (!actif || !barre) return null;
  const plage = document.createRange();
  plage.selectNodeContents(actif);
  const t = plage.getBoundingClientRect();
  const b = barre.getBoundingClientRect();
  return { onglet: actif.textContent.trim(), ecart: Math.round(Math.abs((t.x + t.width/2) - (b.x + b.width/2))) };
})()`)) as { onglet: string; ecart: number } | null;
console.log(`  le trait du bandeau — ${JSON.stringify(trait)}`);
if (!trait) echecs.push("impossible de mesurer le trait du bandeau.");
else if (trait.onglet !== "Planning") echecs.push(`l'onglet allumé est « ${trait.onglet} » et non « Planning ».`);
else if (trait.ecart > 24) echecs.push(`le trait tombe à ${trait.ecart} px du centre de « ${trait.onglet} ».`);

// ─── 2. Une journée ouvrable ────────────────────────────────────────────────
const jourOuvrable = (await page.evaluate(`(() => {
  const cases = [...document.querySelectorAll("[data-atlas='grille-mois'] button")];
  const ouvrable = cases.find((c) => {
    const j = c.getAttribute("data-jour");
    const d = new Date(j + "T12:00:00Z").getUTCDay();
    return d !== 0 && d !== 6 && c.getAttribute("data-marque") !== "plein";
  });
  return ouvrable?.getAttribute("data-jour") ?? null;
})()`)) as string | null;
if (!jourOuvrable) { echecs.push("aucun jour ouvrable dans le mois affiché."); }
else {
  await page.click(`[data-atlas='grille-mois'] button[data-jour="${jourOuvrable}"]`);
  await page.waitForTimeout(800);
  etat = await sonder(`la journée du ${jourOuvrable}`);
  await page.screenshot({ path: `${dossier}/planning-2-journee.png` });
  if (etat.journeeVisible !== true) echecs.push("toucher un jour n'ouvre rien.");
  // **La règle du patron, et elle n'est pas cosmétique :** à une seule équipe,
  // le planning n'écrit AUCUN nom d'équipe — pas même dans une phrase
  // d'explication. « S'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas
  // qu'il y ait quand même écrit équipe A équipe B. »
  const combien = (await page.evaluate(`(() => {
    const t = [...document.querySelectorAll("p")].find((p) => p.innerText.includes("Complet"));
    return t ? (t.innerText.match(/vos (\\d+) /)?.[1] ?? "1") : null;
  })()`)) as string | null;
  if (combien === "1" && etat.quipeQuelquePart === true) {
    const ou = await page.evaluate(`(() => [...document.querySelectorAll("p,span,button")]
      .filter((e) => e.children.length === 0 && /quipe/i.test(e.textContent))
      .map((e) => e.textContent.trim()).slice(0, 4))()`);
    echecs.push(`à une seule équipe, le planning écrit quand même « équipe » : ${JSON.stringify(ou)}`);
  }
  if (etat.jourOuvert !== jourOuvrable) echecs.push(`la journée ouverte est ${etat.jourOuvert} et non ${jourOuvrable}.`);
  // Le titre du mois et la journée ouverte doivent parler du MÊME mois : sinon
  // l'écran se contredit et rien ne dit lequel croire.
  const accord = (await page.evaluate(`(() => {
    const j = document.querySelector("[data-atlas='journee']")?.getAttribute("data-jour");
    const titre = document.body.innerText.match(/^(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/mi)?.[1];
    if (!j || !titre) return null;
    const nom = new Date(j + "T12:00:00Z").toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
    return { titre: titre.toLowerCase(), journee: nom };
  })()`)) as { titre: string; journee: string } | null;
  console.log(`  le mois affiché et la journée — ${JSON.stringify(accord)}`);
  if (accord && accord.titre !== accord.journee)
    echecs.push(`le calendrier titre « ${accord.titre} » pendant que la journée ouverte est en ${accord.journee}.`);

  // **La journée doit être À L'ÉCRAN**, pas seulement dans le document : posée
  // plus bas, elle s'ouvrait hors du champ et l'écran paraissait mort.
  const dansLeChamp = (await page.evaluate(`(() => {
    const j = document.querySelector("[data-atlas='journee']");
    if (!j) return null;
    const r = j.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  })()`)) as boolean | null;
  console.log(`  la journée est-elle dans le champ ? ${dansLeChamp}`);
  if (dansLeChamp !== true) echecs.push("la journée s'ouvre hors du champ : l'écran paraît mort sous le doigt.");

  // ─── 3. Choisir une ligne : UNE SEULE s'allume ───────────────────────────
  const libres = await page.locator("[data-atlas='creneau'][data-libre='oui']").count();
  if (libres === 0) echecs.push("aucune demi-journée libre à choisir.");
  else {
    await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
    await page.waitForTimeout(500);
    etat = await sonder("une ligne choisie");
    await page.screenshot({ path: `${dossier}/planning-3-choix.png` });
    // Le piège : `nth-of-type` comptait dans son propre bloc et allumait la
    // ligne sur le matin ET l'après-midi à la fois.
    if (etat.creneauxAllumes !== 1) echecs.push(`${etat.creneauxAllumes} lignes s'allument à la fois au lieu d'une seule.`);
    // **Deux fois la même information sur une ligne, c'est une de trop.** À une
    // seule équipe, « Libre » s'écrivait des deux côtés du même filet.
    const redite = (etat.libelles as string[]).find((l) => /^(\S+)\s+\1$/.test(l.trim()));
    if (redite) echecs.push(`une ligne écrit deux fois la même chose : « ${redite} »`);
    if (etat.poserVisible !== true) echecs.push("le bouton « Poser » ne paraît pas une fois l'équipe choisie.");
    else if (!String(etat.poserTexte).startsWith("Poser ·")) echecs.push(`le bouton dit « ${etat.poserTexte} ».`);
  }
}

// ─── 4. Un samedi ne se propose jamais ──────────────────────────────────────
const samedi = (await page.evaluate(`(() => {
  const c = [...document.querySelectorAll("[data-atlas='grille-mois'] button")]
    .find((c) => new Date(c.getAttribute("data-jour") + "T12:00:00Z").getUTCDay() === 6);
  return c?.getAttribute("data-jour") ?? null;
})()`)) as string | null;
if (samedi) {
  await page.click(`[data-atlas='grille-mois'] button[data-jour="${samedi}"]`);
  await page.waitForTimeout(700);
  etat = await sonder(`le samedi ${samedi}`);
  await page.screenshot({ path: `${dossier}/planning-4-samedi.png` });
  if (etat.creneaux !== 0) echecs.push(`un samedi propose ${etat.creneaux} demi-journée(s).`);
  const dit = await page.locator("[data-atlas='journee']").innerText();
  if (!/lundi/i.test(dit)) echecs.push("le samedi ne rappelle pas qu'un chantier parti vendredi finit lundi.");
}

// ─── 5. À DEUX ÉQUIPES : l'écran nomme, et le repli se voit ────────────────
//
// C'est l'autre moitié de la règle : on n'invente jamais un nom, mais on ne
// laisse jamais deux lignes indiscernables.
await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
await page.waitForSelector('button[aria-label="Une équipe de plus"]', { timeout: 60000 });
await page.click('button[aria-label="Une équipe de plus"]');
await page.waitForTimeout(900);
const champA = page.locator('input[aria-label="Nom de l\'équipe A"]');
await champA.fill("Théo");
await champA.blur();
await page.waitForTimeout(700);
// **Vider un champ doit RENDRE le repli**, pas écrire une chaîne vide : sinon
// la base porterait deux façons de dire « pas de nom ». On efface donc B
// explicitement — ce qui éprouve la règle et remet l'essai à plat, quel que
// soit ce qu'une exécution précédente y a laissé.
const champB2 = page.locator('input[aria-label="Nom de l\'équipe B"]');
await champB2.fill("");
await champB2.blur();
await page.waitForTimeout(900);

await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 60000 });
const ouvrable2 = (await page.evaluate(`(() => {
  const cases = [...document.querySelectorAll("[data-atlas='grille-mois'] button")];
  const c = cases.find((c) => {
    const j = c.getAttribute("data-jour");
    const d = new Date(j + "T12:00:00Z").getUTCDay();
    return d !== 0 && d !== 6 && c.getAttribute("data-marque") !== "plein";
  });
  return c?.getAttribute("data-jour") ?? null;
})()`)) as string | null;
if (ouvrable2) {
  await page.click(`[data-atlas='grille-mois'] button[data-jour="${ouvrable2}"]`);
  await page.waitForTimeout(800);
  etat = await sonder("à deux équipes");
  await page.screenshot({ path: `${dossier}/planning-5-deux-equipes.png` });
  const lus = (etat.libelles as string[]).join(" | ");
  // Une nommée, l'autre non : nommer l'une n'oblige pas l'autre.
  if (!lus.includes("Théo")) echecs.push(`le nom écrit n'apparaît pas au planning : ${lus}`);
  if (!lus.includes("Équipe B")) echecs.push(`le repli « Équipe B » n'apparaît pas : ${lus}`);
  if (lus.includes("Équipe A")) echecs.push(`« Équipe A » est écrit alors que cette équipe porte un nom : ${lus}`);
  if ((etat.creneaux as number) !== 4) echecs.push(`${etat.creneaux} lignes au lieu de quatre (deux équipes × deux demi-journées).`);

  await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
  await page.waitForTimeout(500);
  etat = await sonder("une ligne choisie, à deux équipes");
  await page.screenshot({ path: `${dossier}/planning-6-poser-nomme.png` });
  if (etat.creneauxAllumes !== 1) echecs.push(`${etat.creneauxAllumes} lignes allumées à la fois.`);
  if (!String(etat.poserTexte).includes("Théo"))
    echecs.push(`le bouton ne dit pas le vrai nom de l'équipe : « ${etat.poserTexte} »`);
}

// On remet le compteur où on l'a trouvé : un contrôle ne laisse pas l'écran
// du patron dans un état qu'il n'a pas choisi.
await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
await page.waitForSelector('button[aria-label="Une équipe de moins"]', { timeout: 60000 });
await page.click('button[aria-label="Une équipe de moins"]');
await page.waitForTimeout(900);

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ Le planning tient. Captures dans ${dossier}`);
