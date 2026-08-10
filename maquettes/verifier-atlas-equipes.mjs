/*
  Contrôle des équipes nommées — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure du réglage, c'est SA RÈGLE :

    · à une équipe, le mot « équipe » ne doit apparaître NULLE PART dans le
      planning — c'est la demande exacte du patron, et c'est la seule chose
      qu'un contrôle peut tenir à sa place ;
    · à plusieurs, le repli doit être VISIBLE avant d'être subi : le champ vide
      affiche « Équipe A » en gris ;
    · un nom écrit efface la lettre.

  Chacun de ces trois contrôles sait échouer : retirer la règle
  `#n1:checked ~ .nomm{display:none}` rougit le premier, vider un placeholder
  rougit le deuxième, et le troisième compare avant/après frappe.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-equipes.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
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

const R = '[data-s="r"]', SEUL = '[data-s="seul"]', NOM = '[data-s="nom"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(260); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Seul : le bloc des noms n'existe pas ──────────────────────────────
try {
  await cadrer(R);
  verifie("l'écran s'ouvre sur une équipe", (await txt(`${R} .chiffre`)) === "1");
  verifie("seul, le bloc des noms est absent", !(await vu(`${R} .nomm`)));
  const seulmot = await txt(`${R} .seulmot`);
  verifie("seul, l'écran dit pourquoi il ne demande rien",
    (await vu(`${R} .seulmot`)) && /aucune\s+équipe/i.test(seulmot));
  // Coupé net à sa demande : la suite expliquait ce que l'écran montre déjà.
  verifie("et il s'arrête là — pas un mot de plus",
    !/demi-journée/i.test(seulmot) && seulmot.length < 70, `« ${seulmot} »`);
  const moins = await page.$$eval(`${R} .cote.g .pm`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none")
     .map((e) => e.tagName + ":" + e.className));
  verifie("à une équipe, le − est inerte et n'est pas un libellé",
    moins.length === 1 && /inerte/.test(moins[0]) && !/LABEL/.test(moins[0]), moins.join("|"));
  await (await page.$(R)).screenshot({ path: `${SORTIE}/equipes-seul.png` });
} catch (e) { echecs.push("seul · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le compteur monte et descend pour de bon, jusqu'à vingt ──────────
try {
  await cadrer(R);
  const lignesVisibles = () => page.$$eval(`${R} .nomm .ligne`, (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).length);

  await page.click(`${R} .cote.d .pm:visible`);
  await page.waitForTimeout(300);
  verifie("le + fait passer à deux", (await txt(`${R} .chiffre`)) === "2");
  verifie("à deux, le bloc des noms paraît", await vu(`${R} .nomm`));
  verifie("et la phrase du « seul » s'efface", !(await vu(`${R} .seulmot`)));
  verifie("deux équipes donnent deux lignes, pas vingt", (await lignesVisibles()) === 2,
    `${await lignesVisibles()}`);

  // Vingt, c'est la borne de l'application (`entreprises.nombre_equipes`).
  // Monter jusque-là au doigt vérifie du même coup les dix-huit états du milieu.
  let derive = "";
  for (let k = 3; k <= 20; k++) {
    await page.click(`${R} .cote.d .pm:visible`);
    await page.waitForTimeout(70);
    const chiffre = await txt(`${R} .chiffre`);
    const lignes = await lignesVisibles();
    if (chiffre !== String(k) || lignes !== k) derive ||= `à ${k} : « ${chiffre} », ${lignes} ligne(s)`;
  }
  verifie("le compteur monte jusqu'à vingt, une ligne de nom par équipe", derive === "", derive);

  const plus = await page.$$eval(`${R} .cote.d .pm`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.tagName));
  verifie("à vingt, le + est inerte — le compteur est borné comme la base",
    plus.join("") === "SPAN", plus.join("|"));
  const lettres = await page.$$eval(`${R} .nomm .ligne`, (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => e.querySelector(".rep").textContent.trim()).join(""));
  verifie("les vingt lettres de repli vont de A à T", lettres === "ABCDEFGHIJKLMNOPQRST", lettres);
  await (await page.$(R)).screenshot({ path: `${SORTIE}/equipes-vingt.png` });

  for (let k = 19; k >= 2; k--) await page.click(`${R} .cote.g .pm:visible`);
  await page.waitForTimeout(300);
  verifie("le − redescend jusqu'à deux", (await txt(`${R} .chiffre`)) === "2");
  verifie("et les lignes en trop s'en vont avec lui", (await lignesVisibles()) === 2);
} catch (e) { echecs.push("compteur · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Le repli est montré, puis effacé par un nom ───────────────────────
try {
  await cadrer(R);
  const creux = await page.$$eval(`${R} .nomm .ligne`, (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => ({ rep: e.querySelector(".rep").textContent.trim(),
                    creux: e.querySelector(".champ").placeholder,
                    vide: e.querySelector(".champ").matches(":placeholder-shown") })));
  verifie("le champ vide affiche déjà ce qui sera écrit",
    creux.length === 2 && creux[0].creux === "Équipe A" && creux[1].creux === "Équipe B" &&
    creux.every((c) => c.vide), JSON.stringify(creux));
  verifie("la lettre de repli est devant la ligne",
    creux[0].rep === "A" && creux[1].rep === "B", JSON.stringify(creux.map((c) => c.rep)));
  // Retiré à sa demande : le champ vide dit déjà « Équipe A ». Une phrase qui
  // répète ce que l'écran montre est du bruit, pas de la pédagogie.
  const apres_lignes = await page.$eval(`${R} .nomm`, (e) => e.lastElementChild.tagName);
  verifie("rien n'est écrit sous la dernière équipe", apres_lignes === "LABEL", apres_lignes);

  const t = await rect(`${R} .nomm .ligne.e1 .champ`);
  const corps = await page.$eval(`${R} .nomm .ligne.e1 .champ`, (e) => parseFloat(getComputedStyle(e).fontSize));
  verifie("le champ occupe la ligne et ne fait pas zoomer Safari",
    t.w > 200 && corps >= 16, `${t.w.toFixed(0)} px, ${corps} px de corps`);

  await page.fill(`${R} .nomm .ligne.e1 .champ`, "Malik");
  await page.waitForTimeout(260);
  const apres = await page.$eval(`${R} .nomm .ligne.e1 .champ`, (e) =>
    ({ v: e.value, creux: e.matches(":placeholder-shown") }));
  verifie("un nom écrit efface la lettre",
    apres.v === "Malik" && apres.creux === false, JSON.stringify(apres));
  const voisine = await page.$eval(`${R} .nomm .ligne.e2 .champ`, (e) => e.matches(":placeholder-shown"));
  verifie("l'autre ligne garde son repli — nommer l'une n'oblige pas l'autre", voisine === true);
  await (await page.$(R)).screenshot({ path: `${SORTIE}/equipes-noms.png` });
} catch (e) { echecs.push("noms · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. LA demande : seul, le planning ne dit jamais « équipe » ───────────
try {
  await cadrer(SEUL);
  const mots = await txt(SEUL);
  verifie("seul, le planning n'écrit nulle part le mot « équipe »",
    !/équipe/i.test(mots), (mots.match(/.{0,24}équipe.{0,24}/i) || [""])[0]);
  verifie("seul, aucune lettre A ou B ne tient lieu de nom",
    (await page.$$eval(`${SEUL} .rep`, (l) => l.length)) === 0);
  const rangs = await page.$$eval(`${SEUL} .rang`, (l) =>
    l.map((e) => e.textContent.trim().replace(/\s+/g, " ")));
  verifie("une demi-journée est libre, ou elle porte le nom de son chantier",
    rangs.length === 2 && rangs[0] === "Reprise de toiture" && rangs[1] === "Libre",
    rangs.join(" | "));
  verifie("aucun bouton avant le choix", !(await vu(`${SEUL} .poser`)));
  await page.click(`${SEUL} .rang.libre`);
  await page.waitForTimeout(320);
  const boutons = await page.$$eval(`${SEUL} .poser`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim().replace(/\s+/g, " ")));
  verifie("le choix fait paraître un seul bouton, sans équipe",
    boutons.length === 1 && !/équipe/i.test(boutons[0]), boutons.join(" | "));
  const perle = await page.$eval(`${SEUL} .rang.libre .qui b`, (e) => getComputedStyle(e).opacity);
  verifie("et la ligne choisie se voit", +perle > 0.9, perle);
  await (await page.$(SEUL)).screenshot({ path: `${SORTIE}/equipes-planning-seul.png` });
} catch (e) { echecs.push("planning seul · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Nommées : la lettre a disparu avec le nom ─────────────────────────
try {
  await cadrer(NOM);
  const mots = await txt(NOM);
  verifie("une équipe nommée n'est plus appelée « Équipe A »", !/équipe\s+[abc]\b/i.test(mots));
  verifie("les deux noms sont écrits", /Malik/.test(mots) && /Théo/.test(mots));
  const rangs = await page.$$eval(`${NOM} .rang`, (l) =>
    l.map((e) => (e.classList.contains("libre") ? "libre" : "pris") + ":" +
                 e.textContent.trim().replace(/\s+/g, " ")));
  verifie("Malik est pris matin et après-midi, Théo libre aux deux",
    rangs.filter((r) => r.startsWith("pris") && /Malik/.test(r)).length === 2 &&
    rangs.filter((r) => r.startsWith("libre") && /Théo/.test(r)).length === 2, rangs.join(" | "));

  await page.click(`${NOM} .rang.r1`);
  await page.waitForTimeout(320);
  const b1 = await page.$$eval(`${NOM} .poser`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim().replace(/\s+/g, " ")));
  verifie("choisir le matin arme « Poser · matin · Théo », et rien d'autre",
    b1.length === 1 && /matin/i.test(b1[0]) && /Théo/.test(b1[0]) && b1[0].length < 34,
    b1.join(" | "));
  const allumees = await page.$$eval(`${NOM} .rang .qui b`, (l) =>
    l.filter((e) => +getComputedStyle(e).opacity > 0.9).length);
  verifie("une seule ligne s'allume, pas les deux demi-journées", allumees === 1, `${allumees}`);

  await page.click(`${NOM} .rang.r2`);
  await page.waitForTimeout(320);
  const b2 = await page.$$eval(`${NOM} .poser`, (l) =>
    l.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim().replace(/\s+/g, " ")));
  verifie("choisir l'après-midi réécrit le bouton, sans en ajouter un second",
    b2.length === 1 && /après-midi/i.test(b2[0]) && /Théo/.test(b2[0]), b2.join(" | "));
  verifie("on peut changer l'équipe d'un chantier posé, et l'écran le dit",
    /changer son équipe/i.test(await txt(`${NOM} .changer`)));
  await (await page.$(NOM)).screenshot({ path: `${SORTIE}/equipes-planning-nommees.png` });
} catch (e) { echecs.push("planning nommé · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. Cibles et mise en page ────────────────────────────────────────────
try {
  await cadrer(R);
  const p = await rect(`${R} .cote.d .pm:visible`);
  verifie("le + se touche", p.w >= 44 && p.h >= 44, `${p.w.toFixed(0)} × ${p.h.toFixed(0)} px`);
  const l = await rect(`${R} .nomm .ligne.e1`);
  verifie("une ligne de nom se touche", l.w >= 200 && l.h >= 44, `${l.w.toFixed(0)} × ${l.h.toFixed(0)} px`);
  const r2 = await rect(`${NOM} .rang.r1`);
  verifie("une ligne d'équipe se touche", r2.w >= 200 && r2.h >= 44, `${r2.w.toFixed(0)} × ${r2.h.toFixed(0)} px`);
  const grosses = await page.$$eval('.ecran input[type="radio"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);
  // Le trait doit tomber sous L'ONGLET ACTIF : recopié d'un écran à l'autre, il
  // reste sous le premier onglet et désigne le mauvais mot. Mesurer l'étendue du
  // TEXTE — la boîte du libellé vaut sa colonne entière et masquerait l'écart.
  const soulignement = async (sel) => page.$eval(sel, (r) => {
    const t = r.querySelector(".bas i").getBoundingClientRect();
    const a = r.querySelector(".bas .actif");
    const g = document.createRange(); g.selectNodeContents(a);
    const m = g.getBoundingClientRect();
    return { ecart: (t.x + t.width / 2) - (m.x + m.width / 2), mot: a.textContent.trim() };
  });
  for (const [nom, sel, actif] of [["Réglages", R, "Réglages"], ["Planning seul", SEUL, "Planning"], ["Planning nommé", NOM, "Planning"]]) {
    verifie(`le bandeau de « ${nom} » désigne le bon écran`,
      (await txt(`${sel} .bas .actif`)).toLowerCase() === actif.toLowerCase());
    const sl = await soulignement(sel);
    verifie(`et son trait tombe sous « ${actif} »`, Math.abs(sl.ecart) < 8, `${sl.ecart.toFixed(1)} px`);
  }
  const b = await page.$$eval(`${R} .bas span`, (l) =>
    l.map((e) => { const r = document.createRange(); r.selectNodeContents(e);
      const q = r.getBoundingClientRect(); return { g: q.x, d: q.x + q.width, t: e.textContent.trim() }; }));
  let pire = { ecart: 1e9, ou: "" };
  for (let i = 1; i < b.length; i++) {
    const w = b[i].g - b[i - 1].d;
    if (w < pire.ecart) pire = { ecart: w, ou: `${b[i - 1].t}|${b[i].t}` };
  }
  verifie("les libellés du bandeau ne se touchent pas", pire.ecart >= 6, `${pire.ecart.toFixed(1)} px — ${pire.ou}`);
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
