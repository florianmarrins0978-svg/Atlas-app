// LA NOURRICE EN 3D, PRÊTE À POSER : la scène, les pièces, la composition et le toucher, en un seul appel.
//
// Trois endroits la montrent, et c'est la même : la planche (appli/arrosage-nourrice-3d.html), la page
// des outils du site (appli/vente/outils.html) et l'écran du plan dans l'appli
// (src/app/paysage/arrosage/Nourrice3D.tsx). Le geste du toucher et le choix de la finesse vivaient dans
// la planche ; recopiés deux fois, ils auraient divergé (CLAUDE.md §3).
//
//   var v = ouvrirNourrice(toile, { ficheNourrice: CAT.ficheNourrice, hdri: "…/studio.exr" });
//   v.montrer(3, 1);          // 3 voies dont 1 en goutte-à-goutte
//   v.eclater(true);          // ou un toucher sur la nourrice
//   v.regarder("dessus");     // "biais", "dessus", "face"
//   v.choisir("mamelon");     // ses pièces gardent leur couleur, les autres se voilent ; null rend tout
//   v.surEtat(function (e) { e.eclatee, e.vue });
//   v.detruire();
//
// Lève une erreur si WebGL 2 manque : à l'appelant de dire la phrase, ou de montrer autre chose.

import { creerScene } from "./scene.js";
import { creerMatieres } from "./matieres.js";
import { creerPieces } from "./pieces/index.js";
import { composer } from "./composition.js";
import { brancherToucher } from "./toucher.js";

// LES PIÈCES, À DEUX FINESSES. La fine sert tant que la nourrice reste sous le plafond de triangles ;
// au-delà (quatre voies et plus, à peu près), chaque pièce est plus petite à l'écran et se construit plus
// légère. Le second jeu ne se fabrique que le jour où une grande nourrice est demandée.
var PLAFOND = 400000, LEGER = 0.6;

function triangles(compo, defs) {
  return compo.pieces.reduce(function (somme, p) { return somme + defs[p.cle].couches.reduce(function (s, c) { return s + c.geometrie.index.count / 3; }, 0); }, 0);
}

export function ouvrirNourrice(toile, o) {
  var essai = document.createElement("canvas").getContext("webgl2");
  if (!essai) throw new Error("WebGL 2 absent");
  var matieres = creerMatieres(), S = creerScene(toile, { matieres: matieres, hdri: o.hdri });
  var jeux = {}, etat = { voies: 0, goutte: 0, eclatee: false, vue: "biais", compo: null }, ecoutes = [];
  function pieces(k) { return jeux[k] || (jeux[k] = creerPieces(k)); }
  function dire() { ecoutes.forEach(function (f) { f({ eclatee: etat.eclatee, vue: etat.vue }); }); }

  // Tourner la vue à la main défait le point de vue choisi.
  S.surVue(function (vue) { etat.vue = vue; dire(); });

  // La fiche change : les pièces se reposent, montées ou éclatées comme elles l'étaient, et le cadre suit.
  function montrer(voies, goutte) {
    var fiche = o.ficheNourrice(voies, goutte);
    if (!fiche) throw new Error("Aucune fiche de nourrice pour " + voies + " voies");
    etat.voies = voies; etat.goutte = goutte;
    var compo = composer(fiche, voies, goutte, pieces(1));
    etat.compo = compo;
    S.poser(compo, triangles(compo, pieces(1)) > PLAFOND ? pieces(LEGER) : pieces(1));
    if (etat.vue) S.regarder(etat.vue, false); else S.recadrer();
    return fiche;
  }
  // L'éclaté : l'état se dit tout de suite, le mouvement suit.
  function eclater(oui) {
    if (oui === etat.eclatee) return;
    etat.eclatee = oui; dire(); S.eclater(oui ? 1 : 0);
  }
  function regarder(vue) { etat.vue = vue; dire(); S.regarder(vue, true); }

  // LE TOUCHER : sur la nourrice, il l'éclate ou la remonte (nourrice-3d/toucher.js, commun avec la pile du robinet).
  var debrancher = brancherToucher(toile, S, function () { eclater(!etat.eclatee); });

  function detruire() {
    debrancher();
    S.detruire();
    Object.keys(jeux).forEach(function (k) {
      Object.keys(jeux[k]).forEach(function (cle) { jeux[k][cle].couches.forEach(function (c) { c.geometrie.dispose(); }); });
    });
    Object.keys(matieres).forEach(function (cle) { matieres[cle].dispose(); });
    jeux = {}; ecoutes = [];
  }

  return {
    scene: S, montrer: montrer, eclater: eclater, regarder: regarder, detruire: detruire, choisir: S.choisir,
    surEtat: function (f) { ecoutes.push(f); },
    // LES NUMÉROS : celui de la légende, donné à la première pièce de chaque modèle dans l'ordre de la
    // composition (la rangée du haut, l'arrivée, puis les voies, le goutte-à-goutte en dernier). C'est
    // l'ordre du dessin d'avant (src/lib/arrosage/nourrice-eclatee.ts, `numero`) : une électrovanne
    // porte le même numéro sur chaque voie. Chaque entrée dit où la pièce est à l'écran.
    numeros: function () {
      var ordre = [];
      return S.ecran().map(function (e) {
        var i = ordre.indexOf(e.cle); if (i < 0) { ordre.push(e.cle); i = ordre.length - 1; }
        e.numero = i + 1; return e;
      });
    },
    // LES COLONNES : l'arrivée, puis une par voie, le goutte-à-goutte en dernier, chacune avec les indices
    // de ses pièces du haut vers le bas. Les mots du bas (« Arrivée d'eau », R1, R2…) s'y accrochent.
    colonnes: function () {
      return etat.compo ? etat.compo.colonnes.map(function (c) { return { arrivee: c.arrivee, goutte: c.goutte, pieces: c.pieces.slice() }; }) : [];
    },
    etat: function () { return { voies: etat.voies, goutte: etat.goutte, eclatee: etat.eclatee, vue: etat.vue }; },
    erreurs: function () { return etat.compo ? etat.compo.erreurs : []; }
  };
}
