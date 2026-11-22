// LES COLLECTEURS DURA (les clarinettes) à 2, 3 et 4 sorties, et le Manchon union 1" FF, en PVC gris
// clair. Un collecteur est une pièce de la rangée du haut : un tube sur l'axe X, l'écrou union à gauche,
// le filetage mâle à droite, et ses sorties vers +Z, chacune à nez conique terminée par un écrou femelle.

var R = 19.5, ECROU = 36, FILET = 18;
// La longueur de chaque collecteur et la place de ses sorties (en fraction de la longueur), relevées sur
// ses photos pour la planche vue du dessus.
var COLLECTEURS = { "clarinette-2v": { W: 272, sorties: [0.3147, 0.7697] }, "clarinette-3v": { W: 434, sorties: [0.2214, 0.5378, 0.8526] },
  "clarinette-4v": { W: 509, sorties: [0.1668, 0.4038, 0.6395, 0.874] } };

function collecteur(F, cle) {
  var c = COLLECTEURS[cle], W = c.W, lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" });
  // L'écrou union, la bouche à gauche (x = 0).
  lot.ajouter("pvc", F.coucher(F.retourner(F.ecrouUnion({ longueur: ECROU }), ECROU)));
  lot.ajouter("pvc", F.coucher(F.tourne([[14, ECROU - 2], [17, ECROU - 2], [17, ECROU + 12, { a: 2 }], [R, ECROU + 16], [R, W - FILET - 6, { a: 1.5 }], [fond, W - FILET]], {})));
  lot.ajouter("pvc", F.coucher(F.filetage({ gaz: "1", z0: W - FILET, z1: W, pointe: "z1" })));
  lot.ajouter("pvc", F.coucher(F.tourne([[fond, W], [14, W], [14, ECROU - 2]], { segments: 40 })));
  var branches = c.sorties.map(function (s) {
    var x = s * W;
    lot.ajouter("pvc", F.tourne([[13, 6], [27, 8, { a: 3 }], [17, 30, { a: 2 }], [17, 36]], {}), { x: x });
    lot.ajouter("pvc", F.ecrouUnion({ longueur: ECROU }), { x: x, z: 32 });
    return { x: x, z: 32 + ECROU, genre: "femelle", gaz: "1", prise: 17 };
  });
  return { couches: lot.couches(), gauche: { x: 0, genre: "femelle", gaz: "1", prise: 17 }, droite: { x: W, genre: "male", gaz: "1", prise: FILET }, branches: branches };
}

export default {
  "clarinette-2v": function (F) { return collecteur(F, "clarinette-2v"); },
  "clarinette-3v": function (F) { return collecteur(F, "clarinette-3v"); },
  "clarinette-4v": function (F) { return collecteur(F, "clarinette-4v"); },
  // Le manchon union : deux écrous femelles, une bouche à chaque bout.
  "union": function (F) {
    var lot = new F.Lot(), L = 108;
    lot.ajouter("pvc", F.retourner(F.ecrouUnion({ longueur: ECROU }), ECROU));
    lot.ajouter("pvc", F.ecrouUnion({ longueur: ECROU }), { z: L - ECROU });
    lot.ajouter("pvc", F.tourne([[14, ECROU - 2], [17, ECROU - 2], [17, L / 2 - 5], [20, L / 2 - 5, { c: 0.8 }], [20, L / 2 + 5, { c: 0.8 }], [17, L / 2 + 5], [17, L - ECROU + 2], [14, L - ECROU + 2], [14, ECROU - 2]], {}));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "1", prise: 17 }, bas: { z: L, genre: "femelle", gaz: "1", prise: 17 } };
  }
};
