/*
  Contrôle du planning — JavaScript coupé, iPhone 13, meta viewport injectée.

  Le sujet est la VÉRITÉ du calendrier et des équipes : chaque jour sous le bon
  nom de semaine, chaque demi-journée dans le bon état pour chaque équipe, et un
  geste de pose qui dit exactement ce qui va se passer.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-planning.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("aucun sélecteur de date natif", !/type="date"/i.test(source));
// Le jour s'ouvre par une ancre : le couple <label> + case se dérobe sur iPhone.
verifie("le jour s'ouvre par une ancre, pas par une case à cocher",
  /class="case[^"]*" href="#j1"/.test(source) && !/<label class="case/.test(source));
verifie("la journée est posée sous le calendrier, pas après la légende",
  source.indexOf('class="journee"') < source.indexOf('class="code"'));
// Contrôle de source : Chromium active un <label> sans `cursor:pointer`, Safari non.
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));

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
const ec = '[data-s="p"]';

const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const ouvrir = async (d) => {
  await (await page.$(ec)).scrollIntoViewIfNeeded();
  await page.click(`${ec} a[href="#j${d}"].case`);
  await page.waitForTimeout(450);
};

fs.mkdirSync(SORTIE, { recursive: true });
await (await page.$(ec)).scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await (await page.$(ec)).screenshot({ path: `${SORTIE}/planning-repos.png` });

// ── Le calendrier dit-il vrai ? ──────────────────────────────────────────
try {
  const g = await page.$eval(`${ec} .grille`, (grille) => {
    const enfants = [...grille.children];
    const jours = enfants.filter((e) => e.tagName === "A");
    const rang = (n) => enfants.indexOf(jours[n - 1]) % 7;
    return { nb: jours.length, un: rang(1), dix: rang(10), quinze: rang(15), trenteEtUn: rang(31),
             hors: enfants.filter((e) => e.classList.contains("hors")).length };
  });
  verifie("le mois d'août a trente et un jours", g.nb === 31, `${g.nb}`);
  verifie("cinq cases de juillet avant le 1er", g.hors === 5, `${g.hors}`);
  verifie("le 1er août tombe un samedi", g.un === 5, `colonne ${g.un}`);
  verifie("le 10 août tombe un lundi", g.dix === 0, `colonne ${g.dix}`);
  verifie("le 15 août tombe un samedi", g.quinze === 5, `colonne ${g.quinze}`);
  verifie("le 31 août tombe un lundi", g.trenteEtUn === 0, `colonne ${g.trenteEtUn}`);
  const auj = await page.$eval(`${ec} .case.auj`, (e) => ({ t: e.textContent.trim().slice(0, 2), c: getComputedStyle(e).color }));
  verifie("aujourd'hui est le 10 et se distingue", auj.t === "10" && /143, 113, 48/.test(auj.c), JSON.stringify(auj));
  const we = await page.$$eval(`${ec} .case.fin-sem`, (l) => l.length);
  verifie("les dix samedis et dimanches sont marqués", we === 10, `${we}`);
  const couleurs = await page.$eval(ec, (r) => ({
    sam: getComputedStyle(r.querySelector('a[href="#j1"].case')).color,
    lun: getComputedStyle(r.querySelector('a[href="#j3"].case')).color }));
  verifie("un samedi se voit en retrait d'un jour ouvré", couleurs.sam !== couleurs.lun,
    `${couleurs.sam} contre ${couleurs.lun}`);
  // La règle du serveur : vendredi + 2 jours finit lundi, jamais samedi.
  const m = (d) => page.$eval(`${ec} a[href="#j${d}"].case .occ`, (e) => +getComputedStyle(e).opacity);
  verifie("le chantier de vendredi saute le week-end",
    (await m(14)) > .5 && (await m(15)) < .1 && (await m(17)) > .5,
    `14:${await m(14)} 15:${await m(15)} 17:${await m(17)}`);
} catch (e) { echecs.push("calendrier · interrompu — " + String(e.message).split("\n")[0]); }

// ── Le code des jours ────────────────────────────────────────────────────
try {
  const t = await txt(`${ec} .code`);
  for (const mot of ["Libre", "place", "Matin", "Après-midi", "Journée", "équipes", "Réglages", "samedis"])
    verifie(`le code explique « ${mot} »`, new RegExp(mot, "i").test(t));
  const marques = await page.$$eval(`${ec} .code .occ`, (l) =>
    l.map((e) => getComputedStyle(e).backgroundImage + "|" + getComputedStyle(e).backgroundColor +
                 "|" + getComputedStyle(e).boxShadow));
  verifie("les cinq marques du code sont distinctes", new Set(marques).size === 5,
    `${new Set(marques).size} sur ${marques.length}`);
  const ovales = await page.$$eval(`${ec} .code *`, (l) =>
    l.filter((e) => e.getBoundingClientRect().width > 200 &&
                    parseFloat(getComputedStyle(e).borderRadius) > 30).length);
  verifie("la légende n'emprunte l'arrondi de personne", ovales === 0, `${ovales}`);
} catch (e) { echecs.push("code · interrompu — " + String(e.message).split("\n")[0]); }

// ── Les équipes du jour ──────────────────────────────────────────────────
try {
  verifie("au repos aucune journée n'est ouverte",
    (await page.$$eval(`${ec} .journee`, (l) =>
      l.filter((e) => getComputedStyle(e).display !== "none").length)) === 0);

  // Le 20 : équipe A prise toute la journée, équipe B entièrement libre.
  await ouvrir(20);
  const ouvertes = await page.$$eval(`${ec} .journee`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id));
  verifie("une seule journée s'ouvre, celle qu'on a touchée",
    ouvertes.length === 1 && ouvertes[0] === "j20", ouvertes.join(","));
  verifie("le 20 annonce jeudi", /Jeudi 20 août/i.test(await txt(`${ec} #j20 .quand`)));
  const cases20 = await page.$$eval(`${ec} #j20 .eq`, (l) =>
    l.map((e) => (e.classList.contains("pris") ? "pris:" : "libre:") +
                 e.textContent.trim().replace(/\s+/g, " ")));
  verifie("le 20 montre quatre cases : deux équipes × deux demi-journées",
    cases20.length === 4, `${cases20.length}`);
  verifie("l'équipe A y est prise matin ET après-midi",
    cases20.filter((c) => /^pris:Équipe A/.test(c)).length === 2, cases20.join(" | "));
  verifie("l'équipe B y est libre matin ET après-midi",
    cases20.filter((c) => /^libre:Équipe B/.test(c)).length === 2, cases20.join(" | "));
  verifie("et le chantier qui occupe A est nommé", /Reprise de toiture/.test(cases20.join(" ")));

  // Poser exige de dire QUAND et QUI.
  const poseurs = await page.$$eval(`${ec} #j20 .poser`, (l) =>
    l.map((e) => ({ vu: getComputedStyle(e).display !== "none", t: e.innerText.replace(/\s+/g, " ").trim() })));
  verifie("sans choix, aucun bouton de pose", poseurs.every((p) => !p.vu));
  await page.click(`${ec} #j20 label[for="q201"]`);   // équipe B, matin
  await page.waitForTimeout(400);
  const visibles = await page.$$eval(`${ec} #j20 .poser`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  verifie("le choix fait paraître UN bouton de pose", visibles.length === 1, `${visibles.length}`);
  verifie("qui dit le jour, la demi-journée ET l'équipe",
    /jeudi 20 août/i.test(visibles[0]) && /matin/i.test(visibles[0]) && /équipe B/i.test(visibles[0]),
    visibles[0]);
  const choisi = await page.$eval(`${ec} #j20 label[for="q201"]`, (e) => getComputedStyle(e).backgroundColor);
  verifie("et la case choisie se voit", /42, 58, 46/.test(choisi), choisi);
  verifie("on peut affilier ou changer d'équipe, et l'écran le dit",
    /affilier une équipe/i.test(await txt(`${ec} #j20 .changer`)));
  await (await page.$(`${ec}`)).screenshot({ path: `${SORTIE}/planning-jour.png` });

  // Le 12 : matin complet pour les deux équipes, après-midi libre.
  await ouvrir(12);
  const cases12 = await page.$$eval(`${ec} #j12 .eq`, (l) =>
    l.map((e) => (e.classList.contains("pris") ? "pris" : "libre") + ":" +
                 e.textContent.trim().replace(/\s+/g, " ")));
  verifie("le 12 a son matin complet et son après-midi libre",
    cases12.filter((c) => c.startsWith("pris")).length === 2 &&
    cases12.filter((c) => c.startsWith("libre")).length === 2, cases12.join(" | "));

  // Le 21 : journée pleine — aucune case, et l'écran dit quoi faire.
  await ouvrir(21);
  verifie("le 21 ne propose aucune case", (await page.$$eval(`${ec} #j21 .eq`, (l) => l.length)) === 0);
  verifie("et renvoie à une troisième équipe", /troisième équipe/i.test(await txt(`${ec} #j21`)));

  // Un samedi : jamais proposé, et la règle des deux jours est dite.
  await ouvrir(15);
  verifie("un samedi ne propose rien", (await page.$$eval(`${ec} #j15 .eq`, (l) => l.length)) === 0);
  verifie("et rappelle que vendredi + 2 jours finit lundi",
    /lundi/i.test(await txt(`${ec} #j15`)) && /samedi/i.test(await txt(`${ec} #j15`)));
} catch (e) { echecs.push("équipes · interrompu — " + String(e.message).split("\n")[0]); }

// ── Cibles et mise en page ───────────────────────────────────────────────
try {
  const c = await rect(`${ec} a[href="#j12"].case`);
  verifie("une case du mois se touche", c.w >= 38 && c.h >= 38, `${c.w.toFixed(0)} × ${c.h.toFixed(0)} px`);
  await ouvrir(20);
  const e2 = await rect(`${ec} #j20 .eq`);
  verifie("une case d'équipe se touche", e2.w >= 100 && e2.h >= 60, `${e2.w.toFixed(0)} × ${e2.h.toFixed(0)} px`);
  const grosses = await page.$$eval(`${ec} input`, (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);
  const b = await page.$$eval(`${ec} .bas span`, (l) =>
    l.map((e) => { const r = document.createRange(); r.selectNodeContents(e);
      const q = r.getBoundingClientRect(); return { g: q.x, d: q.x + q.width, t: e.textContent.trim() }; }));
  let pire = { ecart: 1e9, ou: "" };
  for (let i = 1; i < b.length; i++) {
    const w = b[i].g - b[i - 1].d;
    if (w < pire.ecart) pire = { ecart: w, ou: `${b[i - 1].t}|${b[i].t}` };
  }
  verifie("les libellés du bandeau ne se touchent pas", pire.ecart >= 6, `${pire.ecart.toFixed(1)} px`);
  verifie("c'est bien Planning qui est actif", /planning/i.test(await txt(`${ec} .bas .actif`)));
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
