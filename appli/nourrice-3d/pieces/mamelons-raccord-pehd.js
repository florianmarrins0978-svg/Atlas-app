// LES MAMELONS DURA (réduit MM 1" x 3/4", fileté MM 1"), le RACCORD MÂLE PLASSON 25 x 1" et le tuyau
// PEHD Ø25. Pièces de colonne, sur l'axe Z.

function mamelon(F, gazHaut, gazBas) {
  var lot = new F.Lot(), lh = gazHaut === "1" ? 18 : 15, lb = gazBas === "1" ? 18 : 15, hex = 12, L = lh + hex + lb;
  var fh = F.rayonDuFond({ gaz: gazHaut }), fb = F.rayonDuFond({ gaz: gazBas }), al = gazHaut === "1" && gazBas === "1" ? 12.5 : 9.5;
  lot.ajouter("pvc", F.filetage({ gaz: gazHaut, z0: 0, z1: lh }));
  lot.ajouter("pvc", F.hexagone({ surPlats: 41, z0: lh, z1: lh + hex, alesage: al }));
  lot.ajouter("pvc", F.filetage({ gaz: gazBas, z0: lh + hex, z1: L, pointe: "z1" }));
  lot.ajouter("pvc", F.tourne([[al, 0], [fh, 0]], { segments: 44 }));
  lot.ajouter("pvc", F.tourne([[fb, L], [al, L], [al, 0]], { segments: 44 }));
  return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: gazHaut, prise: lh }, bas: { z: L, genre: "male", gaz: gazBas, prise: lb } };
}

export default {
  // Le réduit : le 3/4" en haut, le 1" en bas (la composition le retourne quand il le faut).
  "mamelon": function (F) { return mamelon(F, "3/4", "1"); },
  "mamelon-droit-1": function (F) { return mamelon(F, "1", "1"); },
  "raccord-male25": function (F) {
    var lot = new F.Lot(), fond = F.rayonDuFond({ gaz: "1" }), L = 96;
    lot.ajouter("noirLisse", F.filetage({ gaz: "1", z0: 0, z1: 18 }));
    lot.ajouter("noirLisse", F.tourne([[10, 0], [fond, 0]], { segments: 44 }));
    lot.ajouter("noirLisse", F.tourne([[fond, 18], [24, 22, { a: 1 }], [24, 50], [10, 50], [10, 0]], {}));
    lot.ajouter("blanc", F.tourne([[12.7, 46], [27, 46, { a: 2 }], [27, 84, { a: 2 }], [21, 86], [21, L, { c: 1 }], [12.7, L], [12.7, 46]], {}));
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "1", prise: 18 }, bas: { z: L, genre: "femelle", gaz: "pe25", prise: 34 } };
  },
  "pehd": function (F) {
    var lot = new F.Lot(), L = 150;
    lot.ajouter("pehd", F.cylindre(12.5, 0, L, { alesage: 9.5, c: 0.4 }));
    for (var i = 0; i < 4; i++) lot.ajouter("bleu", F.tourne([[12.5, 0.4], [12.56, 0.4], [12.56, L - 0.4], [12.5, L - 0.4]], { arc: [i * Math.PI / 2 + 0.6, i * Math.PI / 2 + 0.6 + 0.2], segments: 4 }));
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "pe25", prise: 34 }, bas: { z: L, genre: "male", gaz: "pe25", prise: 0 } };
  }
};
