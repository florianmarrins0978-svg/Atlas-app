// LA PLANCHE « La feuille qui envoie » NE DOIT PAS MENTIR.
//
// Elle avance des chiffres — « les deux fonds à 1,05 sur Nuit », « le gris tient
// 2,85 » — et elle recopie les couleurs des chartes dans ses propres variables
// CSS. Les deux peuvent vieillir sans que personne le voie : un jeton retouché
// dans `src/lib/chartes.ts`, et la planche continue d'affirmer une mesure qui
// n'est plus vraie. C'est exactement le défaut que `CLAUDE.md` §4 bis nomme pour
// les maquettes d'arrosage — un libellé recopié qui diverge de sa source.
//
// Ce contrôle recalcule tout depuis `chartes.ts` et refuse le moindre écart.
//
//   npx tsx scripts/verifier-maquette-feuille-qui-envoie.mts
//
// **Il sait échouer**, et il a été vu rouge : contre un `--gris` retapé à la
// main dans la planche, contre le chiffre « 1,05 » laissé après un changement
// de `rustTint`, et contre une flèche décorative ajoutée en fin de libellé.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { CHARTES, charte, contraste, type NomCharte } from "../src/lib/chartes";

const PLANCHE = "appli/la-feuille-qui-envoie.html";
const html = readFileSync(PLANCHE, "utf8");
const ennuis: string[] = [];

/** Les variables que la planche déclare pour une charte donnée. */
function variablesDeclarees(nom: NomCharte): Map<string, string> {
  const bloc = html.match(new RegExp(`\\[data-charte="${nom}"\\]\\{([^}]*)\\}`));
  assert.ok(bloc, `la planche ne déclare aucun bloc pour la charte « ${nom} »`);
  const trouvees = new Map<string, string>();
  for (const [, cle, valeur] of bloc[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    trouvees.set(cle, valeur.trim());
  }
  return trouvees;
}

// ─── 1. Les couleurs sont celles des chartes, au caractère près ─────────────
//
// La planche parle de deux chartes seulement — Origine et Nuit — parce que ce
// sont les deux pôles. Les six autres se déduisent ; celles-là se montrent.
const CORRESPONDANCE: Record<string, string> = {
  fond: "cream",
  plage: "card",
  encre: "ink",
  "encre-douce": "inkSoft",
  gris: "muted",
  accent: "rust",
  papier: "rustTint",
  or: "or",
  trait: "line",
  "trait-doux": "lineSoft",
  alerte: "alerte",
  bordeaux: "bordeaux",
};

for (const nom of ["origine", "nuit"] as const) {
  const jetons = charte(nom).jetons as unknown as Record<string, string>;
  const declarees = variablesDeclarees(nom);
  for (const [variable, jeton] of Object.entries(CORRESPONDANCE)) {
    const attendue = jetons[jeton];
    const posee = declarees.get(variable);
    if (!posee) {
      ennuis.push(`${nom} : la planche ne pose pas --${variable}`);
      continue;
    }
    // `rgba(28,28,26,0.12)` s'écrit `rgba(28,28,26,.12)` en CSS abrégé : on
    // compare sur une forme normalisée plutôt que d'interdire l'abréviation.
    const nu = (v: string) => v.replace(/\s+/g, "").replace(/0\./g, ".").toLowerCase();
    if (nu(posee) !== nu(attendue)) {
      ennuis.push(`${nom} : --${variable} vaut « ${posee} », le jeton ${jeton} vaut « ${attendue} »`);
    }
  }
}

// ─── 2. Les chiffres avancés sont ceux qu'on mesure ─────────────────────────

/** L'écart entre les deux fonds de capsule — le cœur du point 1. */
const ecart = (nom: NomCharte) => {
  const j = charte(nom).jetons;
  return contraste(j.rustTint, j.card);
};

const ecartNuit = ecart("nuit");
const ecartOrigine = ecart("origine");
const virgule = (n: number) => n.toFixed(2).replace(".", ",");

assert.ok(
  html.includes(virgule(ecartNuit)),
  `la planche annonce un écart sur Nuit qui n'est plus le bon : mesuré ${virgule(ecartNuit)}`
);
assert.ok(
  html.includes(virgule(ecartOrigine)),
  `la planche annonce un écart sur Origine qui n'est plus le bon : mesuré ${virgule(ecartOrigine)}`
);

// **Le point 1 ne tient que si les deux capsules sont vraiment indiscernables.**
// Si un jour `rustTint` et `card` s'écartent sur Nuit, la planche accuse à tort.
if (ecartNuit > 1.3) {
  ennuis.push(
    `sur Nuit, les deux fonds de capsule tiennent désormais ${virgule(ecartNuit)} : ` +
      `le point 1 de la planche n'est plus vrai tel qu'il est écrit`
  );
}

// Et la couleur du texte : c'est elle qui rendait les capsules IDENTIQUES.
for (const nom of ["nuit", "sylve"] as const) {
  const j = charte(nom).jetons;
  if (j.rust !== j.ink) {
    ennuis.push(
      `sur ${nom}, l'accent (${j.rust}) et l'encre (${j.ink}) ont cessé d'être la même ` +
        `couleur : la planche affirme le contraire`
    );
  }
}

// ─── 3. Le gris porteur de sens, sur les chartes claires ────────────────────
//
// La planche avance une fourchette. On la recalcule plutôt que de la croire.
const clairesEnDefaut = CHARTES.filter((c) => contraste(c.jetons.muted, c.jetons.cream) < 4.5).map(
  (c) => contraste(c.jetons.muted, c.jetons.cream)
);
assert.ok(
  clairesEnDefaut.length > 0,
  "plus aucune charte ne met le gris sous 4,5 : le point 4 de la planche est périmé"
);
const bas = virgule(Math.min(...clairesEnDefaut));
const haut = virgule(Math.max(...clairesEnDefaut));
assert.ok(html.includes(bas), `la planche n'annonce plus le plus mauvais gris mesuré (${bas})`);
assert.ok(html.includes(haut), `la planche n'annonce plus le meilleur gris en défaut (${haut})`);

// ─── 4. Aucune flèche décorative en fin de libellé ──────────────────────────
//
// La règle vaut pour les écrans ET les maquettes (`CLAUDE.md` §3). Le chevron
// « ▾ » de la molette de durée en est exempt : il dit qu'une liste s'ouvre,
// c'est la fonction même du témoin d'un `<select>`.
for (const [, libelle] of html.matchAll(/>([^<>]{2,60}?)\s*(?:→|›|»\s*)<\//g)) {
  if (libelle.includes("«")) continue; // une citation, pas un libellé
  ennuis.push(`flèche décorative en fin de libellé : « ${libelle.trim()} »`);
}

// ─── 5. La planche montre les deux côtés de chaque point ────────────────────
const aujourdhui = (html.match(/AUJOURD'HUI|Aujourd'hui/gi) ?? []).length;
assert.ok(
  aujourdhui >= 5,
  `la planche ne montre plus l'état ACTUEL en regard de chaque proposition (${aujourdhui} repères)`
);

if (ennuis.length > 0) {
  console.error(`❌ ${PLANCHE}`);
  for (const e of ennuis) console.error(`   · ${e}`);
  process.exit(1);
}
console.log(
  `✅ ${PLANCHE} — couleurs conformes aux chartes, ` +
    `écarts ${virgule(ecartOrigine)} / ${virgule(ecartNuit)}, gris ${bas} à ${haut}`
);
