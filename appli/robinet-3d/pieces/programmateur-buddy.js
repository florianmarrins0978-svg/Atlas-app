// LE PROGRAMMATEUR EN NEZ DE ROBINET BUDDY (Aqua Plus AEV11401, « PROG BUDDY TAP TIMER 1 STAT. »), une
// voie : l'écrou d'entrée noir, femelle 3/4", le boîtier vert et sa face grise, la bande de caoutchouc
// du flanc gauche, trois boutons, l'écran, le cadran cranté, puis le filetage de sortie, mâle 3/4".
// Pièce de pile, sur l'axe Z local : la face du haut de l'écrou en z = 0, la pointe du filetage en z = L.
//
// D'OÙ VIENNENT LES COTES. Sa photo de face (docs/robinet-3d-photos/buddy-AEV11401.jpg, 1024 x 1024
// pixels ; appli/arrosage-robinet-photos/AEV11401.png en est la vignette). L'étalon est le filetage mâle
// 3/4" du bas : 137 pixels au sommet des filets (de x = 360 à x = 497, rangées 888 à 950), pour
// 26,441 mm, soit 5,18 pixels par millimètre. L'écrou le recoupe : 180,5 pixels, soit 34,8 mm, ce que
// fait un écrou femelle 3/4" de programmateur. Le pas des filets, lui, ne se lit pas : la photo en
// montre un tous les 14,3 pixels (2,8 mm), plus gros qu'aucun gaz, signe d'une image retouchée ; le
// filetage est donc au pas de la norme, 14 filets au pouce.
// L'axe de l'eau est la colonne x = 424 : l'écrou est centré sur 419, le filetage sur 428,5. La photo
// les décale de 9 pixels (1,7 mm), qu'une pièce dont l'eau passe droit ne peut pas avoir ; l'axe est
// pris entre les deux, et chacun tombe à un millimètre de sa place. Le haut de l'écrou est la rangée
// 68,5. Une cote se lit donc ainsi : x = (colonne - 424) / 5,18, et z = (rangée - 68,5) / 5,18 ; ce
// fichier les écrit telles quelles, par cx() et cz(), pour qu'on retrouve chaque point sur la photo.
// Les cotes sont tenues à 2 % près, la photo de studio n'en promet pas plus.
//
// L'ORIENTATION : celle de la photo. La face (l'écran, le cadran) regarde +Y, celui qui regarde ; le
// boîtier part surtout à droite de l'axe, vers +X. Dans la pile, la pièce est vissée sous la sortie
// GAUCHE de la double sortie (composition.js), et la sortie droite, celle du client, est à 106,8 mm à
// droite de son axe. Le bord droit du boîtier est à 75,7 mm de l'axe : il reste à 17,9 mm du sommet des
// filets de cette sortie, et son dessus 24,5 mm sous sa pointe ; il ne passe pas sous elle (mesuré dans
// la pile montée : 40,9 mm au plus près, entre le coin du boîtier et le laiton de la sortie).
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : l'épaisseur du boîtier (64 mm, ce que font les
// programmateurs à piles de ce genre), l'axe de l'eau au milieu de cette épaisseur, l'arrondi de ses
// arêtes dans l'épaisseur, le bombé de la face (1,5 mm), le dos (uni ; la coiffe grise et la bande en
// font le tour, la coiffe y descend droite), la saillie du cadran (11 mm), des boutons (2,4 mm), de la
// bande (2 mm), la profondeur de l'écran, et tout le dedans (le taraudage et sa profondeur de 16 mm, le
// joint, le passage de l'eau).

var PX = 5.18, AXE = 424, HAUT_ECROU = 68.5;
function cx(colonne) { return (colonne - AXE) / PX; }
function cz(rangee) { return (rangee - HAUT_ECROU) / PX; }
function pt(colonne, rangee, o) { return o ? [cx(colonne), cz(rangee), o] : [cx(colonne), cz(rangee)]; }

