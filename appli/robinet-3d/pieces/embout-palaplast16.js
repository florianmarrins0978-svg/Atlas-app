// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "embout-MID6362": function (F) {
    var lot = new F.Lot();
    lot.ajouter("grisPalaplast", F.cylindre(18, 0, 80));
    return { couches: lot.couches(), haut: { z: 0, genre: "femelle", gaz: "3/4", prise: 12 }, bas: { z: 80, x: 0, genre: "femelle", gaz: "pe16", prise: 25 } };
  }
};
