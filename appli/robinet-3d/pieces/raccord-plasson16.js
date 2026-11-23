// LE RACCORD TARAUDÉ À COMPRESSION PLASSON 16 x 3/4", POUR LE Ø16 RIGIDE (au catalogue sans référence,
// sa règle du 18 octobre 2026), tout noir : la tête femelle 3/4" en haut, la cage à quatre barreaux, la
// collerette, le col qui entre dans l'écrou, l'écrou de serrage à neuf pans nervurés, et la queue
// conique où entre le tube Ø16. Pièce de colonne, sur l'axe Z local : la face de la tête en z = 0, la
// face du bout de la queue en z = L.
//
// C'est la même famille que le raccord femelle 25 x 3/4" (raccord-femelle.js) : la bouche taraudée, le
// dedans (le joint, la butée, le passage) et la bouche du tube en sont repris, à l'échelle du Ø16.
//
// D'OÙ VIENNENT LES COTES. Sa photo (docs/robinet-3d-photos/plasson-16-rigide-taraude.jpg, 1024 x 1024,
// de face, debout), prise d'un peu au-dessus : on voit dans la bouche du haut. L'axe est la colonne
// 512,5. L'étalon est la bouche taraudée : le bord intérieur de sa face fait 206 pixels de large (de 200
// à 212 selon la rangée où on le lit), pour 25,8 mm (le sommet du filet femelle, 24,1 mm, ouvert par le
// chanfrein d'entrée presque jusqu'au fond du filet, 26,4 mm) : 8,0 pixels par millimètre. Le tube le
// recoupe : sur la seconde photo (appli/arrosage-robinet-photos/plasson-16-rigide-debout.png, prise d'un
// peu en dessous), le trou du bout de la queue fait 0,75 fois la queue, soit 16,9 mm à cette échelle :
// le tube de 16 et son chanfrein d'entrée. Les rayons se lisent sur la largeur de la silhouette ; les
// hauteurs aussi, sur ses bords, jamais devant : vue de 7 degrés au-dessus en haut et de 9 à 10 en bas,
// une arête ronde de devant y descend de 15 à 23 pixels plus bas que sur les côtés. Le centre de la face
// du haut est à la rangée 250 (entre son bord de derrière, rangée 233, et celui de devant, rangée 268), et
// une hauteur se lit z = (rangée - 250) / 7,93. Les cotes sont tenues à 5 % près, pas mieux.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : la profondeur du taraudage (15,5 mm) et le joint plat
// où bute le mâle, le passage de l'eau, tout le dedans de l'écrou (la lèvre, la bague de crampage, le
// joint, la butée du tube), la profondeur où le tube entre (36 mm), la profondeur des pans de l'écrou, et
// le dos de la pièce, tenu pareil au devant.
//
// LES SURFACES QUI SE REJOIGNENT ont au moins 96 segments : entre deux cercles de même rayon tracés à 96
// et à 216 côtés, la fente ne dépasse pas 0,007 mm, quand 48 contre 32 en laissaient 0,06 (on voyait le
// fond de la scène par là sur le raccord femelle 25).

// La face du bout de la queue : rangée 815 (son bord rond de devant descend jusqu'à 827).
var L = 71.2;
var PRISE = 15.5;       // la profondeur taraudée, où bute le mâle : estimée
var PRISE_TUYAU = 36;   // la profondeur où le tube bute : estimée
var TUYAU = 8.1;        // la bouche du bas : le tube Ø16, et un dixième de millimètre de jeu
var PASSAGE = 6.0;      // le passage de l'eau, plus étroit que le dedans du tube (6,6) : son bout y bute
var TOUR = 96;          // les segments de ce qui se rejoint : la tête, le taraudage, la queue, les joints

