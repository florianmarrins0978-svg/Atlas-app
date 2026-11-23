// LE RACCORD FEMELLE PLASSON 25 x 3/4" (Aqua Plus OPL70302520) : la bouche taraudée 3/4" en haut, le
// corps noir à ailettes, la bague grise cannelée où entre le tuyau PEHD Ø25. Pièce de colonne, sur l'axe
// Z local : la face de la bouche du haut en z = 0, la face du bout étroit en z = L.
//
// C'est la même famille que le raccord mâle 25 x 1" de la nourrice (nourrice-3d/pieces/plasson-raccord.js),
// dont le vocabulaire est repris ici : le corps noir à ailettes, la bague cannelée à nervures, le dedans
// de la bouche du tuyau (lèvre, bague de crampage, joint, butée).
//
// D'OÙ VIENNENT LES COTES. Sa photo (docs/robinet-3d-photos/plasson-femelle-25-OPL70302520.jpg, 896 x 1200,
// de face, debout) est prise d'un peu au-dessus : on voit dans la bouche du haut. L'étalon est cette
// bouche : son bord intérieur fait 285 pixels de large. Le filet femelle 3/4" a son sommet à 24,1 mm
// (le fond du filet mâle) ; avec le petit chanfrein d'entrée, la bouche fait 25,4 mm : 11,2 pixels par
// millimètre. La bague le recoupe : 615 pixels sur ses nervures, soit 54,9 mm, quand la bague du
// raccord mâle 25 x 1", ramenée de 32 à 25, fait 54,1 mm sur sa collerette. Les rayons se lisent sur la
// silhouette ; les hauteurs aussi, jamais devant : ce qui est devant la pièce y descend bien plus que ne
// le voudrait un seul point de vue (le bout d'une nervure de face finit 35 pixels plus bas que ne le
// prédit la vue qui place juste la face du haut et le haut de la bague), la photo est donc peut-être
// retouchée. Chaque hauteur dit sa rangée de pixels, comptée depuis le centre de la face du haut
// (rangée 174) : z = (rangée - 174) / 11,2. Les longueurs sont tenues à 3 % près, pas mieux.
//
// Une épaule qui regarde vers le haut a sa silhouette un peu en arrière de la pièce : vue d'au-dessus,
// elle monte de 0,3 à 0,5 mm à l'écran. Celle qui regarde vers le bas descend d'autant. Les deux épaules
// (celle du bulbe, celle du pied de la bague) sont donc réglées sur un rendu vu du même point que la
// photo (de 9 degrés au-dessus, tourné de 5 degrés comme elle), qui subit le même effet, et non sur leur
// silhouette brute.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : la profondeur du taraudage (16,5 mm, la longueur
// courante d'un taraudage 3/4" de raccord), le passage de l'eau, tout le dedans de la bague (la lèvre, la
// bague de crampage, le joint, la butée du tuyau, repris du raccord mâle), et la profondeur où le tuyau
// entre (34 mm, la cote que le tuyau déclare lui aussi).
//
// LES SURFACES QUI SE REJOIGNENT ont le même nombre de segments, ou se recouvrent : deux cercles de même
// rayon tracés à 48 et à 32 côtés laissent entre eux une fente de 0,06 mm, et la planche dessine ses
// matières d'un seul côté. On voyait le fond de la scène par là, en pointillé blanc, au bout du
// taraudage et sous la collerette.

// La face du bout étroit : rangée 1090 sur la silhouette, où son bord arrondi finit (81,8 mm). Vue d'un
// peu au-dessus, une hauteur s'écrase d'un à trois pour cent vers le bas de la photo : 82 mm.
var L = 82;
var PRISE = 16.5;       // la profondeur taraudée, où bute le mâle : estimée
var PRISE_TUYAU = 34;   // la profondeur où le tuyau bute : estimée, la même que celle du tuyau (mamelons-pehd.js)
var TUYAU = 12.75;      // le rayon de la bouche du bas : le PEHD de 25 mm, et un quart de millimètre de jeu
var PASSAGE = 9.5;      // le passage de l'eau : celui du tube 25 x 3,0 (19 mm)
var TOUR = 96;          // les segments de tout ce qui se rejoint : le corps, la bague, le taraudage, les joints

