// Les sept chartes de couleurs — et surtout : que RIEN ne bouge par défaut.
//
// **LE CONTRÔLE QUI PORTE TOUT LE LOT.** Les couleurs de l'application passent
// désormais par des variables CSS, pour que les sept chartes du patron puissent
// les changer. La promesse faite avec ce changement est qu'il n'a **aucun effet
// visible tant que personne n'a choisi** : la charte `origine` doit reprendre,
// au caractère près, ce que `design-tokens.ts` portait en clair — et le repli
// de chaque jeton doit être cette même valeur.
//
// Sans ces contrôles, une seule valeur recopiée de travers repeindrait
// l'application entière, et personne ne le verrait avant une capture.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHARTES, CHARTE_PAR_DEFAUT, charte, normaliserCharte, variablesCss } from "../src/lib/chartes";
import { colors } from "../src/lib/design-tokens";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les sept chartes, et l'application qui ne bouge pas ===\n");

/** Ce que `design-tokens.ts` portait en clair avant ce lot. Recopié ici. */
const AVANT_LE_LOT: Record<string, string> = {
  cream: "#f5f3ee",
  card: "#faf9f5",
  ink: "#1c1c1a",
  inkSoft: "#4a4a44",
  muted: "#8a8578",
  rust: "#2f3b2f",
  rustDeep: "#4f5f4c",
  rustTint: "#ece9e1",
  or: "#B98B47",
  orClair: "#C9A15E",
  line: "rgba(28,28,26,0.12)",
  lineSoft: "rgba(28,28,26,0.07)",
  chevron: "rgba(28,28,26,0.28)",
};

essai("les sept chartes sont là, dans l'ordre qu'il a donné", () => {
  assert.deepEqual(
    CHARTES.map((c) => c.nom),
    ["origine", "pierre", "beurre", "moka", "prune", "sylve", "nuit"]
  );
});

essai("« origine » est le défaut, et c'est la première", () => {
  assert.equal(CHARTE_PAR_DEFAUT, "origine");
  assert.equal(CHARTES[0].nom, "origine");
});

// **LE CONTRÔLE CENTRAL.** Une valeur qui s'écarterait repeindrait
// l'application sans que personne ne l'ait demandé.
essai("« origine » reprend EXACTEMENT les couleurs d'avant ce lot", () => {
  const o = charte("origine").jetons as unknown as Record<string, string>;
  for (const [cle, attendue] of Object.entries(AVANT_LE_LOT)) {
    assert.equal(o[cle], attendue, `${cle} : « ${o[cle]} » au lieu de « ${attendue} »`);
  }
});

// Et le REPLI de chaque jeton doit être cette même valeur : un écran rendu hors
// du gabarit — qui ne pose donc aucune variable — doit rester identique.
essai("et le repli de chaque jeton est cette même valeur", () => {
  const source = readFileSync("src/lib/design-tokens.ts", "utf8");
  for (const [cle, attendue] of Object.entries(AVANT_LE_LOT)) {
    const trouve = source.match(new RegExp(`\\b${cle}:\\s*"([^"]+)"`));
    assert.ok(trouve, `le jeton ${cle} a disparu de design-tokens.ts`);
    const repli = trouve[1].match(/^var\(\s*--atlas-[\w-]+\s*,\s*(.+)\)$/);
    assert.ok(repli, `${cle} ne passe pas par une variable : « ${trouve[1]} »`);
    assert.equal(repli[1].trim(), attendue, `repli de ${cle}`);
  }
});

essai("chaque jeton employé par l'application EST une variable", () => {
  for (const cle of Object.keys(AVANT_LE_LOT)) {
    const valeur = (colors as unknown as Record<string, string>)[cle];
    assert.match(valeur, /^var\(--atlas-/, `${cle} vaut « ${valeur} »`);
  }
});

console.log("");

// **Le compte n'est plus écrit ici, et c'est délibéré.** Il valait « treize »,
// et le lot du 22 août 2026 en a ajouté trois — alerte, bordeaux, vert pâle,
// qui devaient suivre la charte pour rester lisibles sur Nuit et Sylve
// (`ARCHITECTURE.md` §148). La suite a rougi sur du code juste, pour un chiffre
// qui ne défendait rien : ce qu'elle doit fixer, c'est qu'**aucune charte ne
// porte moins de jetons qu'une autre** — un jeton oublié sur une seule des sept
// laisse un écran à demi repeint, et c'est ce défaut-là qui coûte cher.
const JETONS_ATTENDUS = Object.keys(charte("origine").jetons).sort();

essai("les sept chartes portent les mêmes jetons, aucun vide", () => {
  for (const c of CHARTES) {
    const cles = Object.keys(c.jetons);
    assert.deepEqual(
      [...cles].sort(),
      JETONS_ATTENDUS,
      `${c.nom} ne porte pas les mêmes jetons qu'origine`
    );
    for (const cle of cles) {
      const v = (c.jetons as unknown as Record<string, string>)[cle];
      assert.match(v, /^(#[0-9a-fA-F]{6}|rgba\()/, `${c.nom}.${cle} vaut « ${v} »`);
    }
  }
});

essai("deux chartes sont sombres, et ce sont les siennes", () => {
  assert.deepEqual(CHARTES.filter((c) => c.sombre).map((c) => c.nom), ["sylve", "nuit"]);
});

// Une charte dont le fond et l'encre seraient proches serait illisible. Le
// contrôle ne juge pas du goût : il refuse ce qu'on ne peut pas lire.
essai("sur chaque charte, l'encre se détache du fond", () => {
  const clarte = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, v, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const c = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c(r) + 0.7152 * c(v) + 0.0722 * c(b);
  };
  for (const c of CHARTES) {
    const [a, b] = [clarte(c.jetons.cream), clarte(c.jetons.ink)];
    const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(contraste >= 7, `${c.nom} : contraste de ${contraste.toFixed(1)}, il en faut 7`);
  }
});

// **Une charte sombre doit avoir un fond sombre**, sans quoi le drapeau ment et
// l'écran des réglages annoncerait « Sombre » sur un écran clair.
essai("le drapeau « sombre » dit la vérité sur le fond", () => {
  const sombreVraiment = (hex: string) => {
    const n = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) / 3 < 96;
  };
  for (const c of CHARTES) {
    assert.equal(sombreVraiment(c.jetons.cream), c.sombre, `${c.nom} : fond ${c.jetons.cream}`);
  }
});

console.log("");

essai("un nom inconnu retombe sur l'origine, sans lever", () => {
  assert.equal(charte("n-importe-quoi").nom, "origine");
  assert.equal(charte(null).nom, "origine");
  assert.equal(charte(undefined).nom, "origine");
});

essai("et il ne s'écrit pas en base : il devient nul", () => {
  assert.equal(normaliserCharte("n-importe-quoi"), null);
  assert.equal(normaliserCharte(""), null);
  assert.equal(normaliserCharte("nuit"), "nuit");
});

essai("les variables CSS portent le nom du jeton, pas celui de la planche", () => {
  const css = variablesCss(charte("nuit"));
  assert.match(css, /--atlas-cream:#101210/);
  assert.match(css, /--atlas-rust:/);
  assert.ok(!css.includes("--atlas-fond"), "le vocabulaire de la planche a fui dans les variables");
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Les chartes — 0 échec(s).");
