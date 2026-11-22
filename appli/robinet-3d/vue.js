// LA PILE DU ROBINET EN 3D, PRÊTE À POSER : la scène de la nourrice, les pièces du robinet, leur
// composition, sans ombres, et le toucher qui éclate.
//
//   var v = ouvrirRobinet(toile, { hdri: "vendor/hdri/studio.exr" });
//   v.eclater(true);           // ou un toucher sur la pile
//   v.regarder("face");        // "face" ou "biais"
//   v.surEtat(function (e) { e.eclatee, e.vue });
//
// LA SCÈNE est robinet-3d/scene.js : celle de la nourrice, la pile debout et sans ombres (sa demande du
// 22 novembre 2026, « on touche et on a l'éclaté sans ombre ») ; son en-tête dit pourquoi elle est à part.
//
// LE TOUCHER est celui de nourrice-3d/vue.js, recopié parce que cette planche n'est qu'une planche :
// retenue, la pile du robinet ira dans nourrice-3d/vue.js, et ce geste n'existera plus qu'une fois.

import { creerScene } from "./scene.js";
import { creerMatieres } from "../nourrice-3d/matieres.js";
import { ajouterMatieres } from "./matieres.js";
import { creerPieces } from "./pieces/index.js";
import { composer, PILE } from "./composition.js";


export function ouvrirRobinet(toile, o) {
  var essai = document.createElement("canvas").getContext("webgl2");
  if (!essai) throw new Error("WebGL 2 absent");
  var matieres = ajouterMatieres(creerMatieres()), S = creerScene(toile, { matieres: matieres, hdri: o.hdri });
  var pieces = creerPieces(), compo = composer(o.pile || PILE, pieces);
  var etat = { eclatee: false, vue: "face" }, ecoutes = [];
  function dire() { ecoutes.forEach(function (f) { f({ eclatee: etat.eclatee, vue: etat.vue }); }); }

  S.poser(compo, pieces);
  S.regarder(etat.vue, false);

  // Tourner la vue à la main défait le point de vue choisi.
  S.surVue(function (vue) { etat.vue = vue ? etat.vue : ""; dire(); });

  function eclater(oui) {
    if (oui === etat.eclatee) return;
    etat.eclatee = oui; dire(); S.eclater(oui ? 1 : 0);
  }
  function regarder(vue) { etat.vue = vue; dire(); S.regarder(vue, true); }

  // LE TOUCHER (nourrice-3d/vue.js). Un doigt posé puis levé sans bouger (moins de 6 px, moins de
  // 300 ms), sur la pile : elle s'éclate, ou se remonte. Glisser, pincer appartiennent à la vue.
  var doigt = null, doigts = 0;
  function poser(e) {
    doigts++;
    doigt = doigts === 1 && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  }
  function glisser(e) {
    if (doigt && e.pointerId === doigt.id && Math.hypot(e.clientX - doigt.x, e.clientY - doigt.y) >= 6) doigt = null;
  }
  function lever(e) {
    doigts = Math.max(0, doigts - 1);
    var d = doigt; if (!d || e.pointerId !== d.id) return;
    doigt = null;
    if (e.type !== "pointerup") return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 300 && S.touche(e.clientX, e.clientY)) eclater(!etat.eclatee);
  }
  function clavier(e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); eclater(!etat.eclatee); } }
  toile.addEventListener("pointerdown", poser);
  toile.addEventListener("pointermove", glisser);
  toile.addEventListener("pointerup", lever);
  toile.addEventListener("pointercancel", lever);
  toile.addEventListener("keydown", clavier);

  return {
    scene: S, eclater: eclater, regarder: regarder,
    surEtat: function (f) { ecoutes.push(f); },
    etat: function () { return { eclatee: etat.eclatee, vue: etat.vue }; },
    erreurs: function () { return compo.erreurs.slice(); },
    compo: compo, pieces: pieces
  };
}
