// L'EMBOUT PALAPLAST TARAUDÉ 16 x 3/4" (MID6362), pour le Ø16 souple : le corps femelle 3/4" en haut, ses
// faces encadrées, deux collerettes à six pans et leur ergot, une petite collerette, le filetage du corps,
// l'écrou de serrage à côtes, la queue où entre le tube. Pièce de pile, sur l'axe Z local : la face de la
// bouche taraudée en z = 0, la face du bout de la queue en z = L.
//
// D'OÙ VIENNENT LES COTES. Sa photo (docs/robinet-3d-photos/palaplast-MID6362.jpg, 896 x 1200, de face,
// debout). L'étalon est le filetage qu'on voit entre la petite collerette et l'écrou : 306 pixels au sommet
// des filets, un filet tous les 20,7 pixels, soit 11,57 et 11,39 pixels par millimètre pour un 3/4" (26,441
// mm, 14 filets au pouce) ; la hauteur d'un filet (13,5 pixels pour 1,162 mm) le confirme. 11,45 est retenu.
// L'axe est la colonne 446.
//
// LA PHOTO EST PRISE DE PRÈS, et ça se mesure : l'objectif est à 245 mm environ, à la hauteur de la
// seconde collerette. Ce qui est devant la pièce y paraît 6 à 8 % plus grand que ce qui est sur la
// silhouette (la face avant des collerettes fait 260 pixels pour 237 attendus), et ce qui est au-dessus de
// l'objectif y remonte (le bord avant du haut du corps est à la rangée 146, ses deux côtés à la rangée
// 170). Les rayons et les hauteurs se lisent donc sur la SILHOUETTE, qui est dans le plan de l'axe :
// z = (rangée - 170) / 11,45 et r = (demi largeur) / 11,45. Ce qui ne se lit que devant (les faces du
// corps, les côtes de l'écrou, l'ergot) est ramené au plan de l'axe par ce grossissement.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : la profondeur du taraudage (15 mm), le joint plat au
// fond de la bouche, tout le dedans (le passage de l'eau, la bague où passe le tube, son joint torique, la
// butée), et la profondeur où le tube bute (36 mm). Le filetage du corps est tracé jusqu'à 3,5 mm sous la
// face de l'écrou : plus bas, il est dedans.
//
// AUCUN LOGO : le « K » rond de l'écrou n'est pas dessiné, comme aucun texte sur les autres pièces.

var L = 79.1;           // la face du bout de la queue : le cercle du bout, rangée 1076 (voir la queue)
var PRISE = 15;         // la profondeur taraudée, où bute le mâle du programmateur : ESTIMÉE
var PRISE_TUBE = 36;    // la profondeur où le tube Ø16 bute : ESTIMÉE (voir le dedans)
var TOUR = 72;          // les segments de la bouche, du taraudage et de ce qui les rejoint
var QUART = Math.PI / 2, DEG = Math.PI / 180;

// LE CORPS FEMELLE. Sa silhouette : 431 pixels de la rangée 172 à la rangée 371 (18,8 mm de rayon). Ses
// six faces sont des PLATS : chacune garde la même teinte d'un bord à l'autre, ce que ne fait pas un creux
// tourné. Celle du milieu fait face, comme celles des collerettes, et les côtes sont aux coins.
// - le bandeau du haut, tourné, jusqu'à 3,9 mm : son dessous est le fil clair de la rangée 195 au milieu de
//   la face avant, ramené au plan de l'axe ;
// - le biseau du haut de chaque face, la bande en trapèze des rangées 197 à 212 : 1,15 mm de haut pour 1,35
//   de profondeur ;
// - le plat : son fond fait 158 pixels de large devant (rangées 362 à 530), soit 6,9 mm de demi largeur
//   ramenée au plan de l'axe ; ses bords s'arrêtent au coin d'un six pans, ce qui le met à 15,06 mm de
//   l'axe (le haut de ses biseaux de côté, à 8,2 mm du milieu, tombe juste sur les côtes) ;
// - les côtes : 2,8 mm de large, de 26 à 34 degrés de la face (à 8,2 et 10,6 mm de l'axe devant, une fois
//   ramenées), soit centrées sur les coins, et au rayon de la silhouette ;
// - le bas du plat va jusqu'à la première collerette, sans cadre (rangée 365 devant, la collerette aussi).
var CORPS = { r: 18.85, bande: 3.9, plat: 15.06, nervure: 18.75, demiNervure: 1.4, bordDuFond: 6.9, biseau: { n: 16.45, z: 5.05 } };

