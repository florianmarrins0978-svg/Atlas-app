/*
  Contrôle des notifications — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · LES TROIS ARRÊTS DE L'AGENT NE SE COUPENT PAS. `docs/AGENT.md` les pose
      comme non négociables : envoyer un devis, poser une date, émettre une
      facture. Un interrupteur qui les supprimerait ferait partir un devis sans
      qu'il l'ait vu (`CLAUDE.md` §4).
    · CE QUI N'EXISTE PAS PORTE « BIENTÔT », jamais un interrupteur mort. Un
      bouton qu'on touche et qui ne fait rien se lit comme une panne.
    · L'APPARENCE MONTRE, ELLE NE DÉCRIT PAS : des pastilles de couleur réelles,
      pas des adjectifs. Personne ne choisit une couleur sur le mot « sobre ».
    · « TOUT EST EFFACÉ » SERAIT FAUX : les factures se conservent dix ans, et
      l'écran le dit avant le geste, pas après.

  Chacune sait échouer : poser une case sur un arrêt rougit la première, retirer
  « Bientôt » rougit la deuxième, remplacer les pastilles par du texte rougit la
  troisième, effacer la mention des dix ans rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-reste.html";
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

const IA = '[data-s="ia"]', INT = '[data-s="integrations"]', APP = '[data-s="apparence"]',
      SEC = '[data-s="securite"]', ABO = '[data-s="abonnement"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Atlas IA : ce qu'il fait seul, et les trois arrêts ────────────────
try {
  await cadrer(IA);
  const seul = await page.$$eval(`${IA} .reg .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("ce que l'agent fait seul se règle", seul.length >= 3, seul.join(" | "));

  // LES TROIS ARRÊTS DE `docs/AGENT.md`, non négociables.
  const arrets = await page.$$eval(`${IA} .scelle .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les trois arrêts sont nommés", arrets.length === 3, arrets.join(" | "));
  verifie("envoyer un devis, poser une date, émettre une facture",
    /devis/i.test(arrets[0]) && /date/i.test(arrets[1]) && /facture/i.test(arrets[2]),
    arrets.join(" | "));
  const cases = await page.$$eval(`${IA} .scelle input, ${IA} .scelle .piste`, (l) => l.length);
  verifie("aucun d'eux ne porte d'interrupteur", cases === 0, `${cases}`);
  const marques = await page.$$eval(`${IA} .toujours`, (l) => l.map((e) => e.textContent.trim()));
  verifie("chacun porte la marque « toujours vous »",
    marques.length === 3 && marques.every((m) => /toujours/i.test(m)), marques.join(" | "));
  verifie("et l'écran dit ce qu'un devis parti coûte",
    /ne se rattrape pas|avoir/i.test(await txt(`${IA} .pourquoi`)));

  verifie("il apprend de lui, jamais des autres",
    /reste chez vous|aucun de vos prix/i.test(await txt(`${IA} [data-s="apprend-ia"]`)));
  await (await page.$(IA)).screenshot({ path: `${SORTIE}/reglages-reste-ia.png` });
} catch (e) { echecs.push("IA · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Intégrations : ce qui marche, ce qui attend ───────────────────────
try {
  await cadrer(INT);
  const relies = await page.$$eval(`${INT} .rub:not(.plus_tard) .nom`, (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("les deux agendas, qui fonctionnent déjà",
    relies.length === 2 && /google/i.test(relies[0]) && /apple/i.test(relies[1]), relies.join(" | "));

  // « BIENTÔT » plutôt que « disponible » : l'outil n'est pas choisi.
  const attente = await page.$$eval(`${INT} .rub.plus_tard .etat`, (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("la comptabilité est marquée « bientôt », pas disponible",
    attente.length === 1 && /bientôt/i.test(attente[0]), attente.join(" | "));
  verifie("et l'écran dit que le choix lui revient",
    /vous revient|choix/i.test(await txt(`${INT} [data-s="compta-mot"]`)));
  verifie("rien n'est obligatoire, et l'écran le dit",
    /obligatoire/i.test(await txt(`${INT} [data-s="rien-oblige"]`)));
  await (await page.$(INT)).screenshot({ path: `${SORTIE}/reglages-reste-integrations.png` });
} catch (e) { echecs.push("intégrations · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. L'apparence MONTRE ────────────────────────────────────────────────
try {
  await cadrer(APP);
  // Des pastilles de couleur réelles, pas des adjectifs.
  const teintes = await page.$$eval(`${APP} [data-s="teintes"] span`, (l) =>
    l.map((e) => ({ fond: getComputedStyle(e).backgroundColor,
                    mot: e.textContent.trim(),
                    large: e.getBoundingClientRect().width })));
  verifie("quatre accents, montrés en couleur", teintes.length === 4, `${teintes.length}`);
  verifie("et non décrits par un adjectif",
    teintes.every((t) => t.mot === ""), teintes.map((t) => t.mot).join("|"));
  verifie("chacun porte une couleur différente",
    new Set(teintes.map((t) => t.fond)).size === 4, teintes.map((t) => t.fond).join(" | "));
  verifie("et se touche du doigt", teintes.every((t) => t.large >= 40),
    teintes.map((t) => t.large.toFixed(0)).join("|"));
  const prise = await page.$$eval(`${APP} [data-s="teintes"] .prise`, (l) => l.length);
  verifie("un seul accent est retenu à la fois", prise === 1, `${prise}`);
  verifie("le fond crème ne change pas, et l'écran le dit",
    /fond crème/i.test(await txt(`${APP} [data-s="accent-mot"]`)));

  // UN INTERRUPTEUR MORT EST PIRE QU'UNE ABSENCE.
  const sombre = await txt(`${APP} [data-s="sombre"]`);
  verifie("le mode sombre est marqué « bientôt »", /bientôt/i.test(sombre), sombre.slice(0, 50));
  const bascules = await page.$$eval(`${APP} [data-s="sombre"] input, ${APP} [data-s="sombre"] .piste`,
    (l) => l.length);
  verifie("et ne porte aucun interrupteur qui ne ferait rien", bascules === 0, `${bascules}`);
  verifie("l'écran dit pourquoi", /pire qu&#39;une absence|panne/i.test(
    (await txt(`${APP} [data-s="reserve-sombre"]`)).replace(/'/g, "&#39;")));
  await (await page.$(APP)).screenshot({ path: `${SORTIE}/reglages-reste-apparence.png` });
} catch (e) { echecs.push("apparence · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Sécurité : « tout est effacé » serait faux ────────────────────────
try {
  await cadrer(SEC);
  verifie("le téléchargement de ses données est là",
    /télécharger/i.test(await txt(`${SEC} [data-s="emporter"]`)));
  verifie("et l'écran dit que ces gestes fonctionnent déjà",
    /déjà/i.test(await txt(`${SEC} [data-s="deja"]`)));

  // LE GESTE IRRÉVERSIBLE, seul en bas, après un trait — et honnête.
  const danger = await txt(`${SEC} [data-s="danger"]`);
  verifie("supprimer son entreprise est possible", /supprimer/i.test(danger), danger.slice(0, 40));
  verifie("et l'écran dit ce que la loi impose de garder",
    /dix ans/i.test(danger), danger.slice(0, 160));
  verifie("il conseille d'emporter ses données avant", /emportez/i.test(danger));
  const rouge = await page.$eval(`${SEC} [data-s="danger"] .nom`, (e) => getComputedStyle(e).color);
  verifie("dans la couleur d'alerte de la charte", rouge === "rgb(156, 59, 46)", rouge);
  // Séparé de ce qui se règle : il vit APRÈS un trait, en bas de l'écran.
  const place = await page.$eval(SEC, (r) => {
    const c = r.querySelector(".corps"), d = r.querySelector('[data-s="danger"]');
    return { y: d.getBoundingClientRect().y - c.getBoundingClientRect().y,
             trait: parseFloat(getComputedStyle(d).borderTopWidth) };
  });
  verifie("posé en bas, après un trait, séparé du reste",
    place.y > 250 && place.trait > 0, `${place.y.toFixed(0)} px, trait ${place.trait}`);
  await (await page.$(SEC)).screenshot({ path: `${SORTIE}/reglages-reste-securite.png` });
} catch (e) { echecs.push("sécurité · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Abonnement : la forme, pas le contenu ─────────────────────────────
try {
  await cadrer(ABO);
  const dit = await txt(`${ABO} [data-s="pas-encore"]`);
  verifie("l'écran dit que rien n'est décidé", /rien n&#39;est encore décidé/i.test(dit.replace(/'/g, "&#39;")),
    dit.slice(0, 60));
  verifie("ni le prix, ni l'offre", /prix/i.test(dit) && /offre/i.test(dit));
  const lignes = await page.$$eval(`${ABO} .rub`, (l) =>
    l.map((e) => ({ nom: e.querySelector(".nom").textContent.trim(),
                    tard: e.classList.contains("plus_tard") })));
  verifie("toutes les lignes sont marquées « bientôt »",
    lignes.length === 3 && lignes.every((l) => l.tard), JSON.stringify(lignes));

  // LE MOT QUI TROMPE : « factures » désigne deux choses opposées.
  const deux = await txt(`${ABO} [data-s="deux-factures"]`);
  verifie("l'écran distingue ses factures Atlas de celles de ses clients",
    /Atlas vous envoie/i.test(deux) && /clients/i.test(deux), deux.slice(0, 90));
  await (await page.$(ABO)).screenshot({ path: `${SORTIE}/reglages-reste-abonnement.png` });
} catch (e) { echecs.push("abonnement · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel] of [["IA", IA], ["intégrations", INT], ["apparence", APP],
                            ["sécurité", SEC], ["abonnement", ABO]]) {
    await cadrer(sel);
    verifie(`le bandeau de « ${nom} » désigne les réglages`,
      (await txt(`${sel} .bas .actif`)).toLowerCase() === "réglages");
    const sl = await page.$eval(sel, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`et son trait tombe sous « Réglages » (${nom})`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);
  }

  await cadrer(IA);
  await controlerGrammaire(page, IA, verifie);
  await controlerRetrait(page, verifie);

  const petites = await page.$$eval(".ecran .bat, .ecran .rub", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 44)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 30)));
  verifie("aucune ligne sous la cible de 44 px", petites.length === 0, petites.join(" | "));
  const grosses = await page.$$eval('.ecran input[type="checkbox"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. La loupe ──────────────────────────────────────────────────────────
try {
  const t = await rect(IA);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(IA, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non cinq de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-reste-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
