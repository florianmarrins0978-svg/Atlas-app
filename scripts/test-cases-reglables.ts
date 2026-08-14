import assert from "node:assert/strict";
import {
  AXES_PAR_DEFAUT,
  GRILLES_PAR_DEFAUT,
  NATURES_PAR_DEFAUT,
  casesDUneForme,
  casesParTranche,
  celluleAbattage,
  celluleFendage,
  cellulesDe,
  cleDeNaturePerso,
  libelleDeTranche,
  nouvelleCleTranche,
  rangerTranche,
  trancheDe,
  uniteDeAxe,
  type Axes,
  type Tranche,
} from "../src/lib/grille-prix";
import { questionsAvantChiffrage } from "../src/lib/questions-chiffrage";

// **« Je dois pouvoir ajouter ou retirer des cases. »** — le patron, le 14 août
// 2026, capture de l'écran « Mes prix » à l'appui.
//
// Ce que cette suite tient, et qui ne se voit sur aucun écran :
//
//   1. **deux tranches ne se chevauchent JAMAIS.** `trancheDe` retient la
//      première qui contient la mesure : deux tranches qui se recouvrent ne
//      produisent pas une erreur, elles produisent un prix pris dans la
//      mauvaise case. Un tronc de 95 cm chiffré au tarif des 20 cm ne se voit
//      sur aucun écran — il se voit sur le devis du client ;
//   2. **une clé n'est jamais réemployée.** Elle est écrite en base à côté d'un
//      prix : la rendre à une autre tranche ferait hériter un prix de 1 400 €
//      à des troncs qui ne sont pas les siens ;
//   3. **le nombre de cases annoncé est le vrai.** C'est la phrase que l'écran
//      dit avant de valider ; un nombre faux y serait pire que pas de nombre ;
//   4. **la question d'abattage propose SES façons**, et non les trois
//      d'origine — sans quoi sa quatrième rangée resterait vide pour toujours.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n=== Une tranche neuve ne recouvre jamais une autre ===");

cas("une tranche qui chevauche est REFUSÉE, et le refus se lit", () => {
  const r = rangerTranche(AXES_PAR_DEFAUT.diametres, {
    de: 45,
    a: 55,
    libelle: "45 à 55 cm",
    cle: "d45",
  });
  assert.ok("raison" in r, "une tranche à cheval sur 40-50 et 50-60 a été acceptée");
  assert.match(r.raison, /recouvre/i);
  assert.match(r.raison, /40 à 50 cm/, "le refus ne nomme pas la tranche qu'on écrase");
});

cas("une tranche qui recouvre la dernière, ouverte, est refusée aussi", () => {
  // « plus de 90 cm » n'a pas de borne haute : tout ce qui commence au-delà de
  // 90 tombe dedans. C'est le cas que l'infini fait rater si on l'oublie.
  const r = rangerTranche(AXES_PAR_DEFAUT.diametres, { de: 100, a: 120, libelle: "100 à 120 cm", cle: "d100" });
  assert.ok("raison" in r, "une tranche posée dans « plus de 90 cm » a été acceptée");
});

cas("une tranche qui se glisse dans un trou est acceptée, et rangée dans l'ordre", () => {
  const troue: Tranche[] = [
    { cle: "d0", de: 0, a: 20, libelle: "jusqu'à 20 cm" },
    { cle: "d60", de: 60, a: null, libelle: "plus de 60 cm" },
  ];
  const r = rangerTranche(troue, { de: 20, a: 60, libelle: "20 à 60 cm", cle: "d20" });
  assert.ok(!("raison" in r), "une tranche parfaitement libre a été refusée");
  assert.deepEqual(
    r.tranches.map((t) => t.cle),
    ["d0", "d20", "d60"],
    "les tranches ne se lisent plus du plus petit au plus grand"
  );
});

cas("des bornes qui n'en sont pas sont refusées", () => {
  for (const [de, a] of [
    [-1, 10],
    [50, 40],
    [50, 50],
    [Number.NaN, 10],
  ] as [number, number][]) {
    const r = rangerTranche([], { de, a, libelle: "x", cle: "x" });
    assert.ok("raison" in r, `de ${de} à ${a} a été accepté`);
  }
});

