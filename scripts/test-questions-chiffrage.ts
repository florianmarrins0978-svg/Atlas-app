import assert from "node:assert/strict";
import {
  libelleEnrichi,
  precisionLisible,
  questionsAvantChiffrage,
  type LignePourQuestions,
} from "../src/lib/questions-chiffrage";
import { diametreLu, hauteurLue } from "../src/lib/mesures-arbre";

// Ce que cette suite tient, et pourquoi elle vaut plus qu'un test de fonction.
//
// Elle se joue sur **la dictée réelle du patron** (`docs/EXEMPLE-DICTEE.md`),
// celle où l'abattage vaut de 600 à 1 400 € selon deux informations qui n'y
// figurent pas. Le contrôle central est donc : *l'agent s'arrête-t-il là où un
// devis se tromperait de 800 € ?*
//
// Et son jumeau, aussi important : *se tait-il partout ailleurs ?* Un arrêt qui
// pose dix questions n'est plus « franchissable en quelques secondes »
// (`docs/AGENT.md` §2) — il devient le geste de trop, et le patron cesse de
// s'en servir. Une question de trop coûte donc autant qu'une question de moins.

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

/** Ce que la dictée du 5 août produit une fois lue par un modèle. */
const DICTEE_DU_PATRON: LignePourQuestions[] = [
  { libelle: "Taille de haie de laurier", quantite: "20", unite: "ml" },
  { libelle: "Abattage d'un chêne mort", description: "20 mètres de haut", quantite: "1", unite: "u" },
  { libelle: "Billonnage en 50 cm", quantite: null, unite: null },
  { libelle: "Fendage du bois", quantite: null, unite: null },
];

console.log("=== Les questions qui coûtent de l'argent ===\n");

cas("le chêne déclenche les deux questions qui font le prix", () => {
  const q = questionsAvantChiffrage(DICTEE_DU_PATRON);
  const surLeChene = q.filter((x) => x.libellePrestation.includes("chêne"));
  assert.equal(surLeChene.length, 2, `attendu 2 questions sur le chêne, vu ${surLeChene.length}`);
  assert.ok(
    surLeChene.some((x) => x.id.startsWith("abattage.technique")),
    "la technique n'est pas demandée — c'est pourtant elle qui fait 600 ou 1 400 €"
  );
  assert.ok(
    surLeChene.some((x) => x.id.startsWith("abattage.diametre")),
    "le diamètre n'est pas demandé"
  );
});

cas("la hauteur dictée ne tient PAS lieu de diamètre", () => {
  // Le piège de sa note : « vingt mètres de haut » est bien là, et ne décide de
  // rien. Un filtre trop large la prendrait pour la réponse et laisserait
  // chiffrer un arbre dont on ignore la grosseur.
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort", description: "20 mètres de haut" },
  ]);
  assert.ok(q.some((x) => x.id.startsWith("abattage.diametre")), "la hauteur a été prise pour un diamètre");
});

cas("un diamètre déjà dicté ne se redemande pas", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort", description: "diamètre 70 cm" },
  ]);
  assert.equal(q.filter((x) => x.id.startsWith("abattage.diametre")).length, 0);
});

cas("une technique déjà dictée ne se redemande pas", () => {
  const q = questionsAvantChiffrage([{ libelle: "Démontage d'un chêne mort, diamètre 70 cm" }]);
  assert.equal(q.length, 0, `attendu aucune question, vu : ${q.map((x) => x.id).join(", ")}`);
});

cas("la haie dictée avec sa longueur ne déclenche rien", () => {
  const q = questionsAvantChiffrage(DICTEE_DU_PATRON);
  assert.equal(
    q.filter((x) => x.libellePrestation.includes("haie")).length,
    0,
    "la longueur était dans la dictée : la redemander rend l'arrêt pénible"
  );
});

cas("une haie sans longueur, elle, se demande", () => {
  const q = questionsAvantChiffrage([{ libelle: "Taille de haie de laurier" }]);
  assert.equal(q.length, 1);
  assert.equal(q[0]!.unite, "ml");
});

cas("« 20 m linéaires » compte comme une longueur, comme « de long »", () => {
  for (const dit of ["Taille de haie 20 m linéaires", "Taille de haie de laurier, vingt mètres de long"]) {
    assert.equal(questionsAvantChiffrage([{ libelle: dit }]).length, 0, `« ${dit} » redemandé à tort`);
  }
});

