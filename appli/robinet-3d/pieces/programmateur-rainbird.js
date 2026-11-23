// LE PROGRAMMATEUR DE ROBINET RAIN BIRD, une voie, en nez de robinet : l'écrou d'entrée noir, femelle
// 3/4", le boîtier noir au grand cadran cerclé d'argent, le boîtier vert de l'écran, le filetage de
// sortie, mâle 3/4". Pièce de pile, sur l'axe Z local : la face du haut de l'écrou en z = 0, la pointe
// du filetage en z = L. Le patron l'appelle « Rain Bird » ; il n'est pas au catalogue Aqua Plus, il n'a
// donc pas de référence à afficher.
//
// D'OÙ VIENNENT LES COTES. Sa photo (docs/robinet-3d-photos/rainbird-zeh-tmr.jpg, 1024 x 1024 ;
// appli/arrosage-robinet-photos/rainbird-zeh-tmr.jpg est la même vue, plus petite). L'étalon est le
// filetage mâle du bas : 154 pixels au sommet des filets (de x = 153 à x = 306) pour 26,441 mm, soit
// 5,82 pixels par millimètre. L'axe de l'eau passe par x = 217 en haut (l'écrou) et x = 229 en bas (le
// filetage). Une hauteur sur l'axe se lit z = (rangée - 113) / 5,82 : la face du haut de l'écrou est à
// la rangée 113, le coin de la pointe du filetage à la rangée 917.
//
// LA PHOTO N'EST PAS DE FACE, et c'est ce qui commande toutes les cotes de la face. Le cadran, rond, y
// fait 298 pixels de large pour 329 de haut, la bague argentée 368 pour 408 : la pièce est tournée de
// 25 degrés, sa face regardant un peu à droite de l'objectif (on voit son flanc gauche). Une cote de la
// face se relève donc ainsi : sa largeur sur la photo, divisée par le cosinus de 25 degrés, et décalée
// de ce que sa profondeur la pousse à droite (0,42 mm par millimètre). Le bout droit du boîtier, plus
// loin de l'objectif, y paraît 5 % plus petit que l'axe (sa hauteur passe de 449 à 426 pixels) :
// l'objectif est à 90 cm environ, et cette perspective est comptée aussi. La photo est prise d'un peu
// au-dessus : 3 degrés, l'angle qui pose le mieux le dessus du boîtier sur sa silhouette (à 5 et
// 7 degrés, essayés, il montait de 6 à 13 pixels au-dessus de celle de la photo). Les cotes de la face
// sont tenues à 1 mm près, pas mieux : c'est une photo de studio, retouchée (elle porte « WATEHRING »).
//
// L'ORIENTATION : comme la photo, l'axe de l'eau à x = 0, le boîtier vers +X, l'écran et le cadran
// vers +Y. Dans la pile, il se visse sur la sortie DROITE de la double sortie : son boîtier part vers
// l'extérieur (composition.js).
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : l'épaisseur du boîtier (42 mm, de y = -20 à
// y = 22 ; la silhouette du flanc gauche, vue de 25 degrés, n'en laisse pas davantage), la place de
// l'axe dans cette épaisseur (au milieu, ou presque), l'arrondi des arêtes du dos (12 mm), tout le dos,
// le nombre des fentes du cadran (onze, d'après leur écart sur la moitié qu'on voit), et tout le dedans
// (le taraudage et sa profondeur de 13 mm, le joint, le filtre, le passage du filetage mâle).
//
// COMMENT LES COTES ONT ÉTÉ TENUES : la pièce a été rendue du point de vue de la photo (tournée de
// 25 degrés, vue de 3 degrés au-dessus, à 90 cm, l'image penchée de 0,6 degré), et sa silhouette
// posée sur celle de la photo. L'écrou, le filetage, le bout droit et le flanc gauche s'y suivent à
// 3 pixels près (0,5 mm). Deux écarts restent, que la photo ne laisse pas trancher : son dessous et son
// dessus penchent d'un degré de plus que ce que la perspective explique, alors que l'axe de l'eau, lui,
// ne penche pas d'autant. La photo est retouchée ; le boîtier est gardé droit.

