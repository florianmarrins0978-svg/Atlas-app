// SON ROBINET DE JARDIN EN LAITON (le robinet du client, sans référence) : la poignée en T, la tige,
// le petit écrou du presse-étoupe, la bague tournée, le chapeau à six pans, le corps de fonderie, le nez
// fileté mâle 3/4" en bas ; derrière le corps, l'arrivée qui entre dans le mur. Tête de la pile, sur
// l'axe Z local : le haut de la poignée en z = 0, la pointe du filetage du nez en z = L. Ce qui fait
// face sur la photo regarde +Y ; l'arrivée part vers -Y.
//
// D'OÙ VIENNENT LES COTES. Une seule photo, de face (docs/robinet-3d-photos/robinet-laiton.jpg,
// 1024 x 1024), l'axe en x = 511,5. L'étalon est le filetage 3/4" du nez : 248 px au sommet des filets
// (de x = 388 à 636) pour 26,441 mm, soit 9,4 px par millimètre en largeur. Son pas le recoupe à 2 %
// près : quatre crêtes en y = 786, 804, 822 et 838 sur le bord gauche, 17,3 px pour 1,814 mm.
// La photo est prise d'un peu au-dessus : la face du bout du nez s'y voit en ellipse (16 px de flèche
// pour 105 px de rayon), soit 9 degrés. Une face plate qui regarde celui qui photographie y descend
// donc d'autant qu'elle est devant l'axe (le devant du six pans du chapeau est 15 px plus bas que ses
// coins) : les hauteurs se lisent sur la SILHOUETTE, au bord, là où ce décalage est nul, et se
// ramènent de cos 9 degrés, soit 9,3 px par millimètre. Une hauteur vaut (y - 3) / 9,3 : le haut de
// la poignée est en y = 3.
// Ce sont des photos de studio, peut-être retouchées : les cotes sont tenues à 5 % près, pas mieux.
//
// CE QUI N'EST SUR AUCUNE PHOTO, et qui est estimé : tout ce qui part vers le mur au-delà des deux
// oreilles (la longueur du bossage, l'épaisseur de la collerette, la longueur du filetage 1/2"), la
// profondeur des méplats, le passage de l'eau dans le nez et dans l'arrivée, et le dessous du six pans.

var L = 93;                 // la pointe du nez : y = 868, là où l'ellipse de sa face touche la silhouette
// L'axe de la barre : y = 44,75 sur la photo (le milieu de sa silhouette, de bout en bout), soit 4,5 mm ;
// 4,33 retenus, le rayon des cloches, pour que leur haut tombe exactement sur z = 0.
var AXE_POIGNEE = 4.33;

// LE NEZ, de bas en haut. Le col tombe sur un épaulement PLAT, brut de fonderie, qui couvre le dessus
// du collet fileté jusqu'à son arête. Sur la photo, son bord avant dessine une ellipse : 803 px au
// milieu, 790 px en x = 400 (11,9 mm de l'axe), soit un cercle vu de 10 degrés, centré en y = 781,
// donc à 83,7 mm du haut. Le contour gauche qui s'évase de y = 752 à 778 est l'arrière de cette
// ellipse, pas un cône : lu comme un cône, il faisait au nez une jupe en trompette.
// Sous l'arête, une bande lisse de 11 px (y = 801 à 812 au devant), puis quatre crêtes jusqu'à la
// pointe : le filet part à 85,3 mm, sous la portée et son chanfrein.
var FILET = { haut: 85.3, bas: L - 0.9 };
var PORTEE = { r: 13.22 };                    // l'arête du collet : 248 px, le sommet des filets
var EPAULE = { r: 12.75, z: 83.7 };           // le dessus brut ; le chanfrein tourné prend le dernier demi-millimètre
// Le col : 155 px, de y = 672 à son pied. Il rejoint l'épaulement par un congé de 1,6 mm, estimé : à
// son pied, devant, le grain passe du col à l'épaulement sans arête.
var COU = { r: 8.2, haut: 71.8, conge: 1.6 };
var PASSAGE = 6;                             // le passage de l'eau dans le nez : estimé (le col, moins 2 mm)
// Le fond d'un passage ne reçoit pas la lumière : passé ses premiers millimètres, son laiton renvoyait
// l'ambiance du studio comme une face au jour, et le trou se lisait comme un bouchon. Il est sombre au-delà.
var SOMBRE = 3;

