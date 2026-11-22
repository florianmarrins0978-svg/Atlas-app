// LES FORMES DE LA NOURRICE EN 3D (appli/arrosage-nourrice-3d.html).
//
// Tout est en millimètres. Une forme se construit sur l'axe Z local, de z0 à z1 ; la pièce la tourne
// ensuite en entier. Chaque forme rend une géométrie indexée, avec ses normales et ses coordonnées de
// texture, pour que toutes se fusionnent par matière (Lot) et se dessinent en instances.
//
// POURQUOI DES FORMES À NOUS, et pas celles de three telles quelles : un tour de three lisse toutes les
// arêtes (un cylindre y ressemble à un galet), et un filetage en anneaux ne tourne pas. Ici une arête
// vive reste vive, un chanfrein ou un arrondi se demande au point, et le filetage est une hélice au pas
// du gaz.

import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "../vendor/three/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "../vendor/three/geometries/RoundedBoxGeometry.js";

var TAU = Math.PI * 2;

// LE FILETAGE GAZ (ISO 228, profil Whitworth). Le diamètre est celui du sommet du filet mâle ; `h` est
// la hauteur du filet (0,640 x le pas). Le 1" à 11 filets au pouce et ses 33,25 mm servent d'étalon à
// toutes les photos. Le 3/4" est à 14 filets au pouce (la norme, sa photo ne permet pas de les compter).
export var GAZ = {
  "1": { d: 33.249, pas: 25.4 / 11, h: 1.479 },
  "3/4": { d: 26.441, pas: 25.4 / 14, h: 1.162 }
};
// La taille d'un carreau de texture, en millimètres : le grain d'une matière a la même finesse partout.
export var CARREAU = 16;

