#!/usr/bin/env node
/*
  Éprouve la maquette 61, JAVASCRIPT COUPÉ.

  **Ce qu'elle sert à trancher.** Le patron, le 16 août 2026 : *« pouvoir lui
  demander "fais cinq pour cent sur le montant du devis" et il ajoute une petite
  ligne réduction ou prix accordé au client »*. Trois endroits possibles sur le
  document, deux mots possibles.

  **LE CONTRÔLE QUI COMPTE VRAIMENT EST L'ARITHMÉTIQUE.** Une maquette de devis
  dont les totaux ne tombent pas juste apprend à douter des totaux du vrai — et
  pire, elle ferait choisir un arrangement sur des chiffres faux. Les trois
  arrangements montrent le MÊME devis : 870,00 € HT, 5 % de réduction, donc
  43,50 € retirés, 826,50 € HT, 165,30 € de TVA à 20 %, 991,80 € TTC. Chacun de
  ces nombres est recalculé ici, à partir des lignes lues à l'écran — jamais
  recopié depuis la planche, sans quoi le contrôle et la planche se
  tromperaient ensemble.

  Les autres contrôles :

    1. les trois arrangements existent SANS SCRIPT, un seul à la fois ;
    2. **le mot suit le second réglage**, et il n'y en a qu'un d'affiché.
       « Réduction » et « Prix accordé au client » côte à côte ne se comparent
       plus, ils s'additionnent ;
    3. **la TVA n'est JAMAIS calculée sur le prix plein.** C'est le seul défaut
       de cette planche qui coûterait de l'argent : 20 % de 870 font 174,00 € et
       non 165,30 €, et un devis parti avec cette TVA-là est une déclaration
       fausse. Le contrôle refuse le nombre du prix plein partout ;
    4. **A est bien une LIGNE du tableau**, pas un total déguisé — c'est ce qui
       distingue A de B, et c'est ce qui lui permet de voyager tout seul jusqu'à
       la facture ;
    5. la feuille du micro dit « un changement » et le montre : elle propose, il
       coche. Une planche qui l'appliquerait d'office contredirait le produit.

  **Il sait échouer, et il nomme le défaut plutôt que le sélecteur.** Changer
  826,50 en 830,00 rend le 3 rouge en donnant l'écart ; sortir la ligne de
  réduction du tableau rend le 4 rouge. Aucune boîte n'est mesurée sans avoir
  compté d'abord : une mesure sur du vide rend 0, et 0 passe au vert en ne
  prouvant rien (`CLAUDE.md` §5).

  Usage : node scripts/verifier-maquette-reduction.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "61-la-reduction-au-client.html"),
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

/** « 826,50 € » et « − 43,50 € » deviennent 826.5 et -43.5. */
const enNombre = (t) => {
  const signe = /[−-]/.test(t.trim()[0] ?? "") ? -1 : 1;
  const n = Number(t.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? signe * n : NaN;
};
const proche = (a, b) => Math.abs(a - b) < 0.005;

const ARRANGEMENTS = [
  { radio: "v-a", nom: "A · Une ligne du devis", panneau: ".a-ligne" },
  { radio: "v-b", nom: "B · Sous le total", panneau: ".a-bloc" },
  { radio: "v-c", nom: "C · Le prix barré", panneau: ".a-barre" },
];

// Les trois prestations du devis de démonstration, et le taux affiché.
const TAUX = 20;
const REDUCTION = 5;

const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1100 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 61 tombe-t-elle juste ? ===\n");

// ── Ce que les lignes de prestation valent, LUES à l'écran ──────────────────
const prixLignes = (await page.locator(".lg:not(.remise) .prix").allInnerTexts()).map(enNombre);
if (prixLignes.length === 0 || prixLignes.some((n) => !Number.isFinite(n))) {
  dire(false, `les prestations ne se lisent pas : ${JSON.stringify(prixLignes)}`);
} else {
  dire(true, `${prixLignes.length} prestations lues à l'écran`);
}
const plein = prixLignes.reduce((s, n) => s + n, 0);
const remise = (plein * REDUCTION) / 100;
const net = plein - remise;
const tva = (net * TAUX) / 100;
const ttc = net + tva;
const tvaSurPrixPlein = (plein * TAUX) / 100;
console.log(
  `    (recalculé : ${plein.toFixed(2)} − ${REDUCTION} % = ${net.toFixed(2)} HT, ` +
    `TVA ${tva.toFixed(2)}, TTC ${ttc.toFixed(2)})`,
);

// ── 1. Un arrangement à la fois ─────────────────────────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const vus = [];
  for (const autre of ARRANGEMENTS) {
    if ((await page.locator(`.totaux${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(vus.length === 1 && vus[0] === a.radio, `${a.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`);
}

// ── 2, 3 : les totaux tombent juste, et la TVA n'est jamais celle du prix plein
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const lignes = await page.locator(`.totaux${a.panneau} .tot`).allInnerTexts();
  if (lignes.length === 0) {
    dire(false, `${a.radio} n'a aucun total à lire`);
    continue;
  }
  const nombres = lignes.flatMap((l) => l.match(/[−-]?\s?[\d\s]+[,.]\d{2}/g) ?? []).map(enNombre);

  dire(
    nombres.some((n) => proche(n, net)),
    `${a.radio} porte le HT après réduction (${net.toFixed(2)} attendu, vus : ${nombres.join(" / ")})`,
  );
  dire(
    nombres.some((n) => proche(n, tva)),
    `${a.radio} porte la TVA calculée APRÈS réduction (${tva.toFixed(2)} attendu)`,
  );
  dire(
    nombres.some((n) => proche(n, ttc)),
    `${a.radio} porte le TTC (${ttc.toFixed(2)} attendu)`,
  );
  // Le seul défaut de cette planche qui coûterait de l'argent.
  dire(
    !nombres.some((n) => proche(n, tvaSurPrixPlein)),
    `${a.radio} ne montre nulle part la TVA du prix plein (${tvaSurPrixPlein.toFixed(2)} — ce serait une déclaration fausse)`,
  );
}

// ── 4. A est bien une LIGNE du tableau ──────────────────────────────────────
await page.click('label[for="v-a"]');
const ligneRemise = await page.locator(".lg.remise:visible").count();
dire(ligneRemise === 1, `A pose la réduction dans le tableau, comme une ligne (${ligneRemise})`);
if (ligneRemise === 1) {
  const montant = enNombre(await page.locator(".lg.remise:visible .prix").innerText());
  dire(
    proche(montant, -remise),
    `la ligne porte le montant retiré, en négatif (${(-remise).toFixed(2)} attendu, vu ${montant})`,
  );
}
for (const r of ["v-b", "v-c"]) {
  await page.click(`label[for="${r}"]`);
  dire(
    (await page.locator(".lg.remise:visible").count()) === 0,
    `${r} ne pose PAS de ligne dans le tableau — c'est ce qui le distingue de A`,
  );
}

// ── 5. Le mot suit le réglage, et il n'y en a qu'un ─────────────────────────
await page.click('label[for="v-a"]');
for (const [radio, mot, absent] of [
  ["m-1", "Réduction", "Prix accordé au client"],
  ["m-2", "Prix accordé au client", "Réduction"],
]) {
  await page.click(`label[for="${radio}"]`);
  const feuille = await page.locator(".feuille").innerText();
  dire(
    feuille.includes(mot) && !feuille.includes(absent),
    `« ${mot} » s'écrit seul sur la feuille${feuille.includes(absent) ? ` — « ${absent} » y est aussi` : ""}`,
  );
}

// ── 6. Le micro propose, il coche ───────────────────────────────────────────
const confirme = await page.locator(".confirme").innerText();
dire(
  /coch|✓/i.test(await page.locator(".confirme .coche").innerText().catch(() => "")) ||
    (await page.locator(".confirme .coche").count()) === 1,
  "la feuille du micro porte sa coche : elle propose, elle n'applique pas",
);
dire(
  confirme.includes("870,00 €") && confirme.includes("826,50 €"),
  "la feuille du micro dit le avant et le après, en euros",
);

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La maquette 61 tombe juste."
    : `\n❌ ${plaintes.length} défaut(s) sur la maquette 61.`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