// LA BOUCHE DU HAUT ET LE COL.
var BOUCHE = 12.7;      // le bord intérieur de la face : 285 pixels de large (l'étalon)
var COL = { r: 15.3, fin: 7.7 };            // 343 pixels de diamètre, jusqu'à la marche (rangées 258 à 266)
var FUT = { r: 15.95 };                     // sous la marche : 357 à 359 pixels
// LE BULBE entre les ailettes, et son épaule. On la lit dans les deux ailettes de profil, où le bulbe se
// détache en clair sur leur face noire (rangées 354 à 414, à gauche) : le fût quitte sa verticale à la
// rangée 354 (16,1 mm), l'épaule monte en pente forte (17,5 mm de rayon à la rangée 366, 18,6 à la
// rangée 378) et s'arrondit jusqu'au bulbe, vertical dès la rangée 414 (21,4 mm), à 223 pixels de
// l'axe. Les deux coins du cône sont posés en z0 et z1, leurs arrondis (1,5 et 3,4 mm) tiennent ces
// points à 0,2 mm près une fois l'épaule descendue de 0,3 mm (sa silhouette monte d'autant). L'épaule
// d'avant, plus haute d'un millimètre et presque à plat, faisait au bulbe un chapeau là où la photo
// montre une cloche.
var EPAULE = { z0: 16.2, z1: 19.3 };
var BULBE = { r: 19.85 };
// La collerette noire : de la rangée 488 à 546 ; 23,65 mm de rayon sur la silhouette (rangées 500 à 524,
// moyenne des deux bords), un peu plus que le talon des ailettes qui la longe. Ses deux arêtes sont bien
// rondes sur la photo (une douzaine de pixels).
var COLLERETTE = { r: 23.65, z0: 28.1, z1: 33.0 };
// LES AILETTES. Six, à 60 degrés l'une de l'autre, et non quatre : deux se voient de profil sur la
// silhouette (gauche et droite), deux de trois quarts devant, à 103 et 112 pixels de l'axe (le
// sinus de 30 degrés de leur bord, à 5 degrés près : la pièce est un peu tournée sur la photo) ; quatre
// à angle droit en auraient montré une de face, au milieu. 517 pixels d'un bord à l'autre (rangées 324 à
// 428 : 23,05 mm de l'axe), le haut à la rangée 295, l'angle extérieur du haut chanfreiné (22 pixels sur
// 21). Le talon : le bord ressort de 0,5 mm dès la rangée 440 (rangées 444 à 476 : 23,55 mm), son haut
// arrondi, et longe la collerette sans la dépasser. L'épaisseur (2,6 mm) se lit sur les deux de devant,
// vues de trois quarts.
var AILETTES = { nombre: 6, depart: 0, epaisseur: 2.6, r: 23.05, haut: 10.8, chanfrein: 1.9, talon: 23.6, rTalon: 23.5 };

