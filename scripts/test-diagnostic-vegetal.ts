import assert from "node:assert/strict";
import {
  appliquerClassement,
  arbitrer,
  confiancePour,
  confusionEntre,
  ECART_NET,
  MENTION_MECANIQUE,
  mentionsDeSecurite,
  moisDansPeriode,
  rapprocher,
  SEUIL_PLANCHER,
  verifierVocabulaire,
  type Candidat,
  type Confusion,
  type FichePourMoteur,
  type Observation,
  type SymptomeFiche,
} from "../src/lib/diagnostic-vegetal";

/**
 * Le moteur du diagnostic végétal — **sans base, sans réseau, sans clé**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EST ÉPROUVÉ ICI, ET POURQUOI CES CAS-LÀ PLUTÔT QUE D'AUTRES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. **LES REFUS.** C'est la moitié de ce module. Un moteur qui conclut
 *     toujours est facile ; ce qui est difficile, c'est qu'il refuse quand il
 *     doit. Cinq refus distincts sont éprouvés séparément, parce que les
 *     confondre enverrait chercher au mauvais endroit.
 *
 *  2. **LE VERROU `diagnostic_photo: impossible`.** Une fiche qui déclare
 *     elle-même qu'une photo ne peut pas trancher ne doit JAMAIS être rendue,
 *     même seule en tête, même avec un score parfait. C'est la garantie qui
 *     empêche d'affirmer sur photo ce qu'une photo ne montre pas.
 *
 *  3. **LE VERROU DU CLASSEUR.** Sa règle : *« le modèle ne devra jamais
 *     pouvoir créer une maladie absente de la base »*. Le classement sémantique
 *     n'existe pas encore ; le verrou qui le bornera, si. On l'éprouve donc
 *     contre un classeur volontairement malveillant — sans quoi on découvrirait
 *     le trou le jour où on brancherait le vrai.
 *
 *  4. **LES PLAFONDS DE CONFIANCE.** Une photo floue ne peut pas donner une
 *     confiance élevée, quel que soit le score. Sans ces plafonds, la confiance
 *     affichée serait un mensonge exactement dans les cas où elle compte le
 *     plus.
 *
 *  5. **LA MENTION MÉCANIQUE, y compris sur `inconnu`.** C'est l'inverse du
 *     réflexe : une fiche qui ne sait pas dire si l'arbre risque de casser est
 *     précisément celle sur laquelle il ne faut pas laisser croire que la
 *     question a été tranchée.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

// ── Fabriques de fiches d'essai ────────────────────────────────────────────
//
// Volontairement pauvres et sans nom réel : ce qui est éprouvé, c'est la
// MÉCANIQUE du rapprochement, pas un fait phytosanitaire — que ce fichier
// n'aurait de toute façon aucun droit d'affirmer.

function symptome(p: Partial<SymptomeFiche> = {}): SymptomeFiche {
  return {
    nature: "symptome",
    partie: "feuille",
    motif: "tache",
    couleurs: [],
    localisations: [],
    poids: "frequent",
    ...p,
  };
}

function fiche(code: string, p: Partial<FichePourMoteur> = {}): FichePourMoteur {
  return {
    id: `id-${code}`,
    code,
    nomCommun: `Fiche ${code}`,
    gravite: "faible",
    diagnosticPhoto: "possible",
    partiesAtteintes: ["feuille"],
    periodeDebutMois: null,
    periodeFinMois: null,
    symptomes: [symptome()],
    hotes: [],
    ...p,
  };
}

function observation(p: Partial<Observation> = {}): Observation {
  return {
    partie: "feuille",
    signes: [{ partie: "feuille", motif: "tache", couleurs: [], localisation: null }],
    essence: null,
    qualitePhoto: "bonne",
    ...p,
  };
}

const SANS_COMPLEMENT = { complementDejaDemande: false, baseVide: false };

console.log("\n=== Vocabulaire fermé ===");

cas("un motif hors vocabulaire est refusé à l'import", () => {
  const problemes = verifierVocabulaire([
    { partie: "feuille", motif: "moisissure", couleurs: [], localisations: [] },
  ]);
  assert.equal(problemes.length, 1);
  assert.match(problemes[0], /moisissure/);
});

cas("le vocabulaire légitime passe", () => {
  assert.deepEqual(
    verifierVocabulaire([
      { partie: "tronc", motif: "carpophore", couleurs: ["brun"], localisations: ["base"] },
    ]),
    []
  );
});

console.log("\n=== Saison, y compris à cheval sur janvier ===");

cas("période ordinaire", () => {
  assert.equal(moisDansPeriode(6, 5, 9), true);
  assert.equal(moisDansPeriode(2, 5, 9), false);
});

cas("période qui repart en janvier — le cas des carpophores d'hiver", () => {
  assert.equal(moisDansPeriode(12, 11, 3), true);
  assert.equal(moisDansPeriode(2, 11, 3), true);
  assert.equal(moisDansPeriode(6, 11, 3), false);
});

cas("sans période, on ne module rien plutôt que de supposer", () => {
  assert.equal(moisDansPeriode(6, null, null), null);
  assert.equal(moisDansPeriode(6, 5, null), null);
});

console.log("\n=== Rapprochement ===");

cas("une fiche dont la partie ne correspond pas est EXCLUE, pas mal notée", () => {
  const candidats = rapprocher(observation({ partie: "tronc" }), [fiche("a")], 6);
  assert.equal(candidats.length, 0);
});

cas("un hôte STRICT exclut une essence différente", () => {
  const stricte = fiche("a", { hotes: [{ taxonId: "t-chene", port: "feuillu", specificite: "strict" }] });
  const surAutreEssence = observation({
    essence: { taxonId: "t-platane", port: "feuillu", certitude: "sure" },
  });
  assert.equal(rapprocher(surAutreEssence, [stricte], 6).length, 0);
});

cas("un hôte NON strict ne fait que pénaliser — les listes d'hôtes sont rarement exhaustives", () => {
  const large = fiche("a", { hotes: [{ taxonId: "t-chene", port: "feuillu", specificite: "frequent" }] });
  const surAutreEssence = observation({
    essence: { taxonId: "t-platane", port: "feuillu", certitude: "sure" },
  });
  const candidats = rapprocher(surAutreEssence, [large], 6);
  assert.equal(candidats.length, 1, "la fiche doit rester candidate");
  assert.ok(candidats[0].motifs.some((m) => m.quoi === "essence_hors_hotes"));
});

cas("un SIGNE pèse plus qu'un symptôme — c'est du métier, pas du réglage", () => {
  const avecSigne = fiche("signe", {
    partiesAtteintes: ["tronc"],
    symptomes: [symptome({ nature: "signe", partie: "tronc", motif: "carpophore", poids: "cardinal" })],
  });
  const avecSymptome = fiche("symptome", {
    partiesAtteintes: ["tronc"],
    symptomes: [symptome({ nature: "symptome", partie: "tronc", motif: "carpophore", poids: "cardinal" })],
  });
  const vue = observation({
    partie: "tronc",
    signes: [{ partie: "tronc", motif: "carpophore", couleurs: [], localisation: null }],
  });
  const [a, b] = rapprocher(vue, [avecSigne, avecSymptome], 6);
  assert.equal(a.fiche.code, "signe");
  assert.ok(a.score > b.score);
});

cas("le score croise les DEUX couvertures : une fiche fourre-tout ne gagne pas", () => {
  const precise = fiche("precise", {
    symptomes: [symptome({ motif: "tache", poids: "cardinal" })],
  });
  const fourreTout = fiche("fourre-tout", {
    symptomes: [
      symptome({ motif: "tache", poids: "possible" }),
      symptome({ motif: "chancre", poids: "frequent" }),
      symptome({ motif: "galerie", poids: "frequent" }),
      symptome({ motif: "toile", poids: "frequent" }),
    ],
  });
  const [premier] = rapprocher(observation(), [precise, fourreTout], 6);
  assert.equal(premier.fiche.code, "precise");
});

cas("les motifs de score sont conservés — un diagnostic fautif doit s'expliquer", () => {
  const [candidat] = rapprocher(observation(), [fiche("a", { periodeDebutMois: 5, periodeFinMois: 9 })], 6);
  assert.ok(candidat.motifs.some((m) => m.quoi === "saison_favorable"));
  assert.ok(candidat.motifs.some((m) => m.quoi === "symptome_reconnu"));
});

cas("le tri est STABLE à score égal — deux exécutions rendent le même ordre", () => {
  const a = rapprocher(observation(), [fiche("zebre"), fiche("abeille")], 6);
  const b = rapprocher(observation(), [fiche("abeille"), fiche("zebre")], 6);
  assert.deepEqual(
    a.map((c) => c.fiche.code),
    b.map((c) => c.fiche.code)
  );
});

console.log("\n=== Arbitrage : les cinq refus ===");

cas("base vide : on le DIT, plutôt que de répondre « rien trouvé »", () => {
  const verdict = arbitrer([], observation(), [], { complementDejaDemande: false, baseVide: true });
  assert.equal(verdict.issue, "refus");
  assert.equal(verdict.issue === "refus" && verdict.motif, "base_vide");
});

cas("photo illisible : on accuse la photo, pas la base", () => {
  const verdict = arbitrer([], observation({ signes: [], qualitePhoto: "mauvaise" }), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue === "refus" && verdict.motif, "photo_illisible");
});

cas("rien de reconnu sur une bonne photo : aucune piste", () => {
  const verdict = arbitrer([], observation({ signes: [] }), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue === "refus" && verdict.motif, "aucune_piste");
});

cas("sous le seuil plancher : on ne conclut pas", () => {
  const faible: Candidat = { fiche: fiche("a"), score: SEUIL_PLANCHER - 0.01, motifs: [] };
  const verdict = arbitrer([faible], observation(), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue === "refus" && verdict.motif, "trop_faible");
});

cas("deux hypothèses proches SANS confusion connue : on refuse plutôt qu'improviser une consigne", () => {
  const a: Candidat = { fiche: fiche("a"), score: 0.7, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.65, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue === "refus" && verdict.motif, "trop_proches");
});

console.log("\n=== Arbitrage : le verrou « une photo ne peut pas trancher » ===");

cas("une fiche `impossible` n'est JAMAIS rendue, même seule et parfaite", () => {
  const parfaite: Candidat = { fiche: fiche("a", { diagnosticPhoto: "impossible" }), score: 1, motifs: [] };
  const verdict = arbitrer([parfaite], observation(), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue, "refus");
  assert.equal(verdict.issue === "refus" && verdict.motif, "diagnostic_photo_impossible");
});

console.log("\n=== Arbitrage : UNE photo complémentaire, jamais deux ===");

const confusion: Confusion = {
  ficheId: "id-a",
  ficheConfondueId: "id-b",
  critereDifferenciant: "Le critère se lit sous la feuille.",
  photoQuiTranche: "Photographiez le dessous de la feuille.",
  partieQuiTranche: "feuille",
};

cas("la consigne est RECOPIÉE de la base, mot pour mot", () => {
  const a: Candidat = { fiche: fiche("a"), score: 0.7, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.65, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [confusion], SANS_COMPLEMENT);
  assert.equal(verdict.issue, "complement");
  assert.equal(verdict.issue === "complement" && verdict.consigne, confusion.photoQuiTranche);
  assert.equal(verdict.issue === "complement" && verdict.partie, "feuille");
});

cas("la confusion se lit dans les DEUX sens", () => {
  assert.ok(confusionEntre("id-b", "id-a", [confusion]));
  assert.equal(confusionEntre("id-a", "id-c", [confusion]), null);
});

cas("une confusion SANS photo qui tranche ne relance pas", () => {
  const sansPhoto: Confusion = { ...confusion, photoQuiTranche: null };
  const a: Candidat = { fiche: fiche("a"), score: 0.7, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.65, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [sansPhoto], SANS_COMPLEMENT);
  assert.equal(verdict.issue === "refus" && verdict.motif, "trop_proches");
});

cas("la relance a déjà eu lieu : on ne redemande PAS, on tranche ou on refuse", () => {
  const a: Candidat = { fiche: fiche("a"), score: 0.7, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.65, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [confusion], {
    complementDejaDemande: true,
    baseVide: false,
  });
  assert.equal(verdict.issue, "conclusion");
  assert.equal(verdict.issue === "conclusion" && verdict.confiance, "incertaine");
});

cas("après relance, une première hypothèse faible se refuse quand même", () => {
  const a: Candidat = { fiche: fiche("a"), score: 0.4, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.38, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [confusion], {
    complementDejaDemande: true,
    baseVide: false,
  });
  assert.equal(verdict.issue === "refus" && verdict.motif, "trop_proches");
});

cas("écart net : on conclut", () => {
  const a: Candidat = { fiche: fiche("a"), score: 0.9, motifs: [] };
  const b: Candidat = { fiche: fiche("b"), score: 0.9 - ECART_NET - 0.01, motifs: [] };
  const verdict = arbitrer([a, b], observation(), [], SANS_COMPLEMENT);
  assert.equal(verdict.issue, "conclusion");
});

console.log("\n=== Confiance : trois mots, et des plafonds ===");

const solide: Candidat = { fiche: fiche("a"), score: 0.9, motifs: [] };

cas("élevée quand tout est réuni", () => {
  assert.equal(confiancePour(solide, 0.4, "bonne", true), "elevee");
});

cas("une photo MOYENNE plafonne à « probable », quel que soit le score", () => {
  assert.equal(confiancePour(solide, 0.4, "moyenne", true), "probable");
});

cas("une photo MAUVAISE plafonne à « incertaine »", () => {
  assert.equal(confiancePour(solide, 0.4, "mauvaise", true), "incertaine");
});

cas("une fiche « indicatif » plafonne à « probable » — on n'est pas plus sûr que la source", () => {
  const indicative: Candidat = { fiche: fiche("a", { diagnosticPhoto: "indicatif" }), score: 0.9, motifs: [] };
  assert.equal(confiancePour(indicative, 0.4, "bonne", true), "probable");
});

cas("sans essence reconnue, jamais « élevée »", () => {
  assert.equal(confiancePour(solide, 0.4, "bonne", false), "probable");
});

cas("un écart faible ne donne jamais « élevée », même avec un score parfait", () => {
  const parfaite: Candidat = { fiche: fiche("a"), score: 1, motifs: [] };
  assert.notEqual(confiancePour(parfaite, 0.05, "bonne", true), "elevee");
});

console.log("\n=== Le verrou du classeur sémantique ===");

cas("un classeur ne peut PAS ajouter une fiche absente du filtrage", () => {
  const entrants: Candidat[] = [{ fiche: fiche("a"), score: 0.5, motifs: [] }];
  const malveillant: Candidat[] = [
    { fiche: fiche("inventee"), score: 0.99, motifs: [] },
    ...entrants,
  ];
  const { candidats, intrus } = appliquerClassement(entrants, malveillant);
  assert.deepEqual(intrus, ["inventee"]);
  assert.deepEqual(candidats.map((c) => c.fiche.code), ["a"]);
});

cas("un classeur ne peut pas remplacer le CONTENU d'une fiche sous un identifiant valide", () => {
  const vraie = fiche("a", { gravite: "faible" });
  const entrants: Candidat[] = [{ fiche: vraie, score: 0.5, motifs: [] }];
  // Même identifiant, contenu falsifié : c'est la manière subtile d'afficher
  // n'importe quel texte sans jamais « ajouter » de fiche.
  const falsifie: Candidat[] = [
    { fiche: { ...vraie, gravite: "importante", nomCommun: "Texte inventé" }, score: 0.9, motifs: [] },
  ];
  const { candidats } = appliquerClassement(entrants, falsifie);
  assert.equal(candidats[0].fiche.nomCommun, "Fiche a");
  assert.equal(candidats[0].fiche.gravite, "faible");
  assert.equal(candidats[0].score, 0.9, "le score, lui, est bien repris du classeur");
});

cas("un classeur ne peut pas dupliquer une fiche pour la faire remonter deux fois", () => {
  const entrants: Candidat[] = [{ fiche: fiche("a"), score: 0.5, motifs: [] }];
  const double: Candidat[] = [entrants[0], { ...entrants[0], score: 0.9 }];
  const { candidats, intrus } = appliquerClassement(entrants, double);
  assert.equal(candidats.length, 1);
  assert.deepEqual(intrus, ["a"]);
});

cas("un classeur qui TRONQUE ne fait pas disparaître une piste en silence", () => {
  const entrants: Candidat[] = [
    { fiche: fiche("a"), score: 0.5, motifs: [] },
    { fiche: fiche("b"), score: 0.4, motifs: [] },
  ];
  const { candidats } = appliquerClassement(entrants, [entrants[0]]);
  assert.equal(candidats.length, 2);
});

cas("un score aberrant est borné à [0, 1]", () => {
  const entrants: Candidat[] = [{ fiche: fiche("a"), score: 0.5, motifs: [] }];
  const { candidats } = appliquerClassement(entrants, [{ ...entrants[0], score: 42 }]);
  assert.equal(candidats[0].score, 1);
});

console.log("\n=== Mentions de sécurité : quatre risques, jamais confondus ===");

const SANS_RISQUE = {
  gravite: "faible" as const,
  impactMecanique: "aucun" as const,
  impactMecaniqueNote: null,
  risqueHumainAnimal: "aucun" as const,
  risqueHumainAnimalNote: null,
  statutReglementaire: "aucun" as const,
  referenceReglementaire: null,
};

cas("aucun risque déclaré : aucune mention", () => {
  assert.deepEqual(mentionsDeSecurite(SANS_RISQUE), []);
});

cas("impact mécanique AVÉRÉ : la phrase sur la stabilité s'affiche", () => {
  const mentions = mentionsDeSecurite({ ...SANS_RISQUE, impactMecanique: "avere" });
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].texte, MENTION_MECANIQUE);
});

cas("impact INCONNU sur une fiche GRAVE : la phrase s'affiche — on ne sait pas, et ça compte", () => {
  const mentions = mentionsDeSecurite({ ...SANS_RISQUE, gravite: "importante", impactMecanique: "inconnu" });
  assert.equal(mentions.length, 1, "une fiche grave qui ne sait pas doit le dire, pas se taire");
  assert.equal(mentions[0].type, "mecanique");
});

cas("impact INCONNU sur une fiche FAIBLE : la phrase se TAIT — corrigé le 20 août", () => {
  // Le défaut trouvé en REGARDANT le résultat de la deuxième fiche réelle :
  // l'anthracnose du platane, « spectaculaire mais rarement grave », affichait
  // un avertissement sur la solidité de l'arbre sous « Surveiller l'évolution ».
  // Un avertissement qui parle à tort s'apprend à être ignoré — et il ne serait
  // plus lu le jour où il compte.
  const mentions = mentionsDeSecurite({ ...SANS_RISQUE, gravite: "faible", impactMecanique: "inconnu" });
  assert.deepEqual(mentions, [], "une source qui juge le dégât mineur n’est pas une source silencieuse");
});

cas("mais « possible » reste inconditionnel, même sur une fiche faible", () => {
  const mentions = mentionsDeSecurite({ ...SANS_RISQUE, gravite: "faible", impactMecanique: "possible" });
  assert.equal(mentions.length, 1, "la source a vu quelque chose : on ne la relativise pas");
});

cas("« avéré » aussi, même sur une fiche faible", () => {
  const mentions = mentionsDeSecurite({ ...SANS_RISQUE, gravite: "faible", impactMecanique: "avere" });
  assert.equal(mentions.length, 1);
});

cas("les quatre risques restent DISTINCTS et cumulables", () => {
  const mentions = mentionsDeSecurite({
    gravite: "importante",
    impactMecanique: "possible",
    impactMecaniqueNote: "note mécanique",
    risqueHumainAnimal: "toxique",
    risqueHumainAnimalNote: "note toxique",
    statutReglementaire: "lutte_obligatoire",
    referenceReglementaire: "texte de référence",
  });
  assert.deepEqual(mentions.map((m) => m.type), ["mecanique", "risque_humain", "reglementaire"]);
});

console.log(
  echecs === 0 ? `\n✅ Toutes les vérifications passent.` : `\n❌ ${echecs} vérification(s) en échec.`
);
process.exit(echecs === 0 ? 0 : 1);
