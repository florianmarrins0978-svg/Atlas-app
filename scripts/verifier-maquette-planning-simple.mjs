#!/usr/bin/env node
/*
  Éprouve la maquette du planning en semaines — dans un vrai navigateur.

  **Pourquoi elle ne se relit pas, elle se joue.** Il a demandé une maquette
  « dynamique que je puisse essayer » : ce qu'elle promet, ce sont des gestes —
  les flèches changent de semaine, les trois calendriers se comparent, et la
  liste montre la MÊME semaine que le calendrier. Une promesse de ce genre ne se
  vérifie pas à la lecture du fichier.

  **Et elle refuse de conclure sur du vide.** Une case de zéro pixel n'est pas
  « rien n'est pris » : c'est une mesure impossible, le faux vert du 15 août
  2026 où 0 − 0 = 0 certifiait « rien n'est coupé » sur un écran où trois noms
  l'étaient.

      node scripts/verifier-maquette-planning-simple.mjs
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "planning-simple.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const problemes = [];
function verifier(quoi, condition) {
  if (condition) console.log(`  ✓ ${quoi}`);
  else {
    console.error(`  ✗ ${quoi}`);
    problemes.push(quoi);
  }
}

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {},
);
// **La permission du presse-papier se donne AVANT d'ouvrir la page.** Accordée
// après coup, elle ne s'applique pas à l'origine déjà chargée : le contrôle du
// « Copier l'adresse » rougissait sur un geste qui marche pour de vrai.
const contexte = await navigateur.newContext({ viewport: { width: 430, height: 1200 } });
await contexte.grantPermissions(["clipboard-write", "clipboard-read"]);
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const titreMois = () => page.locator("#mois-titre").innerText();
const titreSemaine = () => page.locator("#sem-titre").innerText();

// **Le titre du jour est écrit « vendredi 21 août », mais la feuille de style
// le met en capitales.** `innerText` rend ce que l'ŒIL voit, pas ce que le HTML
// porte : un contrôle qui compare au texte source rougit sur une page juste.
// Payé ici le 19 août 2026.
const litPlanifies = async () => (await page.locator("#planifies").innerText()).toLowerCase();

verifier("la page se charge sans erreur de script", erreurs.length === 0);
if (erreurs.length) console.error("   ", erreurs[0]);

// ── LE CALENDRIER RESTE AU MOIS — sa correction du 21 août ────────────────
verifier(`le calendrier arrive sur le mois — lu : « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));
verifier(
  "le mois ne porte QUE ses propres jours — août en a 31",
  (await page.locator("#mois [data-jour]").count()) === 31,
);
// **Compter les cases vides ne suffit pas** : il faut qu'elles soient VIDES.
// Un « 27 » lu dans la grille d'août peut être le 27 août — le contrôle qui
// cherchait ce chiffre accusait une page juste.
verifier(
  "les jours des autres mois sont des cases vides, pas des chiffres gris",
  // `#mois > .creux` : les enfants DIRECTS de la grille. La marque « Points »
  // pose elle aussi des `.creux` — à l'intérieur des cases, pour les chantiers
  // sans équipe — et les compter ensemble donnerait n'importe quoi.
  (await page.locator("#mois > .creux").count()) === 42 - 31 &&
    (await page.$$eval("#mois > .creux", (n) => n.every((e) => e.textContent.trim() === ""))),
);

// **Le retour « Aujourd'hui » n'existe que si l'on s'est éloigné.** Sans lui on
// se perd à trois mois ; toujours présent, il se lirait comme une action à
// faire. Les deux états se jouent, ils ne se supposent pas.
verifier("sur le mois courant, aucun retour « Aujourd'hui »", await page.locator("#retour").isHidden());
await page.click("#mois-apres");
verifier("dès qu'on change de mois, le retour apparaît", await page.locator("#retour").isVisible());
await page.click("#retour");
verifier("et il ramène sur le mois du jour", /août 2026/i.test(await titreMois()));
await page.click("#mois-apres");
verifier(`la flèche du mois avance — « ${await titreMois()} »`, /septembre 2026/i.test(await titreMois()));
await page.click("#mois-avant");
verifier(`et revient — « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));

// ── LA SEMAINE NE GOUVERNE QUE LES PLANIFIÉS ─────────────────────────────
const semaineDepart = await titreSemaine();
verifier(`la semaine arrive sur celle du 19 août — « ${semaineDepart} »`, /17\s*–\s*23 août/.test(semaineDepart));
verifier(
  "les deux Martins du vendredi 21 sont dans la liste, avec le jour NOMMÉ",
  (await litPlanifies()).includes("vendredi 21 août"),
);
await page.click("#sem-apres");
verifier(`la flèche de la semaine avance — « ${await titreSemaine()} »`, /24\s*–\s*30 août/.test(await titreSemaine()));
verifier(
  "l'abri de Pornic apparaît le mardi 25, avec sa demi-journée",
  (await litPlanifies()).includes("mardi 25 août") && (await litPlanifies()).includes("matin"),
);
verifier(
  "« ½ journée » ne s'écrit plus : « matin » le dit déjà",
  !(await litPlanifies()).includes("½ journée"),
);
verifier("la flèche de la semaine n'a PAS changé le mois", /août 2026/i.test(await titreMois()));
await page.click("#sem-avant");
verifier("la flèche gauche revient exactement où l'on était", (await titreSemaine()) === semaineDepart);

await page.click("#sem-avant");
await page.click("#sem-avant");
verifier("une semaine vide le dit en toutes lettres", (await litPlanifies()).includes("aucun chantier posé"));

// ── LE MOIS VISE, LA SEMAINE LIT ──────────────────────────────────────────
//
// Toucher un jour du mois doit amener la liste sur SA semaine. Sans ce lien,
// l'écran porterait deux navigations qui s'ignorent — exactement le genre de
// page qu'il trouve incompréhensible.
// Le 3 septembre ne s'atteint plus depuis la grille d'août : les jours des
// autres mois n'y sont plus écrits. C'est le prix du mois épuré, et il se paie
// d'un appui sur la flèche — pas d'un chiffre gris qu'on lit sans le vouloir.
await page.click("#mois-apres");
await page.click('[data-jour="2026-09-03"]');
verifier(
  `toucher le 3 septembre amène la liste sur sa semaine — « ${await titreSemaine()} »`,
  /31 août\s*–\s*6 septembre/.test(await titreSemaine()),
);
verifier(
  "et le jour touché se dit sous le calendrier",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("jeudi 3 septembre"),
);
await page.click("#retour");
await page.click('[data-jour="2026-08-18"]');
verifier(
  "un jour libre le dit, au lieu de ne rien afficher",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("libre"),
);

// ── La marque du jour se dessine, et rien ne mesure zéro ────────────────
{
  const boites = await page.$$eval(".marqueA i", (n) => n.map((e) => e.getBoundingClientRect().height));
  verifier(
    `les deux barres du jour se dessinent (${boites.length} barres, aucune de zéro pixel)`,
    boites.length === 62 && boites.every((h) => h >= 1),
  );
}

/**
 * Ce qu'une case du mois peint, demi-journée par demi-journée.
 *
 * **Sa règle du 21 août au soir :** la barre dit une CHARGE — vide, de la place,
 * complet, ou au-delà. Le dernier état prévient sans interdire. On rend donc
 * l'état et la part remplie.
 */