// LA TÊTE FEMELLE.
var BOUCHE = 12.9;      // le bord intérieur de la face : 206 pixels de large (l'étalon)
// Le fût de la tête : 273 pixels du haut (rangées 254 à 278) au bas (rangées 306 à 412, 274 au plus), son
// bord du haut arrondi (la silhouette n'atteint sa largeur qu'à la rangée 254), son bord du bas aussi (de
// 270 pixels à la rangée 416 à 260 à la rangée 422).
var TETE = { r: 17.1, bas: 21.6, arrondi: 1.2 };
// La gorge qui fait le tour sous la face : la silhouette rentre de 4 à 5 pixels de chaque côté, au plus
// creux à la rangée 283 (0,55 mm sous le fût), et ses deux bords arrondis courent des rangées 279 à 288
// (1,4 mm). Vue de devant, c'est le trait sombre puis clair des rangées 296 à 303. Posée d'abord en V de
// 1,1 mm aux arêtes presque vives, elle faisait sur le rendu un trait fin, moitié moins creux et moins large
// que sur la photo : ses bords et son fond sont arrondis, comme ceux d'une gorge moulée.
var GORGE = { z: 4.45, demi: 0.7, r: 16.45, bord: 0.3, fond: 0.35 };
// LA CAGE, sous la tête : le noyau qu'on voit entre les barreaux (180 pixels de large) ; quatre barreaux à
// angle droit, de 2,75 mm (celui de devant : sa face fait 22 pixels, de la colonne 526 à 547, ses deux
// arêtes rondes éclairées ; son flanc gauche, tourné de 10 degrés, se perd dans le noir du noyau. Lue
// d'abord à 20 pixels, sans ses arêtes, elle était un dixième trop étroite), qui vont jusqu'à 258 pixels
// de large sur la silhouette (un barreau de côté y montre son coin, tourné de 10 degrés : son dos est à
// 16,25 mm) ; celui de devant est à 24 pixels à droite de l'axe, soit 10 degrés : la pièce est un peu
// tournée sur la photo, et elle l'est pareil ici.
var NOYAU = 11.0;
var BARREAUX = { nombre: 4, depart: 80, epaisseur: 2.75, r: 16.25 };
// La collerette qui porte les barreaux : 264 pixels (rangées 468 à 484), du dessus éclairé (rangée 465) au
// bord rond du dessous (rangée 492). Ce bord rentre tôt et large : la silhouette quitte son rayon dès la
// rangée 484 et n'en garde que 15 mm à la rangée 492. Arrondi de 1,3 mm, le rendu vu du même point que la
// photo y était trop large de 0,3 mm à la rangée 486 et de 0,8 à 1 mm à la rangée 492 ; de 1,7 mm, de
// 0,1 mm puis de 0,5 mm. Le reste de l'écart vient du jour sous la collerette, moins creux que sur la photo.
var COLLERETTE = { r: 16.5, haut: 27.1, bas: 30.5, arrondi: 1.7 };