// LA BAGUE GRISE.
var FACE = 35.0;        // sa face, sous la collerette : le bord de devant à la rangée 600, à 121 pixels de l'axe
// Le fût entre les nervures : 552 puis 546 pixels. Son pied est une épaule arrondie qui gagne le bout
// étroit, relevée sur le bord droit (rangées 852 à 898) : elle quitte la verticale juste sous le bout
// des nervures et rentre de plus en plus vite (0,35 mm à 1 mm de son départ, 1,4 mm à 2,6 mm, 3,4 mm à
// 4,1 mm), comme une courbe en puissance 1,6, jusqu'au bout étroit où elle finit dans un petit congé.
// Posée d'abord à 60,1 mm, elle tombait 5 à 10 pixels trop haut sur le rendu vu du même point que la
// photo : 60,4 mm.
var NOYAU = { r0: 24.6, r1: 24.35, fin: 60.4 };
// Le bout étroit, conique, mesuré par la plus forte pente des deux bords (rangées 940 à 1070) : 20,49 mm
// de rayon à 68,4 mm, 19,02 à 80 mm, soit 0,127 mm de rayon perdu par millimètre. Prolongé jusqu'à sa
// face, il va de 21,0 mm (au pied de l'épaule, à 64,5 mm) à 18,77 mm.
var NEZ = { r0: 21.0, r1: 18.77 };
// Huit nervures, à 45 degrés l'une de l'autre : une de face au milieu, deux de profil sur la silhouette,
// deux de trois quarts (à 209 pixels de l'axe, 296 fois le sinus de 45 degrés). 615 pixels d'un dos à
// l'autre en haut, 600 en bas (la dépouille du moule) ; 35 pixels de large ; elles montent jusqu'à la
// face et finissent en bas en quart de rond (de la rangée 820 à 850, vues de profil), juste au départ
// de l'épaule : rendues à 59,8 mm, elles finissaient 4 à 5 pixels plus haut que sur la photo.
var NERVURES = { nombre: 8, depart: 0, largeur: 3.2, r0: 27.45, r1: 26.8, fin: 60.25 };
// LA LIGNE DE JOINT DU MOULE : un filet clair qui court droit devant sur tout le corps noir, du col à la
// collerette, à mi chemin des deux ailettes de devant, à 10 pixels à droite de l'axe (la pièce est
// tournée de 5 degrés) : le corps sort d'un moule en deux coquilles qui se séparent là, donc il y en a
// un aussi derrière. Sa largeur et sa saillie (0,3 et 0,08 mm) sont estimées : assez pour accrocher la
// lumière comme sur la photo, pas assez pour faire une arête.
var JOINT_MOULE = { largeur: 0.3, saillie: 0.08, angles: [90, 270] };

var QUART = Math.PI / 2;

// UNE PLAQUE DANS UN PLAN QUI PASSE PAR L'AXE : son contour s'écrit [[r, z], ...], elle a une épaisseur
// et se pose à l'angle `angle` autour de l'axe (0 : vers +X, un quart de tour : vers +Y, la face). Ce
// sont les ailettes du corps, les nervures de la bague et le joint du moule : leur profil, vu de côté, se
// dessine point par point, ce qu'une barre tirée le long de l'axe ne sait pas faire (le chanfrein du haut,
// le talon, le bout en quart de rond).
function plaque(F, contour, epaisseur, angle, arrondi) {
  return F.prisme(contour, -epaisseur / 2, epaisseur / 2, { arrondi: arrondi }).rotateX(QUART).rotateZ(angle);
}

// LE DEHORS DU CORPS NOIR, de la face du haut au pied de la collerette : la face du haut (deux cercles
// posés sur le plan z = 0, que la scène mesure), son bord arrondi, le col, la marche, le fût, l'épaule et
// le bulbe, le congé qui descend sur la collerette (une quinzaine de pixels de rayon sur la photo), la
// collerette, puis la jupe qui entre dans la bague. Le joint du moule suit ce même profil.
function dehorsDuCorps(fond) {
  return [
    [fond, 1.3], [BOUCHE, 0, { c: 0.15 }], [COL.r, 0, { a: 0.9, fin: 0.3 }],
    // La marche du col : 0,65 mm de haut, ses deux arêtes adoucies.
    [COL.r, COL.fin, { a: 0.3, fin: 0.5 }], [FUT.r, COL.fin + 0.4, { a: 0.5, fin: 0.5 }],
    [FUT.r, EPAULE.z0, { a: 1.5, fin: 0.25 }], [BULBE.r, EPAULE.z1, { a: 3.4, fin: 0.15 }],
    [BULBE.r, COLLERETTE.z0, { a: 1.4, fin: 0.3 }], [COLLERETTE.r, COLLERETTE.z0, { a: 1.1, fin: 0.3 }],
    [COLLERETTE.r, COLLERETTE.z1, { a: 0.9, fin: 0.3 }], [22.6, COLLERETTE.z1],
    [22.6, 38.5], [21, 38.5]];
}

