/*
  Contrôle de la planche « Adresse non renseignée ouvre l'écran du chantier » —
  JavaScript coupé, iPhone 13, meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LA PLANCHE N'INVENTE AUCUN ÉCRAN. C'est toute sa correction du 17 août :
      *« rien de plus, rien de moins »*. La destination est
      `FormulaireNouveauChantier`, qui existe — le contrôle vérifie que ses SEPT
      éléments y sont, dans l'ordre, avec leurs « (facultatif) ». Une planche qui
      en oublierait un, ou qui en ajouterait, ferait valider un écran qui n'est
      pas le sien ; et c'est exactement l'erreur que la version précédente a
      commise, en dessinant une « fiche client » de toutes pièces.
    · LA MENTION EST LA CIBLE, ET ELLE SEULE. Sa phrase : « lorsque s'affiche
      Adresse non renseignée, je puisse cliquer DESSUS ». Toucher le nom du
      chantier ne doit donc RIEN faire — sans quoi la ligne changerait de
      destination, ce que sa règle du 13 août évite.
    · LE GESTE BOUGE POUR DE BON. Une planche qu'on annonce touchable et qui ne
      bouge pas se valide sur une capture, et le défaut ne paraît qu'entre ses
      mains. L'ouverture et le retour sont JOUÉS, et leur effet mesuré.
    · LES DEUX MOTS QUE LA REPRISE OBLIGE À CHANGER SONT DITS. « Nouveau » et
      « Créer le chantier » deviendraient faux sur un chantier qui existe. Les
      laisser passer en silence ferait livrer un écran qui ment.
    · LA CIBLE SE TOUCHE. Sous un pouce ganté, un texte de 11,5 px n'est pas une
      cible : la mention doit tenir ses 34 px de haut.

  CHACUN SAIT ÉCHOUER, et c'est vérifiable à la main : retirer un champ du
  formulaire rougit le premier ; rendre le nom du chantier cliquable rougit le
  deuxième ; couper le lien de la mention rougit le troisième ; remettre
  « Nouveau » et « Créer le chantier » rougit le quatrième ; rapetisser la
  mention rougit le dernier.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-fiche-client.html";
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

const texte = async (s) => page.$eval(s, (e) => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "");

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. L'accueil montre SA ligne, et son cas exact ──────────────────────
try {
  // « Chantier du lundi 17 août » est le titre qu'Atlas fabrique quand il n'y a
  // NI client NI adresse (`nom-chantier.ts`) — c'est le cas de sa capture, et le
  // seul qui vaille : dessiner un client existant esquiverait le vrai travail.
  const acc = await texte('[data-s="accueil"]');
  verifie("la ligne dessinée est celle de sa capture, sans client du tout",
    /Chantier du lundi 17 août/.test(acc), acc.slice(0, 120));
  verifie("et elle porte la mention qu'il a lue", /Adresse non renseignée/.test(acc));

  // **Sous un pouce ganté, un texte de 11,5 px n'est pas une cible.**
  const m = await page.$eval('[data-s="mention"]', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, l: r.width };
  }).catch(() => null);
  verifie("la mention tient ses 34 px de haut",
    m !== null && m.h >= 34, m ? `${m.l.toFixed(0)}×${m.h.toFixed(0)}` : "absente");
} catch (e) { echecs.push("accueil · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. LE GESTE : la mention ouvre, et elle SEULE ───────────────────────
//
// **« Rien de plus, rien de moins », le 17 août.** Si le nom du chantier
// ouvrait lui aussi, la ligne changerait de destination — ce que sa règle du
// 13 août évite, et ce qu'il n'a pas demandé.
try {
  const bord = await page.$eval('[data-s="prop"] .ecran', (e) => Math.round(e.getBoundingClientRect().left));
  const ou = async () =>
    page.$eval('[data-s="form"]', (e) => Math.round(e.getBoundingClientRect().left));

  verifie("au repos, l'écran du chantier est hors du cadre", (await ou()) > bord + 100,
    `${await ou()} contre ${bord}`);

  await page.click('[data-s="accueil"] .brin h2');
  await page.waitForTimeout(500);
  verifie("toucher le NOM du chantier ne fait rien — la mention seule est la cible",
    (await ou()) > bord + 100, `${await ou()}`);

  await page.click('[data-s="mention"]');
  await page.waitForTimeout(650);
  verifie("toucher la mention ouvre l'écran du chantier",
    Math.abs((await ou()) - bord) < 6, `${await ou()} contre ${bord}`);

  // Un aller sans retour enferme : le chevron doit ramener.
  await page.click('[data-s="form"] .retour');
  await page.waitForTimeout(650);
  verifie("et le chevron ramène à la liste", (await ou()) > bord + 100, `${await ou()}`);
} catch (e) { echecs.push("geste · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. L'ÉCRAN D'ARRIVÉE EST LE SIEN, PAS UN ÉCRAN INVENTÉ ──────────────
//
// **LE CONTRÔLE QUI PORTE LA PLANCHE.** La version précédente a dessiné une
// « fiche client » de toutes pièces, et il a dû corriger. Ce contrôle refuse
// qu'on recommence : les sept éléments de `FormulaireNouveauChantier` sont
// exigés, avec leurs mots.
try {
  await page.click('[data-s="mention"]');
  await page.waitForTimeout(650);
  const f = await texte('[data-s="form"]');

  const attendus = [
    "Nom du client (facultatif)",
    "Téléphone (facultatif)",
    "E-mail (facultatif)",
    "Comment lui envoyer son devis ?",
    "Adresse du chantier (facultatif)",
    "Ajouter une adresse client différente",
    "Je dicte",
  ];
  const manquants = attendus.filter((a) => !f.toUpperCase().includes(a.toUpperCase()));
  verifie("l'écran d'arrivée est celui qui EXISTE, avec ses sept éléments",
    manquants.length === 0, manquants.join(" / "));

  // Le micro qu'il montre sur sa photo, et qui porte « par la dictée ».
  const micro = await page.$eval('[data-s="form"] .micro', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, l: r.width };
  }).catch(() => null);
  verifie("le micro est là, et se touche",
    micro !== null && micro.h >= 40 && micro.l >= 40,
    micro ? `${micro.l.toFixed(0)}×${micro.h.toFixed(0)}` : "absent");

  // **AUCUN CHAMP INVENTÉ.** Sept zones de saisie et pas une de plus : en
  // ajouter une ferait valider un écran que le code ne porte pas.
  const zones = await page.$$eval('[data-s="form"] .ch', (l) =>
    l.map((e) => (e.querySelector(".et")?.textContent ?? "").trim()));
  verifie("et pas un champ de plus que les siens", zones.length === 5, zones.join(" | "));
} catch (e) { echecs.push("écran d'arrivée · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. LES DEUX MOTS QUE LA REPRISE OBLIGE À CHANGER ────────────────────
//
// « Nouveau » et « Créer le chantier » deviendraient faux sur un chantier qui
// existe. Les laisser passer ferait livrer un écran qui ment au patron.
try {
  const surtitre = await texte('[data-s="surtitre"]');
  const bouton = await texte('[data-s="bouton"]');
  verifie("le surtitre ne dit plus « Nouveau » — le chantier existe",
    !/^NOUVEAU$/i.test(surtitre) && surtitre.length > 3, surtitre);
  verifie("et le bouton ne dit plus « Créer » — il ne créerait rien",
    !/cr[ée]er/i.test(bouton) && bouton.length > 3, bouton);

  // Et la planche doit DIRE lesquels : un changement silencieux se découvre au
  // moment de coder, quand il est trop tard pour en discuter.
  const note = await texte(".note");
  verifie("la note désigne les deux mots changés, elle ne les glisse pas",
    /Nouveau/.test(note) && /Créer le chantier/.test(note), note.slice(0, 140));
} catch (e) { echecs.push("mots changés · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La loupe : les mesures ci-dessus sont celles de SON écran ────────
try {
  const w = await page.$eval('[data-s="prop"] .ecran', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. Le gros plan, et les captures ────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1400 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const large = await pg.$eval('[data-s="prop"] .ecran', (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  const tel = await pg.$('[data-s="prop"] .tel');
  await tel.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(200);
  await tel.screenshot({ path: `${SORTIE}/fiche-client-1-accueil.png` });

  // **ET UNE CAPTURE L'ÉCRAN OUVERT.** Sans elle, la planche envoyée ne montre
  // qu'une liste : le geste qu'il a demandé n'y est pas visible, et il devrait
  // ouvrir la page pour le voir.
  await pg.click('[data-s="mention"]');
  await pg.waitForTimeout(700);
  const bordG = await pg.$eval('[data-s="prop"] .ecran', (e) => Math.round(e.getBoundingClientRect().left));
  const arrive = await pg.$eval('[data-s="form"]', (e) => Math.round(e.getBoundingClientRect().left));
  verifie("la capture montre l'écran ARRIVÉ, pas en route",
    Math.abs(arrive - bordG) < 8, `${arrive} contre ${bordG}`);
  await tel.screenshot({ path: `${SORTIE}/fiche-client-2-ecran-chantier.png` });

  // **ET LE BAS DE L'ÉCRAN.** Le bouton est l'un des deux mots que la reprise
  // oblige à changer, et il tombe sous le pli — comme sur sa propre capture.
  // Une planche envoyée sans cette image lui cacherait la moitié de ce qu'elle
  // lui demande de valider.
  await pg.$eval('[data-s="form"] .corps', (e) => e.scrollTo({ top: e.scrollHeight }));
  await pg.waitForTimeout(400);
  const vuBouton = await pg.$eval('[data-s="bouton"]', (e) => {
    const r = e.getBoundingClientRect();
    const c = e.closest(".ecran").getBoundingClientRect();
    return r.top >= c.top && r.bottom <= c.bottom && r.height > 10;
  }).catch(() => false);
  verifie("le bouton se rejoint en défilant, et tient dans le cadre", vuBouton);
  await tel.screenshot({ path: `${SORTIE}/fiche-client-3-le-bouton.png` });

  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
