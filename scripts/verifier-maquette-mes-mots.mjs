#!/usr/bin/env node
/*
  Éprouve la maquette 72, JAVASCRIPT COUPÉ.

  **D'où elle vient.** Le patron, le 17 août 2026, capture de l'écran
  « Catalogue » à l'appui : *« À quoi sert cette page ?? On peut rien modifier
  rajouter »*. C'est la seconde fois — la première, le 14 août, avait produit
  `docs/QUESTIONS.md` §18 et deux défauts inscrits dans `TODO.md`
  §0 octovicies bis, jamais touchés depuis. Sa réponse cette fois :
  **« Réparer + mes mots »**.

  **CE QUE CE CONTRÔLE SURVEILLE EN PREMIER, ce sont les deux défauts qu'il a
  vus lui-même.** Une planche qui propose trois façons d'ajouter ses mots mais
  qui oublie la flèche de retour, ou qui laisse traîner la phrase morte
  « Aucun prix encore constaté », lui referait découvrir la même chose une
  troisième fois.

  Les autres contrôles :

    1. les trois arrangements existent SANS SCRIPT, un seul à la fois ;
    2. **la flèche de retour est dans les TROIS** — c'est le défaut du 14 août,
       et il ne dépend d'aucun arrangement ;
    3. **la phrase morte a disparu, et aucun prix ne la remplace.** L'écran lisait
       une mémoire que l'application n'écrit nulle part ; remettre un montant
       sans savoir d'où il sort serait pire (la note du bas pose la question) ;
    4. **le geste d'ajout existe dans les trois.** C'est sa demande, mot pour
       mot : un arrangement qui ne l'offre pas ne répond pas ;
    5. **A et B disent QUI a écrit le mot, C non — et sa légende doit l'avouer.**
       C'est tout l'écart entre les trois : sans la marque, il croit corriger un
       vocabulaire commun qui le refusera au moment du geste ;
    6. **B accroche ses mots DANS une carte commune.** Si son « écimage » vivait
       dans une carte à part, B ne serait qu'un A mal rangé — et la dictée
       créerait une prestation neuve au lieu de reconnaître l'élagage ;
    7. **chaque légende dit ce que ça coûte ET ce que ça ne fait pas** ;
    8. **plus de jargon** : « Synonymes » et « Variantes » disaient la même
       chose sur sa capture ;
    9. rien ne déborde à 390 px — et **on refuse de conclure sur une boîte de
       zéro pixel** (`CLAUDE.md` §5, payé le 15 août : une mesure impossible
       n'est pas un succès).

  **Il sait échouer, et il nomme le défaut.** Éprouvé sur quatre copies
  dégradées : flèche retirée → le 2 rouge ; phrase morte remise → le 3 ;
  bouton d'ajout retiré → le 4 ; marque dorée retirée de B → le 5.

  Usage : node scripts/verifier-maquette-mes-mots.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "72-mes-mots-au-catalogue.html"),
);

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

const ARRANGEMENTS = [
  { radio: "v-a", nom: "A · Mes mots à part", panneau: ".a-part", legende: ".l-a", marque: true },
  { radio: "v-b", nom: "B · Mes mots par-dessus", panneau: ".a-dessus", legende: ".l-b", marque: true },
  { radio: "v-c", nom: "C · Une seule liste", panneau: ".a-melange", legende: ".l-c", marque: false },
];

const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1200 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
// `networkidle` et non `domcontentloaded` : sans la feuille de style appliquée,
// les boîtes valent zéro et toute mesure de largeur rendrait un vert creux.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 72 répond-elle à sa demande ? ===\n");

// ── 1. Un arrangement à la fois, sans script ────────────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const vus = [];
  for (const autre of ARRANGEMENTS) {
    if ((await page.locator(`${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(vus.length === 1 && vus[0] === a.radio, `${a.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`);
}

// ── 2. La flèche de retour, dans les trois ──────────────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const fleche = page.locator(`${a.panneau} .entete .retour`);
  const boite = (await fleche.count()) > 0 ? await fleche.first().boundingBox() : null;
  dire(
    boite !== null && boite.width >= 24 && boite.height >= 24,
    `${a.radio} : la flèche de retour doit être là et prenable au pouce (vue : ${
      boite ? `${Math.round(boite.width)}×${Math.round(boite.height)}` : "aucune"
    })`,
  );
}

// ── 3. La phrase morte a disparu, et aucun prix ne la remplace ──────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const texte = await page.locator(a.panneau).innerText();
  dire(
    !/prix encore constat/i.test(texte),
    `${a.radio} : « Aucun prix encore constaté » ne doit plus être là — elle ne se serait jamais éteinte`,
  );
  dire(
    !/€/.test(texte),
    `${a.radio} : aucun montant sur cet écran tant qu'on ne sait pas d'où il sort (la note du bas pose la question)`,
  );
}

// ── 4. Le geste d'ajout, dans les trois — c'est sa demande ──────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const boutons = await page.locator(`${a.panneau} .ajouter`).allInnerTexts();
  dire(
    boutons.length > 0 && boutons.every((b) => /ajouter|nouvelle/i.test(b)),
    `${a.radio} : il faut pouvoir AJOUTER — c'est sa demande (vu : ${boutons.join(" / ") || "rien"})`,
  );
}

// ── 5. Qui a écrit le mot : A et B le disent, C ne le dit pas ───────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const marques = await page.locator(`${a.panneau} .mien`).count();
  if (a.marque) {
    dire(marques > 0, `${a.radio} : ses mots à lui doivent être reconnaissables (${marques} marqués)`);
  } else {
    dire(marques === 0, `${a.radio} : rien ne doit distinguer ses mots — c'est justement son défaut`);
    const legende = await page.locator(a.legende).innerText();
    dire(
      /plus\s+ce qui est à vous|ne savez plus/i.test(legende),
      "la légende de C doit avouer qu'on ne sait plus ce qui est à soi — sinon il choisit à l'aveugle",
    );
  }
}

// ── 6. B accroche ses mots DANS une carte commune ───────────────────────────
await page.click('label[for="v-b"]');
{
  const cartes = page.locator(".a-dessus .carte");
  const total = await cartes.count();
  let melangees = 0;
  for (let i = 0; i < total; i += 1) {
    const carte = cartes.nth(i);
    const aLuiDedans = (await carte.locator(".mien").count()) > 0;
    // Le nom de la carte reste celui d'Atlas : c'est ce qui prouve que le mot
    // s'accroche au vocabulaire commun au lieu de vivre à côté.
    const nomCommun = (await carte.locator(".nom.mien").count()) === 0;
    if (aLuiDedans && nomCommun) melangees += 1;
  }
  dire(
    melangees >= 2,
    `B doit poser ses mots DANS les cartes d'Atlas, pas à côté (${melangees} carte(s) sur ${total})`,
  );
}

// A, lui, doit faire l'inverse : ses mots dans des cartes à lui, séparées.
await page.click('label[for="v-a"]');
{
  const aLui = await page.locator(".a-part .carte .nom.mien").count();
  dire(aLui >= 1, `A doit tenir une liste séparée, avec ses propres entrées (${aLui})`);
}

// ── 7. Chaque légende dit ce que ça coûte, et ce que ça ne fait pas ─────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const legende = await page.locator(a.legende).innerText();
  dire(
    legende.length > 150 && /coûte/i.test(legende),
    `${a.radio} : sa légende doit dire ce que ça coûte`,
  );
  dire(
    /ne fait (pas|toujours pas)|pas pour être choisi/i.test(legende),
    `${a.radio} : sa légende doit dire ce que ça NE fait PAS — c'est la moitié utile`,
  );
}

// ── 8. Plus de jargon : « synonymes », « variantes » ────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const texte = await page.locator(a.panneau).innerText();
  dire(
    !/synonyme|variante/i.test(texte),
    `${a.radio} : « Synonymes » et « Variantes » disaient la même chose — « Aussi appelé » les remplace`,
  );
}

// ── 9. Rien ne déborde à 390 px, et la mesure doit être possible ────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const ecran = await page.locator(`${a.panneau}`).boundingBox();
  dire(
    ecran !== null && ecran.width > 200 && ecran.height > 200,
    `${a.radio} : l'écran doit avoir une taille mesurable (vu : ${
      ecran ? `${Math.round(ecran.width)}×${Math.round(ecran.height)}` : "aucune boîte"
    })`,
  );
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  const vue = await page.evaluate(() => window.innerWidth);
  dire(large <= vue + 1, `${a.radio} ne déborde pas à droite (${large} pour ${vue})`);
}

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La maquette 72 répond, et les deux défauts du 14 août sont réparés."
    : `\n❌ ${plaintes.length} défaut(s) sur la maquette 72.`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