// LE CORPS NOIR, d'un seul profil tourné. Le taraudage, la sortie du filet et le passage de l'eau
// suivent, au même nombre de segments, pour se rejoindre sans fente.
function corps(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15;
  lot.ajouter("noirLisse", F.tourne(dehorsDuCorps(fond), { segments: TOUR }));
  lot.ajouter("noirLisse", F.taraudage({ gaz: "3/4", z0: 1.3, z1: PRISE, segments: TOUR }));
  // Sous le taraudage, le cône où finit le filet, puis le passage, jusqu'à la butée du tuyau, et la
  // petite marche qui la relie au joint du bas (au rayon du joint, pour ne pas laisser de fente).
  var butee = L - PRISE_TUYAU - 0.2;
  lot.ajouter("noirLisse", F.tourne([[12.65, L - 22], [TUYAU, L - 22.15], [TUYAU, butee, { a: 0.4 }], [PASSAGE, butee, { c: 0.4 }],
    [PASSAGE, PRISE + 2.6, { a: 0.6 }], [fond, PRISE]], { segments: TOUR }));
  // Le fond du passage, vu de chaque bouche : un noir qui ne renvoie rien, à mi chemin. Son bord entre
  // dans la paroi du passage, qu'il dépasse de 0,3 mm : un disque juste au rayon du passage laissait le
  // jour passer entre ses côtés et ceux de la paroi.
  lot.ajouter("creux", F.tourne([[0, 31], [PASSAGE + 0.3, 31]], { segments: 32 }));
  lot.ajouter("creux", F.tourne([[PASSAGE + 0.3, 31.05], [0, 31.05]], { segments: 32 }));
  // Le joint qu'on voit entre la collerette et la bague : un jonc noir, un peu bombé (rangées 546 à
  // 574). Ses deux bords sont noyés dans la jupe (22,3 mm, sous sa peau à 22,6) : posés sur elle, ils
  // ouvraient une fente en pointillé sous la collerette.
  lot.ajouter("joint", F.tourne([[22.3, COLLERETTE.z1 - 0.1], [22.95, 33.5, { a: 0.6, fin: 0.4 }], [23.1, 34.3],
    [22.95, 35.3, { a: 0.6, fin: 0.4 }], [22.3, 36]], { segments: TOUR }));
}

// LE JOINT DU MOULE : une plaque très mince qui suit le dehors du corps, de la sortie de l'arrondi du
// col (z = 1,2) au bas de la collerette, et dépasse de lui de JOINT_MOULE.saillie. Son dedans est noyé
// de 0,25 mm dans le corps. La normale en chaque point est la moyenne des deux segments voisins.
function jointDuMoule(F, lot) {
  // Le col et le flanc de la collerette sont droits : le profil adouci n'y a de point qu'à leurs bouts,
  // d'où les deux bouts du joint, posés à la main.
  var J = JOINT_MOULE, haut = 1.2, bas = COLLERETTE.z1 - 1;
  var pts = [[COL.r, haut]].concat(F.adoucir(dehorsDuCorps(F.rayonDuFond({ gaz: "3/4" }) + 0.15)).filter(function (p) {
    return p[0] > 14.9 && p[1] > haut && p[1] < bas;
  }), [[COLLERETTE.r, bas]]);
  function normale(i) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz);
    return [dz / l, -dr / l];
  }
  var dehors = [], dedans = [];
  pts.forEach(function (p, i) {
    var n = normale(i);
    dehors.push([p[0] + n[0] * J.saillie, p[1] + n[1] * J.saillie]);
    dedans.push([p[0] - n[0] * 0.25, p[1] - n[1] * 0.25]);
  });
  var contour = dehors.concat(dedans.reverse());
  J.angles.forEach(function (a) { lot.ajouter("noirLisse", plaque(F, contour, J.largeur, a * Math.PI / 180, 0.1)); });
}

