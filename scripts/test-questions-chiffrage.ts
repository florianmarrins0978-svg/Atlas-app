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



// =========================================================================
// LE TEST TÉLÉPHONE DU 31 AOÛT 2026 : ne jamais redemander ce qu'on sait
// =========================================================================
//
// Il a dicté « démontage d'un érable de 40 cm de diamètre et 12 mètres de haut
// avec rétention », et l'écran lui a quand même demandé « Comment s'abat-il ? »
// puis « Quel diamètre fait le tronc ? » — sous le titre « Dessouchage ».
//
// **Deux défauts distincts, et le titre disait lequel.** Les questions
// portaient bien sur la SOUCHE, pas sur l'érable : une souche recevait la
// question de l'abattage, qui n'a pas de sens pour elle, et son diamètre était
// cherché dans un texte au lieu de sa colonne.
//
// Sa règle : « une question n'est posée que si l'information nécessaire au prix
// est réellement absente des données structurées de LA prestation concernée.
// Ne récupère pas l'information depuis une autre prestation. »

console.log("\n=== Ce que la dictée a déjà dit ne se redemande pas ===\n");

const erableRenseigne = {
  libelle: "Démontage en rétention d'un érable",
  nature: "abattage",
  methode: "demontage_retention",
  caracteristiques: { diametreCm: 40, hauteurM: 12 },
};
const soucheRenseignee = {
  libelle: "Dessouchage de souches de 60 cm",
  nature: "dessouchage",
  caracteristiques: { diametreCm: 60 },
};

cas("la technique en COLONNE éteint « Comment s'abat-il ? »", () => {
  const q = questionsAvantChiffrage([erableRenseigne]);
  assert.ok(
    q.every((x) => !x.id.startsWith("abattage.technique")),
    `posée quand même : ${q.map((x) => x.question).join(" / ")}`
  );
});

cas("le diamètre en COLONNE éteint « Quel diamètre fait le tronc ? »", () => {
  const q = questionsAvantChiffrage([erableRenseigne]);
  assert.ok(
    q.every((x) => !x.id.startsWith("abattage.diametre")),
    `posée quand même : ${q.map((x) => x.question).join(" / ")}`
  );
});

cas("un érable entièrement renseigné ne pose AUCUNE question", () => {
  const q = questionsAvantChiffrage([erableRenseigne]);
  assert.equal(q.length, 0, `restantes : ${q.map((x) => x.question).join(" / ")}`);
});

cas("une SOUCHE ne se fait jamais demander comment elle s'abat", () => {
  // C'est la question qu'il a lue sous le titre « Dessouchage ». Une souche se
  // rogne ou s'arrache ; elle ne s'abat pas.
  const q = questionsAvantChiffrage([{ libelle: "Dessouchage", nature: "dessouchage" }]);
  assert.ok(
    q.every((x) => !x.id.startsWith("abattage.technique")),
    `posée quand même : ${q.map((x) => x.question).join(" / ")}`
  );
});

cas("le diamètre d'une souche vient de SA colonne, pas de l'arbre d'à côté", () => {
  const q = questionsAvantChiffrage([erableRenseigne, soucheRenseignee]);
  assert.equal(
    q.length,
    0,
    `restantes : ${q.map((x) => `${x.libellePrestation} → ${x.question}`).join(" / ")}`
  );
});

