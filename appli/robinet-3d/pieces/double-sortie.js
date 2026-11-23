// LA DOUBLE SORTIE AQUA PLUS BRO3493, « robinet 2 voies entrée 3/4", 2 sorties 3/4" ». Pièce de la
// pile du robinet, sur l'axe Z local : la bouche de l'écrou d'entrée en z = 0 (vers le robinet), la
// pointe des deux filetages mâles en z = L. X va vers la droite de la photo, +Y vers celui qui la
// regarde : les manettes sont de ce côté.
//
// D'OÙ VIENNENT LES COTES. Sa photo de face (docs/robinet-3d-photos/double-sortie-BRO3493.jpg, 1200 x
// 896 ; appli/arrosage-robinet-photos/BRO3493.jpg est la même vue). L'étalon est le filetage mâle 3/4"
// des sorties, 26,441 mm au sommet des filets : 201 px à gauche, 208 à droite, soit 7,75 px par
// millimètre. Les LARGEURS se lisent telles quelles : la silhouette d'une forme ronde est à la
// profondeur de son axe. Les HAUTEURS, non : la photo est prise d'au-dessus, de 23 degrés en haut (la
// face ronde de l'écrou y fait 99 px de haut pour 255 de large) à 29 en bas (la pastille jaune, 91 px
// pour 104), et de près (ce qui est en avant paraît 5 % plus grand, les pastilles s'écartent de 22 px
// de l'axe de leur jambe). Une hauteur est donc relevée, puis redressée de cet angle et de la
// profondeur du point relevé : elle tient à un millimètre près, pas mieux.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : la profondeur de la barre (déduite de la pointe
// du V où le col la rejoint, voir BARRE), l'arrière des moyeux de manette, l'épaisseur du joint, le
// dedans sous lui (le haut du col, le passage de l'eau) et le pas des filets, qu'on ne compte pas
// sur la photo : le 3/4" est à 14 filets au pouce. Pour s'assurer des cotes, le rendu de la pièce,
// pris du même angle et recalé sur la largeur du corps, a été posé sur la photo : les silhouettes
// s'y suivent à trois pixels près (0,4 mm), jambes, écrou, manettes et bord des facettes compris.

var TAU = Math.PI * 2, QUART = Math.PI / 2;

var L = 89;   // la pointe des filetages : leur bas, à 783 px, redressé
var PRISE_SORTIE = 10;   // le filetage mâle, de 78,9 à 89 mm

// L'ÉCROU D'ENTRÉE, laiton tourné. 262 px au sommet du moletage, 255 sur la bande lisse du haut, 252
// sur celle du bas. Il fait 17,3 mm de haut (sa face à 150 px au milieu de la photo, son bas à 271,
// redressés de 23 degrés). Le moletage court de 3,85 à 14,15 mm ; ses stries se répètent tous les
// 14 px au milieu de l'écrou (l'autocorrélation de la photo), soit 1,8 mm : 60 sur le tour.
var ECROU = { h: 17.3, crete: 16.9, haut: 16.45, bas: 16.25, fondStrie: 16.35, strie0: 3.85, strie1: 14.15, stries: 60 };
// LE JOINT PLAT, noir, et le taraudage au-dessus de lui. La photo voit dans l'écrou d'en haut (sa face
// y fait 99 px de haut pour 255 de large : 23 degrés) : à 12 mm de fond le joint serait caché par le
// bord, or il occupe tout le bas de la bouche. Sur la paroi du fond on compte deux filets et demi, de
// 68 à 98 px, puis le noir : le joint est à 6 mm sous la face. Son trou fait 130 px, soit 8,4 mm de
// rayon, et l'on y voit le dessus gris du col. Son épaisseur ne se voit pas : 2,4 mm (estimée).
var TARAUD = { z0: 1.6, z1: 5.8 };
var JOINT = { z0: 6, z1: 8.4, r0: 8.4, r1: 12.35 };
var PRISE_ENTREE = JOINT.z0;   // le mâle du robinet entre jusqu'au joint

// LE COL, entre l'écrou et la barre : 187 px, soit 24,1 mm. Il est tenu à 23,6 : plus large que la
// profondeur de la barre, il en sortirait par devant, et la pointe du V qu'il dessine sur elle (440 px)
// dit justement qu'il en a presque la profondeur. Son congé avec la barre : 2,8 mm (estimé). Son
// dessus porte le joint.
var COL = { r: 11.8, z0: JOINT.z1, passage: 6, fond: 26 };
var CONGE = 2.8;