// L'ÉCROU DE SERRAGE.
// Sa face du haut : la silhouette de son bord rond (rangées 500 à 516) se lit comme le derrière d'une
// ellipse posée à la rangée 509 ; le jour entre lui et la collerette fait 2,7 mm (de 2,3 à 3 sur la photo
// prise d'en dessous) : moins, la silhouette ne rentrait pas jusqu'aux 13,7 mm qu'elle a à la rangée 496.
// Sur la face, un lamage où descend le col (son bord à 237 pixels de large) : sa profondeur est estimée.
// La silhouette du flanc fait 295 pixels en haut (rangées 514 à 548) et 286 en bas (rangée 690) : la
// dépouille du moule. Elle quitte sa verticale à la rangée 698 pour une épaule qui rentre vers la queue
// (17,2 mm à la rangée 702, 15,4 à la rangée 712, 14,4 à la rangée 720, 13,4 à la rangée 724) : un cône
// de 56 degrés, au coin du haut bien arrondi. Un dessous plat, essayé ensuite, rentrait trop tard ou
// trop bas (jusqu'à 2,4 mm d'écart sur la silhouette) ; le cône la tient à 0,3 mm près.
var ECROU = { haut: 33.2, r0: 18.45, r1: 17.85, fin: 55.9, arrondi: 0.8, lamage: 14.8, fond: 34.1, trou: 11.35 };
var EPAULE = { z: 56.95, arrondi: 2.0, pied: 13.27 };
// LES PANS : neuf, à 40 degrés l'un de l'autre, séparés par des nervures de 2,4 mm (celle de devant, de
// la colonne 483 à 503). Les nervures se lisent à 20 pixels à gauche de l'axe (celle de devant), 80 à
// droite, 136 à droite et 140 à gauche (sur les bords) : neuf à 40 degrés les placent à 1 et 3 pixels
// près, huit ou dix à 8 et 12 pixels. La première est à 7,5 degrés à gauche du devant. Chaque pan est un
// plat : le pan de devant a la même teinte d'un bord à l'autre, ce que n'aurait pas un morceau de
// cylindre. Le flanc d'une nervure, vu de biais, fait une bande sombre de 10 pixels sur le bord gauche (la
// nervure à 87,5 degrés) et de 6 pixels à 32,5 degrés : la marche au pied d'une nervure fait 1,35 mm, à
// 20 % près. Le haut des pans (rangée 567 devant, 546 sur les côtés) est droit, ses coins un peu ronds ;
// leur bas, c'est l'épaule qui le coupe (rangée 731 devant, à 58 mm : où le plat du pan sort du cône).
var PANS = { nombre: 9, depart: -7.5, nervure: 1.2, marche: 1.35, haut: 37.3, fin: 0.8, casse: 0.3, conge: 0.35 };
// LA QUEUE, conique, sous l'épaule : 197 pixels de large à la rangée 742 (62 mm), 179 à la
// rangée 790 (68,1 mm), mesurés sur le bord gauche (l'ombre portée mange le droit). Son bord du bas est
// bien rond (une douzaine de pixels de côté). Sur la photo elle est d'un noir plus mat que l'écrou, sans
// un reflet : elle prend le noir au grain plus marqué.
var QUEUE = { haut: 60.0, r0: 12.75, pente: 0.175, arrondi: 1.6 };

var QUART = Math.PI / 2, TOUR_COMPLET = Math.PI * 2, RAD = Math.PI / 180;
var RREF = 18.1;        // le rayon où se comptent les largeurs des nervures et des pans

// UNE PLAQUE DANS UN PLAN QUI PASSE PAR L'AXE, comme les ailettes du raccord femelle 25 : son contour
// s'écrit [[r, z], ...] et elle se pose à l'angle `angle` autour de l'axe (0 : vers +X, un quart de tour :
// vers +Y, le devant).
function plaque(F, contour, epaisseur, angle, arrondi) {
  return F.prisme(contour, -epaisseur / 2, epaisseur / 2, { arrondi: arrondi }).rotateX(QUART).rotateZ(angle);
}