function gazDe(o) { return o.gaz ? GAZ[o.gaz] : { d: o.d, pas: o.pas, h: o.h != null ? o.h : 0.64 * o.pas }; }
function lisse(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function tours(rayon) { return Math.max(1, Math.round(TAU * rayon / CARREAU)); }

// ADOUCIR UN PROFIL. Un point s'écrit [r, z] ; avec { a: rayon } son angle devient un arrondi, avec
// { c: taille } un chanfrein. Ce qui sort est la suite de points du profil adouci.
export function adoucir(profil) {
  var n = profil.length, sortie = [];
  for (var i = 0; i < n; i++) {
    var p = profil[i], o = p[2];
    if (!o || i === 0 || i === n - 1) { sortie.push([p[0], p[1]]); continue; }
    var a = profil[i - 1], b = profil[i + 1];
    var ux = a[0] - p[0], uz = a[1] - p[1], vx = b[0] - p[0], vz = b[1] - p[1];
    var lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
    if (lu < 1e-6 || lv < 1e-6) { sortie.push([p[0], p[1]]); continue; }
    ux /= lu; uz /= lu; vx /= lv; vz /= lv;
    if (o.c) {
      var c = Math.min(o.c, lu * 0.49, lv * 0.49);
      sortie.push([p[0] + ux * c, p[1] + uz * c]); sortie.push([p[0] + vx * c, p[1] + vz * c]);
      continue;
    }
    var angle = Math.acos(Math.max(-1, Math.min(1, ux * vx + uz * vz)));   // l'angle intérieur
    if (angle > Math.PI - 0.02) { sortie.push([p[0], p[1]]); continue; }
    var t = Math.min(o.a / Math.tan(angle / 2), lu * 0.49, lv * 0.49), rayon = t * Math.tan(angle / 2);
    var bx = ux + vx, bz = uz + vz, lb = Math.hypot(bx, bz); bx /= lb; bz /= lb;
    var d = rayon / Math.sin(angle / 2), cx = p[0] + bx * d, cz = p[1] + bz * d;
    var a0 = Math.atan2(p[1] + uz * t - cz, p[0] + ux * t - cx), a1 = Math.atan2(p[1] + vz * t - cz, p[0] + vx * t - cx);
    var da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    var pas = Math.max(2, Math.ceil(Math.abs(da) / (o.fin || 0.3)));
    for (var k = 0; k <= pas; k++) { var ak = a0 + da * k / pas; sortie.push([cx + Math.cos(ak) * rayon, cz + Math.sin(ak) * rayon]); }
  }
  return sortie;
}

// UNE FORME TOURNÉE autour de l'axe Z. Le profil se parcourt la matière à gauche, dans le plan où r est
// à droite et z en haut : l'extérieur d'un tube se monte (z croissant), son alésage se redescend. Une
// arête dont l'angle dépasse `pli` degrés reste vive ; les autres se lissent.
// Options : segments (64), pli (28), arc ([début, fin] en radians, pour un secteur).
export function tourne(profil, o) {
  o = o || {};
  var seg = o.segments || 64, seuil = Math.cos((o.pli || 28) * Math.PI / 180);
  var a0 = o.arc ? o.arc[0] : 0, a1 = o.arc ? o.arc[1] : TAU;
  var pts = adoucir(profil), sommets = [], liens = [], dernier = -1, avant = null, long = 0, rmax = 0;
  for (var i = 0; i < pts.length; i++) rmax = Math.max(rmax, pts[i][0]);
  for (i = 0; i + 1 < pts.length; i++) {
    var p = pts[i], q = pts[i + 1], dr = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dr, dz);
    if (l < 1e-7) continue;
    var nr = dz / l, nz = -dr / l, debut;
    if (avant && avant[0] * nr + avant[1] * nz >= seuil) {
      debut = dernier; var s = sommets[debut], mr = s.nr + nr, mz = s.nz + nz, lm = Math.hypot(mr, mz); s.nr = mr / lm; s.nz = mz / lm;
    } else { debut = sommets.length; sommets.push({ r: p[0], z: p[1], nr: nr, nz: nz, v: long }); }
    long += l;
    var fin = sommets.length; sommets.push({ r: q[0], z: q[1], nr: nr, nz: nz, v: long });
    liens.push([debut, fin]); dernier = fin; avant = [nr, nz];
  }
  var ns = sommets.length, pos = new Float32Array(ns * (seg + 1) * 3), nor = new Float32Array(ns * (seg + 1) * 3), uv = new Float32Array(ns * (seg + 1) * 2);
  var nu = o.arc ? Math.max(1, Math.round((a1 - a0) * rmax / CARREAU)) : tours(rmax);
  for (var k = 0; k < ns; k++) {
    var sm = sommets[k];
    for (var j = 0; j <= seg; j++) {
      var th = a0 + (a1 - a0) * j / seg, c = Math.cos(th), si = Math.sin(th), w = (k * (seg + 1) + j);
      pos[w * 3] = sm.r * c; pos[w * 3 + 1] = sm.r * si; pos[w * 3 + 2] = sm.z;
      nor[w * 3] = sm.nr * c; nor[w * 3 + 1] = sm.nr * si; nor[w * 3 + 2] = sm.nz;
      uv[w * 2] = nu * j / seg; uv[w * 2 + 1] = sm.v / CARREAU;
    }
  }
  var index = [];
  liens.forEach(function (ln) {
    var ra = sommets[ln[0]].r, rb = sommets[ln[1]].r;
    for (var j = 0; j < seg; j++) {
      var A = ln[0] * (seg + 1) + j, B = ln[1] * (seg + 1) + j, C = B + 1, D = A + 1;
      if (ra > 1e-6) index.push(A, D, B);
      if (rb > 1e-6) index.push(B, D, C);
    }
  });
  return geometrie(pos, nor, uv, index);
}