// LES COLLERETTES. Sur la silhouette, chaque six pans montre ses deux coins (475 pixels, 20,7 mm du coin à
// l'axe) ; de face, un plat. Les deux grandes : rangées 372 à 421 et 443,5 à 492, soit 4,3 mm chacune ;
// entre elles, une gorge de 382 pixels (rangées 421 à 443). La petite : rangées 515 à 555,5, 367 pixels
// d'un coin à l'autre ; au-dessus d'elle, le cou de 279 pixels (rangées 497 à 513). Leurs coins sont cassés
// sur un demi millimètre à chaque face (la silhouette passe de 437 à 474 pixels en 6 rangées), pas plus :
// le cône du chamfrein part de 1,06 fois le demi sur plats, à 20 degrés. Il n'entame donc que les 10,6
// derniers degrés de chaque coin, soit 4 mm de chaque plat : la photo agrandie y montre un triangle plus
// clair à chaque bout des arêtes. Ailleurs l'arête du plat est vive à l'oeil, mais elle accroche un fil de
// lumière (le haut du plat de face de la première collerette) : elle est cassée de 0,15 mm, ESTIMÉ.
var GRANDE = { surPlats: 35.86 };
var COLLERETTES = [{ z0: 17.6, z1: 21.92 }, { z0: 23.89, z1: 28.12 }];
var GORGE = 16.68;
var COU = 12.18;
var PETITE = { surPlats: 27.76, z0: 30.13, z1: 33.67 };
var CHANFREIN = { angle: 20, depart: 1.06, casse: 0.15 };

// L'ERGOT EN LOSANGE, à gauche, qui enjambe la gorge : une plaque posée À PLAT sur la face gauche avant des
// deux grandes collerettes (leur plat à 150 degrés de +X), et qui en sort de 0,9 mm. Relevé sur la photo
// agrandie, gris par gris :
// - sa face a la teinte de ce plat (de 105 à 125 sur la photo, comme lui) : sous la gorge, on ne l'en
//   distingue plus qu'à son bord. Une face tournée vers l'objectif, comme dans la version d'avant, aurait
//   été plus claire que les collerettes ;
// - un flanc sombre (de 30 à 70) la borde à droite d'une pointe à l'autre, 8 à 9 pixels de large : son
//   épaisseur vue de biais, qui ne se voit que de ce côté. Ramenée au plan de l'axe, 0,9 mm : ESTIMÉE sur
//   cette bande, l'ombre portée comprise ;
// - ses quatre pointes : à gauche 236 pixels (rangée 432), en haut et en bas 250 (rangées 394 et 476), à
//   droite 262 (rangée 438), là où le flanc les borde. C'est un LOSANGE entier, et non une ailette à bord
//   droit (la version d'avant) : son bord de droite fait une pointe au milieu.
// Ramenées au plan de l'axe par le grossissement de ce qui est devant (3 à 5 % : sa face est à 7 à 11 mm
// de l'axe vers l'objectif), ces pointes sont, le long du plat, à 2,9 mm à gauche de son milieu, à 0,3 mm
// en haut et en bas, à 1,75 mm à droite, de z = 19,8 à 26,6 : il déborde de 2 mm sur chaque collerette. Sa
// pointe de gauche tombe ainsi à 17,9 mm de l'axe, ce que la silhouette donne dans la gorge (235 pixels,
// rangées 422 à 440) ; posée à 2,45 mm, elle restait 0,4 mm en deçà (relevé à la revue).
// Son contour [s, z] : s compté le long du plat, de son milieu vers son coin de droite (à 120 degrés de
// +X). Son dos entre de 0,4 mm dans les collerettes.
var ERGOT = { face: 150, saillie: 0.9, enfonce: 0.4, contour: [[-2.9, 23.0, { a: 0.3 }], [-0.3, 19.8, { a: 0.3 }], [1.75, 23.4, { a: 0.3 }], [-0.3, 26.6, { a: 0.3 }]] };
// L'OMBRE DANS LA GORGE, de 141 à 160 degrés de +X : derrière l'ergot, et à sa droite jusqu'à 290 pixels
// (de 2 à 30 de gris sur la photo, rangées 420 à 440), ramenés sur la gorge.
var OMBRE = [141, 160];

