/*
  Contrôle de « Terminés » — JavaScript coupé, iPhone 13, meta viewport injectée.

  Le sujet est ce que les quatre propositions PROMETTENT :
  des filets et aucun pavé, des montants alignés en colonne, une somme visible,
  et un relevé de TVA qui n'est plus la seule boîte pleine de l'écran.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-termines.html";
const SORTIE = "maquettes/vues";
const ECRANS = ["a", "b", "c", "d"];

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
    await (await page.$(ec)).scrollIntoViewIfNeeded();
    await page.waitForTimeout(260);

    // 1) Des filets, pas des pavés. Le fond plein est ce qui trahissait
    //    l'ancien écran : trois sortes de cartes arrondies empilées.
    const pleins = await page.$$eval(`${ec} .corps *`, (l) => l.filter((e) => {
      const st = getComputedStyle(e);
      const f = st.backgroundColor;
      if (f === "transparent" || /rgba\(0, 0, 0, 0\)/.test(f)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 60 && r.height > 24;          // un vrai pavé, pas une perle
    }).map((e) => e.className || e.tagName));
    verifie(`${S} · aucun pavé plein dans le corps`, pleins.length === 0, pleins.join(" | "));

    const rayons = await page.$$eval(`${ec} .corps *`, (l) => l.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 120 && r.height > 40 &&
             parseFloat(getComputedStyle(e).borderTopLeftRadius) > 8;
    }).length);
    verifie(`${S} · aucune carte arrondie`, rayons === 0, `${rayons}`);

    // 2) Les montants se lisent en colonne : même bord droit, chiffres
    //    tabulaires. Sinon l'œil recompte à chaque ligne.
    const euros = await page.$$eval(`${ec} .eur, ${ec} .e, ${ec} .tot`, (l) => l.map((e) => {
      const r = e.getBoundingClientRect();
      return { d: r.x + r.width, tnum: /tabular-nums/.test(getComputedStyle(e).fontVariantNumeric),
               t: e.textContent.trim() };
    }));
    if (euros.length) {
      const ecart = Math.max(...euros.map((e) => e.d)) - Math.min(...euros.map((e) => e.d));
      verifie(`${S} · les montants sont alignés à droite`, ecart < 1.5, `${ecart.toFixed(1)} px`);
      verifie(`${S} · les chiffres sont tabulaires`, euros.every((e) => e.tnum));
      verifie(`${S} · un espace insécable sépare les milliers`,
        euros.every((e) => !/\d{4}/.test(e.t.replace(/[   ]/g, "X"))),
        euros.map((e) => e.t).join(" | "));
    }

    // 3) L'écran dit une somme — c'est ce que l'ancien ne faisait pas.
    const tout = await txt(ec);
    verifie(`${S} · une somme est écrite quelque part`, /4\s*320,00/.test(tout.replace(/ | /g, " ")),
      tout.slice(0, 60).replace(/\n/g, " · "));

    // 4) Le relevé de TVA est présent, et Atlas ne prétend pas déclarer.
    verifie(`${S} · le relevé de TVA reste accessible`, /TVA/i.test(tout));

    // 5) Le bandeau : le bon onglet, et le trait sous le bon mot.
    verifie(`${S} · c'est Terminés qui est actif`, /termin/i.test(await txt(`${ec} .bas .actif`)));
    const sl = await page.$eval(ec, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`${S} · le trait tombe sous l'onglet actif`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);

    // 6) Les cibles se touchent, et rien ne déborde.
    const ligne = await rect(`${ec} .fact, ${ec} .reg .l`);
    if (ligne) verifie(`${S} · une ligne de facture se touche`, ligne.w >= 200 && ligne.h >= 44,
      `${ligne.w.toFixed(0)} × ${ligne.h.toFixed(0)} px`);
    const deborde = await page.$eval(`${ec} .corps`, (e) => e.scrollWidth > e.clientWidth + 1);
    verifie(`${S} · aucun débordement latéral`, !deborde);

    await (await page.$(ec)).screenshot({ path: `${SORTIE}/termines-${s}.png` });
  } catch (e) { echecs.push(`${s} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── A : le tiroir de TVA descend pour de bon ─────────────────────────────
try {
  const ec = '[data-s="a"]';
  await (await page.$(ec)).scrollIntoViewIfNeeded();
  const haut = (await rect(`${ec} .tva`)).h;
  verifie("A · le détail de TVA est replié au repos", haut < 2, `${haut.toFixed(1)} px`);
  await page.click(`${ec} .detail .lien`);
  await page.waitForTimeout(600);
  const bas = (await rect(`${ec} .tva`)).h;
  verifie("A · il descend sous le doigt", bas > 90, `${bas.toFixed(1)} px`);
  verifie("A · et il dit qu'Atlas ne déclare pas",
    /ne le déclare pas/i.test(await txt(`${ec} .tva`)));
  await (await page.$(ec)).screenshot({ path: `${SORTIE}/termines-a-tva.png` });
} catch (e) { echecs.push("tiroir TVA · interrompu — " + String(e.message).split("\n")[0]); }

// ── D : le montant nul se voit, sans se cacher ───────────────────────────
try {
  const zero = await page.$eval('[data-s="d"] .e.zero', (e) => ({
    t: e.textContent.trim(), c: getComputedStyle(e).color,
    vu: e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) }));
  verifie("D · la facture à zéro se lit, en gris", zero.vu && /0,00/.test(zero.t) &&
    /131, 134, 124/.test(zero.c), JSON.stringify(zero));
} catch (e) { echecs.push("zéro · interrompu — " + String(e.message).split("\n")[0]); }

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
verifie("aucun débordement horizontal de la page", !deborde);

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
