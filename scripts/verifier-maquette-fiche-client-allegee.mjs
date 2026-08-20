#!/usr/bin/env node
/*
  Éprouve `appli/fiche-client.html`, JAVASCRIPT COUPÉ.

  **D'où elle vient.** Le patron, le 18 août 2026, capture de l'écran « Martins »
  à l'appui : « pas trois encadrés, seulement deux… on garde le nom et les
  informations sous le nom, tout le reste tu enlèves, c'est du trop ».

  **CE QUI SE VÉRIFIE ICI EST L'ORDRE, ET C'EST LE CŒUR DE SA DEMANDE.** Il a
  dit deux fois « trié par date, de la plus récente à la moins récente ». Une
  colonne qui prétend l'être et ne l'est pas lui apprend à ne plus se fier au
  rangement — et il rouvrira chaque PDF pour trouver le bon. Le contrôle relit
  donc les dates TELLES QU'ELLES S'AFFICHENT, en français, et vérifie qu'elles
  descendent. Lire un attribut caché ne prouverait rien de ce qu'il voit.

  **UN RETRAIT SE VÉRIFIE PAR CE QUI NE DOIT PLUS ÊTRE LÀ.** Quatre choses
  partent de cet écran ; le contrôle refuse qu'elles y reviennent par mégarde.

  **ET L'HONNÊTETÉ SE VÉRIFIE AUSSI.** Le PDF « fiche chantier » n'existe pas
  dans Atlas — la page doit le dire. Si une réécriture retirait cette phrase, la
  maquette ferait croire à un document fabriqué. C'est la faute que la planche 56
  a commise deux fois.

  **Il sait échouer.** Éprouvé en échangeant deux dates de la colonne Devis
  (l'ordre rougit en nommant le couple fautif), et en retirant la phrase qui dit
  que la fiche chantier n'existe pas.

  Usage : node scripts/verifier-maquette-fiche-client-allegee.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "fiche-client.html"));

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

/**
 * Une date française telle qu'elle s'affiche → un nombre comparable.
 *
 * **Les abrégés comptent autant que les entiers** : la colonne écrit
 * « 28 juil. 2026 » et « 12 août 2026 » dans la même pile. Ne reconnaître que
 * les mois écrits en entier ferait passer la moitié des lignes pour illisibles,
 * et le contrôle déclarerait « rien à vérifier » en croyant avoir vérifié.
 */
const MOIS = {
  "janv": 1, "janvier": 1, "févr": 2, "fevr": 2, "février": 2, "mars": 3,
  "avr": 4, "avril": 4, "mai": 5, "juin": 6, "juil": 7, "juillet": 7,
  "août": 8, "aout": 8, "sept": 9, "septembre": 9, "oct": 10, "octobre": 10,
  "nov": 11, "novembre": 11, "déc": 12, "dec": 12, "décembre": 12,
};
function enJour(texte) {
  const m = texte.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})/);
  if (!m) return null;
  const mois = MOIS[m[2].toLowerCase()];
  if (!mois) return null;
  return Number(m[3]) * 10000 + mois * 100 + Number(m[1]);
}

const ECRANS = ["#fiche", "#fiche-chantier", "#factures", "#avant"];

const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 13, sa largeur
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la maquette non plus
});
const page = await contexte.newPage();

console.log("=== La fiche client allégée tient-elle ce qu'elle promet ? ===\n");

// ── 1. Un écran à la fois, sans script ──────────────────────────────────────
for (const cible of ECRANS) {
  await page.goto(`file://${CIBLE}${cible === "#fiche" ? "" : cible}`, { waitUntil: "load" });
  const vus = [];
  for (const autre of ECRANS) {
    if ((await page.locator(`${autre}:visible`).count()) > 0) vus.push(autre);
  }
  dire(
    vus.length === 1 && vus[0] === cible,
    `${cible} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`,
  );
}

// ── 2. L'écran d'entrée : deux encadrés, pas trois ──────────────────────────
await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

const colonnes = await page.locator("#fiche .deux .col").count();
dire(colonnes === 2, `l'écran porte ${colonnes} encadré(s) — il en a demandé deux, pas trois`);

const titres = await page.locator("#fiche .deux .col > h3").allInnerTexts();
dire(
  titres.length === 2 && /devis/i.test(titres[0]) && /fiche chantier/i.test(titres[1]),
  `les deux encadrés doivent s'appeler « Devis » puis « Fiche chantier » (lus : ${titres.join(" | ")})`,
);

