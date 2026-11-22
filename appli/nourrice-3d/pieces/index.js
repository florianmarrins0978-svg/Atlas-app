// LES PIÈCES DE LA NOURRICE EN 3D, par leur clé du catalogue (appli/arrosage-catalogue.js,
// CATALOGUE.piecesNourrice). Chaque famille a son fichier ; chaque pièce y est une fonction qui reçoit
// les formes (formes.js) et rend ses couches (une géométrie par matière) et ses bouts de vissage, tels
// que composition.js les lit.

import * as F from "../formes.js";
import coudesEtTe from "./dura-coudes-te.js";
import collecteursEtUnion from "./dura-collecteurs-union.js";
import electrovannes from "./electrovannes.js";
import vanneEtRegulateur from "./vanne-regulateur.js";
import mamelonsRaccordEtTuyau from "./mamelons-raccord-pehd.js";

var FAMILLES = [coudesEtTe, collecteursEtUnion, electrovannes, vanneEtRegulateur, mamelonsRaccordEtTuyau];

// Rend { clé : { couches, haut, bas } ou { couches, gauche, droite, branches } } pour toutes les pièces.
export function creerPieces() {
  var pieces = {};
  FAMILLES.forEach(function (famille) { Object.keys(famille).forEach(function (cle) { pieces[cle] = famille[cle](F); pieces[cle].cle = cle; }); });
  return pieces;
}