cas("SE TAIRE : le billonnage et le fendage ne déclenchent rien", () => {
  // Le billonnage est compris dans l'abattage : il ne porte aucune variable de
  // prix, et le questionner allongerait l'arrêt pour rien.
  //
  // **La fente, elle, en porte deux depuis le 8 août 2026** — la hauteur et le
  // diamètre désignent une case de sa grille. Si elle ne demande rien ICI,
  // c'est que sa dictée les donne déjà : la hauteur sur la ligne du chêne, le
  // diamètre par la question posée à l'abattage. Le silence vient de ce que
  // tout est su, pas de ce que rien ne compte (voir le bloc « La fente » en fin
  // de suite).
  const q = questionsAvantChiffrage(DICTEE_DU_PATRON);
  const parasites = q.filter(
    (x) => x.libellePrestation.includes("Billonnage") || x.libellePrestation.includes("Fendage")
  );
  assert.deepEqual(parasites, [], `questions de trop : ${parasites.map((x) => x.question).join(" / ")}`);
});

cas("l'arrêt reste franchissable : jamais plus de trois questions sur sa dictée", () => {
  // AGENT.md §2 : « franchissable en quelques secondes ». Ce n'est pas un
  // confort, c'est ce qui décide s'il s'en sert ou s'il contourne.
  const q = questionsAvantChiffrage(DICTEE_DU_PATRON);
  assert.ok(q.length <= 3, `${q.length} questions posées : l'arrêt devient un formulaire`);
});

cas("une question déjà répondue ne revient jamais", () => {
  const toutes = questionsAvantChiffrage(DICTEE_DU_PATRON);
  const restantes = questionsAvantChiffrage(DICTEE_DU_PATRON, new Set(toutes.map((q) => q.id)));
  assert.deepEqual(restantes, [], "l'arrêt se rouvre tout seul après avoir été franchi");
});

cas("deux arbres dans une même dictée sont questionnés séparément", () => {
  // L'identifiant porte le rang : sans lui, répondre pour le chêne
  // répondrait aussi pour le tilleul, et le second serait chiffré sur les
  // caractéristiques du premier.
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort" },
    { libelle: "Abattage d'un tilleul" },
  ]);
  const ids = new Set(q.map((x) => x.id));
  assert.equal(ids.size, q.length, "deux arbres partagent un identifiant de question");
  assert.equal(q.length, 4, "attendu technique + diamètre pour chacun des deux arbres");
});

cas("chaque question dit ce qu'elle change", () => {
  // Un arrêt sans motif est un arrêt qu'on subit. Il doit lire pourquoi on
  // l'interrompt, sinon la question suivante sera expédiée au hasard.
  for (const q of questionsAvantChiffrage(DICTEE_DU_PATRON)) {
    assert.ok(q.pourquoi.trim().length > 20, `« ${q.question} » n'explique pas ce qu'elle change`);
    assert.ok(q.question.trim().endsWith("?"), `« ${q.question} » n'est pas formulée en question`);
  }
});

cas("aucune question n'annonce un prix", () => {
  // Le module dit ce qui MANQUE, jamais ce que ça coûte : les montants
  // viennent de ses tarifs et de sa mémoire (EXEMPLE-DICTEE §9). Un barème
  // écrit en dur ici vieillirait sans que personne ne le voie.
  for (const q of questionsAvantChiffrage(DICTEE_DU_PATRON)) {
    assert.doesNotMatch(`${q.question}`, /\d+\s*€/, `« ${q.question} » chiffre un prix`);
  }
});

cas("la réponse se relit sur le devis, en clair", () => {
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne mort" }]);
  const technique = q.find((x) => x.id.startsWith("abattage.technique"))!;
  const diametre = q.find((x) => x.id.startsWith("abattage.diametre"))!;
  assert.equal(precisionLisible(technique, "demontage_retention"), "démontage avec rétention");
  assert.equal(precisionLisible(diametre, "70"), "⌀ 70 cm");
});

cas("la précision s'écrit sur la prestation, telle qu'il la relira", () => {
  assert.equal(
    libelleEnrichi("Abattage d'un chêne mort", ["démontage avec rétention", "⌀ 70 cm"]),
    "Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm"
  );
});

cas("rejouer l'enchaînement n'allonge pas le libellé", () => {
  // Le patron rejoue souvent. Un libellé qui grossit à chaque essai finirait
  // sur le devis de son client : « ... — démontage, ⌀ 70 cm — démontage, ⌀ 70 cm ».
  const une = libelleEnrichi("Abattage d'un chêne mort", ["démontage", "⌀ 70 cm"]);
  const deux = libelleEnrichi(une, ["démontage", "⌀ 70 cm"]);
  assert.equal(deux, une);
  const trois = libelleEnrichi(deux, ["démontage", "⌀ 70 cm"]);
  assert.equal(trois, une);
});

cas("sans réponse, le libellé reste intact", () => {
  assert.equal(libelleEnrichi("Fendage du bois", []), "Fendage du bois");
  assert.equal(libelleEnrichi("Fendage du bois", ["", "  "]), "Fendage du bois");
});

cas("une prestation sans libellé ne produit rien", () => {
  assert.deepEqual(questionsAvantChiffrage([{ libelle: "   " }]), []);
  assert.deepEqual(questionsAvantChiffrage([]), []);
});

