import assert from "node:assert/strict";
import {
  construireConsigneMetier,
  BUDGET_CARACTERES,
  MAX_EXEMPLES,
  type TermeMetier,
  type CorrectionApprise,
} from "../src/lib/consigne-metier";

// **« Comment je fais pour le nourrir et qu'il apprenne de ces erreurs ? »**
//   — le patron, le 7 août 2026, devant un devis qui avait tout mis sur une
//   ligne et perdu « on le coupe en 50, on le fend ».
//
// Ce que cette suite tient, et qui décide de la qualité de chaque devis :
//
//   1. **les règles passent avant les mots.** Une règle mal appliquée fausse un
//      prix ; un mot mal compris fausse un libellé. Si le budget doit sacrifier
//      quelque chose, que ce soit le moins cher ;
//   2. **rien n'est tronqué en silence.** Une consigne amputée sans le dire
//      laisserait croire que l'artisan a été entendu en entier — et c'est
//      précisément ce qu'il vient vérifier sur son écran ;
//   3. **le budget est tenu.** Cent définitions envoyées à chaque dictée, c'est
//      une consigne plus longue que ce qu'il a dit, et un modèle qui s'y noie.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const REGLE: TermeMetier = {
  nature: "regle",
  intitule: "Chaque ligne doit pouvoir se vendre seule",
  definition: "Une prestation détachable porte son propre déplacement.",
  consigne: "Alléger la principale, charger la détachable.",
};

const MOT: TermeMetier = {
  nature: "mot",
  intitule: "fendre en 50",
  definition: "Débiter le tronc en bûches de 50 cm et les fendre.",
  consigne: "C'est une prestation, pas de la gestion de déchets, même si le bois reste sur place.",
};

const CORRECTION: CorrectionApprise = {
  dictee: "Cèdre mort à abattre, on broie les branches, on évacue, le bois on le coupe en 50 et on le fend.",
  propose: [{ libelle: "Abattage ; broyage ; évacuation", montant: "1020.00" }],
  retenu: [
    { libelle: "Abattage, broyage, évacuation", montant: "850.00" },
    { libelle: "Fendre le bois en 50 cm", montant: "250.00" },
  ],
};

console.log("=== Ce qui part avec la dictée ===");

cas("le mot, sa définition ET ce qu'il faut en faire", () => {
  const c = construireConsigneMetier([MOT], []);
  assert.match(c.texte, /fendre en 50/, "Le terme manque.");
  assert.match(c.texte, /bûches de 50 cm/, "La définition manque.");
  assert.match(
    c.texte,
    /pas de la gestion de déchets/,
    "La consigne manque — c'est elle qui fait le travail : sans elle, le modèle comprend le mot et se trompe quand même de traitement."
  );
});

cas("un terme sans consigne reste utilisable", () => {
  const c = construireConsigneMetier([{ ...MOT, consigne: null }], []);
  assert.match(c.texte, /fendre en 50/);
  assert.doesNotMatch(c.texte, /→\s*$/m, "Une flèche pend dans le vide.");
});

cas("la correction montre l'écart, pas seulement le résultat", () => {
  const c = construireConsigneMetier([], [CORRECTION]);
  assert.match(c.texte, /Proposé\s*:/, "Ce qui avait été proposé manque : sans lui, l'exemple n'enseigne rien.");
  assert.match(c.texte, /850\.00/, "Le découpage retenu par le patron manque.");
  assert.match(c.texte, /250\.00/);
  assert.equal(c.exemplesRetenus, 1);
});

cas("rien à dire ne produit rien — pas un en-tête vide", () => {
  const c = construireConsigneMetier([], []);
  assert.equal(c.texte, "", `Une consigne vide a été fabriquée : « ${c.texte} »`);
  assert.equal(c.termesRetenus, 0);
  assert.deepEqual(c.ecartes, []);
});

console.log("\n=== L'ordre : ce qui coûte le plus cher passe en premier ===");

cas("les règles avant les mots", () => {
  const c = construireConsigneMetier([MOT, REGLE], []);
  const posRegle = c.texte.indexOf("RÈGLES");
  const posMots = c.texte.indexOf("VOCABULAIRE");
  assert.ok(posRegle >= 0 && posMots >= 0, "Un des deux blocs manque.");
  assert.ok(
    posRegle < posMots,
    "Le vocabulaire passe avant les règles : si le budget doit sacrifier quelque chose, ce sera la règle — donc le prix."
  );
});

cas("sous budget serré, c'est la règle qui survit", () => {
  // Le cas qui compte : un patron qui a saisi cinquante termes et deux règles.
  const beaucoupDeMots: TermeMetier[] = Array.from({ length: 50 }, (_, i) => ({
    nature: "mot",
    intitule: `terme numéro ${i}`,
    definition: "une définition raisonnablement longue pour occuper de la place dans le budget",
    consigne: "et une consigne qui va avec, elle aussi de longueur réaliste",
  }));
  const c = construireConsigneMetier([...beaucoupDeMots, REGLE], [], 400);
  assert.match(
    c.texte,
    /vendre seule/,
    "La règle a été écartée au profit de mots : c'est elle qui décide des prix."
  );
  assert.ok(c.ecartes.length > 0, "Des termes ont disparu sans que personne ne le sache.");
});

console.log("\n=== Ses corrections ont une place réservée ===");

