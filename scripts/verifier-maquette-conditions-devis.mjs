#!/usr/bin/env node
/*
  Éprouve la maquette 60, JAVASCRIPT COUPÉ.

  **Ce qu'elle sert à trancher :** six conditions se règlent dans Réglages →
  Devis & factures, et une seule arrive sur le document. Le patron l'a vu le
  16 août 2026 — *« lorsque l'on coche le bouton on/off pour les formalités de
  devis, rien n'apparaît sur le devis, c'est normal ? »* — puis : *« Oui
  répare »*. La planche montre trois façons de faire arriver les cinq autres,
  face à un champ « Notes / conditions » qu'il peut déjà avoir rempli.

  Les contrôles, et chacun tient une promesse de la planche :

    1. les trois arrangements existent SANS SCRIPT, et un seul s'affiche à la
       fois. Deux visibles ensemble ne se comparent plus, ils s'additionnent ;
    2. **A perd bien le texte libre**, et c'est tout le point noir de A. Si le
       texte y survivait, la légende mentirait sur ce que ça coûte — et il
       choisirait A en croyant ne rien perdre ;
    3. **B pose son filet ENTRE les deux**, mesuré en pixels : c'est ce qui
       distingue B de A. Un filet placé ailleurs, ou absent, et B redevient une
       bouillie où l'on ne sait plus qui a écrit quoi ;
    4. **C porte deux intertitres**, « Notes » et « Conditions ». Sans le
       second, C n'est plus que B avec un blanc de plus ;
    5. **l'acompte n'est jamais écrit deux fois** sur une même feuille. C'est le
       risque réel de la réparation, et une planche qui le montrerait par
       accident lui ferait choisir contre un défaut imaginaire ;
    6. **les cinq conditions sont là dans les trois arrangements.** En montrer
       quatre ferait choisir sur un devis plus court que le vrai ;
    7. **le texte des conditions vient du DÉPÔT**, pas de mon clavier :
       `lignesConditionsDevis` (`src/lib/conditions-documents.ts`) écrit déjà ces
       phrases pour l'aperçu des réglages. Une planche qui les reformulerait
       ferait choisir sur des mots qui n'existent nulle part.

  **Il sait échouer, et il nomme le défaut plutôt que le sélecteur.** Retirer le
  filet de B rend le 3 rouge en disant que le filet manque ; ôter le second
  intertitre rend le 4 rouge en citant ce qui a été trouvé. Aucun contrôle ne
  mesure une boîte sans avoir d'abord compté les éléments : une mesure sur du
  vide rend 0, et « 0 − 0 = 0 » passe au vert en ne prouvant rien
  (`CLAUDE.md` §5, payé le 15 août 2026).

  Usage : node scripts/verifier-maquette-conditions-devis.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "60-les-conditions-sur-le-devis.html"),
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

/**
 * La boîte d'un élément, ou `null` s'il n'y en a aucun — SANS attendre.
 *
 * **Pourquoi ce détour plutôt que `boundingBox()` directement.** Sur un élément
 * absent, Playwright attend trente secondes puis lève un « Timeout exceeded »
 * qui nomme le sélecteur : une trace qui envoie lire le contrôle au lieu de la
 * planche, et qui surtout ARRÊTE TOUT — les contrôles suivants ne sont jamais
 * joués. Vu à la dégradation, le 16 août 2026, avant de faire confiance à ce
 * fichier.
 */
async function boite(page, selecteur) {
  if ((await page.locator(selecteur).count()) === 0) return null;
  return page.locator(selecteur).first().boundingBox();
}

/**
 * Les phrases que le produit écrit RÉELLEMENT, lues dans le dépôt.
 *
 * Recopiées ici, elles auraient dérivé du jour où `lignesConditionsDevis`
 * change — et le contrôle aurait alors défendu une rédaction morte contre la
 * vraie. Introuvable, il le DIT : un contrôle qui s'éteint tout seul est pire
 * que pas de contrôle.
 */
function morceauxDuProduit() {
  const source = join(RACINE, "src", "lib", "conditions-documents.ts");
  if (!existsSync(source)) return null;
  const texte = readFileSync(source, "utf8");
  const acompte = /Acompte de \$\{c\.acomptePourcent\} % à la commande/.test(texte);
  const delai = /Paiement à \$\{c\.delaiPaiementJours\} jours à compter de la facture/.test(texte);
  const moyens = /Moyens de paiement acceptés/.test(texte);
  const penalites = /indemnité forfaitaire de 40 € pour frais de recouvrement/.test(texte);
  if (!acompte || !delai || !moyens || !penalites) return null;
  return [
    "Acompte de 30 % à la commande",
    "Paiement à 30 jours à compter de la facture",
    "Moyens de paiement acceptés",
    "indemnité forfaitaire de 40 € pour frais de recouvrement",
  ];
}

