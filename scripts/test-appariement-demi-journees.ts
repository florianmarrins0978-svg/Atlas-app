import assert from "node:assert/strict";
import {
  distanceOiseauKm,
  preselectionner,
  classer,
  phraseDistance,
  communeApprochee,
  SEUIL_OISEAU_KM,
  CANDIDATS_MONTRES,
  type CandidatDemiJournee,
  type CandidatClasse,
} from "../src/lib/appariement-demi-journees";

// **Les règles d'appariement de deux demi-journées, éprouvées sans base ni
// réseau** — c'est tout l'intérêt de les avoir mises dans `src/lib` (`CLAUDE.md`
// §3) : ce qui décide de ce que le patron voit se vérifie en quelques
// millisecondes, et se vérifie donc à chaque batterie.
//
// Ce que ces contrôles tiennent, et qui ne se voit sur aucune capture :
//
//   · **le vol d'oiseau ne doit JAMAIS déclencher d'appel** — c'est lui qui
//     protège le service public de l'IGN, et donc la fonction elle-même ;
//   · **le classement par la route peut inverser celui du vol d'oiseau**, sinon
//     la route ne servirait à rien et on l'aurait payée pour rien ;
//   · **rien ne se tait** : ni les chantiers écartés, ni ceux qu'on n'a pas su
//     situer. Un écran qui ne propose rien sans dire pourquoi passe pour une
//     panne — ce dépôt l'a déjà payé trois fois.

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

/** Des places de mairie, jamais une adresse de client. */
const SAINT_MARTIN = { latitude: 45.6483, longitude: 4.5622 };
const SAINTE_FOY = { latitude: 45.7106, longitude: 4.4308 };
const MORNANT = { latitude: 45.6156, longitude: 4.6717 };
const LYON = { latitude: 45.7578, longitude: 4.832 };
const BREST = { latitude: 48.3904, longitude: -4.4861 };

function chantier(nom: string, position: { latitude: number; longitude: number } | null): CandidatDemiJournee {
  return { chantierId: nom, nom, ou: null, position };
}

console.log("=== La distance à vol d'oiseau ===");

cas("deux fois le même point : zéro", () => {
  assert.equal(distanceOiseauKm(LYON, LYON), 0);
});

cas("Saint-Martin-en-Haut → Lyon : une quinzaine de kilomètres", () => {
  // Repère indépendant du code : la distance réelle est d'environ 25 km à vol
  // d'oiseau. Une fourchette large suffit — ce qu'on éprouve, c'est l'ordre de
  // grandeur, pas la cinquième décimale.
  const km = distanceOiseauKm(SAINT_MARTIN, LYON);
  assert.ok(km > 20 && km < 30, `${km.toFixed(1)} km : hors de toute vraisemblance.`);
});

cas("latitude et longitude ne sont pas interchangeables", () => {
  // **Le piège du GeoJSON**, et le seul qui produit des nombres crédibles tout
  // en étant faux : inversées, ces coordonnées tombent en Somalie. Sans ce
  // contrôle, l'erreur ne se verrait qu'à l'écran, dans une proposition « à
  // 4 800 km » que personne ne rattacherait à un ordre d'arguments.
  const juste = distanceOiseauKm(SAINT_MARTIN, MORNANT);
  const inverse = distanceOiseauKm(
    { latitude: SAINT_MARTIN.longitude, longitude: SAINT_MARTIN.latitude },
    { latitude: MORNANT.longitude, longitude: MORNANT.latitude }
  );
  assert.ok(juste < 20, `Trajet voisin mesuré à ${juste.toFixed(1)} km.`);
  assert.notEqual(Math.round(juste), Math.round(inverse));
});

console.log("\n=== La présélection : ce qui ne coûte aucun appel ===");

cas("les plus proches d'abord, et seulement trois", () => {
  const p = preselectionner(SAINT_MARTIN, [
    chantier("Lyon", LYON),
    chantier("Mornant", MORNANT),
    chantier("Sainte-Foy", SAINTE_FOY),
    chantier("Saint-Martin", SAINT_MARTIN),
  ]);
  assert.equal(p.aInterroger.length, CANDIDATS_MONTRES);
  assert.deepEqual(
    p.aInterroger.map((c) => c.nom),
    ["Saint-Martin", "Mornant", "Sainte-Foy"]
  );
});

cas("au-delà du seuil, on écarte — mais on sait le dire", () => {
  // Le nombre ET le plus proche des écartés : « 1 chantier plus loin, le premier
  // à 570 km » se lit ; « rien à proposer » se prend pour une panne.
  const p = preselectionner(SAINT_MARTIN, [chantier("Mornant", MORNANT), chantier("Brest", BREST)]);
  assert.deepEqual(
    p.aInterroger.map((c) => c.nom),
    ["Mornant"]
  );
  assert.equal(p.ecartes.combien, 1);
  assert.ok(p.ecartes.plusProcheKm !== null && p.ecartes.plusProcheKm > SEUIL_OISEAU_KM);
});

cas("aucun écarté : on ne dit rien plutôt qu'un zéro", () => {
  const p = preselectionner(SAINT_MARTIN, [chantier("Mornant", MORNANT)]);
  assert.equal(p.ecartes.combien, 0);
  assert.equal(p.ecartes.plusProcheKm, null);
});

