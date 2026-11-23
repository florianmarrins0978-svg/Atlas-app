// LE PROGRAMMATEUR EN NEZ DE ROBINET SOLEM BL-NR (réf. SP1151), une voie : l'écrou d'entrée vert,
// femelle 3/4", le boîtier noir et sa pièce verte, le filetage de sortie, mâle 3/4". Pièce de pile,
// sur l'axe Z local : la face du haut de l'écrou en z = 0, la pointe du filetage en z = L.
//
// D'OÙ VIENNENT LES COTES. Sa photo de profil (docs/robinet-3d-photos/solem-bl-nr-SP1151.jpg, 1024 x
// 1024 pixels). Le filetage mâle 3/4" y fait 155 pixels au sommet des filets (de x = 329 à x = 483)
// pour 26,441 mm, soit 5,86 pixels par millimètre ; son pas le recoupe (un filet tous les 10,75
// pixels, soit 5,93). 5,88 est retenu : les cotes sont tenues à 2 % près, la photo de studio n'en
// promet pas plus. L'axe de l'eau est la colonne x = 406 (le milieu du filetage, de l'écrou et du col,
// à un pixel près) ; la face du haut de l'écrou, la rangée y = 146 ; la pointe du filetage, la rangée
// 974. Une cote se lit donc ainsi : z = (y - 146) / 5,88, et x = (406 - x photo) / 5,88.
//
// L'ORIENTATION, et elle compte. Sur la photo le boîtier part à droite de l'axe. Dans la pile, la
// pièce est vissée sous la sortie GAUCHE de la double sortie, et la sortie droite (celle du client)
// est à un centimètre au-dessus, à droite : le boîtier part donc vers -X, vers l'extérieur. La pièce
// est la photo vue en miroir, d'où le signe moins de x. Le boîtier est symétrique de part et d'autre
// du plan XZ : la face +Y, celle qu'on voit de face, porte ce que porte la photo, et la face -Y aussi.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : l'épaisseur du boîtier (52 mm, ce qu'il faut à
// un boîtier à piles autour d'un écrou de 43 mm), l'arrondi de ses arêtes dans l'épaisseur, la
// profondeur du creux en C, et tout le dedans (le taraudage et sa profondeur de 13 mm, le joint, le
// filtre gris et sa tige, le passage du filetage mâle).

