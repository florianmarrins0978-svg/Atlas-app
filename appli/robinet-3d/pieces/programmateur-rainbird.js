// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "programmateur-rainbird": function (F) {
    var lot = new F.Lot();
    lot.ajouter("vertRainBird", F.cylindre(18, 0, 120));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 12 }, bas: { z: 120, x: 0, genre: "male", gaz: "3/4", prise: 12 } };
  }
};
