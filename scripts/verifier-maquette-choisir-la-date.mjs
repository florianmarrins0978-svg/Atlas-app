/*
  CHOISIR LA DATE AVEC LE CALENDRIER DU PLANNING — ce que cette planche doit
  tenir.

  Sa demande du 22 août 2026 : *« lorsqu'on clique sur "Choisir la date" et que
  le calendrier s'affiche pour proposer une date au client, on devrait avoir le
  visuel du calendrier qui se trouve dans la catégorie planning, avec la
  possibilité de cliquer sur les jours pour voir quels chantiers y sont déjà
  affectés — comme ça on peut savoir si oui ou non on peut rajouter des clients
  sur les jours. »*

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DE LA PLANCHE.

    1. **Le calendrier du planning est bien là** : les deux barres sous le
       chiffre, le week-end teinté, aujourd'hui cerclé d'or. Une planche qui
       redessinerait un calendrier ordinaire ne répondrait pas à sa demande.
    2. **Toucher un jour dit QUI y est déjà** — le cœur de sa question. Sur le
       jour le plus chargé, la fiche doit nommer chaque chantier, sa commune,
       ses demi-journées et son équipe.
    3. **Elle dit s'il reste de la place POUR CE CHANTIER-CI.** C'est ce que le
       calendrier nu ne pouvait pas dire : il éteignait un jour sans un mot.
    4. **Un jour complet reste TOUCHABLE.** C'est justement celui qu'il veut
       regarder avant de décider ; l'éteindre le renverrait à ne rien savoir.
    5. **Le mois se feuillette**, et « ← Aujourd'hui » paraît dès qu'on
       s'éloigne — comme au planning.
    6. **La durée est un bandeau DÉROULANT**, d'une demi-journée à 200 jours —
       sa demande du 22 août. Trois pastilles figées ne couvraient pas un
       chantier de trois semaines, et il en a.
    7. **Changer la durée reprend un jour devenu impossible** : garder un choix
       devenu faux est exactement ce qu'on reproche au calendrier nu.
    8. **Rien ne déborde à 390 px**, la largeur de son téléphone.

  Il sait échouer : éprouvé en retirant la fiche du jour (2 rougit), en
  désactivant les jours complets (4 rougit), en figeant le jour retenu quand la
  durée change (6 rougit).

  Usage : node scripts/verifier-maquette-choisir-la-date.mjs
*/
import path from "node:path";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

// Le navigateur du bac à sable, quand il est là — le même chemin que les
// contrôles voisins. Ailleurs (la CI), Playwright trouve le sien.
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/* global POSES, EQUIPES, tient */
//
// **Ces trois noms vivent DANS LA PAGE, pas dans ce script.** Ils sont lus à
// l'intérieur de `page.evaluate`, dont le corps s'exécute dans le navigateur —
// `appli/choisir-la-date.html` les y définit (`EQUIPES`, `POSES`, `tient`).
//
// La déclaration ci-dessus existe pour ESLint, et **elle ne relâche rien** :
// `no-undef` reste une erreur partout ailleurs dans ce fichier. Cette règle a
// été posée après le 10 août 2026, où `scripts/banc.mjs` lisait une variable
// qui n'existait pas et faisait tomber le banc APRÈS l'avoir annoncé prêt : on
// nomme donc les trois exceptions plutôt que d'éteindre le garde-fou.
//
// Sans elle, `npm run lint` rendait six erreurs et **la CI de `main` restait
// rouge pour toutes les sessions**, sur du code juste.
const PAGE = "file://" + path.resolve("appli/choisir-la-date.html");
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
await page.waitForTimeout(300);

// 1 — le dessin du planning, pas un calendrier ordinaire
dire(await page.locator(".case .marqueA i").count() > 0, "aucune barre de demi-journée : ce n'est pas le calendrier du planning");
dire(await page.locator(".case.we").count() > 0, "le week-end n'est pas teinté");
dire(await page.locator(".case.aujourdhui").count() === 1, "aujourd'hui n'est pas cerclé d'or, ou l'est plus d'une fois");
dire(await page.locator(".legende .annote").count() === 1, "la légende ne montre plus où sont le matin et l'après-midi");

// 2 — le jour le plus chargé nomme ce qu'il porte
const cases = page.locator(".case:not(.we)");
const combien = await cases.count();
dire(combien > 0, "le mois ne s'est pas dessiné");

let plusCharge = null, score = -1;
for (let i = 0; i < combien; i++) {
  const j = await cases.nth(i).getAttribute("data-jour");
  const n = await page.evaluate((jour) => POSES.filter((p) => p.jour === jour).length, j);
  if (n > score) { score = n; plusCharge = i; }
}
dire(score > 0, "aucun chantier de démonstration n'est posé : la planche ne montre rien");
await cases.nth(plusCharge).click();
await page.waitForTimeout(200);
const fiche = (await page.locator(".jour-ouvert").innerText()).toLowerCase();
dire(/matin/.test(fiche) && /après-midi/.test(fiche), "la fiche du jour ne dit pas les demi-journées");
const noms = await page.evaluate((i) => {
  const jour = document.querySelectorAll(".case:not(.we)")[i].dataset.jour;
  return [...new Set(POSES.filter((p) => p.jour === jour).map((p) => p.nom))];
}, plusCharge);
for (const n of noms) {
  dire(fiche.includes(n.toLowerCase()), `« ${n} » est posé ce jour-là mais la fiche ne le nomme pas`);
}
dire(await page.locator(".jour-ouvert .equipe").count() > 0, "la fiche ne dit pas quelle équipe est prise");