var L = 138.2;        // la pointe du filetage : le coin de sa silhouette, rangée 917
var PRISE_HAUT = 13;  // la profondeur où l'écrou reçoit le mâle du robinet : ESTIMÉE (le joint est dessous)
var FILET = 123.6;    // le premier filet, sous la bague lisse (rangée 831)
var TOUR = Math.PI * 2, QUART = Math.PI / 2;
function doux(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

// LE BOÎTIER, vu de face (X, Z). Le dessus est droit (rangées 318 à 323 sur toute la longueur), le
// dessous aussi (sa silhouette, l'arête du bas devant, rangées 766 à 740 de gauche à droite, redressées).
// La partie noire est un grand disque autour du cadran : sa silhouette gauche, redressée de la
// profondeur, tient sur un cercle de 38,7 mm de rayon, centré 4,3 mm à droite de l'axe et 78,5 mm
// sous la face de l'écrou, à 2 mm près du centre de la bague argentée. Le joint du noir et du vert,
// droit, tombe à x = 42 (colonnes 493 en haut, 503 en bas). Le bout droit bombe un peu : 126,6 mm au
// milieu, 126,0 au quart (colonnes 913 à 920 de la silhouette) ; posé d'abord à 128,3 mm, il sortait de
// 10 pixels à droite de la photo, une fois la pièce rendue de son point de vue.
var HAUT = 35.8, BAS = 112.5, JOINT = 42, BOUT = 126.6;
var DISQUE = { x: 4.3, z: 78.5, r: 38.7 };
// Le coin du haut à gauche, entre le dessus et le disque : un arrondi de 14 mm, puis une droite
// tangente au disque (la silhouette passe par x = -20 à z = 46, x = -27 à z = 56). Posé d'abord à
// 10,5 mm, il faisait un coin carré là où la photo montre une épaule ronde.
var COIN = { x: -8.5, r: 14 };
// L'ÉPAISSEUR : ESTIMÉE. Le flanc avant à y = 22, le dos à y = -20 ; l'arête de devant arrondie de
// 3,5 mm (le dessus éclairé n'y fait que 22 pixels), celle du dos de 12 mm. Un dos à y = -18, arrondi de
// 10 mm, donnait la même silhouette gauche, mais la base de l'écrou (17,5 mm de rayon) en sortait.
var AVANT = 22, ARRIERE = -20, R_AVANT = 3.5, R_ARRIERE = 12;

// LA BAGUE ARGENTÉE ET LE CADRE DE L'ÉCRAN, une seule pièce posée sur la face : la bague fait 34,7 mm
// de rayon dehors (408 pixels de haut, rangées 369 à 777), 31,2 dedans (rangées 395 à 759). Son centre
// est 6,5 mm à droite de l'axe : posé d'abord sur celui du disque (4,3 mm), le rendu vu comme la photo
// mettait la bague et le cadran 12 à 16 pixels trop à gauche, et le noir du bord de 47 pixels à
// gauche de la bague n'en faisait que 25. Le cadre : son bord du haut à z = 52,3 dehors et 56,0 dedans
// (rangées 421 et 442 à la colonne 560), celui du bas à 98,5 et 95,2 (690 et 672), celui de droite à
// x = 112,9 et 109,3 (colonnes 862 et 844). C'est un jonc, pas une bande plate : sur la photo, à
// gauche du cadran, on voit son flanc en plus de son dessus (27 à 32 pixels contre 22 en haut, où il est vu
// de face), et son bord extérieur prend la lumière d'un trait clair. Il dépasse de la face de 2,2 mm,
// arrondi de 1,05 mm de chaque côté : ESTIMÉ sur ce flanc (posé d'abord à 1,6 mm, arrondi de 0,7 mm,
// il se lisait comme une bande découpée et posée à plat). Sa teinte : un gris clair de plastique ;
// l'inox et l'acier, des métaux, y renvoyaient le studio en grains sombres, loin du gris satiné de la
// photo.
var BAGUE = { x: 6.5, z: 77.8, r0: 31.2, r1: 34.7 };
var CADRE = { haut: 52.3, bas: 98.5, droite: 112.9, hautDedans: 56.0, basDedans: 95.2, droiteDedans: 109.3, y: AVANT + 2.2, arrondi: 1.05 };
// L'ÉCRAN : la vitre jusqu'à x = 106,3 (colonne 825), puis le bord noir de l'afficheur jusqu'au cadre.
var ECRAN = { droite: 106.3 };

// LE CADRAN, un gros bouton rond : 27,4 mm de rayon (329 pixels de haut), sa face 20 mm devant la
// face du boîtier (on voit son flanc gauche sur 50 pixels, de la bague à la face, vu de 25 degrés ;
// posée à 17 mm, la face tombait 16 pixels trop à gauche sur la photo). Il est centré sur la bague en
// largeur, 1,4 mm plus bas qu'elle (le jour entre eux est de 26 pixels en haut, nul en bas).
var CADRAN = { x: BAGUE.x, z: 79.2, r: 27.4, y0: AVANT, y1: AVANT + 20 };

// UNE GÉOMÉTRIE À PARTIR DE TABLEAUX.
function geometrie(T, pos, nor, uv, idx) {
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function arc(c, r, a0, a1, pas) {
  var n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / pas)), pts = [];
  for (var k = 0; k <= n; k++) { var a = a0 + (a1 - a0) * k / n; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return pts;
}
// Une suite de points dont aucun écart ne dépasse `pas` : chaque segment est recoupé.
function recouper(pts, pas) {
  var sortie = [];
  for (var i = 0; i + 1 < pts.length; i++) {
    var p = pts[i], q = pts[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l < 0.05) continue;
    var m = Math.ceil(l / pas);
    for (var j = 0; j < m; j++) sortie.push([p[0] + (q[0] - p[0]) * j / m, p[1] + (q[1] - p[1]) * j / m]);
  }
  sortie.push(pts[pts.length - 1]);
  return sortie;
}

// UNE FORME PLATE dans le plan de la face (X, Z), montée en épaisseur le long de Y, de y0 à y1, ses
// arêtes adoucies. `trous` la percent. formes.js n'a que le prisme sans trou : le cadre argenté en a un.
// `pas` : le nombre de facettes de l'arrondi (3 d'office ; le jonc argenté en demande 5, sans quoi son
// arrondi de 1 mm montre ses plis sous le trait de lumière).
function plaque(F, contour, trous, y0, y1, arrondi, pas) {
  var T = F.THREE, b = Math.min(arrondi, (y1 - y0) * 0.45);
  function v2(p) { return new T.Vector2(p[0], -p[1]); }
  var forme = new T.Shape(contour.map(v2));
  trous.forEach(function (t) { forme.holes.push(new T.Path(t.map(v2))); });
  var g = new T.ExtrudeGeometry(forme, { depth: y1 - y0 - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: pas || 3, curveSegments: 6 });
  g.translate(0, 0, y0 + b); g.rotateX(-QUART);
  g = F.toCreasedNormals(g, 0.6); F.uvCube(g);
  return g;
}
// Un contour adouci (formes.js, adoucir) fermé : chaque point a ses deux voisins.
function ferme(F, pts) { return F.adoucir([pts[pts.length - 1]].concat(pts, [pts[0]])).slice(1, -1); }
function rectangle(x0, z0, x1, z1, coin) {
  var a = { a: coin, fin: 0.25 };
  return [[x0, z0, a], [x1, z0, a], [x1, z1, a], [x0, z1, a]];
}
// UN APLAT sur un plan Y = y, regardant +Y : les filets blancs du cadran.
function aplat(F, contour, trous, y) {
  var T = F.THREE;
  var faces = T.ShapeUtils.triangulateShape(contour.map(function (p) { return new T.Vector2(p[0], p[1]); }), trous.map(function (t) { return t.map(function (p) { return new T.Vector2(p[0], p[1]); }); }));
  var tous = contour.concat.apply(contour, trous), pos = [], nor = [], uv = [], idx = [];
  tous.forEach(function (q) { pos.push(q[0], y, q[1]); nor.push(0, 1, 0); uv.push(q[0] / F.CARREAU, q[1] / F.CARREAU); });
  faces.forEach(function (f) {
    var a = tous[f[0]], b = tous[f[1]], c = tous[f[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cr < 0) idx.push(f[0], f[1], f[2]); else idx.push(f[0], f[2], f[1]);
  });
  return geometrie(T, pos, nor, uv, idx);
}

// UN TRAIT POSÉ SUR UNE SURFACE : le joint du noir et du vert. `pts` sont ses points, `normales` la
// normale de la surface en chacun, `cotes` la direction de sa largeur. Il flotte de `levee` au-dessus.
function trait(T, pts, normales, cotes, largeur, levee) {
  var pos = [], nor = [], uv = [], idx = [], n = pts.length, d = largeur / 2;
  for (var k = 0; k < n; k++) {
    var p = pts[k], m = normales[k], c = cotes[k];
    pos.push(p[0] + c[0] * d + m[0] * levee, p[1] + c[1] * d + m[1] * levee, p[2] + c[2] * d + m[2] * levee);
    pos.push(p[0] - c[0] * d + m[0] * levee, p[1] - c[1] * d + m[1] * levee, p[2] - c[2] * d + m[2] * levee);
    nor.push(m[0], m[1], m[2], m[0], m[1], m[2]); uv.push(0, k, 1, k);
  }
  for (k = 0; k + 1 < n; k++) {
    var a = 2 * k, b = a + 1, c2 = a + 3, e = a + 2;
    var ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
    var bx = pos[c2 * 3] - pos[a * 3], by = pos[c2 * 3 + 1] - pos[a * 3 + 1], bz = pos[c2 * 3 + 2] - pos[a * 3 + 2];
    var s = (ay * bz - az * by) * nor[a * 3] + (az * bx - ax * bz) * nor[a * 3 + 1] + (ax * by - ay * bx) * nor[a * 3 + 2];
    if (s >= 0) idx.push(a, b, c2, a, c2, e); else idx.push(a, c2, b, a, e, c2);
  }
  return geometrie(T, pos, nor, uv, idx);
}

// UNE SURFACE TOURNÉE DONT LE RAYON CHANGE AUSSI AUTOUR DE L'AXE : les cannelures de l'écrou, les
// fentes et les crans du cadran. `point(theta, k)` rend [r, z] au rang k du profil ; le profil se
// parcourt la matière à gauche, comme dans formes.js (tourne). Les normales se calculent sur la surface
// elle-même (ses deux pentes) : un creux de 1 mm y prend son ombre et ses reflets.
function surfaceTournee(F, point, rangs, segments) {
  var T = F.THREE, n = segments, P = [], pos = [], nor = [], uv = [], idx = [], k, j;
  for (k = 0; k < rangs; k++) {
    var rang = [];
    for (j = 0; j <= n; j++) { var th = TOUR * j / n, q = point(th, k); rang.push([q[0] * Math.cos(th), q[0] * Math.sin(th), q[1]]); }
    P.push(rang);
  }
  // La texture comme celle de formes.js (tourne) : autour, un carreau tous les 16 mm du plus grand
  // tour ; le long du profil, sa longueur. Prise sur la seule hauteur, elle restait la même d'un rang à
  // l'autre d'une face plate, et le grain s'y étirait en rayons.
  var rmax = 0, long = [0];
  for (k = 0; k < rangs; k++) { rmax = Math.max(rmax, Math.hypot(P[k][0][0], P[k][0][1])); if (k) long.push(long[k - 1] + Math.hypot(P[k][0][0] - P[k - 1][0][0], P[k][0][1] - P[k - 1][0][1], P[k][0][2] - P[k - 1][0][2])); }
  var nu = Math.max(1, Math.round(TOUR * rmax / F.CARREAU));
  for (k = 0; k < rangs; k++) for (j = 0; j <= n; j++) {
    var p = P[k][j], ja = (j - 1 + n) % n, jb = (j + 1) % n, ka = Math.max(0, k - 1), kb = Math.min(rangs - 1, k + 1);
    var u = [P[k][jb][0] - P[k][ja][0], P[k][jb][1] - P[k][ja][1], P[k][jb][2] - P[k][ja][2]];
    var v = [P[kb][j][0] - P[ka][j][0], P[kb][j][1] - P[ka][j][1], P[kb][j][2] - P[ka][j][2]];
    var nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0], l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) { nx = 0; ny = 0; nz = 1; l = 1; }   // le centre d'une face, où le tour se réduit à un point
    pos.push(p[0], p[1], p[2]); nor.push(nx / l, ny / l, nz / l); uv.push(nu * j / n, long[k] / F.CARREAU);
  }
  for (k = 0; k + 1 < rangs; k++) for (j = 0; j < n; j++) {
    var A = k * (n + 1) + j, B = A + 1, C = B + n + 1, D = A + n + 1;
    idx.push(A, B, C, A, C, D);
  }
  return geometrie(T, pos, nor, uv, idx);
}

