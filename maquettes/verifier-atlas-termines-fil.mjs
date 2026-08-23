/*
  Contrôle du fil « Terminés » — JavaScript coupé, iPhone 13, meta viewport.

  Le sujet est la PHRASE qui dit ce qui attend sa facture : qu'elle dise le
  même nombre que les lignes montrées, qu'elle ne prétende jamais qu'un devis
  est une facture, et qu'à zéro elle disparaisse au lieu d'afficher « 0 ».
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-termines-fil.html";
const SORTIE = "maquettes/vues";
const ECRANS = ["c1", "c2", "c3", "vide", "c4"];

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
    await page.waitForTimeout(240);
    const tout = (await txt(ec)).replace(/[   ]/g, " ");

    // Des filets, jamais des pavés — c'est ce qui a fait choisir le fil.
    const pleins = await page.$$eval(`${ec} .corps *`, (l) => l.filter((e) => {
      const f = getComputedStyle(e).backgroundColor;
      if (f === "transparent" || /rgba\(0, 0, 0, 0\)/.test(f)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 60 && r.height > 24;
    }).length);
    verifie(`${S} · aucun pavé plein`, pleins === 0, `${pleins}`);

    // Les montants gardent leur colonne.
    const euros = await page.$$eval(`${ec} .eur, ${ec} .tot, ${ec} .lg b`, (l) => l.map((e) => {
      const r = e.getBoundingClientRect();
      return { d: r.x + r.width, t: e.textContent.trim(),
               tnum: /tabular-nums/.test(getComputedStyle(e).fontVariantNumeric) };
    }).filter((e) => e.t));
    const ecart = Math.max(...euros.map((e) => e.d)) - Math.min(...euros.map((e) => e.d));
    verifie(`${S} · les montants sont alignés à droite`, ecart < 1.5, `${ecart.toFixed(1)} px`);
    verifie(`${S} · les chiffres sont tabulaires`, euros.every((e) => e.tnum));

    verifie(`${S} · le trimestre est totalisé`, /4 320,00/.test(tout), tout.slice(-80).replace(/\n/g, " · "));
    verifie(`${S} · c'est Terminés qui est actif`, /termin/i.test(await txt(`${ec} .bas .actif`)));
    const sl = await page.$eval(ec, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`${S} · le trait tombe sous l'onglet actif`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);

    const casse = await page.$$eval(`${ec} .fil .m b, ${ec} .fil .ref, ${ec} .chapeau .q`, (l) =>
      l.filter((e) => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight) * 1.6)
       .map((e) => e.textContent.trim()));
    verifie(`${S} · aucune étiquette ne se casse en deux lignes`, casse.length === 0, casse.join(" | "));

    const ligne = await rect(`${ec} .fact`);
    verifie(`${S} · une ligne se touche`, ligne.w >= 200 && ligne.h >= 44,
      `${ligne.w.toFixed(0)} × ${ligne.h.toFixed(0)} px`);
    verifie(`${S} · aucun débordement latéral`,
      !(await page.$eval(`${ec} .corps`, (e) => e.scrollWidth > e.clientWidth + 1)));

    await (await page.$(ec)).screenshot({ path: `${SORTIE}/fil-${s}.png` });
  } catch (e) { echecs.push(`${s} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── La phrase dit-elle le même nombre que les lignes ? ───────────────────
// Une phrase qui annonce deux chantiers au-dessus de trois lignes ruine la
// confiance dans tous les autres chiffres de l'écran.
try {
  for (const s of ["c1", "c2"]) {
    const p = (await txt(`[data-s="${s}"] .avis`)).replace(/[   ]/g, " ");
    verifie(`${s.toUpperCase()} · la phrase compte en toutes lettres`, /Deux chantiers/.test(p), p);
    verifie(`${s.toUpperCase()} · et n'affiche pas un « 0 » ni un chiffre nu`, !/\b0\b/.test(p), p);
  }
  const c2 = (await txt('[data-s="c2"] .avis')).replace(/[   ]/g, " ");
  verifie("C2 · le montant dit sa source, et ne promet pas un encaissement",
    /prévus au devis/i.test(c2) && !/encaiss/i.test(c2), c2);

  const enAttente = await page.$$eval('[data-s="c3"] .creux i.vide', (l) => l.length);
  verifie("C3 · deux perles creuses pour deux chantiers en attente", enAttente === 2, `${enAttente}`);
  const creuse = await page.$eval('[data-s="c3"] .creux i.vide', (e) => getComputedStyle(e).boxShadow);
  verifie("C3 · la perle en attente est un anneau, pas un point plein",
    /inset/.test(creuse), creuse);
  const tete = (await txt('[data-s="c3"] .chapeau')).replace(/[   ]/g, " ");
  verifie("C3 · la tête du fil annonce le compte, en toutes lettres",
    /deux/i.test(tete) && !/\b0\b/.test(tete), tete.replace(/\n/g, " · "));
  const source = await txt('[data-s="c3"] .souscha');
  verifie("C3 · le montant en attente dit d'où il vient, et ne promet rien",
    /prévus aux devis/i.test(source) && !/encaiss/i.test(source), source);
  // L'ordre compte : ce qui attend vient AVANT ce qui est fait.
  const yAttente = (await rect('[data-s="c3"] .creux i.vide')).y;
  const yFait = (await rect('[data-s="c3"] .mois')).y;
  verifie("C3 · ce qui attend est au-dessus de ce qui est fait", yAttente < yFait,
    `${yAttente.toFixed(0)} vs ${yFait.toFixed(0)}`);

  const c4 = (await txt('[data-s="c4"] .pied')).replace(/[   ]/g, " ");
  verifie("C4 · les deux lignes se répondent au pied",
    /Facturé ce trimestre/.test(c4) && /Reste à facturer/.test(c4), c4.replace(/\n/g, " · "));
} catch (e) { echecs.push("phrase · interrompu — " + String(e.message).split("\n")[0]); }

// ── L'état vide : aucune phrase bancale, aucun « 0 » ─────────────────────
try {
  const v = (await txt('[data-s="vide"]')).replace(/[   ]/g, " ");
  verifie("VIDE · l'écran dit qu'il n'attend rien", /Rien n'attend de facture/.test(v));
  verifie("VIDE · et n'écrit ni « 0 » ni « 0 chantier »", !/\b0\b/.test(v.split("Facturé")[0]),
    v.split("Facturé")[0].replace(/\n/g, " · ").slice(0, 90));
  verifie("VIDE · le chapeau ne compte pas de « chantiers »",
    !/chantier/i.test(await txt('[data-s="vide"] .chapeau')));
  verifie("VIDE · aucune perle creuse ne traîne",
    (await page.$$eval('[data-s="vide"] .creux i.vide', (l) => l.length)) === 0);
} catch (e) { echecs.push("vide · interrompu — " + String(e.message).split("\n")[0]); }

verifie("aucun débordement horizontal de la page",
  !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
