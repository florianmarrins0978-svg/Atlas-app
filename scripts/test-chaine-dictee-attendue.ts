import assert from "node:assert/strict";
import { ATTENDU, lireLaChaine } from "./verifier-chaine-dictee.mts";
import { PropositionExtractionSchema, type PropositionExtraction } from "../src/server/ai/schemas/extraction";

// **Le contrôle du contrôle.**
//
// `npm run verifier:chaine-dictee` ne peut pas être joué ici : il appelle un
// vrai modèle, et cet environnement n'a aucune clé (`CLAUDE.md` §1 ter). Sa
// logique ne serait donc vérifiée nulle part — et un mode d'emploi qui plante
// chez le patron est un échec déjà payé trois fois (`AGENTS.md`).
//
// Cette suite joue la partie qui ne dépend d'aucune clé : ce que la chaîne fait
// d'une réponse de modèle, et ce que le verdict dit. **Dans les deux sens** —
// une réponse juste passe, une réponse abîmée est refusée, et le message
// désigne le bon coupable.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Ce qu'un modèle DOIT rendre sur sa dictée de référence. */
function reponseJuste(): PropositionExtraction {
  return PropositionExtractionSchema.parse({
    prestations: [
      { libelle: "Taille de haie de laurier", quantite: "800", unite: "ml", nature: "haie", espece: "laurier" },
      {
        libelle: "Démontage d'un érable avec rétention",
        description: "40 cm de diamètre, 12 m de haut",
        nature: "abattage",
        espece: "érable",
      },
      { libelle: "Dessouchage de deux souches", quantite: "2", unite: "souche", nature: "dessouchage" },
      { libelle: "Évacuation des déchets", nature: "evacuation" },
      { libelle: "Tonte de la pelouse", quantite: "1200", unite: "m²", nature: "tonte" },
    ],
    dureePrevue: "1 journée",
    tailleEquipe: "2 hommes",
  });
}

function verdict(p: PropositionExtraction): string[] {
  const lu = lireLaChaine(p);
  return ATTENDU.map(({ quoi, verifier }) => (verifier(lu) ? quoi : null)).filter((x): x is string => x !== null);
}

console.log("\n=== Une réponse juste traverse la chaîne ===\n");

cas("les huit points passent", () => {
  const perdus = verdict(reponseJuste());
  assert.deepEqual(perdus, [], `perdus : ${perdus.join(" · ")}`);
});

cas("et le devis compte au moins quatre lignes", () => {
  // Les cinq travaux, moins l'évacuation qui rejoint l'abattage.
  const lu = lireLaChaine(reponseJuste());
  assert.equal(lu.lignes.length, 4, lu.lignes.map((l) => l.cle).join(", "));
  assert.ok(lu.lignes.some((l) => l.cle === "tonte"), "la tonte n'a pas sa ligne");
});

console.log("\n=== Une réponse abîmée est REFUSÉE, et le motif désigne le coupable ===\n");

cas("une quantité perdue est vue", () => {
  const p = reponseJuste();
  p.prestations[0].quantite = null;
  assert.ok(verdict(p).some((q) => /haie/.test(q)), "800 ml perdus sans que rien ne le dise");
});

cas("une espèce perdue est vue", () => {
  const p = reponseJuste();
  p.prestations[1].espece = null;
  assert.ok(verdict(p).some((q) => /démontage/.test(q)));
});

cas("« deux hommes » devenu une quantité de prestation est vu", () => {
  // Le défaut exact que l'invite interdit : la taille d'équipe transformée en
  // travail à facturer.
  const p = reponseJuste();
  p.prestations.push(
    PropositionExtractionSchema.parse({
      prestations: [{ libelle: "Deux hommes", quantite: "2", unite: "homme" }],
    }).prestations[0]
  );
  assert.ok(verdict(p).some((q) => /équipe/.test(q)));
});

cas("une nature INVENTÉE est vue", () => {
  const p = reponseJuste();
  p.prestations[4].nature = "amenagement_paysager_complet";
  assert.ok(verdict(p).some((q) => /inventée/.test(q)), "une taxonomie inventée est passée");
});

cas("une tonte qui repart avec l'abattage est vue", () => {
  // Le défaut du 26 août. Sans nature, la tonte redevient un travail que le
  // produit ne nomme pas — elle garde sa ligne, mais le contrôle de nature, lui,
  // doit rougir.
  const p = reponseJuste();
  p.prestations[4].nature = null;
  assert.ok(verdict(p).some((q) => /tonte/.test(q)));
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
