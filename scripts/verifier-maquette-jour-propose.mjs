/*
  UN JOUR PROPOSÉ N'EST PAS UN JOUR COMPLET — ce que cette planche doit tenir.

  Sa remarque du 31 août 2026, capture à l'appui : *« écrit deux chantiers par
  jour, planning complet, et met le petit carré vert foncé avec écrit "complet"
  du planning »*. Ses réglages disent deux chantiers par jour, son septembre est
  vide, et les deux dates qu'il propose à sa cliente se peignent du vert que la
  légende, juste dessous, appelle « complet ».

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DE LA PLANCHE.

    1. **Le défaut est bien MONTRÉ.** Dans la vue « Aujourd'hui », la case
       proposée porte exactement le fond de l'état « complet » de la légende.
       Une planche qui ne le reproduirait pas ne montrerait pas le sujet.
    2. **Chaque proposition le RÉSOUT** : la case proposée ne porte plus ce
       fond-là, et la légende gagne « proposé ».
    3. **Les deux barres restent lisibles** dans les propositions — c'est la
       seconde perte de l'aplat : le jour proposé devenait le seul du mois dont
       on ne pouvait plus lire la charge.
    4. **Aucune vue ne touche au CALCUL.** La charge de chaque demi-journée est
       identique dans les trois : une planche qui la changerait ferait croire à
       un défaut de calcul là où il n'y a qu'une couleur.
    5. **Les gestes marchent** : toucher un jour le propose, retoucher le
       retire, un jour trop proche ne se propose pas.
    6. **Rien ne déborde** à 390 px, la largeur de son téléphone.

  Il sait échouer : éprouvé en repeignant `.case.retenu` en vert plein dans les
  deux propositions (2 et 3 rougissent), en retirant « proposé » de la légende
  (2 rougit), et en faisant compter EQUIPES autrement d'une vue à l'autre
  (4 rougit).

  Usage : node scripts/verifier-maquette-jour-propose.mjs
*/
import path from "node:path";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/* global PREMIER, occupationDe */
//
// **Ces deux noms vivent DANS LA PAGE**, pas ici : ils sont lus à l'intérieur
// de `page.evaluate`, dont le corps s'exécute dans le navigateur, et c'est
// `appli/jour-propose-pas-complet.html` qui les définit. La déclaration existe
// pour ESLint et ne relâche rien ailleurs — même précaution que
// `scripts/verifier-maquette-choisir-la-date.mjs`, où l'oublier avait laissé
// `main` rouge pour toutes les sessions.
const PAGE = "file://" + path.resolve("appli/jour-propose-pas-complet.html");
const PROPOSITIONS = ["point", "pastille"];

const soucis = [];
const dire = (ok, quoi) => { if (!ok) soucis.push(quoi); };

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => soucis.push(`erreur JS : ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") soucis.push(`console : ${m.text()}`); });

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(250);

const voir = async (vue) => {
  await page.click(`.choix button[data-vue="${vue}"]`);
  await page.waitForTimeout(120);
};

/**
 * Ce que porte la première case proposée du mois, MESURÉ dans le navigateur.
 *
 * **Refuser de conclure sur une case de zéro pixel** — la règle de `CLAUDE.md`
 * §5, payée le 15 août 2026 : une mesure impossible n'est pas un succès.
 */
const lireLaCase = () =>
  page.evaluate(() => {
    const c = document.querySelector(".mois .case.retenu");
    if (!c) return null;
    const boite = c.getBoundingClientRect();
    const s = getComputedStyle(c);
    const legende = document.querySelector(".legende .carre.plein");
    return {
      largeur: boite.width,
      fond: s.backgroundColor,
      fondComplet: getComputedStyle(legende).backgroundColor,
      // Le creux des barres : voilé sur un aplat, il ne se lit plus.
      barres: [...c.querySelectorAll(".marqueA i")].map((i) => getComputedStyle(i).backgroundColor),
      mots: [...document.querySelectorAll(".legende > span")].map((x) => x.textContent.trim()),
    };
  });

/** La charge de chaque demi-journée du mois — ce qu'aucune vue n'a le droit de changer. */
const lireLaCharge = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".mois .case")].map((c) => {
      const j = c.dataset.jour;
      const o = (d) => occupationDe(j, d).charge;
      return [j, o("matin"), o("apres_midi"),
        [...c.querySelectorAll(".marqueA .seg")].map((s) => s.className + "|" + s.style.width).join(",")];
    })
  );

// 1 — le défaut, montré tel qu'il l'a photographié
await voir("avant");
const avant = await lireLaCase();
dire(avant !== null, "aucune date proposée au départ : la planche ne montre pas le sujet");
if (avant) {
  dire(avant.largeur > 20, `la case mesure ${avant.largeur} px : rien n'est mis en page, la mesure ne prouve rien`);
  dire(
    avant.fond === avant.fondComplet,
    "la vue « Aujourd'hui » ne reproduit pas le défaut : le jour proposé n'a pas le fond de « complet »"
  );
  dire(!avant.mots.includes("proposé"), "la légende d'aujourd'hui annonce « proposé » : ce n'est pas l'écran qu'il a photographié");
}
const chargeAvant = await lireLaCharge();