console.log("\n=== La fente : hauteur et diamètre, sans redemander deux fois ===");

// Le patron, le 8 août 2026 : *« pour la fente ils devraient demander la
// hauteur de l'arbre et son diamètre, et on crée une liste de prix en fonction
// de la hauteur et du diamètre, comme ça il n'invente rien. »*
//
// Ce que ces cas tiennent, et qui n'est pas évident : **ces deux mesures
// appartiennent à l'arbre, pas à la ligne de devis.** Les redemander sur la
// ligne de la fente quand l'abattage les porte déjà ferait répéter au patron ce
// qu'il vient de dire — et l'arrêt cesserait d'être franchissable.

cas("une fente seule, sans rien de dit, demande les deux mesures", () => {
  const q = questionsAvantChiffrage([{ libelle: "Fendage du bois" }]);
  assert.deepEqual(
    q.map((x) => x.id.split("#")[0]).sort(),
    ["fendage.diametre", "fendage.hauteur"],
    `attendu la hauteur et le diamètre, vu : ${q.map((x) => x.id).join(", ") || "rien"}`
  );
});

cas("le diamètre ne se demande qu'une fois quand un abattage l'accompagne", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort", description: "20 mètres de haut" },
    { libelle: "Fendage du bois" },
  ]);
  assert.equal(
    q.filter((x) => x.id.startsWith("fendage.diametre")).length,
    0,
    "le diamètre est demandé deux fois pour le même tronc — l'abattage le porte déjà"
  );
  assert.equal(
    q.filter((x) => x.id.startsWith("abattage.diametre")).length,
    1,
    "et il doit bien être demandé une fois, sur l'abattage"
  );
});

cas("la hauteur dite ailleurs dans la dictée ne se redemande pas", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort", description: "20 mètres de haut" },
    { libelle: "Fendage du bois" },
  ]);
  assert.equal(
    q.filter((x) => x.id.startsWith("fendage.hauteur")).length,
    0,
    "« vingt mètres de haut » était dans la dictée : la redemander rend l'arrêt pénible"
  );
});

cas("mais elle se demande dès que la dictée ne la donne nulle part", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne mort" },
    { libelle: "Fendage du bois" },
  ]);
  assert.equal(
    q.filter((x) => x.id.startsWith("fendage.hauteur")).length,
    1,
    "sans hauteur, aucune case de la grille ne peut être désignée — et la fente resterait sans prix"
  );
});

cas("les réponses s'écrivent sous la forme que le chiffrage sait relire", () => {
  // **Ce cas protège un défaut invisible.** Si « ⌀ 45 cm » devenait « 45 cm de
  // diamètre du tronc », rien ne casserait : la question serait posée, la
  // réponse enregistrée, le devis produit — et la case de la grille
  // introuvable. La fente n'aurait simplement jamais de prix.
  const hauteur = questionsAvantChiffrage([{ libelle: "Fendage du bois" }]).find((x) =>
    x.id.startsWith("fendage.hauteur")
  )!;
  const diametre = questionsAvantChiffrage([{ libelle: "Fendage du bois" }]).find((x) =>
    x.id.startsWith("fendage.diametre")
  )!;
  assert.equal(hauteurLue(precisionLisible(hauteur, "12")), 12);
  assert.equal(diametreLu(precisionLisible(diametre, "45")), 45);
});

console.log("\n=== La nature en colonne passe avant le texte (27 août 2026) ===\n");

cas("un libellé qui ne ressemble à rien pose quand même la bonne question", () => {
  // « Intervention chez Mme Martin » n'évoque aucun métier. Sa nature, elle, le
  // dit — et c'est elle qui décide, plus le texte.
  const q = questionsAvantChiffrage([{ libelle: "Intervention chez Mme Martin", nature: "haie" }]);
  assert.ok(
    q.some((x) => x.id.startsWith("haie.longueur")),
    `aucune question de longueur : ${q.map((x) => x.id).join(", ") || "aucune"}`
  );
});

cas("une nature en colonne empêche un faux positif du texte", () => {
  // « Nettoyage autour de la haie du voisin » parle de haie sans en être une.
  const q = questionsAvantChiffrage([
    { libelle: "Nettoyage autour de la haie du voisin", nature: "tonte", quantite: "300", unite: "m²" },
  ]);
  assert.equal(
    q.filter((x) => x.id.startsWith("haie.longueur")).length,
    0,
    "on lui demande la longueur d'une haie qu'il ne taille pas"
  );
});

cas("sans colonne, le texte reprend la main — comme avant", () => {
  // Les prestations d'avant le lot B n'ont pas de nature, et les dictées lues
  // mot à mot non plus. Rien ne doit changer pour elles.
  const q = questionsAvantChiffrage([{ libelle: "Taille de haie de laurier" }]);
  assert.ok(q.some((x) => x.id.startsWith("haie.longueur")));
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
