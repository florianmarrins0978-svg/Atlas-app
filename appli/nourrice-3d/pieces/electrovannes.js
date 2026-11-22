// LES ÉLECTROVANNES RAIN BIRD 100 DV 1" : MM 9V (deux filetages mâles) et FF 9V (deux bouches
// taraudées). Pièces de colonne : le passage de l'eau est sur l'axe Z, du bout du haut (z = 0) au bout
// du bas (z = L) ; le couvercle, la purge et la bobine sont vers le haut (+Y).
//
// D'OÙ VIENNENT LES COTES.
//   L'étalon est le filetage 1" gaz (33,25 mm au sommet des filets). Les longueurs sont celles de la
//   fiche Rain Bird : 13,6 cm pour la 100-DV-MM, 11,1 cm pour la 100-DV.
//   Les hauteurs et les diamètres se lisent sur sa photo de trois quarts (electrovanne-100dv.jpg) :
//   l'appareil y regarde de 21 degrés au-dessus de l'horizontale, à 28 degrés du travers de la vanne
//   (les deux bouts du tube et l'ellipse de l'alésage le donnent), et 8,5 pixels y font un millimètre.
//   La place des vis, de la purge et de la bobine se lit sur ses photos de dessus.
//   Ce que ses photos ne montrent pas (le dessous, le côté de la bobine) est estimé, et dit comme tel.
//
// LES ANGLES se comptent comme sur sa photo de dessus : 0 degré vers la droite (+X), 90 degrés vers le
// bout du haut. Un point à l'angle a et à la distance r du centre du couvercle est en
// (r cos a, y, centre - r sin a).

var TAU = Math.PI * 2, DEG = Math.PI / 180;

