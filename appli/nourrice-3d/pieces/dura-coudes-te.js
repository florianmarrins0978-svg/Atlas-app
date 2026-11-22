// LES COUDES ET LE TÉ DURA, en PVC gris clair : Coude 90° taraudé/fileté MF 1", Coude 1" FF, Té 1" MFF.
// Pièces de la rangée du haut : l'axe de la rangée est l'axe X local (y = 0, z = 0), la branche où une
// colonne se visse part vers +Z, et le coin de la pièce (là où ses deux axes se croisent) est à l'origine.
//
// LES COTES sont relevées sur ses photos vues du dessus (appli/arrosage-photos/, suffixe
// « -dessus-naturel »), le sommet du filetage 1" (33,25 mm) pour étalon ; chaque cote dit sa photo.
// Deux écarts assumés. Le filetage : ses photos montrent sept filets sur 14 mm, le pas du gaz (2,309 mm)
// en met sept sur 16,2 mm : on garde les sept filets et le vrai pas. L'écrou : celui de formes.js, le
// même pour toutes les pièces (40 mm), alors que la photo du té le montre de 36 à 38 mm et celle du
// coude MF de 41,5.

var UN_QUART = Math.PI / 2;
// Vers où part un bout modélisé sur l'axe Z local : la branche (+Z, tel quel), la droite ou la gauche.
var BRANCHE = null, DROITE = { ry: UN_QUART }, GAUCHE = { ry: -UN_QUART };

var ECROU = 30;      // la longueur de l'écrou union (F.ecrouUnion)
var PRISE = 19;      // la profondeur où un mâle bute dans l'écrou, sur le joint plat
var COL = 14;        // le rayon du col qui passe dans l'écrou : 27,4 à 28,2 mm de diamètre sur le té et le coude MF
var ALESAGE = 11.3;  // le passage de l'eau : 22,4 mm relevés au bout du raccord union mâle (dura-union-1-mf.jpg)
var FILETS = 7;      // comptés sur les photos du té et du coude MF
var NEZ = 3.9;       // le bout lisse devant le filetage : 3,9 mm sur le coude MF comme sur le té

// LE BOUT À ÉCROU d'une pièce Dura, sur l'axe Z local : l'écrou union, le joint torique noir qu'on voit
// entre son collet et le corps, et ce qu'on voit au fond de sa bouche une fois éclatée (le joint plat,
// puis l'alésage). `collet` est la cote de la face du collet ; le corps de la pièce amène son col
// (rayon COL) jusque dans l'écrou. Rend la cote de la bouche.
// Exporté : les collecteurs et le manchon union finissent par le même bout.
export function boutAEcrou(F, lot, collet, vers, decalage) {
  var joint = collet + ECROU - PRISE - 0.5, fondDuTrou = collet - 6;
  lot.ajouter("pvc", F.placer(F.ecrouUnion({ longueur: ECROU, prise: PRISE, decalage: decalage || 0 }), { z: collet }), vers);
  // Le joint torique : à demi logé dans le siège conique du collet, il déborde juste assez pour se voir.
  lot.ajouter("joint", F.placer(new F.THREE.TorusGeometry(COL + 1.45, 1.25, 8, 40), { z: collet - 0.35 }), vers);
  // Le joint plat, posé sur la collerette du corps (cachée derrière lui), et l'alésage qui s'enfonce.
  lot.ajouter("joint", F.tourne([[15.45, joint - 0.6], [15.45, joint, { a: 0.35 }], [ALESAGE, joint, { a: 0.3 }], [ALESAGE, joint - 2.5]], { segments: 36 }), vers);
  lot.ajouter("pvc", F.tourne([[ALESAGE, joint - 2.5], [ALESAGE, fondDuTrou]], { segments: 32 }), vers);
  lot.ajouter("creux", F.tourne([[ALESAGE, fondDuTrou], [0, fondDuTrou]], { segments: 24 }), vers);
  return collet + ECROU;
}

