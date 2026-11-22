// ÉBAUCHE, remplacée par la pièce relevée sur sa photo.
export default {
  "robinet-laiton": function (F) {
    var lot = new F.Lot();
    lot.ajouter("laiton", F.cylindre(15, 0, 120));
    return { couches: lot.couches(), haut: null, bas: { z: 120, x: 0, genre: "male", gaz: "3/4", prise: 14 } };
  }
};