// LE CORPS, d'un seul profil tourné : la bouche, la face du haut (deux cercles posés sur le plan z = 0,
// que la scène mesure), son bord arrondi, la gorge, le fût de la tête, son dessous, le noyau de la cage,
// la collerette, puis le col qui descend dans l'écrou (son bout y est caché). Le taraudage suit, au même
// nombre de segments que la bouche.
function corps(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, G = GORGE;
  lot.ajouter("noirLisse", F.tourne([
    [fond, 1.3], [BOUCHE, 0, { c: 0.15 }], [TETE.r, 0, { a: TETE.arrondi, fin: 0.3 }],
    [TETE.r, G.z - G.demi, { a: G.bord, fin: 0.4 }], [G.r, G.z, { a: G.fond, fin: 0.3 }], [TETE.r, G.z + G.demi, { a: G.bord, fin: 0.4 }],
    [TETE.r, TETE.bas, { a: 0.7, fin: 0.3 }], [NOYAU, TETE.bas, { a: 0.4, fin: 0.4 }],
    [NOYAU, COLLERETTE.haut, { a: 0.4, fin: 0.4 }], [COLLERETTE.r, COLLERETTE.haut, { a: 0.4, fin: 0.4 }],
    [COLLERETTE.r, COLLERETTE.bas, { a: COLLERETTE.arrondi, fin: 0.25 }], [NOYAU, COLLERETTE.bas, { a: 0.4, fin: 0.4 }],
    [NOYAU, ECROU.fond + 1.6]], { segments: TOUR }));
  lot.ajouter("noirLisse", F.taraudage({ gaz: "3/4", z0: 1.3, z1: PRISE, segments: TOUR }));
  // Le joint plat où bute le mâle, au fond du taraudage, posé sur le fond de la tête : on le voit en
  // regardant dans la bouche. Estimé, comme celui de l'écrou du Solem.
  lot.ajouter("joint", F.tourne([[6.3, PRISE + 1.4], [6.3, PRISE + 0.2, { c: 0.2 }], [12.0, PRISE + 0.2, { c: 0.2 }], [12.0, PRISE + 1.4]], { segments: TOUR }));
  // Le fond de la tête, puis le passage, jusqu'à la butée du tube et la marche qui la relie au joint de
  // l'écrou (au rayon du joint, pour ne pas laisser de fente).
  var butee = L - PRISE_TUYAU - 0.2;
  lot.ajouter("noirLisse", F.tourne([[8.05, L - 16], [TUYAU, L - 16.1], [TUYAU, butee, { a: 0.3 }], [PASSAGE, butee, { c: 0.3 }],
    [PASSAGE, PRISE + 1.4, { a: 0.5 }], [fond, PRISE + 1.4], [fond, PRISE]], { segments: TOUR }));
  // Le fond du passage, vu de chaque bouche : un noir qui ne renvoie rien. Son bord entre de 0,3 mm dans
  // la paroi, sans quoi le jour passait entre ses côtés et ceux du passage.
  lot.ajouter("creux", F.tourne([[0, 26], [PASSAGE + 0.3, 26]], { segments: 32 }));
  lot.ajouter("creux", F.tourne([[PASSAGE + 0.3, 26.05], [0, 26.05]], { segments: 32 }));
}

// LES BARREAUX DE LA CAGE : quatre plaques, du noyau jusqu'à la silhouette, dont les deux bouts sont
// noyés dans le dessous de la tête et dans la collerette.
function barreaux(F, lot) {
  var B = BARREAUX, contour = [[NOYAU - 0.4, TETE.bas - 0.3], [B.r, TETE.bas - 0.3], [B.r, COLLERETTE.haut + 0.3], [NOYAU - 0.4, COLLERETTE.haut + 0.3]];
  for (var i = 0; i < B.nombre; i++) {
    lot.ajouter("noirLisse", plaque(F, contour, B.epaisseur, (B.depart + i * 360 / B.nombre) * RAD, 0.3));
  }
}

// LE FLANC DE L'ÉCROU, en dépouille : le rayon des nervures à la hauteur z.
function flanc(z) { return ECROU.r0 + (ECROU.r1 - ECROU.r0) * (z - ECROU.haut) / (ECROU.fin - ECROU.haut); }

// LES COLONNES DE LA PEAU DE L'ÉCROU : les angles où il faut un sommet, pour chaque nervure et chaque pan.
// Chacune dit de quel côté du flanc d'une nervure elle tombe, à quelle distance de lui (en mm, le long de
// la peau), et son angle compté depuis le milieu de son pan. Le flanc d'une nervure est fait de deux
// colonnes presque confondues : une marche droite, sans la pente qu'aurait un pas d'angle régulier.
// Un angle se compte depuis le devant (+Y), vers la droite (+X), comme sur la photo.
function colonnes() {
  var P = PANS, pas = TOUR_COMPLET / P.nombre, demi = pas / 2 * RREF, w = P.nervure, e = 0.004, liste = [];
  var surNervure = [0.55, 0.9, 1.08, w - e], surPan = [w + e, w + 0.12, w + 0.35, w + 1.3, w + 2.3, w + 3.3, w + 4.2];
  function poser(s, cote, d) { liste.push({ s: s, cote: cote, d: d }); }
  poser(0, "nervure", w);
  surNervure.forEach(function (s) { poser(s, "nervure", Math.max(0, w - s)); });
  surPan.forEach(function (s) { poser(s, "pan", s - w); });
  poser(demi, "pan", demi - w);
  surPan.slice().reverse().forEach(function (s) { poser(2 * demi - s, "pan", s - w); });
  surNervure.slice().reverse().forEach(function (s) { poser(2 * demi - s, "nervure", Math.max(0, w - s)); });
  var toutes = [];
  for (var k = 0; k < P.nombre; k++) {
    liste.forEach(function (c) {
      toutes.push({ th: (P.depart * RAD) + k * pas + c.s / RREF, cote: c.cote, d: c.d, decal: (c.s - demi) / RREF });
    });
  }
  return toutes;
}