// LE BOUT FILETÉ 1" d'une pièce, sur l'axe Z local, à partir de `debut` (où le corps arrive au rayon du
// fond du filet) : le filetage, le nez lisse, la face du bout (deux cercles posés sur son plan, que la
// scène mesure) et l'alésage qu'on voit dedans. Rend la cote de la pointe.
function boutFilete(F, lot, debut, rNez, vers) {
  var fin = debut + FILETS * F.GAZ["1"].pas, pointe = fin + NEZ, fond = F.rayonDuFond({ gaz: "1" });
  // Un filet moulé naît et meurt en moins d'un demi-tour : c'est ce qui laisse voir les sept filets.
  lot.ajouter("pvc", F.filetage({ gaz: "1", z0: debut, z1: fin, pointe: "z1", entree: 0.45, sortie: 0.4 }), vers);
  lot.ajouter("pvc", F.tourne([[fond, fin], [rNez, fin + 0.5], [rNez, pointe, { a: 1 }], [ALESAGE, pointe, { c: 0.45 }], [ALESAGE, pointe - 26]], { segments: 48 }), vers);
  lot.ajouter("creux", F.tourne([[ALESAGE, pointe - 26], [0, pointe - 26]], { segments: 24 }), vers);
  return pointe;
}

// LE CINTRE D'UN COUDE MOULÉ : un quart de tore qui quitte l'axe X en (rho, 0, 0) et rejoint l'axe Z
// en (0, 0, rho), le grand arrondi vers -X et -Z. Son rayon de cintrage est plus petit que celui du
// tube : c'est ce qui donne le coin vif du dedans. Un tore ordinaire s'y retournerait sur lui-même
// (des faces à l'envers, noires) ; ici ce qui passerait l'axe du cintrage est ramené dessus, et les
// deux bras, qui se croisent, font le coin.
function cintre(F, rho, r) {
  var pas = 24, seg = 64, pos = [], nor = [], uv = [], index = [], tours = Math.max(1, Math.round(2 * Math.PI * r / F.CARREAU));
  for (var i = 0; i <= pas; i++) {
    var a = UN_QUART * i / pas, ox = -Math.sin(a), oz = -Math.cos(a);
    for (var j = 0; j <= seg; j++) {
      var ph = 2 * Math.PI * j / seg, c = Math.cos(ph), s = Math.sin(ph), d = Math.max(0, rho + r * c);
      pos.push(rho + d * ox, r * s, rho + d * oz); nor.push(c * ox, s, c * oz); uv.push(tours * j / seg, (rho + r / 2) * a / F.CARREAU);
      if (i < pas && j < seg) { var A = i * (seg + 1) + j, B = A + seg + 1; index.push(A, B, A + 1, B, B + 1, A + 1); }
    }
  }
  var g = new F.THREE.BufferGeometry();
  g.setAttribute("position", new F.THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new F.THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new F.THREE.Float32BufferAttribute(uv, 2)); g.setIndex(index);
  return g;
}

// La trace du point d'injection : une petite bosse sur le dos du cintre, à l'angle `a` compté depuis
// le bras de l'axe X.
function pointDInjection(F, rho, r, a) {
  var g = new F.THREE.SphereGeometry(1.5, 12, 8); g.scale(1, 1, 0.4); g.rotateY(a + Math.PI);
  return g.translate(rho - (rho + r - 0.1) * Math.sin(a), 0, rho - (rho + r - 0.1) * Math.cos(a));
}

