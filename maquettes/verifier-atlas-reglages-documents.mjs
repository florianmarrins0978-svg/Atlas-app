/*
  Contrôle des documents — JavaScript coupé, iPhone 13, meta viewport injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · UN INTERRUPTEUR ÉTEINT NE DÉPLIE RIEN, et ce qui rend la facture régulière
      n'a pas d'interrupteur du tout — la règle du lot 1 (`ARCHITECTURE.md` §80).
    · LES DEUX TEXTES NE VONT PAS AU MÊME ENDROIT. Les conditions particulières
      valent pour CE devis ; le bas de page revient sur toutes les pièces. Les
      confondre produirait un texte imprimé deux fois, ou nulle part.
    · LE LOGO EST MONTRÉ À SA TAILLE RÉELLE. Un aperçu deux fois trop grand fait
      valider un logo illisible une fois imprimé (§78 : mesurer sur l'écran,
      jamais sur une planche complaisante).
    · « DÉPOSER SON PROPRE DEVIS » EST REFUSÉ, ET L'ÉCRAN DIT POURQUOI. Un refus
      sans raison se lit comme une paresse ; celui-ci s'échange contre quelque
      chose, et l'écran nomme les deux côtés.

  Chacune sait échouer : cocher `c-pied` d'avance rougit la première, fondre les
  deux textes rougit la deuxième, agrandir l'aperçu rougit la troisième, retirer
  la phrase du « pourquoi » rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-documents.html";
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

const COND = '[data-s="conditions"]', PART = '[data-s="particulieres"]',
      LOGO = '[data-s="logo"]', MODELE = '[data-s="modele"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Les conditions : allumées, elles déplient une VALEUR ──────────────
try {
  await cadrer(COND);
  const reglages = await page.$$eval(`${COND} .reg .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les cinq conditions demandées sont là",
    reglages.length === 5, reglages.join(" | "));
  verifie("dont la validité, l'acompte, le délai et les moyens de paiement",
    ["validité", "acompte", "délai", "moyens"].every((m) =>
      reglages.some((r) => new RegExp(m, "i").test(r))), reglages.join(" | "));

  // Chaque interrupteur allumé déplie quelque chose À RÉGLER — sinon
  // l'interrupteur suffisait, et le dépliage est du décor.
  for (const cle of ["validite", "acompte", "delai", "moyens"]) {
    verifie(`« ${cle} » s'ouvre allumé, avec sa valeur`, await vu(`${COND} [data-s="${cle}"] .deplie`));
  }
  const valeurs = await page.$$eval(`${COND} .valeur`, (l) => l.map((e) => e.value));
  verifie("les valeurs de départ sont celles qu'il a citées",
    valeurs.join("|") === "30|30|30", valeurs.join("|"));

  // Le rappel des pénalités part ÉTEINT, et l'écran dit pourquoi : certains
  // clients le lisent comme une méfiance. Un défaut choisi se justifie.
  verifie("le rappel des pénalités part éteint", !(await vu(`${COND} [data-s="penalites"] .deplie`)));
  await page.click(`${COND} [data-s="penalites"] .bat`);
  await page.waitForTimeout(320);
  verifie("touché, il s'ouvre et dit pourquoi il était éteint",
    /méfiance/i.test(await txt(`${COND} [data-s="penalites"] .deplie`)));
  await page.click(`${COND} [data-s="penalites"] .bat`);
  await page.waitForTimeout(260);

  // Éteindre un réglage referme sa valeur : un champ sous un réglage coupé
  // invite à le remplir pour rien.
  await page.click(`${COND} [data-s="acompte"] .bat`);
  await page.waitForTimeout(320);
  verifie("éteint, le champ de l'acompte n'existe plus",
    !(await vu(`${COND} [data-s="acompte"] .deplie`)));
  await page.click(`${COND} [data-s="acompte"] .bat`);
  await page.waitForTimeout(260);

  // CE QUI REND LA FACTURE RÉGULIÈRE N'A PAS D'INTERRUPTEUR.
  const cases = await page.$$eval(`${COND} [data-s="scelle"] input, ${COND} [data-s="scelle"] .piste`,
    (l) => l.length);
  verifie("la mention légale ne porte ni case ni piste", cases === 0, `${cases}`);
  verifie("elle est marquée obligatoire", /obligatoire/i.test(await txt(`${COND} .oblig`)));
  verifie("et dit ce que la retirer produirait",
    /irrégulière/i.test(await txt(`${COND} .pourquoi`)));
  await (await page.$(COND)).screenshot({ path: `${SORTIE}/reglages-documents-conditions.png` });
} catch (e) { echecs.push("conditions · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Deux textes, et ils ne vont pas au même endroit ───────────────────
try {
  await cadrer(PART);
  const noms = await page.$$eval(`${PART} .reg .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les deux textes sont distingués, et non fondus en un",
    noms.length === 2 && noms[0] !== noms[1], noms.join(" | "));

  const dit = await txt(`${PART} [data-s="difference"]`);
  verifie("l'écran dit qu'ils ne vont pas au même endroit",
    /pas au même endroit/i.test(dit), dit.slice(0, 60));
  verifie("l'un vaut pour CE devis", /ce devis/i.test(dit));
  verifie("l'autre pour toutes les pièces", /toutes/i.test(dit));

  // Le bas de page part éteint : il revient sur CHAQUE pièce, et un texte
  // imprimé partout par défaut se découvre sur la facture d'un client.
  verifie("le texte de bas de page part éteint", !(await vu(`${PART} [data-s="pied"] .libre`)));
  await page.click(`${PART} [data-s="pied"] .bat`);
  await page.waitForTimeout(320);
  verifie("touché, il ouvre sa zone de texte", await vu(`${PART} [data-s="pied"] .libre`));
  const corps = await page.$eval(`${PART} [data-s="pied"] .libre`,
    (e) => parseFloat(getComputedStyle(e).fontSize));
  verifie("qui ne fait pas zoomer Safari", corps >= 16, `${corps} px`);
  await (await page.$(PART)).screenshot({ path: `${SORTIE}/reglages-documents-textes.png` });
} catch (e) { echecs.push("textes · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Le logo, montré à sa taille réelle ────────────────────────────────
try {
  await cadrer(LOGO);
  verifie("le logo posé est montré", await vu(`${LOGO} [data-s="apercu"]`));
  // 26 mm sur le papier ≈ 74 px à l'écran. Un aperçu deux fois trop grand fait
  // valider un logo qui sera illisible imprimé (§78).
  const taille = await rect(`${LOGO} .apercu .marque`);
  verifie("à une taille qui ne ment pas sur le résultat imprimé",
    taille.w >= 60 && taille.w <= 96, `${taille.w.toFixed(0)} px`);
  verifie("et l'écran dit que c'est sa taille réelle",
    /taille réelle/i.test(await txt(`${LOGO} .apercu .dit`)));

  verifie("on peut le retirer", await vu(`${LOGO} [data-s="retirer-logo"]`));
  const rouge = await page.$eval(`${LOGO} [data-s="retirer-logo"]`, (e) => getComputedStyle(e).color);
  verifie("dans la couleur d'alerte de la charte", rouge === "rgb(156, 59, 46)", rouge);
  verifie("et le remplacer", await vu(`${LOGO} [data-s="poser"]`));

  // LA RÉSERVE : le PDF ne pose aucune image. Le taire ferait croire à un
  // acquis — le piège que `CLAUDE.md` §5 nomme.
  const reserve = await txt(`${LOGO} [data-s="reserve-logo"]`);
  verifie("l'écran dit que le PDF ne pose aucune image aujourd'hui",
    /aucune image/i.test(reserve), reserve.slice(0, 60));
  verifie("et que cela reste à coder", /coder/i.test(reserve));
  await (await page.$(LOGO)).screenshot({ path: `${SORTIE}/reglages-documents-logo.png` });
} catch (e) { echecs.push("logo · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le modèle : un refus qui s'explique et qui s'échange ──────────────
try {
  await cadrer(MODELE);
  const possible = await page.$$eval(`${MODELE} .voie:not(.non) .nom`, (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("ce qui est possible est nommé en premier, et il y en a plusieurs",
    possible.length >= 3, possible.join(" | "));
  verifie("dont le logo, les conditions et les textes",
    ["logo", "conditions", "textes"].every((m) =>
      possible.some((p) => new RegExp(m, "i").test(p))), possible.join(" | "));

  const impossible = await page.$$eval(`${MODELE} .voie.non .nom`, (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("un seul point est refusé", impossible.length === 1, impossible.join(" | "));
  verifie("et c'est bien celui qu'il demandait", /feuille|devis/i.test(impossible[0]), impossible[0]);

  // UN REFUS SANS RAISON SE LIT COMME UNE PARESSE.
  const pourquoi = await txt(`${MODELE} [data-s="pourquoi-non"]`);
  verifie("l'écran dit pourquoi, et pas seulement non",
    /calcul|recompose|totaux/i.test(pourquoi), pourquoi.slice(0, 60));
  verifie("avec ce qui casserait concrètement", /faux|bouge|déplacent/i.test(pourquoi));

  // ET IL S'ÉCHANGE : les deux côtés sont nommés, pas seulement la perte.
  const echange = await txt(`${MODELE} [data-s="echange"]`);
  verifie("il dit ce qu'on y gagne", /gagnez/i.test(echange), echange.slice(0, 50));
  verifie("et ce qu'on y perd, sans le cacher", /perdez/i.test(echange));
  await (await page.$(MODELE)).screenshot({ path: `${SORTIE}/reglages-documents-modele.png` });
} catch (e) { echecs.push("modèle · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel] of [["conditions", COND], ["textes", PART],
                            ["logo", LOGO], ["modèle", MODELE]]) {
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

  await cadrer(COND);
  await controlerGrammaire(page, COND, verifie);
  await controlerRetrait(page, verifie);

  const petites = await page.$$eval(".ecran .bat, .ecran .voie, .ecran .past span, .ecran .apercu", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 36)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 30)));
  verifie("aucune ligne ni pastille trop basse pour le doigt", petites.length === 0, petites.join(" | "));
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

// ── 6. La loupe : éteinte sur téléphone, allumée en gros plan ────────────
try {
  const t = await rect(COND);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(COND, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non quatre de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-documents-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
