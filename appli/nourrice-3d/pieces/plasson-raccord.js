// LE RACCORD MÂLE PLASSON 25 x 1" : le filetage mâle 1" en haut, le corps noir à ailettes, la bague
// blanche cannelée où entre le tuyau. Pièce de colonne, sur l'axe Z local, de la pointe du filetage
// (z = 0) à la bouche de la bague (z = L).
//
// D'OÙ VIENNENT LES COTES. Sa seule photo à plat est celle du 32 x 1" (raccord-male32-dessus.png), le
// même raccord en plus gros du côté du tuyau. Son filetage 1" y fait 177,5 px au sommet des filets pour
// 33,25 mm : 5,34 px par millimètre. Le filetage et son col se gardent tels quels (c'est le même 1") ;
// tout le reste, de la collerette du corps au bout de la bague, est ramené de 32 à 25 par 25/32, faute
// d'une cote réelle du 25 x 1" dans ses photos. Chaque cote dit donc ce qu'elle fait sur la photo du
// 32 (en pixels), et ce que cela donne ici.
// Deux réserves sur cet étalon. Le pas du filetage, lui, donne 5,05 px par millimètre (neuf filets
// tous les 11,65 px) : les longueurs sont tenues à 5 % près, pas mieux. Et la photo est prise d'assez
// près pour que le bout de la bague, vu en biais, paraisse bombé : son plan est pris là où son arrondi
// finit sur la silhouette (x = 620), pas au dernier pixel (x = 636).
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : le passage de l'eau, tout le dedans de la bague
// (la lèvre, la bague de crampage, le joint, la butée du tuyau), et la profondeur où le tuyau entre
// (34 mm, la cote que le tuyau déclare lui aussi).

var L = 96;             // la bouche de la bague : x = 620 px sur la photo, soit 95,96 mm
var PRISE_TUYAU = 34;   // la profondeur où le tuyau bute : estimée, la même que celle du tuyau (mamelons-pehd.js)
var TUYAU = 12.75;      // le rayon de la bouche : le PEHD de 25 mm, et un quart de millimètre de jeu
var PASSAGE = 9.5;      // le passage de l'eau derrière la butée : celui du tube 25 x 3,0 (19 mm)
var ALESAGE = 11;       // le passage du côté fileté : estimé (le fond du filet, moins 4 mm de paroi)

// LE CÔTÉ FILETÉ (les cotes du 32 x 1", telles quelles).
var FILET = { debut: 1.1, fin: 21.7 };   // neuf filets comptés, de x = 8 à x = 118 px
var COL = 15.4;         // le col lisse entre le filetage et la collerette : 164 px de diamètre
var BRIDE = 25.3;       // là où la collerette quitte le col : x = 137 px

// LE CORPS NOIR, ramené de 32 à 25.
var COLLERETTE = { r: 24.1, fin: 32 };       // 330 px de diamètre ; sa jante finit en x = 183 px
var NOYAU = 17.9;                            // le fût entre les ailettes : 120 px du pied d'une ailette à l'axe
var ANNEAU = { r: 23.3, z0: 49.1, z1: 53.3 };   // l'anneau devant la bague : 319 px, de x = 300 à x = 329 px
// Six ailettes, à 60 degrés l'une de l'autre : deux se voient du dessus (à 20 et 40 degrés de part et
// d'autre de l'axe de la photo), deux font la silhouette. 4,1 mm d'épaisseur sur le 32, soit 3,2 ici.
// Chacune finit, du côté de la collerette, par une tête qui en coiffe la jante et la dépasse un peu :
// ce sont les oreilles qu'on voit autour de la collerette sur ses photos de trois quarts.
var AILETTES = { nombre: 6, depart: 110, largeur: 3.2, r: 23.8, tete: 24.7 };

// LA BAGUE BLANCHE, ramenée de 32 à 25.
var FACE = 53.5;                             // la face de la bague, contre l'anneau du corps : x = 329 px
var COLLET = { r: 27.05, fin: 58.6 };        // sa collerette de devant : 370 px, jusqu'à x = 365 px
var FUT = { r: 24.2, fin: 79.5 };            // le fût : 331 px sous les nervures, jusqu'à x = 508 px
var EPAULE = { r0: 23.3, r1: 23, z0: 80.5, z1: 87.1 };   // 318 puis 314 px, jusqu'à x = 560 px
var NEZ = { r0: 20.15, r1: 19.9, z0: 89.2 };              // le bout étroit : 276 puis 272 px, dès x = 574 px
// Huit nervures (quatre se voient du dessus, à 45 degrés l'une de l'autre) : 357 px au sommet, 4 mm de
// large sur le 32. Elles partent de la collerette et finissent net au bout du fût.
var NERVURES = { nombre: 8, depart: 102, largeur: 3.1, r: 26.1 };
// La couronne de dents au bord de la bouche de devant, autour de l'anneau noir, au ras de la face : de
// 26 à 36 selon la photo où on les compte (OPL70302520.jpg, raccord-male32-dessus.png), 30 retenues.
var DENTS = { nombre: 30, largeur: 2.6, r0: 23.9, r1: 25.6, z0: FACE + 0.1, z1: 56 };
// Les petites lumières du bout étroit, juste sous l'épaule : une quinzaine se voient sur la moitié du
// tour. Leur longueur (de 2,5 à 4 mm sur le 32, selon ce qu'on retire à la perspective) est estimée.
var LUMIERES = { nombre: 32, largeur: 0.45, z0: 89.8, z1: 91.8 };

