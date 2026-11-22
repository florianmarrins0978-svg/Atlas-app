// LA VANNE 3/4" FF à manette rouge (la vanne avec vis de purge) et le RÉGULATEUR DE PRESSION FF 3/4".
// Pièces de colonne, sur l'axe Z local : le bout du haut en z = 0, celui du bas en z = L, et ce qu'on
// voit dans le regard (la manette, la flèche du régulateur) vers +Y.
//
// LA VANNE se relève sur sa photo de profil (appli/arrosage-photos/vanne-purge-dessus.png), le bout de
// la purge à droite. AUCUN filetage ne s'y voit : l'étalon est le six pans de ses bouches, pris à 32 mm
// sur plats (la cote courante d'un bout femelle 3/4" en laiton, ESTIMÉE, la photo ne la dit pas). Le
// six pans de gauche y est tourné de 11 degrés (une arête à 16 pixels au-dessus de l'axe, 156 pixels
// de haut) : 142,7 pixels sur plats, soit 4,46 pixels par millimètre. Tout le reste en découle, et
// l'écrou de la manette le recoupe (59 pixels, soit 13,2 mm : un écrou de 13).
//
// LE RÉGULATEUR se relève sur regulateur-ff34.jpg (debout, le fût en haut). Sa photo ne montre aucun
// filetage non plus : l'étalon est la fiche du fabricant, citée de mémoire et pas relue ici (13,1 cm de
// long, 6,4 cm de large). La photo donne 787 pixels de long pour 380 de large, le même rapport à 1 %
// près : 6 pixels par millimètre. Le fût y fait alors 35 mm, ce qu'il faut autour d'un taraudage 3/4".

var QUART = Math.PI / 2, TOUR = Math.PI * 2;
function doux(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

// UNE BOUCHE TARAUDÉE 3/4" : le chanfrein d'entrée, le filet, puis la suite du dedans (`suite`, des
// points [r, z] qui s'enfoncent). `face` est la cote de la bouche, `sens` vaut 1 quand la pièce est
// du côté des z croissants (la bouche du haut) et -1 pour celle du bas. `rFace` est le rayon où le
// chanfrein rejoint la face. Le dedans se parcourt toujours la matière à gauche, donc en descendant.
function bouche(F, lot, matiere, face, sens, rFace, prise, suite) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, a = face + sens * 1.2, b = face + sens * prise;
  var dedans = [[rFace, face], [fond, a]], fin = [[fond, b]].concat(suite);
  lot.ajouter(matiere, F.tourne(sens > 0 ? dedans.slice().reverse() : dedans, { segments: 32 }));
  lot.ajouter(matiere, F.taraudage({ gaz: "3/4", z0: Math.min(a, b), z1: Math.max(a, b), segments: 24 }));
  lot.ajouter(matiere, F.tourne(sens > 0 ? fin.slice().reverse() : fin, { segments: 24 }));
}

