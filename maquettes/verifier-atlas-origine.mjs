/*
  Contrôle de la version retenue — conditions du patron : JavaScript coupé,
  iPhone 13, meta viewport ajoutée comme le fera l'enveloppe de la page.

  Les quatre choix retenus doivent tenir ENSEMBLE : c'est là que les maquettes
  séparées mentent. Le retrait ne doit pas décrocher la perle, le tiroir ne
  doit pas manger le bandeau, et le décompte doit suivre.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] ||
  "maquettes/atlas-origine.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (nom, cond, detail = "") =>
  cond ? ok.push(nom) : echecs.push(`${nom}${detail ? " — " + detail : ""}`);

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("aucun href javascript:", !/javascript:/i.test(source));
// Volontairement PAS une recherche dans la source : la consigne qui interdit
// ce champ y figure en toutes lettres, et le contrôle accusait le commentaire
// qui la porte. Il porte donc sur les étiquettes affichées.

const ESSAI = FICHIER.replace(/\.html$/, "-essai.html");
fs.writeFileSync(ESSAI, '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + source);

// Le navigateur de Playwright n'est pas téléchargé dans cet environnement ;
// celui qui y est déjà installé fait l'affaire. CHROMIUM_BIN permet d'en viser
// un autre, et l'absence de valeur laisse Playwright choisir le sien.
const nav = await chromium.launch(
  process.env.CHROMIUM_BIN === "playwright"
    ? {}
    : { executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium" }
);
const ctx = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto("file://" + path.resolve(ESSAI));

const rect = async (sel) =>
  page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }).catch(() => null);
const hauteur = async (sel) => (await rect(sel))?.h ?? null;
const texte = async (sel) => page.$eval(sel, (e) => e.innerText.trim()).catch(() => "");

fs.mkdirSync(SORTIE, { recursive: true });
await (await page.$(".tel")).screenshot({ path: `${SORTIE}/final-repos.png` });

// ── Structure ────────────────────────────────────────────────────────────
try {
  const n = await page.$$eval(".tige .ligne", (l) => l.length);
  verifie("huit chantiers", n === 8, `${n}`);
  const grosses = await page.$$eval(".ecran input", (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length
  );
  verifie("aucune case native visible", grosses === 0, `${grosses}`);
  verifie("le décompte annonce huit", /huit/i.test(await texte(".titre .compte")), await texte(".titre .compte"));
  const tiroir = await hauteur(".tiroir");
  verifie("le tiroir est replié au repos", tiroir < 2, `${tiroir?.toFixed(1)} px`);
} catch (e) { echecs.push("structure · interrompu — " + String(e.message).split("\n")[0]); }

// ── La perle est bien devant le 22 juillet ───────────────────────────────
try {
  const dot = await rect(".perle i");
  const tige = await rect(".tige");
  const l3 = await rect(".tige .ligne:nth-of-type(3)");
  const j3 = await texte(".tige .ligne:nth-of-type(3) .jour b");
  verifie("la perle est sur le fil", dot && Math.abs(dot.cx - (tige.x + 47)) < 2,
    dot ? `écart ${(dot.cx - (tige.x + 47)).toFixed(1)} px` : "absente");
  verifie("la troisième ligne est bien le 22", j3 === "22", j3);
  verifie("la perle se tient devant le 22 juillet",
    dot && l3 && dot.cy > l3.y - 6 && dot.cy < l3.y + l3.h,
    dot && l3 ? `perle ${dot.cy.toFixed(0)}, ligne ${l3.y.toFixed(0)}–${(l3.y + l3.h).toFixed(0)}` : "manquante");
} catch (e) { echecs.push("perle · interrompu — " + String(e.message).split("\n")[0]); }

// ── Le voile ne mord pas au repos ────────────────────────────────────────
try {
  const noms = await page.$$eval(".tige .nom", (l) => l.map((e) => Math.round(e.getBoundingClientRect().x)));
  verifie("tous les noms démarrent au même endroit",
    new Set(noms).size === 1, noms.join(", "));
} catch (e) { echecs.push("voile · interrompu — " + String(e.message).split("\n")[0]); }

// ── Retirer — P ──────────────────────────────────────────────────────────
try {
  const avant = await page.$$eval(".tige .ligne", (l) => l.map((e) => Math.round(e.getBoundingClientRect().height)));
  await page.click('label[for="c1"]');
  await page.waitForTimeout(1000);
  const apres = await page.$$eval(".tige .ligne", (l) => l.map((e) => Math.round(e.getBoundingClientRect().height)));
  verifie("la ligne retirée s'en va", apres[0] < 2, `${apres[0]} px`);
  verifie("aucune voisine ne bouge",
    avant.slice(1).every((h, i) => Math.abs(h - apres[i + 1]) < 2),
    `${avant.join("/")} → ${apres.join("/")}`);
  verifie("le tiroir s'ouvre", (await hauteur(".tiroir")) > 20, `${(await hauteur(".tiroir"))?.toFixed(0)} px`);
  verifie("le décompte tombe à sept", /sept/i.test(await texte(".titre .compte")), await texte(".titre .compte"));
  verifie("la rubrique suit aussi", /sept/i.test(await texte(".rubrique")), await texte(".rubrique"));
  verifie("le tiroir parle au singulier", /Retiré à/.test(await texte(".tiroir .quoi")), await texte(".tiroir .quoi"));

  let vis = await page.$$eval(".tiroir .agir", (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getAttribute("for")));
  verifie("Annuler vise la ligne retirée", vis.length === 1 && vis[0] === "c1", JSON.stringify(vis));

  // Un second retrait, plus bas : le libellé doit basculer sur LUI.
  await page.click('label[for="c3"]');
  await page.waitForTimeout(1000);
  verifie("le décompte tombe à six", /six/i.test(await texte(".titre .compte")), await texte(".titre .compte"));
  verifie("le tiroir passe au pluriel", /Retirés à/.test(await texte(".tiroir .quoi")), await texte(".tiroir .quoi"));
  vis = await page.$$eval(".tiroir .agir", (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getAttribute("for")));
  verifie("Annuler suit le dernier retrait", vis.length === 1 && vis[0] === "c3", JSON.stringify(vis));
  const l1 = await hauteur(".tige .ligne:nth-of-type(1)");
  verifie("la première reste partie", l1 < 2, `${l1?.toFixed(1)} px`);

  await (await page.$(".tel")).screenshot({ path: `${SORTIE}/final-retire.png` });

  await page.click(".tiroir .a3");
  await page.waitForTimeout(1000);
  verifie("Annuler rend la ligne", (await hauteur(".tige .ligne:nth-of-type(3)")) > 60);
  vis = await page.$$eval(".tiroir .agir", (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getAttribute("for")));
  verifie("et le libellé revient à la précédente", vis.length === 1 && vis[0] === "c1", JSON.stringify(vis));
  await page.click(".tiroir .a1");
  await page.waitForTimeout(1000);
  verifie("le tiroir se referme quand tout est rendu", (await hauteur(".tiroir")) < 2);
  verifie("le décompte revient à huit", /huit/i.test(await texte(".titre .compte")), await texte(".titre .compte"));
} catch (e) { echecs.push("retrait · interrompu — " + String(e.message).split("\n")[0]); }

// ── Le bandeau — trait G ─────────────────────────────────────────────────
try {
  const t0 = await rect(".trait");
  const colonne = (await rect(".bas")).w - 28;
  await page.click('label[for="t2"]');
  await page.waitForTimeout(900);
  const t1 = await rect(".trait");
  verifie("le trait avance d'un onglet",
    Math.abs((t1.x - t0.x) - colonne / 4) < 3,
    `${(t1.x - t0.x).toFixed(1)} px pour ${(colonne / 4).toFixed(1)} attendus`);
  // Les libellés du bandeau ne doivent pas se toucher. La boîte du label vaut
  // sa colonne entière : c'est l'étendue du TEXTE qu'il faut mesurer, sinon
  // le contrôle reste vert pendant que « CHANTIERS » colle « PLANNING ».
  const bornes = await page.$$eval(".bas label", (l) =>
    l.map((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      const b = r.getBoundingClientRect();
      return { g: b.x, d: b.x + b.width, t: e.textContent.trim() };
    })
  );
  let pire = { ecart: 1e9, ou: "" };
  for (let i = 1; i < bornes.length; i++) {
    const ecart = bornes[i].g - bornes[i - 1].d;
    if (ecart < pire.ecart) pire = { ecart, ou: `${bornes[i - 1].t}|${bornes[i].t}` };
  }
  verifie("les libellés du bandeau ne se touchent pas", pire.ecart >= 6,
    `${pire.ecart.toFixed(1)} px entre ${pire.ou}`);

  const monte = await page.$eval('label[for="t2"]', (e) => getComputedStyle(e).transform);
  verifie("le mot choisi monte", /matrix\(1, 0, 0, 1, 0, -2\)/.test(monte), monte);
  await page.click('label[for="t1"]');
  await page.waitForTimeout(700);
} catch (e) { echecs.push("trait · interrompu — " + String(e.message).split("\n")[0]); }

// ── Nouveau chantier — ouverture D ───────────────────────────────────────
try {
  verifie("la feuille est cachée au repos",
    (await page.$eval(".feuille", (e) => getComputedStyle(e).visibility)) === "hidden");
  await page.click(".action");
  await page.waitForTimeout(1100);
  const f = await rect(".feuille");
  const ecran = await rect(".ecran");
  verifie("la feuille est montée", f.y > ecran.y && f.y < ecran.y + 90, `${(f.y - ecran.y).toFixed(0)} px du haut`);
  const recule = await page.$eval(".dessous", (e) => getComputedStyle(e).transform);
  verifie("l'écran recule", /matrix\(0\.93/.test(recule), recule);
  const champs = await page.$$eval(".dedans .champ .val", (l) => l.map((e) => e.textContent.trim()));
  verifie("les champs réels sont là", champs.length === 4, champs.join(" | "));
  const etiquettes = await page.$$eval(".dedans .etiq", (l) => l.map((e) => e.textContent.trim()));
  verifie("aucun champ « nom du chantier »",
    !etiquettes.some((t) => /nom du chantier/i.test(t)), etiquettes.join(" | "));
  const opac = await page.$$eval(".dedans > *", (l) => l.map((e) => +getComputedStyle(e).opacity));
  verifie("tout le contenu est arrivé", opac.every((o) => o > .95), opac.join(", "));
  await (await page.$(".tel")).screenshot({ path: `${SORTIE}/final-feuille.png` });
  await page.click(".rond");
  await page.waitForTimeout(900);
} catch (e) { echecs.push("ouverture · interrompu — " + String(e.message).split("\n")[0]); }

// ── Mise en page ─────────────────────────────────────────────────────────
try {
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const bas = await rect(".bas"), ecran = await rect(".ecran");
  verifie("le bandeau reste au bas de l'écran",
    Math.abs((bas.y + bas.h) - (ecran.y + ecran.h)) < 2,
    `${((bas.y + bas.h) - (ecran.y + ecran.h)).toFixed(1)} px`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();

console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) {
  console.log(`\n${echecs.length} ROUGE(S) :`);
  for (const e of echecs) console.log("  ✗ " + e);
  process.exit(1);
}
console.log("Tout est vert.");