// LE CORPS ET LE CHAPEAU.
var CORPS = { r: 11.6, bas: 62.8 };          // la chambre : 218 px (x = 403 à 621), droite jusqu'à y = 590
var BANDE = { r: 11.35, haut: 35, bas: 38.5 };   // la bande tournée sous le chapeau : 212 px, y = 328 à 361
var CHAPEAU = { plats: 18, haut: 32.05, bas: 34.95 };   // 195 px sur angles, de y = 301 à y = 328
var BAGUE = { r: 7.07, haut: 24.1, bas: 32 };           // 133 px, de y = 226 à y = 301
var ECROU = { plats: 12, haut: 21.3, bas: 24.1 };       // 130 px sur angles, de y = 201 à y = 226
var COLLET = { r: 3.78, haut: 19.55, bas: 21.35 };      // la rondelle sur l'écrou : 71 px, y = 184 à 201
var TIGE = 3.4;                                          // 64 px, de y = 85 à y = 184

// L'ARRIVÉE, derrière le corps. Les deux oreilles sont le bord de sa collerette : un cercle de 145 px
// de rayon centré en (511, 450), ajusté sur soixante points de leur contour, soit 15,4 mm de rayon à
// 48,1 mm du haut. Mais la collerette est une quinzaine de millimètres derrière l'axe (elle est floue
// sur la photo), et deux effets de la prise de vue l'y déplacent : vue de 9 degrés au-dessus, une
// chose plus loin paraît plus haute (14 mm x sin 9 degrés, soit 2,2 mm), et la perspective la
// rapetisse de 4 à 5 %. Son axe est donc à 50,3 mm du haut, son rayon de 16 mm.
var ARRIVEE = { z: 50.3, collerette: 16, devant: 13, epaisseur: 2.6, bossage: 9.8, filet: 11.2, passage: 6 };
var DEMI_POUCE = { d: 20.955, pas: 25.4 / 14 };

// LES MÉPLATS : les deux pattes plates qu'on voit sur les flancs du corps, sous les oreilles (x = 397
// et 627, de y = 445 à y = 548), où l'on tient le robinet à la clé pendant qu'on le visse dans le mur.
// Elles dépassent la chambre de 0,7 mm (6 px sur la photo). Leur profondeur ne se voit pas de face : ce sont les flancs
// d'un bloc de fonderie qui joint la chambre à la collerette (une patte posée seule sur le flanc se
// lisait, de profil, comme une pastille collée ; deux joues séparées laissaient un creux sous le
// bossage, vu d'en dessous).
// Son dessus descend de 1,5 mm vers l'arrière (la dépouille d'une pièce moulée) : posé à plat, son
// coin arrière, 13 mm derrière l'axe, montait de 2 mm à l'image (vue de 9 degrés au-dessus) et la patte
// commençait en y = 428 au lieu de 440 à 450 sur la photo (agrandie quatre fois, ses deux flancs).
var MEPLATS = { x: 12.3, haut: 47.9, bas: 58.4, devant: 1.2, derriere: -13.2, depouille: 1.5 };

function degres(a) { return a * Math.PI / 180; }

