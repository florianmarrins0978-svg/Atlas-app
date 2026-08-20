#!/usr/bin/env node
/*
  Éprouve `appli/arrosage-simple.html`, JAVASCRIPT COUPÉ.

  **D'où elle vient.** Le patron, le 20 août 2026, capture d'`arrosage.html` à
  l'appui : *« on va simplifier cette page également. Garde le piquage se
  fait… avec le bandeau déroulant. Ensuite : le croquis et ses métrés, avec la
  possibilité de mettre la photo. Je veux rien d'autre. Ensuite […] tu fais
  apparaître un plan avec les différents réseaux et le détail des pièces. »*

  **LE CONTRÔLE QUI COMPTE EST L'ARITHMÉTIQUE.** Cette page rend une liste de
  matériel : un artisan la recopie chez son fournisseur. Si le compte des
  turbines du détail ne fait pas celui du plan, ou si un réseau demande plus que
  le débit disponible, il commandera de travers — et il l'apprendra sur le
  chantier, pas ici. Le contrôle recalcule donc :

    · les arroseurs dessinés sur le plan = ceux annoncés dans le détail ;
    · une électrovanne par réseau, jamais plus, jamais moins ;
    · aucun réseau au-dessus du débit disponible ;
    · la somme des réseaux DÉPASSE ce débit — sinon un seul aurait suffi, et
      le découpage en trois n'aurait aucune raison d'être.

  Les autres contrôles tiennent la demande elle-même : le déroulant reste, la
  photo mène au plan, et **rien d'autre n'est demandé entre les deux** — c'est
  la moitié de ce qu'il a réclamé.

  **Et l'honnêteté se vérifie aussi** : la page doit dire qu'elle ne LIT pas la
  photo. Sans cette phrase, elle ferait croire à une lecture automatique qui
  n'existe pas — la faute que la planche 56 a commise deux fois.

  **Il sait échouer.** Éprouvé en retirant une turbine du plan, en ajoutant une
  électrovanne, en gonflant un réseau au-dessus du débit, en remettant un champ
  de saisie sur l'écran d'entrée, et en retirant l'aveu sur la lecture.

  Usage : node scripts/verifier-maquette-arrosage-simple.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "arrosage-simple.html"));

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

/** « 1,50 m³/h » → 1.5. La virgule est décimale : c'est du français. */
const enDebit = (t) => {
  const m = t.match(/([\d]+,[\d]+)\s*m³\/h/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

const ECRANS = ["#depart", "#plan", "#lecture", "#avant"];

const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 13, sa largeur
  javaScriptEnabled: false, // la page doit se manipuler sans script
});
const page = await contexte.newPage();

console.log("=== L'arrosage en deux gestes tombe-t-il juste ? ===\n");

// ── 1. Un écran à la fois, sans script ──────────────────────────────────────
for (const cible of ECRANS) {
  await page.goto(`file://${CIBLE}${cible === "#depart" ? "" : cible}`, { waitUntil: "load" });
  const vus = [];
  for (const autre of ECRANS) {
    if ((await page.locator(`${autre}:visible`).count()) > 0) vus.push(autre);
  }
  dire(vus.length === 1 && vus[0] === cible, `${cible} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`);
}

await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

