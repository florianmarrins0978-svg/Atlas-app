// LA PILE DU ROBINET EN 3D : quelle pièce, à quelle place, montée et éclatée.
//
// Sa demande du 22 novembre 2026 : une des neuf combinaisons d'abord (« pour voir si j'aime comment tu
// fais »), puis, devant elle : « Parfait, tu peux faire toutes les autres combinaisons exactement comme
// tu viens de faire là ». Les neuf : trois programmateurs en nez de robinet (Solem BL-NR, Rain Bird,
// Buddy) fois trois départs (Ø16 rigide, Ø16 souple, PEHD Ø25 ou Ø32, le même tuyau à l'oeil, sa
// règle). Au nez de robinet il n'y a pas de nourrice (sa règle du 18 octobre 2026) : c'est une pile,
// de son robinet jusqu'au tuyau, avec la double sortie sous le robinet.
//
// Comme la nourrice (appli/nourrice-3d/composition.js), elle ne dessine rien et ne connaît pas three :
// chaque pièce est posée par le bout qui se visse dans la pièce d'au-dessus, jamais à l'oeil.
//
// LE REPÈRE, en millimètres : la pile court sur Z, du robinet (z petit) vers le tuyau (z grand). X va
// de gauche à droite quand on la regarde de face ; Y vient vers celui qui regarde. La scène de la
// nourrice, avec `debout` (nourrice-3d/scene.js), la redresse : vue de face, le robinet est en haut, le tuyau en bas.
//
// CE QU'UNE PIÈCE DÉCLARE. Elle est modélisée sur son axe Z local, de son bout du haut (z = 0, x = 0)
// à son bout du bas :
//   haut: { z: 0, genre: "male" ou "femelle", gaz: "3/4", "pe25" ou "pe16", prise: mm } (ou null : le robinet)
//   bas:  { z: L, x: 0, genre, gaz, prise }
// La double sortie déclare aussi `autres` : sa sortie droite. `x` d'un bout du bas n'est pas nul pour
// elle : chaque sortie est à côté de l'axe de son entrée, et la pièce suivante se pose sur l'axe de la
// sortie qui porte l'arrosage. `prise` : la longueur du filetage mâle, ou la profondeur où la bouche
// femelle le reçoit ; deux pièces vissées se recouvrent du plus court des deux.

// L'écart entre deux pièces éclatées : 2 cm entre le bout de l'une et le bout de l'autre, comme la
// nourrice, si bien que chaque filetage se voit en entier.
export var ECART = 20;

// LES TROIS PROGRAMMATEURS, et la sortie de la double sortie où chacun se visse. L'arrosage prend la
// sortie GAUCHE, comme sur le plan au robinet, SAUF le Rain Bird : son boîtier part d'un seul côté de
// l'eau, vers la droite quand son écran est de face ; sur la sortie gauche, il passait sous la sortie
// droite et la bouchait au client. Le tourner pour l'éviter mettait son écran contre le mur. Il prend
// donc la sortie droite, son boîtier vers l'extérieur, et la gauche reste au client. Le Solem est
// pareil sur ses deux flancs, son boîtier se tourne vers l'extérieur sans rien cacher ; celui du Buddy
// tient sous la sortie sans atteindre l'autre.
export var PROGRAMMATEURS = {
  solem: { cle: "programmateur-SP1151", sortie: "gauche", nom: "Solem BL-NR" },
  rainbird: { cle: "programmateur-rainbird", sortie: "droite", nom: "Rain Bird" },
  buddy: { cle: "programmateur-AEV11401", sortie: "gauche", nom: "Buddy" }
};
// LES TROIS DÉPARTS : le raccord qui se visse sous le programmateur, puis le tuyau. Le Ø25 et le Ø32 ne
// font qu'un : le PEHD de la nourrice et le raccord femelle 25 (sa demande : « que le PEHD soit en 25
// ou 32, tu prends le même »). Le Ø16, rigide ou souple, prend le tube de sa photo.
export var DEPARTS = {
  r16: { pieces: ["raccord-plasson16", "tube16"], nom: "en Ø16 rigide" },
  s16: { pieces: ["embout-MID6362", "tube16"], nom: "en Ø16 souple" },
  pe25: { pieces: ["raccord-femelle25", "pehd"], nom: "en PEHD Ø25 ou Ø32" }
};

// La pile d'une combinaison, du haut vers le bas (les clés de pieces/index.js). La planche montre
// toujours la double sortie et un programmateur ; l'écran du plan au robinet suit ce que le plan a
// retenu : la double sortie est un interrupteur (éteint d'office, sa décision), et quand la nourrice
// reste (`programmateur: null`), rien ne se visse au robinet que le départ.
//   pile({ programmateur: "solem", double: true, depart: "pe25" })
export function pile(o) {
  var p = o.programmateur ? PROGRAMMATEURS[o.programmateur] : null, d = DEPARTS[o.depart];
  if ((o.programmateur && !p) || !d) throw new Error("Aucune combinaison « " + o.programmateur + " » et « " + o.depart + " »");
  var liste = ["robinet-laiton"];
  if (o.double) liste.push({ cle: "double-sortie-BRO3493", sortie: p ? p.sortie : "gauche" });
  if (p) liste.push(p.cle);
  return liste.concat(d.pieces);
}

// Deux bouts se vissent-ils ? Un mâle dans une femelle, du même filetage.
function accord(a, b) { return !!(a && b && a.genre !== b.genre && a.gaz === b.gaz); }

// Rend { pieces, colonnes, erreurs } : chaque pose porte, comme celles de la nourrice, sa place montée
// et éclatée ([x, z]), lue par la scène (par `place`, de nourrice-3d/composition.js). Un élément de la
// pile est une clé, ou { cle, sortie } pour la double sortie.
export function composer(elements, pieces) {
  var poses = [], colonnes = [], erreurs = [], avant = null;
  elements.forEach(function (el) {
    var cle = typeof el === "string" ? el : el.cle, d = pieces[cle];
    if (!d) { erreurs.push("La pièce « " + cle + " » n'existe pas"); return; }
    var x = 0, zM = 0, zE = 0;
    if (avant) {
      if (!accord(avant.bout, d.haut)) erreurs.push(avant.cle + " ne se visse pas dans " + cle);
      var prise = Math.min(avant.bout.prise, d.haut ? d.haut.prise : 0);
      x = avant.x + (avant.bout.x || 0);
      zM = avant.zM + avant.bout.z - prise;
      zE = avant.zE + avant.bout.z + ECART;
    }
    // Une colonne par axe : la scène s'en sert pour mesurer qu'un bout est bien sur le sien.
    var col = colonnes.filter(function (c) { return c.xMonte === x; })[0];
    if (!col) { col = { xMonte: x, xEclate: x, pieces: [] }; colonnes.push(col); }
    var pose = { cle: cle, rang: "colonne", colonne: colonnes.indexOf(col), retourne: false, L: d.bas.z, monte: [x, zM], eclate: [x, zE], indice: poses.length };
    poses.push(pose); col.pieces.push(pose.indice);
    var bout = el.sortie === "droite" ? (d.autres || [])[0] : d.bas;
    if (!bout) erreurs.push(cle + " n'a pas de sortie « " + el.sortie + " »");
    avant = { cle: cle, bout: bout || d.bas, x: x, zM: zM, zE: zE };
  });
  return { pieces: poses, colonnes: colonnes, erreurs: erreurs };
}
