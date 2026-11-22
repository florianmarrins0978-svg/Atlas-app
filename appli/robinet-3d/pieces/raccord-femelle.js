// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "raccord-femelle25": function (F) {
    var lot = new F.Lot();
    lot.ajouter("grisPlasson", F.cylindre(15, 0, 80));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 12 }, bas: { z: 80, x: 0, genre: "femelle", gaz: "pe25", prise: 34 } };
  }
};
