/* LE MOTEUR DES PLANCHES DE MISE EN PAGE DU DEVIS : la mise en page, en
   points, comme le générateur (src/server/pdf/document-commun.ts).

   Partagé par devis-mise-en-page.html (la règle) et
   devis-mise-en-page-questions.html (ses deux questions du 4 novembre 2026) :
   deux copies de la même règle finiraient par ne plus tomber au même point.

   Contrôle : la règle d'AUJOURD'HUI, rejouée par ce moteur, retombe sur le
   vrai PDF ligne pour ligne, page pour page, au point près, sur les trois
   devis (vérifié hors du dépôt ; le résultat est dans TODO.md).

   `espaces` (facultatif) : la question « un espace sans changer de page ».
   Un espace laisse la hauteur d'une ligne d'un seul libellé (11 + 19 points)
   devant l'élément ; en haut d'une page il ne laisse rien, comme un saut. */
var MISE_EN_PAGE = (function () {
  "use strict";
  var H = 841.89, M = 31.2;
  var HAUT_SUITE = H - M - 20;            /* pageSuivante() */
  var PLANCHER_AUJOURDHUI = M + 114;      /* PLANCHER, sur chaque page */
  var PLANCHER_MILIEU = M + 14;           /* au-dessus du numéro de page */
  /* Le pied SUIT les modalités, à l'écart qu'il a sur le devis de 4 lignes :
     sa demande du 4 novembre 2026, « que ce soit presque collé ». Ancré au bas
     de la page, il laissait un trou sous l'IBAN dès 20 lignes. Il doit encore
     tenir au-dessus du numéro de page : 72 points, plus cet écart. */
  var ECART_PIED = 3.6;
  var BAS_PIED = M + 10.8;
  var PLANCHER_DERNIERE = BAS_PIED + 72 + ECART_PIED;
  var ESPACE = 30;
  var BLOCS = {
    totaux: { verifie: 128, prend: 138, hauteur: 138 },
    notes: { verifie: 86, prend: 98, hauteur: 98 },
    modalites: { verifie: 38, prend: 38, hauteur: 41 }
  };

  function mettreEnPage(src, regle, sauts, espaces) {
    espaces = espaces || {};
    var pages = [];
    var page, y;
    function nouvelle(cle) { page = { el: [], saut: cle && sauts[cle] ? cle : null }; pages.push(page); y = HAUT_SUITE; }
    function poserTete() {
      page.el.push({ cle: "entete", page: 1, haut: src.th + 11, h: 26, dest: y + 11 });
      y -= 26;
    }
    /* L'espace ne compte que s'il n'est pas déjà en haut d'une page. */
    function enHaut() {
      return pages.length > 1 && page.el.every(function (e) { return e.cle === "entete"; });
    }
    function espaceDevant(cle) { return !sauts[cle] && espaces[cle] && !enHaut() ? ESPACE : 0; }
    function poserEspace(cle) {
      page.el.push({ cle: "espace", de: cle, h: ESPACE, dest: y + 11 });
      y -= ESPACE;
    }
    page = { el: [], saut: null };
    pages.push(page);
    page.el.push({ cle: "tete", page: 1, haut: H, h: H - (src.th + 11), dest: H });
    y = src.th;
    poserTete();

    var plancherLignes = regle === "aujourdhui" ? PLANCHER_AUJOURDHUI : PLANCHER_MILIEU;
    src.rangs.forEach(function (r, i) {
      var h = 11 * r[2] + 19, cle = "ligne-" + i;
      var espace = espaceDevant(cle);
      if (sauts[cle] || y - espace - h < plancherLignes) { nouvelle(cle); poserTete(); }
      else if (espace) poserEspace(cle);
      page.el.push({ cle: cle, page: r[0], haut: r[1] + 11, h: h, dest: y + 11 });
      y -= h;
    });

    var fin = ["totaux", "notes", "modalites"];
    function poser(cle) {
      var b = BLOCS[cle];
      if (espaceDevant(cle)) poserEspace(cle);
      page.el.push({ cle: cle, page: src[cle][0], haut: src[cle][1] + 11, h: b.hauteur, dest: y + 11 });
      y -= b.prend;
    }
    function tient(de, a, plancher) {
      var yy = y;
      for (var i = de; i <= a; i++) {
        if (!sauts[fin[i]] && espaces[fin[i]] && !(i === de && enHaut())) yy -= ESPACE;
        if (yy - BLOCS[fin[i]].verifie < plancher) return false;
        yy -= BLOCS[fin[i]].prend;
      }
      return true;
    }

    if (regle === "aujourdhui") {
      fin.forEach(function (cle) {
        if (sauts[cle] || y - BLOCS[cle].verifie < PLANCHER_AUJOURDHUI) nouvelle(cle);
        poser(cle);
      });
    } else {
      var j = 0;
      while (j < 3) {
        if (sauts[fin[j]]) nouvelle(fin[j]);
        var k = j;
        while (k + 1 < 3 && !sauts[fin[k + 1]]) k++;
        var plancher = k === 2 ? PLANCHER_DERNIERE : PLANCHER_MILIEU;
        if (tient(j, k, plancher)) {
          for (var i = j; i <= k; i++) poser(fin[i]);
          j = k + 1;
          continue;
        }
        /* Les totaux restent avec le tableau s'ils tiennent ; les notes, elles,
           partent avec les modalités. */
        if (j === 0 && tient(0, 0, PLANCHER_MILIEU)) {
          poser("totaux");
          nouvelle(null);
          j = 1;
          continue;
        }
        if (page.el.length) nouvelle(null);
        for (var n = j; n <= k; n++) poser(fin[n]);
        j = k + 1;
      }
    }

    var piedHaut = regle === "aujourdhui" ? 152 : y - ECART_PIED;
    page.el.push({ cle: "pied", page: src.pied, haut: 152, h: 72, dest: piedHaut });
    return pages;
  }

  return { mettreEnPage: mettreEnPage, H: H };
})();
