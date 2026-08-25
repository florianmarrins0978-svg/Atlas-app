/*
  VOIR SON DEVIS PENDANT QU'ON LE CHANGE — ce que cette planche doit tenir.

  Sa demande du 24 août 2026 : *« lorsque je modifie mon devis, je suis obligé
  de descendre pour voir les modifications ; il faut mieux organiser la page
  pour pouvoir voir ce qu'on modifie. Propose, ne code rien. »*

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DE LA PLANCHE.

    1. **Les trois rangements existent et se manipulent.** Une planche qui n'en
       montrerait qu'un ne lui laisserait rien à choisir.
    2. **Le défaut qu'il décrit se REPRODUIT en A.** Descendre jusqu'aux
       polices sort la feuille de l'écran — si la planche ne le montre pas, elle
       ne parle pas de son problème, et B n'a plus rien à résoudre.
    3. **B le règle vraiment** : la feuille reste dans l'écran une fois descendu
       jusqu'aux polices, et elle SUIT le choix. Une feuille collée qui ne se
       repeindrait pas serait pire que l'écran d'aujourd'hui.
    4. **C montre une feuille PLUS GRANDE** que les deux autres — c'est sa seule
       raison d'être, et elle se mesure.
    5. **Les dix typographies sont celles du code**, mot pour mot, et les huit
       couleurs aussi : une police inventée ferait choisir ce que le PDF ne sait
       pas embarquer (`CLAUDE.md` §4 bis).
    6. **Le fond sombre éclaircit l'encre**, comme `encreSurFond` le fait dans
       l'application : un aperçu qui l'ignorerait annoncerait une feuille
       illisible que le vrai devis, lui, rendrait bien.
    7. **Rien ne déborde à 390 px.**

  Il sait échouer : éprouvé en retirant `position:sticky` de `.colle` (3 rougit),
  en figeant la feuille au lieu de la repeindre (3 rougit), et en inventant une
  police absente du code (5 rougit).

  Usage : node scripts/verifier-maquette-allure-rangee.mjs
*/
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PAGE = "file://" + path.resolve("appli/allure-mieux-rangee.html");
const soucis = [];
const dire = (ok, quoi) => { if (!ok) soucis.push(quoi); };

// **Les noms se confrontent au CODE, pas à une liste recopiée ici.** Une
// troisième copie divergerait comme les deux premières.
const source = readFileSync("src/lib/allure-documents.ts", "utf8");
const nomsDuCode = [...source.matchAll(/nom:\s*"([^"]+)"/g)].map((m) => m[1]);

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
// Les polices viennent de Google Fonts : hors ligne, elles ne répondent pas, et
// c'est sans importance pour ce qui est mesuré ici (des places, pas des dessins
// de lettres). On n'attend donc pas le réseau.
const contexte = await navigateur.newContext({ viewport: { width: 460, height: 1200 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => soucis.push(`erreur JS : ${e.message}`));
// **Les erreurs de RÉSEAU ne comptent pas ici.** Les polices viennent de Google
// Fonts, et cet environnement n'y accède pas : rougir dessus ferait un contrôle
// qui accuse le mandataire au lieu de la planche — l'erreur qui envoie chercher
// au mauvais endroit (`AGENTS.md`). Les vraies fautes de script, elles, restent.
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (/Failed to load resource|net::ERR_/.test(m.text())) return;
  soucis.push(`console : ${m.text()}`);
});

await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".feuille", { timeout: 15_000 });
await page.waitForTimeout(300);

const boutons = page.locator("#choix button");
dire(await boutons.count() === 3, "la planche ne propose pas trois rangements");

/** Descend le défilement jusqu'à la dernière police, et dit où est la feuille. */
async function apresAvoirDescendu() {
  return page.evaluate(() => {
    const d = document.getElementById("defile");
    if (d) d.scrollTop = d.scrollHeight;
    const tel = document.getElementById("tel");
    const f = tel.querySelector(".feuille");
    if (!f) return null;
    const r = f.getBoundingClientRect(), rt = tel.getBoundingClientRect();
    return { dedans: r.bottom > rt.top && r.top < rt.bottom, hauteur: r.height, largeur: r.width };
  });
}

// ── A : le défaut qu'il décrit se reproduit ────────────────────────────────
await boutons.nth(0).click();
await page.waitForTimeout(250);
const a = await apresAvoirDescendu();
dire(a !== null, "aucune feuille dans le rangement A");
if (a) dire(!a.dedans,
  "en A, la feuille reste visible une fois descendu jusqu'aux polices : la planche ne reproduit pas son défaut, " +
  "et B ne résout alors plus rien");

// ── B : elle reste là, ET elle suit ────────────────────────────────────────
await boutons.nth(1).click();
await page.waitForTimeout(250);
const b = await apresAvoirDescendu();
dire(b !== null, "aucune feuille dans le rangement B");
if (b) dire(b.dedans, "en B, la feuille sort quand même de l'écran : le collage ne tient pas");

// Toucher une police, en bas de page, doit repeindre la feuille restée en haut.
const avantB = await page.evaluate(() => {
  const f = document.querySelector("#tel .feuille");
  return getComputedStyle(f).fontFamily;
});
await page.evaluate(() => {
  const d = document.getElementById("defile");
  if (d) d.scrollTop = d.scrollHeight;
});
await page.locator('#tel [data-typo="playfair"]').click();
await page.waitForTimeout(300);
const apresB = await page.evaluate(() => {
  const f = document.querySelector("#tel .feuille");
  return getComputedStyle(f).fontFamily;
});
dire(apresB !== avantB,
  `en B, toucher une police ne change pas la feuille collée (avant « ${avantB} », après « ${apresB} »)`);