// L'ÉCROU DE SERRAGE, et la queue qui le prolonge.
// - sa face du haut, rangée 640 (z = 41,05), sa collerette de 421 pixels (18,38 mm) jusqu'à la rangée 666,
//   son dessous cassé jusqu'au corps de l'écrou (rangées 668 à 678) ;
// - le corps : 391 pixels sous la collerette, 385 en bas (rangée 815), la dépouille du moule ;
// - six côtes verticales, à 60 degrés, celle du milieu de face : 3,6 mm de large (45 pixels devant, ramenés
//   au plan de l'axe), 1,1 mm de saillie (ESTIMÉE : on voit leur flanc de biais ; à 0,9 mm, rendues à côté
//   de la photo, elles s'effaçaient) ; elles descendent jusqu'à la rangée 855 devant (z = 57,4 une fois
//   ramenée), leur bout taillé en biseau ;
// - dans sa face du haut, autour du filetage, un jour sombre de 2 mm : le haut de l'écrou est lamé, et le
//   fond du lamage reste dans l'ombre (sa profondeur, 3 mm, est ESTIMÉE). Ce jour est NOIR des deux côtés
//   du filet sur la photo (de 9 à 40 de gris, rangées 640 à 648) : le fond prend donc la matière des
//   creux, comme les rigoles du Solem, puisque la scène ne calcule pas l'ombre qu'il se fait. Gris, il
//   renvoyait le studio en un croissant presque blanc à droite du filet (relevé à la revue). Seule sa paroi
//   du fond, en face, reste éclairée, comme sur la photo (de 115 à 160). Sa bouche est arrondie de 0,4 mm,
//   et non chanfreinée : un chanfrein à 45 degrés y faisait une bande deux fois plus claire que la face du
//   haut, quand la photo montre l'inverse (la face à 200, le bord du lamage plus sombre qu'elle).
var ECROU = { haut: 41.05, r: 18.38, bas: 43.2, corps: 17.05, corpsBas: 16.82, finCorps: 56.4, lamage: { r: 15.2, fond: 44.0 } };
var COTES = { nombre: 6, largeur: 3.6, r: 18.15, haut: 43.0, fin: 56.0, pied: 57.7 };
// LE COL QUI DESCEND SUR LA QUEUE, relevé sur le bord droit de la silhouette tous les quatre pixels
// (rangées 818 à 938), le bord gauche portant un reflet : un épaulement arrondi, puis une pente raide, puis
// un long congé qui se couche sur la queue. Chaque point est [rayon, z].
var COL = [[16.8, 56.6], [16.6, 57.3], [16.45, 58.0], [16.2, 58.4], [15.95, 58.7], [15.55, 59.0], [15.05, 59.4], [14.75, 59.7], [14.45, 60.1],
  [14.18, 60.4], [13.92, 60.8], [13.66, 61.1], [13.47, 61.5], [13.3, 61.8], [12.98, 62.5], [12.72, 63.2], [12.52, 63.9], [12.34, 64.6],
  [12.18, 65.3], [12.08, 66.2], [12.05, 67.1]];
