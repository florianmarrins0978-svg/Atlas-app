/*
  Contrôle du parcours « facturer » — JavaScript coupé, iPhone 13.

  Le sujet est LE PARCOURS, joué en entier comme le patron le jouera :
  ouvrir le mois, toucher le chantier, créer la facture. Et la règle qui le
  tient : CRÉER N'EST PAS ENVOYER.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-facturer.html";
const SORTIE = "maquettes/vues";
const EC = '[data-s="f"]';

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));
// Le changement de vue passe par une ANCRE : le couple <label> + case se dérobe
// sur l'iPhone du patron, deux fois de suite sur le planning.
verifie("on change de vue par une ancre, pas par une case à cocher",
  /class="fact" href="#devis"/.test(source) && !/<label class="fact/.test(source));

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
const vues = () => page.$$eval(`${EC} .vue`, (l) =>
  l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id));
const cadrer = async () => { await (await page.$(EC)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });
await cadrer();

// ── 1. Au départ : la liste, et elle seule ───────────────────────────────
try {
  verifie("au départ, seule la liste est à l'écran", (await vues()).join() === "liste", (await vues()).join());
  const p = await txt(`${EC} .pastille`);
  verifie("la pastille porte le compte du mois", p === "2", p);
  const past = await rect(`${EC} .pastille`);
  const fil = await page.$eval(`${EC} .fil`, (e) => e.getBoundingClientRect().x);
  verifie("elle est posée sur le fil, pas dans la marge",
    Math.abs((past.x + past.w / 2) - (fil + 47)) < 2,
    `${(past.x + past.w / 2 - fil).toFixed(1)} px du bord`);
  const mois = await rect(`${EC} .mois`);
  verifie("et à hauteur du mois", past.y > mois.y - 2 && past.y < mois.y + mois.h,
    `${past.y.toFixed(0)} vs ${mois.y.toFixed(0)}`);
  verifie("l'encart annonce le nombre en toutes lettres",
    /deux à facturer/i.test(await txt(`${EC} .encart`)), await txt(`${EC} .encart`));
  const ferme = (await rect(`${EC} .volet`)).h;
  verifie("le mois est replié au repos", ferme < 2, `${ferme.toFixed(1)} px`);
  await (await page.$(EC)).screenshot({ path: `${SORTIE}/facturer-1-liste.png` });
} catch (e) { echecs.push("départ · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Premier appui : le mois s'ouvre ───────────────────────────────────
try {
  await page.click(`${EC} .encart`);
  await page.waitForTimeout(650);
  const h = (await rect(`${EC} .volet`)).h;
  verifie("l'encart ouvre le mois", h > 120, `${h.toFixed(0)} px`);
  const lignes = await page.$eval(EC, (r) => {
    const v = r.querySelector(".volet").getBoundingClientRect();
    return [...r.querySelectorAll(".volet .fact")]
      .filter((e) => { const b = e.getBoundingClientRect();
                       return Math.min(b.bottom, v.bottom) - Math.max(b.top, v.top) > 1; })
      .map((e) => e.textContent.trim().replace(/\s+/g, " "));
  });
  verifie("deux chantiers, autant que le compte annoncé", lignes.length === 2, lignes.join(" | "));
  verifie("Chez Mme Roux y est, avec sa date", /Chez Mme Roux/.test(lignes[0]) && /Le 20/.test(lignes[0]),
    lignes[0]);
  verifie("le tiroir dit d'où viennent ses montants",
    /prévus aux devis/i.test(await txt(`${EC} .volet .source`)));
  // Une ligne en attente doit MENER au devis : c'est tout l'objet du parcours.
  const menent = await page.$$eval(`${EC} .volet .fact`, (l) =>
    l.map((e) => e.tagName + ":" + e.getAttribute("href")));
  verifie("chaque ligne en attente mène au devis",
    menent.length === 2 && menent.every((h) => h === "A:#devis"), menent.join(" | "));
  const cible = await rect(`${EC} .volet .fact`);
  verifie("elle se touche", cible.w >= 200 && cible.h >= 44,
    `${cible.w.toFixed(0)} × ${cible.h.toFixed(0)} px`);
  await (await page.$(EC)).screenshot({ path: `${SORTIE}/facturer-2-ouvert.png` });
} catch (e) { echecs.push("ouverture · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Deuxième appui : le devis de Mme Roux ─────────────────────────────
try {
  await page.click(`${EC} .volet .fact`);
  await page.waitForTimeout(450);
  verifie("toucher le chantier ouvre son devis", (await vues()).join() === "devis", (await vues()).join());
  const t = await txt(`${EC} #devis`);
  verifie("le devis est bien celui de Mme Roux", /Chez Mme Roux/.test(t) && /D2026-0031/.test(t));
  verifie("il rappelle que le chantier n'est pas facturé", /pas encore facturé/i.test(t));
  verifie("et il porte le total du devis", /1 240,00/.test(t.replace(/[   ]/g, " ")));

  // LA touche : une seule, évidente, et qui dit ce qu'elle fait.
  const pleins = await page.$$eval(`${EC} #devis .corps *`, (l) => l.filter((e) => {
    const f = getComputedStyle(e).backgroundColor;
    if (f === "transparent" || /rgba\(0, 0, 0, 0\)/.test(f)) return false;
    const r = e.getBoundingClientRect();
    return r.width > 60 && r.height > 24;
  }).map((e) => e.textContent.trim().replace(/\s+/g, " ")));
  verifie("un seul pavé plein sur l'écran — c'est ce qui en fait l'action évidente",
    pleins.length === 1 && /Créer la facture/.test(pleins[0]), pleins.join(" | "));
  const a = await rect(`${EC} #devis .agir`);
  verifie("la touche se touche", a.w >= 200 && a.h >= 48, `${a.w.toFixed(0)} × ${a.h.toFixed(0)} px`);
  verifie("elle dit qu'elle crée, pas qu'elle envoie",
    !/envoy/i.test(await txt(`${EC} #devis .agir`)), await txt(`${EC} #devis .agir`));
  verifie("et l'écran promet que rien ne part",
    /rien ne part au client/i.test(await txt(`${EC} #devis .apres`)));
  const casseD = await page.$$eval(`${EC} #devis .l .k, ${EC} #devis .l .v, ${EC} #devis h1`,
    (l) => l.filter((e) => e.getBoundingClientRect().height >
                           parseFloat(getComputedStyle(e).lineHeight) * 1.6)
            .map((e) => e.textContent.trim()));
  verifie("devis · aucune étiquette ni montant ne se casse en deux", casseD.length === 0, casseD.join(" | "));
  // La phrase qui promet que rien ne part doit être LUE, pas devinée sous le
  // bandeau : c'est elle qui rassure avant d'appuyer.
  const ap = await rect(`${EC} #devis .apres`);
  const barre = await rect(`${EC} #devis .bas`);
  verifie("et la promesse « rien ne part » tient dans l'écran", ap.y + ap.h <= barre.y + 1,
    `${(ap.y + ap.h - barre.y).toFixed(0)} px sous le bandeau`);
  await (await page.$(EC)).screenshot({ path: `${SORTIE}/facturer-3-devis.png` });
} catch (e) { echecs.push("devis · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Troisième appui : la facture existe, elle n'est pas partie ────────
try {
  await page.click(`${EC} #devis .agir`);
  await page.waitForTimeout(450);
  verifie("créer mène à la facture", (await vues()).join() === "faite", (await vues()).join());
  const t = await txt(`${EC} #faite`);
  verifie("la facture porte un numéro", /F2026-0007/.test(t), t.split("\n").slice(0, 3).join(" · "));
  verifie("et le même total que le devis", /1 240,00/.test(t.replace(/[   ]/g, " ")));
  verifie("l'écran dit qu'elle est prête, pas qu'elle est partie",
    /prête à envoyer/i.test(t) && /Rien n'est parti/i.test(t));
  verifie("l'envoi est un SECOND geste, distinct",
    /Envoyer au client/.test(await txt(`${EC} #faite .agir`)) &&
    /second geste/i.test(await txt(`${EC} #faite .apres`)));
  const casseF = await page.$$eval(`${EC} #faite .l .k, ${EC} #faite .l .v, ${EC} #faite h1`,
    (l) => l.filter((e) => e.getBoundingClientRect().height >
                           parseFloat(getComputedStyle(e).lineHeight) * 1.6)
            .map((e) => e.textContent.trim()));
  verifie("facture · aucune étiquette ni montant ne se casse en deux", casseF.length === 0, casseF.join(" | "));
  await (await page.$(EC)).screenshot({ path: `${SORTIE}/facturer-4-faite.png` });
} catch (e) { echecs.push("facture · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le retour ramène à la liste, et à rien d'autre ────────────────────
try {
  await page.click(`${EC} #faite .retour`);
  await page.waitForTimeout(450);
  verifie("le retour ramène à la liste", (await vues()).join() === "liste", (await vues()).join());
} catch (e) { echecs.push("retour · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. Mise en page : colonnes, étiquettes, bandeau ──────────────────────
try {
  const euros = await page.$$eval(`${EC} .eur, ${EC} .tot, ${EC} .lg b`, (l) => l.map((e) => {
    const r = e.getBoundingClientRect();
    return { d: r.x + r.width, tnum: /tabular-nums/.test(getComputedStyle(e).fontVariantNumeric) };
  }));
  const ecart = Math.max(...euros.map((e) => e.d)) - Math.min(...euros.map((e) => e.d));
  verifie("les montants de la liste sont alignés à droite", ecart < 1.5, `${ecart.toFixed(1)} px`);
  verifie("les chiffres sont tabulaires", euros.every((e) => e.tnum));
  const casse = await page.$$eval(
    `${EC} .fil .m b, ${EC} .fil .ref, ${EC} .encart .q, ${EC} .source, ${EC} .l .k`,
    (l) => l.filter((e) => e.getBoundingClientRect().height >
                           parseFloat(getComputedStyle(e).lineHeight) * 1.6)
            .map((e) => e.textContent.trim()));
  verifie("aucune étiquette ne se casse en deux lignes", casse.length === 0, casse.join(" | "));
  const rangs = await page.$$eval(`${EC} .bas`, (l) => l.map((b) => {
    const t = b.querySelector("i").getBoundingClientRect();
    const a = b.querySelector(".actif");
    const g = document.createRange(); g.selectNodeContents(a);
    const m = g.getBoundingClientRect();
    return { ecart: (t.x + t.width / 2) - (m.x + m.width / 2), mot: a.textContent.trim() };
  }));
  verifie("les trois vues gardent le trait sous « Terminés »",
    rangs.length === 3 && rangs.every((r) => Math.abs(r.ecart) < 8 && /termin/i.test(r.mot)),
    rangs.map((r) => r.ecart.toFixed(1)).join(" | "));
  const deborde = await page.$$eval(`${EC} .corps`, (l) => l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucune vue ne déborde sur le côté", deborde === 0, `${deborde}`);
  verifie("aucun débordement horizontal de la page",
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