// ── 2. L'écran d'entrée ne demande QUE deux choses ──────────────────────────
//
// C'est la moitié de sa demande — « je veux rien d'autre ». Un champ de plus
// remis par mégarde ne se verrait pas à la relecture.
const saisies = await page.evaluate(() => ({
  selects: [...document.querySelectorAll("#depart select")].map((s) => s.id),
  autres: [...document.querySelectorAll("#depart input, #depart textarea")].map(
    (e) => `${e.tagName.toLowerCase()}[${e.getAttribute("type") ?? ""}]`
  ),
  blocs: document.querySelectorAll("#depart .bloc").length,
}));
dire(
  saisies.selects.length === 1 && saisies.selects[0] === "piquage",
  `un seul menu déroulant sur l'écran d'entrée, celui du piquage (lus : ${saisies.selects.join(", ") || "aucun"})`,
);
// **TROIS champs, et trois seulement** — la mesure au seau, remise le 20 août
// au soir : *« remets la mesure du débit, mais minimaliste »*. Le contrôle
// exigeait AUCUN champ ; il a rougi sur une demande exaucée. C'est le cas que
// `CLAUDE.md` §5 bis décrit : on adapte le contrôle, on ne remet pas l'état
// d'avant. Ce qu'il garde désormais, c'est le PLAFOND : un quatrième champ,
// et il rougit.
dire(
  saisies.autres.length === 3 && saisies.autres.every((c) => c === "input[number]"),
  `trois cases à remplir avant le plan, celles du seau (lues : ${saisies.autres.join(", ") || "aucune"})`,
);
dire(
  saisies.blocs === 2,
  `deux blocs seulement, et il en a demandé deux (lus : ${saisies.blocs})`,
);

// **AUCUN NUMÉRO.** *« Je ne veux pas qu'il y ait marqué un et deux sur les deux
// machins »* — sa consigne du 20 août au soir, en toutes lettres.
const numerotes = await page.evaluate(() =>
  [...document.querySelectorAll("#depart h1, #depart h2, #depart .et")]
    .map((e) => (e.textContent ?? "").trim())
    .filter((t) => /^\s*\d+\s*[·.)-]/.test(t))
);
dire(numerotes.length === 0, `aucun titre numéroté${numerotes.length ? ` — ${numerotes.join(" ; ")}` : ""}`);

// ── L'ÉCRAN D'ENTRÉE NE GAGNE PLUS DE MOTS ─────────────────────────────────
//
// **C'est sa plainte, la cinquième en dix jours** — « il y a beaucoup trop de
// mots dans tous les sens » — et le 20 août au soir, appliquée à cet écran :
// *« tous les autres mots, tu me les supprimes »*.
//
// **Corriger un écran de plus ne règle rien** ; ce qui manquait, c'est un
// contrôle qui rougit quand un écran REGAGNE des mots (`HANDOVER.md`). Le voici,
// pour celui-ci. Le plafond n'est pas une cible : c'est ce que l'écran pèse
// aujourd'hui, plus une marge de deux mots pour ne pas rougir sur une virgule.
//
// **On compte ce qu'il LIT, pas ce que le document contient.** La première
// version comptait les trois options du déroulant, dont deux sont invisibles
// tant qu'il ne l'ouvre pas : elle accusait l'écran de porter 33 mots quand il
// n'en montre que 20. Un contrôle qui accuse à tort coûte plus cher que pas de
// contrôle (`CLAUDE.md` §5).
const PLAFOND_MOTS = 28;
const mots = await page.evaluate(() => {
  const ecran = document.querySelector("#depart");
  if (!ecran) return 999;
  const clone = ecran.cloneNode(true);
  // D'un menu fermé, seule l'option retenue se voit.
  for (const sel of clone.querySelectorAll("select")) {
    const choisie = sel.querySelector("option[selected]") ?? sel.querySelector("option");
    sel.replaceWith(document.createTextNode(choisie?.textContent ?? ""));
  }
  return (clone.textContent ?? "").split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
});
dire(
  mots <= PLAFOND_MOTS,
  mots <= PLAFOND_MOTS
    ? `l'écran d'entrée tient en ${mots} mots (plafond ${PLAFOND_MOTS})`
    : `l'écran d'entrée porte ${mots} mots pour un plafond de ${PLAFOND_MOTS} : il en a regagné ${mots - PLAFOND_MOTS}`,
);

// **Le déroulant s'ouvre pour de vrai**, sans script — c'est ce qu'il a demandé
// de garder. Un faux menu dessiné en CSS ne s'ouvrirait pas au doigt.
const options = await page.locator("#depart select#piquage option").allInnerTexts();
dire(
  options.length >= 2 && /compteur/i.test(options[0]),
  `le menu du piquage porte ses choix (${options.length}) et commence par le compteur`,
);

