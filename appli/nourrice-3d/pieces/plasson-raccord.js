// LE RACCORD MÂLE PLASSON 25 x 1" : le filetage mâle 1" en haut, le corps noir, la bague blanche où entre
// le tuyau. Pièce de colonne, sur l'axe Z.

export default {
  "raccord-male25": function (F) {
    var lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" }), L = 96;
    lot.ajouter("noirLisse", F.filetage({ gaz: "1", z0: 0, z1: 18 }));
    lot.ajouter("noirLisse", F.tourne([[10, 0], [fond, 0]], { segments: 44 }));
    lot.ajouter("noirLisse", F.tourne([[fond, 18], [24, 22, { a: 1 }], [24, 50], [10, 50], [10, 0]], {}));
    lot.ajouter("blanc", F.tourne([[12.7, 46], [27, 46, { a: 2 }], [27, 84, { a: 2 }], [21, 86], [21, L, { c: 1 }], [12.7, L], [12.7, 46]], {}));
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "1", prise: 18 }, bas: { z: L, genre: "femelle", gaz: "pe25", prise: 34 } };
  }
};
