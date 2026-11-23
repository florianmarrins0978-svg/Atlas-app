// LES PIÈCES DE LA PILE DU ROBINET EN 3D, pour ses neuf combinaisons (composition.js). Chaque pièce
// neuve a son fichier ; le PEHD Ø25 est celui de la nourrice (sa demande du 22 novembre 2026 : « pour
// le PE diam. 25 reprends celui de la maquette 3D », et le même pour le Ø32, qui ne se verrait pas
// autrement). Le Ø16 prend le tube de sa photo (tube-16.js). Même contrat que les pièces de la
// nourrice (nourrice-3d/pieces/index.js) : une fonction qui reçoit les formes et rend ses couches et
// ses bouts de vissage.

import * as F from "../../nourrice-3d/formes.js";
import tuyaux from "../../nourrice-3d/pieces/mamelons-pehd.js";
import robinet from "./robinet.js";
import doubleSortie from "./double-sortie.js";
import programmateur from "./programmateur-solem.js";
import raccord from "./raccord-femelle.js";
import rainBird from "./programmateur-rainbird.js";
import buddy from "./programmateur-buddy.js";
import raccord16 from "./raccord-plasson16.js";
import embout16 from "./embout-palaplast16.js";
import tube16 from "./tube-16.js";

var FAMILLES = [robinet, doubleSortie, programmateur, raccord, { pehd: tuyaux.pehd }, rainBird, buddy, raccord16, embout16, tube16];

export function creerPieces() {
  var pieces = {};
  F.finesse(1);
  FAMILLES.forEach(function (famille) { Object.keys(famille).forEach(function (cle) { pieces[cle] = famille[cle](F); pieces[cle].cle = cle; }); });
  return pieces;
}
