// LA PILE DU ROBINET EN 3D : quelle pièce, à quelle place, montée et éclatée.
//
// Sa demande du 22 novembre 2026 : « fais-moi qu'une seule des 9 combinaisons possibles pour l'instant
// pour voir si j'aime comment tu fais, je veux la même qualité que la nourrice qui est dans l'appli en
// 3D ». Les neuf : trois programmateurs en nez de robinet (Solem BL-NR, Rain Bird, Buddy) et trois
// départs (Ø16 rigide, Ø16 souple, PEHD Ø25 ou Ø32). Celle-ci : la double sortie, le Solem, le Ø25.
// Au nez de robinet il n'y a pas de nourrice (sa règle du 18 octobre 2026) : c'est une pile, de son
// robinet jusqu'au tuyau.
//
// Comme la nourrice (appli/nourrice-3d/composition.js), elle ne dessine rien et ne connaît pas three :
// chaque pièce est posée par le bout qui se visse dans la pièce d'au-dessus, jamais à l'oeil.
//
// LE REPÈRE, en millimètres, celui de la scène de la nourrice : la pile court sur Z, du robinet (z
// petit) vers le tuyau (z grand). X va de gauche à droite quand on la regarde de face ; Y vient vers
// celui qui regarde. Vue « de face », la pile est donc debout : le robinet en haut, le tuyau en bas.
//
// CE QU'UNE PIÈCE DÉCLARE. Elle est modélisée sur son axe Z local, de son bout du haut (z = 0, x = 0)
// à son bout du bas :
//   haut: { z: 0, genre: "male" ou "femelle", gaz: "3/4" ou "pe25", prise: mm } (ou null : le robinet)
//   bas:  { z: L, x: 0, genre, gaz, prise }
// `x` du bas n'est pas nul pour la double sortie : sa sortie gauche, celle de l'arrosage (son choix du
// 18 octobre 2026, la sortie GAUCHE), est à côté de l'axe de son entrée. La pièce suivante se pose
// sur l'axe de cette sortie. `prise` : la longueur du filetage mâle, ou la profondeur où la bouche
// femelle le reçoit ; deux pièces vissées se recouvrent du plus court des deux.

// L'écart entre deux pièces éclatées : 2 cm entre le bout de l'une et le bout de l'autre, comme la
// nourrice, si bien que chaque filetage se voit en entier.
export var ECART = 20;

// La combinaison montrée, du haut vers le bas (les clés de pieces/index.js).
export var PILE = ["robinet-laiton", "double-sortie-BRO3493", "programmateur-SP1151", "raccord-femelle25", "pehd"];

// Deux bouts se vissent-ils ? Un mâle dans une femelle, du même filetage.
function accord(a, b) { return !!(a && b && a.genre !== b.genre && a.gaz === b.gaz); }

// Rend { pieces, colonnes, erreurs } : chaque pose porte, comme celles de la nourrice, sa place montée
// et éclatée ([x, z]), lue par la scène (nourrice-3d/scene.js, par `place`).
export function composer(cles, pieces) {
  var poses = [], colonnes = [], erreurs = [], avant = null;
  cles.forEach(function (cle) {
    var d = pieces[cle];
    if (!d) { erreurs.push("La pièce « " + cle + " » n'existe pas"); return; }
    var x = 0, zM = 0, zE = 0;
    if (avant) {
      if (!accord(avant.def.bas, d.haut)) erreurs.push(avant.cle + " ne se visse pas dans " + cle);
      var prise = Math.min(avant.def.bas.prise, d.haut ? d.haut.prise : 0);
      x = avant.x + (avant.def.bas.x || 0);
      zM = avant.zM + avant.def.bas.z - prise;
      zE = avant.zE + avant.def.bas.z + ECART;
    }
    // Une colonne par axe : la scène s'en sert pour mesurer qu'un bout est bien sur le sien.
    var col = colonnes.filter(function (c) { return c.xMonte === x; })[0];
    if (!col) { col = { xMonte: x, xEclate: x, pieces: [] }; colonnes.push(col); }
    var pose = { cle: cle, rang: "colonne", colonne: colonnes.indexOf(col), retourne: false, L: d.bas.z, monte: [x, zM], eclate: [x, zE], indice: poses.length };
    poses.push(pose); col.pieces.push(pose.indice);
    avant = { cle: cle, def: d, x: x, zM: zM, zE: zE };
  });
  return { pieces: poses, colonnes: colonnes, erreurs: erreurs };
}