// LE PLAT D'UN PAN, à la hauteur z : sa distance à l'axe, telle que la marche au pied des nervures fasse
// PANS.marche. ALPHA est le demi angle d'un pan, compté depuis son milieu jusqu'au pied d'une nervure.
var ALPHA = Math.PI / PANS.nombre - PANS.nervure / RREF;
function plat(z) { return (flanc(z) - PANS.marche) * Math.cos(ALPHA); }

// LE RAYON DE LA PEAU en une colonne, à un rang du méridien (r0, z) : le tour, rogné par le plat du pan.
// Sous le haut des pans, le plat naît en quart d'ellipse (de 0 à toute sa profondeur sur PANS.fin) : un
// haut de pan droit, aux coins un peu ronds. En bas, l'épaule, plus étroite que lui, le coupe d'elle-même.
// Le haut du flanc d'une nervure est cassé (PANS.casse), son pied a un congé (PANS.conge), tous deux
// réduits à la moitié de la marche là où elle est plus basse.
function rayonDeLaPeau(r0, z, c) {
  var P = PANS, alpha = ALPHA, Rf = flanc(z), u = z - P.haut;
  if (u <= 0) return r0;
  var a = plat(z);
  if (u < P.fin) { var t = 1 - u / P.fin; a += (Rf - a) * (1 - Math.sqrt(1 - t * t)); }
  var h = r0 - a / Math.cos(alpha);
  if (c.cote === "nervure") {
    if (h <= 0) return r0;
    var rho = Math.min(P.casse, h / 2);
    return c.d < rho ? r0 - (rho - Math.sqrt(rho * rho - (rho - c.d) * (rho - c.d))) : r0;
  }
  var f = Math.min(P.conge, Math.max(0, h / 2)), leve = c.d < f ? f - Math.sqrt(f * f - (f - c.d) * (f - c.d)) : 0;
  return Math.min(r0, a / Math.cos(c.decal) + leve);
}

// LE MÉRIDIEN DE L'ÉCROU, du bord du lamage au pied de la queue : la face du haut, son bord rond, le
// flanc, le coin arrondi de l'épaule, son cône, et le petit palier où commence la queue. Des rangs y sont
// ajoutés, serrés, là où les pans naissent. Le cône, lui, n'a ici que ses deux bouts : ses rangs se
// posent colonne par colonne (peauDeLEcrou), là où l'épaule coupe chaque pan.
function meridien(F) {
  var E = ECROU, P = PANS, rangs = F.adoucir([[E.lamage + 0.15, E.haut], [E.r0, E.haut, { a: E.arrondi, fin: 0.25 }],
    [flanc(EPAULE.z), EPAULE.z, { a: EPAULE.arrondi, fin: 0.12 }], [EPAULE.pied, QUEUE.haut, { a: 0.6, fin: 0.3 }], [QUEUE.r0 + 0.25, QUEUE.haut]]);
  var serres = [0, 0.04, 0.12, 0.25, 0.42, 0.62, P.fin];
  var ajouts = serres.map(function (u) { return P.haut + u; });
  ajouts.forEach(function (z) {
    for (var i = 0; i + 1 < rangs.length; i++) {
      var a = rangs[i], b = rangs[i + 1];
      if (a[1] < z - 1e-6 && b[1] > z + 1e-6) { var t = (z - a[1]) / (b[1] - a[1]); rangs.splice(i + 1, 0, [a[0] + (b[0] - a[0]) * t, z]); return; }
    }
  });
  return rangs;
}