function geometrie(pos, nor, uv, index) {
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// Un cylindre plein, ou un tube si `alesage` est donné, aux arêtes chanfreinées (`c`, 0,6 mm d'office).
export function cylindre(r, z0, z1, o) {
  o = o || {};
  var c = o.c != null ? o.c : 0.6, a = o.alesage || 0, coin = c > 0 ? { c: c } : null;
  var p = a > 0 ? [[a, z0], [r, z0, coin], [r, z1, coin], [a, z1], [a, z0]] : [[0, z0], [r, z0, coin], [r, z1, coin], [0, z1]];
  return tourne(p, o);
}

// LA SURFACE D'UNE HÉLICE. `rayon(theta, z)` donne le rayon en chaque point ; les rangs suivent
// l'hélice (un rang garde la même place dans le profil du filet tout autour), si bien que le sommet du
// filet tombe toujours sur un rang : pas d'escalier, pas de moiré, et six rangs par filet suffisent.
function helice(o, rayon, dedans) {
  var seg = o.segments || 44, parPas = o.parPas || 6, z0 = o.z0, L = o.z1 - o.z0, pas = o.pasFilet;
  var rangs = Math.ceil(L / pas * parPas) + parPas, r0 = -parPas;
  var nb = (rangs - r0 + 1), pos = new Float32Array(nb * (seg + 1) * 3), nor = new Float32Array(nb * (seg + 1) * 3), uv = new Float32Array(nb * (seg + 1) * 2);
  var nu = tours(o.rayonMoyen), e = pas / 40;
  for (var k = r0; k <= rangs; k++) {
    for (var j = 0; j <= seg; j++) {
      var th = TAU * j / seg, z = k / parPas * pas + pas * j / seg; z = z < 0 ? 0 : z > L ? L : z;
      var r = rayon(th, z), c = Math.cos(th), s = Math.sin(th), w = ((k - r0) * (seg + 1) + j);
      // La normale d'une surface r = f(theta, z) : le rayon, moins la pente le long de l'axe et autour.
      var fz = (rayon(th, Math.min(L, z + e)) - rayon(th, Math.max(0, z - e))) / (Math.min(L, z + e) - Math.max(0, z - e));
      var ft = (rayon(th + 0.01, z) - rayon(th - 0.01, z)) / 0.02 / r;
      var nx = c + ft * s, ny = s - ft * c, nz = -fz, ln = Math.hypot(nx, ny, nz), sens = dedans ? -1 : 1;
      pos[w * 3] = r * c; pos[w * 3 + 1] = r * s; pos[w * 3 + 2] = z0 + z;
      nor[w * 3] = sens * nx / ln; nor[w * 3 + 1] = sens * ny / ln; nor[w * 3 + 2] = sens * nz / ln;
      uv[w * 2] = nu * j / seg; uv[w * 2 + 1] = z / CARREAU;
    }
  }
  var index = [];
  for (k = 0; k < nb - 1; k++) for (j = 0; j < seg; j++) {
    var A = k * (seg + 1) + j, B = A + seg + 1, C = B + 1, D = A + 1;
    if (dedans) index.push(A, B, D, B, C, D); else index.push(A, D, B, B, D, C);
  }
  return geometrie(pos, nor, uv, index);
}

// UN FILETAGE MÂLE, de z0 à z1 : une vraie hélice, au pas du gaz. Le filet naît et meurt en douceur à
// chaque bout (`entree` et `sortie`, en tours), comme sur une pièce moulée. Aux deux bouts la surface
// rejoint le fond du filet : `rayonDuFond(o)` donne ce rayon, pour raccorder le reste de la pièce.
// Options : gaz ("1" ou "3/4") ou d et pas ; z0, z1 ; entree (0,9), sortie (0,6) ; segments, parPas.
export function filetage(o) {
  var g = gazDe(o), R = g.d / 2, L = o.z1 - o.z0, entree = (o.entree != null ? o.entree : 0.9) * g.pas, sortie = (o.sortie != null ? o.sortie : 0.6) * g.pas;
  var pointeAuDebut = o.pointe !== "z1";
  function rayon(th, z) {
    var ph = (z - g.pas * th / TAU) / g.pas; ph -= Math.floor(ph);
    var t = 1 - Math.abs(2 * ph - 1), zp = pointeAuDebut ? z : L - z;
    return R - g.h + g.h * t * lisse(zp / entree) * lisse((L - zp) / sortie);
  }
  return helice({ z0: o.z0, z1: o.z1, pasFilet: g.pas, rayonMoyen: R, segments: o.segments, parPas: o.parPas }, rayon, false);
}
export function rayonDuFond(o) { var g = gazDe(o); return g.d / 2 - g.h; }

// UN TARAUDAGE : le filet femelle, vu de l'intérieur (les normales regardent l'axe). Aux deux bouts la
// surface rejoint le sommet du filet femelle, au rayon `rayonDuFond(o)` : c'est l'alésage où le mâle entre.
export function taraudage(o) {
  var g = gazDe(o), R = g.d / 2 + 0.15, L = o.z1 - o.z0, bord = 0.7 * g.pas;
  function rayon(th, z) {
    var ph = (z - g.pas * th / TAU) / g.pas; ph -= Math.floor(ph);
    var t = 1 - Math.abs(2 * ph - 1);
    return R - g.h + g.h * t * lisse(z / bord) * lisse((L - z) / bord);
  }
  return helice({ z0: o.z0, z1: o.z1, pasFilet: g.pas, rayonMoyen: R, segments: o.segments || 32, parPas: o.parPas || 4 }, rayon, true);
}

// UN SIX PANS, chanfreiné aux deux bouts comme un écrou tourné : le cône du chanfrein coupe les plats
// en arcs. `surPlats` est la cote sur plats ; `alesage` le perce.
export function hexagone(o) {
  var a = o.surPlats / 2, z0 = o.z0, z1 = o.z1, coin = a / Math.cos(Math.PI / 6), pente = Math.tan((o.angle || 30) * Math.PI / 180);
  var r0 = a * (o.depart != null ? o.depart : 0.97), hc = Math.min((coin - r0) * pente, (z1 - z0) * 0.45), parFace = 10, n = parFace * 6;
  var niveaux = [0, hc * 0.15, hc * 0.4, hc * 0.7, hc, (z1 - z0) - hc, (z1 - z0) - hc * 0.7, (z1 - z0) - hc * 0.4, (z1 - z0) - hc * 0.15, z1 - z0];
  function rayon(th, d) {
    var m = th % (Math.PI / 3); if (m < 0) m += Math.PI / 3;
    return Math.min(a / Math.cos(m - Math.PI / 6), r0 + Math.min(d, (z1 - z0) - d) / pente);
  }
  var pos = [], index = [], nn = niveaux.length;
  for (var k = 0; k < nn; k++) for (var j = 0; j <= n; j++) {
    var th = TAU * j / n, r = rayon(th, niveaux[k]); pos.push(r * Math.cos(th), r * Math.sin(th), z0 + niveaux[k]);
  }
  for (k = 0; k < nn - 1; k++) for (j = 0; j < n; j++) {
    var A = k * (n + 1) + j, B = A + n + 1; index.push(A, A + 1, B, B, A + 1, B + 1);
  }
  var flancs = new THREE.BufferGeometry(); flancs.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); flancs.setIndex(index);
  var g = toCreasedNormals(flancs, 0.5); uvCube(g);
  var al = o.alesage || 0, faces = [aIndexer(g)];
  faces.push(tourne(al > 0 ? [[al, z0], [r0, z0]] : [[0, z0], [r0, z0]], { segments: n }));
  faces.push(tourne(al > 0 ? [[r0, z1], [al, z1]] : [[r0, z1], [0, z1]], { segments: n }));
  if (al > 0) faces.push(tourne([[al, z1], [al, z0]], { segments: 32 }));
  return mergeGeometries(faces);
}