function degres(a) { return a * Math.PI / 180; }

// UNE BARRE LE LONG DE L'AXE, à l'angle `angle` autour de lui : une ailette du corps, une nervure ou une
// dent de la bague. Son pied est noyé dans ce qui la porte (`rDedans`), son dos est arrondi (`coin`).
function barre(F, o) {
  var d = o.largeur / 2, coin = o.coin ? { a: o.coin, fin: 0.8 } : null;
  var g = F.prisme([[-d, o.rDedans], [d, o.rDedans], [d, o.rDehors, coin], [-d, o.rDehors, coin]], o.z0, o.z1, { arrondi: o.arrondi });
  return F.placer(g, { rz: o.angle - Math.PI / 2 });
}

// LE BOUT FILETÉ 1" : la face du bout (deux cercles posés sur le plan z = 0, que la scène mesure), le
// chanfrein d'entrée, le filetage, et le passage qu'on voit dedans.
function boutFilete(F, lot) {
  var fond = F.rayonDuFond({ gaz: "1" });
  lot.ajouter("noirLisse", F.tourne([[ALESAGE, 30], [ALESAGE, 0, { c: 0.5 }], [14.3, 0, { c: 0.3 }], [fond, FILET.debut]], { segments: 40 }));
  lot.ajouter("noirLisse", F.filetage({ gaz: "1", z0: FILET.debut, z1: FILET.fin, entree: 0.6, sortie: 0.5 }));
  lot.ajouter("creux", F.tourne([[0, 30], [ALESAGE, 30]], { segments: 24 }));
}

// LE CORPS NOIR : le col, la collerette bombée (sa face monte vite puis s'arrondit jusqu'à la jante, le
// profil relevé point par point sur la silhouette), le fût et son bandeau, l'anneau, puis ce qui entre
// dans la bague. Les ailettes vont de la jante de la collerette jusque sur l'anneau, qu'elles coiffent.
function corps(F, lot) {
  var fond = F.rayonDuFond({ gaz: "1" });
  lot.ajouter("noirLisse", F.tourne([
    [fond, FILET.fin], [COL, FILET.fin + 0.5], [COL, BRIDE, { a: 0.7, fin: 0.6 }],
    [18.6, 25.75], [20.6, 26.3], [22, 26.9], [23.3, 27.8], [23.95, 28.7], [COLLERETTE.r, 29.4],
    [COLLERETTE.r, COLLERETTE.fin, { a: 0.6, fin: 0.6 }], [NOYAU, COLLERETTE.fin, { a: 0.6, fin: 0.8 }],
    [NOYAU, 43], [NOYAU + 0.5, 43.3], [NOYAU + 0.5, 46.9], [NOYAU, 47.2],
    [NOYAU, ANNEAU.z0, { a: 0.6, fin: 0.8 }], [ANNEAU.r, ANNEAU.z0, { a: 0.7, fin: 0.6 }], [ANNEAU.r, ANNEAU.z1, { a: 0.7, fin: 0.6 }],
    [21, ANNEAU.z1], [21, 55.4], [25.3, 55.4]], { segments: 44 }));
  for (var i = 0; i < AILETTES.nombre; i++) {
    var angle = degres(AILETTES.depart + i * 360 / AILETTES.nombre);
    lot.ajouter("noirLisse", barre(F, { largeur: AILETTES.largeur, rDedans: NOYAU - 0.4, rDehors: AILETTES.r, coin: 0.9, arrondi: 0.7,
      z0: COLLERETTE.fin - 0.9, z1: ANNEAU.z0 + 2.6, angle: angle }));
    lot.ajouter("noirLisse", barre(F, { largeur: AILETTES.largeur + 0.6, rDedans: NOYAU + 3, rDehors: AILETTES.tete, coin: 1, arrondi: 0.7,
      z0: COLLERETTE.fin - 1.9, z1: COLLERETTE.fin + 1.6, angle: angle }));
  }
}

