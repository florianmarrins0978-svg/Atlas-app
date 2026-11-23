// LE TUBE Ø16, rigide ou souple : le même à l'oeil (sa demande du 22 novembre 2026 : pour le Ø16,
// « à la photo ça ne se verra pas pareil », donc le tube de sa photo, et pas le PEHD de la nourrice).
// Pièce de colonne, sur l'axe Z local, de son bout du haut (z = 0, celui qui entre dans le raccord) à
// son bout du bas (z = L, coupé comme le PEHD de la nourrice, 150 mm).
//
// D'OÙ VIENNENT LES COTES. Sa photo (docs/robinet-3d-photos/tube-16.jpg, 896 x 1200) : un tube noir mat,
// sans bande, coupé net. Le diamètre est le Ø16 du nom. L'épaisseur se lit sur la tranche du haut :
// environ 15 px de paroi pour 180 px de diamètre, soit 1,3 mm ; 1,4 mm est retenu, la tranche étant
// vue de biais. Le noir mat est celui du PEHD de la nourrice.
//
// LA PRISE. Le tube ne décide pas de la profondeur où il entre : c'est la butée du raccord qui la
// donne. Il déclare donc une prise plus longue que celle de tout raccord Ø16, et la composition
// retient la plus courte des deux.

var L = 150, R = 8, PAROI = 1.4, CASSE = 0.35;

export default {
  "tube16": function (F) {
    var lot = new F.Lot(), passage = R - PAROI;
    // Un seul profil, comme le PEHD de la nourrice : la peau, les deux bouts coupés net et à peine
    // cassés, et la paroi du dedans.
    lot.ajouter("pehd", F.tourne([[R, CASSE], [R, L - CASSE], [R - CASSE, L], [passage, L], [passage, 0], [R - CASSE, 0], [R, CASSE]], { segments: 56 }));
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "pe16", prise: 40 }, bas: { z: L, genre: "male", gaz: "pe16", prise: 0 } };
  }
};
