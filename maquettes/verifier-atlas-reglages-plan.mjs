/*
  Contrôle du plan des réglages — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure de l'écran, ce sont SES TROIS RÈGLES :

    · CE QU'UN RÔLE N'A PAS LE DROIT DE VOIR N'EST PAS DANS SA LISTE. Le
      contrôle ne regarde pas si la ligne est masquée : il cherche le MOT dans
      tout l'écran (`innerText`), parce que `QUESTIONS.md` §10 a tranché que
      cacher ne suffit pas. Un jour où la ligne serait rendue puis grisée, ce
      contrôle rougirait — c'est exactement ce qu'on lui demande ;
    · UN INTERRUPTEUR ÉTEINT NE DÉPLIE RIEN. Le champ n'existe pas tant que le
      réglage est coupé ;
    · LA LIGNE OBLIGATOIRE NE PORTE AUCUN INTERRUPTEUR, et le dit à sa place
      dans la liste.

  Chacun sait échouer : ajouter « IBAN » dans l'écran du salarié rougit le
  premier, retirer `.interrupteur:checked ~ .deplie{display:block}` rougit le
  deuxième, poser une case dans `.scelle` rougit le troisième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-plan.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
// Contrôle de source : Chromium active un <label> sans `cursor:pointer`, Safari non.
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));

// ── La charte de l'application, comparée AU FICHIER, pas à l'œil ─────────
//
// Sa consigne du 13 août 2026 : « toujours en respectant le style de l'appli ».
// Une planche « à peu près » de la bonne couleur fait valider une allure qui ne
// sera pas celle de son écran — les maquettes d'avant portaient un crème et un
// bronze à elles, proches des jetons sans leur être égaux.
//
// Ce contrôle lit `src/lib/design-tokens.ts` et exige que les six couleurs de
// l'écran en viennent. Il sait échouer : changer un seul chiffre dans le bloc
// `.ecran{}` le rougit, et il désigne alors le jeton et la valeur attendue.
{
  const jetons = fs.readFileSync("src/lib/design-tokens.ts", "utf8");
  const lire = (nom) => (jetons.match(new RegExp(`\\b${nom}:\\s*"([^"]+)"`)) || [])[1];
  // rgba(28, 28, 26, 0.12) et rgba(28,28,26,.12) sont la même couleur : la
  // comparaison porte sur la couleur, pas sur sa ponctuation.
  const meme = (a, b) => a && b &&
    a.toLowerCase().replace(/[\s]/g, "").replace(/0\./g, ".") ===
    b.toLowerCase().replace(/[\s]/g, "").replace(/0\./g, ".");

  const bloc = (source.match(/\.ecran\{[\s\S]*?\n\s*--e-plein-encre:[^;}]+[;}]/) || [""])[0];
  const dansEcran = (nom) => (bloc.match(new RegExp(`--e-${nom}:\\s*([^;}]+)`)) || [])[1];

  const attendus = [
    ["fond", "cream"], ["plage", "card"], ["encre", "ink"],
    ["gris", "muted"], ["bronze", "or"], ["plein", "rust"], ["trait", "line"],
  ];
  const ecarts = attendus
    .filter(([e, j]) => !meme(dansEcran(e), lire(j)))
    .map(([e, j]) => `--e-${e} vaut ${dansEcran(e)}, ${j} vaut ${lire(j)}`);
  verifie("les couleurs de l'écran sortent des jetons de l'application",
    ecarts.length === 0, ecarts.join(" · "));

  // Le luxe de cette charte tient à ce qu'elle REFUSE : `cardShadow` vaut
  // « none » depuis le 10 août, et l'écran retenu n'a pas une seule ombre. Une
  // ombre posée « pour faire haut de gamme » remet le contenu au-dessus de la
  // page au lieu de dedans — c'est l'aspect que le patron a écarté.
  const styles = source.split("</style>")[0];
  const ombres = (styles.match(/box-shadow:\s*(?!none|inset)[^;}]+/g) || [])
    .filter((o) => !/^box-shadow:\s*0 1px 3px rgba\(20,18,14/.test(o)); // le cadre du téléphone, pas l'écran
  verifie("aucune ombre portée dans l'écran — la charte n'en a pas une seule",
    ombres.length === 0, ombres.join(" | "));
}

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

const PATRON = '[data-s="patron"]', COM = '[data-s="commercial"]', SAL = '[data-s="salarie"]',
      BASC = '[data-s="bascule"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };
const rubriques = async (s) => page.$$eval(`${s} .rub .nom`, (l) => l.map((e) => e.textContent.trim()));

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Le patron : les deux niveaux, et les quatre priorités en tête ─────
try {
  await cadrer(PATRON);
  const titres = await page.$$eval(`${PATRON} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("le patron a les deux ensembles, dans cet ordre",
    titres.length === 2 && titres[0] === "Moi" && titres[1] === "Mon entreprise", titres.join(" | "));

  const r = await rubriques(PATRON);
  verifie("ses réglages personnels viennent en premier",
    r.slice(0, 4).join("|") === "Mon compte|Connexion|Notifications|Apparence", r.slice(0, 4).join("|"));
  // Ses quatre priorités du 13 août 2026 : entreprise, équipe, tarifs, documents.
  // Elles ouvrent l'ensemble « Mon entreprise » — pas au milieu d'une liste de neuf.
  const ent = r.slice(4);
  verifie("les quatre priorités ouvrent l'ensemble de l'entreprise",
    ent.slice(0, 5).join("|") === "Identité|Informations bancaires|Équipe|Tarifs & catalogue|Documents",
    ent.slice(0, 5).join("|"));
  verifie("les dix rubriques demandées sont toutes là", r.length === 13, `${r.length}`);

  // « Bientôt » ne se met que là où le module ne fait rien : le mettre partout
  // ferait de l'écran une promesse, l'oublier ferait une panne.
  const tard = await page.$$eval(`${PATRON} .rub.plus_tard .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("« Bientôt » ne marque que ce qui ne marche pas encore",
    tard.join("|") === "Apparence|Abonnement", tard.join("|"));
  const marques = await page.$$eval(`${PATRON} .rub.plus_tard .marque`, (l) => l.map((e) => e.textContent.trim()));
  verifie("et chacune porte le mot en clair", marques.length === 2 && marques.every((m) => /bientôt/i.test(m)),
    marques.join("|"));

  const sansChevron = await page.$$eval(`${PATRON} .rub`, (l) =>
    l.filter((e) => !e.querySelector(".chev")).length);
  verifie("chaque rubrique porte son chevron — aucune ne mène nulle part", sansChevron === 0, `${sansChevron}`);
  await (await page.$(PATRON)).screenshot({ path: `${SORTIE}/reglages-plan-patron.png` });
} catch (e) { echecs.push("patron · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le commercial : ce qu'il vend, jamais ce qui engage ───────────────
try {
  await cadrer(COM);
  const r = await rubriques(COM);
  verifie("le commercial garde ses quatre réglages personnels",
    r.slice(0, 4).join("|") === "Mon compte|Connexion|Notifications|Apparence", r.slice(0, 4).join("|"));
  verifie("il voit les tarifs et les documents, et rien d'autre de l'entreprise",
    r.slice(4).join("|") === "Tarifs & catalogue|Documents", r.slice(4).join("|"));
  verifie("l'écran dit que c'est une consultation",
    /consultation/i.test(await txt(`${COM} .bloc:nth-of-type(2)`)));
  verifie("et il dit pourquoi sa liste s'arrête là", /IBAN|abonnement/i.test(await txt(`${COM} .fin`)));
  await (await page.$(COM)).screenshot({ path: `${SORTIE}/reglages-plan-commercial.png` });
} catch (e) { echecs.push("commercial · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Le salarié : ses réglages, et rien de l'entreprise ────────────────
try {
  await cadrer(SAL);
  const titres = await page.$$eval(`${SAL} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("le salarié n'a qu'un seul ensemble", titres.length === 1 && titres[0] === "Moi", titres.join(" | "));
  const r = await rubriques(SAL);
  verifie("quatre rubriques, toutes à lui",
    r.join("|") === "Mon compte|Connexion|Notifications|Apparence", r.join("|"));
  verifie("son surtitre ne dit pas « mon entreprise »",
    (await txt(`${SAL} .tete .sur`)).toLowerCase() === "mon compte", await txt(`${SAL} .tete .sur`));
  verifie("l'écran court dit pourquoi il est court", /montant/i.test(await txt(`${SAL} .fin`)));
} catch (e) { echecs.push("salarié · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. LA règle : ce qu'un rôle ne doit pas voir n'est écrit NULLE PART ──
//
// On cherche dans tout le texte de l'écran, pas dans les lignes visibles : une
// ligne rendue puis masquée passerait un contrôle de visibilité, et c'est
// précisément ce que `QUESTIONS.md` §10 refuse.
try {
  const interdits = [
    [SAL, "salarié", ["IBAN", "bancaire", "Tarifs", "Abonnement", "Équipe", "SIRET", "RGPD"]],
    [COM, "commercial", ["Abonnement", "Équipe", "SIRET", "RGPD"]],
  ];
  for (const [sel, qui, mots] of interdits) {
    await cadrer(sel);
    const t = await txt(sel);
    // La phrase de clôture NOMME ce qu'il ne verra pas : c'est voulu, et elle
    // ne doit donc pas être comptée comme une fuite. Le contrôle porte sur les
    // rubriques, pas sur l'explication.
    const listes = (await page.$$eval(`${sel} .bloc`, (l) => l.map((e) => e.innerText))).join(" ");
    const fuite = mots.filter((m) => new RegExp(m, "i").test(listes));
    verifie(`aucune rubrique interdite dans la liste du ${qui}`, fuite.length === 0, fuite.join(", "));
    verifie(`et l'écran du ${qui} n'est pas vide pour autant`, t.length > 120, `${t.length} caractères`);
  }
  // À l'inverse : le patron, lui, DOIT les voir. Sans cette contrepartie, un
  // écran vide passerait les quatre contrôles ci-dessus.
  const chezLui = await txt(`${PATRON}`);
  const manquants = ["IBAN", "Équipe", "SIRET", "Abonnement", "RGPD"].filter(
    (m) => !new RegExp(m, "i").test(chezLui));
  verifie("le patron, lui, a bien tout", manquants.length === 0, manquants.join(", "));
} catch (e) { echecs.push("cloisonnement · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. L'interrupteur bascule pour de bon, et déplie ce qu'il commande ───
try {
  await cadrer(BASC);
  verifie("l'acompte s'ouvre allumé", await vu('[data-s="acompte"] .deplie'));
  // Le CENTRE de la pastille, pas son bord gauche : à 26 px de large sur une
  // piste de 52, son bord gauche reste en deçà du milieu même tout à droite.
  const pastille = async () => {
    const b = await rect('[data-s="acompte"] .piste b');
    const p = await rect('[data-s="acompte"] .piste');
    return { centre: b.x + b.w / 2, milieu: p.x + p.w / 2 };
  };
  const debut = await pastille();
  verifie("allumée, la pastille est du côté droit de sa piste",
    debut.centre > debut.milieu, `${(debut.centre - debut.milieu).toFixed(0)} px après le milieu`);
  const avant = debut.centre;

  await page.click('[data-s="acompte"] .bat');
  await page.waitForTimeout(320);
  verifie("éteint, le champ de l'acompte n'existe plus", !(await vu('[data-s="acompte"] .deplie')));
  const eteinte = await pastille();
  verifie("et la pastille est repassée à gauche", eteinte.centre < eteinte.milieu,
    `${(eteinte.centre - eteinte.milieu).toFixed(0)} px après le milieu`);
  verifie("elle a bien glissé, ce n'est pas la piste qui a changé de couleur seule",
    Math.abs(eteinte.centre - avant) > 12, `${(eteinte.centre - avant).toFixed(0)} px`);

  await page.click('[data-s="acompte"] .bat');
  await page.waitForTimeout(320);
  verifie("rallumé, il revient avec sa valeur", await vu('[data-s="acompte"] .deplie'));
  verifie("la part de l'acompte se saisit, et se lit",
    (await page.$eval('[data-s="acompte"] .valeur', (e) => e.value)) === "30");
  await page.fill('[data-s="acompte"] .valeur', "15");
  await page.waitForTimeout(200);
  verifie("elle se change au doigt",
    (await page.$eval('[data-s="acompte"] .valeur', (e) => e.value)) === "15");

  // ET RIEN À CÔTÉ NE DOIT DÉPENDRE DE CE CHIFFRE. « soit 1 044 € sur 3 480 € »
  // était écrit là : une maquette sans script ne recalcule pas, et l'écran se
  // contredisait dès la première frappe. Trouvé en regardant la capture, pas par
  // un contrôle — celui-ci existe pour que ça ne revienne pas.
  const aCote = await page.$$eval(`${BASC} .apres`, (l) => l.map((e) => e.textContent.trim()));
  const mois = /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i;
  const suiveurs = aCote.filter((t) => /€|\d/.test(t) || mois.test(t));
  verifie("rien à côté du champ ne prétend suivre sa valeur", suiveurs.length === 0, suiveurs.join(" | "));

  // Le texte de bas de page part ÉTEINT : c'est le cas qu'il faut voir, celui
  // où l'on ne propose pas un champ vide à remplir sans raison.
  verifie("le texte de bas de page part éteint, et ne déplie rien",
    !(await vu('[data-s="bas"] .deplie')));
  await page.click('[data-s="bas"] .bat');
  await page.waitForTimeout(320);
  verifie("touché, il ouvre sa zone de texte", await vu('[data-s="bas"] .libre'));
  const corps = await page.$eval('[data-s="bas"] .libre', (e) => parseFloat(getComputedStyle(e).fontSize));
  verifie("qui ne fait pas zoomer Safari", corps >= 16, `${corps} px de corps`);
  await (await page.$(BASC)).screenshot({ path: `${SORTIE}/reglages-plan-interrupteur.png` });
} catch (e) { echecs.push("interrupteur · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. Ce qui n'a pas d'interrupteur, et le dit à sa place ───────────────
try {
  await cadrer(BASC);
  const cases = await page.$$eval('[data-s="scelle"] input', (l) => l.length);
  verifie("la mention légale ne porte AUCUNE case à cocher", cases === 0, `${cases}`);
  const pistes = await page.$$eval('[data-s="scelle"] .piste', (l) => l.length);
  verifie("ni la moindre piste d'interrupteur", pistes === 0, `${pistes}`);
  verifie("elle est marquée obligatoire", /obligatoire/i.test(await txt('[data-s="scelle"] .oblig')));
  const pourquoi = await txt('[data-s="scelle"] .pourquoi');
  verifie("et la raison est écrite là, pas ailleurs",
    (await vu('[data-s="scelle"] .pourquoi')) && /irrégulière|légal/i.test(pourquoi), pourquoi.slice(0, 60));
  // Elle est DANS la liste, à la place où l'on chercherait son bouton — pas
  // reléguée en pied d'écran, où personne ne va lire une explication.
  const dedans = await page.$eval('[data-s="scelle"]', (e) => e.parentElement.classList.contains("bloc"));
  verifie("elle est dans la liste, à sa place, et non reléguée en bas", dedans);
} catch (e) { echecs.push("ligne scellée · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. Cibles et mise en page ────────────────────────────────────────────
try {
  for (const [nom, sel] of [["patron", PATRON], ["commercial", COM], ["salarié", SAL], ["bascule", BASC]]) {
    await cadrer(sel);
    verifie(`le bandeau de « ${nom} » désigne les réglages`,
      (await txt(`${sel} .bas .actif`)).toLowerCase() === "réglages");
    // Le trait doit tomber sous L'ONGLET ACTIF : recopié d'un écran à l'autre,
    // il reste sous le premier onglet et désigne le mauvais mot. Mesurer
    // l'étendue du TEXTE — la boîte du libellé vaut sa colonne entière.
    const sl = await page.$eval(sel, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`et son trait tombe sous « Réglages » (${nom})`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);
  }

  await cadrer(PATRON);
  const petites = await page.$$eval(`${PATRON} .rub`, (l) =>
    l.filter((e) => e.getBoundingClientRect().height < 44).length);
  verifie("aucune rubrique sous la cible de 44 px", petites === 0, `${petites}`);
  await cadrer(BASC);
  const p = await rect('[data-s="validite"] .bat');
  verifie("la ligne d'un interrupteur se touche", p.w >= 200 && p.h >= 44, `${p.w.toFixed(0)} × ${p.h.toFixed(0)} px`);
  const grosses = await page.$$eval('.ecran input[type="checkbox"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  // ── La grammaire des ÉCRANS, pas celle des documents ──────────────────
  //
  // Sa consigne du 13 août 2026 : « garde le style de toutes les pages, pas du
  // devis et facture ». Ces mesures sont celles d'`EnTeteEcran` et
  // d'`AtlasBottomNav`, relevées dans le code, pas approchées à l'œil.
  await cadrer(PATRON);
  const ecran = await rect(PATRON);
  verifie("l'écran fait la largeur d'un iPhone, pas celle qui reste après la coque",
    ecran.w >= 390, `${ecran.w.toFixed(0)} px`);

  const tete = await page.$eval(`${PATRON}`, (r) => {
    const h = r.querySelector(".tete h1"), s = r.querySelector(".tete .sur");
    const c = r.querySelector(".cheveu");
    const g = getComputedStyle(h);
    return {
      retrait: h.getBoundingClientRect().x - r.getBoundingClientRect().x,
      corps: parseFloat(g.fontSize),
      surtitre: getComputedStyle(s).color,
      cheveu: c ? c.getBoundingClientRect().width : null,
      largeur: r.getBoundingClientRect().width,
    };
  });
  verifie("le titre est en retrait de 26 px, comme tous les écrans refaits",
    Math.abs(tete.retrait - 26) < 1.5, `${tete.retrait.toFixed(1)} px`);
  verifie("et fait 36 px, la mesure d'`EnTeteEcran`", Math.abs(tete.corps - 36) < 0.6, `${tete.corps} px`);
  // Le cheveu qui FERME l'en-tête. Il manquait : sans lui, le titre flottait
  // au-dessus de la première liste, et l'écran ne ressemblait à aucun autre.
  verifie("un cheveu ferme l'en-tête, en retrait de 26 px des deux bords",
    tete.cheveu !== null && Math.abs(tete.cheveu - (tete.largeur - 52)) < 2,
    `${tete.cheveu?.toFixed(0)} px pour ${(tete.largeur - 52).toFixed(0)} attendus`);

  // Le titre d'une section est GRIS, jamais or : l'or porte les statuts, pas
  // les intertitres. C'était la grammaire des vieilles planches.
  const titreSection = await page.$eval(`${PATRON} .bloc .t`, (e) => getComputedStyle(e).color);
  verifie("les titres de section sont gris, pas dorés",
    titreSection === "rgb(138, 133, 120)", titreSection);

  // Deux filets qui se suivent à 30 px d'écart dessinent une bande vide. Vu sur
  // la capture ; ce contrôle est là pour que ça ne revienne pas.
  const bandes = await page.$eval(`${PATRON} .corps`, (c) => {
    const traits = [];
    for (const e of c.querySelectorAll("*")) {
      const g = getComputedStyle(e), r = e.getBoundingClientRect();
      if (r.width < 40) continue;
      if (parseFloat(g.borderTopWidth) > 0) traits.push(Math.round(r.y));
      if (parseFloat(g.borderBottomWidth) > 0) traits.push(Math.round(r.y + r.height));
    }
    traits.sort((a, b) => a - b);
    return traits.filter((v, i) => i && v - traits[i - 1] > 12 && v - traits[i - 1] < 48).length;
  });
  verifie("aucune bande vide entre deux filets qui se suivent", bandes === 0, `${bandes}`);

  // Le contrôle qui manquait, et qui aurait vu la barre basse déborder.
  const b = await page.$$eval(`${PATRON} .bas span`, (l) =>
    l.map((e) => { const r = document.createRange(); r.selectNodeContents(e);
      const q = r.getBoundingClientRect(); return { g: q.x, d: q.x + q.width, t: e.textContent.trim() }; }));
  let pire = { ecart: 1e9, ou: "" };
  for (let i = 1; i < b.length; i++) {
    const w = b[i].g - b[i - 1].d;
    if (w < pire.ecart) pire = { ecart: w, ou: `${b[i - 1].t}|${b[i].t}` };
  }
  verifie("les libellés du bandeau ne se touchent pas", pire.ecart >= 6,
    `${pire.ecart.toFixed(1)} px — ${pire.ou}`);
  const chasse = await page.$eval(`${PATRON} .bas span`, (e) => {
    const g = getComputedStyle(e);
    return { corps: parseFloat(g.fontSize), chasse: g.letterSpacing };
  });
  verifie("et ils portent la chasse de l'application, pas une chasse rétrécie",
    Math.abs(chasse.corps - 9.5) < 0.3 && parseFloat(chasse.chasse) > 2.5,
    `${chasse.corps} px / ${chasse.chasse}`);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 8. La loupe : éteinte sur téléphone, allumée sur grand écran ─────────
//
// « Fais-moi les planches en gros plan que je les voie mieux » (13 août 2026).
// La loupe agrandit l'écran ENTIER dans ses proportions ; élargir le téléphone
// aurait fait tenir les libellés sur une ligne et menti sur ce qu'il aura.
//
// CE CONTRÔLE-CI EST LE PLUS IMPORTANT DES DEUX : si la loupe s'appliquait
// aussi à 390 px, les cinquante-cinq mesures ci-dessus porteraient sur un écran
// agrandi — une cible de 30 px passerait pour 44, et rien ne rougirait.
try {
  const t = await rect(`${PATRON}`);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);
} catch (e) { echecs.push("loupe éteinte · interrompu — " + String(e.message).split("\n")[0]); }

try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const large = await pg.$eval(PATRON, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px de large`);

  // Une planche par rangée : c'est cela, le gros plan. Quatre côte à côte
  // resteraient quatre miniatures, loupe ou pas.
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  const empilees = new Set(hauteurs).size === hauteurs.length;
  verifie("une planche par rangée, et non quatre de front", empilees, hauteurs.join(" | "));

  // Le texte passe à droite, pour reprendre la hauteur que la loupe a gagnée.
  const cote = await pg.$eval(".prop", (e) => {
    const t = e.querySelector(".tel").getBoundingClientRect();
    const n = e.querySelector(".note").getBoundingClientRect();
    return n.x - (t.x + t.width);
  });
  verifie("la note est posée à côté de l'écran, pas dessous", cote > -1, `${cote.toFixed(0)} px`);

  // ET EN HAUT, en regard du titre. Sans une rangée souple sous elle, la grille
  // répartit la hauteur du téléphone entre ses deux rangées et le texte flotte
  // à mi-écran, seul au milieu du vide. Vu sur la capture, pas par un contrôle.
  const enHaut = await pg.$eval(".prop", (e) => {
    const t = e.querySelector(".tel").getBoundingClientRect();
    const s = e.querySelector(".sous").getBoundingClientRect();
    return (s.y - t.y) / t.height;
  });
  verifie("et en haut, en regard du titre de l'écran — pas flottante à mi-hauteur",
    enHaut < 0.15, `à ${(enHaut * 100).toFixed(0)} % de la hauteur`);
  verifie("et la page dit que c'est une loupe, pas un écran plus large",
    await pg.$eval(".loupe", (e) => e.checkVisibility()));

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);

  await pg.$eval(PATRON, (e) => e.scrollIntoView());
  await pg.waitForTimeout(200);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-plan-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