// Les formes de formes.js sont couchées sur l'axe Z ; le couvercle, les colonnes et la bobine sont
// debout : leur axe passe par (x, z), leur cote z locale devient la hauteur, et `tour` les tourne
// autour de cet axe.
function debout(x, z, tour) { return { rx: -Math.PI / 2, ry: tour || 0, x: x, z: z }; }
function vers(angle, r) { return [r * Math.cos(angle), -r * Math.sin(angle)]; }
function tourner(contour, angle) {
  var c = Math.cos(angle), s = Math.sin(angle);
  return contour.map(function (p) { var q = [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; if (p[2]) q.push(p[2]); return q; });
}
function carre(cote, coin) { var h = cote / 2; return [[h, -h, { a: coin }], [h, h, { a: coin }], [-h, h, { a: coin }], [-h, -h, { a: coin }]]; }

// Un contour fermé percé d'un trou, monté en volume : la lèvre du dessus de la bobine, l'empreinte de
// la vis de purge. F.prisme ne sait pas percer, et une empreinte posée en aplat se voit de biais.
function perce(F, dehors, dedans, z0, z1, arrondi) {
  var T = F.THREE, b = Math.min(arrondi, (z1 - z0) * 0.45);
  function points(contour) {
    return F.adoucir([contour[contour.length - 1]].concat(contour, [contour[0]])).slice(1, -1).map(function (p) { return new T.Vector2(p[0], p[1]); });
  }
  var forme = new T.Shape(points(dehors)); forme.holes.push(new T.Path(points(dedans)));
  var g = new T.ExtrudeGeometry(forme, { depth: z1 - z0 - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, z0 + b); g = F.toCreasedNormals(g, 0.6);
  return F.uvCube(g);
}

// LE CONTOUR DU PLAN DE JOINT, vu de dessus : le cercle du couvercle, et autour de lui ses lobes (une
// oreille de vis, la tour de la bobine). Une oreille est une colonne ronde reliée au cercle par ses
// deux flancs droits ; la tour est un rond qui mord le cercle. Chaque raccord porte un congé : une
// pièce moulée n'a pas d'angle rentrant vif.
function contourDuJoint(rayon, lobes, conge, pas) {
  var pts = [], tries = lobes.slice().sort(function (u, v) { return u.angle - v.angle; });
  function ouverture(l) { return l.oreille ? Math.asin(l.r / rayon) : Math.acos((rayon * rayon + l.d * l.d - l.r * l.r) / (2 * rayon * l.d)); }
  function arc(cx, cy, r, a0, a1, bords) {
    var n = Math.max(2, Math.ceil((a1 - a0) / pas));
    for (var k = 0; k <= n; k++) {
      var a = a0 + (a1 - a0) * k / n, p = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      if (bords && (k === 0 || k === n)) p.push({ a: conge });
      pts.push(p);
    }
  }
  tries.forEach(function (l, i) {
    var cx = l.d * Math.cos(l.angle), cy = l.d * Math.sin(l.angle), o = ouverture(l);
    if (l.oreille) {
      pts.push([rayon * Math.cos(l.angle - o), rayon * Math.sin(l.angle - o), { a: conge }]);
      arc(cx, cy, l.r, l.angle - Math.PI / 2, l.angle + Math.PI / 2, false);
      pts.push([rayon * Math.cos(l.angle + o), rayon * Math.sin(l.angle + o), { a: conge }]);
    } else {
      var b = Math.PI - Math.acos((l.d * l.d + l.r * l.r - rayon * rayon) / (2 * l.d * l.r));
      arc(cx, cy, l.r, l.angle - b, l.angle + b, true);
    }
    var suivant = tries[(i + 1) % tries.length], debut = l.angle + o, fin = suivant.angle - ouverture(suivant) + (i + 1 === tries.length ? TAU : 0);
    var n = Math.max(1, Math.ceil((fin - debut) / pas));
    for (var k = 1; k < n; k++) { var a = debut + (fin - debut) * k / n; pts.push([rayon * Math.cos(a), rayon * Math.sin(a)]); }
  });
  return pts;
}

// LES COTES COMMUNES AUX DEUX VANNES (le même corps DV), en millimètres. Les hauteurs se comptent
// depuis l'axe du tube.
var C = {
  filet: 17,            // 7 filets comptés sur ses deux photos, soit 17 mm au pas de 2,309
  alesage: 12.6,        // l'ellipse de l'alésage, photo de trois quarts : 220 px de grand axe
  rCouvercle: 27.8,     // le bord gauche du couvercle, photo de trois quarts : 236 px du centre
  rCorps: 27.2,
  yBande: 15, rBol: 24.6, // sous le plan de joint, une bande droite de 13 mm (60 px sur la photo de trois quarts, entre deux colonnes), puis la cuvette en retrait
  rJante: 23.4,         // la jante gravée fait 4 mm de large (photo de dessus)
  yJoint: 29,           // le filet clair du plan de joint sur la colonne de devant
  yPont: 48.6,          // le dessus du couvercle
  yFond: 45.4,          // le fond de ses alvéoles, 3 mm plus bas (estimé sur la photo de trois quarts)
  dVis: 33.5,           // le cercle des vis : 29 et 31 mm entre deux vis voisines, à 53 degrés
  rOreille: 6.6, rColonne: 6, yOreille: 43.8, yColonne: 4,
  dTour: 32.6, rTour: 17.5, yTour: 53.5,
  yBol: -18, yPied: -21
};

// UN BOUT MÂLE 1" : le filetage, sa face, son alésage, puis le col lisse jusqu'au corps. Construit au
// bout du haut ; celui du bas est le même, retourné bout pour bout.
function boutMale(F, lot, L, bas, rCol) {
  var fond = F.rayonDuFond({ gaz: "1" }), c = L / 2;
  function place() { return bas ? { ry: Math.PI, z: L } : null; }
  lot.ajouter("noir", F.filetage({ gaz: "1", z0: 0, z1: C.filet }), place());
  // La face du bout : ses deux cercles sont posés sur le plan z = 0, c'est eux que la scène mesure.
  lot.ajouter("noir", F.tourne([[C.alesage, 34], [C.alesage, 0, { c: 0.8 }], [fond, 0]], { segments: 44 }), place());
  lot.ajouter("noir", F.tourne([[fond, C.filet], [rCol, C.filet + (rCol - fond), { a: 0.6 }], [rCol, c - 12]], { segments: 48 }), place());
  lot.ajouter("creux", F.tourne([[0, 34], [C.alesage, 34]], { segments: 24 }), place());
}

// UNE BOUCHE FEMELLE 1" : la douille lisse, sa lèvre arrondie, le taraudage et l'épaulement du fond.
function boutFemelle(F, lot, L, bas, o) {
  var fond = F.rayonDuFond({ gaz: "1" }) + 0.15, c = L / 2, zF = 0.9 + o.prise;
  function place() { return bas ? { ry: Math.PI, z: L } : null; }
  lot.ajouter("noir", F.tourne([[fond, 0.9], [fond + 0.9, 0], [o.rayon, 0, { a: 1.8 }], [o.rayon, c - 12]], { segments: 56 }), place());
  lot.ajouter("noir", F.taraudage({ gaz: "1", z0: 0.9, z1: zF }), place());
  lot.ajouter("noir", F.tourne([[C.alesage, 36], [C.alesage, zF, { c: 0.5 }], [fond, zF]], { segments: 36 }), place());
  lot.ajouter("creux", F.tourne([[0, 36], [C.alesage, 36]], { segments: 24 }), place());
}

// LE CORPS ET LE COUVERCLE, autour de l'axe vertical qui passe par le centre `c` : le bol, la paroi,
// le plan de joint et son contour à lobes, les oreilles et leurs colonnes, les vis, le dessus à
// alvéoles, et la tour où se visse la bobine.
function corps(F, lot, c, o) {
  var yJ0 = C.yJoint - 0.7, yJ1 = C.yJoint + 0.7, aTour = o.tour * DEG;
  // Le bol descend presque au niveau du pied : sur la photo de trois quarts, son arrondi passe sous
  // le col d'entrée à 18 mm sous l'axe. Sous la bande droite il rentre et s'arrondit : entre deux
  // colonnes la paroi fuit dans l'ombre, c'est ce qui détache les colonnes du corps.
  lot.ajouter("noir", F.tourne([[0, C.yBol], [15, C.yBol, { a: 9 }], [C.rBol, 1, { a: 14 }], [C.rBol, C.yBande - 1.6, { a: 1 }], [C.rCorps, C.yBande, { a: 0.8 }], [C.rCorps, yJ0 + 0.2]], { segments: 64 }), debout(0, c));
  lot.ajouter("noir", F.tourne([[C.rCouvercle, yJ1 - 0.2], [C.rCouvercle, C.yPont, { c: 1.1 }], [C.rJante, C.yPont, { a: 0.5 }], [C.rJante, C.yFond, { a: 0.7 }], [0, C.yFond]], { segments: 64 }), debout(0, c));

  var lobes = o.vis.map(function (a) { return { angle: ((a % 360) + 360) % 360 * DEG, d: C.dVis, r: C.rOreille + 1.4, oreille: true }; });
  lobes.push({ angle: ((o.tour % 360) + 360) % 360 * DEG, d: C.dTour, r: C.rTour + 1.2 });
  lot.ajouter("noir", F.prisme(contourDuJoint(C.rCouvercle + 1.4, lobes, 1.6, 15 * DEG), yJ0, yJ1, { arrondi: 0.45 }), debout(0, c));

  // Une oreille et sa colonne : un rond relié à la paroi par deux flancs droits. La colonne du corps
  // est un peu plus fine que l'oreille du couvercle, qui la coiffe.
  function colonne(angle, rayon, y0, y1, arrondi) {
    var contour = [[21, -rayon]];
    for (var k = 0; k <= 12; k++) { var a = -Math.PI / 2 + Math.PI * k / 12; contour.push([C.dVis + rayon * Math.cos(a), rayon * Math.sin(a)]); }
    contour.push([21, rayon]);
    lot.ajouter("noir", F.prisme(tourner(contour, angle), y0, y1, { arrondi: arrondi }), debout(0, c));
  }
  o.vis.forEach(function (degres, i) {
    var a = degres * DEG, p = vers(a, C.dVis);
    colonne(a, C.rOreille, yJ1 - 0.3, C.yOreille, 0.8);
    colonne(a, C.rColonne, C.yColonne, yJ0 + 0.3, 2.4);
    // Chaque vis a son empreinte tournée à sa façon : elles ne se serrent jamais toutes pareil.
    lot.ajouter("inox", F.visCruciforme({ rayon: 4.5, hauteur: 2.9 }), { rx: -Math.PI / 2, ry: (0.5 + i * 1.3) % (Math.PI / 2), x: p[0], y: C.yOreille, z: c + p[1] });
  });

  // Le dessus du couvercle : un moyeu et six rayons entre les alvéoles, un peu en retrait de la jante.
  lot.ajouter("noir", F.tourne([[0, C.yFond - 0.2], [o.rMoyeu, C.yFond - 0.2], [o.rMoyeu, C.yPont, { a: 0.6 }], [0, C.yPont]], { segments: 40 }), debout(0, c));
  for (var k = 0; k < 6; k++) {
    var a = k * 60 * DEG, m = vers(a, (o.rMoyeu + C.rJante) / 2);
    lot.ajouter("noir", F.boite(C.rJante - o.rMoyeu + 2, C.yPont - C.yFond + 0.2, 2.2, 0.5), { ry: a, x: m[0], y: (C.yFond + C.yPont) / 2 - 0.25, z: c + m[1] });
  }

  var t = vers(aTour, C.dTour);
  lot.ajouter("noir", F.tourne([[0, yJ1 - 0.3], [C.rTour, yJ1 - 0.3], [C.rTour, C.yTour, { c: 0.9 }], [0, C.yTour]], { segments: 56 }), debout(t[0], c + t[1]));
  return { x: t[0], z: c + t[1] };
}

// LE PIED : la semelle plate sous le corps, plus longue du côté de la sortie, et son bossage rond sur
// le chant de devant (photo de trois quarts). Sa largeur et sa moitié arrière ne se voient sur aucune
// photo : elles sont estimées, la semelle tenue pour symétrique.
function pied(F, lot, c, sens) {
  var contour = [[-23, 29 * sens, { a: 4 }], [23, 29 * sens, { a: 4 }], [23, -43 * sens, { a: 4 }], [-23, -43 * sens, { a: 4 }]];
  lot.ajouter("noir", F.prisme(contour, C.yPied, C.yPied + 7, { arrondi: 1 }), debout(0, c));
  lot.ajouter("noir", F.cylindre(4, C.yPied, -6.6, { c: 0.8, segments: 24 }), debout(-23, c + 13 * sens));
}

// LA BOBINE 9V À IMPULSION, vissée sur la tour : sa collerette ronde, son corps carré aux coins
// arrondis, sa jupe, ses deux rampes, et le dessus en cuvette où est collée la pastille.
function bobine(F, lot, x, z, o) {
  var y0 = C.yTour + 0.6, yJupe = 68.2, yCuvette = 96.1, yHaut = 97.6, tour = o.sens * DEG;
  lot.ajouter("noir", F.cylindre(12, C.yTour - 0.5, y0 + 0.4, { c: 0, segments: 32 }), debout(x, z));
  lot.ajouter("noir", F.tourne([[0, y0], [21, y0, { a: 1.1 }], [21, y0 + 2.9, { a: 1.1 }], [0, y0 + 2.9]], { segments: 56 }), debout(x, z));
  lot.ajouter("noir", F.prisme(carre(32.4, 5.6), y0 + 2.5, yJupe, { arrondi: 0.8 }), debout(x, z, tour));
  lot.ajouter("noir", F.prisme(carre(31, 5), yJupe - 2, yCuvette, { arrondi: 0.5 }), debout(x, z, tour));
  lot.ajouter("noir", perce(F, carre(31, 5), carre(28, 3.6), yCuvette - 0.6, yHaut, 0.5), debout(x, z, tour));
  // Les deux rampes des faces opposées : affleurantes en haut de la jupe, elles s'épaississent
  // jusqu'à la collerette (les lignes parallèles au flanc de la bobine, sur sa photo de dessus).
  [-90, 90].forEach(function (cote) {
    var a = (o.sens + cote) * DEG, p = vers(a, 16);
    lot.ajouter("noir", F.prisme([[0, y0 + 2.6], [4.2, y0 + 2.6, { a: 0.6 }], [0, yJupe - 0.4]], -9, 9, { arrondi: 0.6 }), { ry: a, x: x + p[0], z: z + p[1] });
  });
  var e = vers((o.sens + 45) * DEG, o.decalage);
  lot.ajouter(o.pastille, F.cylindre(o.rPastille, yCuvette, yCuvette + 0.35, { c: 0.1, segments: 40 }), debout(x + e[0], z + e[1]));
  return { y: yCuvette };
}

// LES DEUX FILS : ils sortent du dessus de la bobine près d'un coin, montent en boucle et reviennent
// se poser à côté. Chaque point est donné depuis la sortie du fil : [écart en travers, hauteur, écart
// vers le haut de la colonne]. La boucle penche vers le haut de la colonne comme sur sa photo de
// dessus, sans dépasser le bout de la vanne : elle ne couvre pas la pièce d'au-dessus.
function fils(F, lot, x, y, z, o) {
  var c = Math.cos(o.sens * DEG), s = Math.sin(o.sens * DEG);
  function boucle(matiere, pied0, points) {
    lot.ajouter(matiere, F.fil(points.map(function (p) {
      var u = pied0[0] + p[0], w = pied0[1] + p[2];
      return [x + u * c + w * s, y + p[1], z - u * s + w * c];
    }), 1.3, { pas: 56, segments: 8 }));
  }
  // La boucle monte à 66 mm du dessus de la bobine (320 px sur la photo de trois quarts), le fil noir
  // juste à l'intérieur du rouge.
  boucle("filRouge", [-10.5, 0.5], [[0, -1.5, 0], [-0.5, 14, -2], [-4.5, 34, -8], [-6, 52, -16], [1.5, 66, -24], [10.5, 58, -21], [13.5, 38, -12], [10, 15, -5], [7, -1.5, -3.5]]);
  boucle("filNoir", [-8.2, 3.2], [[0, -1.5, 0], [-0.3, 14, -2], [-3, 33, -8], [-3.6, 49, -15.5], [1.5, 60, -22], [8, 53, -19], [10, 35, -11], [6.5, 14, -5], [3.2, -1.5, -4]]);
}

// LA VIS DE PURGE : son embase ronde, la tige cannelée qu'on tourne entre deux doigts, et la tête
// carrée avec son empreinte.
function purge(F, lot, x, z, o) {
  var y0 = C.yPont, yTige = y0 + 1.6, yTete = yTige + 10.4, yHaut = yTete + 6, tige = [], n = 18;
  lot.ajouter("noir", F.tourne([[0, o.yPose], [6, o.yPose], [6, yTige, { a: 0.9 }], [0, yTige]], { segments: 32 }), debout(x, z));
  for (var k = 0; k < n; k++) {
    var a = TAU * k / n, d = TAU / n;
    tige.push([4.75 * Math.cos(a - d * 0.2), 4.75 * Math.sin(a - d * 0.2)], [4.75 * Math.cos(a + d * 0.2), 4.75 * Math.sin(a + d * 0.2)]);
    tige.push([4.15 * Math.cos(a + d * 0.4), 4.15 * Math.sin(a + d * 0.4)], [4.15 * Math.cos(a + d * 0.6), 4.15 * Math.sin(a + d * 0.6)]);
  }
  lot.ajouter("noir", F.prisme(tige, yTige - 0.3, yTete + 0.4, { arrondi: 0.25 }), debout(x, z));
  lot.ajouter("noir", F.prisme(carre(10, 2), yTete, yHaut - 2.2, { arrondi: 0.7 }), debout(x, z, o.sens * DEG));
  var b = 0.75, l = 3.1, croix = [[b, -l], [b, -b], [l, -b], [l, b], [b, b], [b, l], [-b, l], [-b, b], [-l, b], [-l, -b], [-b, -b], [-b, -l]];
  lot.ajouter("noir", perce(F, carre(10, 2), o.carree ? carre(4.6, 0.5) : croix, yHaut - 2.6, yHaut, 0.6), debout(x, z, o.sens * DEG));
}

// Une équerre de moulage : une lame triangulaire debout, `base` à plat et `hauteur` contre la paroi.
function equerre(F, base, hauteur, epaisseur) {
  return F.prisme([[0, 0], [base, 0], [0, hauteur]], -epaisseur / 2, epaisseur / 2, { arrondi: 0.35 });
}

// 100 DV 1" MM 9V. Sa photo de dessus : quatre vis (une à gauche, deux à 53 degrés d'elle, une en haut
// à droite), et la tour de la bobine à la place de la cinquième, en bas à droite. Largeur hors tout :
// 83,5 mm ici, 84 sur la fiche.
function electrovanneMM(F) {
  var lot = new F.Lot(), L = 136, c = L / 2;
  boutMale(F, lot, L, false, 16.7);
  boutMale(F, lot, L, true, 17.3);
  var tour = corps(F, lot, c, { vis: [46, 127, 180, 233], tour: -46, rMoyeu: 7.5 });
  pied(F, lot, c, 1);
  var dessus = bobine(F, lot, tour.x, tour.z, { sens: 45, pastille: "rougeBobine", rPastille: 7.7, decalage: 2.4 });
  fils(F, lot, tour.x, dessus.y, tour.z, { sens: 0 });
  var p = vers(140 * DEG, 13.5);
  purge(F, lot, p[0], c + p[1], { yPose: C.yFond, sens: 12 });
  // Le pied de la tour : le conduit qui redescend de la bobine vers la sortie, sur le flanc du tube.
  lot.ajouter("noir", F.cylindre(4.6, -7, C.yJoint - 0.4, { c: 1.2, segments: 24 }), debout(tour.x - 1.5, tour.z + 5));
  // Sur le col de sortie, contre le corps : la patte carrée et ses nervures en éventail (photo de dessus).
  lot.ajouter("noir", F.boite(7.5, 5, 6, 0.8), { y: 18.2, z: c + 30.5 });
  [-11, -5.5, 5.5, 11].forEach(function (x) {
    lot.ajouter("noir", equerre(F, 8, 9.5, 1.5), { ry: -Math.PI / 2, x: x, y: Math.sqrt(17.3 * 17.3 - x * x) - 0.6, z: c + 26.6 });
  });
  // Sur le col d'entrée : deux petites équerres contre le corps.
  [-6, 6].forEach(function (x) {
    lot.ajouter("noir", equerre(F, 5, 6, 1.5), { ry: Math.PI / 2, x: x, y: Math.sqrt(16.7 * 16.7 - x * x) - 0.6, z: c - 26.6 });
  });
  var bout = { genre: "male", gaz: "1", prise: C.filet };
  return { couches: lot.couches(), haut: Object.assign({ z: 0 }, bout), bas: Object.assign({ z: L }, bout) };
}

// 100 DV 1" FF 9V. Sa photo de dessus : cinq vis à 60 degrés l'une de l'autre, la tour de la bobine à
// la place de la sixième, du côté du bout du haut.
function electrovanneFF(F) {
  var lot = new F.Lot(), L = 111, c = L / 2, prise = 17;
  boutFemelle(F, lot, L, false, { rayon: 20.5, prise: prise });
  boutFemelle(F, lot, L, true, { rayon: 20.5, prise: prise });
  var tour = corps(F, lot, c, { vis: [0, 120, 180, 240, 300], tour: 60, rMoyeu: 8.5 });
  pied(F, lot, c, -1);
  var dessus = bobine(F, lot, tour.x, tour.z, { sens: 30, pastille: "jaune", rPastille: 9.8, decalage: 0 });
  fils(F, lot, tour.x, dessus.y, tour.z, { sens: 180 });
  var p = vers(330 * DEG, 17.5);
  purge(F, lot, p[0], c + p[1], { yPose: C.yFond, sens: 45, carree: true });
  lot.ajouter("jaune", F.cylindre(6.6, C.yPont, C.yPont + 0.3, { c: 0.1, segments: 36 }), debout(0, c));
  var bout = { genre: "femelle", gaz: "1", prise: prise };
  return { couches: lot.couches(), haut: Object.assign({ z: 0 }, bout), bas: Object.assign({ z: L }, bout) };
}

export default {
  "electrovanne-100dv": electrovanneMM,
  "electrovanne-100dv-ff": electrovanneFF
};