var L = 140.8;        // la pointe du filetage mâle : rangée 974
var H = 26;           // la demi-épaisseur du boîtier : ESTIMÉE
var PRISE_HAUT = 13;  // la profondeur où l'écrou reçoit le mâle du robinet : ESTIMÉE (le joint est dessous)
var FILET = 124.6;    // le début du filetage mâle, sous sa bague lisse : rangée 878
var QUART = Math.PI / 2, TOUR = Math.PI * 2;
function doux(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

// LA FACE DU BOUT, une droite : relevée sur la silhouette de x = 887 (y = 430) à x = 808 (y = 730),
// elle penche de 14,7 degrés, son haut plus loin de l'axe que son bas.
function bout(z) { return -81.8 + 0.263 * (z - 48.3); }
var PENTE_BOUT = 0.263, COS_BOUT = 1 / Math.sqrt(1 + PENTE_BOUT * PENTE_BOUT);

// LA PIÈCE VERTE sur la face du bout, du dessous du nez (rangée 416) à la rangée 572 : z = 46 à 72,4.
// Sur le flanc, ses deux coins du côté de l'axe (là où se coupent ses bords, avant leur arrondi).
var VERT = { haut: 46.0, bas: 72.4, coinHaut: [-36.4, 49.8], coinBas: [-31.5, 68.6] };
// LE JOINT EN BIAIS, sous la pièce verte : sa pente (x = 584 à la rangée 560, x = 519 à la rangée 820).
var PENTE_JOINT = 0.255;

// L'ARRONDI DES ARÊTES DANS L'ÉPAISSEUR, invisible de profil : ESTIMÉ. Dans l'épaisseur, 11 mm du côté
// de l'axe (le dos, la face qu'on tient), 8 mm dessus et dessous, 5 mm au bout. Dans le plan du profil :
// - 6,5 mm, même au dos : les deux coins du dos sont des arcs de 8,5 à 9 mm de rayon (relevés dans
//   profil()), et un arrondi plus large que 0,8 fois ce rayon s'y écrasait (11 mm, essayé : un pli de
//   lumière en travers du coin, vu de trois quarts). La photo le permet : le dégradé du dos y tient dans
//   les 4 à 7 derniers millimètres (le noir reste à 17 jusque-là, rangées 360 à 740) ;
// - 2 mm au bout : sur la photo le vert reste éclairé jusqu'au bord de la silhouette (135 à 145, sans
//   bande sombre, rangées 470 à 530), et le creux en C court jusque-là.
function arrondiPlan(x) { return 2 + 4.5 * doux((x + 74) / 14); }
function arrondiEpaisseur(x) { return 5 + 3 * doux((x + 74) / 14) + 3 * doux((x - 8) / 16); }

// UNE GÉOMÉTRIE À PARTIR DE TABLEAUX.
function geometrie(T, pos, nor, uv, idx) {
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// LA MÊME FORME DE L'AUTRE CÔTÉ DU PLAN XZ : le flanc -Y porte ce que porte le flanc +Y. Un miroir
// retourne les triangles : on les remet à l'endroit, sinon ils regardent dans la pièce.
function miroir(g) {
  var m = g.clone(); m.scale(1, -1, 1);
  var idx = m.getIndex().array.slice();
  for (var i = 0; i < idx.length; i += 3) { var t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  m.setIndex(Array.from(idx));
  return m;
}

// UN TRAIT POSÉ SUR UNE SURFACE : une ligne de joint. `pts` sont ses points, `normales` la normale de la
// surface en chacun, `cotes` la direction de sa largeur. Il flotte de `levee` au-dessus de la surface.
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
    // à l'endroit : la face regarde du côté de la normale de la surface
    var ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
    var bx = pos[c2 * 3] - pos[a * 3], by = pos[c2 * 3 + 1] - pos[a * 3 + 1], bz = pos[c2 * 3 + 2] - pos[a * 3 + 2];
    var s = (ay * bz - az * by) * nor[a * 3] + (az * bx - ax * bz) * nor[a * 3 + 1] + (ax * by - ay * bx) * nor[a * 3 + 2];
    if (s >= 0) idx.push(a, b, c2, a, c2, e); else idx.push(a, c2, b, a, e, c2);
  }
  return geometrie(T, pos, nor, uv, idx);
}
// UNE RIGOLE CREUSÉE DANS LE FLANC +Y : le creux en C, les deux lignes de joint horizontales. Sa ligne
// du milieu est `ligne` ([[x, z], ...], dans le plan du flanc) ; en travers, un creux de `largeur` et
// de `profondeur`, en cosinus, ou à fond plat si `paroi` est donnée (la part de la largeur que prend
// chaque paroi). Chaque bout (`debut`, `fin`) est rond ({ rond: true } : un demi-cercle, la profondeur
// le suit) ou s'estompe ({ fondu: mm }). Rend le creux (ses parois et son fond, deux géométries sur les
// mêmes sommets) et son tour, que le flanc perce.
//
// POURQUOI UN VRAI CREUX, et pas une bande à plat dont la normale penche (la version d'avant, pour les
// lignes de joint) : la bande gardait la même largeur sous tous les angles, et vue d'en dessous sa
// paroi renvoyait le studio comme un trait de craie. Un creux, lui, se cache derrière son propre bord.
function rigole(F, ligne, o) {
  var T = F.THREE, W = o.largeur, D = o.profondeur, nt = o.travers || 11, demi = W / 2, i, k;
  var cumul = [0];
  for (i = 1; i < ligne.length; i++) cumul.push(cumul[i - 1] + Math.hypot(ligne[i][0] - ligne[i - 1][0], ligne[i][1] - ligne[i - 1][1]));
  var S = cumul[cumul.length - 1];
  function auPoint(s) {
    for (var j = 1; j < ligne.length; j++) if (s <= cumul[j] + 1e-9 || j === ligne.length - 1) {
      var a = ligne[j - 1], b = ligne[j], t = (s - cumul[j - 1]) / (cumul[j] - cumul[j - 1]);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  // Les abscisses : six pas dans un bout rond (son demi-cercle), `pas` ailleurs.
  var r0 = o.debut.rond ? demi : 0, r1 = o.fin.rond ? demi : 0, abs = [], m = Math.max(1, Math.ceil((S - r0 - r1) / (o.pas || 0.6)));
  for (k = 0; k < 6 && r0; k++) abs.push(r0 * k / 6);
  for (k = 0; k <= m; k++) abs.push(r0 + (S - r0 - r1) * k / m);
  for (k = 1; k <= 6 && r1; k++) abs.push(S - r1 + r1 * k / 6);
  function bout(d, e) {   // [largeur, profondeur] relatives, à d mm du bout e
    if (e.rond) { var u = d >= demi ? 1 : Math.sqrt(Math.max(0, 1 - (demi - d) * (demi - d) / (demi * demi))); return [u, u]; }
    return [1, doux(d / e.fondu)];
  }
  var ns = abs.length, P = abs.map(auPoint), pos = [], nor = [], uv = [], idx = [], fond = [], grille = [];
  for (k = 0; k < ns; k++) {
    var av = P[Math.max(0, k - 1)], ap = P[Math.min(ns - 1, k + 1)], l = Math.hypot(ap[0] - av[0], ap[1] - av[1]);
    var mx = -(ap[1] - av[1]) / l, mz = (ap[0] - av[0]) / l, b0 = bout(abs[k], o.debut), b1 = bout(S - abs[k], o.fin);
    var fl = Math.min(b0[0], b1[0]), fp = Math.min(b0[1], b1[1]), rang = [];
    for (var it = 0; it < nt; it++) {
      var t = it / (nt - 1), x = P[k][0] + (t - 0.5) * W * fl * mx, z = P[k][1] + (t - 0.5) * W * fl * mz;
      var y = H - D * fp * (o.paroi ? doux(Math.min(t, 1 - t) / o.paroi) : (1 - Math.cos(TOUR * t)) / 2);
      rang.push([x, z]); pos.push(x, y, z); nor.push(0, 1, 0); uv.push(x / F.CARREAU, z / F.CARREAU);
    }
    grille.push(rang);
  }
  for (k = 0; k + 1 < ns; k++) for (var jt = 0; jt + 1 < nt; jt++) {
    var A = k * nt + jt, B = A + 1, C = A + nt + 1, Dd = A + nt;
    [[A, B, C], [A, C, Dd]].forEach(function (f) {
      var p0 = [pos[f[0] * 3], pos[f[0] * 3 + 2]], p1 = [pos[f[1] * 3], pos[f[1] * 3 + 2]], p2 = [pos[f[2] * 3], pos[f[2] * 3 + 2]];
      var cr = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
      var tas = o.paroi && jt / (nt - 1) >= o.paroi - 1e-6 && (jt + 1) / (nt - 1) <= 1 - o.paroi + 1e-6 ? fond : idx;
      if (cr < 0) tas.push(f[0], f[1], f[2]); else tas.push(f[0], f[2], f[1]);
    });
  }
  var g = geometrie(T, pos, nor, uv, idx.concat(fond)); g.computeVertexNormals();
  // Ses deux bords gardent la normale du flanc : sans quoi une couture se verrait autour du creux.
  var nrm = g.getAttribute("normal");
  for (k = 0; k < ns; k++) { nrm.setXYZ(k * nt, 0, 1, 0); nrm.setXYZ(k * nt + nt - 1, 0, 1, 0); }
  // Son tour, pour le percer dans le flanc : les mêmes points, dans l'ordre, sans les doublons d'un
  // bout rond (sa première rangée est un seul point).
  var tour = [];
  for (k = 0; k < ns; k++) tour.push(grille[k][0]);
  for (k = 1; k < nt - 1; k++) tour.push(grille[ns - 1][k]);
  for (k = ns - 1; k >= 0; k--) tour.push(grille[k][nt - 1]);
  for (k = nt - 2; k >= 1; k--) tour.push(grille[0][k]);
  var trou = tour.filter(function (p, n) { var q = tour[(n + 1) % tour.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  var parois = g.clone(); parois.setIndex(idx);
  var fondG = g.clone(); fondG.setIndex(fond);
  return { creux: parois, fond: fondG, trou: trou };
}
// Une ligne sur le flanc plat +Y, d'après son tracé dans le plan du profil ([[x, z], ...]).
function surLeFlanc(ligne) {
  var pts = [], nor = [], cotes = [];
  ligne.forEach(function (p, k) {
    var a = ligne[Math.max(0, k - 1)], b = ligne[Math.min(ligne.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    pts.push([p[0], H, p[1]]); nor.push([0, 1, 0]); cotes.push([-(b[1] - a[1]) / l, 0, (b[0] - a[0]) / l]);
  });
  return { pts: pts, nor: nor, cotes: cotes };
}
function traitSurLeFlanc(T, ligne, largeur) { var s = surLeFlanc(ligne); return trait(T, s.pts, s.nor, s.cotes, largeur, 0.04); }

// LE PROFIL DU BOÎTIER, dans le plan XZ, tout autour : le dos (le côté de l'axe), le dessus, le nez, la
// face du bout, le grand arrondi du bas, le dessous. Rend ses points, de 3 mm en 3 mm au plus.
function profil(F) {
  var T = F.THREE;
  // LE DOS, du coin du bas au coin du haut : la silhouette relevée tous les 20 pixels. Il est creusé en
  // taille : 28,9 mm de l'axe en haut (x = 236, y = 400), 24,8 mm à la taille (x = 260, y = 560),
  // 28,7 mm en bas (x = 237, y = 740). Ses deux coins sont relevés aussi : le haut passe par x = 270,
  // y = 303 et x = 248, y = 320 ; le bas par x = 255, y = 820 et x = 274, y = 830. Ce sont des arcs
  // tangents au dessus (ou au dessous) et au dos, de 8,6 à 8,9 mm de rayon en haut, 8,5 à 9,8 en bas.
  var dos = [[18.0, 116.7], [22.4, 116.3], [25.7, 114.6], [27.6, 111.2], [28.5, 105.5], [28.6, 100.5], [27.6, 94.2], [26.3, 87.4],
    [25.3, 80.0], [24.9, 72.0], [25.1, 65.0], [25.8, 58.5], [26.9, 52.5], [28.2, 47.2], [28.8, 42.5], [28.6, 37.0], [28.1, 33.0],
    [26.9, 29.6], [24.8, 27.6], [21.4, 26.4], [18.0, 26.2]];
  var courbe = new T.CatmullRomCurve3(dos.map(function (p) { return new T.Vector3(p[0], p[1], 0); }), false, "centripetal");
  var n = Math.ceil(courbe.getLength() / 1.4), pts = [];
  for (var k = 0; k <= n; k++) { var v = courbe.getPointAt(k / n); pts.push([v.x, v.y]); }
  // LE RESTE, en droites et en arrondis.
  // Le dessus : plat au ras du col (rangée 300, z = 26,2) jusqu'à x = 555, puis il descend vers le bout
  // de 0,098 mm par mm (rangée 307 à x = 600, 324 à x = 800). Un point à x = -1 porte le joint vertical.
  // Le nez, le bout du dessus qui déborde de 3 mm au-dessus de la pièce verte : sa face à x = 908
  // (de la rangée 375 à 395), son arrondi du haut (rangées 332 à 375), celui du bas (rangées 395 à 416).
  // La face du bout, de la pièce verte au grand arrondi du bas : 16 mm de rayon, de la rangée 736 sur la
  // face à x = 721 sur le dessous. Le dessous remonte vers le bout (rangée 822 à x = 520, 807 à x = 720),
  // et il marche d'un cran (1,7 mm) là où finit la ligne de joint en biais (x = 509) : la partie du
  // bout est moins haute que la partie de l'axe.
  var reste = [[-1, 26.2], [-25, 26.2, { a: 60 }], [-85.4, 32.1, { a: 7.5 }], [-85.4, 42.0], [-85.1, 43.8], [-84.4, 45.1], [-83.4, 45.8],
    [bout(VERT.haut), VERT.haut], [bout(VERT.bas), VERT.bas], [-65.2, 111.5, { a: 16 }], [-19.6, 115.0, { a: 1.2 }], [-17.9, 116.7, { a: 1.2 }], [-1, 116.7]];
  var tout = pts.concat(reste);
  var lisse = F.adoucir([tout[tout.length - 1]].concat(tout, [tout[0]])).slice(1, -1), sortie = [];
  for (var i = 0; i < lisse.length; i++) {
    var p = lisse[i], q = lisse[(i + 1) % lisse.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l < 0.05) continue;
    var m = Math.ceil(l / 3);
    for (var j = 0; j < m; j++) sortie.push([p[0] + (q[0] - p[0]) * j / m, p[1] + (q[1] - p[1]) * j / m]);
  }
  return sortie;
}
function plusProche(P, x, z) {
  var best = 0, d = Infinity;
  P.forEach(function (p, i) { var e = Math.hypot(p[0] - x, p[1] - z); if (e < d) { d = e; best = i; } });
  return best;
}

// LE BOÎTIER : une coque montée sur son profil. Chaque point du profil porte une colonne d'anneaux :
// la paroi (la tranche, de -Y à +Y), puis de chaque côté l'arrondi de l'arête, un quart d'ellipse qui
// rentre dans le plan du profil et monte jusqu'au flanc. Le flanc est plat, découpé en deux : la pièce
// verte et le noir.
//
// POURQUOI PAS UN PRISME de formes.js : son biseau est le même tout autour, de trois pas, et ses flancs
// n'ont aucune découpe. Ici l'arrondi change d'un côté à l'autre (large au dos, serré au bout) et la
// pièce verte fait le tour du bout sans couture : sa limite tombe sur des colonnes d'anneaux.
function boitier(F, lot) {
  var T = F.THREE, P = profil(F), N = P.length, nA = 8, rangs = 2 * nA + 2;
  var iHaut = plusProche(P, bout(VERT.haut), VERT.haut), iBas = plusProche(P, bout(VERT.bas), VERT.bas);
  var iV1 = plusProche(P, -1, 26.2), iV2 = plusProche(P, -1, 116.7), iMarche = plusProche(P, -18.75, 115.85);
  var aire = 0, i, j, k;
  for (i = 0; i < N; i++) { j = (i + 1) % N; aire += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
  var sens = aire > 0 ? 1 : -1;
  // La normale sortante de chaque point, lissée sur 3 mm de part et d'autre : un arrondi qui suivrait
  // chaque petit coin du profil se replierait sur lui-même.
  var arete = [], abs = [0];
  for (i = 0; i < N; i++) {
    j = (i + 1) % N; var ex = P[j][0] - P[i][0], ez = P[j][1] - P[i][1], le = Math.hypot(ex, ez);
    arete.push([sens * ez / le, -sens * ex / le]); if (i) abs.push(abs[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  }
  var perimetre = abs[N - 1] + Math.hypot(P[0][0] - P[N - 1][0], P[0][1] - P[N - 1][1]);
  var sortante = [], dedans = [];
  for (i = 0; i < N; i++) {
    var sx = 0, sz = 0;
    for (k = 0; k < N; k++) {
      var dd = Math.abs(abs[k] - abs[i]); dd = Math.min(dd, perimetre - dd);
      if (dd > 3) continue;
      var w = 1 - dd / 3.2, a1 = arete[(k - 1 + N) % N], a2 = arete[k]; sx += w * (a1[0] + a2[0]); sz += w * (a1[1] + a2[1]);
    }
    var ls = Math.hypot(sx, sz); sortante.push([sx / ls, sz / ls]); dedans.push([-sx / ls, -sz / ls]);
  }
  // Sur la face du bout, l'arrondi rentre à l'horizontale : la limite de la pièce verte le traverse alors
  // à niveau, comme sur la photo, au lieu de remonter de 2 mm en biais.
  // Au cran du dessous, il rentre dans le plan du joint en biais, qui y tombe : le joint traverse
  // alors l'arête du dessous sans se casser.
  for (i = 0; i < N; i++) {
    var surBout = Math.abs(P[i][0] - bout(P[i][1])) < 0.05 && P[i][1] > VERT.haut - 0.01 && P[i][1] < 99.5;
    var ecart = Math.abs(abs[i] - abs[iMarche]); ecart = Math.min(ecart, perimetre - ecart);
    if (surBout) dedans[i] = [1 / COS_BOUT, 0];
    else if (ecart < 2.2) dedans[i] = [-PENTE_JOINT, -1];
  }
  // Là où deux rayons voisins se croisent avant la profondeur voulue, l'arrondi s'arrête avant : un coin
  // du profil plus serré que lui le plierait.
  var limite = P.map(function () { return Infinity; });
  for (i = 0; i < N; i++) {
    j = (i + 1) % N; var di = dedans[i], dj = dedans[j], det = -di[0] * dj[1] + dj[0] * di[1];
    if (Math.abs(det) < 1e-9) continue;
    var rx = P[j][0] - P[i][0], rz = P[j][1] - P[i][1], t = (-rx * dj[1] + dj[0] * rz) / det, u = (di[0] * rz - di[1] * rx) / det;
    if (t > 0 && u > 0) { limite[i] = Math.min(limite[i], 0.8 * t); limite[j] = Math.min(limite[j], 0.8 * u); }
  }
  for (var passe = 0; passe < 40; passe++) for (i = 0; i < N; i++) {
    var av = (i - 1 + N) % N, ap = (i + 1) % N;
    limite[i] = Math.min(limite[i], limite[av] + 0.5 * Math.hypot(P[i][0] - P[av][0], P[i][1] - P[av][1]), limite[ap] + 0.5 * Math.hypot(P[i][0] - P[ap][0], P[i][1] - P[ap][1]));
  }
  var A = P.map(function (p, i) { return Math.min(arrondiPlan(p[0]), limite[i]); });
  var B = P.map(function (p) { return arrondiEpaisseur(p[0]); });

  // Les anneaux : le rang 0 est le bord du flanc -Y, le rang 2 nA + 1 celui du flanc +Y.
  var pos = [], nor = [], uv = [], indice = function (k, i) { return k * N + i; };
  for (k = 0; k < rangs; k++) {
    var cote = k <= nA ? -1 : 1, phi = (k <= nA ? nA - k : k - nA - 1) / nA * QUART;
    for (i = 0; i < N; i++) {
      var off = A[i] * (1 - Math.cos(phi)), y = cote * ((H - B[i]) + B[i] * Math.sin(phi));
      pos.push(P[i][0] + off * dedans[i][0], y, P[i][1] + off * dedans[i][1]);
      nor.push(sortante[i][0] * Math.cos(phi), cote * Math.sin(phi), sortante[i][1] * Math.cos(phi));
      uv.push(abs[i] / F.CARREAU, (y + cote * off) / F.CARREAU);
    }
  }
  // Le sens des triangles se règle une fois, sur la paroi.
  var a0 = indice(nA, 0), b0 = indice(nA, 1), c0 = indice(nA + 1, 1);
  var ux = pos[b0 * 3] - pos[a0 * 3], uy = pos[b0 * 3 + 1] - pos[a0 * 3 + 1], uz = pos[b0 * 3 + 2] - pos[a0 * 3 + 2];
  var vx = pos[c0 * 3] - pos[a0 * 3], vy = pos[c0 * 3 + 1] - pos[a0 * 3 + 1], vz = pos[c0 * 3 + 2] - pos[a0 * 3 + 2];
  var endroit = ((uy * vz - uz * vy) * nor[a0 * 3] + (uz * vx - ux * vz) * nor[a0 * 3 + 1] + (ux * vy - uy * vx) * nor[a0 * 3 + 2]) > 0;
  var noirs = [], verts = [];
  for (k = 0; k + 1 < rangs; k++) for (i = 0; i < N; i++) {
    j = (i + 1) % N;
    var a = indice(k, i), b = indice(k, j), c = indice(k + 1, j), d = indice(k + 1, i), tas = (i >= iHaut && i < iBas) ? verts : noirs;
    if (endroit) tas.push(a, b, c, a, c, d); else tas.push(a, c, b, a, d, c);
  }
  var coque = geometrie(T, pos, nor, uv, noirs.concat(verts));
  coque.computeVertexNormals();
  // Les bords des flancs gardent la normale du flanc : sans quoi une couture se verrait entre l'arrondi
  // et le plat.
  var nrm = coque.getAttribute("normal");
  for (i = 0; i < N; i++) { nrm.setXYZ(indice(0, i), 0, -1, 0); nrm.setXYZ(indice(rangs - 1, i), 0, 1, 0); }
  var gNoir = coque.clone(); gNoir.setIndex(noirs);
  var gVert = coque.clone(); gVert.setIndex(verts);
  lot.ajouter("noir", gNoir); lot.ajouter("vert", gVert);

  // LE FLANC +Y, plat, et sa découpe. Le bord du flanc est le dernier anneau.
  var bord = []; for (i = 0; i < N; i++) bord.push([pos[indice(rangs - 1, i) * 3], pos[indice(rangs - 1, i) * 3 + 2]]);
  // LA LIMITE DE LA PIÈCE VERTE sur le flanc, relevée par sa couleur : son bord du haut monte vers le
  // bout (rangée 437 à x = 640, 416 à x = 880), son bord du bas descend (554 puis 572), son bord de
  // gauche suit la pente de la face du bout (x = 600 au plus près de l'axe, rangée 515). Ses deux coins
  // de ce côté sont arrondis de 4,5 et 5 mm (25 à 30 pixels).
  var limiteVerte = F.adoucir([bord[iHaut], VERT.coinHaut.concat([{ a: 4.5 }]), VERT.coinBas.concat([{ a: 5 }]), bord[iBas]]);
  var interieur = limiteVerte.slice(1, -1);
  var cC = creuxEnC(F, bord, iHaut, iBas);
  function v2(p) { return new T.Vector2(p[0], p[1]); }
  var polyNoir = [], polyVert = [];
  for (i = iBas; i !== iHaut; i = (i + 1) % N) polyNoir.push(bord[i]);
  polyNoir.push(bord[iHaut]); polyNoir = polyNoir.concat(interieur);
  for (i = iHaut; i <= iBas; i++) polyVert.push(bord[i]);
  polyVert = polyVert.concat(interieur.slice().reverse());
  function plat(poly, trous) {
    var faces = T.ShapeUtils.triangulateShape(poly.map(v2), trous.map(function (t) { return t.map(v2); }));
    var tous = poly.concat.apply(poly, trous), p = [], n = [], u = [], ix = [];
    tous.forEach(function (q) { p.push(q[0], H, q[1]); n.push(0, 1, 0); u.push(q[0] / F.CARREAU, q[1] / F.CARREAU); });
    faces.forEach(function (f) {
      var a = tous[f[0]], b = tous[f[1]], c = tous[f[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cr < 0) ix.push(f[0], f[1], f[2]); else ix.push(f[0], f[2], f[1]);
    });
    return geometrie(T, p, n, u, ix);
  }
  // LES DEUX LIGNES DE JOINT HORIZONTALES, des rigoles de 1,4 mm, relevées colonne par colonne (x = 470,
  // 500 et 530) : un trait noir de 3 pixels (7 à 12, la paroi du haut dans l'ombre et le fond), puis
  // la paroi du bas qui prend la lumière (53 à 74, trois pixels plus bas), de la rangée 448 à la 457
  // pour celle du haut (z = 52,1 en son milieu), de la 677 à la 686 pour celle du bas (z = 91,1).
  // Creusées de 0,6 mm (ESTIMÉ). Leur fond prend la matière des creux : la scène ne calcule pas
  // l'ombre qu'une rigole se fait à elle-même. Leur bout du côté de l'axe est rond, à x = 424 (3,1 mm de
  // l'axe, 2,2 mm avant le joint vertical) ; l'autre bout débouche dans le jour de la pièce verte (celle
  // du haut) et dans le joint en biais (celle du bas) : il s'arrête 0,35 mm avant, caché par le trait sombre
  // qui le borde, sans quoi le trou percé dans le flanc en toucherait le bord.
  var biais = joint(limiteVerte, bord, iMarche), joints = [];
  [[52.1, croiser(limiteVerte, 52.1)], [91.1, croiser(biais, 91.1)]].forEach(function (j) {
    joints.push(rigole(F, [[-3.1, j[0]], [j[1] + 0.35, j[0]]], { largeur: 1.4, profondeur: 0.6, paroi: 0.35, debut: { rond: true }, fin: { fondu: 0.3 } }));
  });
  var flancNoir = plat(polyNoir, joints.map(function (j) { return j.trou; })), flancVert = plat(polyVert, [cC.trou]);
  [flancNoir, miroir(flancNoir)].forEach(function (g) { lot.ajouter("noir", g); });
  joints.forEach(function (j) {
    lot.ajouter("noir", j.creux); lot.ajouter("noir", miroir(j.creux)); lot.ajouter("creux", j.fond); lot.ajouter("creux", miroir(j.fond));
  });
  [flancVert, miroir(flancVert), cC.creux, miroir(cC.creux)].forEach(function (g) { lot.ajouter("vert", g); });

  // LES TRAITS SOMBRES : le jour entre deux coquilles, sans reflet, comme sur la photo.
  // - le tour de la pièce verte (3 pixels) ;
  // - le joint en biais, sous la pièce verte, jusqu'au cran du dessous (3 pixels : une rigole le
  //   faisait briller d'un trait clair sur toute sa longueur, vu de face, essayé) ;
  // - le joint vertical, presque sur l'axe (x = 411 à 412 sur toute la hauteur, soit x = -1 mm).
  [[limiteVerte, 0.45], [biais, 0.45], [[bord[iV1], bord[iV2]], 0.5]].forEach(function (t) {
    var g = traitSurLeFlanc(T, t[0], t[1]);
    lot.ajouter("creux", g); lot.ajouter("creux", miroir(g));
  });
  // Ces joints passent l'arête et font le tour : ils suivent alors une colonne d'anneaux, de flanc à
  // flanc (par le dessus, le dessous ou la face du bout).
  var nrmA = coque.getAttribute("normal"), posA = coque.getAttribute("position");
  [[iHaut, 0.45], [iBas, 0.45], [iV1, 0.5], [iV2, 0.5], [iMarche, 0.45]].forEach(function (col) {
    var ic = col[0], pts = [], nn = [], cc = [], av = P[(ic - 1 + N) % N], ap = P[(ic + 1) % N], lt = Math.hypot(ap[0] - av[0], ap[1] - av[1]);
    for (var k = 0; k < rangs; k++) {
      var v = indice(k, ic);
      pts.push([posA.getX(v), posA.getY(v), posA.getZ(v)]); nn.push([nrmA.getX(v), nrmA.getY(v), nrmA.getZ(v)]);
      cc.push([(ap[0] - av[0]) / lt, 0, (ap[1] - av[1]) / lt]);
    }
    lot.ajouter("creux", trait(T, pts, nn, cc, col[1], 0.04));
  });
}

// LE JOINT EN BIAIS, de la pièce verte au cran du dessous. Sur la photo il passe par x = 584, y = 560
// et x = 519, y = 820 (la pente de la face du bout, à peu de chose près), tombe sur le cran du dessous,
// et prolonge le bord gauche de la pièce verte (la photo agrandie, contraste relevé) : il part donc de là où ce
// bord quitte la droite pour s'arrondir vers le bas, et finit au bord du flanc, au pied de la colonne
// d'anneaux du cran.
function joint(limiteVerte, bord, iMarche) {
  var hg = VERT.coinHaut, bg = VERT.coinBas, fin = limiteVerte[limiteVerte.length - 1];
  var ux = hg[0] - bg[0], uz = hg[1] - bg[1], lu = Math.hypot(ux, uz), vx = fin[0] - bg[0], vz = fin[1] - bg[1], lv = Math.hypot(vx, vz);
  ux /= lu; uz /= lu; vx /= lv; vz /= lv;
  var angle = Math.acos(ux * vx + uz * vz), t = Math.min(5 / Math.tan(angle / 2), lu * 0.49, lv * 0.49);
  return [[bg[0] + ux * t, bg[1] + uz * t], bord[iMarche]];
}
// Où une ligne (une suite de points [x, z]) passe-t-elle à la hauteur z ? La première fois, en partant
// de son début, du côté de l'axe (x > -50).
function croiser(ligne, z) {
  for (var i = 0; i + 1 < ligne.length; i++) {
    var p = ligne[i], q = ligne[i + 1];
    if (p[0] > -50 && (p[1] - z) * (q[1] - z) <= 0 && p[1] !== q[1]) return p[0] + (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]);
  }
  return ligne[0][0];
}

// LE CREUX EN C de la pièce verte (le bouton) : une rigole en U, ouverte vers le bout. Relevé sur la
// photo agrandie quatre fois, contraste relevé, quadrillée tous les 2 mm : le milieu de sa branche du
// haut à la rangée 456 (z = 52,8), celui de la branche du bas à 520 (z = 63,6), le dehors du fond du
// U à x = 771 (62 mm de l'axe) ; la rigole fait 3,6 mm de large (21 pixels). On la voit à son ombre,
// la paroi du haut sombre, celle du bas claire : c'est un creux, pas un relief. Sa profondeur, 1 mm,
// est ESTIMÉE. Ses branches finissent à 78,1 mm (en haut) et 75,6 mm (en bas) de l'axe, en
// s'estompant ; ici elles s'arrêtent sur le plat du flanc, 0,65 mm avant l'arrondi du bout (le bord
// penche, et le coin bas d'une branche s'en approche de 0,5 mm) : 0,2 et 0,5 mm plus tôt.
function creuxEnC(F, bord, iHaut, iBas) {
  var R = 5.4, c = [-69.2, 58.2], k;
  function limiteA(z) {   // le bord du flanc au niveau z, sur la face du bout
    for (var i = iHaut; i < iBas; i++) {
      var p = bord[i], q = bord[i + 1];
      if ((p[1] - z) * (q[1] - z) <= 0 && p[1] !== q[1]) return p[0] + (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]);
    }
    return bord[iHaut][0];
  }
  var finHaut = limiteA(c[1] - R) + 0.65, finBas = limiteA(c[1] + R) + 0.65, ligne = [[finHaut, c[1] - R]];
  for (k = 0; k <= 36; k++) { var a = -QUART + Math.PI * k / 36; ligne.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]); }
  ligne.push([finBas, c[1] + R]);
  return rigole(F, ligne, { largeur: 3.6, profondeur: 1.0, travers: 9, debut: { fondu: 1.8 }, fin: { fondu: 1.8 } });
}

// L'ÉCROU D'ENTRÉE, vert, femelle 3/4", qui tourne sur l'entrée du boîtier. Sa silhouette relevée
// rangée par rangée (le vert contre le fond blanc), et ses ombres colonne par colonne :
// - le fût, 36 mm au dessus (212 pixels à la rangée 146, 216 dès la 148 : un bord arrondi de 0,5 mm),
//   qui fait aussi le fond des créneaux entre les languettes ;
// - neuf languettes en U de 4,4 mm de large (celle qui fait face va de x = 391, son ombre, à x = 417,
//   son reflet : 26 pixels), à 40 degrés l'une de l'autre (la suivante à 82 pixels de l'axe), dont le
//   haut arrondi naît à la rangée 152 (z = 1). Elles s'évasent en descendant, comme une pièce démoulée :
//   la silhouette passe de 42 mm (rangée 156) à 43,4 mm (rangée 222), donc leur dos de 20,9 à 21,45 mm
//   de l'axe ; en bas elles affleurent la jupe (la colonne 406 ne change pas de teinte en y passant) ;
// - au pied de chaque créneau, les deux coins du U arrondis contre la jupe (1 mm, 3 pixels) ;
// - la jupe, une bande droite de 43,5 mm (256 pixels, rangées 232 à 242), son dessus éclairé à la
//   rangée 230 (z = 14,4), puis un chanfrein dans l'ombre jusqu'à 39,6 mm (rangées 243 à 254) ;
// - le dessous à la rangée 254,5 (z = 18,45), posé sur l'anneau noir de 24 mm (141 pixels).
// Le dedans, le taraudage et ce qui est dessous, n'est pas sur la photo.
function ecrou(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, grand = F.GAZ["3/4"].d / 2 + 0.15;
  lot.ajouter("vert", F.tourne([[fond, 1.2], [grand + 0.55, 0], [18.1, 0, { a: 0.5 }], [18.1, 14.4, { a: 0.6 }], [21.75, 14.4, { a: 0.4 }],
    [21.75, 16.4, { a: 0.5 }], [19.8, 18.45, { a: 0.4 }], [12.6, 18.45, { a: 0.4 }], [12.6, 14.6], [grand, 14.6], [grand, 13.2], [fond, PRISE_HAUT]], { segments: 72 }));
  lot.ajouter("vert", F.taraudage({ gaz: "3/4", z0: 1.2, z1: PRISE_HAUT, segments: 32 }));
  // Une languette : un U vu de dehors (son haut arrondi de tout son demi-large), monté dans l'épaisseur
  // depuis le fût, son pied élargi en congé sur la jupe. Celle de face regarde +Y, comme sur la photo.
  // Le dos plat d'une languette est à 20,9 mm de l'axe en haut ; son évasement le pousse à 21,45 en bas.
  var u = { a: 2.15, fin: 0.25 }, conge = { a: 1, fin: 0.3 };
  for (var i = 0; i < 9; i++) {
    var g = F.prisme([[-3.3, 15.3], [-3.3, 14.4], [-2.2, 14.4, conge], [-2.2, 1.0, u], [2.2, 1.0, u], [2.2, 14.4, conge], [3.3, 14.4], [3.3, 15.3]], 17.2, 20.9, { arrondi: 0.45 });
    lot.ajouter("vert", evaser(F, g, (21.45 - 20.9) / 13.4, 1.0), { rx: QUART, rz: Math.PI + i * TOUR / 9 });
  }
  // Le joint plat où bute le mâle du robinet, et le filtre gris posé dans son trou. Sa tige est le
  // « bouchon » qu'on voit dépasser du dessus de l'écrou : 2,25 mm au-dessus (rangée 133), un dessus
  // plat de 4,6 mm (27 pixels) au bord arrondi, puis un tronc de cône jusqu'à 7,1 mm (42 pixels) à
  // 0,5 mm de la face de l'écrou (rangée 143). Sa forme sous la face, et le filtre, sont ESTIMÉS.
  lot.ajouter("joint", F.tourne([[7, 14.6], [7, 13.25, { c: 0.3 }], [13.3, 13.25, { c: 0.3 }], [13.3, 14.6]], { segments: 40 }));
  lot.ajouter("pvc", F.tourne([[0, 13.0], [6.9, 13.0, { a: 0.4 }], [6.9, 14.5]], { segments: 40 }));
  lot.ajouter("pvc", F.tourne([[0, -2.25], [2.0, -2.25, { a: 0.5 }], [3.05, -1.6, { a: 0.6 }], [3.65, -0.2, { a: 0.4 }], [3.65, 13.0]], { segments: 32 }));
}
// L'ÉVASEMENT D'UNE LANGUETTE : son dos s'écarte de l'axe de `pente` mm par mm en descendant, à partir
// de `depart` (dans son repère à elle, avant d'être posée : Y le long de l'axe, Z vers le dehors).
function evaser(F, g, pente, depart) {
  var p = g.getAttribute("position");
  for (var i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + pente * (p.getY(i) - depart));
  return F.toCreasedNormals(g, 0.6);
}

// LE COL DU HAUT, LE COL DU BAS ET LE FILETAGE MÂLE, relevés rangée par rangée sur la silhouette.
// - Sous l'écrou, l'entrée du boîtier : un anneau noir de 24 mm (141 pixels, rangées 255 à 264), une
//   gorge (rangées 265 à 267), puis le col de 35,4 mm (208 pixels, rangées 277 à 297) jusqu'au boîtier,
//   son bord du haut arrondi de 1,8 mm (de 27,5 mm à la rangée 268 à 35,2 à la rangée 277).
// - Sous le boîtier : le col de 30,4 mm (179 pixels, rangées 834 à 856), son bord du bas arrondi de
//   1,8 mm (176 pixels à la rangée 860, 161 à la rangée 868), une gorge de 21,8 mm (rangées 869 à 871),
//   une bague lisse au fond du filet (141 pixels, rangées 872 à 877), puis le filetage : huit filets,
//   leurs creux tous les 10,7 pixels (rangées 886 à 961).
// - Le bout du mâle : sous le dernier filet (rangée 962), une portée lisse au diamètre des filets, de
//   1,9 mm (rangées 963 à 974, plus claire que les creux qui la précèdent), et son chanfrein.
// - Le joint vertical du boîtier passe sur les deux cols (x = 411).
function cols(F, lot) {
  var colHaut = [[10.8, 20.7], [17.7, 20.7, { a: 1.8 }], [17.7, 27.5]], colBas = [[15.2, 116.0], [15.2, 122.9, { a: 1.8 }], [10.9, 122.9]];
  lot.ajouter("joint", F.tourne([[11.9, 17.8], [11.9, 20.2, { a: 0.3 }], [10.8, 20.2], [10.8, 21.2]], { segments: 48 }));
  lot.ajouter("noir", F.tourne(colHaut, { segments: 64 }));
  lot.ajouter("noir", F.tourne(colBas, { segments: 64 }));
  lot.ajouter("joint", F.tourne([[10.9, 122.6], [10.9, 123.5]], { segments: 40 }));
  var fond = F.rayonDuFond({ gaz: "3/4" }), crete = F.GAZ["3/4"].d / 2, finFilet = L - 1.9, passage = 8;
  lot.ajouter("noirLisse", F.tourne([[10.9, 123.4], [fond, 123.7, { a: 0.2 }], [fond, FILET]], { segments: 48 }));
  lot.ajouter("noirLisse", F.filetage({ gaz: "3/4", z0: FILET, z1: finFilet, pointe: "z1", entree: 0.4, sortie: 0.5 }));
  // La portée du bout, puis la face (deux cercles posés sur le plan z = L, que la scène mesure), le
  // passage de l'eau (16 mm, ESTIMÉ), et son fond sombre. La portée reste 0,2 mm sous le sommet des
  // filets : sur la photo elle est à peine plus étroite qu'eux (de 1 à 2 pixels).
  lot.ajouter("noirLisse", F.tourne([[fond, finFilet], [crete - 0.2, finFilet + 0.4, { a: 0.15 }], [crete - 0.2, L, { c: 0.45 }], [passage, L, { c: 0.4 }], [passage, L - 14]], { segments: 64 }));
  lot.ajouter("creux", F.tourne([[passage, L - 14], [0, L - 14]], { segments: 24 }));
  // Le joint vertical sur les cols : un filet sombre là où x = -1, qui suit leur bord arrondi.
  [[colHaut, 15.5], [colBas, 13.4]].forEach(function (c) {
    var profil = F.adoucir(c[0]).filter(function (p) { return p[0] >= c[1]; }).map(function (p) { return [p[0] + 0.04, p[1]]; });
    [1, -1].forEach(function (cote) {
      var r = Math.max.apply(null, profil.map(function (p) { return p[0]; })), a = cote * Math.acos(-1 / r), da = 0.5 / r;
      lot.ajouter("creux", F.tourne(profil, { arc: [a - da / 2, a + da / 2], segments: 1 }));
    });
  });
}

export default {
  "programmateur-SP1151": function (F) {
    var lot = new F.Lot();
    ecrou(F, lot); cols(F, lot); boitier(F, lot);
    return {
      couches: lot.couches(),
      haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE_HAUT },
      bas: { z: L, x: 0, genre: "male", gaz: "3/4", prise: L - FILET }
    };
  }
};
