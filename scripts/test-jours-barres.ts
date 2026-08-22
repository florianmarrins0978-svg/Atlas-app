import assert from "node:assert/strict";
import { phraseJoursBarres, libelleJourBarre } from "../src/lib/jours-barres";
import { compterOccupation, jourRetenable, type JourIso } from "../src/server/disponibilites";

// Un jour barré doit dire POURQUOI il l'est.
//
// **Le patron, le 16 août 2026** : *« lorsque je veux remettre une journée sur
// le dix-huit, je ne peux pas ou alors c'est parce que je n'ai pas sectionné la
// demi-journée »*. Il cherchait la cause du mauvais côté, et l'écran l'y
// envoyait : il écrivait *« les jours barrés sont déjà pris »* alors que le 18
// était parfaitement vide.
//
// Ce contrôle tient les deux moitiés de la correction : le fait — un jour vide
// PEUT être barré —, et la phrase qui doit désormais le dire.

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

console.log("=== Ce qu'un jour barré veut dire ===");

// Un seul chantier d'une journée le mercredi 19, deux équipes... et les deux
// occupées, donc le 19 est vraiment plein.
const OCCUPATION = compterOccupation([
  { jour: "2026-08-19" as JourIso, moment: "matin", dureeDemiJournees: 2 },
  { jour: "2026-08-19" as JourIso, moment: "matin", dureeDemiJournees: 2 },
]);
const FENETRE = { debut: "2026-08-18" as JourIso, fin: "2026-09-30" as JourIso };
const barre = (jour: string, duree: number) =>
  !jourRetenable(jour as JourIso, duree, OCCUPATION, 2, FENETRE);

cas("LE FAIT : un jour VIDE se barre quand la durée déborde sur le lendemain", () => {
  // C'est la situation exacte de sa capture, et le cœur du malentendu.
  assert.equal(
    // **On lit l'occupation elle-même, plus une marque de calendrier.** Les
    // cinq marques ont disparu le 21 août 2026 avec le planning refait ; le
    // décor, lui, se dit aussi bien — et mieux — avec ce que la carte porte
    // vraiment pour ce jour-là.
    (OCCUPATION.get("2026-08-18:matin") ?? 0) + (OCCUPATION.get("2026-08-18:apres_midi") ?? 0),
    0,
    "le décor est faux : le 18 devait être vide pour que ce contrôle prouve quelque chose"
  );
  assert.equal(barre("2026-08-18", 1), false, "une demi-journée devrait tenir le 18");
  assert.equal(barre("2026-08-18", 2), false, "une journée devrait tenir le 18");
  assert.equal(
    barre("2026-08-18", 4),
    true,
    "deux jours partis du 18 déborderaient sur le 19, qui est plein"
  );
});

cas("LA PHRASE nomme la durée, jamais une occupation supposée", () => {
  const deuxJours = phraseJoursBarres(4);
  assert.match(deuxJours, /2 jours/, `« ${deuxJours} » ne dit pas la durée en cause`);
  assert.match(deuxJours, /déborderait/, "la phrase n'explique pas le débordement");
  assert.equal(phraseJoursBarres(2).includes("une journée"), true);
});

cas("la demi-journée a sa propre phrase : elle ne peut déborder sur rien", () => {
  // Lui servir « soit le chantier déborderait » rouvrirait le défaut corrigé,
  // en sens inverse : une demi-journée tient dans un seul créneau.
  const phrase = phraseJoursBarres(1);
  assert.doesNotMatch(phrase, /déborderait/, `« ${phrase} » promet un débordement impossible`);
  assert.match(phrase, /demi-journée/);
});

cas("la phrase ne prétend plus qu'un jour barré est « déjà pris »", () => {
  // **L'invariant à ne pas perdre.** C'est cette formulation-là qui a envoyé le
  // patron chercher une occupation inexistante. Elle ne doit revenir pour
  // aucune durée — y compris celles qu'on n'a pas listées ci-dessus.
  for (const demiJournees of [null, ...Array.from({ length: 12 }, (_, i) => i + 1)]) {
    const phrase = phraseJoursBarres(demiJournees);
    assert.doesNotMatch(
      phrase,
      /déjà pris/,
      `pour ${demiJournees} demi-journée(s) : « ${phrase} » accuse une occupation qui peut ne pas exister`
    );
  }
});

cas("LA CONSIGNE DU PATRON : la phrase du CLIENT ne chiffre jamais rien", () => {
  // **Rappelée par la batterie, pas par moi.** La première version de ce module
  // envoyait la durée jusqu'à la page du client — en toute bonne foi, puisque
  // c'est son chantier. `test-creneaux-planning.ts` l'a refusée : *« la durée du
  // chantier a fuité vers la page du client »*. Rien du découpage du planning
  // de l'artisan ne part chez lui, et ce n'est pas à une session de rouvrir cet
  // arbitrage.
  const phrase = phraseJoursBarres(null);
  assert.doesNotMatch(phrase, /\d/, `« ${phrase} » chiffre quelque chose`);
  assert.doesNotMatch(phrase, /demi-journée|une journée|\d+ ?jours?/, `« ${phrase} » nomme une durée`);
  assert.doesNotMatch(phrase, /déjà pris/, "la version fausse est revenue côté client");
  assert.match(phrase, /votre chantier/);

  const aria = libelleJourBarre(null);
  assert.doesNotMatch(aria, /\d/, `« ${aria} » chiffre quelque chose`);
  assert.doesNotMatch(aria, /demi-journée|une journée/, `« ${aria} » nomme une durée`);
  assert.doesNotMatch(aria, /déjà pris/);
});

cas("ce qu'entend un lecteur d'écran dit la même chose que la phrase", () => {
  // Deux publics, une seule vérité — sinon l'un des deux garde la version
  // fausse, et personne ne s'en aperçoit.
  assert.match(libelleJourBarre(4), /2 jours/);
  assert.doesNotMatch(libelleJourBarre(4), /déjà pris/);
  assert.match(libelleJourBarre(1), /demi-journée/);
});

cas("une durée absurde ne fabrique pas une phrase absurde", () => {
  // Une durée nulle ou négative ne devrait jamais arriver ; si elle arrive, la
  // phrase reste lisible plutôt que d'annoncer « 0 jours ».
  for (const duree of [0, -3, 1.4]) {
    assert.match(phraseJoursBarres(duree), /demi-journée/, `durée ${duree}`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Jours barrés — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
