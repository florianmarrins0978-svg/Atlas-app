/*
  Contrôle du raccordement iCloud — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure de l'écran, ce sont SES DEUX RÈGLES :

    · ON PRÉVIENT AVANT DE FAIRE TAPER. Le mot de passe spécifique à l'app
      ouvre tout l'iCloud, et Apple ne sait pas le restreindre. L'avertissement
      doit donc se trouver AU-DESSUS du champ — vérifié par les positions à
      l'écran, pas par la présence du texte : une phrase juste placée au mauvais
      endroit est une phrase lue trop tard.
    · ÉCRIRE EST UNE DÉCISION. L'interrupteur est éteint au départ, et le choix
      du calendrier n'existe pas tant qu'il l'est.

  CHACUN DE CES CONTRÔLES SAIT ÉCHOUER, et c'est le seul moyen de savoir qu'il
  contrôle quelque chose :

    · déplacer le bloc `.prevenir` sous le champ rougit le premier ;
    · retirer `.ecriture{display:none}` rougit le deuxième ;
    · remplacer `border-radius:999px` par `4px` sur `.capsule` rougit le
      troisième (la règle des capsules, question 13 de `docs/QUESTIONS.md`) ;
    · descendre le corps des champs à 15 px rougit le quatrième (Safari zoome
      en dessous de 16 px, et l'écran part de travers sous son doigt).

  RÉSERVE, écrite pour qu'on ne s'y trompe pas : ceci éprouve un DESSIN, pas un
  raccordement. Le réseau de cet environnement refuse `caldav.icloud.com` — ce
  qui touche au comportement réel d'Apple ne s'éprouvera que sur son banc.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-agenda-apple.html";
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

const AVANT = '[data-s="avant"]', APRES = '[data-s="apres"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, bas: r.y + r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(260); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. On prévient AVANT de faire taper ──────────────────────────────────
try {
  await cadrer(AVANT);
  const avertissement = await rect(`${AVANT} [data-s="prevenir"]`);
  const champ = await rect(`${AVANT} [data-s="motdepasse"]`);
  verifie("l'avertissement et le champ sont tous deux à l'écran",
    avertissement !== null && champ !== null);
  verifie("l'avertissement est AU-DESSUS du champ, pas en dessous",
    avertissement.bas <= champ.y,
    `avertissement finit à ${avertissement.bas.toFixed(0)}, champ commence à ${champ.y.toFixed(0)}`);

  const mots = await txt(`${AVANT} [data-s="prevenir"]`);
  verifie("il dit ce que le mot de passe ouvre VRAIMENT, sans l'adoucir",
    /tout votre iCloud/i.test(mots) && /pas seulement l'agenda/i.test(mots), `« ${mots.slice(0, 60)}… »`);
  verifie("et il dit comment le reprendre — un avertissement sans issue est une impasse",
    /annuler à tout moment/i.test(mots));

  const type = await page.$eval(`${AVANT} [data-s="motdepasse"] input`, (e) => e.type);
  verifie("le mot de passe est masqué à la frappe", type === "password", type);

  // Ces écrans se remplissent souvent à deux, ou en visio avec quelqu'un qui
  // aide : le mot de passe ne doit pas s'étaler en clair.
  const corps = await page.$$eval(`${AVANT} .champ input`, (l) =>
    l.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  verifie("les champs font 16 px au moins — en dessous, Safari zoome à la mise au point",
    corps.length === 2 && corps.every((c) => c >= 16), corps.join(" / "));

  await (await page.$(AVANT)).screenshot({ path: `${SORTIE}/agenda-apple-avant.png` });

  // L'écran ne tient pas sur une hauteur de téléphone, et c'est assumé : les
  // trois gestes doivent être lus AVANT les champs — on ne recopie pas un mot
  // de passe qu'on n'a pas encore. Ce qui ne s'assume pas, c'est un bouton
  // qu'on ne trouve qu'en devinant qu'il faut faire défiler : on vérifie donc
  // qu'il vient bien au bout du défilement, et on en garde la vue.
  await page.$eval(`${AVANT} .capsule`, (e) => e.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(300);
  const bouton = await rect(`${AVANT} .capsule`);
  const cadre = await rect(AVANT);
  verifie("le bouton se trouve au bout du défilement",
    (await vu(`${AVANT} .capsule`)) && bouton.bas <= cadre.bas + 1 && bouton.y >= cadre.y,
    `bouton ${bouton.y.toFixed(0)}–${bouton.bas.toFixed(0)}, écran ${cadre.y.toFixed(0)}–${cadre.bas.toFixed(0)}`);
  verifie("et il dit ce qu'il fait, sans jargon",
    (await txt(`${AVANT} .capsule`)) === "Relier mon agenda Apple", await txt(`${AVANT} .capsule`));
  await (await page.$(AVANT)).screenshot({ path: `${SORTIE}/agenda-apple-avant-bas.png` });
} catch (e) { echecs.push("avant · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Écrire est une décision, pas un défaut ────────────────────────────
try {
  await cadrer(APRES);
  verifie("au départ, l'écriture est éteinte : aucun choix de calendrier",
    !(await vu(`${APRES} [data-s="ecriture"]`)));

  const eteint = await page.$eval(`${APRES} .piste`, (e) => getComputedStyle(e).backgroundColor);
  await (await page.$(APRES)).screenshot({ path: `${SORTIE}/agenda-apple-apres-eteint.png` });

  await page.click(`${APRES} [data-s="bascule"]`);
  await page.waitForTimeout(320);
  verifie("l'interrupteur touché fait paraître le choix du calendrier",
    await vu(`${APRES} [data-s="ecriture"]`));
  const allume = await page.$eval(`${APRES} .piste`, (e) => getComputedStyle(e).backgroundColor);
  verifie("et l'interrupteur se voit allumé", allume !== eteint, `${eteint} → ${allume}`);

  // Le repli sépare plutôt qu'il ne mélange : un calendrier « Atlas » à part se
  // retire d'un geste, là où des chantiers semés dans « Perso » se retrouvent
  // un par un. C'est le choix par défaut, pas une suggestion parmi trois.
  const coche = await page.$$eval(`${APRES} .ou`, (l) =>
    l.filter((e) => getComputedStyle(e.querySelector(".rond b")).transform !== "matrix(0, 0, 0, 0, 0, 0)")
     .map((e) => e.querySelector(".nom").childNodes[0].textContent.trim()));
  verifie("le calendrier séparé « Atlas » est le choix par défaut",
    coche.length === 1 && coche[0] === "Atlas", coche.join(" | ") || "aucun");

  const limite = await txt(`${APRES} .limite`);
  verifie("la limite est écrite là où elle se décide, pas ailleurs",
    /ne touche jamais un rendez-vous qu'il n'a pas posé/i.test(limite), `« ${limite.slice(0, 60)}… »`);

  // Un calendrier partagé expose les chantiers à des tiers : l'écran le dit à
  // la ligne concernée, au moment de choisir — pas dans un paragraphe en bas.
  const famille = await txt(`${APRES} .ou.c3`);
  verifie("un calendrier partagé prévient qu'il est partagé", /partagé/i.test(famille), famille.replace(/\n/g, " "));

  await page.click(`${APRES} .ou.c2`);
  await page.waitForTimeout(260);
  const apres2 = await page.$$eval(`${APRES} .ou`, (l) =>
    l.filter((e) => getComputedStyle(e.querySelector(".rond b")).transform !== "matrix(0, 0, 0, 0, 0, 0)")
     .map((e) => e.querySelector(".nom").childNodes[0].textContent.trim()));
  verifie("choisir un autre calendrier déplace la marque, sans en laisser deux",
    apres2.length === 1 && apres2[0] === "Perso", apres2.join(" | ") || "aucun");

  // On revient au repli avant la vue : c'est l'état qu'il verra en ouvrant
  // l'écran, et une capture prise sur le dernier clic du contrôle raconterait
  // un choix qu'il n'a pas fait.
  await page.click(`${APRES} .ou.c1`);
  await page.waitForTimeout(260);
  await (await page.$(APRES)).screenshot({ path: `${SORTIE}/agenda-apple-apres-ecriture.png` });

  // La limite — « Atlas ne touche jamais un rendez-vous qu'il n'a pas posé » —
  // se lit sous les trois choix : elle mérite sa vue, sans quoi la seule
  // capture montrée s'arrête au deuxième calendrier.
  await page.$eval(`${APRES} .limite`, (e) => e.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(300);
  const limiteVue = await rect(`${APRES} .limite`), cadreApres = await rect(APRES);
  verifie("la limite se lit au bout du défilement, sous les trois calendriers",
    (await vu(`${APRES} .limite`)) && limiteVue.bas <= cadreApres.bas + 1,
    `limite finit à ${limiteVue.bas.toFixed(0)}, écran à ${cadreApres.bas.toFixed(0)}`);
  await (await page.$(APRES)).screenshot({ path: `${SORTIE}/agenda-apple-apres-limite.png` });
} catch (e) { echecs.push("après · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. La forme commune, et rien qui déborde ─────────────────────────────
try {
  const formes = await page.$$eval(".capsule", (l) =>
    l.map((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return { rayon: parseFloat(s.borderRadius), h: r.height, t: e.textContent.trim() };
    }));
  const carres = formes.filter((f) => f.rayon < f.h / 2);
  verifie("tous les boutons sont des capsules (question 13)",
    formes.length >= 3 && carres.length === 0, carres.map((f) => `« ${f.t} » r=${f.rayon}`).join(" | "));

  // Une cible tactile de moins de 44 px se rate au doigt — la mesure d'Apple,
  // et celle que `PrimaryButton` tient déjà dans l'application.
  const petits = formes.filter((f) => f.h < 44).map((f) => `« ${f.t} » ${f.h.toFixed(0)} px`);
  verifie("aucun bouton sous les 44 px du doigt", petits.length === 0, petits.join(" | "));

  for (const s of [AVANT, APRES]) {
    const debord = await page.$eval(s, (e) => e.scrollWidth - e.clientWidth);
    verifie(`rien ne déborde en largeur (${s.slice(9, -2)})`, debord <= 1, `${debord} px`);
  }
} catch (e) { echecs.push("forme · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
fs.unlinkSync(ESSAI);

console.log(ok.map((n) => "  ✓ " + n).join("\n"));
if (echecs.length) {
  console.error("\n" + echecs.map((n) => "  ✗ " + n).join("\n"));
  console.error(`\n${echecs.length} contrôle(s) en échec sur ${ok.length + echecs.length}.`);
  process.exit(1);
}
console.log(`\n${ok.length} contrôles au vert. Vues dans ${SORTIE}/.`);
