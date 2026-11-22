// LES COUDES ET LE TÉ DURA, en PVC gris clair : Coude 90° taraudé/fileté MF 1", Coude 1" FF, Té 1" MFF.
// Pièces de la rangée du haut : l'axe de la rangée est l'axe X local (y = 0, z = 0), la branche où une
// colonne se visse part vers +Z.

var RHO = 21, R = 19.5, ECROU = 36, FILET = 18;

function brasFilete(F, lot, x0) {   // un bras vers +X, terminé par son filetage mâle 1"
  var fond = F.rayonDuFond({ gaz: "1" });
  lot.ajouter("pvc", F.coucher(F.tourne([[14, x0], [R, x0], [R, x0 + 8, { a: 1.5 }], [fond, x0 + 10]], {})));
  lot.ajouter("pvc", F.coucher(F.filetage({ gaz: "1", z0: x0 + 10, z1: x0 + 10 + FILET, pointe: "z1" })));
  lot.ajouter("pvc", F.coucher(F.tourne([[fond, x0 + 10 + FILET], [14, x0 + 10 + FILET], [14, x0]], { segments: 40 })));
  return x0 + 10 + FILET;
}
function brancheEcrou(F, lot, z0) {   // une branche vers +Z, terminée par son écrou union
  lot.ajouter("pvc", F.tourne([[14, z0], [R, z0], [R, z0 + 6], [17, z0 + 6], [17, z0 + 8]], {}));
  lot.ajouter("pvc", F.ecrouUnion({ longueur: ECROU }), { z: z0 + 6 });
  return z0 + 6 + ECROU;
}
function brasEcrouAGauche(F, lot, x0) {   // un bras vers -X, terminé par son écrou union
  lot.ajouter("pvc", F.placer(F.coucher(F.tourne([[14, x0], [R, x0], [R, x0 + 6], [17, x0 + 6], [17, x0 + 8]], {})), { rz: Math.PI }));
  lot.ajouter("pvc", F.placer(F.coucher(F.placer(F.ecrouUnion({ longueur: ECROU }), { z: x0 + 6 })), { rz: Math.PI }));
  return -(x0 + 6 + ECROU);
}

export default {
  "coude-mf": function (F) {
    var lot = new F.Lot();
    lot.ajouter("pvc", F.coude({ cintrage: RHO, rayon: R }));
    var pointe = brasFilete(F, lot, RHO), bouche = brancheEcrou(F, lot, RHO);
    return { couches: lot.couches(), gauche: null, droite: { x: pointe, genre: "male", gaz: "1", prise: FILET },
      branches: [{ x: 0, z: bouche, genre: "femelle", gaz: "1", prise: 17 }] };
  },
  "coude-ff": function (F) {
    var lot = new F.Lot();
    lot.ajouter("pvc", F.placer(F.coude({ cintrage: RHO, rayon: R }), { rz: Math.PI }));
    var face = brasEcrouAGauche(F, lot, RHO), bouche = brancheEcrou(F, lot, RHO);
    return { couches: lot.couches(), gauche: { x: face, genre: "femelle", gaz: "1", prise: 17 }, droite: null,
      branches: [{ x: 0, z: bouche, genre: "femelle", gaz: "1", prise: 17 }] };
  },
  "te-mmf": function (F) {
    var lot = new F.Lot();
    lot.ajouter("pvc", F.coucher(F.cylindre(R, -30, 30, { alesage: 14 })));
    var face = brasEcrouAGauche(F, lot, 24), pointe = brasFilete(F, lot, 24), bouche = brancheEcrou(F, lot, 12);
    return { couches: lot.couches(), gauche: { x: face, genre: "femelle", gaz: "1", prise: 17 }, droite: { x: pointe, genre: "male", gaz: "1", prise: FILET },
      branches: [{ x: 0, z: bouche, genre: "femelle", gaz: "1", prise: 17 }] };
  }
};
