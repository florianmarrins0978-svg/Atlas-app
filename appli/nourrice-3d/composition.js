// LA COMPOSITION DE LA NOURRICE EN 3D : quelle pièce, sur quel axe, à quelle cote, montée et éclatée.
//
// Elle ne dessine rien et ne connaît pas three : elle lit la fiche (CAT.ficheNourrice) et les bouts de
// vissage que chaque pièce déclare, et rend la place de chacune. C'est ce qui garde l'axe juste par
// construction : une pièce n'est jamais posée à l'œil, elle est posée par le bout qui se visse dans la
// pièce d'en face.
//
// LE REPÈRE, en millimètres. X : l'axe de la rangée du haut, de gauche à droite. Z : le sens des
// colonnes, de la rangée vers le tuyau. Y : vers le haut (les bobines). C'est la planche vue du dessus
// (appli/arrosage-nourrice-vue-du-dessus.html), regardée d'en haut.
//
// CE QU'UNE PIÈCE DÉCLARE.
//   Une pièce de COLONNE est modélisée sur l'axe Z local (x = 0, y = 0), du bout du haut (z = 0) au
//   bout du bas (z = L) :
//     haut: { z: 0, genre: "male" ou "femelle", gaz: "1", "3/4" ou "pe25", prise: mm }
//     bas:  { z: L, ... }
//   `z` est l'extrémité de la pièce de ce côté (la pointe d'un filetage mâle, la face d'une bouche
//   femelle). `prise` est la longueur du filetage mâle, ou la profondeur où la bouche femelle le reçoit.
//   Une pièce de la RANGÉE DU HAUT est modélisée sur l'axe X local (y = 0, z = 0) :
//     gauche: { x, genre, gaz, prise } ou null ; droite: { x, ... } ou null ;
//     branches: [{ x, z, genre: "femelle", gaz: "1", prise }] : l'axe d'une colonne (parallèle à Z, en x)
//     et la face de la bouche où elle se visse (en z).

// L'écart entre deux pièces, éclatées : 2 cm entre le bout de l'une et le bout de l'autre, si bien que
// chaque filetage se voit en entier.
export var ECART = 20;

// L'ordre des pièces de chaque colonne, celui de la planche vue du dessus. `retourne` : le mamelon
// réduit se pose le 1" en haut.
var ARRIVEE = [{ cle: "mamelon", retourne: true }, { cle: "vanne-purge" }, { cle: "mamelon" }, { cle: "union" }, { cle: "raccord-male25" }, { cle: "pehd" }];
var VOIE = [{ cle: "electrovanne-100dv" }, { cle: "union" }, { cle: "raccord-male25" }, { cle: "pehd" }];
var VOIE_GOUTTE = [{ cle: "mamelon-droit-1" }, { cle: "electrovanne-100dv-ff" }, { cle: "mamelon", retourne: true }, { cle: "regulateur-ff34" },
  { cle: "mamelon" }, { cle: "union" }, { cle: "raccord-male25" }, { cle: "pehd" }];

// Deux bouts se vissent-ils ? Un mâle dans une femelle, du même filetage.
function accord(a, b) { return a && b && a.genre !== b.genre && a.gaz === b.gaz; }
function prise(a, b) { return Math.min(a.prise, b.prise); }

// La composition de `n` voies dont `g` en goutte-à-goutte. `fiche` est celle du catalogue, `pieces` les
// définitions (clé, bouts). Rend { pieces, colonnes, erreurs }.
export function composer(fiche, n, g, pieces) {
  var compte = {}, erreurs = [];
  fiche.pieces.forEach(function (p) { compte[p.ref] = (compte[p.ref] || 0) + p.q; });
  var clarinette = ["clarinette-2v", "clarinette-3v", "clarinette-4v"].filter(function (r) { return compte[r]; })[0];
  var haut = ["coude-mf"];
  if (clarinette) haut.push(clarinette);
  if (compte["te-mmf"]) haut.push("te-mmf");
  haut.push("coude-ff");

  var poses = [], colonnes = [], xM = 0, xE = 0, avant = null;
  haut.forEach(function (cle, i) {
    var d = pieces[cle];
    if (i > 0) {
      if (!accord(avant.def.droite, d.gauche)) erreurs.push(avant.cle + " ne se visse pas dans " + cle);
      var e = prise(avant.def.droite, d.gauche);
      xM = avant.xM + avant.def.droite.x - e - d.gauche.x;
      xE = avant.xE + avant.def.droite.x + ECART - d.gauche.x;
    }
    var pose = { cle: cle, rang: "haut", colonne: -1, retourne: false, monte: [xM, 0], eclate: [xE, 0], indice: poses.length };
    poses.push(pose);
    d.branches.forEach(function (b) { colonnes.push({ parent: pose.indice, branche: b, xMonte: xM + b.x, xEclate: xE + b.x, pieces: [] }); });
    avant = { cle: cle, def: d, xM: xM, xE: xE };
  });

  // La première branche est l'arrivée (sous le coude MF) ; les voies de goutte-à-goutte sont à droite.
  colonnes.forEach(function (col, i) {
    col.arrivee = i === 0; col.goutte = i > 0 && i - 1 >= (colonnes.length - 1) - g;
    var liste = col.arrivee ? ARRIVEE : col.goutte ? VOIE_GOUTTE : VOIE;
    var bout = col.branche, zM = col.branche.z, zE = col.branche.z, nomAvant = poses[col.parent].cle;
    liste.forEach(function (item) {
      var d = pieces[item.cle], L = d.bas.z - d.haut.z;
      var enHaut = item.retourne ? d.bas : d.haut, enBas = item.retourne ? d.haut : d.bas;
      if (!accord(bout, enHaut)) erreurs.push(nomAvant + " ne se visse pas dans " + item.cle);
      var z0M = zM - prise(bout, enHaut), z0E = zE + ECART;
      var pose = { cle: item.cle, rang: "colonne", colonne: i, retourne: !!item.retourne, L: L, monte: [col.xMonte, z0M], eclate: [col.xEclate, z0E], indice: poses.length };
      poses.push(pose); col.pieces.push(pose.indice);
      zM = z0M + L; zE = z0E + L; bout = enBas; nomAvant = item.cle;
    });
  });
  if (colonnes.length !== n + 1) erreurs.push("La fiche de " + n + " voies donne " + (colonnes.length - 1) + " voies");
  return { pieces: poses, colonnes: colonnes, erreurs: erreurs };
}

// La place d'une pièce à l'instant t (0 : montée, 1 : éclatée). Une pièce de la rangée ne bouge que
// sur X ; une pièce de colonne suit l'axe de sa colonne (X) et s'écarte le long de lui (Z).
export function place(pose, t) {
  return [pose.monte[0] + (pose.eclate[0] - pose.monte[0]) * t, pose.monte[1] + (pose.eclate[1] - pose.monte[1]) * t];
}