// UN SIX PANS DE FONDERIE, CHANFREINÉ À 30 DEGRÉS AUX DEUX BOUTS comme un écrou : le cône du chanfrein
// coupe chaque plat en arc (on voit ces arcs au haut des deux six pans, sur la photo). C'est la forme
// d'hexagone() (formes.js), à une différence près : chaque colonne porte un sommet EXACTEMENT sur
// l'arête entre le plat et le cône, et chaque région sa vraie normale. Celle de formes.js, posée sur
// des rangs fixes, laisse cette arête tomber entre deux rangs ; vue de près (zoom 2), l'ombrage de
// l'écrou et du chapeau y faisait des dents de scie.
// Les coins sont en 0, 60, 120 degrés... ; un plat regarde 30, 90, 150 degrés... (comme hexagone()).
function sixPans(F, o) {
  var THREE = F.THREE, a = o.surPlats / 2, h = o.z1 - o.z0, r0 = a * 0.97, pente = Math.tan(degres(30)), parFace = 16, n = parFace * 6;
  var sr = Math.sin(degres(30)), sz = Math.cos(degres(30)), pos = [], nor = [];
  function plat(th) { var m = th % (Math.PI / 3); return a / Math.cos(m - Math.PI / 6); }
  function arete(th) { var d = Math.min((plat(th) - r0) * pente, h / 2); return { d: d, r: r0 + d / pente }; }
  // Un quadrilatère p0 p1 p2 p3 (chacun [rayon, angle, z]) et la normale de chacun de ses sommets ;
  // l'ordre des sommets se retourne s'il ne regarde pas du côté de sa normale.
  function quad(p, nm) {
    var v = p.map(function (q) { return new THREE.Vector3(q[0] * Math.cos(q[1]), q[0] * Math.sin(q[1]), q[2]); });
    var c = new THREE.Vector3().subVectors(v[2], v[0]).cross(new THREE.Vector3().subVectors(v[3], v[1]));
    var moy = new THREE.Vector3(); nm.forEach(function (m) { moy.add(m); });
    var ordre = c.dot(moy) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    ordre.forEach(function (i) { pos.push(v[i].x, v[i].y, v[i].z); nor.push(nm[i].x, nm[i].y, nm[i].z); });
  }
  function cone(th, haut) { return new THREE.Vector3(sr * Math.cos(th), sr * Math.sin(th), haut ? -sz : sz); }
  var dessus = new THREE.Vector3(0, 0, -1), dessous = new THREE.Vector3(0, 0, 1);
  for (var j = 0; j < n; j++) {
    var t0 = Math.PI * 2 * j / n, t1 = Math.PI * 2 * (j + 1) / n, e0 = arete(t0), e1 = arete(t1);
    var face = Math.floor(j / parFace), tf = Math.PI / 6 + face * Math.PI / 3, nf = new THREE.Vector3(Math.cos(tf), Math.sin(tf), 0);
    // Le chanfrein du haut, le plat, le chanfrein du bas.
    quad([[r0, t0, o.z0], [r0, t1, o.z0], [e1.r, t1, o.z0 + e1.d], [e0.r, t0, o.z0 + e0.d]], [cone(t0, true), cone(t1, true), cone(t1, true), cone(t0, true)]);
    quad([[e0.r, t0, o.z0 + e0.d], [e1.r, t1, o.z0 + e1.d], [e1.r, t1, o.z1 - e1.d], [e0.r, t0, o.z1 - e0.d]], [nf, nf, nf, nf]);
    quad([[e0.r, t0, o.z1 - e0.d], [e1.r, t1, o.z1 - e1.d], [r0, t1, o.z1], [r0, t0, o.z1]], [cone(t0, false), cone(t1, false), cone(t1, false), cone(t0, false)]);
    // Les deux faces, du centre au départ du cône.
    quad([[0.001, t0, o.z0], [0.001, t1, o.z0], [r0, t1, o.z0], [r0, t0, o.z0]], [dessus, dessus, dessus, dessus]);
    quad([[0.001, t0, o.z1], [0.001, t1, o.z1], [r0, t1, o.z1], [r0, t0, o.z1]], [dessous, dessous, dessous, dessous]);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return F.uvCube(g);
}

// LA POIGNÉE EN T : une barre tournée le long de X, d'une seule pièce. Son profil se relève colonne par
// colonne (le haut et le bas de sa silhouette) et il est le même des deux côtés à un pixel près.
// Les bouts évasés font 81 px de haut (8,66 mm) de x = 330 à 348, en cloche jusqu'au col de 53 px
// (5,6 mm) en x = 456 et 564 : un cône, droit à 2 % près. Les faces des bouts sont plates, leur bord
// arrondi (de 41 px à 20 px en dix colonnes). L'olive du milieu est un tonneau : 4,23 mm de rayon au
// milieu, 3,9 à 2,6 mm de là, 3,6 à 3,5 mm, 3,2 à 4,5 mm, soit une ellipse de 6,9 mm de demi-longueur,
// coupée là où elle retrouve le col ; l'arête se voit sur la photo, elle reste vive à 0,3 mm près.
function poignee(F, lot) {
  var bout = 20.35, cloche = 4.33, col = 2.8, olive = [];
  for (var i = 0; i <= 24; i++) {
    var u = -5.3 + 10.6 * i / 24;
    olive.push([4.23 * Math.sqrt(1 - (u / 6.9) * (u / 6.9)), u, i === 0 || i === 24 ? { a: 0.3, fin: 0.2 } : null]);
  }
  var profil = [[0, -bout], [cloche, -bout, { a: 1.3, fin: 0.25 }], [cloche, -18.4, { a: 1.6, fin: 0.3 }], [col, -6.1, { a: 0.9, fin: 0.3 }]]
    .concat(olive, [[col, 6.1, { a: 0.9, fin: 0.3 }], [cloche, 18.4, { a: 1.6, fin: 0.3 }], [cloche, bout, { a: 1.3, fin: 0.25 }], [0, bout]]);
  lot.ajouter("laiton", F.tourne(profil.map(function (p) { return p[2] ? p : [p[0], p[1]]; }), { segments: 80 }), { ry: Math.PI / 2, z: AXE_POIGNEE });
  // La tige monte jusque dans l'olive (son dessous est en z = 8,6) ; en bas, elle entre dans la rondelle.
  lot.ajouter("laiton", F.cylindre(TIGE, 7.4, COLLET.haut + 0.6, { c: 0, segments: 40 }));
}

// LA TÊTE : la rondelle du presse-étoupe, son écrou, la bague tournée, le chapeau à six pans. Les six
// pans sont bruts de fonderie (leurs faces sont grenues sur la photo, comme le corps) ; ce qui a été
// tourné, la rondelle, la bague, le dessus du chapeau et la bande, est lisse.
function tete(F, lot) {
  lot.ajouter("laiton", F.tourne([[TIGE, COLLET.haut], [COLLET.r, COLLET.haut, { c: 0.3 }], [COLLET.r, COLLET.bas]], { segments: 40 }));
  // L'écrou est tourné de 18,6 degrés : ses arêtes sont en x = 450, 458, 525 et 578 sur la photo, soit
  // des coins à 18,6, 78,6 et 138,6 degrés de l'axe X, vers celui qui regarde.
  lot.ajouter("laitonBrut", sixPans(F, { surPlats: ECROU.plats, z0: ECROU.haut, z1: ECROU.bas }), { rz: degres(18.6) });
  // La bague : son arête du haut chanfreinée, et en bas un congé qui s'évase sur le dessus du chapeau
  // (de 134 à 141 px entre y = 287 et 300). Le dessus du chapeau est tourné : il est dans ce profil, à
  // 0,05 mm au-dessus du six pans, pour que les deux faces ne se battent pas.
  var dessus = CHAPEAU.plats / 2 * 0.97;
  lot.ajouter("laiton", F.tourne([[5.4, BAGUE.haut], [BAGUE.r, BAGUE.haut, { c: 0.35 }], [BAGUE.r, BAGUE.bas, { a: 1.2, fin: 0.25 }], [dessus, BAGUE.bas]], { segments: 56 }));
  // Le chapeau, une face vers celui qui regarde (le plat du milieu va de x = 468 à 548 sur la photo).
  lot.ajouter("laitonBrut", sixPans(F, { surPlats: CHAPEAU.plats, z0: CHAPEAU.haut, z1: CHAPEAU.bas }));
  // La bande tournée sur laquelle il serre, au sommet du corps.
  lot.ajouter("laiton", F.tourne([[8.5, BANDE.haut], [BANDE.r, BANDE.haut, { a: 0.45, fin: 0.3 }], [BANDE.r, BANDE.bas], [CORPS.r - 0.3, BANDE.bas]], { segments: 64 }));
}

// LE CORPS DE FONDERIE ET SON NEZ. La chambre descend droite, puis se resserre en cône arrondi jusqu'au
// col (relevé tous les 8 px : 11,2 mm en y = 608, 10,2 en y = 632, 9,2 en y = 648, 8,4 en y = 664),
// le col descend droit jusqu'à l'épaulement plat, et le collet est tourné : son arête chanfreinée, une
// portée lisse, puis le filet jusqu'à la pointe.
function corps(F, lot) {
  var fond = F.rayonDuFond({ gaz: "3/4" });
  lot.ajouter("laitonBrut", F.tourne([[CORPS.r - 0.3, BANDE.bas], [CORPS.r, BANDE.bas + 0.3], [CORPS.r, CORPS.bas, { a: 5, fin: 0.12 }],
    [COU.r + 0.05, COU.haut, { a: 3.5, fin: 0.15 }], [COU.r, EPAULE.z, { a: COU.conge, fin: 0.2 }], [EPAULE.r, EPAULE.z]], { segments: 96 }));
  // Le collet tourné, dans le prolongement exact de l'épaulement (même plan, sans marche) : le chanfrein
  // de l'arête, la portée, son chanfrein vers le fond du filet, puis, sous le filet, le chanfrein
  // d'entrée, la face du bout (deux cercles sur le plan z = L, que la scène mesure) et le passage.
  lot.ajouter("laiton", F.tourne([[EPAULE.r, EPAULE.z], [PORTEE.r, EPAULE.z, { c: 0.35 }], [PORTEE.r, FILET.haut - 0.45, { c: 0.25 }], [fond, FILET.haut]], { segments: 72 }));
  lot.ajouter("laiton", F.filetage({ gaz: "3/4", z0: FILET.haut, z1: FILET.bas, entree: 0.9, sortie: 0.6, pointe: "z1", segments: 72 }));
  lot.ajouter("laiton", F.tourne([[fond, FILET.bas], [11.3, L, { a: 0.3, fin: 0.3 }], [PASSAGE + 0.5, L], [PASSAGE, L - 0.5], [PASSAGE, L - SOMBRE]], { segments: 72 }));
  lot.ajouter("creux", F.tourne([[PASSAGE, L - SOMBRE], [PASSAGE, COU.haut + 1], [0, COU.haut + 1]], { segments: 40 }));
}

// L'ARRIVÉE, tournée le long de -Y à la hauteur de la collerette : le bossage brut qui sort de la
// chambre (caché de face, son rayon est estimé), la collerette (ses bords arrondis, comme les oreilles
// sur la photo), puis le bout tourné : un dégagement, le filet 1/2" (estimé à six filets), le chanfrein,
// la face du bout et le passage.
function arrivee(F, lot) {
  var a = ARRIVEE, fond = F.rayonDuFond(DEMI_POUCE), arriere = a.devant + a.epaisseur, f0 = arriere + 0.9, f1 = f0 + a.filet, bout = f1 + 0.7;
  var pose = { rx: Math.PI / 2, z: a.z };
  lot.ajouter("laitonBrut", F.tourne([[a.bossage, 4], [a.bossage, a.devant, { a: 1.4, fin: 0.25 }], [a.collerette, a.devant, { a: 1, fin: 0.3 }],
    [a.collerette, arriere, { a: 1, fin: 0.3 }], [fond + 0.6, arriere]], { segments: 64 }), pose);
  lot.ajouter("laiton", F.tourne([[fond + 0.6, arriere], [fond, arriere + 0.2], [fond, f0]], { segments: 48 }), pose);
  lot.ajouter("laiton", F.filetage({ d: DEMI_POUCE.d, pas: DEMI_POUCE.pas, z0: f0, z1: f1, entree: 0.9, sortie: 0.6, pointe: "z1", segments: 56 }), pose);
  lot.ajouter("laiton", F.tourne([[fond, f1], [fond - 0.7, bout, { a: 0.3, fin: 0.3 }], [a.passage + 0.4, bout], [a.passage, bout - 0.4], [a.passage, bout - SOMBRE]], { segments: 56 }), pose);
  lot.ajouter("creux", F.tourne([[a.passage, bout - SOMBRE], [a.passage, arriere], [0, arriere]], { segments: 40 }), pose);
}

// LE BLOC DES MÉPLATS : un seul volume, d'un flanc à l'autre le long de X, au contour arrondi devant
// (les bouts des pattes le sont sur la photo). Son devant est noyé dans la chambre ; seuls ses deux
// flancs en sortent, et son dessous, vu de biais.
function meplats(F, lot) {
  var m = MEPLATS, demi = (m.bas - m.haut) / 2, milieu = (m.haut + m.bas) / 2, devant = { a: 3.2 }, derriere = { a: 0.6 };
  // Le contour se pose dans le plan (u, y), u = milieu - z : la rotation retourne l'axe.
  var contour = [[-demi, m.derriere, derriere], [demi - m.depouille, m.derriere, derriere], [demi, m.devant, devant], [-demi, m.devant, devant]];
  lot.ajouter("laitonBrut", F.prisme(contour, -m.x, m.x, { arrondi: 0.7 }), { ry: Math.PI / 2, z: milieu });
}

export default {
  "robinet-laiton": function (F) {
    var lot = new F.Lot();
    poignee(F, lot); tete(F, lot); corps(F, lot); arrivee(F, lot); meplats(F, lot);
    return { couches: lot.couches(), haut: null, bas: { z: L, x: 0, genre: "male", gaz: "3/4", prise: L - FILET.haut } };
  }
};