// LE TOUR DU BOÎTIER, vu de face : le dessus, le bout droit, le dessous, le congé où il rejoint le
// disque, le disque autour du cadran, la droite tangente et l'arrondi du coin, jusqu'au dessus. Il part
// du joint du noir et du vert sur le dessus (rang 0) ; `iBas` est le joint sur le dessous.
function contour(F) {
  var D = DISQUE, pts = F.adoucir([[JOINT, HAUT], [BOUT - 2.2, HAUT, { a: 11 }], [BOUT - 0.6, 55, { a: 30 }], [BOUT, 74.15, { a: 30 }],
    [BOUT - 0.6, 93.3, { a: 30 }], [BOUT - 2.2, BAS, { a: 12 }], [JOINT, BAS]]);
  pts = recouper(pts, 2.5);
  var iBas = pts.length - 1;
  // Le congé du dessous, là où le disque passe sous la ligne du bas (la silhouette du dessous redescend
  // de z = 113 à x = 30 jusqu'à 116,4 à x = 4) : 14 mm de rayon, ESTIMÉ sur cette courbe.
  var rf = 14, dz = BAS + rf - D.z, cf = [D.x + Math.sqrt((D.r + rf) * (D.r + rf) - dz * dz), BAS + rf];
  var aDisque = Math.atan2(cf[1] - D.z, cf[0] - D.x);
  pts.pop(); pts = pts.concat(recouper([[JOINT, BAS], [cf[0], BAS]], 2.5));
  pts = pts.concat(arc(cf, rf, -QUART, aDisque + Math.PI - TOUR, 1.2).slice(1));
  // La droite tangente au disque et à l'arrondi du coin.
  var c1 = [COIN.x, HAUT + COIN.r], d = [D.x - c1[0], D.z - c1[1]], ld = Math.hypot(d[0], d[1]);
  var beta = Math.acos((COIN.r - D.r) / ld), ad = Math.atan2(d[1], d[0]), an = ad + beta;
  var n = [Math.cos(an), Math.sin(an)];
  if (n[0] > 0) { an = ad - beta; n = [Math.cos(an), Math.sin(an)]; }
  if (an < 0) an += TOUR;
  pts = pts.concat(arc([D.x, D.z], D.r, aDisque, an, 2.5).slice(1));
  var p1 = [c1[0] + COIN.r * n[0], c1[1] + COIN.r * n[1]];
  pts = pts.concat(recouper([pts[pts.length - 1], p1], 2.5).slice(1));
  pts = pts.concat(arc(c1, COIN.r, an, 1.5 * Math.PI, 1.2).slice(1));
  pts = pts.concat(recouper([[c1[0], HAUT], [JOINT, HAUT]], 2.5).slice(1, -1));
  return { pts: pts, iBas: iBas };
}