// 3 — le verdict pour CE chantier
dire(await page.locator(".verdict").count() === 1, "aucun verdict : l'écran ne dit pas s'il peut y ajouter ce client");

// 4 — un jour complet reste touchable
//
// **On TOURNE LA PAGE si le mois affiché ne le porte pas.** La planche pose ses
// exemples aux 3e et 6e jours OUVRÉS à partir d'aujourd'hui : à deux jours de la
// fin du mois, ils tombent le mois suivant, et le mois affiché — qui commence
// toujours au 1er — n'en montre aucun. Le contrôle accusait alors la planche
// d'un défaut qui n'existe pas. C'est le piège déjà écrit dans `HANDOVER.md`
// (« une suite qui lit le mois affiché rougit en fin de mois », 26 août 2026),
// et son remède : feuilleter plutôt que conclure. Trouvé le 30 août 2026.
const chercherJourComplet = () =>
  page.evaluate(() => {
    const cases = [...document.querySelectorAll(".case:not(.we)")];
    const plein = cases.find((c) => {
      const jour = c.dataset.jour;
      return POSES.filter((p) => p.jour === jour && p.demi === "matin").length >= EQUIPES;
    });
    return plein ? { jour: plein.dataset.jour, eteint: plein.disabled } : null;
  });
let casComplet = await chercherJourComplet();
let moisTournes = 0;
while (casComplet === null && moisTournes < 1) {
  await page.locator('[data-mois="1"]').click();
  await page.waitForTimeout(150);
  moisTournes++;
  casComplet = await chercherJourComplet();
}
dire(
  casComplet !== null,
  "aucun jour complet, ni ce mois-ci ni le suivant : la planche ne montre pas le cas qui l'intéresse"
);
if (casComplet) dire(!casComplet.eteint, "un jour complet est éteint : c'est justement celui qu'il veut regarder");

// 5 — le mois se feuillette
await page.locator('[data-mois="1"]').click();
await page.waitForTimeout(150);
dire(await page.locator("[data-retour]").isVisible(), "« ← Aujourd'hui » ne paraît pas quand on s'éloigne du mois courant");
await page.locator("[data-retour]").click();
await page.waitForTimeout(150);
dire(await page.locator("[data-retour]").isHidden(), "« ← Aujourd'hui » reste là une fois revenu");

// 6 — le bandeau déroulant, d'une demi-journée à 200 jours
const options = await page.$$eval("#duree option", (os) =>
  os.map((o) => ({ valeur: Number(o.value), mot: o.textContent.trim() })));
dire(options.length === 201, `le déroulant porte ${options.length} choix au lieu de 201 (une demi-journée + 1 à 200 jours)`);
dire(options[0] && /demi-journée/i.test(options[0].mot), "le premier choix n'est pas la demi-journée");
dire(options.some((o) => o.mot === "1 jour"), "« 1 jour » manque");
dire(options.some((o) => o.mot === "200 jours"), "« 200 jours » manque : il ne peut pas poser un long chantier");
dire(options.every((o, i) => i === 0 || o.valeur === i * 2), "les durées ne se suivent pas en demi-journées");

// 7 — changer la durée rend un jour devenu impossible
const rendu = await page.evaluate(() => {
  // On retient un jour qui tient sur une demi-journée mais pas sur quatre :
  // c'est le cas que le calendrier nu laissait passer en silence.
  const cases = [...document.querySelectorAll(".case:not(.we)")];
  for (const c of cases) {
    const j = c.dataset.jour;
    if (tient(j, 1).possible && !tient(j, 4).possible) return j;
  }
  return null;
});
if (rendu) {
  await page.selectOption("#duree", "1");
  await page.waitForTimeout(120);
  await page.locator(`.case[data-jour="${rendu}"]`).click();
  await page.waitForTimeout(120);
  // **Toucher SUFFIT — sa demande du 25 août 2026.** Le contrôle appuyait
  // auparavant sur « Proposer ce jour » quand ce bouton existait, et laissait
  // passer son absence : il serait donc resté vert sur une planche où toucher
  // un jour ne fait plus rien. C'est le geste qu'on éprouve, pas le bouton.
  dire(
    (await page.locator("[data-retenir]").count()) === 0,
    "la fiche porte encore « Proposer ce jour » : il faut deux gestes là où il en veut un"
  );
  dire(await page.locator("#retenu-dit").isVisible(), "toucher un jour ne le propose pas");
  // Et retoucher le rend : sans quoi une date posée par erreur ne s'enlève plus.
  await page.locator(`.case[data-jour="${rendu}"]`).click();
  await page.waitForTimeout(120);
  dire(await page.locator("#retenu-dit").isHidden(), "retoucher un jour proposé ne le retire pas");
  await page.locator(`.case[data-jour="${rendu}"]`).click();
  await page.waitForTimeout(120);
  await page.selectOption("#duree", "4");
  await page.waitForTimeout(150);
  dire(await page.locator("#retenu-dit").isHidden(), "un jour devenu impossible reste proposé au client");
  dire(await page.locator("#envoyer").isDisabled(), "« Envoyer » reste allumé sans jour tenable");
}

// 8 — rien ne déborde
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
dire(debord <= 0, `la planche déborde de ${debord} px sur la largeur de son téléphone`);

await navigateur.close();

if (soucis.length) {
  console.error("❌ Choisir la date — la planche ne tient pas :");
  for (const s of soucis) console.error(`   · ${s}`);
  process.exit(1);
}
console.log("✅ Choisir la date — la planche montre qui est là, et dit s'il reste de la place.");