// LA QUEUE : 275 pixels (12,05 mm) jusqu'à la rangée 1062 (z = 77,9). Elle a sa dépouille de moule, comme
// le corps de l'écrou : 276 pixels à la rangée 938, 274 de la 970 à la 1010, 272 de la 1042 à la 1058,
// soit 12,05 puis 11,88 mm (droite, elle était 0,17 mm trop large en bas, relevé à la revue). Dessous, la
// silhouette rentre de 1,5 mm en 1,3 mm de haut, puis le contour du bout dessine, vu d'au-dessus, la
// moitié avant d'un cercle de 120 pixels de rayon posé à la rangée 1076 : le bord de la face du bout, à
// 10,5 mm de l'axe, en z = 79,1. Sa largeur et sa rangée se recoupent sur cinq points du contour, à un
// pixel près.
var QUEUE = { r: 12.05, rBas: 11.88, casse: 77.5, bout: 10.8 };

// LE DEDANS, ESTIMÉ : le tube Ø16 (8 mm de rayon) passe la queue (8,25 mm), la chambre de l'écrou où le
// serre une bague et où l'étanche un joint torique, puis entre dans le corps jusqu'à la butée ; l'eau
// passe ensuite par 13,2 mm (le dedans du tube), jusqu'au joint plat du fond de la bouche.
var DEDANS = { tube: 8.25, chambre: 10.0, joint: [55.7, 57.4], passage: 6.6, siege: 16.6 };

// UNE PLAQUE DANS UN PLAN QUI PASSE PAR L'AXE, comme celles du raccord femelle 25 : son contour s'écrit
// [[r, z], ...], elle a une épaisseur et se pose à l'angle `angle` autour de l'axe (0 : vers +X, un quart de
// tour : vers +Y, la face).
function plaque(F, contour, epaisseur, angle, arrondi) {
  return F.prisme(contour, -epaisseur / 2, epaisseur / 2, { arrondi: arrondi }).rotateX(QUART).rotateZ(angle);
}