const chargeDe = (jour) =>
  page.$$eval(`[data-jour="${jour}"] .marqueA i`, (n) =>
    n.map((e) => {
      const seg = e.querySelector(".seg");
      if (!seg) return { etat: "libre", part: "0%" };
      return { etat: seg.className.replace("seg", "").trim() || "libre", part: seg.style.width };
    }));

// ── Ce que le calendrier peint doit être CE QUE LES DONNÉES DISENT ───────
//
// Le vendredi 21 porte deux chantiers à la journée et l'entreprise a deux
// équipes : chaque équipe a le sien, donc COMPLET — sans que rien n'interdise
// d'en ajouter un troisième (contrôle plus bas).
verifier(
  `le vendredi 21 est complet matin et après-midi (lu : ${JSON.stringify(await chargeDe("2026-08-21"))})`,
  (await chargeDe("2026-08-21")).every((d) => d.etat === "plein" && d.part === "100%"),
);
verifier(
  `le mercredi 19 n'a rien le matin et de la place l'après-midi (lu : ${JSON.stringify(await chargeDe("2026-08-19"))})`,
  (await chargeDe("2026-08-19"))[0].etat === "libre" &&
    (await chargeDe("2026-08-19"))[1].etat === "place",
);

// ── LE DÉPASSEMENT PRÉVIENT, IL N'INTERDIT PAS ─────────────────────────
//
// Sa proposition du 21 août : « s'il rajoute un troisième chantier avec deux
// gars, on met une autre couleur pour dire qu'il a dépassé — mais il peut quand
// même le faire ». Les deux moitiés de la règle se jouent ici : l'ajout PASSE,
// et la couleur CHANGE.
await page.click('[data-jour="2026-08-21"]');
{
  // **Un seul bouton d'ajout, sous la journée** (sa demande du 21 août au
  // soir) : plus un par demi-journée, « ça surcharge et on ne comprend plus ».
  verifier(
    "un jour complet propose quand même d'ajouter, par UN seul bouton",
    (await page.locator("#jour-ouvert [data-ajouter]").count()) === 1,
  );
  verifier(
    "et il n'y a plus de bouton collé aux demi-journées",
    (await page.locator("#jour-ouvert .demi [data-ajouter]").count()) === 0,
  );

  // D'abord QUI, ensuite QUAND : c'est le client qu'il a en tête.
  await page.click("#jour-ouvert [data-ajouter]");
  const qui = await page.$$eval("#jour-ouvert .choisir [data-qui]", (n) => n.map((e) => e.textContent.trim()));
  verifier(`il demande d'abord QUI (lu : ${JSON.stringify(qui)})`, qui.length > 0);
  await page.locator("#jour-ouvert .choisir [data-qui]").first().click();
  const quand = await page.$$eval("#jour-ouvert .choisir [data-quand]", (n) => n.map((e) => e.textContent.trim()));
  verifier(
    `puis QUAND (lu : ${JSON.stringify(quand)})`,
    JSON.stringify(quand) === JSON.stringify(["Matin", "Après-midi", "Journée"]),
  );
  await page.locator('#jour-ouvert .choisir [data-quand="matin"]').click();

  const apres = await chargeDe("2026-08-21");
  verifier(
    `le troisième chantier passe, et le matin bascule en « au-delà » (lu : ${JSON.stringify(apres)})`,
    apres[0].etat === "dela" && apres[0].part === "100%",
  );
  const dit = await page.locator("#jour-ouvert .demi").first().locator(".compte").innerText();
  verifier(`et le compte le dit en clair (lu : « ${dit.trim()} »)`, /150\s*%/.test(dit));

  // **« Toute la journée » ne s'écrit plus sous les noms** — sa demande du même
  // message : le chantier apparaît déjà sous les deux demi-journées.
  verifier(
    "« toute la journée » a disparu des lignes",
    !(await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("toute la journée"),
  );
}

// ── Rien n'est jamais refusé, même au-delà du quota ────────────────────
{
  verifier(
    "même au-delà, le bouton d'ajout est toujours là",
    (await page.locator("#jour-ouvert [data-ajouter]").count()) === 1,
  );
}

// ── LA LÉGENDE DIT LES QUATRE ÉTATS, SUR UNE LIGNE ─────────────────────
{
  const dit = (await page.locator("#legende").innerText()).toLowerCase().replace(/\n/g, " ");
  verifier(
    `elle dit la place, le complet et l'au-delà (lu : « ${dit} »)`,
    ["de la place", "complet", "au-delà", "matin", "après-midi"].every((m) => dit.includes(m)),
  );
  const hauts = await page.$$eval(".legende > span", (n) =>
    n.map((e) => Math.round(e.getBoundingClientRect().top)));
  verifier(
    `et tout tient sur UNE ligne (hauts lus : ${JSON.stringify(hauts)})`,
    hauts.length === 4 && hauts.every((h) => h === hauts[0]),
  );
  const carres = await page.$$eval(".legende .carre", (n) =>
    n.map((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - r.height) <= 1; }));
  verifier(`les cinq marques restent des carrés (lu : ${JSON.stringify(carres)})`,
    carres.length === 5 && carres.every(Boolean));
}

