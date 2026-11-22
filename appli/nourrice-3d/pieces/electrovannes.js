// LES ÉLECTROVANNES RAIN BIRD 100 DV 1" : MM 9V (deux filetages mâles) et FF 9V (deux bouches
// taraudées). Pièces de colonne : le passage de l'eau est sur l'axe Z, le couvercle et la bobine sont
// vers le haut (+Y).

function electrovanne(F, male) {
  var lot = new F.Lot(), L = male ? 139 : 112, c = L / 2, fond = F.rayonDuFond({ gaz: "1" }), T = F.THREE;
  if (male) {
    lot.ajouter("noir", F.filetage({ gaz: "1", z0: 0, z1: 18 }));
    lot.ajouter("noir", F.filetage({ gaz: "1", z0: L - 18, z1: L, pointe: "z1" }));
    lot.ajouter("noir", F.tourne([[13, 0], [fond, 0], [fond, 0.01]], { segments: 44 }));
    lot.ajouter("noir", F.tourne([[fond, L], [13, L], [13, 0]], { segments: 44 }));
    lot.ajouter("noir", F.cylindre(18, 18, L - 18, { alesage: 13 }));
  } else {
    lot.ajouter("noir", F.cylindre(21, 0, L, { alesage: fond + 0.15, c: 1 }));
    lot.ajouter("noir", F.taraudage({ gaz: "1", z0: 0.5, z1: 17 }));
    lot.ajouter("noir", F.taraudage({ gaz: "1", z0: L - 17, z1: L - 0.5 }));
  }
  var bol = F.tourne([[0, -34], [28, -34, { a: 4 }], [36, 6, { a: 2 }], [38, 6], [38, 12, { c: 0.8 }], [0, 12]], {});
  lot.ajouter("noir", bol, { rx: -Math.PI / 2, z: c });
  for (var i = 0; i < 4; i++) {
    var a = Math.PI / 4 + i * Math.PI / 2;
    lot.ajouter("inox", F.visCruciforme({ rayon: 3.6, rondelle: { rayon: 4.6, epaisseur: 0.8 } }), { rx: -Math.PI / 2, x: Math.cos(a) * 33, y: 13, z: c + Math.sin(a) * 33 });
  }
  var bobine = new T.CylinderGeometry(15, 15, 38, 40); lot.ajouter("noir", bobine, { x: 24, y: 31, z: c - 10 });
  var pastille = new T.CylinderGeometry(10, 10, 1.2, 40); lot.ajouter("rougeBobine", pastille, { x: 24, y: 50.5, z: c - 10 });
  lot.ajouter("filRouge", F.fil([[21, 50, c - 13], [18, 85, c - 22], [28, 104, c - 36], [38, 82, c - 26], [30, 50, c - 12]], 1.5));
  lot.ajouter("filNoir", F.fil([[25, 50, c - 6], [26, 80, c - 14], [38, 96, c - 26], [44, 76, c - 18], [33, 50, c - 6]], 1.5));
  var bout = male ? { genre: "male", gaz: "1", prise: 18 } : { genre: "femelle", gaz: "1", prise: 16.5 };
  return { couches: lot.couches(), haut: Object.assign({ z: 0 }, bout), bas: Object.assign({ z: L }, bout) };
}

export default {
  "electrovanne-100dv": function (F) { return electrovanne(F, true); },
  "electrovanne-100dv-ff": function (F) { return electrovanne(F, false); }
};
