import assert from "node:assert/strict";
import {
  DELAI_MINIMAL_JOURS,
  FENETRE_PROPOSITION_JOURS,
  HORIZON_PATRON_JOURS,
  MARGE_AUTOUR_PROPOSITION_JOURS,
  ajouterJours,
  bandesVisibles,
  fenetrePatron,
  fenetrePourDates,
  jourVisible,
  fenetreProposition,
  versJourIso,
} from "../src/server/disponibilites";

// **« Comment je fais si je dois lui proposer une date dans six mois ? »**
// — le patron, le 8 août 2026, sur un écran qui ne suggérait que les six
// prochains jours ouvrés et n'offrait aucune autre porte.
//
// Ce que cette suite tient, et c'est **une décision de confidentialité autant
// qu'une commodité** : les deux horizons sont séparés.
//
//   - ce que LE PATRON peut retenir : dix-huit mois ;
//   - ce que LE CLIENT voit : trois mois, ou une bande de trois semaines autour
//     d'une date lointaine.
//
// Les confondre coûterait cher dans les deux sens. Aligner le client sur le
// patron lui livrerait un an et demi de carnet de commandes — la page publique
// reçoit la liste des jours occupés (`docs/AGENT.md` §2.2 bis). Aligner le
// patron sur le client lui interdirait l'automne prochain, et le renverrait au
// téléphone : exactement ce que ce parcours existe pour supprimer.

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

const LUNDI = new Date("2026-08-10T09:00:00Z");
const jour = (dans: number) => versJourIso(ajouterJours(LUNDI, dans));

console.log("=== Ce que le patron peut proposer : dix-huit mois ===\n");

cas("l'horizon va d'après-demain à dix-huit mois", () => {
  const h = fenetrePatron(LUNDI);
  assert.equal(h.debut, jour(DELAI_MINIMAL_JOURS));
  assert.equal(h.fin, jour(HORIZON_PATRON_JOURS));
});

cas("une date à six mois y tient — c'était sa demande", () => {
  const h = fenetrePatron(LUNDI);
  const dansSixMois = jour(182);
  assert.ok(dansSixMois >= h.debut && dansSixMois <= h.fin, `${dansSixMois} hors de [${h.debut} … ${h.fin}]`);
});

cas("une haie « à l'automne prochain » aussi — quatorze mois", () => {
  // L'élagage est saisonnier : un horizon à douze mois renverrait ce client-là
  // au téléphone. C'est la raison du chiffre, et elle mérite un contrôle.
  const h = fenetrePatron(LUNDI);
  assert.ok(jour(425) <= h.fin, "quatorze mois sortent de l'horizon");
});

cas("l'horizon du patron déborde LARGEMENT la fenêtre du client", () => {
  // Le contrôle qui verrait quelqu'un « simplifier » en réunissant les deux.
  assert.ok(
    HORIZON_PATRON_JOURS > FENETRE_PROPOSITION_JOURS * 3,
    "les deux horizons se sont rapprochés : soit le patron a perdu l'automne prochain, soit le client a gagné le carnet de commandes"
  );
});

console.log("\n=== Ce que le client voit : le cas ordinaire ne bouge pas ===");

cas("des dates proches laissent la fenêtre de trois mois intacte", () => {
  const f = fenetrePourDates(LUNDI, [jour(5), jour(9)]);
  assert.deepEqual(f, fenetreProposition(LUNDI));
});

cas("une date pile à la limite des trois mois ne déplace rien", () => {
  const f = fenetrePourDates(LUNDI, [jour(FENETRE_PROPOSITION_JOURS)]);
  assert.deepEqual(f, fenetreProposition(LUNDI));
});

cas("aucune date proposée : la fenêtre ordinaire", () => {
  assert.deepEqual(fenetrePourDates(LUNDI, []), fenetreProposition(LUNDI));
});

console.log("\n=== Une date lointaine déplace la fenêtre, sans l'élargir ===");

cas("la fenêtre se resserre AUTOUR de la proposition", () => {
  const dansSixMois = jour(182);
  const f = fenetrePourDates(LUNDI, [dansSixMois]);
  assert.equal(f.debut, versJourIso(ajouterJours(new Date(`${dansSixMois}T12:00:00Z`), -MARGE_AUTOUR_PROPOSITION_JOURS)));
  assert.equal(f.fin, versJourIso(ajouterJours(new Date(`${dansSixMois}T12:00:00Z`), MARGE_AUTOUR_PROPOSITION_JOURS)));
});

cas("le client ne voit JAMAIS six mois de planning", () => {
  // **Le contrôle qui protège son carnet de commandes.** Étendre bêtement la
  // fenêtre d'aujourd'hui jusqu'à la date lointaine aurait livré cent
  // quatre-vingts jours de disponibilités à quelqu'un qui n'a rien signé.
  const f = fenetrePourDates(LUNDI, [jour(182)]);
  const largeur =
    (Date.parse(`${f.fin}T00:00:00Z`) - Date.parse(`${f.debut}T00:00:00Z`)) / 86_400_000;
  assert.ok(
    largeur <= 2 * MARGE_AUTOUR_PROPOSITION_JOURS + 1,
    `la fenêtre montrée au client fait ${largeur} jours — c'est son planning qui part chez le client`
  );
});