// UN COUDE : un tube cintré d'un quart de tour (ou de `angle`), qui part de l'axe X et arrive sur
// l'axe Z. Le coin du coude est à l'origine ; le tube quitte l'axe X en (cintrage, 0, 0) et rejoint
// l'axe Z en (0, 0, cintrage). Un cintrage proche du rayon du tube donne le coin intérieur vif d'un
// coude moulé.
export function coude(o) {
  var rho = o.cintrage, r = o.rayon, angle = o.angle || Math.PI / 2, na = o.pas || 20, seg = o.segments || 48;
  var pos = [], nor = [], uv = [], index = [], nu = tours(r);
  for (var i = 0; i <= na; i++) {
    var a = angle * i / na, ox = -Math.sin(a), oz = -Math.cos(a);   // du centre du cintrage vers la fibre moyenne
    for (var j = 0; j <= seg; j++) {
      var ph = TAU * j / seg, cx = Math.cos(ph), sy = Math.sin(ph), d = rho + r * cx;
      pos.push(rho + d * ox, r * sy, rho + d * oz); nor.push(cx * ox, sy, cx * oz); uv.push(nu * j / seg, rho * a / CARREAU);
    }
  }
  for (i = 0; i < na; i++) for (j = 0; j < seg; j++) {
    var A = i * (seg + 1) + j, B = A + seg + 1; index.push(A, B, A + 1, B, B + 1, A + 1);
  }
  return geometrie(new Float32Array(pos), new Float32Array(nor), new Float32Array(uv), index);
}

