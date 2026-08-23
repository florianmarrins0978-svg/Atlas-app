/*
  Contrôle de la planche « le planning : la ligne, et l'équipe » — JavaScript
  coupé, iPhone 13, meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LES DEUX LIGNES PORTENT LE MÊME CONTENU. C'est une comparaison : si le
      nom ou la date changeaient d'un écran à l'autre, le patron comparerait
      deux contenus au lieu de comparer un écart.
    · LE DÉCALAGE SE MESURE, il ne se raconte pas. La planche promet « 24 px » ;
      un contrôle qui ne mesurerait rien laisserait passer une planche qui
      montre le contraire de ce qu'elle annonce — c'est déjà arrivé le 14 août
      sur la hauteur d'un écran.
    · LE CHEVRON GROSSIT, MAIS PAS SA CIBLE. 44 px, sinon le geste se rate deux
      fois sur trois avec des gants — et il le rapporterait comme « ça ne marche
      pas ».
    · LA LIGNE « ÉQUIPE » NE PROMET PAS DE DÉPLACER LA DATE. Un chantier validé
      par le client est celui qu'on ne veut plus bouger ; l'écran doit le dire.
    · LA RÈGLE DE L'ÉQUIPE UNIQUE EST RAPPELÉE. C'est elle qui explique que son
      planning n'affiche aucun nom, et c'est la question qu'il a posée.

  Chacun sait échouer : changer une date d'un seul côté rougit le premier,
  retirer `.decale .chev{margin-right:-2px}` rougit le deuxième, rétrécir le
  carré du chevron rougit le troisième, retirer la ligne « ni le jour, ni la
  demi-journée » rougit le quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-planning-equipe.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));

controlerCharte(source, verifie);

const ESSAI = FICHIER.replace(/\.html$/, "-essai.html");
fs.writeFileSync(ESSAI, '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + source);

const nav = await chromium.launch(
  process.env.CHROMIUM_BIN === "playwright"
    ? {}
    : { executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium" }
);
const ctx = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto("file://" + path.resolve(ESSAI));

const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(200); };
const texte = async (s) => page.$eval(s, (e) => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "");

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Les deux lignes portent la même chose ─────────────────────────────
try {
  await cadrer('[data-s="avant"]');
  const lire = (s) => page.$$eval(`${s} .ligne`, (l) =>
    l.map((e) => `${e.querySelector(".nom").textContent.trim()}|${e.querySelector(".quand").textContent.trim()}`));
  const a = await lire('[data-s="avant"]');
  const b = await lire('[data-s="apres"]');
  verifie("les deux écrans portent les mêmes chantiers, aux mêmes dates",
    a.length >= 3 && a.join(" · ") === b.join(" · "), `${a.join(" · ")} / ${b.join(" · ")}`);
} catch (e) { echecs.push("lignes · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. LE contrôle de la planche : l'écart se mesure ─────────────────────
try {
  const mesure = await page.evaluate(() => {
    const bord = (s) => {
      const ec = document.querySelector(s).getBoundingClientRect();
      const c = document.querySelector(`${s} .ligne .chev`).getBoundingClientRect();
      return {
        // **On mesure le CHEVRON lui-même, pas la boîte qui le contient.** Son
        // carré porte une marge négative pour tomber au bord de l'écran : la
        // boîte, elle, reste sagement dans le retrait, et la mesurer donnait
        // « 0 px gagnés » sur une planche qui décale bel et bien.
        droite: ec.x + ec.width - (c.x + c.width),
        corps: parseFloat(getComputedStyle(document.querySelector(`${s} .ligne .chev`)).fontSize),
        cible: { h: c.height, w: c.width },
      };
    };
    return { avant: bord('[data-s="avant"]'), apres: bord('[data-s="apres"]') };
  });

  const gagne = mesure.apres.droite - mesure.avant.droite;
  // La planche PROMET 24 px. Un seuil mesuré est ce qui l'empêche de montrer
  // le contraire de ce qu'elle annonce.
  verifie("le groupe rentre bien d'environ 24 px vers la gauche",
    gagne >= 20 && gagne <= 28, `${gagne.toFixed(0)} px gagnés`);

  verifie("et le chevron grossit d'un cran",
    mesure.apres.corps > mesure.avant.corps, `${mesure.avant.corps} → ${mesure.apres.corps} px`);

  // GROSSIR LE SIGNE NE DOIT PAS RÉTRÉCIR LA CIBLE : c'est le geste, pas le
  // dessin, qu'on rate avec des gants.
  verifie("la cible du chevron reste à 44 px, avant comme après",
    mesure.avant.cible.h >= 43.5 && mesure.apres.cible.h >= 43.5 &&
      mesure.avant.cible.w >= 43.5 && mesure.apres.cible.w >= 43.5,
    `${mesure.avant.cible.h.toFixed(0)}×${mesure.avant.cible.w.toFixed(0)} / ${mesure.apres.cible.h.toFixed(0)}×${mesure.apres.cible.w.toFixed(0)}`);

  // **CE QUE LE DÉCALAGE COÛTE, ET IL FAUT LE MESURER.** Ramener le chevron
  // dans le retrait reprend ces pixels à la colonne du nom — c'est exactement
  // le piège que le code note depuis le 12 août : à 390 px, « Chez M. Bernard »
  // était devenu « Chez M. … ». Ce qu'on exige n'est donc pas que le nom garde
  // sa largeur, mais qu'il ne soit PAS COUPÉ.
  const noms = await page.$$eval(".ligne .nom", (l) =>
    l.map((e) => ({ texte: e.textContent.trim(), coupe: e.scrollWidth > e.clientWidth + 1 })));
  verifie("et aucun nom de chantier n'est coupé par le décalage",
    noms.every((n) => !n.coupe), noms.filter((n) => n.coupe).map((n) => n.texte).join(" · "));
} catch (e) { echecs.push("écart · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. La ligne « Équipe » dans la feuille ───────────────────────────────
try {
  await cadrer('[data-s="feuille"]');
  const ecran = await texte('[data-s="feuille"]');
  verifie("la feuille porte une ligne « Équipe »", /Équipe/.test(ecran), ecran.slice(0, 80));

  // Elle se pose PARMI les gestes existants : un écran de plus pour changer un
  // nom ne se justifierait pas.
  const items = await page.$$eval('[data-s="feuille"] .feuille .item .lib',
    (l) => l.map((e) => e.textContent.trim()));
  verifie("et elle vit parmi « Y aller » et « Créer la facture »",
    items.includes("Y aller") && items.includes("Créer la facture") && items.includes("Équipe"),
    items.join(" · "));

  const hauteurs = await page.$$eval('[data-s="feuille"] .feuille .item',
    (l) => l.map((e) => e.getBoundingClientRect().height));
  verifie("chaque geste de la feuille tient la cible de 44 px",
    hauteurs.every((h) => h >= 43.5), hauteurs.map((h) => h.toFixed(0)).join(" "));

  // UN CHANTIER VALIDÉ EST CELUI QU'ON NE VEUT PLUS BOUGER. Sans cette phrase,
  // il craindrait de perdre la date que le client a acceptée.
  verifie("l'écran promet que la date ne bouge pas",
    /ni le jour, ni la demi-journée/i.test(ecran));
  verifie("et il dit d'où vient ce chantier — un devis accepté",
    /accepté par le client/i.test(ecran));
} catch (e) { echecs.push("feuille · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le choix, et la règle de l'équipe unique ──────────────────────────
try {
  await cadrer('[data-s="choix"]');
  const choix = await page.$$eval('[data-s="choix"] .choix', (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      qui: e.querySelector(".qui").textContent.trim(),
      haut: e.getBoundingClientRect().height,
    })));
  verifie("le choix propose les équipes déclarées", choix.length >= 2, `${choix.length}`);

  // CE QUE CHAQUE ÉQUIPE A DÉJÀ CE JOUR-LÀ : sans cela, on en charge une
  // pendant que l'autre attend.
  verifie("chaque équipe dit ce qu'elle a déjà ce jour-là",
    choix.every((c) => c.qui.length > 5), choix.map((c) => `${c.nom}:${c.qui}`).join(" | "));
  verifie("et chaque ligne tient la cible de 44 px",
    choix.every((c) => c.haut >= 43.5), choix.map((c) => c.haut.toFixed(0)).join(" "));

  const pris = await page.$$eval('[data-s="choix"] .choix.pris', (l) => l.length);
  verifie("une seule équipe est prise à la fois", pris === 1, `${pris}`);

  // LA QUESTION QU'IL A POSÉE : pourquoi les équipes n'apparaissent plus. La
  // planche doit y répondre là où il regarde.
  verifie("la planche rappelle qu'à une seule équipe, rien ne s'écrit",
    /une seule équipe/i.test(await texte('[data-s="choix"]')));
} catch (e) { echecs.push("choix · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La charte, mesurée dans le navigateur ─────────────────────────────
try {
  await cadrer('[data-s="avant"]');
  await controlerGrammaire(page, '[data-s="avant"]', verifie);
  await controlerGrammaire(page, '[data-s="apres"]', verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La loupe est éteinte là où l'on mesure ────────────────────────────
// SANS CE CONTRÔLE, l'écart de 24 px mesuré plus haut serait multiplié par la
// loupe, et une planche qui ne décale rien passerait pour une planche qui
// décale.
try {
  const w = await page.$eval('[data-s="avant"]', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. Le gros plan, et les captures ─────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const rangees = await pg.$$(".rangee");
  verifie("les deux rangées sont capturées", rangees.length === 2, `${rangees.length}`);

  const cote = await pg.evaluate(() =>
    [...document.querySelectorAll(".rangee")].every((r) =>
      new Set([...r.querySelectorAll(".prop")].map((p) => Math.round(p.getBoundingClientRect().y))).size === 1));
  verifie("les deux partis d'une demande sont côte à côte", cote);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  for (let i = 0; i < rangees.length; i++) {
    await rangees[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await rangees[i].screenshot({ path: `${SORTIE}/planning-equipe-${i + 1}.png` });
  }
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
