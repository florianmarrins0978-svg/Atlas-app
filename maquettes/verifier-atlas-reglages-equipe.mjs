/*
  Contrôle de l'équipe et des rôles — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · DEUX LISTES, ET PAS UNE. « Équipe » désigne déjà une FILE DU PLANNING dans
      Atlas (`entreprises.nombre_equipes`), pas un compte. Les fondre produirait
      la question insoluble « pourquoi mon commercial est-il dans le planning ? ».
    · CHAQUE RÔLE DIT CE QU'IL FERME, pas seulement ce qu'il ouvre. Une liste de
      permissions qui n'énumère que les droits laisse croire que le reste est
      permis.
    · LE SALARIÉ NE REÇOIT AUCUN MONTANT, et son écran ne laisse AUCUNE PLACE
      pour un montant. `docs/QUESTIONS.md` §10 : masquer à l'écran ne protège de
      rien, le PDF s'ouvre. Un emplacement vide dirait « il y a quelque chose à
      aller chercher ».
    · SEUL, ON NE PARLE PAS DE RÔLES — la leçon des équipes (`ARCHITECTURE.md`
      §51) : on ne propose pas d'arbitrer ce qui n'a pas lieu d'être.

  Chacune sait échouer : fondre les deux blocs rougit la première, retirer les
  lignes `.non` rougit la deuxième, poser un prix dans l'écran du salarié rougit
  la troisième, ajouter un choix de rôle à l'écran « seul » rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-equipe.html";
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

const ACCES = '[data-s="acces"]', ROLE = '[data-s="role"]',
      SAL = '[data-s="salarie"]', SEUL = '[data-s="seul"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Deux listes, et le mot qui les sépare ─────────────────────────────
try {
  await cadrer(ACCES);
  const titres = await page.$$eval(`${ACCES} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les comptes et les équipes sont DEUX blocs, dans cet ordre",
    titres.join("|") === "Qui a accès|Vos équipes", titres.join("|"));

  const comptes = await page.$$eval(`${ACCES} .bloc:nth-of-type(1) .pers`, (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      role: e.querySelector(".role")?.textContent.trim() ?? "",
    })));
  verifie("trois comptes, chacun avec son rôle écrit",
    comptes.length === 3 && comptes.every((c) => c.role.length > 0),
    JSON.stringify(comptes));
  verifie("les trois rôles demandés sont ceux-là",
    comptes.map((c) => c.role).join("|") === "Patron|Commercial|Salarié",
    comptes.map((c) => c.role).join("|"));

  // Une file du planning n'a PAS de rôle : c'est ce qui prouve, à l'écran, que
  // les deux listes ne sont pas la même chose.
  const files = await page.$$eval(`${ACCES} .bloc:nth-of-type(2) .pers`, (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      role: e.querySelector(".role")?.textContent.trim() ?? "",
    })));
  verifie("une file du planning ne porte aucun rôle",
    files.length === 2 && files.every((f) => f.role === ""), JSON.stringify(files));

  const dit = await txt(`${ACCES} [data-s="distinction"]`);
  verifie("et l'écran dit en toutes lettres qu'une équipe n'est pas un compte",
    /n'est pas un compte/i.test(dit), dit.slice(0, 60));

  // On ne se retire pas son propre accès : l'entreprise n'aurait plus personne
  // pour la régler.
  const soi = await page.$eval(`${ACCES} .pers.moi .chev`,
    (e) => getComputedStyle(e).visibility);
  verifie("on ne peut pas changer son propre rôle", soi === "hidden", soi);
  verifie("un geste ajoute quelqu'un", /accès/i.test(await txt(`${ACCES} [data-s="ajout"]`)));
  await (await page.$(ACCES)).screenshot({ path: `${SORTIE}/reglages-equipe-acces.png` });
} catch (e) { echecs.push("accès · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Chaque rôle dit ce qu'il FERME, pas seulement ce qu'il ouvre ──────
try {
  await cadrer(ROLE);
  verifie("l'écran s'ouvre sur le rôle en cours", await vu(`${ROLE} .s-commercial`));
  verifie("et les autres ne sont pas affichés en même temps",
    !(await vu(`${ROLE} .s-patron`)) && !(await vu(`${ROLE} .s-salarie`)));

  for (const [id, classe, nom] of [["r-patron", "s-patron", "patron"],
                                   ["r-commercial", "s-commercial", "commercial"],
                                   ["r-salarie", "s-salarie", "salarié"]]) {
    await page.click(`${ROLE} .o-${id.slice(2)}`);
    await page.waitForTimeout(300);
    verifie(`choisir « ${nom} » montre ce que ce rôle change`, await vu(`${ROLE} .${classe}`));
    const autres = await page.$$eval(`${ROLE} .suite`, (l) =>
      l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).length);
    verifie(`et un seul rôle parle à la fois (${nom})`, autres === 1, `${autres}`);
  }

  // LE POINT : un rôle restreint doit dire ce qu'il REFUSE. N'énumérer que les
  // droits laisse croire que le reste est permis.
  for (const [classe, nom] of [["s-commercial", "commercial"], ["s-salarie", "salarié"]]) {
    await page.click(`${ROLE} .o-${classe.slice(2)}`);
    await page.waitForTimeout(260);
    const refus = await page.$$eval(`${ROLE} .${classe} .voit li.non`, (l) =>
      l.map((e) => e.textContent.trim()));
    verifie(`le rôle « ${nom} » dit ce qu'il ferme, pas seulement ce qu'il ouvre`,
      refus.length >= 2, `${refus.length} refus`);
  }
  // Le patron, lui, ne ferme rien — et une ligne « × » chez lui serait fausse.
  await page.click(`${ROLE} .o-patron`);
  await page.waitForTimeout(260);
  const refusPatron = await page.$$eval(`${ROLE} .s-patron .voit li.non`, (l) => l.length);
  verifie("le patron, lui, n'a rien de fermé", refusPatron === 0, `${refusPatron}`);
  verifie("et l'écran prévient qu'un second patron peut tout défaire",
    /défaire|bancaires/i.test(await txt(`${ROLE} .s-patron .mot`)));

  // La règle de `QUESTIONS.md` §10, écrite là où on la lira.
  await page.click(`${ROLE} .o-salarie`);
  await page.waitForTimeout(260);
  const pasMasque = await txt(`${ROLE} [data-s="pas-masque"]`);
  verifie("l'écran dit que les montants ne sont pas CACHÉS mais pas ENVOYÉS",
    /pas envoyés|ne lui sont pas envoyés/i.test(pasMasque), pasMasque.slice(0, 60));
  verifie("et pourquoi masquer ne protégerait de rien", /PDF/i.test(pasMasque));

  const marque = await page.$eval(`${ROLE} .o-salarie .rond`, (x) => getComputedStyle(x).boxShadow);
  const autre = await page.$eval(`${ROLE} .o-patron .rond`, (x) => getComputedStyle(x).boxShadow);
  verifie("la marque se déplace, sans en laisser deux", marque !== autre);
  await (await page.$(ROLE)).screenshot({ path: `${SORTIE}/reglages-equipe-role.png` });
} catch (e) { echecs.push("rôle · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. LE SALARIÉ : aucun montant, et aucune place pour un montant ───────
try {
  await cadrer(SAL);
  const tout = await txt(SAL);
  const montants = tout.match(/\d[\d\s.,]*\s?€|€/g) || [];
  verifie("pas un seul montant sur l'écran d'un salarié", montants.length === 0, montants.join(" | "));
  verifie("ni le mot « total », ni « prix », ni « TVA »",
    !/\btotal\b|\bprix\b|\bTVA\b/i.test(tout),
    (tout.match(/.{0,20}(total|prix|TVA).{0,20}/i) || [""])[0]);

  // ET AUCUNE PLACE LAISSÉE : un emplacement vide dirait « il y a un montant
  // ici, on te le refuse » — et le premier réflexe serait d'ouvrir le PDF.
  const creux = await page.$$eval(`${SAL} .lig`, (l) =>
    l.filter((e) => {
      const d = e.lastElementChild;
      return !d || d.textContent.trim() === "";
    }).length);
  verifie("aucun emplacement vide là où un prix serait attendu", creux === 0, `${creux}`);

  const dit = await txt(`${SAL} [data-s="rien"]`);
  verifie("l'écran dit que le serveur ne les a pas envoyés",
    /pas envoyés|n'a pas envoyé|ne les a pas/i.test(dit), dit.slice(0, 60));
  verifie("il voit tout de même ce qu'il y a à faire",
    (await page.$$eval(`${SAL} .lig .quoi`, (l) => l.length)) >= 4);
  await (await page.$(SAL)).screenshot({ path: `${SORTIE}/reglages-equipe-salarie.png` });
} catch (e) { echecs.push("salarié · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Seul : rien à arbitrer ────────────────────────────────────────────
try {
  await cadrer(SEUL);
  const comptes = await page.$$eval(`${SEUL} .pers`, (l) => l.length);
  verifie("seul, un seul compte à l'écran", comptes === 1, `${comptes}`);
  const titres = await page.$$eval(`${SEUL} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("et le bloc des équipes disparaît avec lui",
    titres.join("|") === "Qui a accès", titres.join("|"));
  const choix = await page.$$eval(`${SEUL} .opt`, (l) => l.length);
  verifie("aucun choix de rôle n'est proposé quand il n'y a personne à distinguer",
    choix === 0, `${choix}`);
  const dit = await txt(`${SEUL} [data-s="seulmot"]`);
  verifie("l'écran dit pourquoi il ne demande rien", /rien à arbitrer/i.test(dit), dit.slice(0, 50));
  // Coupé net : la suite expliquerait ce que l'écran montre déjà.
  verifie("et il s'arrête là — pas un mot de plus", dit.length < 120, `${dit.length} caractères`);
  verifie("le geste d'ajout reste, lui — c'est la seule chose à faire ici",
    await vu(`${SEUL} .ajout`));
  await (await page.$(SEUL)).screenshot({ path: `${SORTIE}/reglages-equipe-seul.png` });
} catch (e) { echecs.push("seul · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel, actif] of [["accès", ACCES, "réglages"], ["rôle", ROLE, "réglages"],
                                   ["salarié", SAL, "chantiers"], ["seul", SEUL, "réglages"]]) {
    await cadrer(sel);
    verifie(`le bandeau de « ${nom} » désigne le bon écran`,
      (await txt(`${sel} .bas .actif`)).toLowerCase() === actif);
    const sl = await page.$eval(sel, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`et son trait tombe sous « ${actif} » (${nom})`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);
  }

  await cadrer(ACCES);
  await controlerGrammaire(page, ACCES, verifie);
  await controlerRetrait(page, verifie);

  const petites = await page.$$eval(".ecran .pers, .ecran .opt, .ecran .ajout, .ecran .lig", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 44)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 40)));
  verifie("aucune ligne sous la cible de 44 px", petites.length === 0, petites.join(" | "));
  const grosses = await page.$$eval('.ecran input[type="radio"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La loupe : éteinte sur téléphone, allumée en gros plan ────────────
try {
  const t = await rect(ACCES);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(ACCES, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non quatre de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-equipe-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