// L'ÉCROU UNION CANNELÉ des pièces Dura, relevé sur ses photos (coudes, té, clarinettes, manchon) : un
// canon, ses nervures en long aux bouts arrondis, une jupe lisse côté bouche, et le taraudage 1" dedans.
// Le collet (côté corps de la pièce) est en z = 0, la bouche en z = longueur : la pièce le tourne.
// Options : longueur ; rCanon ; rJupe ; jupe (longueur de la jupe lisse) ; nervures (8), largeur et
// saillie d'une nervure ; rCollet (le trou du collet, où passe le corps) ; gaz ; prise (profondeur
// du taraudage). Rend la géométrie, déjà fusionnée.
export function ecrouUnion(o) {
  o = o || {};
  var L = o.longueur || 36, rc = o.rCanon || 21.6, rj = o.rJupe || 24, jupe = o.jupe != null ? o.jupe : 12, n = o.nervures || 8;
  var larg = o.largeur || 6.4, saillie = o.saillie != null ? o.saillie : rj - rc, rCollet = o.rCollet || 17.2, g = o.gaz || "1";
  var fond = rayonDuFond({ gaz: g }) + 0.15, prise = Math.min(o.prise || 17, L - 4), zj = L - jupe, morceaux = [];
  // Le dehors : le collet, le canon, l'épaule de la jupe, la jupe, son bord arrondi, puis la bouche.
  morceaux.push(tourne([[rCollet, 0], [rc - 1.2, 0, { a: 1 }], [rc, 1.6, { a: 1.2 }], [rc, zj - 1.4, { a: 1 }], [rj, zj, { a: 1 }], [rj, L - 0.2, { a: 1.3 }], [fond + 0.9, L, { c: 0.5 }], [fond, L - 0.9]], { segments: 72 }));
  // Le dedans : le taraudage, puis le fond de l'écrou jusqu'au trou du collet.
  morceaux.push(taraudage({ gaz: g, z0: L - 0.9 - prise, z1: L - 0.9, segments: 36 }));
  morceaux.push(tourne([[fond, L - 0.9 - prise], [rCollet, L - 0.9 - prise], [rCollet, 0]], { segments: 36 }));
  // Les nervures : une barre ronde à demi noyée dans le canon, son bout arrondi côté collet, l'autre
  // bout fondu dans la jupe.
  var rb = larg / 2, zb0 = 3 + rb, zb1 = zj + 1.5, centre = rc + saillie - rb;
  for (var i = 0; i < n; i++) {
    var a = TAU * i / n + (o.decalage || 0), barre = new THREE.CapsuleGeometry(rb, zb1 - zb0, 5, 14);
    barre.rotateX(Math.PI / 2); barre.translate(centre, 0, (zb0 + zb1) / 2); barre.rotateZ(a); uvCube(barre);
    morceaux.push(aIndexer(barre));
  }
  return mergeGeometries(morceaux.map(nettoyer));
}

