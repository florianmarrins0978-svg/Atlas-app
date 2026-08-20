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
  titres: [...document.querySelectorAll("#depart .bloc h2")].map((h) => (h.textContent ?? "").trim()),
}));
dire(
  saisies.selects.length === 1 && saisies.selects[0] === "piquage",
  `un seul menu déroulant sur l'écran d'entrée, celui du piquage (lus : ${saisies.selects.join(", ") || "aucun"})`,
);
dire(
  saisies.autres.length === 0,
  `aucun champ à remplir avant le plan${saisies.autres.length ? ` — ${saisies.autres.join(", ")}` : ""}`,
);
dire(
  saisies.titres.length === 2,
  `deux blocs seulement, et il en a demandé deux (lus : ${saisies.titres.join(" | ")})`,
);

// **Le déroulant s'ouvre pour de vrai**, sans script — c'est ce qu'il a demandé
// de garder. Un faux menu dessiné en CSS ne s'ouvrirait pas au doigt.
const options = await page.locator("#depart select#piquage option").allInnerTexts();
dire(
  options.length >= 2 && /compteur/i.test(options[0]),
  `le menu du piquage porte ses choix (${options.length}) et commence par le compteur`,
);

// ── 3. Ce qui a été retiré n'est pas revenu ─────────────────────────────────
const texteDepart = (await page.locator("#depart").innerText()).toLowerCase();
for (const [mot, quoi] of [
  ["seau", "la mesure au seau"],
  ["pression", "la saisie de la pression"],
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
  const reseaux = [...document.querySelectorAll("#plan .reseau")].map((r) => ({
    titre: (r.querySelector(".tete b")?.textContent ?? "").trim(),
    lignes: [...r.querySelectorAll(".piece")].map((p) => ({
      nombre: (p.querySelector(".n")?.textContent ?? "").trim(),
      quoi: (p.childNodes[1]?.textContent ?? "").trim(),
      precision: (p.querySelector(".q")?.textContent ?? "").trim(),
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
  .filter((l) => /turbine/i.test(l.quoi))
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
  [...document.querySelectorAll("#plan .reseau .tete .pastille")].map(
    (p) => p.getAttribute("style")?.match(/background:\s*(#[0-9a-f]{6})/i)?.[1] ?? ""
  )
);
compte.reseaux.forEach((r, i) => {
  const turbines = r.lignes.filter((l) => /turbine/i.test(l.quoi)).reduce((s, l) => s + Number(l.nombre), 0);
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
const voies = Number(texteePlan.match(/Programmateur (\d+) voies/)?.[1] ?? 0);
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
}

// ── 6. La page dit qu'elle ne LIT pas la photo ──────────────────────────────
const toute = (await page.locator("body").innerText()).toLowerCase();
dire(
  /ne (sait pas encore )?lire|dessiné, pas lu|ne lit pas/.test(toute),
  "la page dit qu'elle ne lit pas encore le croquis — sans quoi elle promettrait une lecture qui n'existe pas",
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
