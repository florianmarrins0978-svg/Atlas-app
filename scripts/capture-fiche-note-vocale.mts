/**
 * La fiche chantier dans ses cinq états — et ce que l'œil ne peut pas mesurer.
 *
 * **Pourquoi ce script existe.** Sur ce lot de maquettes, TOUS les défauts ont
 * été trouvés à l'œil et aucun aux contrôles : un libellé imprimé par-dessus
 * un autre, une consigne qui annonçait l'inverse du geste, une poignée de
 * tiroir qui ne se dessinait pas, une case tactile qui mesurait zéro pixel.
 * Les captures sont donc la moitié du travail — l'autre moitié est ici.
 *
 * Ce qu'il vérifie, et qu'aucune capture ne dit :
 *
 *   - **la prise de l'anneau fait 76 px** quand le trait n'en dessine que 56,
 *     et son centre tombe dans sa propre cible ;
 *   - **tout est en pause au repos** — une onde qui bat quand rien ne joue
 *     fait croire qu'un son sort du téléphone ;
 *   - **les ailes ne prennent pas le doigt** (`pointer-events: none`) ;
 *   - **le déclencheur s'efface AVEC la note**. C'est le défaut qui a coûté le
 *     plus cher : « Retirer » restait allumé et s'imprimait par-dessus
 *     « Annuler ». Il se lit par `checkVisibility({opacityProperty:true})` —
 *     l'opacité de l'élément seul ne dit rien de celle héritée de son parent,
 *     et un libellé effacé passait sinon pour visible ;
 *   - **la case « + » vient en PREMIER** dans la pellicule, et la ligne
 *     « Photos · N » a bien disparu des étapes.
 *
 *   npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <chantierId>
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const dossier = process.argv[2];
const chantierId = process.argv[3];
// `localhost` et non `127.0.0.1` : Next refuse d'y servir ses ressources de
// développement, la page arrive alors jamais hydratée et l'on clique dans le
// vide (`ARCHITECTURE.md` §48).
const base = `http://localhost:${process.env.PORT_BANC ?? "3000"}`;

if (!dossier || !chantierId) {
  console.error("usage : npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <chantierId>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome`
    : undefined;
}

/** Ce que le navigateur seul peut dire de l'écran. */
const SONDE = `(() => {
  const q = (s) => document.querySelector(s);
  const vis = (s) => { const e = q(s); return e ? e.checkVisibility({opacityProperty:true, visibilityProperty:true}) : null; };
  const boite = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); };
  const anim = (s) => { const e = q(s); return e ? getComputedStyle(e).animationPlayState : null; };
  const a = q(".atlas-anneaux");
  let centreDansLaCible = null;
  if (a) {
    const r = a.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    centreDansLaCible = el ? !!el.closest(".atlas-anneaux") : false;
  }
  return {
    prise: boite(".atlas-anneaux"),
    centreDansLaCible,
    traits: anim(".atlas-traits i"),
    ailes: anim(".atlas-aile i"),
    ailesPrennentLeDoigt: q(".atlas-aile") ? getComputedStyle(q(".atlas-aile")).pointerEvents !== "none" : null,
    chronoVisible: vis(".atlas-chrono"),
    chrono: q(".atlas-chrono") ? q(".atlas-chrono").innerText.replace(/\\s+/g, " ") : null,
    retirerVisible: vis(".atlas-fosse"),
    // **Un élément visible et touchable peut être au mauvais endroit.**
    // « Retirer » se dessinait collé au bord gauche, son R à moitié hors de
    // l'écran, pendant que tous les contrôles passaient : il existait, il
    // était visible, il répondait au doigt. On mesure donc son écart au centre
    // — c'est ce que l'œil voit, et rien d'autre ne le disait.
    ecartAuCentre: (() => {
      const e = q(".atlas-fosse");
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return Math.round(Math.abs(r.x + r.width / 2 - window.innerWidth / 2));
    })(),
    indiceVisible: vis(".atlas-indice"),
    indice: q(".atlas-indice") ? q(".atlas-indice").innerText : null,
    annulerVisible: vis(".atlas-note-retiree button"),
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

const navigateur = await chromium.launch({
  executablePath: navigateurPreInstalle(),
  // Sans son, `play()` est refusé et la lecture ne partirait jamais : on
  // éprouverait alors un écran qui ne joue pas, ce qui ne prouve rien.
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const contexte = await navigateur.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${base}/`, { timeout: 60_000 });