// **Et le débit affiché doit tomber juste.** 10 L en 20 s font 0,5 L/s, donc
// 1,80 m³/h. Un écran qui montre une mesure et un résultat qui ne se suivent pas
// apprend à douter de tous les autres chiffres de la page.
const mesure = await page.evaluate(() => ({
  litres: Number(document.querySelector("#litres")?.value),
  secondes: Number(document.querySelector("#secondes")?.value),
  affiche: (document.querySelector("#depart .debit")?.textContent ?? "").trim(),
}));
const attendu = (mesure.litres / mesure.secondes) * 3.6;
const lu = Number((mesure.affiche.match(/([\d]+,[\d]+)/)?.[1] ?? "0").replace(",", "."));
dire(
  Math.abs(lu - attendu) < 0.01,
  `${mesure.litres} L en ${mesure.secondes} s font ${attendu.toFixed(2)} m³/h, la page affiche ${lu}`,
);

// ── 3. Ce qui a été retiré n'est pas revenu ─────────────────────────────────
const texteDepart = (await page.locator("#depart").innerText()).toLowerCase();
for (const [mot, quoi] of [
  ["débit disponible", "le débit affiché en cours de route"],
  ["marque des arroseurs", "le choix de la marque"],
  ["sonde de pluie", "la sonde de pluie à cocher"],
]) {
  dire(!texteDepart.includes(mot), `${quoi} a bien disparu de l'écran d'entrée`);
}

// ── 4. La photo mène au plan, et rien ne s'intercale ────────────────────────
const geste = page.locator('#depart a.photo');
dire((await geste.count()) === 1, "un seul geste de photo sur l'écran d'entrée");
dire(
  (await geste.getAttribute("href")) === "#plan",
  `le geste de la photo mène au plan (il mène à ${await geste.getAttribute("href")})`,
);
const hauteurGeste = (await geste.boundingBox())?.height ?? 0;
dire(hauteurGeste >= 56, `ce geste fait ${Math.round(hauteurGeste)} px de haut — on le touche avec des gants`);

// ── 5. L'ARITHMÉTIQUE DU PLAN ──────────────────────────────────────────────
await page.goto(`file://${CIBLE}#plan`, { waitUntil: "load" });

const compte = await page.evaluate(() => {
  // **Les SECTEURS seulement.** Les blocs communs — corps d'arroseurs,
  // nourrice, tuyau — portent eux aussi des nombres, et les compter comme des
  // arroseurs de secteur doublait le total. Un repère explicite vaut mieux
  // qu'une couleur, qui se réutilise.
  const reseaux = [...document.querySelectorAll('#plan .reseau[data-atlas="secteur"]')].map((r) => ({
    titre: (r.querySelector(".tete b")?.textContent ?? "").trim(),
    lignes: [...r.querySelectorAll(".piece")].map((p) => ({
      nombre: (p.querySelector(".n")?.textContent ?? "").trim(),
      quoi: (p.childNodes[1]?.textContent ?? "").trim(),
      precision: (p.querySelector(".q")?.textContent ?? "").trim(),
      // **Un repère, et non le mot « turbine ».** Les libellés viennent du
      // catalogue et n'en portent pas toujours le nom : « 3504 · buse 0,75 »
      // EST une turbine. Chercher le mot ramenait zéro et faisait accuser le
      // plan d'annoncer moins d'arroseurs qu'il n'en dessine.
      estArroseur: p.getAttribute("data-atlas") === "arroseur",
    })),
  }));
  // Les arroseurs DESSINÉS : un cercle plein par arroseur sur le plan.
  const dessines = [...document.querySelectorAll("#plan svg circle")]
    .filter((c) => (c.getAttribute("fill") ?? "").startsWith("#") && c.getAttribute("fill") !== "#fff")
    .map((c) => c.getAttribute("fill"));
  return { reseaux, dessines };
});