// ── AJOUTER SUR N'IMPORTE QUEL JOUR, PAR LE MÊME GESTE ─────────────────
//
// Sa remarque du 21 août — « pourquoi le 21 n'a pas le même visuel que le
// 19 ? » — vient de là : « complet » supprimait le bouton. Tous les jours
// proposent donc les mêmes gestes, quel que soit leur état.
for (const jour of ["2026-08-19", "2026-08-21"]) {
  await page.click(`[data-jour="${jour}"]`);
  verifier(
    `le ${jour.slice(-2)} propose le même bouton d'ajout`,
    (await page.locator("#jour-ouvert [data-ajouter]").count()) === 1,
  );
}
await page.click('[data-jour="2026-08-19"]');
{
  const avant = (await page.locator("#jour-ouvert").innerText()).length;
  await page.click("#jour-ouvert [data-ajouter]");
  await page.locator("#jour-ouvert .choisir [data-qui]").first().click();
  await page.locator('#jour-ouvert .choisir [data-quand="matin"]').click();
  verifier(
    "et le poser l'inscrit pour de bon dans la matinée",
    (await page.locator("#jour-ouvert").innerText()).length > avant &&
      (await chargeDe("2026-08-19"))[0].etat !== "libre",
  );
}

// ── POSÉ, MAIS PERSONNE DESSUS — ce qui le perdait le 21 août ──────────
//
// La barre du mois compte des CHANTIERS depuis sa règle du soir ; ce n'est plus
// elle qui dit si quelqu'un est affecté. C'est la fiche du jour qui le porte —
// « Équipe ? » —, et c'est là qu'on l'éprouve.
await page.click("#retour").catch(() => {});
await page.click('[data-jour="2026-08-21"]');
{
  const avant = await page.locator("#jour-ouvert").innerText();
  verifier("les chantiers sans personne le disent en toutes lettres", avant.includes("Équipe ?"));

  for (const [rang, nom] of [[0, "Julien"], [1, "Paul"], [2, "Julien"], [3, "Paul"]]) {
    await page.locator('#jour-ouvert [data-equipe]').nth(rang).click();
    const bouton = page.locator(`#jour-ouvert .choisir [data-choix="${nom}"]`).first();
    if (!(await bouton.getAttribute("class")).includes("retenue")) await bouton.click();
    await page.locator('#jour-ouvert .choisir [data-fini]').first().click();
  }
  const apres = await page.locator("#jour-ouvert .demi").first().innerText();
  verifier(
    `une fois les équipes posées, le matin ne dit plus « Équipe ? » (lu : « ${apres.replace(/\n/g, " ").slice(0, 60)}… »)`,
    !apres.includes("Équipe ?"),
  );
}