// **Deux colonnes CÔTE À CÔTE, pas l'une sous l'autre.** Une grille qui
// retombe en une colonne sur un téléphone étroit rendrait la demande sans
// l'exaucer — et cela ne se voit qu'en mesurant, pas en relisant le CSS.
const cotes = await page.evaluate(() => {
  const c = [...document.querySelectorAll("#fiche .deux .col")].map((e) => e.getBoundingClientRect());
  return c.length === 2 ? { hautsEgaux: Math.abs(c[0].top - c[1].top) < 2, gauche: c[0].left, droite: c[1].left } : null;
});
dire(
  cotes !== null && cotes.hautsEgaux && cotes.droite > cotes.gauche,
  `les deux encadrés doivent être côte à côte à 390 px ${cotes ? `(hauts : ${cotes.hautsEgaux ? "alignés" : "décalés"})` : "(introuvables)"}`,
);

// ── 3. Chaque colonne descend dans le temps ─────────────────────────────────
for (const [rang, quoi] of [[1, "Devis"], [2, "Fiche chantier"]]) {
  const lignes = await page.locator(`#fiche .deux .col:nth-child(${rang}) .doc`).allInnerTexts();
  const jours = lignes.map((t) => ({ t: t.replace(/\s+/g, " ").trim(), j: enJour(t) }));
  const illisibles = jours.filter((d) => d.j === null);

  // **Une date qu'on ne sait pas lire n'est pas un succès.** Sans cette
  // plainte, une colonne entière en « 2026-07-28 » passerait au vert : le
  // contrôle n'aurait comparé aucune paire et se serait tu.
  dire(
    lignes.length >= 2 && illisibles.length === 0,
    `${quoi} : ${lignes.length} document(s), dont ${illisibles.length} sans date lisible` +
      (illisibles.length ? ` — « ${illisibles[0].t} »` : ""),
  );

  let ordonnee = true;
  let fautif = "";
  for (let i = 1; i < jours.length; i++) {
    if (jours[i].j !== null && jours[i - 1].j !== null && jours[i].j > jours[i - 1].j) {
      ordonnee = false;
      fautif = `« ${jours[i - 1].t} » puis « ${jours[i].t} »`;
      break;
    }
  }
  dire(ordonnee, `${quoi} : du plus récent au plus ancien${ordonnee ? "" : ` — ${fautif} remonte le temps`}`);

  const annonce = await page.locator(`#fiche .deux .col:nth-child(${rang}) .compte`).innerText();
  const annonces = Number((annonce.match(/\d+/) ?? ["0"])[0]);
  dire(
    annonces === lignes.length,
    `${quoi} : la colonne annonce ${annonces} document(s) et en montre ${lignes.length}`,
  );
}

// ── 4. La dernière prestation : noire, grasse, et détaillée ─────────────────
const derniere = await page.evaluate(() => {
  const h2 = document.querySelector("#fiche .derniere h2");
  const coord = document.querySelector("#fiche .coord");
  if (!h2 || !coord) return null;
  const s = getComputedStyle(h2);
  const c = getComputedStyle(coord);
  return {
    texte: h2.textContent.trim(),
    graisse: Number(s.fontWeight),
    taille: parseFloat(s.fontSize),
    couleur: s.color,
    tailleCoord: parseFloat(c.fontSize),
    comprend: document.querySelectorAll("#fiche .comprend li").length,
    // Sous l'adresse : le haut du titre doit venir APRÈS celui des coordonnées.
    sousAdresse: h2.getBoundingClientRect().top > coord.getBoundingClientRect().top,
  };
});
if (!derniere) {
  dire(false, "la dernière prestation est absente de l'écran — c'est le premier point de sa demande");
} else {
  dire(derniere.sousAdresse, "la dernière prestation se place sous l'adresse, comme il l'a demandé");
  dire(derniere.graisse >= 700, `son titre est gras (graisse lue : ${derniere.graisse})`);
  dire(
    derniere.couleur === "rgb(0, 0, 0)",
    `son titre est noir, et non gris (couleur lue : ${derniere.couleur})`,
  );
  dire(
    derniere.taille >= derniere.tailleCoord * 1.4,
    `son titre domine les coordonnées (${derniere.taille} px contre ${derniere.tailleCoord} px)`,
  );
  dire(
    derniere.comprend >= 3,
    `« ce qu'elle comprend » porte ${derniere.comprend} ligne(s) — sans le détail, ce n'est qu'un nom`,
  );
}

