/*
  Contrôle du centre de la fiche — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure des deux propositions, c'est CE QUI LES SÉPARE DE
  L'ÉTAT ACTUEL, et que le patron a signalé le 13 août 2026 :

    · sur un chantier dont le devis est écrit, l'écran ne doit plus proposer de
      DICTER. « Appuyez et décrivez le chantier » est ce qu'il a lu alors qu'il
      n'avait plus qu'à envoyer ;
    · le geste qui reste doit être AU CENTRE, pas dans un tiroir replié —
      vérifié par les positions, parce qu'une phrase juste rangée au mauvais
      endroit laisse un contrôle de texte au vert.

  CHACUN DE CES CONTRÔLES SAIT ÉCHOUER :

    · le premier rougit sur le téléphone « Aujourd'hui », et c'est voulu : ce
      téléphone-là REPRODUIT le défaut. On l'éprouve donc à l'envers — s'il
      cessait de porter la phrase, la maquette ne montrerait plus rien ;
    · remettre le geste dans le tiroir rougit le deuxième ;
    · retirer `.etage.s3{display:block}` rougit le sélecteur d'avancement ;
    · repasser les capsules à `4px` rougit la règle des boutons ronds.

  RÉSERVE, écrite pour qu'on ne s'y trompe pas : ceci éprouve un DESSIN. Rien
  n'est posé dans `src/app/chantiers/[id]/page.tsx` tant qu'il n'a pas choisi
  (`CLAUDE.md` §3 bis).
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-centre-de-la-fiche.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
// Chromium active un <label> sans `cursor:pointer`, Safari non.
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));
// Un commentaire JSX dans du HTML s'AFFICHE tel quel. Trouvé en écrivant cette
// maquette : `{/* … */}` s'était glissé dans la proposition 1.
verifie("aucun commentaire JSX égaré (il s'afficherait à l'écran)", !/\{\/\*/.test(source));

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

const AVANT = '[data-s="avant"]', P1 = '[data-s="p1"]', P2 = '[data-s="p2"]', P3 = '[data-s="p3"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, bas: r.y + r.height, milieu: r.y + r.height / 2 };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Le téléphone « Aujourd'hui » reproduit bien le défaut ─────────────
try {
  await cadrer(AVANT);
  const mots = await txt(AVANT);
  verifie("« Aujourd'hui » montre bien le défaut : on propose de dicter",
    /Appuyez et décrivez le chantier/.test(mots),
    "sans cette phrase, la maquette ne montre plus ce qu'elle corrige");
  verifie("et l'état, lui, dit déjà la vérité (corrigé le 13 août)",
    /Devis prêt à envoyer/i.test(mots));
  const geste = await rect(`${AVANT} .tiroir .ligne .d`);
  const ecran = await rect(AVANT);
  verifie("le geste qui reste est bien dans le BAS de l'écran, comme aujourd'hui",
    geste.y > ecran.y + ecran.h * 0.75,
    `à ${(((geste.y - ecran.y) / ecran.h) * 100).toFixed(0)} % de la hauteur`);
  await (await page.$(AVANT)).screenshot({ path: `${SORTIE}/centre-aujourdhui.png` });
} catch (e) { echecs.push("aujourd'hui · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Les deux propositions : plus de dictée, et le geste au centre ─────
for (const [nom, sel, cible] of [["proposition 1", P1, '[data-s="geste1"]'], ["proposition 2", P2, '[data-s="geste2"]']]) {
  try {
    await cadrer(sel);
    const mots = await txt(sel);
    verifie(`${nom} : l'écran ne propose plus de dicter un chantier déjà chiffré`,
      !/Appuyez et décrivez/.test(mots),
      (mots.match(/.{0,30}Appuyez.{0,30}/) || [""])[0]);
    verifie(`${nom} : le geste qui reste est nommé`, /Envoyer le devis au client/.test(mots));
    verifie(`${nom} : le montant est sous les yeux avant l'envoi`, /1 440/.test(mots),
      "c'est le prix qu'il avait corrigé — il doit pouvoir le revérifier ici");

    // **Au CENTRE, mesuré.** Un geste rangé en bas est un geste qu'on ne trouve
    // qu'en cherchant : c'est exactement ce qu'il a vécu.
    const bloc = await rect(`${sel} ${cible}`);
    const ecran = await rect(sel);
    const haut = (bloc.y - ecran.y) / ecran.h;
    verifie(`${nom} : le geste occupe le CENTRE de l'écran, pas le tiroir`,
      haut > 0.15 && haut < 0.62, `commence à ${(haut * 100).toFixed(0)} % de la hauteur`);

    await (await page.$(sel)).screenshot({ path: `${SORTIE}/centre-${sel.slice(9, -2)}.png` });
  } catch (e) { echecs.push(`${nom} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── 3. Le sélecteur d'avancement : le centre SUIT le chantier ────────────
try {
  await cadrer(P3);
  const attendus = [
    ["e1", "Brouillon", /Appuyez et décrivez le chantier/, null],
    ["e2", "À vérifier", /Écrire le devis/, /Appuyez et décrivez/],
    ["e3", "Devis prêt à envoyer", /Envoyer le devis au client/, /Appuyez et décrivez/],
    ["e4", "En attente de réponse", /Le client choisit sa date/, /Envoyer le devis au client/],
  ];
  let derive = "";
  for (const [id, etat, present, absent] of attendus) {
    await page.click(`[data-s="choix"] label[for="${id}"]`);
    await page.waitForTimeout(220);
    const mots = await txt(P3);
    // **Comparaison insensible à la casse, et ce n'est pas une facilité.**
    // `.caps` met l'état en capitales : `innerText` rend « BROUILLON » là où le
    // source écrit « Brouillon ». Le contrôle accusait donc un état absent qui
    // était sous ses yeux — une erreur qui envoie chercher au mauvais endroit.
    if (!mots.toLowerCase().includes(etat.toLowerCase())) derive ||= `${id} : l'état « ${etat} » manque`;
    if (!present.test(mots)) derive ||= `${id} : ${present} introuvable`;
    if (absent && absent.test(mots)) derive ||= `${id} : ${absent} traîne encore`;
    await (await page.$(P3)).screenshot({ path: `${SORTIE}/centre-etape-${id}.png` });
  }
  verifie("le centre suit l'avancement, étape par étape", derive === "", derive);

  // Un chantier NEUF garde son anneau : le patron l'a demandé au milieu de
  // l'écran le 11 août, et cette maquette ne le lui reprend pas.
  await page.click('[data-s="choix"] label[for="e1"]');
  await page.waitForTimeout(220);
  verifie("un chantier neuf garde son anneau au centre — rien ne lui est repris",
    /Appuyez et décrivez le chantier/.test(await txt(P3)));
} catch (e) { echecs.push("progression · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. La forme commune, et rien qui déborde ─────────────────────────────
try {
  // **Seuls les boutons VISIBLES sont mesurés.** Les étages repliés du
  // sélecteur rendent 0 px de haut : les compter ferait échouer la règle des
  // 44 px sur des boutons que personne ne peut toucher — un rouge qui accuse à
  // tort, et qu'on apprend à ignorer.
  const formes = await page.$$eval(".capsule, .secondaire", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return { rayon: parseFloat(s.borderRadius), h: r.height, t: e.textContent.trim() };
    }));
  const carres = formes.filter((f) => f.rayon < f.h / 2);
  verifie("tous les boutons sont des capsules (question 13)",
    formes.length >= 3 && carres.length === 0, carres.map((f) => `« ${f.t} » r=${f.rayon}`).join(" | "));
  const petits = formes.filter((f) => f.h < 44).map((f) => `« ${f.t} » ${f.h.toFixed(0)} px`);
  verifie("aucun bouton sous les 44 px du doigt", petits.length === 0, petits.join(" | "));

  for (const s of [AVANT, P1, P2, P3]) {
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