// LE BOÎTIER : une coque montée sur ce tour. Chaque point porte une colonne d'anneaux : l'arrondi du
// dos (un quart de cercle qui rentre dans le plan de face), la tranche, l'arrondi de devant ; le dos et
// la face sont plats. Le vert et le noir se partagent les mêmes anneaux : leur limite tombe sur une
// colonne, et les deux faces plates se coupent sur la droite x = JOINT.
function boitier(F, lot) {
  var T = F.THREE, C = contour(F), P = C.pts, N = P.length, iBas = C.iBas, i, j, k;
  var aire = 0;
  for (i = 0; i < N; i++) { j = (i + 1) % N; aire += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
  var sens = aire > 0 ? 1 : -1, dehors = [];
  for (i = 0; i < N; i++) {
    var a = P[(i - 1 + N) % N], b = P[i], c = P[(i + 1) % N];
    var e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
    var m = [sens * (e1[1] / l1 + e2[1] / l2), -sens * (e1[0] / l1 + e2[0] / l2)], lm = Math.hypot(m[0], m[1]);
    dehors.push([m[0] / lm, m[1] / lm]);
  }
  var anneaux = [], nAr = 6, nAv = 4;
  for (k = 0; k <= nAr; k++) { var f = k / nAr * QUART; anneaux.push({ d: R_ARRIERE * (1 - Math.sin(f)), y: ARRIERE + R_ARRIERE * (1 - Math.cos(f)), cn: Math.sin(f), ny: -Math.cos(f) }); }
  for (k = 0; k <= nAv; k++) { var g = k / nAv * QUART; anneaux.push({ d: R_AVANT * (1 - Math.cos(g)), y: AVANT - R_AVANT + R_AVANT * Math.sin(g), cn: Math.cos(g), ny: Math.sin(g) }); }
  var nA = anneaux.length, pos = [], nor = [], uv = [], abs = [0];
  for (i = 1; i < N; i++) abs.push(abs[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  for (k = 0; k < nA; k++) {
    var an = anneaux[k];
    for (i = 0; i < N; i++) {
      pos.push(P[i][0] - an.d * dehors[i][0], an.y, P[i][1] - an.d * dehors[i][1]);
      nor.push(dehors[i][0] * an.cn, an.ny, dehors[i][1] * an.cn);
      uv.push(abs[i] / F.CARREAU, an.y / F.CARREAU);
    }
  }
  function sommet(k, i) { return k * N + i; }
  var a0 = sommet(nAr, 0), b0 = sommet(nAr, 1), c0 = sommet(nAr + 1, 1);
  var ux = pos[b0 * 3] - pos[a0 * 3], uy = pos[b0 * 3 + 1] - pos[a0 * 3 + 1], uz = pos[b0 * 3 + 2] - pos[a0 * 3 + 2];
  var vx = pos[c0 * 3] - pos[a0 * 3], vy = pos[c0 * 3 + 1] - pos[a0 * 3 + 1], vz = pos[c0 * 3 + 2] - pos[a0 * 3 + 2];
  var endroit = ((uy * vz - uz * vy) * nor[a0 * 3] + (uz * vx - ux * vz) * nor[a0 * 3 + 1] + (ux * vy - uy * vx) * nor[a0 * 3 + 2]) > 0;
  var noirs = [], verts = [];
  for (k = 0; k + 1 < nA; k++) for (i = 0; i < N; i++) {
    j = (i + 1) % N;
    var A = sommet(k, i), B = sommet(k, j), Cc = sommet(k + 1, j), D = sommet(k + 1, i), tas = i < iBas ? verts : noirs;
    if (endroit) tas.push(A, B, Cc, A, Cc, D); else tas.push(A, Cc, B, A, D, Cc);
  }
  var coque = geometrie(T, pos, nor, uv, noirs.concat(verts));
  var gN = coque.clone(); gN.setIndex(noirs); lot.ajouter("noir", gN);
  var gV = coque.clone(); gV.setIndex(verts); lot.ajouter("vertRainBird", gV);

  // LE DOS ET LA FACE, plats, coupés au joint.
  [[0, -1], [nA - 1, 1]].forEach(function (face) {
    var k = face[0], ny = face[1], bord = [];
    for (i = 0; i < N; i++) bord.push([pos[sommet(k, i) * 3], pos[sommet(k, i) * 3 + 2]]);
    var y = anneaux[k].y, vert = bord.slice(0, iBas + 1), noir = bord.slice(iBas).concat([bord[0]]);
    [[vert, "vertRainBird"], [noir, "noir"]].forEach(function (morceau) {
      var poly = morceau[0], faces = T.ShapeUtils.triangulateShape(poly.map(function (p) { return new T.Vector2(p[0], p[1]); }), []);
      var p = [], nn = [], u = [], ix = [];
      poly.forEach(function (q) { p.push(q[0], y, q[1]); nn.push(0, ny, 0); u.push(q[0] / F.CARREAU, q[1] / F.CARREAU); });
      faces.forEach(function (f) {
        var A = poly[f[0]], B = poly[f[1]], Cc = poly[f[2]], cr = (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]);
        if ((cr < 0) === (ny > 0)) ix.push(f[0], f[1], f[2]); else ix.push(f[0], f[2], f[1]);
      });
      lot.ajouter(morceau[1], geometrie(T, p, nn, u, ix));
    });
    // Le joint sur le dos et la face : un trait sombre, droit.
    var haut = bord[0], bas = bord[iBas], ligne = [], nl = [], cl = [];
    for (j = 0; j <= 20; j++) { ligne.push([JOINT, y, haut[1] + (bas[1] - haut[1]) * j / 20]); nl.push([0, ny, 0]); cl.push([1, 0, 0]); }
    lot.ajouter("creux", trait(T, ligne, nl, cl, 0.45, 0.04));
  });
  // Le joint qui passe l'arête, sur le dessus et le dessous : il suit une colonne d'anneaux.
  [0, iBas].forEach(function (ic) {
    var pts = [], nn = [], cc = [];
    for (k = 0; k < nA; k++) {
      var v = sommet(k, ic);
      pts.push([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]); nn.push([nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]]); cc.push([1, 0, 0]);
    }
    lot.ajouter("creux", trait(T, pts, nn, cc, 0.45, 0.04));
  });
}

// LA PATTE DE L'ÉPAULE GAUCHE : une petite oreille ronde, percée d'une fente, sur le flanc du boîtier en
// haut à gauche. Elle déborde de la silhouette (la colonne 91, droite, des rangées 344 à 370, là où
// l'épaule s'arrondit), de la rangée 320 à la 375 (z = 36,5 à 45,7) ; sa fente, sombre, fait 2 mm sur
// 6,4 (rangées 328 à 362). Sa largeur dans l'épaisseur (7 mm), sa saillie (0,9 mm : à 1,6 mm elle
// faisait une plaque rapportée, que la photo ne montre pas) et sa place dans l'épaisseur (au milieu du
// flanc) sont ESTIMÉES : la photo ne la voit que de profil.
function patte(F, lot) {
  var T = F.THREE, c1 = [COIN.x, HAUT + COIN.r], z = 41, x = c1[0] - Math.sqrt(COIN.r * COIN.r - (z - c1[1]) * (z - c1[1]));
  var n = [(x - c1[0]) / COIN.r, (z - c1[1]) / COIN.r];
  var g = plaque(F, ferme(F, rectangle(-3.5, -5, 3.5, 5, 3)), [ferme(F, rectangle(-1, -3.2, 1, 3.2, 0.95))], -1.6, 0.9, 0.4);
  // La plaque est montée le long de Y : sa largeur va sur l'épaisseur du boîtier, sa saillie sur la
  // normale du tour, sa longueur sur la tangente.
  var M = new T.Matrix4().makeBasis(new T.Vector3(0, 1, 0), new T.Vector3(n[0], 0, n[1]), new T.Vector3(n[1], 0, -n[0]));
  M.setPosition(x, -4, z);
  lot.ajouter("noir", g.applyMatrix4(M));
}

// LE CONTOUR DE LA BAGUE ET DU CADRE : le cercle de la bague et le rectangle du cadre, réunis, avec un
// congé là où le bord du cadre quitte le cercle (la photo y montre une courbe douce, de 25 pixels).
function bagueEtCadre(cx, cz, r, haut, bas, droite, coin, conge) {
  var ft = [cx + Math.sqrt((r + conge) * (r + conge) - (haut - conge - cz) * (haut - conge - cz)), haut - conge];
  var fb = [cx + Math.sqrt((r + conge) * (r + conge) - (bas + conge - cz) * (bas + conge - cz)), bas + conge];
  var aT = Math.atan2(ft[1] - cz, ft[0] - cx), aB = Math.atan2(fb[1] - cz, fb[0] - cx), pts = [];
  // Une droite n'a besoin que de ses deux bouts : la plaque n'en est pas moins plate.
  pts = pts.concat([[ft[0], haut], [droite - coin, haut]]);
  pts = pts.concat(arc([droite - coin, haut + coin], coin, -QUART, 0, 1).slice(1));
  pts = pts.concat(arc([droite - coin, bas - coin], coin, 0, QUART, 1));
  pts = pts.concat([[fb[0], bas]]);
  pts = pts.concat(arc(fb, conge, -QUART, Math.atan2(cz - fb[1], cx - fb[0]), 0.8).slice(1));
  pts = pts.concat(arc([cx, cz], r, aB, aT + TOUR, 2).slice(1));
  pts = pts.concat(arc(ft, conge, Math.atan2(cz - ft[1], cx - ft[0]), QUART, 0.8).slice(1, -1));
  return pts;
}

// LA FACE : la bague et le cadre argentés, l'écran, les boutons.
function face(F, lot) {
  var B = BAGUE, K = CADRE, y = AVANT;
  var dehors = bagueEtCadre(B.x, B.z, B.r1, K.haut, K.bas, K.droite, 4.5, 4);
  var dedans = bagueEtCadre(B.x, B.z, B.r0, K.hautDedans, K.basDedans, K.droiteDedans, 2.2, 2);
  lot.ajouter("grisBuddy", plaque(F, dehors, [dedans], y - 0.2, K.y, K.arrondi, 5));
  // Sous la vitre, le noir de l'afficheur ; la vitre, sans un chiffre, s'arrête avant le bord droit.
  // Elle commence à x = 29,5, sous le bord de la bague : à droite du cadran elle remplit le jour entre
  // eux, comme sur la photo ; au-dessus, le noir de la face reste visible. Partie de x = 25,5, son coin
  // se voyait dans ce jour, au-dessus du cadran.
  lot.ajouter("noirLisse", plaque(F, ferme(F, rectangle(29.5, K.hautDedans - 0.6, K.droiteDedans + 0.6, K.basDedans + 0.6, 2)), [], y - 0.2, y + 0.15, 0.05));
  lot.ajouter("ecran", plaque(F, ferme(F, rectangle(29.5, K.hautDedans - 0.3, ECRAN.droite, K.basDedans + 0.3, 1.2)), [], y - 0.2, y + 0.45, 0.1));
  // LES TROIS PETITS BOUTONS à droite de l'écran, ajustés sur le rendu vu du point de vue de la photo :
  // ils partent du bord du cadre, sans jour (le gris du cadre finit à la colonne 856 à 862, le bouton
  // commence à 858 à 864, rangées 450, 530 et 610), et finissent à la colonne 902 ; ils font 44 pixels
  // de large quand le rendu en donnait 36 à 38, posés de x = 113,3 à 120,4. Ils descendent aussi de
  // 1 mm : les trois, comptés à la colonne 880 (rangées 412 à 652), tombaient 6 à 8 pixels trop haut
  // quand le bas du cadre, à côté, n'est qu'à 4 pixels. De z = 53,4 à 66,8, 68,3 à 82,0 et 83,0 à
  // 96,6. Ils dépassent de 2,8 mm : ESTIMÉ. Celui du haut porte un triangle en relief vers le haut,
  // celui du bas vers le bas, blancs comme sur la photo, de 4,6 mm sur 2,9 (21 et 16 pixels) ; celui
  // du milieu rien (il porte « OK » sur la photo : aucun texte sur la pièce).
  [[53.4, 66.8, -1], [68.3, 82.0, 0], [83.0, 96.6, 1]].forEach(function (b) {
    lot.ajouter("noirLisse", plaque(F, ferme(F, rectangle(113.05, b[0], 121.3, b[1], 2.2)), [], y - 0.3, y + 2.8, 0.8));
    if (!b[2]) return;
    var cx = 117.2, cz = (b[0] + b[1]) / 2, s = b[2];
    lot.ajouter("blanc", plaque(F, ferme(F, [[cx - 2.3, cz - s * 1.2, { a: 0.3 }], [cx + 2.3, cz - s * 1.2, { a: 0.3 }], [cx, cz + s * 1.7, { a: 0.3 }]]), [], y + 2.6, y + 3.1, 0.15));
  });
  // LES DEUX LARGES BOUTONS sous l'écran : de x = 58,5 à 81,3 et 82,8 à 106,5 (colonnes 587 à 830),
  // de z = 100,9 à 108,9 : sur le rendu vu comme la photo, posés de 101,3 à 108,6, ils faisaient 38 à
  // 40 pixels de haut aux colonnes 650 et 750, la photo 44 à 49. Sans texte. Ils dépassent de 2,2 mm :
  // ESTIMÉ.
  [[58.5, 81.3], [82.8, 106.5]].forEach(function (b) {
    lot.ajouter("noirLisse", plaque(F, ferme(F, rectangle(b[0], 100.9, b[1], 108.9, 2.4)), [], y - 0.3, y + 2.2, 0.8));
  });
}

// LE CADRAN : un gros bouton rond, noir. Son flanc porte onze fentes dans le sens de l'axe, à 32,7
// degrés l'une de l'autre (la photo en montre six sur la moitié gauche, à 101, 133, 167, 197, 228 et
// 260 degrés), de 2,8 mm de large et 16 mm de long (de la bague à 1,8 mm de la face). Sur la photo
// agrandie deux fois, leur fond reste noir et seul leur flanc du bas prend la lumière : elles sont
// creusées de 2 mm, à fond plat et flancs raides (ESTIMÉ). En cuvette arrondie de 1,2 mm, la première
// version, elles se lisaient comme des barrettes en relief. Le bord de sa
// face est rond, mordu tous les 10 degrés d'une petite encoche en V : le bord droit de la photo,
// agrandi trois fois, montre un arc net et ses encoches (rangées 470, 508, 542, 630 et 663, soit 37,
// 27,6, 17, -14 et -25 degrés), de 3 pixels de creux, 0,5 mm. Une ondulation régulière, essayée
// d'abord, faisait un bord mou que la photo n'a pas. Sa face : six secteurs, cinq filets blancs et une
// bande blanche (celle qu'on tourne vers l'écran), autour d'un petit rond au centre. Les mots de la
// photo ne sont pas repris.
function cadran(F, lot) {
  var T = F.THREE, K = CADRAN, R = K.r, h = K.y1 - K.y0, cr = 1.1, n = 216, fentes = 11, f0 = 101 * Math.PI / 180;
  var f1 = 2.4, f2 = h - 1.8, demi = 1.4;   // la fente, de f1 à f2, et sa demi-largeur
  // Des rangs serrés là où le flanc change : les deux bouts arrondis des fentes, et le haut, où naissent
  // les crans ; trois rangs suffisent entre eux, où rien ne bouge.
  var cote = [-0.5, 0, 1.2, f1, f1 + 0.4, f1 + 0.8, f1 + 1.2, f1 + 1.6, f1 + 2.2, 7.5, 11, f2 - 2.2, f2 - 1.6, f2 - 1.2, f2 - 0.8, f2 - 0.4, f2, h - cr];
  var rangs = cote.map(function (z) { return [R, z]; });
  for (var q = 1; q <= 4; q++) { var a = q / 4 * QUART; rangs.push([R - cr + cr * Math.cos(a), h - cr + cr * Math.sin(a)]); }
  [R - 1.8, R - 3, R - 4.5, 0].forEach(function (r) { rangs.push([r, h]); });
  function creusement(th, r0, z) {
    var d = 0;
    // une fente : un creux arrondi, son fond en arc, ses bouts en demi-cercle
    if (r0 > R - 0.2 && z < h - 0.5) {
      var pas = TOUR / fentes, u = th - f0; u -= Math.round(u / pas) * pas;
      var s = u * R, zc = Math.min(Math.max(z, f1 + demi), f2 - demi), e = Math.hypot(s, z - zc) / demi;
      if (e < 1) d += 2.0 * doux((1 - e) / 0.35);
    }
    // les encoches du bord de la face, qui s'effacent vers le bas du flanc et vers le centre de la face.
    // Le tour a six segments par encoche (216 pour 36) : chacune tombe sur un sommet (6,67 degrés, puis
    // tous les 10, au plus près des 6,5 relevés) et ses deux voisins la referment, d'où le V.
    // Elles tiennent dans l'arrondi du bord : à 0,5 mm et descendues de 2,4 mm sur le flanc, elles
    // dentaient le bord gauche du cadran en scie, quand la photo l'y montre lisse.
    var poids = r0 >= R - 0.01 ? doux((z - (h - 1.6)) / 0.9) : doux((r0 - (R - 4)) / 2.5);
    var pasC = TOUR / 36, uc = th - pasC * 2 / 3; uc -= Math.round(uc / pasC) * pasC;
    d += 0.35 * poids * Math.max(0, 1 - Math.abs(uc * R) / 0.9);
    return d;
  }
  var g = surfaceTournee(F, function (th, k) {
    var p = rangs[k], r0 = p[0], d = creusement(th, r0, p[1]);
    return [Math.max(0, r0 - d * (r0 > 0 ? Math.min(1, r0 / (R - 4)) : 0)), p[1]];
  }, rangs.length, n);
  lot.ajouter("noir", g, { rx: -QUART, x: K.x, y: K.y0, z: K.z });
  // LA FACE, ses filets et sa bande, relevés sur la photo agrandie quatre fois : le centre du rond à la
  // colonne 353, rangée 590, les largeurs redressées du cosinus de 25 degrés, 6 pixels par millimètre
  // (la face est 4 % plus près de l'objectif que l'axe : son rayon fait 164 pixels pour 27,4 mm).
  // Ce n'est pas une étoile : chaque filet part du rond en lui étant tangent, du côté des aiguilles
  // d'une montre, comme les lames d'un diaphragme. Relevé à six rayons de 45 à 145 pixels, un filet
  // tourne de 11 degrés en s'éloignant du centre, ce que fait une droite passant à 22 à 25 pixels de
  // lui (3,75 mm). Leurs directions au loin : 63, 123, 187, 245 et 301 degrés, soit 5 degrés plus
  // 60 fois un à cinq. La bande prend la sixième place, à 5 degrés : sa largeur ne change pas
  // (46 pixels, 7,6 mm, des colonnes 420 à 480), son bord du bas passe 4 mm sous le centre et son bord
  // du haut 3,6 mm au-dessus, si bien qu'elle prolonge le rond des deux côtés. Posés d'abord en rayons
  // depuis le centre, la bande en coin de 5,2 à 8,8 mm, ils faisaient une roue que la photo n'a pas.
  // Les filets font 0,7 mm (4 pixels) ; le rond, 2,6 mm de rayon dedans et 3,4 dehors (5 pixels
  // d'épaisseur). Ils s'arrêtent 0,6 mm avant l'arrondi du bord, que mordent les encoches.
  var y = K.y1 + 0.04, bord = R - cr - 0.6, rc = 2.6, rd = 3.4, e = 3.75, larg = 0.7, phi0 = 5 * Math.PI / 180;
  function aPlat(u, v) { return [K.x + u, K.z - v]; }
  // un point du repère d'une direction : a le long d'elle, b sur sa gauche
  function dans(phi, a, b) { var c = Math.cos(phi), s = Math.sin(phi); return aPlat(a * c - b * s, a * s + b * c); }
  function auBord(b) { return Math.sqrt(bord * bord - b * b); }
  for (var i = 1; i < 6; i++) {
    var phi = phi0 + i * Math.PI / 3, b0 = -e - larg / 2, b1 = -e + larg / 2;
    lot.ajouter("blanc", aplat(F, [dans(phi, 0, b0), dans(phi, auBord(b0), b0), dans(phi, auBord(b1), b1), dans(phi, 0, b1)], [], y));
  }
  // La bande : ses deux bords droits, le bord du cadran entre eux, et contre le rond un demi-cercle pris
  // dans son épaisseur (3 mm), pour ne pas couvrir le noir du milieu. Au-dessus des filets de 0,01 mm,
  // et le rond au-dessus d'elle : là où deux blancs se recouvrent, aucun ne se bat avec l'autre.
  var bas = -4.0, haut = 3.6, aB = Math.atan2(bas, auBord(bas)), aH = Math.atan2(haut, auBord(haut)), bande = [dans(phi0, 0, bas)], k;
  for (k = 0; k <= 10; k++) { var a = aB + (aH - aB) * k / 10; bande.push(dans(phi0, bord * Math.cos(a), bord * Math.sin(a))); }
  bande.push(dans(phi0, 0, haut));
  for (k = 0; k <= 12; k++) { var b = QUART - Math.PI * k / 12; bande.push(dans(phi0, 3 * Math.cos(b), 3 * Math.sin(b))); }
  lot.ajouter("blanc", aplat(F, bande, [], y + 0.01));
  var dehors = [], dedans = [];
  for (i = 0; i < 48; i++) { var t = TOUR * i / 48; dehors.push(aPlat(rd * Math.cos(t), rd * Math.sin(t))); dedans.push(aPlat(rc * Math.cos(t), rc * Math.sin(t))); }
  lot.ajouter("blanc", aplat(F, dehors, [dedans], y + 0.02));
}

// L'ÉCROU D'ENTRÉE, noir, femelle 3/4", qui tourne sur le col du boîtier. Sa silhouette rangée par
// rangée : une bague lisse de 35 mm en haut (204 pixels, rangées 113 à 137), puis le corps, 39,2 mm en
// haut (228 pixels, rangées 140 à 170), qui se resserre en bas (220 pixels à la rangée 200, 210 à la
// 245), son bord du bas arrondi jusqu'à la rangée 255 (z = 24,4).
// Ce corps est lisse, creusé de NEUF RAINURES ÉTROITES, et non de larges cannelures entre des côtes
// fines (la première version) : la lumière de la photo vient de la gauche (le bord gauche du boîtier,
// la gauche de la bague argentée sont les plus clairs), et chaque bande sombre étroite y a son flanc
// DROIT éclairé (rangée 200 : sombre des colonnes 203 à 215, clair de 218 à 221), ce que fait un
// creux, pas une côte. Les rainures, rangées 175 et 200 : leurs bandes sombres aux colonnes 140, 208
// et 282, une quatrième contre le bord droit (324), à 38 et 39 degrés l'une de l'autre une fois
// ramenées sur le tour ; neuf à 40 degrés les posent toutes à 2,5 pixels près, huit à 45 degrés les
// mettaient 9 à 11 pixels plus loin. L'appareil de la photo, tel qu'il a été ajusté sur elle, regarde
// l'axe de l'écrou depuis 111,7 degrés du flanc droit (il est à 32 cm sur la gauche, 81 cm devant) :
// la rainure de devant est donc à 116 degrés, la valeur qui pose les quatre sur le rendu vu comme la
// photo, à 2,5 pixels près. Elles font 3,2 mm de large (21 pixels de flanc à flanc), creusées de 1 mm
// (ESTIMÉ). En haut elles naissent 0,5 mm sous la marche de la bague, en rampe (un rectangle clair de
// 4 pixels, sur la photo agrandie neuf fois, contraste relevé) : la marche reste entière. En bas elles
// finissent en U (agrandie cinq fois), à z = 22,2, juste au-dessus du bord arrondi.
function rayonEcrou(z) { return 19.6 - 1.55 * Math.pow(Math.max(0, (z - 7) / 15.7), 1.5); }
function ecrou(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, grand = F.GAZ["3/4"].d / 2 + 0.15, haut = 4.45, bas = 22.7;
  lot.ajouter("noirLisse", F.tourne([[fond, 1.2], [grand + 0.55, 0], [17.5, 0, { a: 0.9, fin: 0.3 }], [17.5, haut, { a: 0.3, fin: 0.5 }], [19.65, haut]], { segments: 96 }));
  // Des rangs serrés dans la rampe du haut et dans le U du bas ; entre eux, le corps ne fait que se
  // resserrer.
  var zs = [haut, 4.95, 5.25, 5.55, 5.85, 7.2, 10, 13, 16, 18.2, 19.6, 20.6, 21.0, 21.35, 21.7, 22.0, 22.3, bas];
  var demi = 1.6, debut = haut + 0.5, rampe = 0.9, centreU = 22.2 - demi, profond = 1.0, pas = TOUR / 9, devant = 116 * Math.PI / 180;
  // 270 segments : trente par rainure, si bien que les neuf tombent pareil sur le tour.
  lot.ajouter("noirLisse", surfaceTournee(F, function (th, k) {
    var z = zs[k], r = rayonEcrou(z), u = th - devant; u -= Math.round(u / pas) * pas;
    var s = Math.abs(u * r), e = demi - Math.hypot(s, Math.max(0, z - centreU));
    return [r - profond * doux(e / 0.35) * doux((z - debut) / rampe), z];
  }, zs.length, 270));
  lot.ajouter("noirLisse", F.tourne([[rayonEcrou(bas), bas], [17.95, 23.4, { a: 0.6, fin: 0.3 }], [16.6, 24.4, { a: 0.4 }], [12.9, 24.4],
    [12.9, 14.6], [grand, 14.6], [grand, 13.2], [fond, PRISE_HAUT]], { segments: 96 }));
  lot.ajouter("noirLisse", F.taraudage({ gaz: "3/4", z0: 1.2, z1: PRISE_HAUT, segments: 32 }));
  // Le joint plat où bute le mâle du robinet, et le filtre gris posé dans son trou (on en voit la
  // tache claire au milieu de la face, rangée 108) : ESTIMÉS.
  lot.ajouter("joint", F.tourne([[7, 14.6], [7, 13.25, { c: 0.3 }], [13.3, 13.25, { c: 0.3 }], [13.3, 14.6]], { segments: 40 }));
  lot.ajouter("pvc", F.tourne([[0, 13.0], [6.9, 13.0, { a: 0.4 }], [6.9, 14.5]], { segments: 40 }));
}

// LES COLS ET LE FILETAGE MÂLE, relevés rangée par rangée sur la silhouette.
// - Sous l'écrou : une rondelle de 32,6 mm (190 pixels, rangées 255 à 262), le col de 31 mm (181
//   pixels, rangées 265 à 282), puis la base du boîtier, de 35 mm (204 pixels, rangées 285 à 310),
//   son bord du haut éclairé (rangée 292), qui entre dans le boîtier.
// - Sous le boîtier : la base de 32,2 mm (187 pixels, rangées 780 à 818), son bord du bas arrondi
//   jusqu'à la rangée 826 (z = 122,5) ; une bague lisse au sommet des filets (rangées 826 à 831), puis
//   le filetage, et sa pointe : une portée lisse de 1,8 mm et son chanfrein.
function cols(F, lot) {
  lot.ajouter("joint", F.tourne([[15.4, 24.3], [16.3, 24.4, { a: 0.3 }], [16.3, 25.5, { a: 0.3 }], [15.4, 25.6]], { segments: 64 }));
  lot.ajouter("noir", F.tourne([[12.9, 24.6], [15.5, 24.6, { c: 0.2 }], [15.5, 29.6, { a: 0.4 }], [17.5, 29.6, { a: 0.9, fin: 0.3 }], [17.5, 46]], { segments: 72 }));
  // Le congé où la base rejoint le dessus du boîtier : 4 mm (la photo montre une courbe douce à droite
  // de la base, de la colonne 322 à 360, rangées 300 à 322), noyé dans le dessus. Il ne fait pas
  // le tour : le dessus n'est plat qu'à droite et devant la base ; ailleurs le boîtier s'arrondit sous
  // elle, et un congé entier y flottait en collerette (vu de dos, essayé). Il s'efface donc de -15 à
  // -35 degrés et de 95 à 115 degrés.
  lot.ajouter("noir", surfaceTournee(F, function (th, k) {
    var deg = th * 180 / Math.PI; if (deg > 180) deg -= 360;
    // Là où il s'efface, il rentre aussi de 0,3 mm dans la base : une bande presque à fleur de la base
    // s'y battait avec elle à l'écran (un pointillé sombre au pied de la base, vu de près).
    var w = doux((deg + 35) / 20) * doux((115 - deg) / 20), f = 4 * w, r = 17.5 - 0.3 * (1 - w);
    if (k < 5) { var a = Math.PI - QUART * k / 4; return [r + f + f * Math.cos(a), HAUT - f + f * Math.sin(a)]; }
    return [r + f, HAUT + 2.2];
  }, 6, 96));
  lot.ajouter("noir", F.tourne([[16.1, 108], [16.1, 122.5, { a: 1.4, fin: 0.3 }], [12.95, 122.5]], { segments: 72 }));
  var fond = F.rayonDuFond({ gaz: "3/4" }), crete = F.GAZ["3/4"].d / 2, finFilet = L - 1.8, passage = 8;
  lot.ajouter("noirLisse", F.tourne([[12.95, 122.4], [12.95, 123.2, { a: 0.25 }], [fond, 123.45, { a: 0.2 }], [fond, FILET]], { segments: 48 }));
  lot.ajouter("noirLisse", F.filetage({ gaz: "3/4", z0: FILET, z1: finFilet, pointe: "z1", entree: 0.4, sortie: 0.5 }));
  // La portée du bout, la face (deux cercles posés sur le plan z = L, que la scène mesure), le passage
  // de l'eau (16 mm, ESTIMÉ) et son fond sombre.
  lot.ajouter("noirLisse", F.tourne([[fond, finFilet], [crete - 0.2, finFilet + 0.4, { a: 0.15 }], [crete - 0.2, L, { c: 0.5 }], [passage, L, { c: 0.4 }], [passage, L - 14]], { segments: 64 }));
  lot.ajouter("creux", F.tourne([[passage, L - 14], [0, L - 14]], { segments: 24 }));
}

export default {
  "programmateur-rainbird": function (F) {
    var lot = new F.Lot();
    ecrou(F, lot); cols(F, lot); boitier(F, lot); patte(F, lot); face(F, lot); cadran(F, lot);
    return {
      couches: lot.couches(),
      haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE_HAUT },
      // Au dixième de millimètre : la soustraction de deux cotes en virgule flottante rendait 14,599999.
      bas: { z: L, x: 0, genre: "male", gaz: "3/4", prise: Math.round((L - FILET) * 10) / 10 }
    };
  }
};
