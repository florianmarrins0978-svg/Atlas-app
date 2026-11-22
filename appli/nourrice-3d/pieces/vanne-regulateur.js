// LA VANNE 3/4" FF à manette rouge (la vanne avec vis de purge) et le RÉGULATEUR DE PRESSION FF 3/4".
// Pièces de colonne, sur l'axe Z.

export default {
  "vanne-purge": function (F) {
    var lot = new F.Lot(), L = 62, fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15, T = F.THREE;
    lot.ajouter("nickel", F.hexagone({ surPlats: 32, z0: 0, z1: 14, alesage: fond }));
    lot.ajouter("nickel", F.hexagone({ surPlats: 32, z0: L - 14, z1: L, alesage: fond }));
    lot.ajouter("nickel", F.tourne([[fond, 14], [17, 14], [22, 22, { a: 4 }], [22, 40, { a: 4 }], [17, 48], [fond, 48]], {}));
    lot.ajouter("nickel", F.taraudage({ gaz: "3/4", z0: 0.5, z1: 13 }));
    lot.ajouter("nickel", F.taraudage({ gaz: "3/4", z0: L - 13, z1: L - 0.5 }));
    lot.ajouter("laiton", new T.CylinderGeometry(5, 5, 14, 24), { y: 26, z: 31 });
    lot.ajouter("rouge", F.boite(14, 3, 92, 1.4), { y: 36, z: 31 - 30 });
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 13 }, bas: { z: L, genre: "femelle", gaz: "3/4", prise: 13 } };
  },
  "regulateur-ff34": function (F) {
    var lot = new F.Lot(), L = 96, fond = F.rayonDuFond({ gaz: "3/4" }) + 0.15;
    lot.ajouter("noir", F.tourne([[fond, 0], [17, 0, { c: 1 }], [17, 30], [27, 34, { a: 2 }], [27, 52, { a: 2 }], [22, 54], [21, L, { c: 1 }], [fond, L]], {}));
    lot.ajouter("noir", F.taraudage({ gaz: "3/4", z0: 0.5, z1: 14 }));
    lot.ajouter("noir", F.taraudage({ gaz: "3/4", z0: L - 14, z1: L - 0.5 }));
    lot.ajouter("noir", F.tourne([[fond, L - 14], [fond, 14]], { segments: 32 }));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 13.5 }, bas: { z: L, genre: "femelle", gaz: "3/4", prise: 13.5 } };
  }
};