const arroseursAnnonces = compte.reseaux
  .flatMap((r) => r.lignes)
  .filter((l) => l.estArroseur)
  .reduce((s, l) => s + Number(l.nombre), 0);

dire(
  arroseursAnnonces > 0 && arroseursAnnonces === compte.dessines.length,
  `le plan dessine ${compte.dessines.length} arroseur(s) et le détail en annonce ${arroseursAnnonces}`,
);

// **Chaque couleur du plan doit retrouver son compte dans SON réseau.** Un
// total juste peut cacher deux réseaux faux qui se compensent.
const parCouleur = {};
for (const c of compte.dessines) parCouleur[c] = (parCouleur[c] ?? 0) + 1;
const couleursReseaux = await page.evaluate(() =>
  [...document.querySelectorAll('#plan .reseau[data-atlas="secteur"] .tete .pastille')].map(
    (p) => p.getAttribute("style")?.match(/background:\s*(#[0-9a-f]{6})/i)?.[1] ?? ""
  )
);
compte.reseaux.forEach((r, i) => {
  const turbines = r.lignes.filter((l) => l.estArroseur).reduce((s, l) => s + Number(l.nombre), 0);
  if (turbines === 0) return; // le goutte-à-goutte et le commun n'ont pas d'arroseur
  const dessinees = parCouleur[couleursReseaux[i]] ?? 0;
  dire(
    turbines === dessinees,
    `${r.titre} : ${turbines} turbine(s) annoncée(s), ${dessinees} dessinée(s) de sa couleur`,
  );
});

// Une électrovanne par réseau : ni deux sur le même, ni un réseau sans commande.
const avecVanne = compte.reseaux.filter((r) => r.lignes.some((l) => /électrovanne/i.test(l.quoi)));
const vannes = compte.reseaux
  .flatMap((r) => r.lignes)
  .filter((l) => /électrovanne/i.test(l.quoi))
  .reduce((s, l) => s + Number(l.nombre), 0);
dire(
  vannes === avecVanne.length && avecVanne.length >= 2,
  `${vannes} électrovanne(s) pour ${avecVanne.length} réseau(x) — il en faut une par réseau`,
);

// Le programmateur doit avoir assez de voies pour les réseaux.
const texteePlan = await page.locator("#plan").innerText();
// Le libellé vient du catalogue — « Programmateur BL-IP 4 stations 9V » —,
// et non d'une formule écrite ici. On lit donc les stations, pas des « voies ».
const voies = Number(texteePlan.match(/Programmateur[^\n]*?(\d+)\s*(?:stations?|voies?)/i)?.[1] ?? 0);
dire(
  voies >= avecVanne.length,
  `le programmateur porte ${voies} voie(s) pour ${avecVanne.length} réseau(x)`,
);

// **Aucun réseau au-dessus du débit, et la somme AU-DESSUS.** La première
// condition évite un plan qui ne peut pas fonctionner ; la seconde prouve que
// le découpage en plusieurs réseaux a une raison d'être — sans elle, un seul
// aurait suffi et la page compliquerait pour rien.
const dispo = enDebit(texteePlan.match(/donne ([\d,]+ m³\/h)/)?.[1] ?? "");
const debits = compte.reseaux
  .flatMap((r) => r.lignes.map((l) => enDebit(l.precision)))
  .filter((d) => d !== null);
dire(dispo !== null, `le débit disponible est écrit sur la page (lu : ${dispo ?? "aucun"})`);
if (dispo !== null && debits.length > 0) {
  const pire = Math.max(...debits);
  const somme = debits.reduce((s, d) => s + d, 0);
  dire(pire <= dispo, `le réseau le plus gourmand demande ${pire} m³/h pour ${dispo} disponibles`);
  dire(
    somme > dispo,
    `les ${debits.length} réseaux demandent ${somme.toFixed(2)} m³/h en tout : ` +
      `au-dessus des ${dispo} disponibles, donc le découpage sert à quelque chose`,
  );

  // **ET LE TOTAL ÉCRIT DANS LA PHRASE DOIT ÊTRE CELUI-LÀ.**
  //
  // Vu à la capture, pas au test : la page expliquait « les onze arroseurs
  // ensemble demanderaient 2,46 m³/h » quand la somme des trois réseaux en fait
  // 2,70. Le contrôle calculait bien, mais ne regardait pas ce qui était écrit —
  // et c'est la phrase que le patron lit. Une explication qui ne tombe pas juste
  // apprend à douter de tout le reste de la page.
  const annonce = enDebit(texteePlan.match(/demanderaient ([\d,]+ m³\/h)/)?.[1] ?? "");
  dire(
    annonce !== null && Math.abs(annonce - somme) < 0.02,
    `la phrase annonce ${annonce ?? "aucun"} m³/h au total, la somme des réseaux en fait ${somme.toFixed(2)}`,
  );
}

// ── 5 bis. AUCUNE PIÈCE INVENTÉE ───────────────────────────────────────────
//
// **C'est la question qu'il a posée le 20 août :** *« les pièces que tu as
// utilisées pour l'exemple sont choisies au hasard ? »* — et la réponse était
// oui pour une partie d'entre elles. « Filtre à tamis », « clapet
// anti-retour », « colliers de prise en charge » n'existaient nulle part ; les
// turbines annoncées « portée 5 m · 0,30 m³/h » ne correspondaient à aucune
// référence.
//
// Le dépôt tient un catalogue où chaque entrée porte sa SOURCE — relevée de ses
// photos, ou provisoire (`appli/arrosage-catalogue.js`). Un arroseur dont on
// croit la portée fausse fait acheter le mauvais nombre d'arroseurs, et c'est
// le paysagiste qui revient poser les manquants.
//
// Ce contrôle refuse donc toute pièce que le catalogue ne connaît pas.
const { readFileSync } = await import("node:fs");
const catalogue = readFileSync(join(RACINE, "appli", "arrosage-catalogue.js"), "utf8");
/**
 * Le libellé doit être EXACTEMENT un nom du catalogue.
 *
 * **La première version acceptait une simple inclusion, et elle ne prouvait
 * rien.** Le catalogue porte une entrée générique nommée « Turbine » : dès
 * lors, « Turbine portée 5 m · 0,30 m³/h » — l'invention même qu'on cherche à
 * bannir — la contenait et passait au vert. Éprouvé, et c'est ainsi que le trou
 * a été trouvé.
 *
 * On compare donc à l'identique, après avoir normalisé les espaces et la casse.
 * Le libellé peut porter un complément après un tiret cadratin (« Coude SBE 050
 * — 16 x 1/2" coudé ») : on essaie alors la partie qui précède, qui doit elle
 * aussi être un nom entier.
 */
const normaliser = (t) =>
  t.toLowerCase().replace(/\s+/g, " ").replace(/[×x]/g, "x").trim();
const nomsCatalogue = new Set(
  [...catalogue.matchAll(/nom:'([^']+)'/g)].map((m) => normaliser(m[1]))
);
const connu = (libelle) => {
  const l = normaliser(libelle);
  if (nomsCatalogue.has(l)) return true;
  const avantTiret = normaliser(l.split("—")[0]);
  return avantTiret.length > 0 && nomsCatalogue.has(avantTiret);
};
// Les longueurs à relever ne sont pas des références : elles portent leur
// propre repère, et n'ont rien à chercher dans le catalogue.
const inventees = await page.evaluate(() =>
  [...document.querySelectorAll('#plan .piece:not([data-atlas="a-mesurer"])')]
    .map((p) => (p.childNodes[1]?.textContent ?? "").trim())
    .filter((t) => t.length > 0)
);
const hors = inventees.filter((t) => !connu(t));
dire(
  hors.length === 0,
  `chaque pièce vient du catalogue${hors.length ? ` — inconnues : ${hors.join(" ; ")}` : ` (${inventees.length} lignes)`}`,
);

// Et la page doit DIRE d'où viennent ses références, sans quoi il ne peut pas
// distinguer ce qui est relevé chez lui de ce qui reste provisoire.
dire(
  /provisoire/i.test(await page.locator("#plan").innerText()),
  "la page signale ce qui est encore provisoire — la règle du catalogue",
);

// ── 5 ter. Le plan ne chiffre pas ce que la liste dit ignorer ──────────────
//
// Vu à la capture : le plan portait « amenée 18 m » tandis que la liste
// répondait « à mesurer » pour cette même amenée. Les deux ne peuvent pas être
// vrais, et c'est le chiffre du plan qu'on recopie sur un devis.
const aMesurer = await page.evaluate(() =>
  [...document.querySelectorAll('#plan .piece[data-atlas="a-mesurer"]')]
    .map((p) => (p.childNodes[1]?.textContent ?? "").trim())
);
const surLePlan = await page.evaluate(() =>
  [...document.querySelectorAll("#plan svg text")].map((t) => (t.textContent ?? "").trim())
);
const contradictions = aMesurer
  .filter((quoi) => /compteur|amenée/i.test(quoi))
  .flatMap(() => surLePlan.filter((t) => /amenée/i.test(t) && /\d+\s*m\b/.test(t)));
dire(
  contradictions.length === 0,
  `le plan chiffre une longueur que la liste dit ignorer${contradictions.length ? ` — « ${contradictions.join(" ; ")} »` : ""}`,
);

// ── 6. La page dit qu'elle ne LIT pas la photo ──────────────────────────────
const toute = (await page.locator("body").innerText()).toLowerCase();
// **CE CONTRÔLE A CHANGÉ DE SENS LE 20 AOÛT AU SOIR.** Il exigeait que la page
// avoue qu'Atlas « ne sait pas lire une photo ». Le patron a rappelé que l'IA
// est là — et il avait raison : `src/server/ai/services/lire-ticket.ts` fait
// déjà lire un ticket photographié. L'aveu était devenu le mensonge.
//
// Ce que le contrôle garde, c'est la même chose sous un autre angle : la page ne
// doit pas laisser croire que CETTE page-ci lit quoi que ce soit. Le plan qu'elle
// montre est un exemple dessiné.
dire(
  /exemple dessiné/.test(toute) && !/ne sait pas (encore )?lire/.test(toute),
  "la page doit dire que son plan est un exemple dessiné, sans prétendre qu'Atlas ne sait pas lire une image",
);

// ── 7. Rien ne déborde, aucun lien mort, rien de trop petit ─────────────────
for (const cible of ECRANS) {
  await page.goto(`file://${CIBLE}${cible === "#depart" ? "" : cible}`, { waitUntil: "load" });
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  const vue = await page.evaluate(() => window.innerWidth);
  dire(large <= vue + 1, `${cible} ne déborde pas à droite (${large} px pour ${vue})`);

  const petits = await page.evaluate(() =>
    [...document.querySelectorAll("a")]
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return !(r.width === 0 && r.height === 0) && r.height < 28;
      })
      .map((a) => `${(a.textContent || "").trim().slice(0, 30)} — ${Math.round(a.getBoundingClientRect().height)} px`)
  );
  dire(petits.length === 0, `${cible} : tous les liens font 28 px au moins${petits.length ? ` — ${petits.join(" ; ")}` : ""}`);
}

await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
const liens = await page.evaluate(() =>
  [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))
);
const morts = [];
for (const href of [...new Set(liens)]) {
  if (!href.startsWith("#")) continue;
  if ((await page.locator(href).count()) === 0) morts.push(`${href} — aucune ancre de ce nom`);
}
dire(morts.length === 0, `aucun lien ne tombe dans le vide${morts.length ? ` — ${morts.join(" ; ")}` : ` (${liens.length} liens)`}`);

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ L'arrosage en deux gestes tombe juste."
    : `\n❌ ${plaintes.length} défaut(s).`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