// 2 et 3 — chaque proposition résout, sans noyer les barres
for (const vue of PROPOSITIONS) {
  await voir(vue);
  const vu = await lireLaCase();
  dire(vu !== null, `vue « ${vue} » : plus aucune date proposée`);
  if (!vu) continue;
  dire(
    vu.fond !== vu.fondComplet,
    `vue « ${vue} » : le jour proposé garde le fond de « complet » — le défaut est intact`
  );
  dire(vu.mots.includes("proposé"), `vue « ${vue} » : la légende ne dit pas « proposé »`);
  const voile = vu.barres.filter((b) => /rgba\(250, 249, 245/.test(b));
  dire(voile.length === 0, `vue « ${vue} » : les barres sont voilées, la charge du jour ne se lit plus`);
  // 4 — la charge n'a pas bougé d'une vue à l'autre
  const charge = await lireLaCharge();
  dire(
    JSON.stringify(charge) === JSON.stringify(chargeAvant),
    `vue « ${vue} » : la charge affichée n'est plus la même qu'en « Aujourd'hui » — une vue ne change que la marque du jour proposé`
  );
}

// 5 — les gestes
await voir("pastille");
const premier = await page.evaluate(() => PREMIER);
const libre = await page.evaluate((p) => {
  const c = [...document.querySelectorAll(".mois .case")]
    .find((x) => x.dataset.jour > p && !x.classList.contains("retenu"));
  return c ? c.dataset.jour : null;
}, premier);
const dates = () => page.$$eval("#liste button", (n) => n.length);
if (libre) {
  const avantGeste = await dates();
  await page.click(`.case[data-jour="${libre}"]`);
  dire((await dates()) === avantGeste + 1, "toucher un jour libre ne le propose pas");
  await page.click(`.case[data-jour="${libre}"]`);
  dire((await dates()) === avantGeste, "retoucher un jour proposé ne le retire pas");
} else {
  dire(false, "aucun jour libre à toucher : la planche ne se manipule pas");
}
const tropProche = await page.evaluate((p) => {
  const c = [...document.querySelectorAll(".mois .case")].find((x) => x.dataset.jour < p);
  return c ? c.dataset.jour : null;
}, premier);
if (tropProche) {
  const avantGeste = await dates();
  await page.click(`.case[data-jour="${tropProche}"]`);
  dire((await dates()) === avantGeste, "un jour trop proche se propose quand même");
  dire(
    (await page.locator(".verdict.non").count()) === 1,
    "un jour trop proche ne dit pas pourquoi il est refusé"
  );
}

// 6 — rien ne déborde
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
dire(debord <= 0, `la planche déborde de ${debord} px sur la largeur de son téléphone`);

await navigateur.close();

if (soucis.length) {
  console.error("❌ Le jour proposé — la planche ne tient pas :");
  for (const s of soucis) console.error(`   · ${s}`);
  process.exit(1);
}
console.log("✅ Le jour proposé — le défaut est montré, et chaque proposition le sépare de « complet ».");