// Une vis à tête bombée et son empreinte en croix (les vis inox du couvercle d'une électrovanne). La
// tête est posée sur le plan z = 0 et monte vers +z ; `rondelle` ajoute son embase.
export function visCruciforme(o) {
  o = o || {};
  var r = o.rayon || 3.6, h = o.hauteur || 2.4, anneaux = 10, seg = 32, pos = [], index = [];
  var prof = o.creux != null ? o.creux : h * 0.55, bras = r * 0.62, larg = r * 0.17;
  function haut(x, y) {
    var d = Math.hypot(x, y) / r, dome = h * Math.sqrt(Math.max(0, 1 - d * d * 0.86)) * (d > 0.94 ? (1 - d) / 0.06 * 0.5 + 0.5 : 1);
    var ax = Math.abs(x), ay = Math.abs(y);
    var croix = Math.max(lisse((larg - ay) / (larg * 0.5)) * lisse((bras - ax) / (r * 0.12)), lisse((larg - ax) / (larg * 0.5)) * lisse((bras - ay) / (r * 0.12)));
    return dome - prof * croix;
  }
  pos.push(0, 0, haut(0, 0));
  for (var k = 1; k <= anneaux; k++) for (var j = 0; j < seg; j++) {
    var a = TAU * j / seg, d = r * k / anneaux, x = d * Math.cos(a), y = d * Math.sin(a); pos.push(x, y, k === anneaux ? 0 : haut(x, y));
  }
  for (j = 0; j < seg; j++) index.push(0, 1 + j, 1 + (j + 1) % seg);
  for (k = 1; k < anneaux; k++) for (j = 0; j < seg; j++) {
    var A = 1 + (k - 1) * seg + j, B = 1 + (k - 1) * seg + (j + 1) % seg, C = A + seg, D = B + seg; index.push(A, C, B, B, C, D);
  }
  var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals(); uvCube(g);
  var morceaux = [aIndexer(g)];
  if (o.rondelle) morceaux.push(tourne([[0, -o.rondelle.epaisseur], [o.rondelle.rayon, -o.rondelle.epaisseur, { c: 0.15 }], [o.rondelle.rayon, 0, { c: 0.15 }], [0, 0]], { segments: 32 }));
  return mergeGeometries(morceaux.map(nettoyer));
}

// Un fil, ou tout tube qui suit des points : [[x, y, z], ...].
export function fil(points, rayon, o) {
  o = o || {};
  var courbe = new THREE.CatmullRomCurve3(points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, "centripetal");
  var g = new THREE.TubeGeometry(courbe, o.pas || Math.max(24, points.length * 10), rayon, o.segments || 10, false);
  var bouts = [points[0], points[points.length - 1]].map(function (p) { var s = new THREE.SphereGeometry(rayon, 10, 6); s.translate(p[0], p[1], p[2]); return s; });
  return mergeGeometries([g].concat(bouts).map(nettoyer));
}

// Une boîte aux arêtes arrondies, centrée sur l'origine.
export function boite(lx, ly, lz, arrondi) {
  var g = new RoundedBoxGeometry(lx, ly, lz, 3, Math.min(arrondi != null ? arrondi : 1, lx / 2, ly / 2, lz / 2));
  uvCube(g); return aIndexer(g);
}

