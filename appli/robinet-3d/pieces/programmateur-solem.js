// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "programmateur-SP1151": function (F) {
    var lot = new F.Lot();
    lot.ajouter("vert", F.cylindre(15, 0, 110));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 12 }, bas: { z: 110, x: 0, genre: "male", gaz: "3/4", prise: 12 } };
  }
};