cas("une dernière tranche ouverte est acceptée", () => {
  const r = rangerTranche([{ cle: "d0", de: 0, a: 20, libelle: "jusqu'à 20 cm" }], {
    de: 20,
    a: null,
    libelle: "plus de 20 cm",
    cle: "d20",
  });
  assert.ok(!("raison" in r));
});

console.log("\n=== Une clé ne se réemploie jamais ===");

cas("une borne déjà prise donne une clé DIFFÉRENTE", () => {
  const prises = new Set(AXES_PAR_DEFAUT.diametres.map((t) => t.cle));
  // « plus de 90 cm » s'appelle déjà `d90`. Une tranche « 90 à 120 » ne doit
  // pas hériter de ses prix.
  const neuve = nouvelleCleTranche("diametre", 90, prises);
  assert.notEqual(neuve, "d90", "la clé d'une tranche retirée a été rendue à une autre");
  assert.ok(!prises.has(neuve));
});

cas("une borne libre donne la clé courte", () => {
  assert.equal(nouvelleCleTranche("diametre", 120, new Set()), "d120");
  assert.equal(nouvelleCleTranche("hauteur", 30, new Set()), "h30");
});

cas("un travail à lui porte toujours son préfixe", () => {
  // Sans préfixe, « abattage » saisi à la main viendrait se poser sur la grille
  // d'abattage intégrée — celle dont le chiffrage se sert.
  const cle = cleDeNaturePerso("Abattage", new Set(NATURES_PAR_DEFAUT.map((n) => n.cle)));
  assert.ok(cle.startsWith("perso_"), `« ${cle} » n'est pas préfixé`);
  assert.ok(!NATURES_PAR_DEFAUT.some((n) => n.cle === cle));
});

cas("deux travaux du même nom ne portent pas la même clé", () => {
  const a = cleDeNaturePerso("Broyer les branches", new Set());
  const b = cleDeNaturePerso("Broyer les branches", new Set([a]));
  assert.notEqual(a, b);
});

console.log("\n=== Les libellés qu'il lit ===");

cas("les trois formes de libellé", () => {
  assert.equal(libelleDeTranche(0, 20, "cm"), "jusqu'à 20 cm");
  assert.equal(libelleDeTranche(40, 50, "cm"), "40 à 50 cm");
  assert.equal(libelleDeTranche(90, null, "cm"), "plus de 90 cm");
  assert.equal(libelleDeTranche(10, 15, "m"), "10 à 15 m");
});

cas("un nombre décimal s'écrit à la française", () => {
  assert.equal(libelleDeTranche(0, 2.5, "m"), "jusqu'à 2,5 m");
});

cas("chaque axe connaît son unité", () => {
  assert.equal(uniteDeAxe("hauteur"), "m");
  assert.equal(uniteDeAxe("diametre"), "cm");
});

console.log("\n=== Le nombre de cases annoncé est le VRAI ===");

cas("une tranche de diamètre en pose bien dix", () => {
  // 1 pour dessoucher, 3 pour abattre (une par façon), 6 pour fendre (une par
  // hauteur). C'est la phrase exacte de l'écran.
  const { total, parNature } = casesParTranche("diametre", GRILLES_PAR_DEFAUT);
  assert.equal(total, 10, `l'écran annoncerait ${total} cases`);
  assert.deepEqual(
    parNature.map((x) => [x.nature.cle, x.cases]),
    [
      ["abattage", 3],
      ["fendage", 6],
      ["dessouchage", 1],
    ]
  );
});

cas("une hauteur n'en pose que huit, et ne touche que le fendage", () => {
  const { total, parNature } = casesParTranche("hauteur", GRILLES_PAR_DEFAUT);
  assert.equal(total, 8);
  assert.deepEqual(parNature.map((x) => x.nature.cle), ["fendage"]);
});

cas("une façon d'abattre en pose huit, et ne touche que l'abattage", () => {
  const { total, parNature } = casesParTranche("technique", GRILLES_PAR_DEFAUT);
  assert.equal(total, 8);
  assert.deepEqual(parNature.map((x) => x.nature.cle), ["abattage"]);
});