cas("un chantier sans coordonnées n'est ni proposé ni oublié", () => {
  // **Le cas le plus fréquent au démarrage** : tous les chantiers créés avant la
  // migration 0045 n'ont pas de coordonnées. Les taire donnerait un écran
  // presque vide sans la moindre explication.
  const p = preselectionner(SAINT_MARTIN, [chantier("Mornant", MORNANT), chantier("Chez Dupont", null)]);
  assert.deepEqual(
    p.aInterroger.map((c) => c.nom),
    ["Mornant"]
  );
  assert.deepEqual(
    p.sansPosition.map((c) => c.nom),
    ["Chez Dupont"]
  );
});

cas("aucun candidat : trois sorties vides, aucune exception", () => {
  const p = preselectionner(SAINT_MARTIN, []);
  assert.deepEqual(p.aInterroger, []);
  assert.equal(p.ecartes.combien, 0);
  assert.deepEqual(p.sansPosition, []);
});

cas("la présélection ne touche pas à la liste qu'on lui donne", () => {
  const liste = [chantier("Lyon", LYON), chantier("Mornant", MORNANT)];
  preselectionner(SAINT_MARTIN, liste);
  assert.deepEqual(
    liste.map((c) => c.nom),
    ["Lyon", "Mornant"],
    "La liste d'origine a été triée sur place : l'appelant verrait son planning se réordonner tout seul."
  );
});

console.log("\n=== Le classement final, une fois la route connue ===");

function classe(nom: string, kmOiseau: number, kmRoute: number | null, minutesRoute: number | null): CandidatClasse {
  return { chantierId: nom, nom, ou: null, position: SAINT_MARTIN, kmOiseau, kmRoute, minutesRoute };
}

cas("la route peut inverser le classement du vol d'oiseau", () => {
  // **C'est la raison d'être de l'appel à l'IGN.** Écarts mesurés le 16 août :
  // ×1,33 à ×1,56 selon le trajet — un chantier derrière une colline paraît
  // proche sur une carte et se paie en camion. Si ce contrôle tombe, la route ne
  // sert plus à rien et l'on peut s'en passer.
  const ordonne = classer([
    classe("derrière la colline", 8, 19, 32),
    classe("par la vallée", 11, 13, 17),
  ]);
  assert.deepEqual(
    ordonne.map((c) => c.nom),
    ["par la vallée", "derrière la colline"]
  );
});

cas("un candidat sans route retombe derrière, il ne disparaît pas", () => {
  // Punir le patron d'une panne de service en lui cachant un chantier valable
  // serait le pire des deux mondes : il ne saurait même pas ce qu'il rate.
  const ordonne = classer([classe("service muet", 5, null, null), classe("connu", 12, 14, 20)]);
  assert.deepEqual(
    ordonne.map((c) => c.nom),
    ["connu", "service muet"]
  );
});

cas("aucune route connue : on retombe sur le vol d'oiseau", () => {
  const ordonne = classer([classe("loin", 30, null, null), classe("près", 6, null, null)]);
  assert.deepEqual(
    ordonne.map((c) => c.nom),
    ["près", "loin"]
  );
});

cas("le classement ne touche pas à la liste qu'on lui donne", () => {
  const liste = [classe("b", 30, 40, 50), classe("a", 6, 7, 8)];
  classer(liste);
  assert.deepEqual(
    liste.map((c) => c.nom),
    ["b", "a"]
  );
});

console.log("\n=== La commune, lue dans une adresse écrite à la main ===");

const COMMUNES: [string | null, string | null][] = [
  ["12 rue des Lilas, 69630 Chaponost", "Chaponost"],
  ["Place de la Mairie 69510 Soucieu-en-Jarrest", "Soucieu-en-Jarrest"],
  ["12 rue des Lilas, Chaponost", "Chaponost"],
  // Sans code postal ni virgule, on ne devine pas : mieux vaut ne rien écrire
  // sous le nom qu'une moitié de rue prise pour une commune.
  ["derrière l'église", null],
  ["", null],
  [null, null],
];

for (const [adresse, attendu] of COMMUNES) {
  cas(`« ${adresse ?? "(rien)"} » → ${attendu ?? "(rien)"}`, () => {
    assert.equal(communeApprochee(adresse), attendu);
  });
}

console.log("\n=== La phrase affichée ne ment pas sur ce qu'elle mesure ===");

cas("route connue : « à 12 km, 20 min de route »", () => {
  assert.equal(phraseDistance({ kmOiseau: 8, kmRoute: 12, minutesRoute: 20 }), "à 12 km, 20 min de route");
});

cas("durée seule : la route reste nommée", () => {
  assert.equal(phraseDistance({ kmOiseau: 8, kmRoute: null, minutesRoute: 20 }), "à 20 min de route");
});

cas("sans route : « à vol d'oiseau » est DIT, jamais sous-entendu", () => {
  // « à 8 km » tout court se lirait comme une distance routière, et le patron
  // partirait pour un quart d'heure de trajet qui en fait vingt-cinq.
  const p = phraseDistance({ kmOiseau: 8.4, kmRoute: null, minutesRoute: null });
  assert.equal(p, "à 8 km à vol d’oiseau");
  assert.ok(p.includes("vol d’oiseau"), "L’apostrophe doit être la même que partout ailleurs à l’écran.");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Appariement de deux demi-journées — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
