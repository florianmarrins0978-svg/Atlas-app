// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "raccord-plasson16": function (F) {
    var lot = new F.Lot();
    lot.ajouter("noirLisse", F.cylindre(18, 0, 70));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 12 }, bas: { z: 70, x: 0, genre: "femelle", gaz: "pe16", prise: 25 } };
  }
};
