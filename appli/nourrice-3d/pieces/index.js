// LES PIÈCES DE LA NOURRICE EN 3D, par leur clé du catalogue (appli/arrosage-catalogue.js,
// CATALOGUE.piecesNourrice). Chaque famille a son fichier ; chaque pièce y est une fonction qui reçoit
// les formes (formes.js) et rend ses couches (une géométrie par matière) et ses bouts de vissage, tels
// que composition.js les lit.

import * as F from "../formes.js";
import coudesEtTe from "./dura-coudes-te.js";
import collecteursEtUnion from "./dura-collecteurs-union.js";
import electrovannes from "./electrovannes.js";
import vanneEtRegulateur from "./vanne-regulateur.js";
import mamelonsEtTuyau from "./mamelons-pehd.js";
import raccordPlasson from "./plasson-raccord.js";

var FAMILLES = [coudesEtTe, collecteursEtUnion, electrovannes, vanneEtRegulateur, mamelonsEtTuyau, raccordPlasson];

// Rend { clé : { couches, haut, bas } ou { couches, gauche, droite, branches } } pour toutes les pièces,
// à la finesse demandée (1 d'office). Les bouts de vissage sont les mêmes à toute finesse : seule la
// rondeur des formes change.
export function creerPieces(k) {
  var pieces = {};
  F.finesse(k || 1);
  FAMILLES.forEach(function (famille) { Object.keys(famille).forEach(function (cle) { pieces[cle] = famille[cle](F); pieces[cle].cle = cle; }); });
  F.finesse(1);
  return pieces;
}
