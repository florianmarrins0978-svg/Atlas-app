// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "double-sortie-BRO3493": function (F) {
    var lot = new F.Lot();
    lot.ajouter("nickelSable", F.cylindre(15, 0, 70));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 14 }, bas: { z: 70, x: -60, genre: "male", gaz: "3/4", prise: 12 } };
  }
};