// LA BAGUE BLANCHE, d'un seul profil tourné : la bouche de devant, la collerette, le fût, l'épaule, le
// bout étroit et son arrondi, la face du bout (posée sur le plan z = L), puis la lèvre de la bouche où
// entre le tuyau. Dessus : les nervures, la couronne de dents, les lumières.
function bague(F, lot) {
  lot.ajouter("blanc", F.tourne([
    [25.4, 57], [25.4, FACE + 0.05],
    // Le bord de devant de la collerette est tout en arrondi (1,6 mm : 13 px sur le 32, ramenés à 25).
    [25.45, FACE], [26.06, FACE + 0.12], [26.58, FACE + 0.47], [26.93, FACE + 0.99], [COLLET.r, FACE + 1.6],
    [COLLET.r, COLLET.fin, { a: 0.5, fin: 0.6 }], [FUT.r, COLLET.fin, { a: 0.5, fin: 0.8 }],
    [FUT.r, FUT.fin, { a: 0.6 }], [EPAULE.r0, EPAULE.z0, { a: 0.5 }], [EPAULE.r1, EPAULE.z1, { a: 0.9, fin: 0.45 }], [NEZ.r0, NEZ.z0, { a: 0.8, fin: 0.45 }],
    [NEZ.r1, L, { a: 2.3, fin: 0.35 }], [TUYAU, L, { c: 0.7 }],
    // La lèvre, puis la gorge qui la sépare de la bague de crampage, blanche elle aussi.
    [TUYAU, L - 6], [13.4, L - 6], [13.4, L - 6.6], [12.65, L - 6.6], [12.65, L - 18]], { segments: 52 }));
  var i;
  for (i = 0; i < NERVURES.nombre; i++) {
    lot.ajouter("blanc", barre(F, { largeur: NERVURES.largeur, rDedans: FUT.r - 0.4, rDehors: NERVURES.r, coin: 0.5, arrondi: 0.5,
      z0: COLLET.fin - 0.3, z1: FUT.fin + 0.6, angle: degres(NERVURES.depart + i * 360 / NERVURES.nombre) }));
  }
  for (i = 0; i < DENTS.nombre; i++) {
    lot.ajouter("blanc", barre(F, { largeur: DENTS.largeur, rDedans: DENTS.r0, rDehors: DENTS.r1, arrondi: 0,
      z0: DENTS.z0, z1: DENTS.z1, angle: degres(i * 360 / DENTS.nombre) }));
  }
  // Une lumière est une fente sombre dans la peau du bout étroit : une facette posée à 0,05 mm de lui.
  var pente = (NEZ.r1 - NEZ.r0) / (L - NEZ.z0), ouverture = LUMIERES.largeur / NEZ.r0;
  function peau(z) { return NEZ.r0 + pente * (z - NEZ.z0) + 0.05; }
  for (i = 0; i < LUMIERES.nombre; i++) {
    var a = i * 2 * Math.PI / LUMIERES.nombre;
    lot.ajouter("creux", F.tourne([[peau(LUMIERES.z0), LUMIERES.z0], [peau(LUMIERES.z1), LUMIERES.z1]], { arc: [a, a + ouverture], segments: 1 }));
  }
}

// CE QU'ON VOIT AU FOND DE LA BOUCHE, le tuyau retiré : le joint torique noir, le corps noir, la butée
// où le tuyau s'arrête, puis le passage de l'eau. Rien n'y descend sous le rayon du tuyau, qui y entre
// sans rien traverser ; la butée est 0,2 mm plus loin que PRISE_TUYAU, pour que le bout du tuyau ne
// se confonde pas avec elle.
function dedans(F, lot) {
  var butee = L - PRISE_TUYAU - 0.2;
  lot.ajouter("joint", F.tourne([[12.65, L - 18], [12.65, L - 22]], { segments: 32 }));
  lot.ajouter("noirLisse", F.tourne([[TUYAU, L - 22], [TUYAU, butee, { a: 0.4 }], [PASSAGE, butee, { c: 0.4 }], [PASSAGE, butee - 18]], { segments: 32 }));
  lot.ajouter("creux", F.tourne([[PASSAGE, butee - 18], [0, butee - 18]], { segments: 24 }));
}

export default {
  "raccord-male25": function (F) {
    var lot = new F.Lot();
    boutFilete(F, lot); corps(F, lot); bague(F, lot); dedans(F, lot);
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "1", prise: FILET.fin }, bas: { z: L, genre: "femelle", gaz: "pe25", prise: PRISE_TUYAU } };
  }
};