await page.goto(`${base}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
try {
  await page.locator("[data-atlas='anneau-note-vocale']").waitFor({ state: "attached", timeout: 60_000 });
} catch {
  console.error("✗ L'anneau n'est pas sur la fiche — ce contrôle n'a rien éprouvé.");
  await navigateur.close();
  process.exit(1);
}
await page.waitForTimeout(900);

const echecs: string[] = [];
async function sonder(quoi: string) {
  const e = (await page.evaluate(SONDE)) as Record<string, unknown>;
  console.log(`  ${quoi} —`, JSON.stringify(e));
  return e;
}

// ─── 1. Au repos ─────────────────────────────────────────────────────────
let etat = await sonder("au repos");
await page.screenshot({ path: `${dossier}/fiche-1-repos.png` });
if (etat.prise !== "76x76") echecs.push(`la prise de l'anneau mesure ${etat.prise} au lieu de 76x76.`);
if (etat.centreDansLaCible !== true) echecs.push("le centre de l'anneau ne tombe pas dans sa propre cible.");
if (etat.traits !== "paused" || etat.ailes !== "paused") {
  echecs.push("l'onde bat alors que rien ne joue : on croirait qu'un son sort du téléphone.");
}
if (etat.ailesPrennentLeDoigt !== false) echecs.push("les ailes prennent le doigt : un barreau volera l'appui de l'anneau.");
if (etat.chronoVisible !== false) echecs.push("le compteur s'affiche au repos.");
if (etat.indice !== "Poussez l'anneau vers le haut") {
  echecs.push(`la consigne dit « ${etat.indice} » : elle doit dire le geste réel.`);
}
if (etat.debordement) echecs.push("la page déborde latéralement.");

// ─── 2. En lecture ───────────────────────────────────────────────────────
await page.locator(".atlas-anneaux").click();
await page.waitForTimeout(1800);
etat = await sonder("en lecture");
await page.screenshot({ path: `${dossier}/fiche-2-lecture.png` });
if (etat.traits !== "running" || etat.ailes !== "running") echecs.push("l'onde ne bat pas pendant la lecture.");
if (etat.chronoVisible !== true) echecs.push("le compteur n'apparaît pas à la lecture.");
if (typeof etat.chrono === "string" && /^0:00\s/.test(etat.chrono)) {
  echecs.push(`le compteur reste à ${etat.chrono} : il ne suit pas la lecture réelle.`);
}

// Le second appui arrête tout.
await page.locator(".atlas-anneaux").click();
await page.waitForTimeout(700);
etat = await sonder("après le second appui");
if (etat.traits !== "paused" || etat.ailes !== "paused") echecs.push("le second appui n'arrête pas l'onde.");

// ─── 3. Le retrait découvert (on pousse l'anneau vers le haut) ───────────
await page.locator(".atlas-glisseur").evaluate((el) => {
  el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
});
await page.waitForTimeout(600);
etat = await sonder("« Retirer » découvert");
await page.screenshot({ path: `${dossier}/fiche-3-retrait-decouvert.png` });
if (etat.retirerVisible !== true) echecs.push("« Retirer » ne se découvre pas quand on pousse l'anneau vers le haut.");
if (typeof etat.ecartAuCentre === "number" && etat.ecartAuCentre > 4) {
  echecs.push(`« Retirer » n'est pas centré : ${etat.ecartAuCentre} px d'écart, il sort par le bord.`);
}

// ─── 4. Retirée, avec « Annuler » ────────────────────────────────────────
await page.locator(".atlas-fosse").click();
await page.waitForTimeout(1400);
etat = await sonder("retirée");
await page.screenshot({ path: `${dossier}/fiche-4-retiree.png` });
if (etat.annulerVisible !== true) echecs.push("« Annuler » n'apparaît pas après le retrait.");
// LE défaut de ce lot : le déclencheur restait allumé par-dessus « Annuler ».
if (etat.retirerVisible !== false) {
  echecs.push("« Retirer » reste allumé après le retrait : il s'imprime par-dessus « Annuler ».");
}
if (etat.indiceVisible !== false) {
  echecs.push("la consigne « Poussez l'anneau » reste allumée alors que l'anneau est parti.");
}

// « Annuler » rend la note.
await page.locator(".atlas-note-retiree button").click();
await page.waitForTimeout(900);
etat = await sonder("après « Annuler »");
if (etat.retirerVisible !== true || etat.annulerVisible !== false) {
  echecs.push("« Annuler » n'a pas rendu la note : l'anneau n'est pas revenu.");
}

// ─── 5. Le tiroir ouvert, avec la pellicule ──────────────────────────────
const peek = (await page.evaluate(`(() => {
  const t = document.querySelector("[data-atlas='tiroir-fiche']");
  const nav = document.querySelector(".atlas-nav-basse");
  return Math.round(nav.getBoundingClientRect().top - t.getBoundingClientRect().top);
})()`)) as number;
// Mesuré contre le haut RÉEL de la barre du bas : la variable de réserve
// annonce 68 px là où la barre en occupe 49, et s'y fier laissait dix-neuf
// pixels de pellicule affleurer sous le résumé.
console.log(`  au repos, le tiroir laisse dépasser ${peek} px`);
if (peek > 70) {
  echecs.push(`le tiroir laisse dépasser ${peek} px au repos : une bande de pellicule affleure sous le résumé.`);
}

await page.locator("[data-atlas='tiroir-fiche'] button").first().click();
await page.waitForTimeout(900);
const tiroir = (await page.evaluate(`(() => {
  const pel = document.querySelector(".atlas-pellicule");
  if (!pel) return null;
  const premier = pel.firstElementChild;
  const r = premier.getBoundingClientRect();
  const poi = document.querySelector("[data-atlas='tiroir-fiche'] span[aria-hidden='true']");
  const pr = poi ? poi.getBoundingClientRect() : null;
  return {
    premier: (premier.getAttribute("aria-label") || "").trim(),
    tailleCase: Math.round(r.width) + "x" + Math.round(r.height),
    scrollPaddingLeft: getComputedStyle(pel).scrollPaddingLeft,
    poignee: pr ? Math.round(pr.width) + "x" + Math.round(pr.height) : null,
    etapes: Array.from(document.querySelectorAll("[data-atlas='tiroir-fiche'] a")).map((a) => a.innerText.replace(/\\s+/g, " ")).filter((t) => t.length),
    ouvert: document.querySelector("[data-atlas='tiroir-fiche']").getAttribute("data-ouvert"),
  };
})()`)) as Record<string, unknown> | null;
console.log("  tiroir ouvert —", JSON.stringify(tiroir));
await page.screenshot({ path: `${dossier}/fiche-5-tiroir.png` });

if (!tiroir) {
  echecs.push("aucune pellicule dans le tiroir.");
} else {
  if (tiroir.premier !== "Ajouter des photos") {
    echecs.push(`la pellicule commence par « ${tiroir.premier} » : la case « + » doit venir en premier.`);
  }
  if (tiroir.scrollPaddingLeft !== "26px") {
    echecs.push(`scroll-padding-left vaut ${tiroir.scrollPaddingLeft} : la première photo arrivera coupée.`);
  }
  // Une poignée qui ne se dessine pas est l'un des défauts déjà payés.
  if (tiroir.poignee !== "36x3") echecs.push(`la poignée du tiroir mesure ${tiroir.poignee} au lieu de 36x3.`);
  const etapes = (tiroir.etapes as string[]) ?? [];
  if (etapes.some((t) => /^Photos\b/.test(t))) {
    echecs.push("la ligne « Photos · N » est encore là : elle compte ce que la pellicule montre déjà.");
  }
}

if (echecs.length > 0) {
  console.error(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.error(`   — ${e}`);
  await navigateur.close();
  process.exit(1);
}
console.log(`\n✅ La fiche tient ses cinq états. Captures dans ${dossier}`);
await navigateur.close();