// LE CORPS FEMELLE : le bandeau et la bouche d'un seul profil tourné (la face du haut, deux cercles posés
// sur le plan z = 0 que la scène mesure), le taraudage au même nombre de segments, le dessous du bandeau
// qui fait le haut du cadre, le noyau à six plats, ses six côtes, et le biseau du haut de chaque face.
function corps(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, grand = F.GAZ["3/4"].d / 2 + 0.15, C = CORPS, bas = COLLERETTES[0].z0 + 0.4, i;
  lot.ajouter("grisPalaplast", F.tourne([[fond, 1.2], [grand + 0.5, 0], [C.r, 0, { a: 0.8, fin: 0.3 }], [C.r, C.bande, { a: 0.2 }], [14.8, C.bande]], { segments: TOUR }));
  lot.ajouter("grisPalaplast", F.taraudage({ gaz: "3/4", z0: 1.2, z1: PRISE, segments: TOUR }));
  // Le noyau : un six pans dont les plats sont les fonds des faces, ses coins à 60 degrés de +X comme ceux
  // des collerettes. Son haut est caché dans le bandeau, son bas dans la collerette. Il est PERCÉ juste
  // derrière le fond du taraudage : plein, son dessus fermait la bouche (vu de dessus, un disque gris à la
  // place du filet). Son chamfrein de coin, réduit à rien, est caché sous les côtes.
  lot.ajouter("grisPalaplast", F.hexagone({ surPlats: 2 * C.plat, z0: C.bande - 0.15, z1: bas, alesage: grand + 0.25, angle: 30, depart: 1.15 }));
  // Une côte, sur le coin à +X : son dos au rayon de la silhouette, ses deux flancs qui tombent sur le fond
  // des deux faces voisines, là où finit leur biseau de côté (bordDuFond du milieu de la face). Le reste de
  // son contour plonge dans le noyau.
  var cote = [], s;
  [1, -1].forEach(function (sens) {
    var nx = Math.cos(Math.PI / 6), ny = sens * Math.sin(Math.PI / 6), tx = Math.sin(Math.PI / 6), ty = -sens * Math.cos(Math.PI / 6);
    var pied = [C.plat * nx + C.bordDuFond * tx, C.plat * ny + C.bordDuFond * ty];
    s = [[pied[0] - 0.6 * nx, pied[1] - 0.6 * ny], pied, [Math.sqrt(C.nervure * C.nervure - C.demiNervure * C.demiNervure), sens * C.demiNervure, { a: 0.3 }]];
    cote.push(s);
  });
  var contour = cote[0].concat(cote[1].reverse());
  for (i = 0; i < 6; i++) lot.ajouter("grisPalaplast", F.prisme(contour, C.bande - 0.05, bas, { arrondi: 0.15 }).rotateZ(i * Math.PI / 3));
  // Le biseau du haut de chaque face : un coin qui part du dessous du bandeau et descend sur le fond. Il
  // court d'une côte à l'autre et s'enfonce dans chacune : l'onglet se fait tout seul, là où il entre dans
  // le flanc de la côte.
  var biseau = [[C.plat - 0.5, C.bande - 0.15], [C.biseau.n, C.bande - 0.15], [C.biseau.n, C.bande], [C.plat, C.biseau.z, { a: 0.15, fin: 0.4 }], [C.plat - 0.5, C.biseau.z]];
  for (i = 0; i < 6; i++) lot.ajouter("grisPalaplast", plaque(F, biseau, 17, (30 + 60 * i) * DEG, 0.05));
  // LA LIGNE DE JOINT DU MOULE : un filet clair qui descend tout droit sur le bandeau, puis sur le dos de
  // la côte de droite (à 60 degrés de +X : 557 pixels, 30 degrés à droite de la face une fois ramené),
  // là où le dessus du bandeau marche d'un pixel. Le corps sort d'un moule en deux coquilles, donc il y en
  // a un aussi derrière. Sa largeur et sa saillie (0,3 et 0,06 mm) sont ESTIMÉES, comme celles du raccord
  // femelle 25 : assez pour accrocher la lumière, pas assez pour faire une arête.
  var joint = [[C.r - 0.3, 0.75], [C.r + 0.06, 0.9], [C.r + 0.06, C.bande], [C.nervure - 0.05 + 0.06, C.bande], [C.nervure - 0.05 + 0.06, COLLERETTES[0].z0 + 0.1], [C.nervure - 0.4, COLLERETTES[0].z0 + 0.1], [C.nervure - 0.4, C.bande - 0.3], [C.r - 0.3, C.bande - 0.3]];
  [60, 240].forEach(function (a) { lot.ajouter("grisPalaplast", plaque(F, joint, 0.3, a * DEG, 0.08)); });
}