// LA BARRE, le long de X. De 318 à 522 px à sa silhouette, soit 26,3 mm de haut vus de 24 degrés,
// son axe à 44,5 mm sous la face de l'écrou. Sa profondeur ne se voit pas : la pointe du V du col
// (440 px) la donne à 24,4 mm, et sa hauteur vraie 26,8. Une section ovale, comme une pièce de fonderie.
var BARRE = { z: 44.5, demiHaut: 13.4, demiProf: 12.2 };
// LES JAMBES : leurs axes à 164 et 991,75 px, 827,75 px l'un de l'autre, soit 53,4 mm de part et
// d'autre de l'axe de l'écrou (qui est à 579 px, au milieu). Sous la barre elles font 180 px de large
// (de 73 à 253 px à gauche, de 904 à 1081 à droite), soit 23,2 mm ; leur profondeur passe de celle de
// la barre (au coude) à cette largeur en sept millimètres. Plus bas, le boisseau de la vanne : 186 px
// (de 73 à 259, de 898 à 1082), soit 24 mm, sous un épaulement que la silhouette marque à 575 px des
// deux côtés, redressé à 66,3 mm. Leur bout, sur le laiton des sorties, à 77,6 mm.
var JAMBE = { x: 53.4, r: 11.6, bas: 77.6, rond: 66.3 };
var BOISSEAU = 12;
// LES COINS COUPÉS EN BIAIS. Leur trace sur la silhouette part du dessus de la barre à 158 px et finit
// sur le flanc de la jambe à 406 px : 88 px dans les deux sens, 12 mm, à 45 degrés. Mais la facette
// n'est pas un simple chanfrein d'arête : vue d'en haut, celui-ci ne se verrait que par la tranche,
// en un fil le long de la silhouette, alors que sur la photo elle est grande et descend devant la
// jambe jusqu'à 452 px (à 1035 px au coin droit, 135 px sous le dessus de la barre). Le coin est donc
// rogné par deux plans, un par demi-moule, qui se rejoignent en arête sur la silhouette : celui de
// devant penche aussi vers celui qui regarde, de BIAIS mm par mm (relevé sur ce point bas, estimé à
// 20 % près), celui de derrière, symétrique, vers l'arrière.
var CHANFREIN = 12, BIAIS = 0.55;

// LES SORTIES, laiton : un collet sous la jambe (on en voit le dessus, en croissant, entre la jambe
// et les filets), puis le filetage mâle 3/4", de son haut (648 px à sa silhouette) à sa pointe.
var SORTIE = { collet: 12.9, z0: 77.6, z1: 78.4, filet0: 78.9, filet1: 88, alesage: 8.6 };

// LES MANETTES QUART DE TOUR : un moyeu noir dont l'axe regarde +Y, sa pastille jaune, et une aile
// tournée vers +X sur les deux sorties. Leur face est devant la jambe, où la photo est 5 % plus grande
// qu'à l'étalon (8,16 px par millimètre : c'est ce qui écarte les pastilles de 22 px de l'axe de leur
// jambe). La pastille y fait 107 px de large, soit 6,55 mm de rayon ; le moyeu 71 px de son centre à
// sa silhouette (manette gauche, rangée de la pastille ; le bord arrondi est gris clair, un seuil sur
// le noir le manque), soit 8,7 mm.
// SA LONGUEUR se lit sur son dessus, qu'on voit d'en haut, au droit de la pastille : sa rencontre avec
// la jambe à 571 px, la gorge à 602, le bord de sa face à 652. Ces 81 px, vus de 27 degrés (la
// pastille, ronde, y fait 92 px de haut pour 103 de large), font 22 mm : la face est à 34 mm devant
// l'axe de la jambe, la gorge à 20. Le premier relevé la tenait à 31 et la gorge à 16 : la rencontre
// avec la jambe tombait 14 px trop bas. L'axe, à 69,05 mm, met la pastille gauche à 1 px de la sienne
// (la droite est 4 px plus haut sur la photo : la pièce y penche un peu), la rencontre avec la jambe
// 4 px trop bas, la gorge et le bord de la face à 2 px, sur le rendu posé sur la photo.
// L'AILE est un papillon : un plat COUCHÉ, dans le plan qui contient le pivot, comme l'aile d'un
// écrou à oreilles. La photo, éclaircie, le montre sans doute possible : au-dessus d'une arête vive
// (le reflet de son arrondi à 692 px, puis un trait sombre), un dessus aussi éclairé que celui du
// moyeu, donc tourné vers le haut, de 38 px (relevé colonne par colonne, de 265 à 305 px à gauche et
// de 1130 à 1170 à droite), et dessous la face avant, de 50 px. Vus de 27 degrés à 8,16 px par
// millimètre, et rendus ce que mangent ses arêtes arrondies : 7 mm d'épaisseur, et 11 mm de profondeur
// à un demi-millimètre près ; 11,7 mm, posés sur la photo, y rendent son dessus à 2 px près. Le premier
// relevé y voyait une plaque debout de 10,8 mm, le dessus pris pour le haut de sa face. L'aile va jusqu'à 22 mm de l'axe du moyeu (22,9
// à gauche, 21,1 à droite) et penche de 5 degrés vers son bout : son arête et son bas descendent de 5
// à 7 px sur 80 (les deux ailes, alors que le dessus de la barre est de niveau). Sa face avant est 2 mm
// en retrait de celle du moyeu (le bord arrondi du moyeu se voit devant elle, au bas de la pastille).
// Sa hauteur est calée sur le rendu pris sous l'angle de la photo et posé sur elle : son dessus à 654
// px et son bas à 742, comme sur la photo, la mettent de 3,8 mm au-dessus de l'axe à 3,2 mm au-dessous.
// Vers le moyeu, son bord arrière s'évase (le dessus y monte de 7 px de plus que l'arête) : un congé
// de 3 mm, estimé.
var MANETTE = { z: 69.05, r: 8.7, dos: 7, gorge: 20, face: 34, pastille: 6.55,
  aile: { bout: 22, y0: 20.3, y1: 32, z0: -3.8, z1: 3.2, pente: 5 * Math.PI / 180 } };