// Un contour plat (dans le plan XY, [[x, y], ...]) monté en volume de z0 à z1, arêtes adoucies.
// Un point peut porter { a: rayon } : son angle s'arrondit, comme dans un profil tourné.
export function prisme(contour, z0, z1, o) {
  o = o || {};
  // Le contour est fermé : chaque point a ses deux voisins, le premier et le dernier compris.
  var pts = adoucir([contour[contour.length - 1]].concat(contour, [contour[0]])).slice(1, -1);
  var forme = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  var b = Math.min(o.arrondi != null ? o.arrondi : 0.6, (z1 - z0) * 0.45);
  var g = new THREE.ExtrudeGeometry(forme, { depth: z1 - z0 - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, z0 + b); g = toCreasedNormals(g, 0.6); uvCube(g);
  return aIndexer(g);
}

// DES COORDONNÉES DE TEXTURE PAR PROJECTION : chaque triangle prend le plan le plus proche de sa face.
// Le grain d'une matière garde ainsi la même taille sur une forme qui n'est pas tournée.
export function uvCube(g) {
  var p = g.getAttribute("position"), idx = g.getIndex();
  if (idx) {   // un sommet partagé par deux faces de plans différents étirerait la texture : on sépare
    var plat = g.toNonIndexed(); g.setIndex(null);
    g.setAttribute("position", plat.getAttribute("position")); if (plat.getAttribute("normal")) g.setAttribute("normal", plat.getAttribute("normal"));
    p = g.getAttribute("position");
  }
  var uv = new Float32Array(p.count * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (var i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)); var ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    [a, b, c].forEach(function (v, k) {
      var u, w; if (ax >= ay && ax >= az) { u = v.y; w = v.z; } else if (ay >= az) { u = v.x; w = v.z; } else { u = v.x; w = v.y; }
      uv[(i + k) * 2] = u / CARREAU; uv[(i + k) * 2 + 1] = w / CARREAU;
    });
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

// Toute géométrie ramenée à la même forme (indexée ; position, normale, texture) pour se fusionner.
function aIndexer(g) {
  if (!g.getIndex()) { var n = g.getAttribute("position").count, idx = new Array(n); for (var i = 0; i < n; i++) idx[i] = i; g.setIndex(idx); }
  return g;
}
export function nettoyer(g) {
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
  Object.keys(g.attributes).forEach(function (k) { if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k); });
  g.morphAttributes = {}; g.clearGroups();
  return aIndexer(g);
}

// DÉPLACER UNE GÉOMÉTRIE (elle est modifiée et rendue). Les rotations sont en radians, appliquées dans
// l'ordre x, y, z, puis la translation.
export function placer(g, t) {
  t = t || {};
  if (t.rx) g.rotateX(t.rx); if (t.ry) g.rotateY(t.ry); if (t.rz) g.rotateZ(t.rz);
  if (t.x || t.y || t.z) g.translate(t.x || 0, t.y || 0, t.z || 0);
  return g;
}
// L'axe Z local couché sur l'axe X (ce qui était en +z part vers +x) : pour la rangée du haut.
export function coucher(g) { return g.rotateY(Math.PI / 2); }
// Retourner une forme bout pour bout autour de l'axe Y, le haut restant en haut : z devient L - z.
export function retourner(g, L) { g.rotateY(Math.PI); g.translate(0, 0, L || 0); return g; }

// LE LOT D'UNE PIÈCE : ses formes rangées par matière, puis fusionnées. Une pièce devient ainsi une
// couche par matière, et chaque couche se dessine en une seule fois pour toutes les pièces pareilles.
export function Lot() { this.tas = {}; this.ordre = []; }
Lot.prototype.ajouter = function (matiere, g, t) {
  if (t) placer(g, t);
  if (!this.tas[matiere]) { this.tas[matiere] = []; this.ordre.push(matiere); }
  this.tas[matiere].push(nettoyer(g));
  return this;
};
Lot.prototype.couches = function () {
  var tas = this.tas;
  return this.ordre.map(function (m) { var g = mergeGeometries(tas[m]); g.computeBoundingBox(); g.computeBoundingSphere(); return { matiere: m, geometrie: g }; });
};

// MESURER UN BOUT DANS LA GÉOMÉTRIE ELLE-MÊME : le centre des sommets posés sur la face de ce bout
// (à 0,05 mm près de son plan, autour de son axe). Une face de bout est faite de cercles : leur centre
// est celui du bout. C'est ce qui permet de vérifier qu'une pièce est sur son axe sans croire sur
// parole les cotes qu'elle annonce.
// `axe` est "x" ou "z" ; `place` la cote du bout sur cet axe ; `rayon` celui de son filetage.
export function centreDuBout(couches, axe, place, rayon, centre) {
  var c = centre || [0, 0, 0], vus = {}, sx = 0, sy = 0, sz = 0, n = 0, secteurs = {}, ns = 0;
  couches.forEach(function (co) {
    var p = co.geometrie.getAttribute("position");
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i), le = axe === "x" ? x : z;
      if (Math.abs(le - place) > 0.05) continue;
      var d = axe === "x" ? Math.hypot(y - c[1], z - c[2]) : Math.hypot(x - c[0], y - c[1]);
      if (d < rayon * 0.25 || d > rayon * 1.6) continue;
      // Un sommet répété (la couture d'un tour, deux formes qui se touchent) ne compte qu'une fois :
      // un cercle se retrouve alors avec ses points à écarts égaux, et leur moyenne est son centre.
      var cle = Math.round(x * 1000) + "," + Math.round(y * 1000) + "," + Math.round(z * 1000);
      if (vus[cle]) continue;
      vus[cle] = true; sx += x; sy += y; sz += z; n++;
      var an = axe === "x" ? Math.atan2(z - c[2], y - c[1]) : Math.atan2(y - c[1], x - c[0]), s = Math.floor((an + Math.PI) / TAU * 12) % 12;
      if (!secteurs[s]) { secteurs[s] = true; ns++; }
    }
  });
  return ns === 12 && n >= 24 ? [sx / n, sy / n, sz / n] : null;   // un tour complet, ou la mesure ne vaut rien
}

export { THREE, mergeGeometries, toCreasedNormals };
