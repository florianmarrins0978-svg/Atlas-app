/*
  Contrôle de « ajouter ou retirer des cases » — JavaScript coupé, iPhone 13,
  meta viewport injectée.

  Sa demande, le 14 août 2026, capture de « Mes prix » à l'appui : *« je dois
  pouvoir ajouter ou retirer des cases. »*

  CE QUE CES CONTRÔLES TIENNENT, et qui n'est pas l'allure :

    · **la conséquence est DITE avant l'ajout.** Une tranche de diamètre sert à
      trois grilles : l'ajouter pose dix cases d'un coup. Un écran qui le tait
      transforme un geste anodin en dix questions surprises — et c'est le seul
      vrai risque de ce lot ;
    · **rien ne part en silence.** Retirer une tranche qui portait des prix
      ouvre le tiroir « Annuler », comme partout ailleurs. Ces prix sont ses
      décisions, et certains viennent de devis réels ;
    · **les trois formes portent les DEUX gestes** — ajouter et retirer. Une
      forme qui n'aurait que l'ajout ne répond qu'à la moitié de sa phrase.

  CHACUN SAIT ÉCHOUER : retirer `.consequence` rougit le premier ; retirer
  `#r1:checked ~ .corps .tiroir.t1{display:flex}` rougit le second ; retirer les
  croix rougit le troisième.

  RÉSERVE : ceci éprouve un DESSIN. Rien n'est posé dans `src/` tant qu'il n'a
  pas choisi (`CLAUDE.md` §3 bis).
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-grilles-cases.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));
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

const P = (n) => `.rangee .prop:nth-of-type(${n})`;
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { const e = await page.$(s); if (e) { await e.scrollIntoViewIfNeeded(); await page.waitForTimeout(240); } };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 0. Le fait qui commande tout est écrit en tête ───────────────────────
try {
  const cle = await txt(".cle");
  verifie("l'entête dit qu'une case ne s'ajoute pas toute seule",
    /dix|10 cases/i.test(cle) && /croisement/i.test(cle),
    `lu : « ${cle.slice(0, 90)}… »`);
  verifie("l'entête pose les trois niveaux", /tranche/i.test(cle) && /travail/i.test(cle));
} catch (e) { echecs.push("entête · interrompu — " + String(e.message).split("\n")[0]); }

// ── 1. Forme 1 : ajouter dans la grille, et la conséquence AVANT ─────────
try {
  await cadrer(P(1));
  verifie("forme 1 : le geste d'ajout est offert", await vu(`${P(1)} [data-s="ajouter"]`));
  verifie("forme 1 : au départ, la saisie est repliée", !(await vu(`${P(1)} [data-s="saisie"]`)));

  await page.click(`${P(1)} [data-s="ajouter"]`);
  await page.waitForTimeout(260);
  verifie("forme 1 : touché, l'ajout ouvre une saisie", await vu(`${P(1)} [data-s="saisie"]`));

  // **LE contrôle du lot.** Dix cases posées sans prévenir, ce sont dix
  // questions surprises au chantier suivant.
  const dit = await txt(`${P(1)} [data-s="consequence"]`);
  verifie("forme 1 : la conséquence est dite AVANT de valider",
    /10 cases/i.test(dit), `lu : « ${dit.replace(/\n/g, " ")} »`);
  verifie("forme 1 : elle nomme les grilles touchées",
    /fendre/i.test(dit) && /dessoucher/i.test(dit));

  await (await page.$(P(1))).screenshot({ path: `${SORTIE}/cases-forme-1.png` });
} catch (e) { echecs.push("forme 1 · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Retirer : rien ne part en silence ─────────────────────────────────
try {
  verifie("au départ, aucun tiroir d'annulation n'est ouvert", !(await vu(`${P(1)} [data-s="tiroir"]`)));
  await page.click(`${P(1)} .ligne.partante .oter`);
  await page.waitForTimeout(260);
  verifie("retirer une tranche ouvre le tiroir « Annuler »", await vu(`${P(1)} [data-s="tiroir"]`));
  const t = await txt(`${P(1)} [data-s="tiroir"]`);
  verifie("le tiroir DIT combien de prix partent avec elle", /\d+\s*prix/i.test(t), `lu : « ${t.replace(/\n/g, " ")} »`);
  verifie("le tiroir offre de défaire", /annuler/i.test(t));
  verifie("la ligne retirée a bien disparu de la liste", !(await vu(`${P(1)} .ligne.partante`)));
  await (await page.$(P(1))).screenshot({ path: `${SORTIE}/cases-retrait.png` });
} catch (e) { echecs.push("retrait · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Les trois formes portent les DEUX gestes ──────────────────────────
try {
  for (const [n, nom] of [[1, "dans la grille"], [2, "mes mesures"], [3, "un travail entier"]]) {
    await cadrer(P(n));
    const ecran = await txt(P(n));
    verifie(`forme ${n} (${nom}) : on peut ajouter`, /ajouter/i.test(ecran));
    const croix = await page.$$(`${P(n)} .oter`);
    verifie(`forme ${n} (${nom}) : on peut retirer`, croix.length > 0,
      "une forme sans retrait ne répond qu'à la moitié de sa demande");
  }
  await cadrer(P(2));
  const mesures = await txt(P(2));
  verifie("forme 2 : chaque tranche dit combien de prix elle porte", /\d+\s*prix/i.test(mesures));
  verifie("forme 2 : les trois axes y sont",
    /Diamètres/.test(mesures) && /Hauteurs/.test(mesures) && /Façons/.test(mesures));
  await (await page.$(P(2))).screenshot({ path: `${SORTIE}/cases-forme-2.png` });

  await cadrer(P(3));
  await page.click(`${P(3)} .ajouter.j3`);
  await page.waitForTimeout(260);
  const travail = await txt(`${P(3)} .saisie`);
  verifie("forme 3 : les trois formes de grille sont proposées",
    /Un seul prix/.test(travail) && /Par diamètre/.test(travail) && /Par façon/.test(travail));
  verifie("forme 3 : chacune dit combien de cases elle fabrique",
    /8 cases/.test(travail) && /24 cases/.test(travail), `lu : « ${travail.replace(/\n/g, " ")} »`);
  await (await page.$(P(3))).screenshot({ path: `${SORTIE}/cases-forme-3.png` });
} catch (e) { echecs.push("les trois formes · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le doigt, et la largeur ───────────────────────────────────────────
try {
  const petits = await page.$$eval(".ajouter, .oter, .valider, .defaire, .forme", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.trim().slice(0, 24) }))
     .filter((m) => m.h < 36));
  verifie("aucune cible trop petite pour le doigt", petits.length === 0,
    petits.map((m) => `« ${m.t} » ${m.h.toFixed(0)} px`).join(" | "));

  const corps = await page.$$eval("input[type=text]", (l) =>
    l.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  verifie("les champs font 16 px — sinon iOS agrandit la page",
    corps.length > 0 && corps.every((c) => c >= 16), corps.join(" / "));

  for (const n of [1, 2, 3]) {
    const debord = await page.$eval(`${P(n)} .ecran`, (e) => e.scrollWidth - e.clientWidth);
    verifie(`rien ne déborde en largeur (forme ${n})`, debord <= 1, `${debord} px`);
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