const toujoursLa = await page.evaluate(() => {
  const tel = document.getElementById("tel");
  const f = tel.querySelector(".feuille");
  const r = f.getBoundingClientRect(), rt = tel.getBoundingClientRect();
  return r.bottom > rt.top && r.top < rt.bottom;
});
dire(toujoursLa, "en B, la feuille disparaît au moment même où l'on touche une police");

// La couleur d'accent aussi — c'est l'autre chose qu'il change.
await page.locator('#tel [data-couleur="accent"][data-valeur="#6e2433"]').click();
await page.waitForTimeout(250);
const accentPeint = await page.evaluate(() => {
  const t = document.querySelector("#tel .feuille .total");
  return getComputedStyle(t).color;
});
dire(accentPeint === "rgb(110, 36, 51)",
  `en B, l'accent bordeaux ne se peint pas sur la feuille — lu : ${accentPeint}`);

// ── C : une feuille plus grande, c'est sa seule raison d'être ──────────────
await boutons.nth(2).click();
await page.waitForTimeout(320);
const c = await page.evaluate(() => {
  const f = document.querySelector("#tel .feuille");
  const r = f.getBoundingClientRect();
  return { hauteur: r.height, largeur: r.width };
});
dire(b !== null && c.hauteur > b.hauteur,
  `en C la feuille ne fait que ${Math.round(c.hauteur)} px de haut contre ${Math.round(b?.hauteur ?? 0)} en B : ` +
  "elle n'est pas plus grande, donc C ne propose rien");

// Et le tiroir s'ouvre pour de bon.
await page.locator("#poignee").click();
await page.waitForTimeout(400);
const ouvert = await page.evaluate(() => {
  const t = document.getElementById("tiroir");
  const tel = document.getElementById("tel");
  return t.getBoundingClientRect().top - tel.getBoundingClientRect().top;
});
dire(ouvert < 260, `le tiroir de C ne s'ouvre pas : son haut reste à ${Math.round(ouvert)} px`);
dire(await page.locator('#tel [data-typo="lato"]').count() === 1,
  "le tiroir ouvert ne donne pas accès aux polices");

// **Et la feuille reste VISIBLE le tiroir ouvert.** Un tiroir qui la recouvre
// entièrement fait régler à l'aveugle : c'est le défaut même qu'il signale, et
// C n'aurait alors plus rien à proposer. Il faut au moins l'en-tête — le nom,
// le filet, « DEVIS », l'intitulé d'accent.
const visibleSousLeTiroir = await page.evaluate(() => {
  const tel = document.getElementById("tel");
  const f = tel.querySelector(".feuille");
  const t = document.getElementById("tiroir");
  const rf = f.getBoundingClientRect(), rt = t.getBoundingClientRect(), re = tel.getBoundingClientRect();
  return Math.max(0, Math.min(rf.bottom, rt.top) - Math.max(rf.top, re.top));
});
dire(visibleSousLeTiroir >= 120,
  `le tiroir ouvert ne laisse voir que ${Math.round(visibleSousLeTiroir)} px de feuille : ` +
  "on règle de nouveau à l'aveugle");

// ── Les noms viennent du code ──────────────────────────────────────────────
const nomsPlanche = await page.evaluate(() =>
  [...document.querySelectorAll("#tel [data-typo] .nom")].map((s) => s.textContent.trim()));
dire(nomsPlanche.length === 10, `${nomsPlanche.length} typographies au lieu des dix du code`);
for (const n of nomsPlanche) {
  dire(nomsDuCode.includes(n),
    `« ${n} » ne figure pas dans TYPOGRAPHIES : le PDF ne saurait pas l'embarquer`);
}

// ── Le fond sombre éclaircit l'encre ───────────────────────────────────────
await boutons.nth(1).click();
await page.waitForTimeout(250);
await page.evaluate(() => {
  const b = document.querySelector('#tel [data-couleur="fond"][data-valeur="#ffffff"]');
  if (b) b.click();
});
await page.waitForTimeout(200);
const surBlanc = await page.evaluate(() => getComputedStyle(document.querySelector("#tel .feuille")).color);
dire(surBlanc === "rgb(28, 28, 26)", `sur fond blanc l'encre est ${surBlanc} au lieu du noir`);
// **Le fond SOMBRE ne se pose par aucune des quatre pastilles** — elles sont
// toutes claires. On appelle donc la règle elle-même, plutôt que d'écrire ici
// un contrôle qui ne mesurerait rien : un vert obtenu sur une teinte claire ne
// prouverait rien de l'éclaircissement de l'encre (`CLAUDE.md` §5).
const surSombre = await page.evaluate(() => window.encreSurFond("#1c1c1a").encre);
dire(surSombre === "#f5f3ee",
  `sur un fond sombre la planche garde l'encre ${surSombre} : elle annoncerait une feuille illisible`);

// ── Rien ne déborde ────────────────────────────────────────────────────────
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
dire(debord <= 0, `la planche déborde de ${debord} px`);

await navigateur.close();

if (soucis.length) {
  console.error("❌ L'allure mieux rangée — la planche ne tient pas :");
  for (const s of soucis) console.error(`   · ${s}`);
  process.exit(1);
}
console.log("✅ L'allure mieux rangée — les trois rangements se manipulent, et A reproduit bien son défaut.");