cas("deux dates lointaines : la bande les couvre toutes les deux", () => {
  const f = fenetrePourDates(LUNDI, [jour(182), jour(200)]);
  assert.ok(f.debut <= jour(182), "la première date proposée est hors de la fenêtre du client");
  assert.ok(f.fin >= jour(200), "la seconde date proposée est hors de la fenêtre du client");
});

cas("une date lointaine et une proche : les deux restent retenables", () => {
  // Le cas mixte — « soit jeudi, soit à la Toussaint ». La fenêtre doit couvrir
  // les deux, sinon le client lit « plus disponible » sur une date que le
  // patron vient de lui proposer.
  const f = fenetrePourDates(LUNDI, [jour(4), jour(182)]);
  assert.ok(f.debut <= jour(4), `la date proche ${jour(4)} tombe avant ${f.debut}`);
  assert.ok(f.fin >= jour(182), `la date lointaine ${jour(182)} tombe après ${f.fin}`);
});

console.log("\n=== Le cas mixte : la fenêtre s'étire, ce qu'on MONTRE non ===");

// **Le défaut que j'ai introduit puis corrigé le 8 août 2026, avant de livrer.**
// La première version ne connaissait qu'une fenêtre. « Soit jeudi, soit à la
// Toussaint » l'étirait de bout en bout — et livrait six mois de jours occupés
// au client, alors que tout ce travail sert précisément à ne pas le faire.
//
// D'où la séparation : l'ENVELOPPE dit ce qui est recevable, les BANDES disent
// ce qui se montre.

cas("les deux dates du cas mixte tombent chacune dans une bande", () => {
  const bandes = bandesVisibles(LUNDI, [jour(4), jour(182)]);
  assert.equal(bandes.length, 2, `attendu deux bandes, vu ${bandes.length}`);
  assert.ok(jourVisible(jour(4), bandes));
  assert.ok(jourVisible(jour(182), bandes));
});

cas("le MILIEU, lui, ne se montre pas", () => {
  const bandes = bandesVisibles(LUNDI, [jour(4), jour(182)]);
  for (const invisible of [jour(120), jour(140), jour(155)]) {
    assert.ok(
      !jourVisible(invisible, bandes),
      `${invisible} est montré au client : c'est le carnet de commandes du patron qui part`
    );
  }
});

cas("au total, le client voit au plus quatre mois de planning", () => {
  const bandes = bandesVisibles(LUNDI, [jour(4), jour(182)]);
  const jours = bandes.reduce(
    (somme, b) => somme + (Date.parse(`${b.fin}T00:00:00Z`) - Date.parse(`${b.debut}T00:00:00Z`)) / 86_400_000,
    0
  );
  assert.ok(jours <= 135, `${jours} jours montrés — l'étirement est revenu`);
});

cas("une date lointaine SEULE ne montre pas les trois prochains mois", () => {
  // S'il ne propose que la Toussaint, montrer les trois prochains mois
  // inviterait à une contre-proposition qu'il n'a pas voulue.
  const bandes = bandesVisibles(LUNDI, [jour(182)]);
  assert.equal(bandes.length, 1);
  assert.ok(!jourVisible(jour(5), bandes), "les jours proches sont montrés sans qu'il les ait proposés");
});

cas("deux dates lointaines voisines ne font qu'une bande", () => {
  // Sans fusion, un jour compris dans les deux serait listé deux fois, et le
  // client verrait la même date écrite en double.
  const bandes = bandesVisibles(LUNDI, [jour(182), jour(190)]);
  assert.equal(bandes.length, 1, `${bandes.length} bandes qui se chevauchent`);
});

cas("la fenêtre ne commence jamais avant après-demain", () => {
  // La marge de trois semaines en amont ne doit pas rouvrir hier.
  const f = fenetrePourDates(LUNDI, [jour(4), jour(182)]);
  assert.ok(f.debut >= jour(DELAI_MINIMAL_JOURS), `${f.debut} est avant le délai minimal`);
});

cas("toute date proposée tombe DANS la fenêtre montrée au client", () => {
  // La propriété qui compte, éprouvée sur tout l'horizon plutôt que sur trois
  // exemples : si elle tombe, le client lit « cette date n'est plus disponible »
  // pour un jour que personne n'a pris — et il n'a aucun moyen de le savoir.
  for (let dans = DELAI_MINIMAL_JOURS; dans <= HORIZON_PATRON_JOURS; dans += 7) {
    const date = jour(dans);
    const f = fenetrePourDates(LUNDI, [date]);
    assert.ok(date >= f.debut && date <= f.fin, `${date} hors de [${f.debut} … ${f.fin}]`);
  }
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