// OÙ L'ÉPAULE COUPE UNE COLONNE : la part t du cône (de son bout du haut, en t = 0, à son bout du bas)
// où le cône passe sous le plat du pan. Une nervure prend celle du bord de son pan, où sa marche s'annule.
function coupe(haut, bas, c) {
  var vu = c.cote === "pan" ? c.decal : ALPHA, t0 = 0, t1 = 1;
  function dehors(t) { var z = haut[1] + (bas[1] - haut[1]) * t; return haut[0] + (bas[0] - haut[0]) * t > plat(z) / Math.cos(vu); }
  if (!dehors(0) || dehors(1)) throw new Error("Le plat d'un pan ne coupe pas le cône de l'épaule");
  for (var k = 0; k < 40; k++) { var t = (t0 + t1) / 2; if (dehors(t)) t0 = t; else t1 = t; }
  return (t0 + t1) / 2;
}

// LA PEAU DE L'ÉCROU : un tour dont chaque colonne est rognée par son pan. Ses arêtes vives (le flanc
// des nervures, le haut des pans) restent vives, le reste se lisse : c'est ce que fait un prisme.
// SUR LE CÔNE DE L'ÉPAULE, chaque colonne a ses rangs à elle, et l'un tombe juste où le cône coupe son
// pan : le bas d'un pan suit alors une ligne du maillage. Des rangs communs à toutes les colonnes (un tous
// les 0,3 mm, d'abord) laissaient ce bas traverser les quadrilatères en biais, et chacun pliait de
// travers : vu d'en dessous, le bas des pans faisait une dent de scie.
function peauDeLEcrou(F, lot) {
  var T = F.THREE, M = meridien(F), cols = colonnes(), nc = cols.length, AU_DESSUS = 4, AU_DESSOUS = 3;
  // Le cône : le plus long côté du méridien sous le haut de l'épaule (entre ses deux arrondis).
  var ic = -1;
  for (var i = 0; i + 1 < M.length; i++) {
    if (M[i][1] < EPAULE.z) continue;
    if (ic < 0 || Math.hypot(M[i + 1][0] - M[i][0], M[i + 1][1] - M[i][1]) > Math.hypot(M[ic + 1][0] - M[ic][0], M[ic + 1][1] - M[ic][1])) ic = i;
  }
  var haut = M[ic], bas = M[ic + 1], coupes = cols.map(function (c) { return coupe(haut, bas, c); }), rangs = [];
  M.forEach(function (p, i) {
    if (i === ic) { for (var k = 0; k <= AU_DESSUS + AU_DESSOUS; k++) rangs.push({ k: k }); } else if (i !== ic + 1) rangs.push({ p: p });
  });
  var nr = rangs.length, pos = new Float32Array(nr * (nc + 1) * 3), index = [];
  for (i = 0; i < nr; i++) for (var j = 0; j <= nc; j++) {
    var c = cols[j % nc], p = rangs[i].p;
    if (!p) {
      var tc = coupes[j % nc], k = rangs[i].k, t = k <= AU_DESSUS ? tc * k / AU_DESSUS : tc + (1 - tc) * (k - AU_DESSUS) / AU_DESSOUS;
      p = [haut[0] + (bas[0] - haut[0]) * t, haut[1] + (bas[1] - haut[1]) * t];
    }
    var r = rayonDeLaPeau(p[0], p[1], c), w = (i * (nc + 1) + j) * 3;
    pos[w] = r * Math.sin(c.th); pos[w + 1] = r * Math.cos(c.th); pos[w + 2] = p[1];
  }
  for (i = 0; i + 1 < nr; i++) for (j = 0; j < nc; j++) {
    var A = i * (nc + 1) + j, B = A + 1, C = A + nc + 1, D = C + 1;
    index.push(A, C, B, B, C, D);
  }
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  g.setIndex(index);
  g = F.toCreasedNormals(g, 0.62);
  lot.ajouter("noirLisse", F.uvCube(g));
}