// LES AILETTES : six plaques, du fût jusque dans la collerette. Leur pied est noyé dans le corps (15,4 mm
// de l'axe, sous la peau du fût), leur bas dans la collerette, assez haut pour que rien n'en sorte
// dessous : le talon, à 23,5 mm, reste sous la peau de la collerette (23,65 mm).
function ailettes(F, lot) {
  var A = AILETTES, coin = { a: 0.3, fin: 0.5 }, bas = COLLERETTE.z0 + 2.4;
  var contour = [[15.4, A.haut], [A.r - A.chanfrein, A.haut, coin], [A.r, A.haut + A.chanfrein, coin], [A.r, A.talon, { a: 0.4, fin: 0.4 }],
    [A.rTalon, A.talon + 0.5, { a: 0.4, fin: 0.4 }], [A.rTalon, bas], [15.4, bas]];
  for (var i = 0; i < A.nombre; i++) {
    lot.ajouter("noirLisse", plaque(F, contour, A.epaisseur, (A.depart + i * 360 / A.nombre) * Math.PI / 180, 0.45));
  }
}

// L'ÉPAULE AU PIED DE LA BAGUE, point par point : r = NOYAU.r1 - 0,35 x d^1,6, d étant la descente
// depuis NOYAU.fin, jusqu'au bout étroit. Un arrondi demandé au profil n'en donnait qu'un cône entre deux
// congés : une bande d'une seule teinte, sombre, que la photo n'a pas.
function epauleDeLaBague() {
  var pts = [[NOYAU.r1, NOYAU.fin]], fin = Math.pow((NOYAU.r1 - NEZ.r0) / 0.35, 1 / 1.6), n = 12;
  for (var k = 1; k <= n; k++) {
    var d = fin * k / n;
    pts.push([NOYAU.r1 - 0.35 * Math.pow(d, 1.6), NOYAU.fin + d]);
  }
  pts[pts.length - 1].push({ a: 0.5, fin: 0.25 });
  return pts;
}

// LA BAGUE GRISE, d'un seul profil tourné : la bouche qui reçoit la jupe du corps, la face, l'arrondi
// qui gagne le fût, le fût, son épaule, le bout étroit, un peu conique, son bord arrondi, la face du
// bout (posée sur le plan z = L), puis la lèvre de la bouche où entre le tuyau, la gorge, et la bague de
// crampage, grise elle aussi. Dessus : les nervures.
function bague(F, lot) {
  lot.ajouter("grisPlasson", F.tourne([
    [23.3, 38.5], [23.3, FACE, { c: 0.25 }], [NOYAU.r0, FACE, { a: 0.8, fin: 0.3 }]]
    .concat(epauleDeLaBague(), [
      [NEZ.r1, L, { a: 1.6, fin: 0.25 }], [TUYAU, L, { c: 0.7 }],
      [TUYAU, L - 6], [13.4, L - 6], [13.4, L - 6.6], [12.65, L - 6.6], [12.65, L - 18]]), { segments: TOUR }));
  // Une nervure, de profil : son dos suit la dépouille, son haut arrondi affleure la face (0,12 mm sous
  // elle, pour que les deux surfaces ne se battent pas à l'écran), son bas finit en quart de rond. Le
  // pied est noyé dans le fût, plus profond en bas pour que l'arrondi du bas soit entier.
  var N = NERVURES, contour = [[23.9, FACE + 0.12], [N.r0, FACE + 0.12, { a: 1.4, fin: 0.3 }], [N.r1, N.fin, { a: 2.2, fin: 0.25 }],
    [22.4, N.fin], [22.4, 46], [23.9, 44.5]];
  for (var i = 0; i < N.nombre; i++) {
    lot.ajouter("grisPlasson", plaque(F, contour, N.largeur, (N.depart + i * 360 / N.nombre) * Math.PI / 180, 0.55));
  }
  // Le joint au fond de la bouche du tuyau, comme dans le raccord mâle, au rayon de la lèvre qu'il
  // prolonge et au même nombre de segments.
  lot.ajouter("joint", F.tourne([[12.65, L - 18], [12.65, L - 22]], { segments: TOUR }));
}

export default {
  "raccord-femelle25": function (F) {
    var lot = new F.Lot();
    corps(F, lot); jointDuMoule(F, lot); ailettes(F, lot); bague(F, lot);
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE }, bas: { z: L, x: 0, genre: "femelle", gaz: "pe25", prise: PRISE_TUYAU } };
  }
};