const ARRANGEMENTS = [
  { radio: "v-a", nom: "A · Elles s’écrivent seules", panneau: ".a-seul" },
  { radio: "v-b", nom: "B · Les vôtres d’abord", panneau: ".a-dessus" },
  { radio: "v-c", nom: "C · Deux blocs séparés", panneau: ".a-fusion" },
];

const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1000 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 60 tient-elle ce qu'elle montre ? ===\n");

// ── 1. Les trois arrangements, un seul à la fois ────────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const visibles = [];
  for (const autre of ARRANGEMENTS) {
    if ((await page.locator(`${autre.panneau}:visible`).count()) > 0) visibles.push(autre.radio);
  }
  dire(
    visibles.length === 1 && visibles[0] === a.radio,
    `${a.nom} s'affiche seul (vus : ${visibles.join(", ") || "aucun"})`,
  );
}

// ── 2. A perd le texte libre — c'est ce qu'il doit coûter ───────────────────
await page.click('label[for="v-a"]');
dire(
  (await page.locator(".a-seul .libre").count()) === 0,
  "A remplace le bloc de notes : aucun texte libre n'y survit",
);

// ── 3. B pose son filet ENTRE les deux ──────────────────────────────────────
await page.click('label[for="v-b"]');
const libre = await boite(page, ".a-dessus .libre");
const filet = await boite(page, ".a-dessus .separation");
const liste = await boite(page, ".a-dessus .cond");
if (!libre || !liste) {
  dire(false, "B n'a plus ses deux morceaux : le texte libre ou la liste des conditions manque");
} else if (!libre.height || !liste.height) {
  // Refuser de conclure sur une boîte de zéro pixel — la règle du 15 août 2026.
  dire(false, `B se mesure sur du vide (texte ${libre.height} px, liste ${liste.height} px)`);
} else if (!filet) {
  dire(false, "B n'a plus de filet : rien ne sépare plus son texte des conditions");
} else {
  const basDuTexte = libre.y + libre.height;
  dire(
    filet.y >= basDuTexte - 1 && filet.y <= liste.y,
    `B sépare son texte des conditions (texte finit à ${Math.round(basDuTexte)}, ` +
      `filet à ${Math.round(filet.y)}, conditions à ${Math.round(liste.y)})`,
  );
}

// ── 4. C porte DEUX intertitres, et ce sont les bons mots ───────────────────
await page.click('label[for="v-c"]');
const titres = await page.locator(".a-fusion .etiq").allInnerTexts();
dire(
  titres.length === 2 && /^notes$/i.test(titres[0].trim()) && /^conditions$/i.test(titres[1].trim()),
  `C porte « Notes » puis « Conditions » (trouvé : ${JSON.stringify(titres)})`,
);

// ── 5 et 6. L'acompte une seule fois, les cinq conditions partout ───────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const feuille = await page.locator(".feuille").innerText();
  const fois = (feuille.match(/Acompte de 30 %/g) ?? []).length;
  dire(fois === 1, `${a.radio} n'écrit l'acompte qu'une fois sur la feuille (${fois})`);

  const combien = await page.locator(`${a.panneau} .cond li`).count();
  dire(combien === 5, `${a.radio} montre les cinq conditions réglables (${combien})`);
}

// ── 7. Les phrases viennent du produit, pas de mon clavier ──────────────────
const morceaux = morceauxDuProduit();
if (morceaux === null) {
  dire(false, "src/lib/conditions-documents.ts est introuvable ou a changé de rédaction : ce contrôle ne peut plus rien affirmer");
} else {
  await page.click('label[for="v-a"]');
  const feuille = await page.locator(".feuille").innerText();
  const absents = morceaux.filter((m) => !feuille.includes(m));
  dire(
    absents.length === 0,
    `les phrases sont celles de lignesConditionsDevis${absents.length ? ` — manquent : ${absents.join(" / ")}` : ""}`,
  );
}

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La maquette 60 tient ce qu'elle montre."
    : `\n❌ ${plaintes.length} défaut(s) sur la maquette 60.`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