// UN SIX PANS DE COLLERETTE, de z0 à z1 : ses coins cassés par le cône du chanfrein, comme un écrou tourné,
// et l'arête de ses plats cassée de CHANFREIN.casse. Ses coins sont à 0, 60, 120 degrés de +X, comme ceux
// de formes.js : un plat fait face, comme sur la photo.
//
// POURQUOI PAS hexagone() de formes.js : il prend six pas par face (dix degrés), et ce cône-ci n'entame
// que les 10,6 derniers degrés de chaque coin. Sur un seul pas, le chanfrein devenait un éventail de
// triangles minces, des stries claires en dents de scie le long de chaque arête, vues de côté et de trois
// quarts (relevé à la revue). Ici chaque colonne d'angle porte son propre profil, aux trois places où
// se relaient le cône, la casse du plat et le plat, et les colonnes sont serrées près des coins : le
// bord du chanfrein tombe juste sur elles, sans escalier.
//
// Le profil d'une colonne, à la distance d de la face : le plus petit des trois rayons, le plat P, le cône
// r0 + d / tan(angle), la casse (a - casse + d) / cos (un plan parallèle au plat, à 45 degrés). Le dedans
// est caché par ce qui le prolonge (le corps, la gorge, le cou, le filetage) : la face s'arrête à `rIn`.
function sixPans(F, o) {
  var a = o.surPlats / 2, pente = Math.tan(CHANFREIN.angle * DEG), r0 = a * CHANFREIN.depart, c = CHANFREIN.casse, H = o.z1 - o.z0;
  var trente = Math.PI / 6, soixante = Math.PI / 3, i, j, s;
  // Les deux relais, comptés depuis le coin : où le cône rejoint le plat juste à la casse, où la casse
  // passe sous le cône dès la face.
  var mCone = trente - Math.acos(a / (r0 + c / pente)), mCasse = trente - Math.acos((a - c) / r0), demi = [];
  for (i = 0; i < 8; i++) demi.push(mCone * i / 8);
  demi.push(mCone, (mCone + mCasse) / 2, mCasse, (mCasse + trente) / 2);
  var face = demi.concat([trente], demi.slice().reverse().map(function (m) { return soixante - m; }).slice(0, -1));
  var colonnes = [];
  for (var f = 0; f < 6; f++) face.forEach(function (m) {
    var phi = m - trente, cos = Math.cos(phi), P = a / cos, k1, k2, R1;
    var R0 = Math.min(r0, (a - c) / cos);
    if (r0 < (a - c) / cos) {
      var dCone = (P - r0) * pente;
      if (dCone >= c) { k1 = k2 = dCone; R1 = P; }
      else { k1 = ((a - c) / cos - r0) / (1 / pente - 1 / cos); k2 = c; R1 = r0 + k1 / pente; }
    } else { k1 = 0; k2 = c; R1 = R0; }
    colonnes.push({ th: f * soixante + m, r: [R0, R1, P, P, R1, R0], d: [0, k1, k2, H - k2, H - k1, H] });
  });
  var pos = [], n = colonnes.length;
  function point(col, k) { return [col.r[k] * Math.cos(col.th), col.r[k] * Math.sin(col.th), o.z0 + col.d[k]]; }
  function pres(col, r, z) { return [r * Math.cos(col.th), r * Math.sin(col.th), z]; }
  // Un triangle, s'il n'est pas plat : là où un relais tombe à zéro, la bande se referme en pointe.
  function tri(A, B, C) {
    var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  for (j = 0; j < n; j++) {
    var A = colonnes[j], B = colonnes[(j + 1) % n];
    for (s = 0; s < 5; s++) { tri(point(A, s), point(B, s), point(B, s + 1)); tri(point(A, s), point(B, s + 1), point(A, s + 1)); }
    // Les deux faces : celle du haut regarde vers -Z, celle du bas vers +Z.
    tri(pres(A, o.rIn, o.z0), point(B, 0), point(A, 0)); tri(pres(A, o.rIn, o.z0), pres(B, o.rIn, o.z0), point(B, 0));
    tri(pres(A, o.rIn, o.z1), point(A, 5), point(B, 5)); tri(pres(A, o.rIn, o.z1), point(B, 5), pres(B, o.rIn, o.z1));
  }
  var g = new F.THREE.BufferGeometry();
  g.setAttribute("position", new F.THREE.Float32BufferAttribute(pos, 3));
  // 17 degrés : le cône tourne d'un degré d'une colonne à l'autre et reste lisse ; le plat, la casse, le
  // cône et la face se coupent de 20 degrés au moins, et restent vifs.
  g = F.toCreasedNormals(g, 0.3);
  return F.uvCube(g);
}

// LES COLLERETTES, LA GORGE, LE COU, L'ERGOT. Les faces des six pans s'arrêtent sous la gorge, le cou et le
// corps, cachées derrière le passage de l'eau : pleines, elles barraient le passage (vu de dessus, un
// disque clair au fond de la bouche, la face de la première collerette). Elles entrent pourtant sous le
// cou (12 mm, sous ses 12,18) : arrêtées à 13 mm, elles laissaient entre lui et la seconde collerette un
// anneau ouvert, et l'on voyait le fond de la scène à travers, vu d'en dessous (relevé à la revue).
function collerettes(F, lot) {
  COLLERETTES.forEach(function (c) { lot.ajouter("grisPalaplast", sixPans(F, { surPlats: GRANDE.surPlats, z0: c.z0, z1: c.z1, rIn: 12 })); });
  lot.ajouter("grisPalaplast", F.tourne([[GORGE, COLLERETTES[0].z1 - 0.3], [GORGE, COLLERETTES[1].z0 + 0.3]], { segments: TOUR }));
  lot.ajouter("grisPalaplast", F.tourne([[COU, COLLERETTES[1].z1 - 0.3], [COU, PETITE.z0 + 0.3]], { segments: TOUR }));
  lot.ajouter("grisPalaplast", sixPans(F, { surPlats: PETITE.surPlats, z0: PETITE.z0, z1: PETITE.z1, rIn: 10.5 }));
  lot.ajouter("grisPalaplast", ergot(F));
  lot.ajouter("creux", F.tourne([[GORGE + 0.03, COLLERETTES[0].z1], [GORGE + 0.03, COLLERETTES[1].z0]], { arc: [OMBRE[0] * DEG, OMBRE[1] * DEG], segments: 6 }));
}

// L'ERGOT : son contour monté en plaque, posé par trois axes : le long du plat (s, vers son coin de
// droite), l'axe de la pièce (z), et l'épaisseur, de sa face (0,9 mm hors du plat) jusque dans les
// collerettes. Sa face est parallèle au plat : elle en prend la teinte, comme sur la photo.
function ergot(F) {
  var T3 = F.THREE, E = ERGOT, n = E.face * DEG, plat = GRANDE.surPlats / 2;
  var normale = new T3.Vector3(Math.cos(n), Math.sin(n), 0), long = new T3.Vector3(Math.sin(n), -Math.cos(n), 0);
  var m = new T3.Matrix4().makeBasis(long, new T3.Vector3(0, 0, 1), normale.clone().negate()).setPosition(plat * normale.x, plat * normale.y, 0);
  return F.prisme(E.contour, -E.saillie, E.enfonce, { arrondi: 0.25 }).applyMatrix4(m);
}

// LE FILETAGE DU CORPS, mâle 3/4", de la petite collerette jusque dans l'écrou : une vraie hélice. Il naît
// sous la petite collerette, sans entrée visible (le premier filet est plein dès la rangée 560), et finit
// 3,5 mm dans l'écrou ; dessous, le corps continue au fond du filet, caché.
function filetage(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" });
  lot.ajouter("grisPalaplast", F.filetage({ gaz: "3/4", z0: PETITE.z1 - 0.2, z1: ECROU.haut + 3.5, entree: 0.3, sortie: 0.6 }));
  lot.ajouter("grisPalaplast", F.tourne([[fond, ECROU.haut + 3.5], [fond, DEDANS.joint[0] - 1]], { segments: 36 }));
}

// L'ÉCROU ET LA QUEUE, d'un seul profil tourné, de la paroi du lamage à la butée du tube : le lamage, la
// face du haut, la collerette, le corps, le col, la queue, la face du bout (posée sur le plan z = L), la
// bouche où entre le tube, la queue de l'intérieur, la chambre, puis la douille du corps où le tube entre
// jusqu'à sa butée, et le passage de l'eau. Dessus, les côtes ; dedans, le joint torique.
function ecrou(F, lot) {
  var E = ECROU, D = DEDANS, butee = L - PRISE_TUBE;
  var profil = [[E.lamage.r, E.lamage.fond], [E.lamage.r, E.haut, { a: 0.4, fin: 0.3 }], [E.r, E.haut, { a: 0.5, fin: 0.3 }], [E.r, E.bas, { a: 0.35, fin: 0.3 }],
    [E.corps, 43.95, { a: 0.3, fin: 0.4 }], [E.corpsBas, E.finCorps]]
    .concat(COL, [[QUEUE.rBas, QUEUE.casse, { a: 1.0, fin: 0.3 }], [QUEUE.bout, L, { a: 0.5, fin: 0.3 }], [D.tube + 0.5, L, { c: 0.25 }], [D.tube, L - 0.5],
      [D.tube, 61.5, { a: 0.4 }], [D.chambre, 59.6, { a: 0.4 }], [D.chambre, D.joint[0] - 0.1], [D.tube, D.joint[0] - 0.1], [D.tube, butee, { a: 0.2 }],
      [D.passage, butee, { c: 0.3 }], [D.passage, 30]]);
  lot.ajouter("grisPalaplast", F.tourne(profil, { segments: 96 }));
  // Le fond du lamage, du fond du filet du corps (qui le traverse et descend dessous, caché) à sa paroi,
  // qu'il dépasse de 0,05 mm pour ne laisser aucune fente : le jour sombre de la photo.
  lot.ajouter("creux", F.tourne([[F.rayonDuFond({ gaz: "3/4" }) - 0.1, E.lamage.fond], [E.lamage.r + 0.05, E.lamage.fond]], { segments: 96 }));
  // Les côtes : leur dos droit, leur bout taillé en biseau jusqu'au corps de l'écrou. Leur haut est caché
  // dans la collerette, leur pied dans le corps.
  var C = COTES, cote = [[16.2, C.haut], [C.r, C.haut], [C.r, C.fin, { a: 0.6, fin: 0.4 }], [16.3, C.pied, { a: 0.3 }], [16.2, C.pied]];
  for (var i = 0; i < C.nombre; i++) lot.ajouter("grisPalaplast", plaque(F, cote, C.largeur, (90 + i * 360 / C.nombre) * DEG, 0.35));
  // Le joint torique de la chambre, contre le bout du corps : son dedans juste au-dessus du tube.
  var J = D.joint, m = (J[0] + J[1]) / 2;
  lot.ajouter("joint", F.tourne([[D.chambre - 0.1, m], [D.chambre - 0.1, J[1], { a: 0.8 }], [8.1, J[1], { a: 0.8 }], [8.1, J[0], { a: 0.8 }], [D.chambre - 0.1, J[0], { a: 0.8 }], [D.chambre - 0.1, m]], { segments: 48 }));
}

// LE FOND DE LA BOUCHE : sous le taraudage, sa sortie, le siège du joint plat et le passage, au même
// nombre de segments que le taraudage ; le joint plat où bute le mâle ; et le fond du passage, vu de
// chaque bout, un noir qui ne renvoie rien, posé là où les deux profils du passage se rejoignent.
function fondDeLaBouche(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, grand = F.GAZ["3/4"].d / 2 + 0.15, D = DEDANS;
  lot.ajouter("grisPalaplast", F.tourne([[D.passage, 30], [D.passage, D.siege, { c: 0.3 }], [grand, D.siege], [grand, PRISE + 0.2], [fond, PRISE]], { segments: TOUR }));
  lot.ajouter("joint", F.tourne([[7, D.siege], [7, PRISE + 0.3, { c: 0.3 }], [13.3, PRISE + 0.3, { c: 0.3 }], [13.3, D.siege]], { segments: TOUR }));
  lot.ajouter("creux", F.tourne([[0, 30], [D.passage + 0.3, 30]], { segments: 32 }));
  lot.ajouter("creux", F.tourne([[D.passage + 0.3, 30.05], [0, 30.05]], { segments: 32 }));
}

export default {
  "embout-MID6362": function (F) {
    var lot = new F.Lot();
    corps(F, lot); collerettes(F, lot); filetage(F, lot); ecrou(F, lot); fondDeLaBouche(F, lot);
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE }, bas: { z: L, x: 0, genre: "femelle", gaz: "pe16", prise: PRISE_TUBE } };
  }
};
