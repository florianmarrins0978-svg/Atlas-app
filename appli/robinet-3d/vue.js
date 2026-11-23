// LA PILE DU ROBINET EN 3D, PRÊTE À POSER : la scène de la nourrice, debout, les pièces du robinet,
// leur composition, et le toucher qui éclate.
//
//   var v = ouvrirRobinet(toile, { hdri: "vendor/hdri/studio.exr" });
//   v.montrer({ programmateur: "solem", double: true, depart: "pe25" });   // composition.js, `pile`
//   v.eclater(true);           // ou un toucher sur la pile
//   v.regarder("face");        // "face" ou "biais"
//   v.surEtat(function (e) { e.eclatee, e.vue });
//   v.detruire();
//
// Deux endroits la montrent, et c'est la même : la planche (appli/arrosage-robinet-3d.html) et l'écran
// du plan au robinet dans l'appli (src/app/paysage/arrosage/Robinet3D.tsx).
//
// LA SCÈNE est celle de la nourrice (nourrice-3d/scene.js), avec `debout` : la pile pend du robinet, et
// le doigt tourne autour d'elle. LE TOUCHER est celui de la nourrice (nourrice-3d/toucher.js).
//
// Lève une erreur si WebGL 2 manque : à l'appelant de dire la phrase, ou de montrer autre chose.

import { creerScene } from "../nourrice-3d/scene.js";
import { creerMatieres } from "../nourrice-3d/matieres.js";
import { brancherToucher } from "../nourrice-3d/toucher.js";
import { ajouterMatieres } from "./matieres.js";
import { creerPieces } from "./pieces/index.js";
import { composer, pile } from "./composition.js";

export function ouvrirRobinet(toile, o) {
  var essai = document.createElement("canvas").getContext("webgl2");
  if (!essai) throw new Error("WebGL 2 absent");
  var matieres = ajouterMatieres(creerMatieres()), S = creerScene(toile, { matieres: matieres, hdri: o.hdri, debout: true });
  var pieces = creerPieces(), compo = null;
  var etat = { eclatee: false, vue: "face" }, ecoutes = [];
  function dire() { ecoutes.forEach(function (f) { f({ eclatee: etat.eclatee, vue: etat.vue }); }); }

  // Une autre combinaison : la pile se repose, montée ou éclatée comme elle l'était, et le cadre suit
  // (depuis le point de vue choisi, ou depuis celui où le doigt l'a laissée). Une composition dont deux
  // pièces ne se vissent pas l'une dans l'autre ne se pose pas : elle lève, et l'appelant le dit.
  function montrer(choix) {
    var neuve = composer(pile(choix), pieces);
    if (neuve.erreurs.length) throw new Error("La pile du robinet ne se compose pas : " + neuve.erreurs.join(" ; "));
    compo = neuve;
    S.poser(compo, pieces);
    if (etat.vue) S.regarder(etat.vue, false); else S.recadrer();
  }

  // Tourner la vue à la main défait le point de vue choisi.
  S.surVue(function (vue) { etat.vue = vue ? etat.vue : ""; dire(); });

  function eclater(oui) {
    if (oui === etat.eclatee) return;
    etat.eclatee = oui; dire(); S.eclater(oui ? 1 : 0);
  }
  function regarder(vue) { etat.vue = vue; dire(); S.regarder(vue, true); }

  var debrancher = brancherToucher(toile, S, function () { eclater(!etat.eclatee); });

  function detruire() {
    debrancher();
    S.detruire();
    Object.keys(pieces).forEach(function (cle) { pieces[cle].couches.forEach(function (c) { c.geometrie.dispose(); }); });
    Object.keys(matieres).forEach(function (cle) { matieres[cle].dispose(); });
    pieces = {}; ecoutes = [];
  }

  return {
    scene: S, montrer: montrer, eclater: eclater, regarder: regarder, detruire: detruire,
    surEtat: function (f) { ecoutes.push(f); },
    etat: function () { return { eclatee: etat.eclatee, vue: etat.vue }; },
    erreurs: function () { return compo ? compo.erreurs.slice() : []; },
    compo: function () { return compo; }
  };
}
