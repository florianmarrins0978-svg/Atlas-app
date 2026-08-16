/*
  Contrôle de la planche « Mon entreprise : la saisie » — JavaScript coupé,
  iPhone 13, meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LE NUMÉRO EST DÉJÀ ESPACÉ, ET LE MÊME PARTOUT. C'est tout l'objet de la
      demande : « qu'il se mette exactement comme il faut ». Une planche qui
      montrerait « 0679984514 » ne montrerait rien.
    · LA LISTE DES PAYS NE S'OUVRE QU'AU TOUCHER. Dépliée en permanence, elle
      ferait valider un écran de choix du pays au lieu d'un champ de saisie.
    · LE CHAMP D'ADRESSE RESTE LIBRE, et l'écran le dit. Une liste qui enferme
      rendrait l'application inutilisable sur un chemin de campagne — c'est la
      règle de `ChampAdresse` depuis le 7 août, et la planche ne doit pas la
      contredire.
    · « AUTRE » FERME LA LISTE DES FORMES JURIDIQUES. Une liste fermée finirait
      par exclure quelqu'un.
    · LES CIBLES FONT 44 PX. Une pastille d'indicatif trop petite est un geste
      qu'il ratera une fois sur trois, et il le dira comme « ça ne marche pas ».

  Chacun sait échouer : écrire le numéro sans espaces rougit le premier, retirer
  `.interrupteur:checked ~ .deplie{display:block}` rougit le deuxième, retirer
  la ligne « rien ne vous oblige » rougit le troisième, retirer « Autre » rougit
  le quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-identite-saisie.html";
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
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. L'adresse : elle propose, elle n'enferme pas ──────────────────────
try {
  await cadrer('[data-s="adresse"]');
  const items = await page.$$eval('[data-s="adresse"] .liste .item', (l) => l.length);
  verifie("l'adresse propose plusieurs choix, comme chez le client", items >= 3, `${items}`);

  const ecran = await texte('[data-s="adresse"]');
  verifie("et l'écran dit que le champ reste libre",
    /rien ne vous oblige/i.test(ecran), ecran.slice(0, 90));

  // Les suggestions portent le CODE POSTAL : « 10 Rue Denfert Rochereau » seul,
  // répété quatre fois, ne se départage pas — c'est la ville qui tranche.
  const lignes = await page.$$eval('[data-s="adresse"] .liste .item span',
    (l) => l.map((e) => e.textContent.trim()));
  verifie("chaque suggestion porte son code postal et sa ville",
    lignes.length >= 3 && lignes.every((t) => /\d{5}/.test(t)), lignes.join(" | "));
} catch (e) { echecs.push("adresse · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le téléphone : espacé, et espacé PARTOUT ──────────────────────────
try {
  await cadrer('[data-s="telephone"]');
  const numeros = await page.$$eval(".numero", (l) => l.map((e) => e.textContent.trim()));
  verifie("le numéro est montré ESPACÉ — c'est tout l'objet de la demande",
    numeros.length > 0 && numeros.every((n) => /^0\d( \d\d){4}$/.test(n)), numeros.join(" | "));
  // Deux écrans montrent le même champ : un numéro différent d'un écran à
  // l'autre ferait douter de ce qu'on regarde.
  verifie("et c'est le même numéro sur les deux écrans",
    new Set(numeros).size === 1, numeros.join(" | "));

  const ind = await page.$$eval(".pays .ind", (l) => l.map((e) => e.textContent.trim()));
  verifie("l'indicatif est visible à côté du drapeau",
    ind.length > 0 && ind.every((i) => /^\+\d+$/.test(i)), ind.join(" | "));
} catch (e) { echecs.push("téléphone · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. La liste des pays ne s'ouvre qu'au toucher ────────────────────────
try {
  await cadrer('[data-s="pays"]');
  verifie("au repos, la liste des pays est fermée", !(await vu('[data-s="pays"] .drapeaux')));

  await page.click('[data-s="pays"] label.tel_ligne');
  await page.waitForTimeout(260);
  verifie("elle s'ouvre au toucher de l'indicatif", await vu('[data-s="pays"] .drapeaux'));

  const pays = await page.$$eval('[data-s="pays"] .drapeaux .item', (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      ind: e.querySelector(".ind").textContent.trim(),
      haut: e.getBoundingClientRect().height,
    })));
  verifie("elle porte plusieurs pays, la France en tête",
    pays.length >= 5 && pays[0].nom === "France", pays.map((p) => p.nom).join(", "));
  verifie("chacun montre son indicatif",
    pays.every((p) => /^\+\d+$/.test(p.ind)), pays.map((p) => p.ind).join(" "));
  verifie("et chaque ligne tient la cible de 44 px",
    pays.every((p) => p.haut >= 43.5), pays.map((p) => p.haut.toFixed(0)).join(" "));

  const pastille = await page.$eval('[data-s="pays"] .pays', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, w: r.width };
  });
  verifie("la pastille de l'indicatif se touche — 44 px de haut",
    pastille.h >= 43.5, `${pastille.h.toFixed(0)} × ${pastille.w.toFixed(0)} px`);
} catch (e) { echecs.push("pays · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. La forme juridique ────────────────────────────────────────────────
try {
  await cadrer('[data-s="forme"]');
  const formes = await page.$$eval('[data-s="forme"] .choix', (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      quoi: e.querySelector(".quoi").textContent.trim(),
      haut: e.getBoundingClientRect().height,
    })));
  verifie("la liste couvre les formes courantes", formes.length >= 8, `${formes.length}`);

  // UNE LISTE FERMÉE FINIT PAR EXCLURE QUELQU'UN, et l'artisan qu'elle exclut
  // ne peut plus rien saisir du tout.
  verifie("« Autre » ferme la liste, et en dernier",
    formes[formes.length - 1].nom === "Autre", formes.map((f) => f.nom).join(", "));

  // « EURL » ne se retient pas : le sigle seul obligerait à chercher ailleurs.
  verifie("chaque sigle est accompagné de ce qu'il veut dire",
    formes.every((f) => f.quoi.length > 3), formes.filter((f) => f.quoi.length <= 3).map((f) => f.nom).join(", "));

  verifie("et chaque ligne tient la cible de 44 px",
    formes.every((f) => f.haut >= 43.5), formes.map((f) => f.haut.toFixed(0)).join(" "));

  const pris = await page.$$eval('[data-s="forme"] .choix.pris', (l) => l.length);
  verifie("un seul choix est pris à la fois", pris === 1, `${pris}`);
} catch (e) { echecs.push("forme juridique · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le bouton du bas ──────────────────────────────────────────────────
try {
  await cadrer('[data-s="enregistrer"]');
  const b = await page.$eval('[data-s="enregistrer"] .bouton', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, texte: e.textContent.trim(), fond: getComputedStyle(e).backgroundColor };
  });
  verifie("le bouton d'enregistrement tient la cible de 44 px", b.h >= 44, `${b.h.toFixed(0)} px`);
  verifie("il porte le vert pin — c'est ce qu'on FAIT", b.fond === "rgb(47, 59, 47)", b.fond);

  // **POSÉ SUR L'ÉCRAN, pas au bout du défilement.** Sur une page de neuf
  // champs, un bouton en pied de page ne se voit qu'une fois tout parcouru —
  // c'est-à-dire quand on n'a plus rien à faire.
  // Il se pose JUSTE AU-DESSUS de la navigation, pas au bout du défilement et
  // pas par-dessus les onglets. Le contrôle mesurait d'abord la distance au bas
  // de l'écran — il accusait donc la barre de navigation, qui a parfaitement le
  // droit d'être là.
  const place = await page.$eval('[data-s="enregistrer"]', (e) => {
    const barre = e.querySelector(".barre").getBoundingClientRect();
    const nav = e.querySelector(".bas").getBoundingClientRect();
    return nav.y - (barre.y + barre.height);
  });
  verifie("il est posé juste au-dessus de la navigation, jamais par-dessus",
    Math.abs(place) < 2, `${place.toFixed(0)} px de la barre du bas`);

  // La planche doit AVOUER que les champs s'enregistrent déjà seuls : sans
  // cela, le patron croirait choisir un mécanisme neuf.
  verifie("l'écran dit que les modifications sont déjà écrites",
    /déjà enregistrées/i.test(await texte('[data-s="enregistrer"]')));
} catch (e) { echecs.push("bouton · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La charte, mesurée dans le navigateur ─────────────────────────────
try {
  await cadrer('[data-s="adresse"]');
  await controlerGrammaire(page, '[data-s="adresse"]', verifie);
  await controlerGrammaire(page, '[data-s="telephone"]', verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. La loupe est éteinte là où l'on mesure ────────────────────────────
// SANS CE CONTRÔLE, toutes les mesures ci-dessus porteraient sur un écran
// agrandi : une cible de 33 px passerait pour 44 sans que rien ne rougisse.
try {
  const w = await page.$eval('[data-s="adresse"]', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 8. Le gros plan, et les captures ─────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  // La liste des pays est fermée sur la capture d'un écran qui la montre
  // ouverte : on la rouvre ici, sinon la planche envoyée ne montre rien.
  await pg.click('[data-s="pays"] label.tel_ligne');
  await pg.waitForTimeout(260);

  const large = await pg.$eval('[data-s="adresse"]', (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  const props = await pg.$$(".prop");
  verifie("les cinq écrans sont capturés", props.length === 5, `${props.length}`);
  for (let i = 0; i < props.length; i++) {
    await props[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await props[i].screenshot({ path: `${SORTIE}/identite-saisie-${i + 1}.png` });
  }
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