// ── LE MATIN ET L'APRÈS-MIDI SONT INDÉPENDANTS ────────────────────────
//
// Sa remarque du 21 août : « sur Mr. Leroy, qui dure toute la journée, je ne
// peux pas mettre juste Paul le matin et Julien et Paul l'après-midi — si je
// mets les deux l'après-midi, ça me les met aussi le matin ».
await page.click("#retour").catch(() => {});
await page.click('[data-jour="2026-08-20"]');
{
  // Le « ＋ » est le signe qui invite à en ajouter un autre : il n'appartient
  // pas au nom de l'équipe, on le retire avant de comparer.
  const lire = () => page.$$eval("#jour-ouvert .demi", (n) =>
    n.map((e) => [...e.querySelectorAll("[data-equipe]")].map((b) => b.textContent.replace("＋", "").trim())));

  // Le matin : Paul seul. L'après-midi : Julien ET Paul.
  const matin = page.locator("#jour-ouvert .demi").first();
  await matin.locator("[data-equipe]").first().click();
  const dejaMatin = await matin.locator('.choisir [data-choix].retenue').allTextContents();
  for (const t of dejaMatin) {
    const nom = t.replace("✓", "").trim();
    if (nom !== "Paul") await matin.locator(`.choisir [data-choix="${nom}"]`).click();
  }
  if (!dejaMatin.some((t) => t.includes("Paul"))) await matin.locator('.choisir [data-choix="Paul"]').click();
  await matin.locator(".choisir [data-fini]").click();

  const apres = page.locator("#jour-ouvert .demi").last();
  await apres.locator("[data-equipe]").first().click();
  for (const nom of ["Julien", "Paul"]) {
    const bouton = apres.locator(`.choisir [data-choix="${nom}"]`);
    if (!(await bouton.getAttribute("class")).includes("retenue")) await bouton.click();
  }
  await apres.locator(".choisir [data-fini]").click();

  const lu = await lire();
  verifier(
    `le matin garde Paul seul pendant que l'après-midi en porte deux (lu : ${JSON.stringify(lu)})`,
    lu[0][0] === "Paul" && lu[1][0].includes("Julien") && lu[1][0].includes("Paul"),
  );
  verifier(
    `et le calendrier montre bien de la charge ce jour-là (lu : ${JSON.stringify(await chargeDe("2026-08-20"))})`,
    (await chargeDe("2026-08-20")).every((d) => d.etat !== "libre"),
  );
}