// UN RUBAN PLIÉ : une section de rectangle arrondi (largeur sur X, épaisseur dans le plan du pli) qui
// suit un chemin [[z, y], ...] dans le plan x = 0. C'est la tôle de la manette et sa gaine. Les normales
// sont écrites, pas calculées : au bord d'un plat l'arrondi part tangent, le plat garde donc sa normale
// d'un bord à l'autre et ne se bombe pas à l'éclairage.
// `largeur` est un nombre, ou une fonction du point [z, y] du chemin.
function ruban(F, chemin, largeur, epaisseur, arrondi) {
  var T = F.THREE, coins = 3, tour = 4 * (coins + 1), n = chemin.length, pos = [], nor = [], uv = [], index = [], s = 0;
  function tangente(i) {
    var a = chemin[Math.max(0, i - 1)], b = chemin[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  }
  function anneau(i, normale) {
    var p = chemin[i], t = tangente(i), w = typeof largeur === "function" ? largeur(p) : largeur;
    var demi = w / 2, ep = epaisseur / 2, c = Math.min(arrondi, demi, ep);
    for (var q = 0; q < 4; q++) for (var k = 0; k <= coins; k++) {
      var an = (q + k / coins) * QUART, co = Math.cos(an), si = Math.sin(an);
      var x = (q === 0 || q === 3 ? 1 : -1) * (demi - c) + c * co, h = (q < 2 ? 1 : -1) * (ep - c) + c * si;
      // la normale au pli, dans le plan (z, y), est la tangente tournée d'un quart de tour
      pos.push(x, p[1] - t[0] * h, p[0] + t[1] * h);
      if (normale) nor.push(normale[0], normale[1], normale[2]); else nor.push(co, -t[0] * si, t[1] * si);
      uv.push((q + k / coins) / 4 * 2 * (w + epaisseur) / F.CARREAU, s / F.CARREAU);
    }
  }
  for (var i = 0; i < n; i++) {
    if (i) s += Math.hypot(chemin[i][0] - chemin[i - 1][0], chemin[i][1] - chemin[i - 1][1]);
    anneau(i);
    if (i) for (var j = 0; j < tour; j++) {
      var A = (i - 1) * tour + j, B = (i - 1) * tour + (j + 1) % tour; index.push(A, A + tour, B, B, A + tour, B + tour);
    }
  }
  // Les deux bouts, coupés droit : un anneau de plus, à la normale du bout, et son centre.
  [[0, -1], [n - 1, 1]].forEach(function (bout) {
    var t = tangente(bout[0]), normale = [0, bout[1] * t[1], bout[1] * t[0]], debut = pos.length / 3, p = chemin[bout[0]];
    anneau(bout[0], normale);
    pos.push(0, p[1], p[0]); nor.push(normale[0], normale[1], normale[2]); uv.push(0, 0);
    for (var j = 0; j < tour; j++) {
      var a = debut + j, b = debut + (j + 1) % tour, centre = debut + tour;
      if (bout[1] < 0) index.push(centre, a, b); else index.push(centre, b, a);
    }
  });
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(index);
  return g;
}

// UNE PLAQUE DANS UN PLAN QUI PASSE PAR L'AXE : son contour s'écrit [[r, z], ...], elle a une épaisseur
// et se pose à l'angle `angle` autour de l'axe. Ce sont les nervures moulées du régulateur.
function plaque(F, contour, epaisseur, angle, arrondi) {
  return F.prisme(contour, -epaisseur / 2, epaisseur / 2, { arrondi: arrondi }).rotateX(QUART).rotateZ(angle);
}

// LA MANETTE DE LA VANNE : une tôle d'acier pliée, enfilée sur la tige, et sa gaine rouge.
// Sur la photo de profil (4,46 pixels par millimètre, l'axe de la vanne à y = 256) : la tôle fait
// 2,8 mm (13 pixels), posée à 30,5 mm de l'axe ; elle file à plat jusqu'à 15,4 mm devant la tige,
// monte de 39 degrés (son dessous à 39 mm de l'axe 8 mm devant le bout du haut, à 45,1 mm au droit
// du bout), puis repart à plat, le dessous de la gaine à 48,8 mm de l'axe. Sa patte de
// butée, pliée vers le bas derrière la tige, descend de 9 mm. La gaine fait 5,4 mm d'épaisseur
// (24 pixels) et finit à 103,7 mm de la tige. Les LARGEURS ne se lisent pas de profil : 19 mm à
// l'oeil, 17 au bras, 19 pour la gaine et 8 pour la patte sont estimées sur la vue de trois quarts
// (vanne-purge.jpg), l'écrou de 13 pour étalon.
function manette(F, lot, tige) {
  var pli = { a: 7, fin: 0.2 }, plat = 31.9, haut = 51.5, bout = tige - 103.7 + 9.5;
  var tole = F.adoucir([[tige + 11.6, 22.6], [tige + 11.6, plat, { a: 2, fin: 0.25 }], [tige + 7.4, plat], [tige + 5.6, plat], [tige + 3.8, plat],
    [tige - 3, plat], [tige - 9, plat], [tige - 15.4, plat, pli], [tige - 24, 38.83], [tige - 30, 43.67]]);
  // La patte, puis l'oeil (il s'élargit sur 4 mm), puis le bras, un peu plus étroit, qui s'arrête
  // sous la gaine : plus loin la tôle ne se voit plus. Le pli de la patte reste plus large que la
  // demi-épaisseur de la tôle, sans quoi son dedans se replie sur lui-même.
  lot.ajouter("acier", ruban(F, tole, function (p) { return 8 + 11 * doux((tige + 10.8 - p[0]) / 4) - 2 * doux((tige - 12 - p[0]) / 10); }, 2.8, 0.5));
  // La gaine commence à mi-pente (11 mm devant le bout du haut sur la photo) et finit en demi-rond.
  var gaine = F.adoucir([[tige - 24.5, 39.23], [tige - 39.7, haut, pli], [bout, haut]]);
  lot.ajouter("rouge", ruban(F, gaine, 19, 5.4, 2.4));
  lot.ajouter("rouge", F.tourne([[0, -2.7], [9.5, -2.7, { a: 2.4 }], [9.5, 2.7, { a: 2.4 }], [0, 2.7]], { arc: [0, Math.PI], segments: 20 }), { rx: -QUART, y: haut, z: bout });
}

// LA PURGE DE LA VANNE, sur l'axe Z local (z compté depuis l'axe de la vanne) ; `pose` la couche.
// Elle sort en biais : ses deux photos (le profil et vanne-purge.jpg) la montrent tournée d'une
// cinquantaine de degrés vers le bout du haut, et penchée vers le bas. Le six pans fait 17 mm sur plats
// (79 pixels de haut), le col 9 mm, la clé en T 30,5 mm de long autour d'un dé de 7 mm, ses branches
// 5,6 mm de diamètre ; le dé est à 11,7 mm du milieu du six pans (9,9 mm sur la photo, vus de biais).
// Le bossage moulé (19 mm) est estimé.
function purge(F, lot, pose) {
  lot.ajouter("nickel", F.tourne([[9.5, 6], [9.5, 25.5, { a: 0.8 }], [5, 25.5]], { segments: 28 }), pose);
  lot.ajouter("nickel", F.hexagone({ surPlats: 17, z0: 25.3, z1: 29.3 }), pose);
  lot.ajouter("nickel", F.tourne([[7.4, 29.1], [7.4, 30.2, { a: 0.9 }], [4.6, 31.8, { a: 0.5 }], [4.6, 35.2, { c: 0.4 }], [0, 35.2]], { segments: 24 }), pose);
  lot.ajouter("acier", F.cylindre(3, 34.8, 36.5, { segments: 16, c: 0.2 }), pose);
  lot.ajouter("acier", F.placer(F.boite(7, 7, 7, 0.9), { z: 39 }), pose);
  lot.ajouter("acier", F.placer(F.tourne([[0, -15.2], [2.8, -15.2, { a: 1.1 }], [2.8, 15.2, { a: 1.1 }], [0, 15.2]], { segments: 16 }), { rx: -QUART, z: 39 }), pose);
}

export default {
  // VANNE AVEC VIS DE PURGE 3/4" : un robinet à boisseau sphérique en laiton nickelé.
  "vanne-purge": function (F) {
    // 324 pixels de long, soit 72,6 mm. Le six pans du haut (côté purge) fait 14,8 mm, celui du bas 16,1.
    var lot = new F.Lot(), L = 72.5, PANS = 32, HAUT = 14.8, BAS = 16.1, PRISE = 13, TIGE = 36, DEBOUT = { rx: -QUART, z: TIGE };
    // Les deux six pans ne sont pas alignés sur la photo (le bout du bas est vissé dans le corps) :
    // 4 degrés pour celui du haut (33,2 mm de haut vus de profil), 11 pour celui du bas (35 mm).
    lot.ajouter("nickel", F.hexagone({ surPlats: PANS, z0: 0, z1: HAUT, alesage: 14 }), { rz: 4 * Math.PI / 180 });
    lot.ajouter("nickel", F.hexagone({ surPlats: PANS, z0: L - BAS, z1: L, alesage: 14 }), { rz: 11 * Math.PI / 180 });
    // Le corps, du six pans du haut à celui du bas : un col de 31 mm, l'épaule, le fût de 35,8 mm qui
    // s'évase à 38,8, une gorge, puis la bague de 39 mm (5,6 mm de long) où se visse le bout rapporté.
    lot.ajouter("nickel", F.tourne([[15.5, HAUT - 0.2], [15.5, 23.2, { a: 1.5 }], [17.9, 26.8, { a: 2.5 }], [17.9, 35, { a: 6 }], [19.4, 43, { a: 6 }], [19.4, 50.4, { a: 0.4 }],
      [18.8, 50.9], [19.5, 51.4, { a: 0.4 }], [19.5, L - BAS - 0.5, { a: 0.8 }], [15.5, L - BAS + 0.3]], { segments: 44 }));
    // Le dedans se voit en laiton nu, comme sur ses photos : le filet est taillé après le nickelage.
    // Le passage fait 20 mm (DN 20), d'un bout à l'autre : la vanne est ouverte.
    bouche(F, lot, "laiton", 0, 1, 14, PRISE, [[10, HAUT, { a: 0.3 }], [10, TIGE]]);
    bouche(F, lot, "laiton", L, -1, 14, PRISE, [[10, L - HAUT, { a: 0.3 }], [10, TIGE]]);
    // Le bossage de la tige : 17,5 mm de diamètre, son dessus à 27,8 mm de l'axe, un congé à son pied.
    lot.ajouter("nickel", F.tourne([[14, 12], [8.75, 21, { a: 4 }], [8.75, 27.8, { c: 0.5 }], [6, 27.8]], { segments: 32 }), DEBOUT);
    // La butée de la manette, un dé de 4,6 mm sur le flanc du bossage, à 22,9 mm de l'axe.
    lot.ajouter("nickel", F.boite(2.4, 4.6, 4.6, 0.6), { x: 9.3, y: 22.9, z: TIGE });
    // Le presse-étoupe en laiton (15 mm de large, 3 mm visibles), la tôle, l'écrou de 13 (6 mm) et le
    // bout de la tige, en laiton, qui dépasse de 2,3 mm.
    var pans = [0, 1, 2, 3, 4, 5].map(function (k) { return [8.08 * Math.cos(k * Math.PI / 3), 8.08 * Math.sin(k * Math.PI / 3)]; });
    lot.ajouter("laiton", F.prisme(pans, 27.3, 30.5, { arrondi: 0.4 }), DEBOUT);
    lot.ajouter("acier", F.hexagone({ surPlats: 13, z0: 33.3, z1: 39.3 }), DEBOUT);
    lot.ajouter("laiton", F.cylindre(3.9, 38.5, 41.6, { c: 0.7, segments: 24 }), DEBOUT);
    manette(F, lot, TIGE);
    // La purge regarde +X (le côté où la photo de profil est prise, la tige en haut), tournée de
    // 50 degrés vers le bout du haut et penchée de 18 degrés vers le bas : son six pans se retrouve
    // à 16 mm du bout et 7 mm sous l'axe, sa clé à 7 mm du bout et 10,5 mm sous l'axe, comme de profil.
    purge(F, lot, { rx: 18 * Math.PI / 180, ry: QUART + 50 * Math.PI / 180, y: 1.5, z: 36 });
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE }, bas: { z: L, genre: "femelle", gaz: "3/4", prise: PRISE } };
  },

  // RÉGULATEUR DE PRESSION FF 3/4", noir. LE SENS DE L'EAU : la flèche moulée sur sa couronne pointe
  // vers le fût. L'eau entre donc par le corps cannelé, qui est posé en haut (z = 0, côté rangée), et
  // sort par le fût (z = L, côté tuyau).
  "regulateur-ff34": function (F) {
    var lot = new F.Lot(), L = 131, PRISE = 14, NERVURES = 12, PAS = TOUR / NERVURES;
    // Le dehors, du corps au fût (cotes de la photo, z = 131 moins la cote lue depuis le haut du fût) :
    // le corps cannelé de 61,5 mm, dont le noyau se resserre dans sa moitié basse (là où ses nervures
    // ressortent) ; un collet ; la couronne de 59,6 mm, sa bride de 63,4 mm, son épaule en chanfrein ;
    // le dessus du capot, à 90 mm ; le fût de 35 mm.
    lot.ajouter("noir", F.tourne([[14, 0], [18.4, 0], [19.3, 0.9], [20.2, 28.5, { a: 6 }], [22.6, 34, { a: 6 }], [23.7, 61.5, { a: 0.4 }], [24.6, 61.5, { a: 0.4 }], [24.6, 63.7, { a: 0.3 }],
      [29.8, 63.7, { a: 0.8 }], [29.8, 74.2], [31.7, 74.2, { a: 0.4 }], [31.7, 76, { a: 0.4 }], [29.8, 76], [29.8, 86.2, { a: 0.8 }], [26.5, 89.7, { a: 0.8 }],
      [17.5, 89.7, { a: 1.2 }], [17.5, L, { a: 1.2 }], [14, L]], { segments: 44 }));
    bouche(F, lot, "noir", 0, 1, 14, PRISE, [[12.3, 24]]);
    bouche(F, lot, "noir", L, -1, 14, PRISE, [[12.3, L - 24]]);
    // Le dedans ne se voit sur aucune photo : un fond sombre derrière chaque taraudage.
    lot.ajouter("creux", F.tourne([[0, 24], [12.3, 24]], { segments: 24 }));
    lot.ajouter("creux", F.tourne([[12.3, L - 24], [0, L - 24]], { segments: 24 }));
    for (var i = 0; i < NERVURES; i++) {
      // Les douze cannelures du corps (comptées à 30 degrés l'une de l'autre) : 4,2 mm de large, de
      // 43,6 mm de diamètre en bas à 48,6 en haut.
      lot.ajouter("noir", plaque(F, [[17, 0.6], [21.8, 0.6], [24.3, 61.3], [17, 61.3]], 4.2, i * PAS, 0.9));
      // Les douze nervures de la couronne : une barre de 3,6 mm sur son flanc, qui monte au-dessus du
      // capot en gousset jusqu'au fût. Deux d'entre elles, face à face, sont des oreilles plus hautes
      // (14,8 mm au-dessus du capot contre 7,6) : la photo les montre de part et d'autre du fût.
      var oreille = i % (NERVURES / 2) === 0, sommet = oreille ? 104.5 : 97.3;
      lot.ajouter("noir", plaque(F, [[16.5, 86], [28.6, 86], [28.6, 64.3], [30.8, 64.3, { a: 0.5 }], [30.8, sommet, { a: oreille ? 7 : 3, fin: 0.45 }], [16.5, sommet + (oreille ? 0.6 : 0)]], 3.6, i * PAS, 0.8));
    }
    // La flèche du sens de l'eau, en relief sur la couronne entre deux nervures : sa tige sous la
    // bride, sa pointe au-dessus, tournée vers le fût. Elle regarde vers le haut du regard.
    var versLeHaut = { rx: QUART, rz: 75 * Math.PI / 180 + QUART };
    lot.ajouter("noir", F.prisme([[-1.7, 65.5], [1.7, 65.5], [1.7, 73.9], [-1.7, 73.9]], 29.2, 30.9, { arrondi: 0.3 }), versLeHaut);
    lot.ajouter("noir", F.prisme([[-4.2, 76.4], [4.2, 76.4], [0, 82.5]], 29.2, 30.9, { arrondi: 0.3 }), versLeHaut);
    // Ses deux étiquettes jaunes, sans texte : 21 mm de haut, collées sur le fût à 3 mm de son bout.
    [[114, 212], [-44, 54]].forEach(function (arc) {
      lot.ajouter("jaune", F.tourne([[17.62, 107], [17.62, 128]], { arc: [arc[0] * Math.PI / 180, arc[1] * Math.PI / 180], segments: 14 }));
    });
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE }, bas: { z: L, genre: "femelle", gaz: "3/4", prise: PRISE } };
  }
};
