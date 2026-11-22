// LES COLLECTEURS DURA (les clarinettes) à 2, 3 et 4 sorties, et le Manchon union 1" FF, en PVC gris
// clair. Un collecteur est une pièce de la rangée du haut : un tube sur l'axe X, l'écrou union à gauche,
// le filetage mâle à droite, et ses sorties vers +Z, chacune à nez conique terminée par un écrou femelle.
//
// LES COTES sont relevées sur ses photos à plat (appli/arrosage-photos/clarinette-2v, 3v et
// 4v-dessus-naturel.png, union-ff-dessus-naturel.png). L'écrou, le col, l'alésage et le bout fileté sont
// ceux des coudes et du té (dura-coudes-te.js) : les mêmes moules, une seule taille d'écrou partout.
//
// CE QUI EST MESURÉ, ET CE QUI EST TRANCHÉ. Le tube fait 31,2 mm (0,94 fois le sommet du filetage, sur
// la photo du 2 sorties, la plus nette). Avec ce tube pour étalon : la première sortie est à 70 mm de la
// bouche de l'écrou (71,3, 65,6 et 69,9 mm sur les trois photos), la dernière à 51 mm de la pointe du
// filetage (51,6, 43,3 et 51,0), et deux sorties sont à 100 mm l'une de l'autre (101,3 sur le 2 sorties,
// 98,3 sur le 4, 93,3 sur le 3 dont la photo est quatre fois moins fine). Un même entraxe pour les
// trois : ce sont trois longueurs d'un même moule. Le 2 sorties mesure donc 221 mm (224 relevés), le 4
// sorties 421 (415 relevés), le 3 sorties 321 (295 relevés sur sa petite photo : c'est l'écart assumé).
// Ses photos à plat coupent chaque sortie au ras de son écrou : sa profondeur est celle de la branche du
// té (le collet à 26 mm de l'axe), la même pièce moulée.

import { boutAEcrou, boutFilete, DURA } from "./dura-coudes-te.js";

var UN_QUART = Math.PI / 2, DROITE = { ry: UN_QUART }, GAUCHE = { ry: -UN_QUART };
var TUBE = 15.6;          // le rayon du tube : 31,2 mm de diamètre
var PREMIERE = 70 - 30;   // l'axe de la première sortie, compté du collet de l'écrou de gauche (70 mm de sa bouche)
var ENTRAXE = 100;        // d'une sortie à la suivante
var DERNIERE = 51;        // de la dernière sortie à la pointe du filetage
var COLLET = 26;          // le collet de l'écrou d'une sortie, compté de l'axe du tube

// LE NEZ D'UNE SORTIE, sur l'axe Z local : un cône qui sort du tube et s'évase jusqu'à une collerette de
// la largeur de l'écrou (45 mm relevés là où l'écrou en fait 44), puis le col qui entre dans l'écrou.
// Huit petites nervures raidissent le bas du cône : on en voit trois par face sur ses photos.
function nez(F, lot, x) {
  var large = 20.8, haut = 20.6, ici = { x: x };
  lot.ajouter("pvc", F.tourne([[9, 6], [large, haut, { a: 1.6 }], [large, COLLET - 2.6, { a: 0.6 }], [DURA.COL, COLLET - 1.9, { a: 0.4 }], [DURA.COL, COLLET + 4]], { segments: 56 }), ici);
  var pente = Math.atan2(large - 9, haut - 6);
  for (var i = 0; i < 8; i++) {
    var nervure = new F.THREE.CapsuleGeometry(1.15, 4.6, 3, 8);
    nervure.rotateX(UN_QUART); nervure.rotateY(pente); nervure.translate(17.6, 0, 17.2); nervure.rotateZ(Math.PI / 8 + i * Math.PI / 4);
    lot.ajouter("pvc", nervure, ici);
  }
}

function collecteur(F, sorties) {
  var lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" });
  var pointeVisee = PREMIERE + (sorties - 1) * ENTRAXE + DERNIERE, debut = pointeVisee - DURA.NEZ - DURA.FILETS * F.GAZ["1"].pas;
  // L'écrou union : son collet en x = 0, sa bouche à gauche.
  var bouche = boutAEcrou(F, lot, 0, GAUCHE, 0.2);
  // Le col (21 mm entre l'écrou et le tube, relevés sur le 2 sorties), l'épaule, le tube, puis le fond du filet.
  lot.ajouter("pvc", F.tourne([[DURA.COL, -4], [DURA.COL, 20.2, { a: 0.5 }], [TUBE, 21, { a: 0.7 }], [TUBE, debut - 0.6, { a: 0.4 }], [fond, debut]], {}), DROITE);
  var pointe = boutFilete(F, lot, debut, 14.95, DROITE);
  var branches = [];
  for (var i = 0; i < sorties; i++) {
    var x = PREMIERE + i * ENTRAXE;
    nez(F, lot, x);
    var face = boutAEcrou(F, lot, COLLET, { x: x }, i * 0.31);
    branches.push({ x: x, z: face, genre: "femelle", gaz: "1", prise: DURA.PRISE });
  }
  return { couches: lot.couches(), gauche: { x: -bouche, genre: "femelle", gaz: "1", prise: DURA.PRISE },
    droite: { x: pointe, genre: "male", gaz: "1", prise: pointe - debut }, branches: branches };
}

export default {
  "clarinette-2v": function (F) { return collecteur(F, 2); },
  "clarinette-3v": function (F) { return collecteur(F, 3); },
  "clarinette-4v": function (F) { return collecteur(F, 4); },

  // LE MANCHON UNION 1" FF (union-ff-dessus-naturel.png, l'écrou de 40 mm pour étalon : 6,8 pixels par
  // millimètre). Pièce de colonne : un écrou à chaque bout, la bouche vers l'extérieur ; entre les deux
  // collets, 34,7 mm de corps (25,8 mm de diamètre) avec sa bague au milieu (27,9 mm, 8,7 mm de large).
  "union": function (F) {
    var lot = new F.Lot(), entre = 34.7, bas = DURA.ECROU + entre, corps = 12.9, bague = 13.95, milieu = DURA.ECROU + entre / 2;
    // L'écrou du haut est le même, retourné : sa bouche en z = 0.
    boutAEcrou(F, lot, 0, { ry: Math.PI, z: DURA.ECROU }, 0.2);
    var L = boutAEcrou(F, lot, bas, null);
    lot.ajouter("pvc", F.tourne([[DURA.COL, DURA.ECROU - 4], [DURA.COL, DURA.ECROU + 1.2, { a: 0.4 }], [corps, DURA.ECROU + 2, { a: 0.5 }], [corps, milieu - 4.9, { a: 0.4 }],
      [bague, milieu - 4.35, { a: 0.5 }], [bague, milieu + 4.35, { a: 0.5 }], [corps, milieu + 4.9, { a: 0.4 }], [corps, bas - 2, { a: 0.5 }], [DURA.COL, bas - 1.2, { a: 0.4 }], [DURA.COL, bas + 4]], {}));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "1", prise: DURA.PRISE }, bas: { z: L, genre: "femelle", gaz: "1", prise: DURA.PRISE } };
  }
};