// ── LE NOM OUVRE LA FEUILLE, DANS LA LISTE DES PLANIFIÉS AUSSI ─────────
//
// C'est là qu'il cliquait : « je ne peux toujours pas cliquer sur le nom du
// client pour ouvrir la fiche prestation, avec l'adresse et le numéro pour
// l'appeler ». La fiche du jour l'ouvrait déjà ; cette liste-là, non.
await page.click("#retour").catch(() => {});
await page.locator("#planifies .chantier").first().click();
{
  const feuille = page.locator("#feuille-liste .feuille");
  verifier("un nom de la liste des planifiés ouvre sa feuille", (await feuille.count()) === 1);

  // **Et AU-DESSUS, la journée entière.** Sa demande du 21 août : « il faut que
  // les deux s'affichent » — le bandeau du jour (matin, après-midi, ajouter) et
  // la feuille de chantier.
  {
    const carte = page.locator("#feuille-liste [data-jour-carte]");
    verifier("la journée s'ouvre au-dessus de la feuille", (await carte.count()) === 1);
    const dit = (await carte.innerText()).toLowerCase();
    verifier(
      `elle porte le matin, l'après-midi et de quoi ajouter (lu : « ${dit.replace(/\n/g, " ").slice(0, 70)}… »)`,
      dit.includes("matin") && dit.includes("après-midi") && dit.includes("ajouter"),
    );
    const carteBoite = await carte.boundingBox();
    const feuilleBoite = await feuille.boundingBox();
    verifier("la feuille est bien SOUS la journée", feuilleBoite.y > carteBoite.y);
  }
  // **Et elle s'ouvre SOUS la ligne touchée.** Vu sur capture : elle
  // s'affichait au bas de la liste, trois chantiers plus bas, et l'on croyait
  // avoir ouvert le mauvais. On mesure donc la distance entre les deux.
  {
    // On mesure l'écart entre le BAS de la ligne touchée et le HAUT de la
    // feuille. Négatif, il dirait que la feuille s'est ouverte au-dessus —
    // c'est-à-dire ailleurs que sous le doigt.
    // On mesure l'écart jusqu'à la CARTE du jour, qui est ce qui s'ouvre en
    // premier sous la ligne — la feuille vient après elle.
    const ligne = await page.locator("#planifies .chantier").first().boundingBox();
    const boite = await page.locator("#feuille-liste [data-jour-carte]").boundingBox();
    const ecart = Math.round(boite.y - (ligne.y + ligne.height));
    verifier(`elle s'ouvre juste sous la ligne touchée (${ecart} px plus bas)`, ecart >= 0 && ecart < 60);
  }
  const dit = await feuille.innerText();
  // L'adresse ne s'écrit plus : ce qui compte, c'est que les gestes la portent.
  verifier("elle ne réaffiche pas l'adresse", !/rue|chemin|impasse|boulevard|allée/i.test(dit));
  const liens = await feuille.evaluate((f) => [...f.querySelectorAll("a")].map((a) => a.getAttribute("href")));
  verifier(
    `et le numéro pour appeler (lu : ${JSON.stringify(liens.filter((h) => h.startsWith("tel:")))})`,
    liens.some((h) => h.startsWith("tel:")),
  );
}

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n  La maquette du planning tient ses gestes.\n");
