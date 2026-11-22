// LES MAMELONS DURA (réduit MM 1" x 3/4", fileté MM 1") et le tuyau PEHD Ø25. Pièces de colonne, sur
// l'axe Z.
//
// LES COTES DU MAMELON RÉDUIT sont relevées sur sa photo de profil (appli/arrosage-photos/
// mamelon-dessus-naturel.png, le 3/4" en haut), le sommet du filetage 1" pour étalon (13,77 pixels par
// millimètre) : 45,2 mm de long ; le filetage 3/4" sur 14,1 mm ; une collerette ronde de 33,8 mm posée
// sur le six pans ; le six pans, 11,3 mm d'épaisseur, 45,7 mm sur angles donc 39,6 sur plats ; le
// filetage 1" sur 15,6 mm. Le mamelon fileté 1" n'a qu'une photo de trois quarts (mamelon-droit-1.jpg) :
// il reprend les cotes du côté 1" du réduit, des deux côtés.
// Le pas du 3/4" est celui de la norme (14 filets au pouce) : sa photo montre des filets plus gros, comme
// sur toutes ses pièces moulées, mais un pas ne se relève pas à l'oeil.

var SIX_PANS = 39.6, EPAISSEUR = 11.3;

// Un bout fileté de mamelon, de la pointe (z = 0) à l'épaulement (z = long), puis un dégagement lisse
// jusqu'au six pans. `alesage` est le passage de l'eau de ce côté.
function boutFilete(F, lot, gaz, long, alesage, place) {
  var fond = F.rayonDuFond({ gaz: gaz });
  lot.ajouter("pvc", F.filetage({ gaz: gaz, z0: 0.9, z1: long, entree: 0.5, sortie: 0.4, segments: 32 }), place);
  // La pointe, de l'alésage vers le dehors (la matière à gauche du trait) : l'alésage, la face du bout
  // (deux cercles sur son plan, que la scène mesure), puis le chanfrein d'entrée.
  lot.ajouter("pvc", F.tourne([[alesage, long + 1.4], [alesage, 0, { c: 0.4 }], [fond - 0.7, 0, { a: 0.3 }], [fond, 0.9]], { segments: 32 }), place);
  lot.ajouter("pvc", F.tourne([[fond, long], [fond, long + 1.4]], { segments: 32 }), place);
}

function mamelon(F, gazHaut, longHaut, alesageHaut, collerette) {
  var lot = new F.Lot(), longBas = 15.6, degage = 1.4, zHex = longHaut + degage + (collerette ? 1.4 : 0), L = zHex + EPAISSEUR + degage + longBas;
  boutFilete(F, lot, gazHaut, longHaut, alesageHaut, null);
  // La collerette ronde du réduit, entre le filetage 3/4" et le six pans.
  if (collerette) lot.ajouter("pvc", F.tourne([[F.rayonDuFond({ gaz: gazHaut }), zHex - 2.6], [16.9, zHex - 2.4, { a: 1.1 }], [16.9, zHex + 0.2]], { segments: 40 }));
  // Un six pans moulé : ses angles sont à peine cassés, pas chanfreinés comme un écrou tourné.
  lot.ajouter("pvc", F.hexagone({ surPlats: SIX_PANS, z0: zHex, z1: zHex + EPAISSEUR, alesage: alesageHaut, depart: 1.1 }));
  // Le côté 1" est le même bout, retourné : sa pointe en z = L.
  boutFilete(F, lot, "1", longBas, 12, { ry: Math.PI, z: L });
  // Dedans, le passage se resserre du côté le plus étroit.
  if (alesageHaut < 12) lot.ajouter("pvc", F.tourne([[12, zHex + EPAISSEUR - 2], [alesageHaut, zHex + EPAISSEUR - 2]], { segments: 32 }));
  return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: gazHaut, prise: longHaut }, bas: { z: L, genre: "male", gaz: "1", prise: longBas } };
}

export default {
  // Le réduit : le 3/4" en haut, le 1" en bas (la composition le retourne quand il le faut).
  "mamelon": function (F) { return mamelon(F, "3/4", 14.1, 9.5, true); },
  "mamelon-droit-1": function (F) { return mamelon(F, "1", 15.6, 12, false); },

  // LE PEHD Ø25 : ses tubes sont du 25 x 3,0 (19 mm de passage), noirs à bandes bleues. Sur sa photo
  // (pehd.jpg, le diamètre de 25 mm pour étalon) une bande fait 2,8 mm de large ; elles sont quatre, à
  // un quart de tour l'une de l'autre. La bande est dans la peau du tube, pas posée dessus : la surface
  // se fait par secteurs, noir puis bleu. 150 mm de tuyau : 34 entrent dans le raccord, le reste se voit
  // (un choix, la longueur d'un tuyau n'a pas de cote).
  "pehd": function (F) {
    var lot = new F.Lot(), L = 150, R = 12.5, passage = 9.5, c = 0.5, bande = 2.8 / R, quart = Math.PI / 2;
    for (var i = 0; i < 4; i++) {
      var a = i * quart + 0.6;
      lot.ajouter("bleu", F.tourne([[R, c], [R, L - c]], { arc: [a, a + bande], segments: 3 }));
      lot.ajouter("pehd", F.tourne([[R, c], [R, L - c]], { arc: [a + bande, a + quart], segments: 14 }));
    }
    // Les deux bouts coupés net, à peine cassés, et le passage.
    lot.ajouter("pehd", F.tourne([[R, L - c], [R - c, L], [passage, L], [passage, 0], [R - c, 0], [R, c]], { segments: 68 }));
    return { couches: lot.couches(), haut: { z: 0, genre: "male", gaz: "pe25", prise: 34 }, bas: { z: L, genre: "male", gaz: "pe25", prise: 0 } };
  }
};
