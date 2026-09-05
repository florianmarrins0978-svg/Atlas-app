/**
 * L'ÉTAT DE LA DICTÉE — une seule lecture pour les deux écrans.
 *
 * Ce que cette suite défend : qu'un échec, une attente et un texte de
 * remplacement ne puissent jamais être pris pour une transcription. C'est le
 * défaut du 5 septembre 2026 : les cinq états sortaient du même paragraphe, et
 * une transcription ÉCHOUÉE avait la forme d'une transcription réussie.
 *
 * Elle ne dit rien du dessin — c'est l'écran qui en décide, et il change.
 */
import assert from "node:assert/strict";
import { etatTranscription, transcriptionDisponible } from "../src/lib/etat-transcription";

const MARQUE = "[Transcription simulée — fournisseur de développement, 12 octets reçus]";

let reussis = 0;
function verifier(quoi: string, fn: () => void) {
  fn();
  reussis += 1;
  console.log(`  ✓ ${quoi}`);
}

console.log("=== L'état de la dictée ===\n");

verifier("aucune note : rien à lire", () => {
  assert.equal(etatTranscription(null, false), "aucune_note");
});

verifier("ses mots transcrits : écoutée", () => {
  assert.equal(
    etatTranscription({ transcription: "Élagage du grand chêne", transcriptionStatut: "reussie" }, false),
    "ecoutee"
  );
});

verifier("le prestataire travaille : en cours", () => {
  assert.equal(etatTranscription({ transcription: null, transcriptionStatut: "en_cours" }, false), "en_cours");
});

verifier("le prestataire a rendu une erreur : échouée", () => {
  assert.equal(etatTranscription({ transcription: null, transcriptionStatut: "echouee" }, false), "echouee");
});

verifier("la note est là, la transcription jamais lancée", () => {
  assert.equal(etatTranscription({ transcription: null, transcriptionStatut: null }, false), "jamais_lancee");
});

// ─── LE CŒUR DE CETTE SUITE ─────────────────────────────────────────────────
//
// Le texte de remplacement porte le statut « réussie » : c'est précisément ce
// qui l'a fait passer pour une transcription, et deux prestations que personne
// n'avait dictées se sont retrouvées dans le devis du patron.
verifier("un texte de remplacement n'est JAMAIS écouté, malgré son statut", () => {
  assert.equal(etatTranscription({ transcription: MARQUE, transcriptionStatut: "reussie" }, true), "non_transcrite");
});

verifier("et il ne renvoie pas non plus à la note vocale : la dictée existe", () => {
  const etat = etatTranscription({ transcription: MARQUE, transcriptionStatut: "reussie" }, true);
  assert.notEqual(etat, "jamais_lancee", "l'envoyer refaire sa dictée, c'est lui faire croire qu'il s'y est mal pris");
  assert.notEqual(etat, "aucune_note");
});

verifier("« réussie » sans texte n'est pas une transcription", () => {
  assert.equal(etatTranscription({ transcription: null, transcriptionStatut: "reussie" }, false), "jamais_lancee");
});

verifier("un seul état ouvre la suite du parcours", () => {
  const tous = ["ecoutee", "en_cours", "echouee", "non_transcrite", "jamais_lancee", "aucune_note"] as const;
  const ouverts = tous.filter((e) => transcriptionDisponible(e));
  assert.deepEqual(ouverts, ["ecoutee"], `${ouverts.join(", ")} ouvre(nt) la suite : seul « écoutée » le doit`);
});

console.log(`\n✅ ${reussis} contrôles, 0 échec.`);
