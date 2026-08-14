/*
  Contrôle du choix de l'unité — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Sa demande, le 13 août 2026 : *« crée-moi un bandeau déroulant avec infos à
  choisir, jours/hommes, m² etc. »*

  CE QUE CES CONTRÔLES TIENNENT, et qui n'est pas l'allure :

    · **la case reste LIBRE dans les deux formes.** Un élagueur a des unités
      qu'aucune liste ne devinera — le stère, la tonne, l'arbre. Une liste
      fermée lui retirerait ce qu'il a aujourd'hui : ce serait un recul déguisé
      en confort, et c'est le seul vrai risque de ce lot ;
    · **le bandeau est REPLIÉ au départ**, et se déplie sous la case sans
      quitter l'écran — mesuré par les positions, pas par la présence du texte ;
    · **le choix se voit** : la case affiche l'unité retenue, et la ligne
      choisie porte sa marque.

  CHACUN SAIT ÉCHOUER : retirer `#ouvert:checked ~ .bandeau{display:block}`
  rougit le dépliage ; retirer la ligne « Une autre unité ? » rougit la case
  libre ; figer la valeur affichée rougit le troisième.

  RÉSERVE : ceci éprouve un DESSIN. Rien n'est posé dans
  `src/app/reglages/ReglagesClient.tsx` tant qu'il n'a pas choisi
  (`CLAUDE.md` §3 bis).
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-unite-deroulante.html";
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

const AVANT = '[data-s="avant"]', P1 = '[data-s="p1"]', P2 = '[data-s="p2"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, bas: r.y + r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. « Aujourd'hui » montre bien ce qu'on corrige ──────────────────────
try {
  await cadrer(AVANT);
  verifie("« Aujourd'hui » montre la case libre et son seul exemple",
    /m², heure…/.test(await txt(`${AVANT} [data-s="ancienne"]`)));
  await (await page.$(AVANT)).screenshot({ path: `${SORTIE}/unite-aujourdhui.png` });
} catch (e) { echecs.push("aujourd'hui · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le bandeau : replié, puis déplié SOUS la case ─────────────────────
try {
  await cadrer(P1);
  verifie("au départ, le bandeau est replié", !(await vu(`${P1} [data-s="bandeau"]`)));
  verifie("et la case invite à choisir", /Choisir/.test(await txt(`${P1} [data-s="case"]`)));

  await page.click(`${P1} [data-s="case"]`);
  await page.waitForTimeout(260);
  verifie("touchée, la case déplie le bandeau", await vu(`${P1} [data-s="bandeau"]`));

  // **SOUS la case, et mesuré.** Un menu qui recouvre le champ qu'on vient de
  // toucher cache justement ce qu'on est en train de renseigner.
  const c = await rect(`${P1} [data-s="case"]`), b = await rect(`${P1} [data-s="bandeau"]`);
  verifie("le bandeau se déplie SOUS la case, sans la recouvrir", b.y >= c.bas - 1,
    `case finit à ${c.bas.toFixed(0)}, bandeau commence à ${b.y.toFixed(0)}`);

  const listes = await txt(`${P1} [data-s="bandeau"]`);
  for (const unite of ["jour/homme", "m²", "ml", "heure", "forfait", "tonne"]) {
    verifie(`« ${unite} » est proposée`, listes.includes(unite));
  }
  // Le forfait ne se multiplie pas : le dire ICI évite un devis faux.
  verifie("« forfait » dit qu'il ne se multiplie pas", /ne se multiplie pas/.test(listes));

  await (await page.$(P1)).screenshot({ path: `${SORTIE}/unite-bandeau.png` });

  // ── 3. Le choix se voit, dans la case ─────────────────────────────────
  await page.click(`${P1} .opt.o2`);
  await page.waitForTimeout(240);
  const apres = await txt(`${P1} [data-s="case"]`);
  verifie("le choix remonte dans la case", apres.includes("m²") && !apres.includes("Choisir"),
    `la case dit « ${apres.replace(/\n/g, " ")} »`);
  const marques = await page.$$eval(`${P1} .opt .marque`, (l) =>
    l.filter((e) => getComputedStyle(e).opacity === "1").length);
  verifie("une seule ligne porte la marque du choix", marques === 1, `${marques}`);
} catch (e) { echecs.push("bandeau · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. LA règle : la case reste libre, dans les DEUX formes ──────────────
try {
  const libre1 = await page.$(`${P1} .libre input`);
  verifie("forme 1 : on peut toujours écrire son unité à soi", libre1 !== null,
    "une liste fermée retirerait le stère, la tonne, l'arbre");
  await cadrer(P2);
  const libre2 = await page.$(`${P2} .autre input`);
  verifie("forme 2 : on peut toujours écrire son unité à soi", libre2 !== null);

  const pastilles = await txt(`${P2} [data-s="pastilles"]`);
  for (const unite of ["jour/homme", "m²", "tonne"]) {
    verifie(`forme 2 : « ${unite} » est sous les yeux`, pastilles.includes(unite));
  }
  await page.click(`${P2} .past.q1`);
  await page.waitForTimeout(240);
  const choisie = await page.$$eval(`${P2} .past`, (l) =>
    l.filter((e) => getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)")
     .map((e) => e.textContent.trim()));
  verifie("forme 2 : la pastille touchée se marque, et elle seule",
    choisie.length === 1 && choisie[0] === "jour/homme", choisie.join(" | "));
  await (await page.$(P2)).screenshot({ path: `${SORTIE}/unite-pastilles.png` });
} catch (e) { echecs.push("liberté · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le doigt, et la largeur ───────────────────────────────────────────
try {
  const petits = await page.$$eval(".opt, .past, .case", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.trim().slice(0, 24) }))
     .filter((m) => m.h < 36));
  // 36 px et non 44 : ce sont des lignes de liste, pas des boutons d'action —
  // la mesure d'Apple vaut pour une cible isolée, pas pour un rang serré.
  verifie("aucune ligne de choix trop mince pour le doigt", petits.length === 0,
    petits.map((m) => `« ${m.t} » ${m.h.toFixed(0)} px`).join(" | "));

  const corps = await page.$$eval("input", (l) =>
    l.filter((e) => e.type !== "radio" && e.type !== "checkbox")
     .map((e) => parseFloat(getComputedStyle(e).fontSize)));
  verifie("les champs font 16 px — sinon iOS agrandit la page",
    corps.length > 0 && corps.every((c) => c >= 16), corps.join(" / "));

  for (const s of [AVANT, P1, P2]) {
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