var L = cz(976.5);         // la pointe du filetage mâle : le bas de la silhouette, rangée 976,5
var FILET = cz(876);       // le premier filet, sous le col lisse (rangées 856 à 873)
var FIN_FILET = cz(955);   // le dernier sommet de filet ; dessous, la portée lisse du bout
var PRISE_HAUT = 16;       // la profondeur taraudée de l'écrou : ESTIMÉE
var H = 32;                // la demi-épaisseur du boîtier : ESTIMÉE
var QUART = Math.PI / 2, TOUR = Math.PI * 2;
function doux(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

// UNE GÉOMÉTRIE À PARTIR DE TABLEAUX.
function geometrie(T, pos, nor, uv, idx) {
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function plusProche(P, x, z) {
  var best = 0, d = Infinity;
  P.forEach(function (p, i) { var e = Math.hypot(p[0] - x, p[1] - z); if (e < d) { d = e; best = i; } });
  return best;
}
// UN CONTOUR FERMÉ, adouci à ses points { a } puis redécoupé : `pas(p)` donne la longueur la plus
// grande d'un segment autour du point p (une rainure demande des segments plus courts qu'un flanc droit).
function contourFerme(F, tout, pas) {
  var lisse = F.adoucir([tout[tout.length - 1]].concat(tout, [tout[0]])).slice(1, -1), sortie = [];
  for (var i = 0; i < lisse.length; i++) {
    var p = lisse[i], q = lisse[(i + 1) % lisse.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l < 0.05) continue;
    var m = Math.ceil(l / Math.min(pas(p), pas(q)));
    for (var j = 0; j < m; j++) sortie.push([p[0] + (q[0] - p[0]) * j / m, p[1] + (q[1] - p[1]) * j / m]);
  }
  return sortie;
}
// Une courbe relevée point par point, rendue en points tous les 1,4 mm.
function courbe(F, points) {
  var T = F.THREE, c = new T.CatmullRomCurve3(points.map(function (p) { return new T.Vector3(p[0], p[1], 0); }), false, "centripetal");
  var n = Math.ceil(c.getLength() / 1.4), pts = [];
  for (var k = 0; k <= n; k++) { var v = c.getPointAt(k / n); pts.push([v.x, v.y]); }
  return pts;
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
    var ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
    var bx = pos[c2 * 3] - pos[a * 3], by = pos[c2 * 3 + 1] - pos[a * 3 + 1], bz = pos[c2 * 3 + 2] - pos[a * 3 + 2];
    var s = (ay * bz - az * by) * nor[a * 3] + (az * bx - ax * bz) * nor[a * 3 + 1] + (ax * by - ay * bx) * nor[a * 3 + 2];
    if (s >= 0) idx.push(a, b, c2, a, c2, e); else idx.push(a, c2, b, a, e, c2);
  }
  return geometrie(T, pos, nor, uv, idx);
}
// Un trait sur une face (normale `signe` Y), d'après son tracé dans le plan XZ ; `y` est sa hauteur, ou
// la fonction qui la donne en (x, z) sur la face bombée.
function traitSurLaFace(T, ligne, largeur, y, signe) {
  var pts = [], nor = [], cotes = [];
  ligne.forEach(function (p, k) {
    var a = ligne[Math.max(0, k - 1)], b = ligne[Math.min(ligne.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    pts.push([p[0], typeof y === "function" ? y(p[0], p[1]) : y, p[1]]); nor.push([0, signe, 0]); cotes.push([-(b[1] - a[1]) / l, 0, (b[0] - a[0]) / l]);
  });
  return trait(T, pts, nor, cotes, largeur, 0.04);
}
// UNE FACE PLATE, à y = `y`, qui regarde `signe` Y : un contour ([[x, z], ...]) et ses trous.
function plat(F, poly, trous, y, signe) {
  var T = F.THREE;
  function v2(p) { return new T.Vector2(p[0], p[1]); }
  var faces = T.ShapeUtils.triangulateShape(poly.map(v2), trous.map(function (t) { return t.map(v2); }));
  var tous = poly.concat.apply(poly, trous), p = [], n = [], u = [], ix = [];
  tous.forEach(function (q) { p.push(q[0], y, q[1]); n.push(0, signe, 0); u.push(q[0] / F.CARREAU, q[1] / F.CARREAU); });
  faces.forEach(function (f) {
    var a = tous[f[0]], b = tous[f[1]], c = tous[f[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if ((cr < 0) === (signe > 0)) ix.push(f[0], f[1], f[2]); else ix.push(f[0], f[2], f[1]);
  });
  return geometrie(T, p, n, u, ix);
}
// LA FACE BOMBÉE. La face de devant n'est pas plane : elle monte de 1,5 mm (ESTIMÉ) de son bord vers
// son milieu, sur les 30 premiers millimètres, en douceur (sa pente est nulle au bord, où elle rejoint
// l'arrondi de l'arête sans pli). Ce qui y est posé (l'écran, les boutons, le cadran, les joints) suit sa
// hauteur. Le bord de la face est le dernier anneau de la coque, que boitier() pose ici.
var BOMBE = { h: 1.5, rampe: 30 }, bordDeFace = null;
function distanceAuBord(x, z) {
  var d = Infinity, n = bordDeFace.length;
  for (var i = 0; i < n; i++) {
    var a = bordDeFace[i], b = bordDeFace[(i + 1) % n], ux = b[0] - a[0], uz = b[1] - a[1], l2 = ux * ux + uz * uz;
    var t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - a[0] - t * ux, z - a[1] - t * uz));
  }
  return d;
}
function bombe(x, z) { return bordDeFace ? BOMBE.h * doux(distanceAuBord(x, z) / BOMBE.rampe) : 0; }
function hauteur(x, z) { return H + bombe(x, z); }
// Une ligne redécoupée en segments de `pas` au plus (fermée ou non).
function densifier(ligne, pas, fermee) {
  var sortie = [], n = ligne.length;
  for (var i = 0; i < (fermee ? n : n - 1); i++) {
    var p = ligne[i], q = ligne[(i + 1) % n], m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / pas));
    for (var j = 0; j < m; j++) sortie.push([p[0] + (q[0] - p[0]) * j / m, p[1] + (q[1] - p[1]) * j / m]);
  }
  if (!fermee) sortie.push(ligne[n - 1]);
  return sortie;
}
// RAFFINER UNE TRIANGULATION : la plus longue arête intérieure est coupée en deux, avec les deux
// triangles qui la portent, tant qu'il en reste une plus longue que `maxi`. Couper une arête dans ses
// deux triangles à la fois ne laisse aucun sommet en l'air (la face se plie sans fente). Les arêtes du
// bord, toutes plus courtes que `maxi` (densifier()), ne sont jamais coupées : le bord reste celui de la
// coque. Sans cela, les grands triangles de la triangulation d'un contour restaient plats.
function raffiner(pts, tris, maxi) {
  var aretes = new Map(), vivants = [], K = 1 << 16;
  function cle(a, b) { return a < b ? a * K + b : b * K + a; }
  function ajouter(t) {
    var id = vivants.length; vivants.push(t);
    for (var e = 0; e < 3; e++) { var k = cle(t[e], t[(e + 1) % 3]), l = aretes.get(k); if (!l) aretes.set(k, l = []); l.push(id); }
  }
  function retirer(id) {
    var t = vivants[id]; vivants[id] = null;
    for (var e = 0; e < 3; e++) { var k = cle(t[e], t[(e + 1) % 3]), l = aretes.get(k); l.splice(l.indexOf(id), 1); if (!l.length) aretes.delete(k); }
  }
  tris.forEach(ajouter);
  for (var garde = 0; garde < 20000; garde++) {
    var meilleure = -1, l2 = maxi * maxi;
    aretes.forEach(function (l, k) {
      var a = pts[Math.floor(k / K)], b = pts[k % K], d = (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
      if (d > l2) { l2 = d; meilleure = k; }
    });
    if (meilleure < 0) break;
    var a = Math.floor(meilleure / K), b = meilleure % K, m = pts.length;
    pts.push([(pts[a][0] + pts[b][0]) / 2, (pts[a][1] + pts[b][1]) / 2]);
    aretes.get(meilleure).slice().forEach(function (id) {
      var t = vivants[id], r = 0;
      while (!((t[r] === a && t[(r + 1) % 3] === b) || (t[r] === b && t[(r + 1) % 3] === a))) r++;
      var p = t[r], q = t[(r + 1) % 3], o = t[(r + 2) % 3];
      retirer(id); ajouter([p, m, o]); ajouter([m, q, o]);
    });
  }
  return vivants.filter(Boolean);
}
// La normale de la surface y = haut(x, z), côté +Y.
function normaleDe(haut, x, z) {
  var e = 0.05, gx = (haut(x + e, z) - haut(x - e, z)) / (2 * e), gz = (haut(x, z + e) - haut(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
  return [-gx / l, 1 / l, -gz / l];
}
// UNE PART DE LA FACE BOMBÉE : un contour et ses trous (densifiés), triangulés, raffinés en triangles de
// 6 mm au plus, chaque sommet posé à sa hauteur.
function faceBombee(F, poly, trous) {
  var T = F.THREE;
  function v2(p) { return new T.Vector2(p[0], p[1]); }
  var faces = T.ShapeUtils.triangulateShape(poly.map(v2), trous.map(function (t) { return t.map(v2); }));
  var pts = poly.concat.apply(poly, trous).map(function (p) { return [p[0], p[1]]; });
  var tris = raffiner(pts, faces.map(function (f) { return [f[0], f[1], f[2]]; }), 6), pos = [], nor = [], uv = [], ix = [];
  pts.forEach(function (q) {
    var n = normaleDe(hauteur, q[0], q[1]);
    pos.push(q[0], hauteur(q[0], q[1]), q[1]); nor.push(n[0], n[1], n[2]); uv.push(q[0] / F.CARREAU, q[1] / F.CARREAU);
  });
  tris.forEach(function (t) {
    var a = pts[t[0]], b = pts[t[1]], c = pts[t[2]], cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cr < 0) ix.push(t[0], t[1], t[2]); else ix.push(t[0], t[2], t[1]);
  });
  return geometrie(T, pos, nor, uv, ix);
}
// Ce qui se pose à plat sur la face (le jour d'un bouton) : chaque sommet monté à sa hauteur, plus `leve`.
function poserSurLaFace(g, leve) {
  var p = g.getAttribute("position");
  for (var i = 0; i < p.count; i++) p.setY(i, hauteur(p.getX(i), p.getZ(i)) + leve);
  return g;
}

// UN CONTOUR DESSINÉ DANS LE PLAN DE LA FACE ([[x, z], ...]), monté en volume de y0 à y1 vers +Y : un
// prisme de formes.js, tourné d'un quart autour de X (son Z devient Y, et -Y devient Z).
function surLaFace(F, contour, y0, y1, arrondi) {
  return F.prisme(contour.map(function (p) { return p.length > 2 ? [p[0], -p[1], p[2]] : [p[0], -p[1]]; }), y0, y1, { arrondi: arrondi }).rotateX(-QUART);
}
// Une forme tournée (autour de Z) dressée sur la face : son axe devient +Y, posé en (x, y, z).
function dresser(g, x, y, z) { return g.rotateX(-QUART).translate(x, y, z); }

// UNE COQUE MONTÉE SUR SON PROFIL (le dessin de la pièce vue de face, dans le plan XZ). Chaque point du
// profil porte une colonne d'anneaux : la paroi (la tranche, de -Y à +Y), puis de chaque côté l'arrondi
// de l'arête, un quart d'ellipse qui rentre de A dans le plan et monte de B jusqu'à la face plate, à
// y = +H et -H. C'est la coque du Solem (programmateur-solem.js), rendue générale : `matiere(i)` donne la
// matière de la tranche entre les points i et i + 1, `creuser(p, phi, bord)` une profondeur à creuser
// sous la surface (négative, elle bombe : les nervures de la bande), `bord` étant le point où cette
// colonne d'anneaux rejoint la face ; `normaleFace(bord)` la normale de la face en ce point, quand elle
// n'est pas plate. Rend le bord de la face, ses positions et normales, et `indice`.
function coque(F, lot, P, o) {
  var T = F.THREE, N = P.length, nA = 8, rangs = 2 * nA + 2, Hc = o.H, i, j, k;
  var aire = 0;
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
  var A = P.map(function (p, i) { return Math.min(o.A(p, i), limite[i]); }), B = P.map(function (p, i) { return o.B(p, i); });
  var auBord = P.map(function (p, i) { return [p[0] + A[i] * dedans[i][0], p[1] + A[i] * dedans[i][1]]; });

  // Les anneaux : le rang 0 est le bord de la face -Y, le rang 2 nA + 1 celui de la face +Y.
  var pos = [], nor = [], uv = [], indice = function (k, i) { return k * N + i; };
  for (k = 0; k < rangs; k++) {
    var cote = k <= nA ? -1 : 1, phi = (k <= nA ? nA - k : k - nA - 1) / nA * QUART;
    for (i = 0; i < N; i++) {
      var off = A[i] * (1 - Math.cos(phi)), y = cote * ((Hc - B[i]) + B[i] * Math.sin(phi));
      var nx = sortante[i][0] * Math.cos(phi), ny = cote * Math.sin(phi), nz = sortante[i][1] * Math.cos(phi);
      var creux = o.creuser ? o.creuser(P[i], phi, auBord[i]) : 0;
      pos.push(P[i][0] + off * dedans[i][0] - creux * nx, y - creux * ny, P[i][1] + off * dedans[i][1] - creux * nz);
      nor.push(nx, ny, nz);
      uv.push(abs[i] / F.CARREAU, (y + cote * off) / F.CARREAU);
    }
  }
  // Le sens des triangles se règle une fois, sur la paroi.
  var a0 = indice(nA, 0), b0 = indice(nA, 1), c0 = indice(nA + 1, 1);
  var ux = pos[b0 * 3] - pos[a0 * 3], uy = pos[b0 * 3 + 1] - pos[a0 * 3 + 1], uz = pos[b0 * 3 + 2] - pos[a0 * 3 + 2];
  var vx = pos[c0 * 3] - pos[a0 * 3], vy = pos[c0 * 3 + 1] - pos[a0 * 3 + 1], vz = pos[c0 * 3 + 2] - pos[a0 * 3 + 2];
  var endroit = ((uy * vz - uz * vy) * nor[a0 * 3] + (uz * vx - ux * vz) * nor[a0 * 3 + 1] + (ux * vy - uy * vx) * nor[a0 * 3 + 2]) > 0;
  var tas = {};
  for (k = 0; k + 1 < rangs; k++) for (i = 0; i < N; i++) {
    j = (i + 1) % N;
    var a = indice(k, i), b = indice(k, j), c = indice(k + 1, j), d = indice(k + 1, i), m = o.matiere(i);
    (tas[m] = tas[m] || []);
    if (endroit) tas[m].push(a, b, c, a, c, d); else tas[m].push(a, c, b, a, d, c);
  }
  var tous = []; Object.keys(tas).forEach(function (m) { tous = tous.concat(tas[m]); });
  var g = geometrie(T, pos, nor, uv, tous);
  g.computeVertexNormals();
  // Les bords des faces gardent la normale de la face : sans quoi une couture se verrait entre l'arrondi
  // et le plat (ou le relief que porte la face).
  var nrm = g.getAttribute("normal");
  for (i = 0; i < N; i++) {
    var nf = o.normaleFace ? o.normaleFace(auBord[i]) : [0, 1, 0];
    nrm.setXYZ(indice(0, i), nf[0], -nf[1], nf[2]); nrm.setXYZ(indice(rangs - 1, i), nf[0], nf[1], nf[2]);
  }
  Object.keys(tas).forEach(function (m) { var gm = g.clone(); gm.setIndex(tas[m]); lot.ajouter(m, gm); });
  var bord = []; for (i = 0; i < N; i++) bord.push([pos[indice(rangs - 1, i) * 3], pos[indice(rangs - 1, i) * 3 + 2]]);
  return { bord: bord, geometrie: g, indice: indice, rangs: rangs, N: N };
}
// Un joint qui passe l'arête et fait le tour : il suit la colonne d'anneaux du point `ic`, de face à face.
function traitEnTravers(F, lot, P, c, ic, largeur) {
  var T = F.THREE, nrmA = c.geometrie.getAttribute("normal"), posA = c.geometrie.getAttribute("position"), N = c.N;
  var pts = [], nn = [], cc = [], av = P[(ic - 1 + N) % N], ap = P[(ic + 1) % N], lt = Math.hypot(ap[0] - av[0], ap[1] - av[1]);
  for (var k = 0; k < c.rangs; k++) {
    var v = c.indice(k, ic);
    pts.push([posA.getX(v), posA.getY(v), posA.getZ(v)]); nn.push([nrmA.getX(v), nrmA.getY(v), nrmA.getZ(v)]);
    cc.push([(ap[0] - av[0]) / lt, 0, (ap[1] - av[1]) / lt]);
  }
  lot.ajouter("creux", trait(T, pts, nn, cc, largeur, 0.04));
}

// LE BOÎTIER : vert, sa coiffe grise en haut à droite. Son profil est la silhouette de la photo.
// - Le dessus, la rangée 247 : la silhouette y passe à 243 (le bord arrière, que la photo voit d'un peu
//   au-dessus : on en voit le dessus en clair jusqu'à la rangée 250), le bord avant à 250 ; 247 est
//   entre les deux, au niveau de l'axe.
// - Le coin du haut à gauche, 4,2 mm de rayon (la silhouette passe par x = 320, y = 253 et x = 310,
//   y = 270), et le coin du haut à droite, 7,7 mm (x = 790, y = 256 ; x = 810, y = 277).
// - Le flanc droit, droit, à la colonne 816, des rangées 300 à 590 ; plus bas il passe derrière le cadran.
// - Le coin du bas à droite, caché derrière le cadran : un grand arrondi de 29 mm, que la silhouette
//   tient sous le cadran (x = 720, y = 838 ; x = 740, y = 825 ; elle ne dépasse plus le cadran dès
//   x = 760).
// - Le dessous, qui remonte un peu vers la droite : rangée 858,5 à x = 470, 848 à x = 640.
// - Le flanc gauche, une courbe bombée, relevée rangée par rangée. Sous la bande de caoutchouc, qui le
//   déborde, il est tenu 1 mm en dedans de la silhouette (la bande dépasse le vert d'autant à ses deux
//   bouts : x = 297 contre 301 à la rangée 318, 306 contre 309 à la rangée 788).
// LA COIFFE GRISE : sur le dessus dès la colonne 428 (le joint sombre de 426 à 428, rangées 260 à 440),
// tout le coin du haut à droite, et le flanc droit jusqu'à la rangée 517, où son bord passe dans
// l'arrondi de l'arête.
function profilBoitier(F) {
  var gauche = courbe(F, [pt(380, 859), pt(358, 856.5), pt(344, 850.5), pt(333, 842), pt(324, 832), pt(317, 819), pt(313, 806), pt(310, 790),
    pt(308, 772), pt(302, 756), pt(298, 740), pt(291, 708), pt(287, 676), pt(280, 644), pt(277, 612), pt(276, 580), pt(274, 548),
    pt(275, 516), pt(277, 484), pt(280, 452), pt(283, 420), pt(288, 388), pt(294, 356), pt(301, 324), pt(303, 304), pt(306, 285)]);
  var reste = [pt(316, 247, { a: 4.2 }), pt(428, 247), pt(816, 247, { a: 7.7 }), pt(816, 517), pt(816, 836, { a: 29 }), pt(470, 858.5)];
  return contourFerme(F, reste.concat(gauche), function () { return 3; });
}
// LE BORD DE LA COIFFE SUR LA FACE, relevé par sa couleur (le premier gris, colonne par colonne et
// rangée par rangée) : son bord gauche à la colonne 428, son coin du bas à gauche arrondi de 8,7 mm
// (x = 436 à la rangée 450, 454 à la 470), son bord du bas à la rangée 477, puis la courbe qui fait le
// tour du cadran, à 182 pixels de son centre en haut, 199 au flanc droit (x = 744, y = 488 ; x = 772,
// y = 499 ; x = 800, y = 515). Du point de la coiffe sur le flanc droit à celui du dessus.
function bordDeLaCoiffe(bord, iG1, iG2) {
  return [bord[iG2], pt(792, 510.5), pt(780, 504.5), pt(768, 498), pt(756, 492.5), pt(744, 488.5), pt(728, 484.5), pt(710, 481), pt(690, 478.5),
    pt(660, 477), pt(475, 477), pt(428, 477, { a: 8.7 }), bord[iG1]];
}
// L'ÉCRAN, enfoncé dans la coiffe. Son bord de dessus, sur la face, relevé sur le gris : de la colonne
// 454 à 764, des rangées 299 à 458. Sous ce bord, un biseau de 1,4 mm de large (la photo en voit le bas
// en clair, rangées 450 à 458, le haut dans l'ombre, rangées 299 à 306) qui descend de 1,2 mm (ESTIMÉ)
// jusqu'à la vitre. Ses coins sont arrondis de 14 pixels.
var ECRAN = { x0: cx(454), x1: cx(764), z0: cz(299), z1: cz(458), r: 14 / PX, biseau: 1.4, fond: 1.2 };
// Un rectangle aux coins arrondis : `n` pas par coin, ses côtés découpés en `cotes` ([le long de X, le
// long de Z]) : le dessus et le dessous du biseau ont ainsi les mêmes points, un à un.
function rectangleRond(x0, z0, x1, z1, r, n, cotes) {
  var pts = [], coins = [[x1 - r, z0 + r, -QUART], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, QUART], [x0 + r, z0 + r, Math.PI]];
  coins.forEach(function (c, ic) {
    for (var k = 0; k <= n; k++) { var a = c[2] + QUART * k / n; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    var s = coins[(ic + 1) % 4], p = pts[pts.length - 1], q = [s[0] + r * Math.cos(s[2]), s[1] + r * Math.sin(s[2])], m = cotes[ic % 2 === 0 ? 1 : 0];
    for (var j = 1; j < m; j++) pts.push([p[0] + (q[0] - p[0]) * j / m, p[1] + (q[1] - p[1]) * j / m]);
  });
  return pts;
}
var COTES_ECRAN = [19, 9];
function boitier(F, lot) {
  var T = F.THREE, P = profilBoitier(F), N = P.length;
  var iG1 = plusProche(P, cx(428), cz(247)), iG2 = plusProche(P, cx(816), cz(517));
  // L'arrondi des arêtes : 3 mm dans le plan (de face, le bord clair du gris fait 15 pixels au flanc
  // droit, colonnes 801 à 816), 6 mm dans l'épaisseur : ESTIMÉ, la tranche d'une pièce moulée tenue en main.
  var c = coque(F, lot, P, { H: H, A: function () { return 3; }, B: function () { return 6; },
    matiere: function (i) { return i >= iG1 && i < iG2 ? "grisBuddy" : "vertBuddy"; } });
  var bord = c.bord, i;
  bordDeFace = bord;
  var interieur = densifier(F.adoucir(bordDeLaCoiffe(bord, iG1, iG2)), 3, false).slice(1, -1);
  var gris = [], vert = [];
  for (i = iG1; i <= iG2; i++) gris.push(bord[i]);
  gris = gris.concat(interieur);
  for (i = iG2; i !== iG1; i = (i + 1) % N) vert.push(bord[i]);
  vert.push(bord[iG1]); vert = vert.concat(interieur.slice().reverse());
  var trouEcran = rectangleRond(ECRAN.x0, ECRAN.z0, ECRAN.x1, ECRAN.z1, ECRAN.r, 6, COTES_ECRAN);
  // DERRIÈRE, que la photo ne montre pas : la coiffe y descend aussi bas que devant (rangée 477), mais
  // droite, sans le tour du cadran, qui n'y est pas ; elle rejoint en biais son bord sur le flanc droit.
  var interieurDos = F.adoucir([bord[iG2], [bord[iG2][0] - 4, cz(477), { a: 5 }], pt(428, 477, { a: 8.7 }), bord[iG1]]).slice(1, -1);
  var grisDos = [], vertDos = [];
  for (i = iG1; i <= iG2; i++) grisDos.push(bord[i]);
  grisDos = grisDos.concat(interieurDos);
  for (i = iG2; i !== iG1; i = (i + 1) % N) vertDos.push(bord[i]);
  vertDos.push(bord[iG1]); vertDos = vertDos.concat(interieurDos.slice().reverse());
  // Devant, bombés : la coiffe percée de l'écran, et le vert.
  lot.ajouter("grisBuddy", faceBombee(F, gris, [trouEcran]));
  lot.ajouter("vertBuddy", faceBombee(F, vert, []));
  lot.ajouter("grisBuddy", plat(F, grisDos, [], -H, -1));
  lot.ajouter("vertBuddy", plat(F, vertDos, [], -H, -1));
  // Le joint entre la coiffe et le vert, un trait sombre de 0,5 mm (2 à 3 pixels sur la photo), devant,
  // derrière, et en travers de la tranche à ses deux bouts.
  lot.ajouter("creux", traitSurLaFace(T, [bord[iG2]].concat(interieur, [bord[iG1]]), 0.5, hauteur, 1));
  lot.ajouter("creux", traitSurLaFace(T, [bord[iG2]].concat(interieurDos, [bord[iG1]]), 0.5, -H, -1));
  traitEnTravers(F, lot, P, c, iG1, 0.5); traitEnTravers(F, lot, P, c, iG2, 0.5);
  ecran(F, lot, trouEcran);
}
function ecran(F, lot, dessus) {
  var T = F.THREE, E = ECRAN, b = E.biseau;
  var dessous = rectangleRond(E.x0 + b, E.z0 + b, E.x1 - b, E.z1 - b, Math.max(0.3, E.r - b), 6, COTES_ECRAN), n = dessus.length;
  // La vitre est plane : le bord du dessus suit le bombé de la face, le fond, lui, est à la hauteur
  // moyenne de ce bord moins E.fond. Bombée avec la face, la vitre et son vernis marquaient chaque
  // triangle d'un reflet différent (essayé).
  var pos = [], idx = [], k, vitre = 0;
  dessus.forEach(function (p) { vitre += hauteur(p[0], p[1]) / n; });
  vitre -= E.fond;
  for (k = 0; k < n; k++) { pos.push(dessus[k][0], hauteur(dessus[k][0], dessus[k][1]), dessus[k][1]); pos.push(dessous[k][0], vitre, dessous[k][1]); }
  for (k = 0; k < n; k++) {
    var a = 2 * k, bb = a + 1, c = (2 * k + 2) % (2 * n), d = c + 1;
    // à l'endroit : le biseau regarde vers +Y
    var ux = pos[bb * 3] - pos[a * 3], uz = pos[bb * 3 + 2] - pos[a * 3 + 2];
    var vx = pos[c * 3] - pos[a * 3], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    if (uz * vx - ux * vz > 0) idx.push(a, bb, c, c, bb, d); else idx.push(a, c, bb, c, d, bb);
  }
  var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g = F.toCreasedNormals(g, 0.7); F.uvCube(g);
  lot.ajouter("grisBuddy", g);
  // La vitre, sans un chiffre.
  lot.ajouter("ecran", plat(F, dessous, [], vitre, 1));
}

// LA BANDE DE CAOUTCHOUC DU FLANC GAUCHE, noire : une coque à elle, plus épaisse que le boîtier de
// 2 mm de chaque côté (ESTIMÉ ; on voit son ombre sur le vert le long de son bord ; la face bombée
// monte déjà de 0,7 mm sous son bord intérieur), qui le chevauche.
// - Son bord extérieur est la silhouette, relevée tous les 32 pixels, des rangées 318 à 786 ;
// - son bord intérieur, sur la face, est le premier vert moins le trait d'ombre (2 pixels) : il se creuse
//   en arc, de x = 366 en haut à x = 339 au milieu (rangée 556) et à x = 366 en bas ;
// - ses deux bouts : la rangée 316 en haut, 786 en bas, leurs coins arrondis (1,6 mm dehors, 2,6 mm du
//   côté de la face, 10 à 14 pixels).
// - Trois nervures en travers, en RELIEF : elles font le tour du flanc et montent sur la face, où elles
//   finissent en demi-rond. Relevées colonne par colonne (x = 296 à 312) sur la photo éclaircie : le
//   haut de chacune prend la lumière, son dessous est sombre (un creux montrerait l'inverse, son bord du
//   haut dans l'ombre), et la silhouette y sort de 2 à 5 pixels (rangées 474 à 490, 578 à 590). Elles
//   sont centrées sur les rangées 476, 578 et 679 (une tous les 102 pixels), hautes de 30 à 34 pixels
//   lumière et ombre comprises (6,2 mm), et leur bout rond finit aux colonnes 309, 309 et 313, à 7 mm
//   du bord de la silhouette. Leur saillie, 0,8 mm, est lue sur la silhouette ; leur flanc, arrondi
//   sur 1,3 mm, est ESTIMÉ (à 1 mm, essayé, elles sortaient du bord comme des ergots ; la photo montre
//   des renflements doux).
//   (La version d'avant les creusait : de face, trois fentes noires là où la photo montre trois bosses.)
var NERVURES = [{ z: cz(476), fin: cx(309) }, { z: cz(578), fin: cx(309) }, { z: cz(679), fin: cx(313) }];
var NERVURE = { demi: 3.1, saillie: 0.8, flanc: 1.3 };
// La saillie d'une nervure en (x, z) dans le plan de la face : un stade (sa ligne de milieu, puis son
// bout rond), au flanc adouci. Le flanc de la coque prend la saillie du point où sa colonne d'anneaux
// rejoint la face : la nervure fait le tour sans marche ni fente.
function reliefNervures(x, z) {
  var h = 0;
  NERVURES.forEach(function (n) {
    var bout = n.fin - NERVURE.demi, s = Math.hypot(Math.max(0, x - bout), z - n.z);
    h = Math.max(h, doux((NERVURE.demi - s) / NERVURE.flanc));
  });
  return NERVURE.saillie * h;
}
function presDUneNervure(x, z, marge) {
  return NERVURES.some(function (n) { return x < n.fin + marge && Math.abs(z - n.z) < NERVURE.demi + marge; });
}
function bande(F, lot) {
  var dehors = courbe(F, [pt(294, 340), pt(286, 372), pt(281, 404), pt(277, 436), pt(274, 468), pt(270, 500), pt(269, 532), pt(270, 564),
    pt(271, 596), pt(273, 628), pt(277, 660), pt(282, 692), pt(288, 724), pt(296, 756), pt(302, 774)]);
  var dedans = courbe(F, [pt(364, 766), pt(360, 748), pt(354, 716), pt(349, 684), pt(344, 652), pt(342, 620), pt(340, 588), pt(339, 556),
    pt(340, 524), pt(342, 492), pt(345, 460), pt(349, 428), pt(355, 396), pt(361, 364), pt(365, 344)]);
  var tout = [pt(300.5, 316, { a: 1.6 })].concat(dehors, [pt(306.5, 787, { a: 1.6 }), pt(366, 785, { a: 2.6 })], dedans, [pt(367, 320, { a: 2.6 })]);
  // Des segments de 0,35 mm au droit des nervures (leurs flancs arrondis en demandent quatre), de
  // 2,5 mm ailleurs.
  var P = contourFerme(F, tout, function (p) { return p[0] < cx(312) && presDUneNervure(p[0], p[1], 0.6) ? 0.35 : 2.5; });
  // L'arrondi : 4 mm dans le plan du côté du flanc (la part claire de la bande, de face, colonnes 270 à
  // 288), 2 mm du côté de la face ; 4,5 mm dans l'épaisseur : ESTIMÉ.
  var c = coque(F, lot, P, { H: H + 2, A: function (p) { return 2 + 2 * (1 - doux((p[0] - cx(300)) / (cx(330) - cx(300)))); },
    B: function () { return 4.5; }, matiere: function () { return "noir"; },
    creuser: function (p, phi, b) { return -reliefNervures(b[0], b[1]); },
    normaleFace: function (b) { return normaleDe(reliefNervures, b[0], b[1]); } });
  // Les deux faces, plates, et le dessus de chaque nervure posé sur elles. Derrière, ESTIMÉ : la bande
  // est la même (un caoutchouc moulé d'une pièce).
  [1, -1].forEach(function (s) {
    lot.ajouter("noir", plat(F, c.bord, [], s * (H + 2), s));
    NERVURES.forEach(function (n) { lot.ajouter("noir", dessusDeNervure(F, n, c.bord, P, s)); });
  });
}
// LE DESSUS D'UNE NERVURE SUR LA FACE : une grille posée sur le plat de la bande, dont le premier rang
// est le bord de la face (les points mêmes où la coque, bombée de la même saillie, la rejoint) et qui
// court jusqu'au bout rond. Là où la nervure retombe à rien, la grille se confond avec le plat (même
// hauteur, même grain) : elle le recouvre sans se battre avec lui. Ses rangs suivent les points du bord,
// tous les 0,35 mm ; dans la longueur, un pas jusqu'au départ du bout rond, puis douze sur le bout.
// (Raffiner la triangulation de toute la face jusqu'à 0,4 mm, essayé d'abord, en faisait 110 000
// triangles : les longs triangles effilés d'une bande étroite se recoupent sans fin.)
function dessusDeNervure(F, n, bord, P, signe) {
  var rangs = [], i, j, r, J = 13, bout = n.fin - NERVURE.demi, pos = [], nor = [], uv = [], idx = [];
  for (i = 0; i < bord.length; i++) if (P[i][0] < cx(312) && Math.abs(bord[i][1] - n.z) <= NERVURE.demi + 0.4) rangs.push(i);
  rangs.forEach(function (i) {
    var b = bord[i], x1 = Math.max(b[0], bout);
    for (var j = 0; j <= J; j++) {
      var x = j === 0 ? b[0] : x1 + (n.fin + 0.3 - x1) * (j - 1) / (J - 1), z = b[1], m = normaleDe(reliefNervures, x, z);
      pos.push(x, signe * (H + 2 + reliefNervures(x, z)), z); nor.push(m[0], signe * m[1], m[2]); uv.push(x / F.CARREAU, z / F.CARREAU);
    }
  });
  for (r = 0; r + 1 < rangs.length; r++) for (j = 0; j < J; j++) {
    var a = r * (J + 1) + j, quads = [[a, a + 1, a + J + 2], [a, a + J + 2, a + J + 1]];
    quads.forEach(function (t) {
      var ax = pos[t[0] * 3], az = pos[t[0] * 3 + 2], cr = (pos[t[1] * 3] - ax) * (pos[t[2] * 3 + 2] - az) - (pos[t[1] * 3 + 2] - az) * (pos[t[2] * 3] - ax);
      if ((cr < 0) === (signe > 0)) idx.push(t[0], t[1], t[2]); else idx.push(t[0], t[2], t[1]);
    });
  }
  return geometrie(F.THREE, pos, nor, uv, idx);
}

// LES TROIS BOUTONS, gris clair, l'un sous l'autre, relevés sur leur gris : 64 pixels de large et 65 à
// 66 de haut (12,7 mm), centrés en x = 435, y = 550,5 (le plus) ; x = 440, y = 654 (le moins) ;
// x = 456,5, y = 756 (l'horloge). Chacun sort de 2,4 mm de la face bombée (ESTIMÉ). Son dessus est
// bombé : sur la photo, un liseré très clair court juste sous son bord du haut (238 sur la colonne 434,
// rangée 520) et le gris fonce vers le milieu (203), ce que fait un bord largement arrondi (1,4 mm) sur
// une calotte qui monte de 0,4 mm (ESTIMÉ ; la version d'avant, plate, avait l'air d'une pièce de
// monnaie). Un jour sombre de 0,55 mm l'entoure (3 pixels d'ombre sur la photo).
// Leurs signes sont en relief, foncés, mesurés au seuil du noir sur la photo : le plus de 7,1 mm
// (rangée 550, colonnes 419 à 456), ses traits de 1,05 mm (5,5 pixels, rangées 549,5 à 555 et colonnes
// 434,5 à 440) ; le moins de 7,1 mm, son trait de 1,15 mm (rangées 652,5 à 658,5).
// L'horloge est une montre, sans chiffre : un cercle de 7 mm (36 pixels, colonnes 442 à 478), son
// trait de 0,75 mm ; deux pattes de bracelet, dessus et dessous, de 3,9 mm de large, qui sortent du
// cercle jusqu'à 4,25 mm du centre (rangées 736 et 780 pour un centre à 758) ; deux aiguilles, une vers
// le haut (2 mm, 0,7 mm d'épaisseur), une vers la droite (1,8 mm, 0,6 mm).
var BOUTONS = [{ x: cx(435), z: cz(550.5), signe: "plus" }, { x: cx(440), z: cz(654), signe: "moins" }, { x: cx(456.5), z: cz(756), signe: "horloge" }];
var CALOTTE = { r: 6.35, haut: 2.42, montee: 0.4 };
// La hauteur du dessus d'un bouton à d mm de son centre : une calotte, de 2,42 mm au milieu à 2,02 mm
// au départ de l'arrondi du bord (d = 5,3).
function calotte(d) { return CALOTTE.haut - CALOTTE.montee * (d * d) / (5.3 * 5.3); }
function boutons(F, lot) {
  var r = CALOTTE.r, dessus = [[r, 1.2, { a: 1.4, fin: 0.3 }]];
  [5.3, 3.9, 2.1, 0].forEach(function (d) { dessus.push([d, calotte(d)]); });
  BOUTONS.forEach(function (b) {
    var pied = hauteur(b.x, b.z);
    lot.ajouter("grisBuddy", dresser(F.tourne([[0, -1], [r, -1]].concat(dessus), { segments: 48 }), b.x, pied, b.z));
    lot.ajouter("creux", poserSurLaFace(dresser(F.tourne([[r + 0.55, 0], [r - 0.05, 0]], { segments: 48 }), b.x, 0, b.z), 0.04));
    // Un signe est une plaque de 0,5 mm posée à plat sur la calotte : son dessous (2,08 mm) reste sous
    // elle jusqu'à 4,9 mm du centre, plus loin que les coins des pattes de la montre (4,7 mm) ; son
    // dessus en sort de 0,16 mm au milieu et de 0,34 mm au bout des traits.
    var y = pied + 2.33;
    function plaque(lx, lz, dx, dz) { lot.ajouter("noirLisse", F.boite(lx, 0.5, lz, 0.2), { x: b.x + dx, y: y, z: b.z + dz }); }
    if (b.signe === "plus") { plaque(7.1, 1.05, 0, 0); plaque(1.05, 7.1, 0, 0); }
    else if (b.signe === "moins") plaque(7.1, 1.15, 0, 0);
    else {
      lot.ajouter("noirLisse", dresser(F.cylindre(3.5, -0.25, 0.25, { alesage: 2.75, c: 0.1, segments: 48 }), b.x, y, b.z));
      plaque(3.9, 1.5, 0, -3.5); plaque(3.9, 1.5, 0, 3.5);
      plaque(0.7, 2.3, 0, -0.85); plaque(2.1, 0.6, 0.75, 0);
    }
  });
}

// LE CADRAN, noir, cranté. Son bord droit, contre le fond blanc, est à x = 836 (rangée 666), son bord
// gauche, là où le noir neutre succède à l'ombre verte, à x = 497 (rangée 664) : 33 mm de rayon aux
// sommets des lobes, centré en x = 666,5. Sa hauteur est celle de la version d'avant (y = 663) : de
// haut en bas la photo le montre plus grand (de la rangée 485 à la 847), ce qu'aucun bouton rond ne fait,
// et la cote retenue tient le milieu.
// SES LOBES, relevés en coordonnées polaires sur son bord contre le blanc (de -25 à 75 degrés) et contre
// le gris (de -170 à -100) : des sommets larges et plats (8 à 10 degrés), séparés par des creux plus
// étroits et arrondis, un tous les 22,5 degrés (sommets à -20, 4, 27, 50 et 71 degrés, creux à -7, 15,
// 37 et 58) ; 16 sur le tour, creusés de 7 à 9 pixels (1,4 mm). La version d'avant en comptait 32, deux
// fois plus serrés et deux fois moins creux : un bord de pièce de monnaie, pas ce bouton.
// Il sort de 11 mm (ESTIMÉ) de la face bombée, son dessus plat, son bord arrondi de 0,8 mm (le creux le
// plus serré a 1,5 mm de rayon : l'arrondi ne le replie pas).
// SA FACE, sans un mot : six secteurs de 60 degrés, séparés par des filets blancs de 0,6 mm (3 pixels)
// qui partent du centre et s'arrêtent à 29 mm (entre 142 et 158 pixels) ; celui de gauche est plein,
// blanc, jusqu'à 26,9 mm (139,5 pixels). Sur la photo les filets sont vers -88, -32, 34 et 92 degrés,
// le secteur blanc de 148 à 211 (comptés dans le sens de la photo, depuis la droite, vers le bas) : six
// fois 60 degrés, tournés d'un degré.
var CADRAN = { x: cx(666.5), z: cz(663), r: 33.0, creux: 1.4, lobes: 16, sommet: 4, saillie: 11 };
// Le rayon du cadran à l'angle a (en radians, compté comme sur la photo) : plein sur les 35 % du lobe
// autour de son sommet, puis il descend en douceur jusqu'au fond du creux.
function rayonCadran(a) {
  var C = CADRAN, u = (a - C.sommet * Math.PI / 180) / (TOUR / C.lobes);
  u -= Math.round(u);
  return C.r - C.creux * doux((Math.abs(u) * 2 - 0.35) / 0.55);
}
function cadran(F, lot) {
  var C = CADRAN, haut = hauteur(C.x, C.z) + C.saillie, contour = [], n = C.lobes * 20, k;
  for (k = 0; k < n; k++) {
    var a = TOUR * k / n, r = rayonCadran(a);
    contour.push([C.x + r * Math.cos(a), C.z + r * Math.sin(a)]);
  }
  // Son pied entre de 1 mm dans la face au plus bas : au bord du boîtier, où elle ne bombe plus.
  lot.ajouter("noir", surLaFace(F, contour, H - 1.8, haut, 0.8));
  function rayon(deg, r0, r1, e) {
    var a = deg * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), nx = -uz * e / 2, nz = ux * e / 2;
    return [[C.x + ux * r0 + nx, C.z + uz * r0 + nz], [C.x + ux * r1 + nx, C.z + uz * r1 + nz], [C.x + ux * r1 - nx, C.z + uz * r1 - nz], [C.x + ux * r0 - nx, C.z + uz * r0 - nz]];
  }
  [-89, -29, 31, 91].forEach(function (d) { lot.ajouter("blanc", surLaFace(F, rayon(d, 0, 29, 0.6), haut - 0.05, haut + 0.08, 0.03)); });
  var secteur = [[C.x, C.z]];
  for (k = 0; k <= 20; k++) { var a = (151 + 60 * k / 20) * Math.PI / 180; secteur.push([C.x + 26.9 * Math.cos(a), C.z + 26.9 * Math.sin(a)]); }
  lot.ajouter("blanc", surLaFace(F, secteur, haut - 0.05, haut + 0.08, 0.03));
}

// L'ÉCROU D'ENTRÉE, noir, femelle 3/4", qui tourne sur l'entrée du boîtier. Sa silhouette relevée
// rangée par rangée, et ses stries sur la photo agrandie trois fois :
// - 180,5 pixels de large (17,42 mm de rayon) des rangées 88 à 190, le bord du haut arrondi de 1,4 mm
//   (167 pixels à la rangée 72) ;
// - au bas, un tronc de cône (176 pixels à la rangée 200, 169 à la 216), puis le dessous, rangée 222,
//   au bord arrondi ;
// - des stries fines, groupées par six (une tous les 12 pixels, 7,5 degrés), entre des plats lisses de
//   27 degrés (de x = 423 à x = 460 pour celui de devant, un peu à droite) : cinq groupes sur le tour.
//   Elles naissent sous l'arrondi du haut et finissent en pointe sur le cône du bas (rangées 197 à 207).
//   Elles y font des V sombres presque jointifs, entre des crêtes étroites qui prennent la lumière : leur
//   profondeur, 0,8 mm, est ESTIMÉE sur cette ombre (0,55 mm, essayé : des traits gris, pas des stries).
// - Sous l'écrou, le jour sombre (rangées 222 à 230), puis la bague noire lisse de l'entrée, 156 pixels
//   (15,06 mm de rayon), des rangées 229 à 247, son bord du haut arrondi.
var ECROU = { R: 17.42, bas: cz(222), cone: 24.0, pente: 0.252, strie: 0.8 };
function rayonEcrou(z) {
  var E = ECROU, d = z - E.cone;
  if (d <= 0) return E.R;
  return E.R - E.pente * (d < 1 ? d * d / 2 : d - 0.5);
}
// La profondeur d'une strie en (theta, z), en part de ECROU.strie : un V arrondi d'un demi-large de
// 3 degrés (sur 7,5 : la crête garde 1,5 degré), qui naît de z = 1,2 à 2,8 et finit en pointe de z = 24,2 à 26,4 (il s'y rétrécit de
// moitié en même temps qu'il s'efface).
function strieEcrou(th, z) {
  var deg = th * 180 / Math.PI, u = ((deg - 87.75) % 72 + 72) % 72;
  if (u > 45) return 0;
  var fin = doux((z - 24.2) / 2.2), w = 3 * (1 - 0.5 * fin), centre = 3.75 + 7.5 * Math.min(5, Math.floor(u / 7.5)), e = (u - centre) / w;
  if (Math.abs(e) >= 1) return 0;
  return (1 - e * e) * doux((z - 1.2) / 1.6) * (1 - fin);
}
function ecrou(F, lot) {
  var T = F.THREE, E = ECROU, fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, grand = F.GAZ["3/4"].d / 2 + 0.15;
  // Le haut : la bouche taraudée, la face (deux cercles posés sur le plan z = 0, que la scène mesure),
  // l'arrondi, et 0,5 mm de flanc, recouvert par le flanc strié (qui part de z = 0,8) : deux surfaces de
  // tours différents qui se rejoindraient bord à bord laisseraient une fente.
  lot.ajouter("noir", F.tourne([[fond, 1.2], [grand + 0.55, 0], [E.R, 0, { a: 1.4, fin: 0.3 }], [E.R, 1.3]], { segments: 96 }));
  // Le flanc strié : une surface r(theta, z), 240 pas sur le tour (1,5 degré : trois par strie).
  var nt = 240, zs = [0.8, 1.2, 1.6, 2.1, 2.7, 3.4, 8, 13, 18, 22, 23.6, 24.2, 24.8, 25.4, 26.0, 26.6, 27.3];
  function r(th, z) { return rayonEcrou(z) - E.strie * strieEcrou(th, z); }
  var pos = [], nor = [], uv = [], idx = [], j, k;
  for (k = 0; k < zs.length; k++) for (j = 0; j <= nt; j++) {
    var th = TOUR * j / nt, z = zs[k], rr = r(th, z), c = Math.cos(th), s = Math.sin(th);
    var fz = (r(th, z + 0.05) - r(th, z - 0.05)) / 0.1, ft = (r(th + 0.004, z) - r(th - 0.004, z)) / 0.008 / rr;
    var nx = c + ft * s, ny = s - ft * c, nz = -fz, ln = Math.hypot(nx, ny, nz);
    pos.push(rr * c, rr * s, z); nor.push(nx / ln, ny / ln, nz / ln); uv.push(th * E.R / F.CARREAU, z / F.CARREAU);
  }
  for (k = 0; k + 1 < zs.length; k++) for (j = 0; j < nt; j++) {
    var A = k * (nt + 1) + j, B = A + nt + 1; idx.push(A, A + 1, B, B, A + 1, B + 1);
  }
  lot.ajouter("noir", geometrie(T, pos, nor, uv, idx));
  // Le bas : le cône (repris 0,4 mm sous le flanc strié), l'arrondi, le dessous, et le col dans le jour.
  lot.ajouter("noir", F.tourne([[rayonEcrou(26.9), 26.9], [rayonEcrou(E.bas), E.bas, { a: 1.1, fin: 0.3 }], [13.6, E.bas, { a: 0.3 }], [13.6, cz(229) + 0.3]], { segments: 96 }));
  // Le dedans : le taraudage, puis le joint plat où bute le mâle du robinet, et le fond sombre.
  lot.ajouter("noir", F.taraudage({ gaz: "3/4", z0: 1.2, z1: PRISE_HAUT, segments: 32 }));
  lot.ajouter("noir", F.tourne([[grand, 17.6], [grand, PRISE_HAUT + 0.6], [fond, PRISE_HAUT]], { segments: 32 }));
  lot.ajouter("joint", F.tourne([[7.2, 19.2], [7.2, 17.6, { c: 0.3 }], [grand, 17.6]], { segments: 32 }));
  lot.ajouter("creux", F.tourne([[0, 19.0], [7.4, 19.0]], { segments: 24 }));
  // La bague de l'entrée, lisse, jusque dans le boîtier.
  lot.ajouter("noirLisse", F.tourne([[13.6, cz(229) + 0.3], [15.06, cz(229) + 0.3, { a: 0.8, fin: 0.3 }], [15.06, cz(247) + 1.5]], { segments: 72 }));
}

// LA SORTIE, noire et mate comme l'écrou (la photo n'y montre aucun reflet), relevée rangée par rangée
// sur la silhouette : sous le boîtier, le col lisse de 119 pixels
// (11,49 mm de rayon, rangées 858 à 873), qui s'évase jusqu'au fond du filet (rangées 873 à 876) ; le
// filetage mâle 3/4" (rangées 876 à 955) ; la portée lisse du bout, 122 pixels (11,78 mm), puis son bord
// arrondi de 1,8 mm (de 119 pixels à la rangée 964 à 25 à la 976), et la face du bout : deux cercles
// posés sur le plan z = L, que la scène mesure. Le passage de l'eau (16 mm) et son fond sombre sont
// ESTIMÉS.
function sortie(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }), passage = 8;
  lot.ajouter("noir", F.tourne([[11.49, cz(858.5) - 3], [11.49, cz(873), { a: 0.4, fin: 0.3 }], [fond, FILET]], { segments: 64 }));
  lot.ajouter("noir", F.filetage({ gaz: "3/4", z0: FILET, z1: FIN_FILET, pointe: "z1", entree: 0.5, sortie: 0.6 }));
  lot.ajouter("noir", F.tourne([[fond, FIN_FILET], [11.78, FIN_FILET + 0.3, { a: 0.15 }], [11.78, L, { a: 1.8, fin: 0.3 }], [passage, L, { c: 0.4 }], [passage, L - 14]], { segments: 64 }));
  lot.ajouter("creux", F.tourne([[passage, L - 14], [0, L - 14]], { segments: 24 }));
}

export default {
  "programmateur-AEV11401": function (F) {
    var lot = new F.Lot();
    ecrou(F, lot); boitier(F, lot); bande(F, lot); boutons(F, lot); cadran(F, lot); sortie(F, lot);
    return {
      couches: lot.couches(),
      haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE_HAUT },
      bas: { z: L, x: 0, genre: "male", gaz: "3/4", prise: L - FILET }
    };
  }
};
