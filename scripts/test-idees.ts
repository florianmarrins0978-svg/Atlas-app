// UNE IDÉE POUR L'APPLI — les règles, sans base ni navigateur
// (`src/lib/idees.ts`, sa planche du 5 novembre 2026).
//
// Ce qui se fixe ici, c'est ce qu'il a DIT : la date seule, ni l'heure, ni « à
// la voix », ni l'écran d'où vient l'idée ; « Dans l'appli » chez l'artisan,
// « Faite » chez l'éditeur ; un courriel qui ne porte jamais le texte.

import assert from "node:assert/strict";
import {
  courrielDAlerte,
  dateDeLIdee,
  ideeFaiteRecemment,
  IDEE_FAITE_SE_DIT_PENDANT_JOURS,
  libelleDuTri,
  libelleEtatIdee,
  nomDeLAuteur,
  nouvellesEnMots,
  ongletDeLIdee,
  quiAEnvoye,
  texteDIdeeValide,
  TEXTE_IDEE_MAX,
  tonEtatIdee,
  trisPossibles,
} from "../src/lib/idees";

let passes = 0;
let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    passes++;
  } catch (e) {
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
    echecs++;
  }
}

console.log("=== Une idée pour l'appli : les règles ===");

essai("l'artisan lit « Dans l'appli », l'éditeur touche « Faite »", () => {
  assert.equal(libelleEtatIdee("faite"), "Dans l'appli");
  assert.equal(libelleDuTri("faite"), "Faite");
  assert.equal(libelleEtatIdee("envoyee"), "Envoyée");
  assert.equal(libelleEtatIdee("pas_prevue"), "Pas prévue");
});

essai("bleu pour ce qui vient, vert pour ce qui est là, rien pour le reste", () => {
  assert.equal(tonEtatIdee("prevue"), "bleu");
  assert.equal(tonEtatIdee("faite"), "vert");
  assert.equal(tonEtatIdee("envoyee"), "neutre");
  assert.equal(tonEtatIdee("pas_prevue"), "neutre");
});

essai("trois onglets : une idée faite ou refusée est traitée", () => {
  assert.equal(ongletDeLIdee("envoyee"), "nouvelles");
  assert.equal(ongletDeLIdee("prevue"), "prevues");
  assert.equal(ongletDeLIdee("faite"), "traitees");
  assert.equal(ongletDeLIdee("pas_prevue"), "traitees");
});

essai("les gestes suivent l'onglet de la planche", () => {
  assert.deepEqual(trisPossibles("envoyee"), ["prevue", "pas_prevue"]);
  assert.deepEqual(trisPossibles("prevue"), ["faite"]);
  assert.deepEqual(trisPossibles("faite"), []);
  assert.deepEqual(trisPossibles("pas_prevue"), []);
});

essai("un texte vide ne part pas, un texte trop long non plus, le reste part rogné", () => {
  assert.deepEqual(texteDIdeeValide("   "), { ok: false, message: "Écrivez d'abord votre idée." });
  assert.equal(texteDIdeeValide(undefined).ok, false);
  assert.equal(texteDIdeeValide("x".repeat(TEXTE_IDEE_MAX + 1)).ok, false);
  assert.deepEqual(texteDIdeeValide("  Voir la météo  "), { ok: true, texte: "Voir la météo" });
  assert.deepEqual(texteDIdeeValide("", 10, "Écrivez d'abord votre réponse."), { ok: false, message: "Écrivez d'abord votre réponse." });
});

essai("la date seule, jamais l'heure : sa règle du 5 novembre", () => {
  const maintenant = new Date("2026-11-05T20:00:00Z");
  assert.equal(dateDeLIdee(new Date("2026-11-05T13:32:00Z"), maintenant), "Le 5 novembre");
  assert.equal(dateDeLIdee(new Date("2026-11-01T09:00:00Z"), maintenant), "Le 1er novembre");
  // Un autre an se dit, sinon « le 3 mars » se lirait comme cette année.
  assert.equal(dateDeLIdee(new Date("2025-03-03T09:00:00Z"), maintenant), "Le 3 mars 2025");
  assert.doesNotMatch(dateDeLIdee(new Date("2026-11-05T13:32:00Z"), maintenant), /\d+\s*h/);
});

essai("qui l'a envoyée, en une phrase, sans « à la voix » ni l'écran", () => {
  assert.equal(quiAEnvoye("Marc", "proprietaire", "Jardins Démo"), "Marc, patron chez Jardins Démo.");
  assert.equal(quiAEnvoye("Lucas", "salarie", "Jardins Démo"), "Lucas, salarié chez Jardins Démo.");
  assert.equal(quiAEnvoye("Sophie", "facturation", "Jardins Démo"), "Sophie, à la facturation chez Jardins Démo.");
  assert.doesNotMatch(quiAEnvoye("Marc", "proprietaire", "Jardins Démo"), /voix|écrite|depuis/);
});

essai("le nom figé : le prénom, sinon le nom, sinon l'adresse", () => {
  assert.equal(nomDeLAuteur({ prenom: " Marc ", nom: "Lefort", email: "m@x.fr" }), "Marc");
  assert.equal(nomDeLAuteur({ prenom: null, nom: "Lefort", email: "m@x.fr" }), "Lefort");
  assert.equal(nomDeLAuteur({ prenom: "", nom: " ", email: "m@x.fr" }), "m@x.fr");
});

essai("« Votre idée est dans l'appli » se dit deux semaines, puis se tait", () => {
  const faite = new Date("2026-11-01T10:00:00Z");
  const dans = (jours: number) => new Date(faite.getTime() + jours * 86_400_000);
  assert.equal(ideeFaiteRecemment({ etat: "faite", traiteeLe: faite }, dans(3)), true);
  assert.equal(ideeFaiteRecemment({ etat: "faite", traiteeLe: faite }, dans(IDEE_FAITE_SE_DIT_PENDANT_JOURS + 1)), false);
  assert.equal(ideeFaiteRecemment({ etat: "prevue", traiteeLe: faite }, dans(1)), false);
  assert.equal(ideeFaiteRecemment({ etat: "faite", traiteeLe: null }, dans(1)), false);
});

essai("la pastille de l'éditeur : rien à zéro, le singulier à un", () => {
  assert.equal(nouvellesEnMots(0), null);
  assert.equal(nouvellesEnMots(1), "1 nouvelle");
  assert.equal(nouvellesEnMots(3), "3 nouvelles");
});

essai("le courriel dit QUI, jamais QUOI : il ne reçoit même pas le texte", () => {
  // La fonction ne prend que le nom de l'entreprise : le texte d'une idée ne
  // peut donc pas y entrer, même par erreur.
  assert.equal(courrielDAlerte.length, 1);
  const c = courrielDAlerte("Jardins Démo");
  assert.match(c.texte, /Jardins Démo vous a envoyé une idée/);
  assert.match(c.texte, /Réglages, puis Les idées reçues/);
});

console.log(`\n${passes} réussi(s), ${echecs} échec(s)`);
if (echecs > 0) process.exit(1);