function borne(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
function doux(t) { t = borne(t); return t * t * (3 - 2 * t); }
function norme(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function somme(a, b) { return norme([a[0] + b[0], a[1] + b[1], a[2] + b[2]]); }
function vers(a, b, t) { return norme([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
function moins(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function scal(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function miroir(v) { return [-v[0], v[1], v[2]]; }

// UNE SURFACE EN GRILLE : pts[i][j], ses normales et ses coordonnées de texture, rangée par rangée.
// Chaque triangle se tourne lui-même du côté de ses normales : une grille se construit alors dans
// n'importe quel sens, et son miroir aussi, sans qu'une face se retrouve cachée.
function grille(F, pts, nors, uvs) {
  var T = F.THREE, ni = pts.length, nj = pts[0].length, pos = [], nor = [], uv = [], index = [];
  for (var i = 0; i < ni; i++) for (var j = 0; j < nj; j++) {
    pos.push(pts[i][j][0], pts[i][j][1], pts[i][j][2]); nor.push(nors[i][j][0], nors[i][j][1], nors[i][j][2]); uv.push(uvs[i][j][0], uvs[i][j][1]);
  }
  function sommet(k) { return [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]; }
  function normale(k) { return [nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]]; }
  function triangle(a, b, c) {
    var pa = sommet(a), n = croix(moins(sommet(b), pa), moins(sommet(c), pa));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
    var ref = normale(a), nb = normale(b), nc = normale(c);
    if (scal(n, [ref[0] + nb[0] + nc[0], ref[1] + nb[1] + nc[1], ref[2] + nb[2] + nc[2]]) < 0) index.push(a, c, b); else index.push(a, b, c);
  }
  for (i = 0; i + 1 < ni; i++) for (j = 0; j + 1 < nj; j++) {
    var A = i * nj + j, B = A + nj; triangle(A, B, B + 1); triangle(A, B + 1, A + 1);
  }
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(index);
  return g;
}
// La même grille, retournée de gauche à droite (x devient -x) : le coude droit est le miroir du gauche.
function enMiroir(pts, nors) { return { pts: pts.map(function (r) { return r.map(miroir); }), nors: nors.map(function (r) { return r.map(miroir); }) }; }

// UN PLAT AUX ARÊTES ARRONDIES : un contour (dans le plan XY, [[x, y, { a: rayon }], ...]) monté de z0 à
// z1, ses deux arêtes arrondies d'un quart de rond de rayon r. Le prisme des formes fait la même chose,
// mais ses dessus sont de grands triangles dont les sommets du bord prennent un peu de la pente de
// l'arrondi voisin : sur l'aile, grande et plate, une bande en biais se voyait d'un bord à l'autre. Ici
// le dessus et le dessous ont leurs propres sommets, à la normale exacte, et l'arrondi a la sienne.
function plat(F, contour, z0, z1, r) {
  var T = F.THREE, pts = F.adoucir([contour[contour.length - 1]].concat(contour, [contour[0]])).slice(1, -1), n = pts.length, aire = 0;
  for (var i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; aire += p[0] * q[1] - q[0] * p[1]; }
  if (aire < 0) pts.reverse();
  // La normale sortante en chaque point : la moyenne de celles de ses deux côtés.
  var dehors = pts.map(function (p, i) {
    var a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], u = [p[0] - a[0], p[1] - a[1]], v = [b[0] - p[0], b[1] - p[1]];
    var lu = Math.hypot(u[0], u[1]) || 1, lv = Math.hypot(v[0], v[1]) || 1, m = [u[1] / lu + v[1] / lv, -u[0] / lu - v[0] / lv], lm = Math.hypot(m[0], m[1]) || 1;
    return [m[0] / lm, m[1] / lm];
  });
  var pas = 5, rangs = [], k;
  for (k = pas; k >= 0; k--) rangs.push({ phi: QUART * k / pas, bas: true });
  for (k = 0; k <= pas; k++) rangs.push({ phi: QUART * k / pas, bas: false });
  var gp = [], gn = [], gu = [], long = [0];
  for (i = 1; i <= n; i++) long.push(long[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]));
  rangs.forEach(function (rg) {
    var rp = [], rn = [], ru = [], retrait = r * (1 - Math.cos(rg.phi)), z = rg.bas ? z0 + r - r * Math.sin(rg.phi) : z1 - r + r * Math.sin(rg.phi);
    for (var j = 0; j <= n; j++) {
      var p = pts[j % n], d = dehors[j % n];
      rp.push([p[0] - d[0] * retrait, p[1] - d[1] * retrait, z]);
      rn.push([d[0] * Math.cos(rg.phi), d[1] * Math.cos(rg.phi), (rg.bas ? -1 : 1) * Math.sin(rg.phi)]);
      ru.push([long[j] / F.CARREAU, z / F.CARREAU]);
    }
    gp.push(rp); gn.push(rn); gu.push(ru);
  });
  var morceaux = [grille(F, gp, gn, gu)];
  // Le dessus et le dessous : le contour rentré du rayon, à plat.
  var dedans = pts.map(function (p, i) { return new T.Vector2(p[0] - dehors[i][0] * r, p[1] - dehors[i][1] * r); });
  var tri = T.ShapeUtils.triangulateShape(dedans, []);
  [[z0, -1], [z1, 1]].forEach(function (f) {
    var pos = [], nor = [], uv = [], idx = [];
    dedans.forEach(function (v) { pos.push(v.x, v.y, f[0]); nor.push(0, 0, f[1]); uv.push(v.x / F.CARREAU, v.y / F.CARREAU); });
    // Chaque triangle tourné vers sa face : le sens que rend la triangulation n'est pas garanti.
    tri.forEach(function (t) {
      var A = dedans[t[0]], B = dedans[t[1]], C = dedans[t[2]], z = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
      if (z * f[1] > 0) idx.push(t[0], t[1], t[2]); else idx.push(t[0], t[2], t[1]);
    });
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    morceaux.push(g);
  });
  return morceaux;
}

// L'ÉCROU : le chanfrein d'entrée, la face (posée sur le plan z = 0, que la scène mesure), la bande
// lisse du haut, le moletage, la bande du bas, le dessous, puis le dedans jusqu'au taraudage.
function ecrou(F, lot) {
  var E = ECROU, fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15;
  lot.ajouter("laiton", F.tourne([[fond, 1.6], [14.3, 0, { a: 0.3 }], [15.75, 0, { a: 0.35 }], [E.haut, 0.75, { a: 0.35 }],
    [E.haut, 3.45, { a: 0.2 }], [E.fondStrie, E.strie0]], { segments: 72 }));
  lot.ajouter("laiton", F.taraudage({ gaz: "3/4", z0: TARAUD.z0, z1: TARAUD.z1, segments: 48 }));
  lot.ajouter("laiton", F.tourne([[E.fondStrie, E.strie1], [E.bas, 14.4, { a: 0.2 }], [E.bas, 16.6, { a: 0.6 }], [15.6, E.h, { a: 0.3 }],
    [11.5, E.h], [11.5, 15], [12.45, 15], [12.45, JOINT.z0 - 0.1], [fond, TARAUD.z1]], { segments: 72 }));
  lot.ajouter("laiton", moletage(F));
  // Le bord du trou est arrondi : la photo y montre un reflet clair tout autour.
  lot.ajouter("joint", F.tourne([[JOINT.r0, JOINT.z1], [JOINT.r0, JOINT.z0, { a: 0.8 }], [JOINT.r1, JOINT.z0], [JOINT.r1, JOINT.z1], [JOINT.r0, JOINT.z1]], { segments: 64 }));
}

// LE MOLETAGE : les stries droites de l'écrou, d'une seule surface dont le rayon ondule autour de
// l'axe (la crête large et arrondie, le creux en V étroit, comme sur la photo), et qui s'éteint
// en biais à ses deux bouts comme une molette qui sort de la pièce.
function moletage(F) {
  var E = ECROU, n = E.stries * 8, zs = [E.strie0, E.strie0 + 0.2, E.strie0 + 0.45, E.strie0 + 0.75, (E.strie0 + E.strie1) / 2, E.strie1 - 0.75, E.strie1 - 0.45, E.strie1 - 0.2, E.strie1];
  function rayon(th, z) {
    var u = th * E.stries / TAU; u -= Math.floor(u);
    return E.fondStrie + (E.crete - E.fondStrie) * Math.pow(Math.sin(Math.PI * u), 0.6) * doux((z - E.strie0) / 0.6) * doux((E.strie1 - z) / 0.6);
  }
  function point(th, z) { var r = rayon(th, z); return [r * Math.cos(th), r * Math.sin(th), z]; }
  var pts = [], nors = [], uvs = [], e = 1e-4;
  zs.forEach(function (z) {
    var rp = [], rn = [], ru = [];
    for (var j = 0; j <= n; j++) {
      var th = TAU * j / n, p = point(th, z);
      var nn = norme(croix(moins(point(th + e, z), point(th - e, z)), moins(point(th, z + e), point(th, z - e))));
      if (nn[0] * Math.cos(th) + nn[1] * Math.sin(th) < 0) nn = [-nn[0], -nn[1], -nn[2]];
      rp.push(p); rn.push(nn); ru.push([th * E.crete / F.CARREAU, z / F.CARREAU]);
    }
    pts.push(rp); nors.push(rn); uvs.push(ru);
  });
  return grille(F, pts, nors, uvs);
}

// LE COL ET SON CONGÉ EN V. Le col descend de l'écrou et entre dans la barre ; comme il a presque la
// profondeur de la barre, il la quitte haut sur les côtés et bas par devant : c'est le V de la photo.
// Le congé suit cette rencontre tout autour, génératrice par génératrice : un arc (une courbe de
// Bézier) qui part tangent au col et finit tangent à la barre, de part et d'autre de la rencontre.
function col(F, lot) {
  var R = COL.r, Bz = BARRE.z, AB = BARRE.demiHaut, BP = BARRE.demiProf, n = 128, haut = ECROU.h - 0.3;
  function normaleBarre(p) { return norme([0, p[1] / (BP * BP), (p[2] - Bz) / (AB * AB)]); }
  function conge(th, t) {
    var c = Math.cos(th), s = Math.sin(th), x = R * c, y = R * s;
    var zc = Bz - AB * Math.sqrt(Math.max(0, 1 - y * y / (BP * BP))), rencontre = [x, y, zc];
    var nb = normaleBarre(rencontre), nn = [c, s, 0], d = scal(nn, nb);
    var le = norme([nn[0] - d * nb[0], nn[1] - d * nb[1], nn[2] - d * nb[2]]);
    var b = [x + le[0] * CONGE, y + le[1] * CONGE, zc + le[2] * CONGE];
    var yy = b[1], zz = b[2] - Bz, q = 1 / Math.sqrt(yy * yy / (BP * BP) + zz * zz / (AB * AB));
    b = [b[0], yy * q, Bz + zz * q];
    // Le point qui tire l'arc : la rencontre, soulevée jusqu'au plan tangent à la barre en b. Laissé
    // sur la barre, il faisait finir l'arc par la corde de la rencontre à b, qui passe SOUS la barre
    // (elle est bombée) : l'arc y entrait puis en ressortait en rasant, et la limite entre les deux
    // grains se dessinait en pointillés tout le long du V. Soulevé, l'arc arrive sur la barre par le
    // dehors, tangent, et la limite tombe net sur son dernier rang.
    var n2 = normaleBarre(b), h = Math.max(0, scal(n2, moins(b, rencontre)) / scal(n2, nb));
    var tire = [x + nb[0] * h, y + nb[1] * h, zc + nb[2] * h];
    var a = [x, y, zc - CONGE], u = 1 - t;
    return { p: [0, 1, 2].map(function (k) { return u * u * a[k] + 2 * t * u * tire[k] + t * t * b[k]; }), a: a, b: b, nn: nn };
  }
  var rangs = [0, 0.45, 0.8], ts = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1], pts = [], nors = [], uvs = [], e = 1e-4;
  rangs.forEach(function () { pts.push([]); nors.push([]); uvs.push([]); });
  ts.forEach(function () { pts.push([]); nors.push([]); uvs.push([]); });
  for (var j = 0; j <= n; j++) {
    var th = TAU * j / n, base = conge(th, 0), ligne = 0;
    rangs.forEach(function (f) {
      var z = haut + (base.a[2] - haut) * f;
      pts[ligne].push([base.a[0], base.a[1], z]); nors[ligne].push(base.nn); uvs[ligne].push([th * R / F.CARREAU, z / F.CARREAU]); ligne++;
    });
    ts.forEach(function (t) {
      var q = conge(th, t), nm;
      if (t === 0) nm = q.nn;
      else if (t === 1) nm = normaleBarre(q.b);
      else {
        nm = norme(croix(moins(conge(th + e, t).p, conge(th - e, t).p), moins(conge(th, t + e).p, conge(th, t - e).p)));
        if (scal(nm, somme(q.nn, normaleBarre(q.b))) < 0) nm = [-nm[0], -nm[1], -nm[2]];
      }
      pts[ligne].push(q.p); nors[ligne].push(nm); uvs[ligne].push([th * R / F.CARREAU, q.p[2] / F.CARREAU]); ligne++;
    });
  }
  lot.ajouter("nickelSable", grille(F, pts, nors, uvs));
  // Le haut du col, dans l'écrou, sous le joint ; on le voit par le trou du joint. Le passage de
  // l'eau est fermé plus bas par un fond sombre.
  lot.ajouter("nickelSable", F.tourne([[COL.passage, COL.fond], [COL.passage, COL.z0, { c: 0.4 }], [R, COL.z0], [R, haut]], { segments: 64 }));
  lot.ajouter("creux", F.tourne([[0, COL.fond], [COL.passage, COL.fond]], { segments: 24 }));
}

// LE CORPS : la barre et les deux jambes, d'un seul tube balayé le long d'un U renversé. Chaque
// génératrice (un point du contour de la section, à l'angle phi) monte la jambe gauche, suit la barre,
// descend la jambe droite ; aux coudes elle se plie sur le plan d'onglet, qui est le même pour les
// deux sections parce qu'elles ont la même profondeur. Le coin extérieur de chaque coude est rogné par
// le plan du chanfrein : là, la génératrice quitte la jambe au point exact où elle le traverse et
// reprend la barre au point où elle en ressort, et ce qui est entre les deux est la facette plate.
// Aux arêtes de la facette et dans le creux de l'onglet, la normale tourne d'une face à l'autre sur
// un ou trois millimètres : la fonderie ne laisse aucune arête vive, la photo non plus.
function corps(F, lot) {
  var J = JAMBE, Bz = BARRE.z, AB = BARRE.demiHaut, BP = BARRE.demiProf;
  // Le plan du coin gauche : -x - z + BIAIS |y| = k (le droit en est le miroir). Sur le plan de joint
  // (y = 0) il rogne CHANFREIN mm de la silhouette dans les deux sens ; devant et derrière il mord plus.
  var k = J.x + J.r - Bz + AB - CHANFREIN;
  // Une génératrice (l'angle phi de la section) est rognée quand le plan la coupe sous l'onglet :
  // c (J.r + AB) + BIAIS BP |s| dépasse J.r + AB - CHANFREIN. Elle l'est jusqu'à l'angle phic.
  var A1 = J.r + AB, B1 = BIAIS * BP, C1 = A1 - CHANFREIN;
  function rogne(c, s) { return c * A1 + B1 * Math.abs(s) - C1; }
  var phic = Math.atan2(B1, A1) + Math.acos(C1 / Math.hypot(A1, B1)), N = 96, phis = [];
  for (var j = 0; j < N; j++) phis.push(TAU * j / N);
  // Les deux génératrices où la facette finit en pointe : sans elles, sa pointe serait tronquée.
  phis.push(phic, TAU - phic);
  phis.sort(function (a, b) { return a - b; });
  phis = phis.filter(function (p, i) { return i === 0 || p - phis[i - 1] > 1e-5; });
  phis.push(TAU);
  // La jambe a la profondeur de la barre jusqu'au bas de celle-ci (58 mm) : l'onglet et la facette
  // tombent tous deux au-dessus, sur une section qui est exactement celle de la barre.
  function prof(z) { return BP + (J.r - BP) * doux((z - 58) / 7); }
  function nJambe(g, z) { return norme([-g.c / J.r, g.s / prof(z), 0]); }   // la jambe gauche
  function nBarre(g) { return norme([0, g.s / BP, -g.c / AB]); }
  // La normale de la facette : celle du pan de devant ou de derrière, et sur l'arête qui les joint
  // (la génératrice phi = 0, sur le plan de joint), leur moyenne : l'arête de fonderie n'est pas vive.
  function nFacette(s) { return norme([-1, s > 1e-9 ? BIAIS : s < -1e-9 ? -BIAIS : 0, -1]); }
  var gens = phis.map(function (phi) {
    var c = Math.cos(phi), s = Math.sin(phi), zm = Bz - AB * c, xl = -J.x - J.r * c, coupe = rogne(c, s) > 1e-12, ay = B1 * Math.abs(s);
    return { phi: phi, c: c, s: s, zm: zm, xl: xl, coupe: coupe, z1: coupe ? -xl + ay - k : zm, x2: coupe ? -k - zm + ay : xl, nf: nFacette(s) };
  });
  // Le bord d'une face, là où elle rejoint la voisine : la facette si la génératrice est rognée, la
  // jambe ou la barre de l'autre côté de l'onglet sinon. `d` est la distance à ce bord.
  function bord(n, voisine, d, large) { return vers(somme(n, voisine), n, doux(d / large)); }

  // La jambe gauche, du bas (là où le tour du bout la reprend) jusqu'à l'onglet ou la facette.
  var BAS = [J.rond, 64.5, 62.5, 60.5, 59], HAUT = [1, 0.7, 0.45, 0.25, 0.12, 0.05, 0.02, 0];
  var jp = [], jn = [], ju = [];
  BAS.concat(HAUT.map(function () { return null; })).forEach(function () { jp.push([]); jn.push([]); ju.push([]); });
  gens.forEach(function (g) {
    var zs = BAS.concat(HAUT.map(function (u) { return g.z1 + (58 - g.z1) * u; }));
    zs.forEach(function (z, i) {
      var n = nJambe(g, z), d = z - g.z1;
      jp[i].push([g.xl, prof(z) * g.s, z]);
      jn[i].push(g.coupe ? bord(n, g.nf, d, 1.3) : bord(n, nBarre(g), d, 3));
      ju[i].push([g.phi * J.r / F.CARREAU, (J.rond - z) / F.CARREAU]);
    });
  });
  lot.ajouter("nickelSable", grille(F, jp, jn, ju));
  var droite = enMiroir(jp, jn);
  lot.ajouter("nickelSable", grille(F, droite.pts, droite.nors, ju));

  // La barre, d'un bout à l'autre : des rangs serrés près des bouts (le bord y tourne), quelques-uns
  // au milieu pour que le grain de la texture reste à sa taille.
  var PRES = [0, 0.5, 1.3, 3, 6, 10], MILIEU = [-30, -20, -10, 0, 10, 20, 30], bp = [], bn = [], bu = [];
  var nombre = PRES.length * 2 + MILIEU.length;
  for (var i = 0; i < nombre; i++) { bp.push([]); bn.push([]); bu.push([]); }
  gens.forEach(function (g) {
    var a = g.x2, xs = PRES.map(function (d) { return a + d; }).concat(MILIEU, PRES.slice().reverse().map(function (d) { return -a - d; }));
    var nb = nBarre(g), vGauche = g.coupe ? g.nf : nJambe(g, g.z1), vDroite = miroir(vGauche);
    xs.forEach(function (x, i) {
      var dg = x - a, dd = -a - x, large = g.coupe ? 1.3 : 3;
      bp[i].push([x, BP * g.s, g.zm]);
      bn[i].push(dg < dd ? bord(nb, vGauche, dg, large) : bord(nb, vDroite, dd, large));
      // La texture court le long de X, à la même vitesse sur toute la génératrice. La faire suivre
      // la génératrice depuis la jambe (pour qu'elle passe le coude sans couture) la cisaillait d'un
      // facteur deux devant la barre, le cosinus de l'angle de section s'ajoutant au chemin : le grain
      // filait en chevrons, qu'un sablé n'a pas. La couture tombe sur l'onglet et sur les bords des
      // facettes, où la normale tourne déjà.
      bu[i].push([g.phi * AB / F.CARREAU, x / F.CARREAU]);
    });
  });
  lot.ajouter("nickelSable", grille(F, bp, bn, bu));

  // Les facettes : pour chaque génératrice rognée, la corde de la jambe à la barre, dans le pan de
  // devant ou de derrière. Elles vont de -phic à +phic et se plient sur l'arête, en phi = 0.
  var coupees = gens.filter(function (g) { return rogne(g.c, g.s) >= -1e-9 && g.phi < TAU; });
  coupees = coupees.filter(function (g) { return g.phi > Math.PI; }).concat(coupees.filter(function (g) { return g.phi <= Math.PI; }));
  var fp = [[], [], [], []], fn = [[], [], [], []], fu = [[], [], [], []];
  coupees.forEach(function (g) {
    var p1 = [g.xl, BP * g.s, g.z1], p2 = [g.x2, BP * g.s, g.zm], lc = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]), e = Math.min(1.3, lc * 0.45);
    [0, e, lc - e, lc].forEach(function (d, i) {
      var t = lc > 1e-9 ? d / lc : 0, p = [p1[0] + (p2[0] - p1[0]) * t, p1[1], p1[2] + (p2[2] - p1[2]) * t];
      fp[i].push(p);
      fn[i].push(i === 0 ? somme(nJambe(g, g.z1), g.nf) : i === 3 ? somme(nBarre(g), g.nf) : g.nf);
      fu[i].push([p[1] / F.CARREAU, (p[0] - p[2]) * Math.SQRT1_2 / F.CARREAU]);
    });
  });
  lot.ajouter("nickelSable", grille(F, fp, fn, fu));
  var facette = enMiroir(fp, fn);
  lot.ajouter("nickelSable", grille(F, facette.pts, facette.nors, fu));
}

// UNE SORTIE, sur l'axe x = x0 : le boisseau sous la jambe, le collet et le filetage mâle en laiton,
// puis la manette posée sur le devant du boisseau.
function sortie(F, lot, x0) {
  var S = SORTIE, J = JAMBE, M = MANETTE, W = M.aile, fond = F.rayonDuFond({ gaz: "3/4" }), place = { x: x0 };
  // Le boisseau : l'épaulement d'où il sort de la jambe, puis son tour jusqu'au laiton. Sur la photo
  // l'épaulement est un ressaut doux, à peine plus clair que la jambe ; à 45 degrés sur 0,4 mm, il
  // renvoyait la lumière du haut en un fil blanc. Il monte donc sur 1,25 mm, en S, partant à la
  // verticale pour que la jambe s'y raccorde sans pli.
  lot.ajouter("nickelSable", F.tourne([[J.r, J.rond], [J.r, J.rond + 0.35, { a: 0.5 }], [BOISSEAU, J.rond + 1.25, { a: 0.7 }],
    [BOISSEAU, J.bas, { a: 0.9 }], [10.4, J.bas]], { segments: 96 }), place);
  lot.ajouter("laiton", F.tourne([[10.4, S.z0], [S.collet, S.z0, { c: 0.35 }], [S.collet, S.z1, { c: 0.25 }], [fond, S.filet0]], { segments: 64 }), place);
  lot.ajouter("laiton", F.filetage({ gaz: "3/4", z0: S.filet0, z1: S.filet1, entree: 0.8, sortie: 0.5, pointe: "z1", segments: 40 }), place);
  // La pointe : le chanfrein d'entrée, la face (posée sur le plan z = L), l'alésage, et son fond sombre.
  lot.ajouter("laiton", F.tourne([[fond, S.filet1], [11.35, L, { a: 0.25 }], [S.alesage, L, { c: 0.35 }], [S.alesage, S.z0 + 0.2]], { segments: 64 }), place);
  lot.ajouter("creux", F.tourne([[S.alesage, S.z0 + 0.2], [0, S.z0 + 0.2]], { segments: 32 }), place);

  // Le moyeu, tourné sur son axe puis couché vers +Y : son dos noyé dans la jambe, une gorge au tiers
  // (la ligne qu'on voit sur ses deux photos), le bord de sa face arrondi, et le creux où la pastille
  // est posée, qui laisse un fin cerne noir autour d'elle.
  var debout = { rx: -QUART, x: x0, z: M.z };
  lot.ajouter("noir", F.tourne([[0, M.dos], [M.r, M.dos], [M.r, M.gorge - 0.5, { a: 0.2 }], [M.r - 0.3, M.gorge], [M.r, M.gorge + 0.5, { a: 0.2 }],
    [M.r, M.face, { a: 0.9 }], [M.pastille + 0.3, M.face, { a: 0.25 }], [M.pastille + 0.3, M.face - 0.5], [0, M.face - 0.5]], { segments: 64 }), debout);
  lot.ajouter("jaune", F.tourne([[M.pastille, M.face - 0.5], [M.pastille, M.face - 0.05, { a: 0.25 }], [4, M.face + 0.12], [0, M.face + 0.16]], { segments: 48 }), debout);
  // L'aile : un plat couché, son contour (le long de X, la profondeur en Y) tracé à plat et monté sur
  // son épaisseur en Z, ses arêtes arrondies ; son pied est noyé dans le moyeu. Elle tourne ensuite
  // autour du pivot de la pente relevée, le bout vers le bas.
  plat(F, [[2, W.y0 - 4.5], [11, W.y0, { a: 3 }], [W.bout, W.y0, { a: 2 }], [W.bout, W.y1, { a: 1.6 }], [2, W.y1]], W.z0, W.z1, 0.9)
    .forEach(function (g) { lot.ajouter("noir", g, { ry: -W.pente, x: x0, z: M.z }); });
}

export default {
  "double-sortie-BRO3493": function (F) {
    var lot = new F.Lot();
    ecrou(F, lot); col(F, lot); corps(F, lot);
    sortie(F, lot, -JAMBE.x); sortie(F, lot, JAMBE.x);
    var bout = { z: L, genre: "male", gaz: "3/4", prise: PRISE_SORTIE };
    return {
      couches: lot.couches(),
      haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE_ENTREE },
      // La sortie GAUCHE est celle de l'arrosage (son choix du 18 octobre 2026) : le programmateur s'y
      // pose. La droite reste au client.
      bas: Object.assign({ x: -JAMBE.x }, bout),
      autres: [Object.assign({ x: JAMBE.x }, bout)]
    };
  }
};
