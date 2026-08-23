/*
  Contrôle du sommaire des réglages — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  CE QU'IL SURVEILLE, ET POURQUOI CHACUN EXISTE :

    · LES DEUX REGISTRES LISTENT LA MÊME CHOSE. Ils sont côte à côte pour être
      comparés ; s'ils divergeaient d'une rubrique, la comparaison porterait sur
      autre chose que le registre, et le patron choisirait une allure en croyant
      choisir l'autre. C'est le contrôle le plus important de ce fichier.
    · CHAQUE RUBRIQUE PORTE UNE ICÔNE, ET ELLES SONT TOUTES DIFFÉRENTES. Dix
      pictogrammes recopiés passeraient tous les autres contrôles — la liste
      serait complète, alignée, dorée, et parfaitement illisible.
    · CE QU'UN SALARIÉ N'A PAS LE DROIT DE VOIR N'EST PAS DANS SON ÉCRAN. Le
      contrôle cherche le MOT dans tout l'`innerText`, pas la visibilité d'une
      ligne : `docs/QUESTIONS.md` §10 a tranché que masquer ne suffit pas.
    · L'ÉCRAN RESTE CLAIR MÊME QUAND LE LECTEUR EST EN SOMBRE. La planche suit
      le thème, l'application non — elle n'a pas encore de mode sombre, et en
      montrer un serait faire valider un écran qui n'existe pas.

  Chacun sait échouer : retirer une ligne d'un registre rougit le premier,
  recopier une icône rougit le deuxième, écrire « Tarifs » dans l'écran du
  salarié rougit le troisième, ôter les jetons de `.ecran{}` rougit le
  quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-sommaire.html";
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

const FILETS = '[data-s="filets"]', CARTES = '[data-s="cartes"]', SAL = '[data-s="salarie"]';
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };
const lignes = (s) => `${s} .rub, ${s} .crt`;
const noms = async (s) => page.$$eval(`${lignes(s)}`, (l) =>
  l.map((e) => e.querySelector(".nom").textContent.trim()));

fs.mkdirSync(SORTIE, { recursive: true });

// Les dix rubriques de SA planche, dans SON ordre, plus les trois personnelles
// qu'elle n'avait pas — et qui sont ce qu'un salarié garde.
const SIENNES = ["Mon entreprise", "Équipe", "Tarifs & catalogue", "Devis & factures",
  "Planning", "Atlas IA", "Notifications", "Intégrations", "Abonnement", "Sécurité & données"];

// ── 1. Les deux registres, et leur identité ──────────────────────────────
try {
  await cadrer(FILETS);
  const a = await noms(FILETS), b = await noms(CARTES);

  verifie("les deux registres listent exactement les mêmes rubriques, dans le même ordre",
    a.length > 0 && a.join("|") === b.join("|"),
    `${a.length} contre ${b.length}`);

  const manquantes = SIENNES.filter((n) => !a.includes(n));
  verifie("les dix rubriques de sa planche sont toutes là",
    manquantes.length === 0, manquantes.join(" · "));

  // Son ordre à lui, sur les rubriques de l'entreprise : entreprise, équipe,
  // tarifs, devis, planning — ce sont ses quatre priorités du 13 août, plus le
  // planning qu'il a ajouté, et ils ouvrent l'ensemble.
  const entreprise = a.slice(a.indexOf("Mon entreprise"));
  verifie("ses priorités ouvrent l'ensemble de l'entreprise, dans son ordre",
    entreprise.slice(0, 5).join("|") === "Mon entreprise|Équipe|Tarifs & catalogue|Devis & factures|Planning",
    entreprise.slice(0, 5).join("|"));

  // LA COQUILLE DE SA PLANCHE — « confidentbilité » — NE DOIT PAS ÊTRE
  // RECOPIÉE. Le contrôle porte sur le TEXTE AFFICHÉ, jamais sur le fichier :
  // la faute est citée dans le commentaire d'en-tête pour dire qu'on l'a vue,
  // et une recherche sur la source rougissait donc sur sa propre explication.
  const affiche = await page.$$eval(".ecran", (l) => l.map((e) => e.innerText).join(" "));
  verifie("aucune coquille reprise de la planche d'origine",
    !/confidentbilit/i.test(affiche));

  const titres = await page.$$eval(`${FILETS} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les deux ensembles séparent ce qui est à lui de ce qui est à l'entreprise",
    titres.join("|") === "Moi|L'entreprise", titres.join("|"));
} catch (e) { echecs.push("registres · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. L'icône : présente, dorée, et différente à chaque ligne ───────────
for (const [nom, sel] of [["en filets", FILETS], ["en cartes", CARTES], ["du salarié", SAL]]) {
  try {
    const ico = await page.$$eval(lignes(sel), (l) =>
      l.map((e) => {
        const s = e.querySelector(".ico svg");
        const g = s ? getComputedStyle(s) : null;
        return {
          nom: e.querySelector(".nom").textContent.trim(),
          dessin: s ? s.innerHTML.replace(/\s+/g, " ").trim() : "",
          teinte: g ? g.stroke : "",
          chev: !!e.querySelector(".chev"),
          dit: (e.querySelector(".dit")?.textContent || "").trim(),
        };
      }));

    verifie(`chaque rubrique ${nom} porte une icône`,
      ico.every((i) => i.dessin.length > 0),
      ico.filter((i) => !i.dessin).map((i) => i.nom).join(" · "));

    // DIX PICTOGRAMMES RECOPIÉS passeraient tous les autres contrôles : la
    // liste serait complète, alignée, dorée — et illisible.
    const distincts = new Set(ico.map((i) => i.dessin));
    verifie(`et aucune icône ${nom} n'est le doublon d'une autre`,
      distincts.size === ico.length, `${distincts.size} dessins pour ${ico.length} lignes`);

    // L'or porte ce qu'on LIT. Le vert pin aurait fait dix boutons alignés,
    // et c'est l'aspect « tableau de bord » que le patron refuse.
    verifie(`les icônes ${nom} sont en or, pas en vert pin`,
      ico.every((i) => i.teinte === "rgb(185, 139, 71)"),
      [...new Set(ico.map((i) => i.teinte))].join(" · "));

    verifie(`chaque rubrique ${nom} porte un chevron — elle mène quelque part`,
      ico.every((i) => i.chev), ico.filter((i) => !i.chev).map((i) => i.nom).join(" · "));

    verifie(`et une ligne qui dit ce qu'on y trouve`,
      ico.every((i) => i.dit.length > 4), ico.filter((i) => i.dit.length <= 4).map((i) => i.nom).join(" · "));
  } catch (e) { echecs.push(`icônes ${nom} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── 3. La cible du pouce, dans les deux registres ────────────────────────
for (const [nom, sel] of [["en filets", FILETS], ["en cartes", CARTES]]) {
  try {
    const petites = await page.$$eval(lignes(sel), (l) =>
      l.map((e) => ({ n: e.querySelector(".nom").textContent.trim(), h: e.getBoundingClientRect().height }))
        .filter((x) => x.h < 44));
    verifie(`aucune rubrique ${nom} sous la cible de 44 px`,
      petites.length === 0, petites.map((p) => `${p.n} à ${p.h.toFixed(0)} px`).join(" · "));
  } catch (e) { echecs.push(`cibles ${nom} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// Les cartes ne sont pas des tuiles ombrées : `cardShadow` vaut « none » et le
// rayon vaut 4 px depuis le 10 août. `controlerCharte` refuse déjà l'ombre dans
// la feuille ; celui-ci mesure le rayon là où il s'applique.
try {
  const r = await page.$eval(`${CARTES} .crt`, (e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
  verifie("les cartes gardent le rayon de la charte, 4 px", Math.abs(r - 4) < 0.6, `${r} px`);
} catch (e) { echecs.push("rayon des cartes · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. « Bientôt » ne se pose que sur ce qui n'existe pas ────────────────
try {
  const marquees = await page.$$eval(`${FILETS} .rub`, (l) =>
    l.filter((e) => e.querySelector(".marque")).map((e) => e.querySelector(".nom").textContent.trim()));
  verifie("« Bientôt » ne marque que l'apparence et l'abonnement",
    marquees.join("|") === "Apparence|Abonnement", marquees.join("|"));
} catch (e) { echecs.push("bientôt · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le salarié : l'absence, et non le grisé ───────────────────────────
try {
  await cadrer(SAL);
  const ecran = await page.$eval(SAL, (e) => e.innerText);
  const interdits = ["Tarifs", "catalogue", "IBAN", "Équipe", "Abonnement", "Intégrations",
    "Devis", "factures", "RGPD", "Atlas IA", "Identité"];
  const fuites = interdits.filter((m) => ecran.includes(m));
  verifie("aucune rubrique de l'entreprise n'apparaît chez le salarié",
    fuites.length === 0, fuites.join(" · "));

  const s = await noms(SAL);
  verifie("il garde ses quatre réglages personnels",
    s.join("|") === "Mon compte|Notifications|Connexion|Apparence", s.join("|"));

  const sur = await page.$eval(`${SAL} .tete .sur`, (e) => e.textContent.trim());
  verifie("et son surtitre dit « Mon compte », pas « Mon entreprise »",
    sur === "Mon compte", sur);

  verifie("son écran court dit pourquoi il est court",
    await page.$eval(`${SAL} .fin`, (e) => e.textContent.trim().length > 60));
} catch (e) { echecs.push("salarié · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La charte, mesurée dans le navigateur ─────────────────────────────
try {
  await cadrer(FILETS);
  await controlerGrammaire(page, FILETS, verifie);
  await controlerGrammaire(page, CARTES, verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. La loupe est éteinte là où l'on mesure ────────────────────────────
// SANS CE CONTRÔLE, TOUTES LES MESURES CI-DESSUS SERAIENT FAUSSES : agrandies
// de 1,35, une cible de 33 px passerait pour 44 sans que rien ne rougisse.
try {
  const w = await page.$eval(FILETS, (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px de large`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe éteinte · interrompu — " + String(e.message).split("\n")[0]); }

// ── 8. L'écran reste clair quand le lecteur est en sombre ────────────────
// La planche suit le thème du lecteur ; l'application, non. Montrer un écran
// sombre ferait valider une allure qui n'existe pas encore.
try {
  const nuit = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "dark" });
  const pn = await nuit.newPage();
  await pn.goto("file://" + path.resolve(ESSAI));
  await pn.waitForTimeout(200);
  const fond = await pn.$eval(FILETS, (e) => getComputedStyle(e).backgroundColor);
  verifie("l'écran reste crème même lu de nuit — l'application n'a pas de mode sombre",
    fond === "rgb(245, 243, 238)", fond);
  const page_ = await pn.$eval("body", (e) => getComputedStyle(e).backgroundColor);
  verifie("mais la planche, elle, suit le thème du lecteur",
    page_ !== "rgb(245, 243, 238)", page_);
  await nuit.close();
} catch (e) { echecs.push("lecture de nuit · interrompu — " + String(e.message).split("\n")[0]); }

// ── 9. Le gros plan, et les captures ─────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const large = await pg.$eval(FILETS, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non trois de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);

  for (const [nom, sel] of [["filets", FILETS], ["cartes", CARTES], ["salarie", SAL]]) {
    const bloc = await pg.$(`${sel}`);
    await bloc.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await bloc.screenshot({ path: `${SORTIE}/reglages-sommaire-${nom}.png` });
  }
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