cas("le décompte SUIT les tranches, il ne les récite pas", () => {
  // Une entreprise à deux diamètres seulement : une hauteur de plus n'ajoute
  // plus huit cases mais deux. Un nombre écrit en dur mentirait ici.
  const petites: Axes = { ...AXES_PAR_DEFAUT, diametres: AXES_PAR_DEFAUT.diametres.slice(0, 2) };
  const { total } = casesParTranche("hauteur", { axes: petites, natures: NATURES_PAR_DEFAUT });
  assert.equal(total, 2);
});

cas("ce qu'une forme neuve fabrique", () => {
  assert.equal(casesDUneForme("une-case", AXES_PAR_DEFAUT), 1);
  assert.equal(casesDUneForme("un-axe", AXES_PAR_DEFAUT), 8);
  assert.equal(casesDUneForme("technique-diametre", AXES_PAR_DEFAUT), 24);
  assert.equal(casesDUneForme("hauteur-diametre", AXES_PAR_DEFAUT), 48);
});

console.log("\n=== Ses tranches à lui font foi, partout ===");

cas("une tranche ajoutée désigne bien une case", () => {
  const range = rangerTranche(AXES_PAR_DEFAUT.diametres.slice(0, 7), {
    de: 90,
    a: 120,
    libelle: "90 à 120 cm",
    cle: "d90_2",
  });
  assert.ok(!("raison" in range));
  const axes: Axes = { ...AXES_PAR_DEFAUT, diametres: range.tranches };
  assert.equal(trancheDe(110, axes.diametres)?.cle, "d90_2");
  assert.equal(celluleAbattage("au_pied", 110, axes)?.cle, "au_pied|d90_2");
  assert.equal(celluleFendage(12, 110, axes)?.cle, "h10|d90_2");
});

cas("une tranche RETIRÉE ne désigne plus rien — et c'est un refus, pas un rabattement", () => {
  // Le piège à ne pas installer : rabattre sur la tranche voisine ferait
  // chiffrer un tronc de 95 cm au prix des 70-90. Mieux vaut ne rien trouver.
  const sansLaDerniere: Axes = { ...AXES_PAR_DEFAUT, diametres: AXES_PAR_DEFAUT.diametres.slice(0, 7) };
  assert.equal(trancheDe(200, sansLaDerniere.diametres), null);
  assert.equal(celluleAbattage("au_pied", 200, sansLaDerniere), null);
});

cas("un travail à lui a bien ses cases", () => {
  const grilles = {
    axes: AXES_PAR_DEFAUT,
    natures: [
      ...NATURES_PAR_DEFAUT,
      {
        cle: "perso_broyage",
        titre: "Broyer les branches",
        aide: "",
        axe: "Diamètre",
        forme: "un-axe" as const,
        integree: false,
      },
    ],
  };
  assert.equal(cellulesDe("perso_broyage", grilles).length, 8);
  // Et ses cases ne se confondent pas avec celles du dessouchage, qui emploie
  // pourtant les mêmes tranches : la nature fait partie de l'identité.
  assert.equal(cellulesDe("perso_inconnu", grilles).length, 0);
});

console.log("\n=== La question d'abattage propose SES façons ===");

cas("par défaut, les trois d'origine", () => {
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne mort" }]).find((x) =>
    x.id.startsWith("abattage.technique")
  );
  assert.ok(q, "la question qui vaut 800 € n'est plus posée");
  assert.deepEqual(
    q.options?.map((o) => o.valeur),
    ["au_pied", "demontage", "demontage_retention"]
  );
});

cas("une façon AJOUTÉE est proposée — sans quoi sa rangée resterait vide à jamais", () => {
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne mort" }], new Set(), [
    ...AXES_PAR_DEFAUT.techniques,
    { cle: "t_par_cable", libelle: "abattage par câble" },
  ]).find((x) => x.id.startsWith("abattage.technique"));
  assert.ok(q);
  assert.ok(
    q.options?.some((o) => o.valeur === "t_par_cable"),
    "sa façon à lui n'est pas proposée : la case existe, rien ne peut la désigner"
  );
  assert.equal(q.options?.find((o) => o.valeur === "t_par_cable")?.libelle, "Abattage par câble");
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