cas("sans colonne NI texte, la technique et le diamètre se demandent encore", () => {
  // **Le garde-fou dans l'autre sens.** Une prestation d'avant le lot B n'a que
  // son texte ; taire la question ferait chiffrer sans savoir, ce qui coûte du
  // simple au double sur un abattage.
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne", nature: "abattage" }]);
  assert.equal(q.length, 2, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("chaque question porte le libellé de SA prestation", () => {
  // Ce titre « Dessouchage » au-dessus d'une question d'abattage est ce qui l'a
  // induit en erreur.
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne", nature: "abattage" }]);
  assert.ok(
    q.every((x) => x.libellePrestation === "Abattage d'un chêne"),
    JSON.stringify(q.map((x) => x.libellePrestation))
  );
});


// =========================================================================
// LA CONVENTION MÉTIER DU 31 AOÛT 2026 : les centimètres d'un tronc
// =========================================================================
//
// *« Quand une mesure en centimètres est donnée pour une souche ou un arbre
// dans certaines formulations métier, elle doit être interprétée comme un
// diamètre. »*
//
//   « dessouchage de deux souches de 60 cm »  → diametreCm = 60
//   « un chêne de 60 cm au pied »             → diametreCm = 60
//
// **Et la borne qu'il a posée lui-même**, qui compte autant que la règle :
// *« ne généralise pas aveuglément toute mesure en cm trouvée dans une
// phrase. Si le contexte indique clairement une autre mesure — une
// circonférence, une hauteur — respecte ce qui est dit. »*

console.log("\n=== Les centimètres d'un tronc, et ceux qui n'en sont pas ===\n");

cas("« deux souches de 60 cm » : aucune question de diamètre", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage de deux souches de 60 cm", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("« une souche de 50 cm » : aucune question de diamètre", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage d'une souche de 50 cm", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("« un chêne de 60 cm au pied » : le diamètre est lu", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne de 60 cm au pied", nature: "abattage" },
  ]);
  assert.ok(
    q.every((x) => !x.id.startsWith("abattage.diametre")),
    `posée quand même : ${q.map((x) => x.question).join(" / ")}`
  );
});

cas("« un érable de 40 cm au pied avec rétention » : plus AUCUNE question", () => {
  // Ses deux règles à la fois : « au pied » donne le diamètre, « rétention »
  // donne la technique.
  const q = questionsAvantChiffrage([
    { libelle: "Démontage d'un érable de 40 cm au pied avec rétention", nature: "abattage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("« deux souches » SANS mesure : la question se pose, et elle dit « la souche »", () => {
  // C'est le seul cas où elle doit sortir — et jamais avec le mot « tronc ».
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage de deux souches", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 1, `posées : ${q.map((x) => x.question).join(" / ")}`);
  assert.equal(q[0].question, "Quel diamètre fait la souche ?");
});

cas("un ABATTAGE sans mesure garde le mot « tronc »", () => {
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne", nature: "abattage" }]);
  const diametre = q.find((x) => x.id.startsWith("abattage.diametre"));
  assert.equal(diametre?.question, "Quel diamètre fait le tronc ?");
});

console.log("\n=== La borne : tout ce qui est en cm n'est pas un diamètre ===\n");

cas("« 60 cm de circonférence » n'est JAMAIS un diamètre", () => {
  // Le tour d'un tronc fait π fois son diamètre : confondre les deux
  // triplerait la case de sa grille.
  for (const dit of [
    "Dessouchage d'une souche de 60 cm de circonférence",
    "Abattage d'un chêne de 60 cm de circonférence au pied",
  ]) {
    const q = questionsAvantChiffrage([{ libelle: dit, nature: dit.startsWith("Dess") ? "dessouchage" : "abattage" }]);
    assert.ok(
      q.some((x) => x.id.startsWith("abattage.diametre")),
      `« ${dit} » a été pris pour un diamètre`
    );
  }
});

cas("une hauteur, une longueur ou une largeur ne deviennent pas un diamètre", () => {
  assert.equal(diametreLu("un chêne de 12 m de haut"), null);
  assert.equal(diametreLu("une haie de 800 cm de long"), null);
  assert.equal(diametreLu("bordure de 30 cm de large"), null);
});

cas("une mesure en cm qui flotte ailleurs n'est pas un diamètre", () => {
  // Sa borne, littéralement : le motif est ancré sur « souche » ou « au pied ».
  assert.equal(diametreLu("évacuation, prévoir 30 cm de paillage"), null);
});


// =========================================================================
// SANS PRONONCER « CENTIMÈTRES » — sa précision du 31 août 2026 au soir
// =========================================================================
//
// *« Quand je dis "une souche de 60", cela signifie une souche de 60 cm de
// diamètre. De la même manière, "un chêne de 60 au pied" signifie un chêne de
// 60 cm de diamètre au pied. »*
//
// Il ne prononce pas l'unité. Exiger le mot revenait à jeter la mesure qu'il
// venait de donner, et à reposer la question dans la foulée.
//
// **La borne, elle, ne bouge pas** : la lecture reste ancrée sur « souche de X »
// et « X au pied ». Un nombre qui flotte ailleurs n'est toujours pas un
// diamètre, et une autre mesure nommée est respectée.

console.log("\n=== Sans prononcer l'unité, dans les deux contextes métier ===\n");

cas("« deux souches de 60 » : aucune question de diamètre", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage de deux souches de 60", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("« une souche de 50 » : aucune question de diamètre", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage d'une souche de 50", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("« un chêne de 60 au pied » : le diamètre est lu", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Abattage d'un chêne de 60 au pied", nature: "abattage" },
  ]);
  assert.ok(
    q.every((x) => !x.id.startsWith("abattage.diametre")),
    `posée quand même : ${q.map((x) => x.question).join(" / ")}`
  );
});

cas("« un érable de 40 au pied avec rétention » : plus AUCUNE question", () => {
  const q = questionsAvantChiffrage([
    { libelle: "Démontage d'un érable de 40 au pied avec rétention", nature: "abattage" },
  ]);
  assert.equal(q.length, 0, `posées : ${q.map((x) => x.question).join(" / ")}`);
});

cas("les quatre lectures, valeur par valeur", () => {
  assert.equal(diametreLu("dessouchage de deux souches de 60"), 60);
  assert.equal(diametreLu("dessouchage d'une souche de 50"), 50);
  assert.equal(diametreLu("abattage d'un chêne de 60 au pied"), 60);
  assert.equal(diametreLu("démontage d'un érable de 40 au pied avec rétention"), 40);
});

console.log("\n=== La borne tient : trois refus que l'unité facultative pouvait casser ===\n");

cas("« deux souches » ne devient PAS un diamètre de 2", () => {
  // **Le piège le plus dangereux de cette convention.** « deux souches » s'écrit
  // « 2 souches » une fois les mots-nombres en chiffres ; lire ce 2 comme un
  // diamètre rangerait le prix dans la case des tout petits troncs.
  //
  // Ce qui l'écarte tient à la position : le motif exige le nombre APRÈS le mot
  // « souche », et là il est avant.
  assert.equal(diametreLu("dessouchage de deux souches"), null);
  assert.equal(diametreLu("dessouchage de trois souches"), null);
  const q = questionsAvantChiffrage([
    { libelle: "Dessouchage de deux souches", nature: "dessouchage" },
  ]);
  assert.equal(q.length, 1, "la question doit encore se poser");
  assert.equal(q[0].question, "Quel diamètre fait la souche ?");
});

cas("une AUTRE unité n'est pas prise pour des centimètres", () => {
  // « une souche de 2 m » : deux mètres de diamètre n'existent pas sur ses
  // chantiers, mais lire 2 les rangerait dans la case des 2 cm.
  assert.equal(diametreLu("une souche de 2 m"), null);
  assert.equal(diametreLu("une souche de 2 mètres"), null);
});

cas("une mesure NOMMÉE autrement reste ce qu'elle est, avec ou sans unité", () => {
  for (const dit of [
    "une souche de 60 de circonférence",
    "une souche de 60 cm de circonférence",
    "un chêne de 60 de circonférence au pied",
    "un chêne de 12 m de haut",
    "une haie de 800 cm de long",
    "bordure de 30 cm de large",
  ]) {
    assert.equal(diametreLu(dit), null, `« ${dit} » a été pris pour un diamètre`);
  }
});

cas("un nombre qui flotte ailleurs n'est toujours pas un diamètre", () => {
  assert.equal(diametreLu("trois arbres à abattre"), null);
  assert.equal(diametreLu("tonte de 1200 m²"), null);
  assert.equal(diametreLu("évacuation, prévoir 30 cm de paillage"), null);
});


console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);