// LE CONGÉ AU PIED DE LA BRANCHE DU TÉ : la branche (rayon `rb`, sur l'axe Z) sort du corps (rayon
// `R`, sur l'axe X) le long d'une arête qui, vue du dessus, dessine le V de sa photo. Le congé la
// suit : dans chaque plan qui contient l'axe de la branche, une courbe va de la branche au corps.
// Ses deux lisières sont rentrées de 0,06 mm dans la matière, pour ne pas scintiller avec elle.
function congeDeBranche(F, R, rb, surBranche, surCorps) {
  var tour = 48, rangs = 4, pos = [], index = [];
  for (var i = 0; i < tour; i++) {
    var ph = 2 * Math.PI * i / tour, c = Math.cos(ph), s = Math.sin(ph);
    var r2 = Math.min(rb + surCorps, (R - 0.05) / Math.max(Math.abs(s), 1e-6)), z1 = Math.sqrt(R * R - rb * rb * s * s), z2 = Math.sqrt(Math.max(0, R * R - r2 * r2 * s * s));
    var p0 = [rb - 0.06, z1 + surBranche], p2 = [r2, z2 - 0.06], m = [rb + ((p0[0] + p2[0]) / 2 - rb) * 0.45, z1 + ((p0[1] + p2[1]) / 2 - z1) * 0.45];
    for (var k = 0; k <= rangs; k++) {
      var t = k / rangs, u = 1 - t, r = u * u * p0[0] + 2 * u * t * m[0] + t * t * p2[0], z = u * u * p0[1] + 2 * u * t * m[1] + t * t * p2[1];
      pos.push(r * c, r * s, z);
      if (k < rangs) { var A = i * (rangs + 1) + k, B = ((i + 1) % tour) * (rangs + 1) + k; index.push(A, B, A + 1, B, B + 1, A + 1); }
    }
  }
  var g = new F.THREE.BufferGeometry(); g.setAttribute("position", new F.THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  return F.uvCube(g);
}

// LE BOSSAGE EN LOSANGE DU TÉ, sur le dessus, là où la branche rejoint le corps (sa photo y porte le
// nom du fabricant, qu'on ne reproduit pas). Un losange aux coins ronds, de demi-largeur `a` (sur X) et
// de demi-hauteur `b` (sur Z), centré en z = `zc`, bombé comme la branche qu'il couvre, au bord rabattu.
function losange(F, a, b, zc, sommet) {
  var tour = 48, courbure = 22, pos = [0, sommet, zc], index = [];
  // rangs : [part du contour, descente] : le dos, le début du bord, le bord rabattu, le pied noyé
  var rangs = [[0.55, 0], [0.92, 0], [1, 0.4], [1, 3.4]];
  rangs.forEach(function (rg, k) {
    for (var i = 0; i < tour; i++) {
      var th = 2 * Math.PI * i / tour, c = Math.cos(th), s = Math.sin(th);
      // un losange aux coins ronds : la courbe |x/a|^p + |z/b|^p = 1, entre le losange (p = 1) et l'ovale (p = 2)
      var p = 1.3, rayon = rg[0] / Math.pow(Math.pow(Math.abs(c) / a, p) + Math.pow(Math.abs(s) / b, p), 1 / p), x = rayon * c;
      pos.push(x, sommet - (courbure - Math.sqrt(courbure * courbure - x * x)) - rg[1], zc + rayon * s);
      var A = 1 + k * tour + i, B = 1 + k * tour + (i + 1) % tour;
      if (k === 0) index.push(0, B, A); else index.push(A - tour, B - tour, A, B - tour, B, A);
    }
  });
  var g = new F.THREE.BufferGeometry(); g.setAttribute("position", new F.THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index);
  return F.uvCube(F.toCreasedNormals(g, 0.7));
}

export default {
  // COUDE 90° TARAUDÉ/FILETÉ MF 1" (coude-mf-dessus-naturel.png, 7,79 pixels par millimètre).
  "coude-mf": function (F) {
    var lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" });
    // Le corps : 29,4 mm de diamètre ; son dos est un arc de 27,6 mm de rayon, d'où le cintrage.
    var rho = 12.9, r = 14.7;
    lot.ajouter("pvc", cintre(F, rho, r));
    // Le point d'injection se voit sur le dos du bras fileté, à 17,3 mm du coin.
    lot.ajouter("pvc", pointDInjection(F, rho, r, 0), { x: 17.3 - rho });
    // Le bras fileté : le corps jusqu'à 19,8 mm, un ressaut de 0,7 mm, le tube de 28 mm jusqu'à 37,5,
    // puis la collerette au rayon du fond du filet (4,1 mm de long).
    lot.ajouter("pvc", F.tourne([[r, rho - 0.3], [r, 19.5, { a: 0.5 }], [COL, 20.1, { a: 0.5 }], [COL, 37.1, { a: 0.6 }], [fond, 37.9, { a: 0.4 }], [fond, 41.65]], {}), DROITE);
    var pointe = boutFilete(F, lot, 41.65, 14.95, DROITE);
    // Le bras de l'écrou : le corps descend jusqu'à 19 mm, le col entre dans l'écrou (collet à 19,6).
    var collet = 19.6;
    lot.ajouter("pvc", F.tourne([[r, rho - 0.3], [r, collet - 1.2, { a: 0.5 }], [COL, collet - 0.7], [COL, collet + 4]], {}), BRANCHE);
    var bouche = boutAEcrou(F, lot, collet, BRANCHE);
    return { couches: lot.couches(), gauche: null, droite: { x: pointe, genre: "male", gaz: "1", prise: pointe - 41.65 },
      branches: [{ x: 0, z: bouche, genre: "femelle", gaz: "1", prise: PRISE }] };
  },

  // COUDE 1" FF (coude-ff-dessus-naturel.png, tournée d'un quart de tour ; ses écrous y pendent de
  // travers, pas vissés : les cotes du corps se lisent sur le corps, l'écrou de 40 mm pour étalon).
  "coude-ff": function (F) {
    var lot = new F.Lot();
    // Le corps : 30,4 mm au cintre, un dos de 24,2 mm de rayon. Chaque bras est un moyeu de 31,4 mm,
    // qui s'évase à 33 mm contre l'écrou (les renflements de sa photo).
    var rho = 9, r = 15.2, moyeu = 15.7, evase = 16.5, collet = 24.4;
    lot.ajouter("pvc", cintre(F, rho, r), GAUCHE);
    // Le point d'injection : sur le dos du cintre, à 26 degrés du bras de la branche.
    lot.ajouter("pvc", pointDInjection(F, rho, r, 26 * Math.PI / 180), GAUCHE);
    [[BRANCHE, 0], [GAUCHE, 0.3]].forEach(function (bras) {
      lot.ajouter("pvc", F.tourne([[r, rho - 0.3], [r, rho + 0.3, { a: 0.3 }], [moyeu, rho + 0.8, { a: 0.4 }], [moyeu, collet - 3.8, { a: 0.6 }], [evase, collet - 3.1, { a: 0.5 }],
        [evase, collet - 1.7, { a: 0.5 }], [COL, collet - 1.7], [COL, collet + 4]], {}), bras[0]);
      boutAEcrou(F, lot, collet, bras[0], bras[1]);
    });
    return { couches: lot.couches(), gauche: { x: -(collet + ECROU), genre: "femelle", gaz: "1", prise: PRISE }, droite: null,
      branches: [{ x: 0, z: collet + ECROU, genre: "femelle", gaz: "1", prise: PRISE }] };
  },

  // TÉ 1" MFF (te-mmf-dessus-naturel.png, en miroir ; 6,21 pixels par millimètre).
  "te-mmf": function (F) {
    var lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" });
    // Le corps : 39,3 mm de long. Son diamètre, 31,2 mm, est pris entre les deux étalons de sa photo
    // (30,4 mm d'après le filetage, 32,8 d'après les écrous).
    var R = 15.6, demi = 19.6;
    // Côté mâle : le col jusqu'à 27,3 mm, la collerette au rayon du fond du filet jusqu'à 31.
    lot.ajouter("pvc", F.tourne([[COL, -demi - 9], [COL, -demi - 0.3, { a: 0.5 }], [R, -demi + 0.3, { a: 0.7 }], [R, demi - 0.3, { a: 0.7 }], [COL, demi + 0.3, { a: 0.5 }],
      [COL, 27.3, { a: 0.6 }], [fond, 28.1, { a: 0.4 }], [fond, 31]], {}), DROITE);
    var pointe = boutFilete(F, lot, 31, 14.4, DROITE);
    // Côté écrou : 4,5 mm de col entre le corps et le collet.
    var face = boutAEcrou(F, lot, demi + 4.5, GAUCHE, 0.26);
    // La branche : un moyeu de 29,6 mm jusqu'à 18 mm de l'axe, puis le col ; le collet est à 25,8 mm.
    var moyeu = 14.8, collet = 25.8;
    lot.ajouter("pvc", F.tourne([[moyeu, 4], [moyeu, 17.6, { a: 0.5 }], [COL, 18.4, { a: 0.5 }], [COL, collet + 4]], {}), BRANCHE);
    lot.ajouter("pvc", congeDeBranche(F, R, moyeu, 2.2, 1.6));
    // Le losange : 14,2 mm de large, 11,2 de haut, son centre à 10,2 mm de l'axe du corps.
    lot.ajouter("pvc", losange(F, 7.1, 5.6, 10.2, R));
    var bouche = boutAEcrou(F, lot, collet, BRANCHE);
    return { couches: lot.couches(), gauche: { x: -face, genre: "femelle", gaz: "1", prise: PRISE }, droite: { x: pointe, genre: "male", gaz: "1", prise: pointe - 31 },
      branches: [{ x: 0, z: bouche, genre: "femelle", gaz: "1", prise: PRISE }] };
  }
};