// **Le défaut du 9 août 2026, mesuré et non supposé.** Vingt-quatre termes
// tirés de devis réels sont entrés dans le vocabulaire ; le compte a été fait
// juste après : quinze termes retenus sur vingt-six, et **zéro exemple sur
// cinq**. Les mots avaient mangé la place de ses corrections.
//
// Un vocabulaire est écrit une fois par l'éditeur, pour tous les artisans. Une
// correction est ce que CE patron a changé de sa main sur SON devis — *« je
// fais plein de devis et tu enregistres toutes mes modifications »*. Jeter les
// secondes pour faire tenir les premières travaille contre lui.

cas("un vocabulaire abondant ne chasse plus ses corrections", () => {
  const beaucoupDeMots: TermeMetier[] = Array.from({ length: 40 }, (_, i) => ({
    nature: "mot",
    intitule: `terme ${i}`,
    definition: "x".repeat(120),
    consigne: "y".repeat(60),
  }));
  const c = construireConsigneMetier([REGLE, ...beaucoupDeMots], [CORRECTION, CORRECTION, CORRECTION]);
  assert.ok(
    c.exemplesRetenus >= 1,
    `aucune de ses corrections n'est partie : les mots ont pris toute la place (${c.termesRetenus} termes retenus)`
  );
  assert.ok(c.texte.includes("CE QU'IL A CORRIGÉ"), "le bloc de ses corrections est absent de la consigne");
});

cas("la réserve revient aux mots quand il n'a rien corrigé", () => {
  // Un artisan qui débute n'a rien corrigé. Sa consigne n'a aucune raison
  // d'être plus courte que celle d'un autre : la réserve ne se prélève que
  // s'il y a quelque chose à réserver.
  const mots: TermeMetier[] = Array.from({ length: 40 }, (_, i) => ({
    nature: "mot",
    intitule: `terme ${i}`,
    definition: "x".repeat(120),
    consigne: "y".repeat(60),
  }));
  const avec = construireConsigneMetier([REGLE, ...mots], [CORRECTION]);
  const sans = construireConsigneMetier([REGLE, ...mots], []);
  assert.ok(
    sans.termesRetenus > avec.termesRetenus,
    "la réserve est prélevée même sans correction à y mettre : du vocabulaire est perdu pour rien"
  );
});

cas("le budget reste tenu, réserve comprise", () => {
  const mots: TermeMetier[] = Array.from({ length: 40 }, (_, i) => ({
    nature: "mot",
    intitule: `terme ${i}`,
    definition: "x".repeat(120),
    consigne: null,
  }));
  const c = construireConsigneMetier([REGLE, ...mots], Array(MAX_EXEMPLES).fill(CORRECTION));
  assert.ok(c.texte.length <= BUDGET_CARACTERES, `${c.texte.length} caractères pour un budget de ${BUDGET_CARACTERES}`);
});

console.log("\n=== Rien n'est tronqué en silence ===");

cas("ce qui ne tient pas est nommé", () => {
  const c = construireConsigneMetier([REGLE, MOT], [], 200);
  assert.ok(c.ecartes.length > 0, "Le budget a coupé sans rien dire.");
  assert.ok(
    c.ecartes.some((e) => /écarté/i.test(e)),
    `Les mentions d'écart ne disent pas ce qui a été écarté : ${JSON.stringify(c.ecartes)}`
  );
});

cas("au-delà de cinq corrections, les plus anciennes sont dites écartées", () => {
  const huit = Array.from({ length: 8 }, () => CORRECTION);
  const c = construireConsigneMetier([], huit);
  assert.equal(c.exemplesRetenus, MAX_EXEMPLES, "Plus d'exemples que prévu sont partis.");
  assert.ok(
    c.ecartes.some((e) => /plus ancienne/.test(e)),
    "Les corrections écartées ne sont pas signalées."
  );
});

console.log("\n=== Le budget est tenu ===");

cas("la consigne ne dépasse jamais le budget", () => {
  const beaucoup: TermeMetier[] = Array.from({ length: 200 }, (_, i) => ({
    nature: i % 2 === 0 ? "mot" : "regle",
    intitule: `intitulé ${i}`,
    definition: "définition de longueur ordinaire, comme le patron en écrirait une",
    consigne: "et sa consigne d'emploi, également de longueur ordinaire",
  }));
  const c = construireConsigneMetier(beaucoup, Array.from({ length: 20 }, () => CORRECTION));
  assert.ok(
    c.texte.length <= BUDGET_CARACTERES,
    `La consigne fait ${c.texte.length} caractères pour un budget de ${BUDGET_CARACTERES} : elle noiera la dictée qu'elle accompagne.`
  );
  assert.ok(c.termesRetenus > 0, "Le budget a tout mangé : plus rien n'est enseigné.");
});

cas("un terme monstrueux ne fait pas tomber le reste", () => {
  const monstre: TermeMetier = { nature: "mot", intitule: "x", definition: "a".repeat(9000), consigne: null };
  const c = construireConsigneMetier([REGLE, monstre, MOT], []);
  assert.match(c.texte, /vendre seule/, "La règle a disparu à cause d'un terme trop long.");
  assert.match(c.texte, /fendre en 50/, "Un terme correct a été perdu à cause de son voisin.");
  assert.ok(c.ecartes.length > 0);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Consigne métier — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
