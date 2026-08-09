import assert from "node:assert/strict";
import { libelleDateRelative } from "../src/lib/date-relative";

// La date des cartes de l'écran d'accueil, demandée par le patron le 9 août
// 2026 avec sa maquette : « Aujourd'hui », « Hier ».
//
// **Une date relative se trompe toujours aux mêmes endroits** — le passage de
// minuit, la fin d'année, une valeur absente — et aucun de ces cas ne se
// rencontre en cliquant sur un écran. Ils se posent ici.

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

/** Un mercredi de novembre, à 14 h — le milieu de journée le plus banal. */
const MAINTENANT = new Date(2026, 10, 18, 14, 0, 0);

console.log("=== Ce que l'artisan lit sur la carte ===");

cas("le jour même, quelle que soit l'heure", () => {
  assert.equal(libelleDateRelative(new Date(2026, 10, 18, 0, 5), MAINTENANT), "Aujourd'hui");
  assert.equal(libelleDateRelative(new Date(2026, 10, 18, 23, 55), MAINTENANT), "Aujourd'hui");
});

cas("la veille, même s'il ne s'est écoulé qu'une heure", () => {
  // **Le piège des dates relatives.** À 00 h 30, un chantier touché à 23 h 30
  // date d'une heure — et c'était HIER. Compter en millisecondes rend
  // « Aujourd'hui », ce qui contredit le calendrier que l'artisan a en tête.
  const justeApresMinuit = new Date(2026, 10, 18, 0, 30);
  assert.equal(libelleDateRelative(new Date(2026, 10, 17, 23, 30), justeApresMinuit), "Hier");
});

cas("dans la semaine, on compte les jours", () => {
  assert.equal(libelleDateRelative(new Date(2026, 10, 15), MAINTENANT), "Il y a 3 jours");
  assert.equal(libelleDateRelative(new Date(2026, 10, 12), MAINTENANT), "Il y a 6 jours");
});

cas("au-delà de la semaine, la date — sans l'année si c'est la même", () => {
  // « Il y a 23 jours » ne situe plus rien : c'est la date qu'on cherche.
  assert.equal(libelleDateRelative(new Date(2026, 9, 26), MAINTENANT), "26 oct.");
  assert.equal(libelleDateRelative(new Date(2026, 0, 3), MAINTENANT), "3 janv.");
});

cas("l'année n'apparaît que lorsqu'elle diffère", () => {
  // L'écrire toujours alourdirait douze mois de cartes pour le seul cas du
  // chantier de l'an dernier.
  assert.equal(libelleDateRelative(new Date(2025, 11, 24), MAINTENANT), "24 déc. 2025");
});

cas("un 1er janvier ne devient pas « hier » du 31 décembre", () => {
  const premierJanvier = new Date(2027, 0, 1, 9, 0);
  assert.equal(libelleDateRelative(new Date(2026, 11, 31, 18, 0), premierJanvier), "Hier");
  assert.equal(libelleDateRelative(new Date(2026, 11, 30, 18, 0), premierJanvier), "Il y a 2 jours");
});

console.log("\n=== Et rien ne fait tomber l'écran ===");

cas("une date absente ne rend rien, et surtout pas « Invalid Date »", () => {
  // La carte affiche alors une case vide. C'est laid une fois ; « Invalid
  // Date » sur un écran d'accueil, c'est une application cassée.
  for (const rien of [null, undefined, "", "pas une date"]) {
    assert.equal(libelleDateRelative(rien as never, MAINTENANT), "");
  }
});

cas("une chaîne ISO est acceptée telle que la base la rend", () => {
  assert.equal(libelleDateRelative(new Date(2026, 10, 18, 8, 0).toISOString(), MAINTENANT), "Aujourd'hui");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Date relative — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
