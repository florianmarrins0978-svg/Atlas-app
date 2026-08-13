/*
  Contrôle de l'encart « à facturer » — JavaScript coupé, iPhone 13.

  Le sujet : un chantier dont la date est passée appartient à SON MOIS. Le
  compte vit donc dans le mois, il se replie au repos, il s'ouvre sous le doigt,
  il dit d'où vient son montant — et à zéro il n'existe pas.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-termines-encart.html";
const SORTIE = "maquettes/vues";
const ECRANS = ["e1", "e2", "e3"];

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
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

const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);

fs.mkdirSync(SORTIE, { recursive: true });

for (const s of ECRANS) {
  try {
    const S = s.toUpperCase();
    const ec = `[data-s="${s}"]`;
    const decl = { e1: `${ec} .encart`, e2: `${ec} .bloc-mois`, e3: `${ec} .lignedeux` }[s];
    await (await page.$(ec)).scrollIntoViewIfNeeded();
    await page.waitForTimeout(240);

    // 1) Replié au repos : l'écran s'appelle « Terminés », il montre d'abord
    //    ce qui est fait. L'encart appelle, il n'occupe pas.
    const ferme = (await rect(`${ec} .volet`)).h;
    verifie(`${S} · le mois est replié au repos`, ferme < 2, `${ferme.toFixed(1)} px`);
    const cachees = await page.$eval(ec, (r) => {
      const v = r.querySelector(".volet").getBoundingClientRect();
      return [...r.querySelectorAll(".volet .fact")]
        .filter((e) => { const b = e.getBoundingClientRect();
                         return Math.min(b.bottom, v.bottom) - Math.max(b.top, v.top) > 1; }).length;
    });
    verifie(`${S} · les lignes en attente ne se lisent pas encore`, cachees === 0, `${cachees}`);

    // 2) Le déclencheur se touche — une ligne de 9,5 px se rate deux fois
    //    sur trois.
    const d = await rect(decl);
    verifie(`${S} · le déclencheur fait au moins 44 px de haut`, d.h >= 44, `${d.h.toFixed(0)} px`);

    // 3) Il s'ouvre sous le doigt.
    await page.click(decl);
    await page.waitForTimeout(650);
    const ouvert = (await rect(`${ec} .volet`)).h;
    verifie(`${S} · il s'ouvre sous le doigt`, ouvert > 120, `${ouvert.toFixed(0)} px`);
    const lignes = await page.$eval(ec, (r) => {
      const v = r.querySelector(".volet").getBoundingClientRect();
      return [...r.querySelectorAll(".volet .fact")]
        .filter((e) => { const b = e.getBoundingClientRect();
                         return Math.min(b.bottom, v.bottom) - Math.max(b.top, v.top) > 1; })
        .map((e) => e.textContent.trim().replace(/\s+/g, " "));
    });
    verifie(`${S} · deux chantiers, autant que le compte annoncé`, lignes.length === 2,
      lignes.join(" | "));
    verifie(`${S} · le chantier du 20 y est`, lignes.some((t) => /Le 20/.test(t)), lignes.join(" | "));
    const source = await txt(`${ec} .volet .source`);
    verifie(`${S} · le tiroir dit d'où viennent ses montants`,
      /prévus aux devis/i.test(source), source);
    verifie(`${S} · et rien ne promet un encaissement`,
      !/encaiss/i.test(lignes.join(" ") + source));

    // 4) Les perles : creuses pour ce qui attend, pleines pour ce qui est fait.
    const creuses = await page.$$eval(`${ec} .volet .creux i.vide`, (l) => l.length);
    verifie(`${S} · deux perles creuses`, creuses === 2, `${creuses}`);
    const anneau = await page.$eval(`${ec} .volet .creux i.vide`, (e) => getComputedStyle(e).boxShadow);
    verifie(`${S} · la perle en attente est un anneau, pas un point plein`, /inset/.test(anneau));

    // 5) Juillet est soldé : aucun encart n'y traîne.
    const juillet = await page.$eval(ec, (r) => {
      const mois = [...r.querySelectorAll(".fil > *")];
      const i = mois.findIndex((e) => /juillet/i.test(e.textContent || ""));
      return mois.slice(i, i + 2).map((e) => e.className).join(" | ");
    });
    verifie(`${S} · juillet n'a pas d'encart — un compte à zéro ne s'affiche pas`,
      !/encart|volet|dit|pastille/.test(juillet), juillet);

    // 6) Les montants gardent leur colonne, et rien ne se casse en deux lignes.
    const euros = await page.$$eval(`${ec} .eur, ${ec} .tot, ${ec} .lg b`, (l) => l.map((e) => {
      const r = e.getBoundingClientRect();
      return { d: r.x + r.width, tnum: /tabular-nums/.test(getComputedStyle(e).fontVariantNumeric) };
    }));
    const ecart = Math.max(...euros.map((e) => e.d)) - Math.min(...euros.map((e) => e.d));
    verifie(`${S} · les montants sont alignés à droite`, ecart < 1.5, `${ecart.toFixed(1)} px`);
    verifie(`${S} · les chiffres sont tabulaires`, euros.every((e) => e.tnum));
    const casse = await page.$$eval(`${ec} .fil .m b, ${ec} .fil .ref, ${ec} .encart .q, ${ec} .dit .t, ${ec} .source, ${ec} .deux span`,
      (l) => l.filter((e) => e.getBoundingClientRect().height >
                             parseFloat(getComputedStyle(e).lineHeight) * 1.6)
              .map((e) => e.textContent.trim()));
    verifie(`${S} · aucune étiquette ne se casse en deux lignes`, casse.length === 0, casse.join(" | "));

    verifie(`${S} · c'est Terminés qui est actif`, /termin/i.test(await txt(`${ec} .bas .actif`)));
    const sl = await page.$eval(ec, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`${S} · le trait tombe sous l'onglet actif`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);
    verifie(`${S} · aucun débordement latéral`,
      !(await page.$eval(`${ec} .corps`, (e) => e.scrollWidth > e.clientWidth + 1)));

    await (await page.$(ec)).screenshot({ path: `${SORTIE}/encart-${s}.png` });
  } catch (e) { echecs.push(`${s} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── Le compte annoncé dit bien DEUX, en toutes lettres ou en chiffre ─────
try {
  verifie("E1 · l'encart annonce le nombre en toutes lettres",
    /deux à facturer/i.test(await txt('[data-s="e1"] .encart')),
    await txt('[data-s="e1"] .encart'));
  verifie("E2 · la pastille porte le nombre, et la phrase dit de quoi",
    (await txt('[data-s="e2"] .pastille')) === "2" &&
    /attendent leur facture/i.test(await txt('[data-s="e2"] .dit')));
  verifie("E3 · le mois affiche ses deux chiffres, distingués par leur mot",
    /facturés/i.test(await txt('[data-s="e3"] .deux .a')) &&
    /à facturer/i.test(await txt('[data-s="e3"] .deux .b')));
} catch (e) { echecs.push("compte · interrompu — " + String(e.message).split("\n")[0]); }

verifie("aucun débordement horizontal de la page",
  !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