// UN COIN ROND ÉCRIT POINT PAR POINT : l'arc de `rayon` tangent aux deux côtés du coin. Un arrondi
// demandé au profil est rogné à la moitié du côté le plus court ; ici la face du bout ne fait que 2,4 mm,
// et le bord du bas de la queue, bien rond sur la photo, n'en aurait gardé que 1,4 mm de rayon.
function coinRond(avant, coin, apres, rayon, n) {
  var ux = avant[0] - coin[0], uz = avant[1] - coin[1], lu = Math.hypot(ux, uz), vx = apres[0] - coin[0], vz = apres[1] - coin[1], lv = Math.hypot(vx, vz);
  ux /= lu; uz /= lu; vx /= lv; vz /= lv;
  var angle = Math.acos(ux * vx + uz * vz), t = rayon / Math.tan(angle / 2), d = rayon / Math.sin(angle / 2);
  var bx = ux + vx, bz = uz + vz, lb = Math.hypot(bx, bz), cx = coin[0] + bx / lb * d, cz = coin[1] + bz / lb * d;
  var a0 = Math.atan2(coin[1] + uz * t - cz, coin[0] + ux * t - cx), a1 = Math.atan2(coin[1] + vz * t - cz, coin[0] + vx * t - cx), da = a1 - a0, pts = [];
  while (da > Math.PI) da -= TOUR_COMPLET; while (da < -Math.PI) da += TOUR_COMPLET;
  for (var k = 0; k <= n; k++) pts.push([cx + Math.cos(a0 + da * k / n) * rayon, cz + Math.sin(a0 + da * k / n) * rayon]);
  return pts;
}

// LE RESTE DE L'ÉCROU, tourné : le lamage de la face du haut et le trou où descend le col (le jour entre
// les deux est fermé par un fond noir) ; la queue, son bord rond, la face du bout (deux cercles posés sur
// le plan z = L, que la scène mesure), la bouche du tube, sa lèvre, la gorge de la bague de crampage, et
// le joint, au rayon de la bague qu'il prolonge.
function ecrou(F, lot) {
  var E = ECROU, Q = QUEUE, rBas = Q.r0 - Q.pente * (L - Q.haut);
  peauDeLEcrou(F, lot);
  lot.ajouter("noirLisse", F.tourne([[E.trou, E.fond + 1.6], [E.trou, E.fond, { a: 0.2, fin: 0.4 }], [E.lamage - 0.2, E.fond, { a: 0.25, fin: 0.4 }],
    [E.lamage, E.haut + 0.15], [E.lamage + 0.15, E.haut]], { segments: TOUR }));
  lot.ajouter("creux", F.tourne([[NOYAU - 0.05, E.fond + 1.6], [E.trou + 0.05, E.fond + 1.6]], { segments: TOUR }));
  var face = [TUYAU + 0.3, L];
  lot.ajouter("noir", F.tourne([[Q.r0 + 0.25, Q.haut], [Q.r0, Q.haut, { a: 0.12, fin: 0.4 }]].concat(coinRond([Q.r0, Q.haut], [rBas, L], face, Q.arrondi, 8),
    [face, [TUYAU, L - 0.3], [TUYAU, L - 4.5], [8.6, L - 4.5], [8.6, L - 5.0], [8.05, L - 5.0], [8.05, L - 13]]), { segments: TOUR }));
  lot.ajouter("joint", F.tourne([[8.05, L - 13], [8.05, L - 16]], { segments: TOUR }));
}

export default {
  "raccord-plasson16": function (F) {
    var lot = new F.Lot();
    corps(F, lot); barreaux(F, lot); ecrou(F, lot);
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: PRISE }, bas: { z: L, x: 0, genre: "femelle", gaz: "pe16", prise: PRISE_TUYAU } };
  }
};