// ── 5. Ce qui devait partir n'est pas revenu ────────────────────────────────
const texteFiche = (await page.locator("#fiche").innerText()).toLowerCase();
const PARTIS = [
  ["reste dû", "la case « reste dû »"],
  ["ses chantiers", "la liste « Ses chantiers »"],
  ["combien de fois", "la liste « Ce qu'on lui fait, et combien de fois »"],
  ["aucune facture émise", "la phrase « Aucune facture émise pour l'instant »"],
];
for (const [aiguille, nom] of PARTIS) {
  dire(!texteFiche.includes(aiguille), `${nom} a bien disparu de l'écran`);
}

// **Le nom et les informations sous le nom, eux, restent.** C'est la seule
// chose qu'il a demandé de GARDER — un contrôle qui ne vérifie que les
// retraits laisserait passer un écran qui aurait tout enlevé.
dire(/martins/i.test(texteFiche), "le nom du client reste en tête");
const coord = await page.locator("#fiche .coord").innerText();
dire(
  /\d/.test(coord) && coord.length > 15,
  `les informations sous le nom restent (lues : « ${coord} »)`,
);

// ── 6. La page dit que la fiche chantier n'existe pas encore ────────────────
const toute = (await page.locator("body").innerText()).toLowerCase();
dire(
  /n[’']existe pas encore/.test(toute),
  "la page dit que le PDF « fiche chantier » n'existe pas encore — sans quoi elle ferait croire à un document fabriqué",
);

// ── 7. Rien ne déborde, et rien n'est trop petit pour un pouce ──────────────
for (const cible of ECRANS) {
  await page.goto(`file://${CIBLE}${cible === "#fiche" ? "" : cible}`, { waitUntil: "load" });

  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  const vue = await page.evaluate(() => window.innerWidth);
  dire(large <= vue + 1, `${cible} ne déborde pas à droite (${large} px pour ${vue})`);

  const petits = await page.evaluate(() => {
    const vus = [];
    for (const a of document.querySelectorAll("a")) {
      const r = a.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hors écran : pas de son ressort
      if (r.height < 28) vus.push(`${(a.textContent || "").trim().slice(0, 30)} — ${Math.round(r.height)} px`);
    }
    return vus;
  });
  dire(
    petits.length === 0,
    `${cible} : tous les liens font 28 px de haut au moins${petits.length ? ` — ${petits.join(" ; ")}` : ""}`,
  );
}

// ── 8. Aucun lien ne tombe dans le vide ─────────────────────────────────────
//
// **C'est sa colère du 18 août 2026 :** *« quand je fais pour cliquer, je ne
// peux pas cliquer »*. Un lien qui ne mène nulle part coûte plus cher qu'un
// lien absent : il fait douter de toute la page. On vérifie donc les deux
// sortes — l'ancre doit exister dans le document, le fichier doit exister sur
// le disque.
await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
const liens = await page.evaluate(() =>
  [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
);
const morts = [];
for (const href of [...new Set(liens)]) {
  if (href.startsWith("#")) {
    if ((await page.locator(href).count()) === 0) morts.push(`${href} — aucune ancre de ce nom`);
    continue;
  }
  const [fichier, ancre] = href.split("#");
  const chemin = resolve(dirname(CIBLE), fichier);
  if (!existsSync(chemin)) {
    morts.push(`${href} — le fichier ${fichier} n'existe pas à côté`);
  } else if (ancre) {
    // **L'ancre d'une AUTRE page se vérifie aussi.** Le fichier peut exister
    // et l'ancre avoir été renommée : le lien s'ouvrirait alors en haut de la
    // page, sur l'écran d'entrée, et il croirait s'être trompé de bouton.
    const voisine = await contexte.newPage();
    await voisine.goto(`file://${chemin}`, { waitUntil: "load" });
    if ((await voisine.locator(`#${ancre}`).count()) === 0) {
      morts.push(`${href} — ${fichier} n'a pas d'ancre « ${ancre} »`);
    }
    await voisine.close();
  }
}
dire(morts.length === 0, `aucun lien ne tombe dans le vide${morts.length ? ` — ${morts.join(" ; ")}` : ` (${liens.length} liens)`}`);

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La fiche client allégée tient ce qu'elle promet."
    : `\n❌ ${plaintes.length} défaut(s) sur la fiche client allégée.`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
