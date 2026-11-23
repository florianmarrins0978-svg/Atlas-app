// DEUX NOURRICES : la composition d'une seule (composition.js), posée deux fois.
//
// À part de composition.js, et c'est voulu : l'empreinte des photos de l'éclaté du PDF
// (scripts/_nourrice-3d.ts) lit ce qui dessine UNE nourrice. Poser la seconde ne change aucune pièce ;
// rangé là, il périmait les vingt-huit photos pour rien.

// DEUX NOURRICES, LA MÊME DUPLIQUÉE — au-delà de six voies (sa règle du 23 novembre 2026, CATALOGUE.
// fichesNourrices : moitié-moitié, chacune dans son regard). Sa consigne devant la planche
// (appli/arrosage-deux-nourrices.html) : « ne refais pas un truc en 3D. Tu prends par exemple une nourrice
// 4 voies et du coup tu la dupliques pour refaire une deuxième nourrice 4 voies à côté », puis, devant les
// deux dispositions, la première. Chaque nourrice se compose seule ; la seconde se pose à droite de la
// première, montée comme éclatée, ou au-delà du bout de ses tuyaux (`dessous`, que la planche garde pour
// comparer). Les indices, les colonnes et les parents de la seconde suivent ceux de la première.
var ECART_MONTEE = 240, ECART_ECLATEE = 900, ECART_DESSOUS = 340; // mm ; à l'éclaté, les colonnes s'allongent et se penchent dans la vue de biais
export function aCote(c1, c2, dessous) {
  var dM = 0, dE = 0, zM = 0, zE = 0;
  if (dessous) {
    var bout = function (c, cle) { return c.pieces.reduce(function (m, p) { return Math.max(m, p[cle][1] + (p.L || 0)); }, -Infinity); };
    zM = bout(c1, "monte") + ECART_DESSOUS; zE = bout(c1, "eclate") + ECART_DESSOUS;
  } else {
    var droite = function (c, cle) { return c.pieces.reduce(function (m, p) { return Math.max(m, p[cle][0]); }, -Infinity); };
    var gauche = function (c, cle) { return c.pieces.reduce(function (m, p) { return Math.min(m, p[cle][0]); }, Infinity); };
    dM = droite(c1, "monte") + ECART_MONTEE - gauche(c2, "monte"); dE = droite(c1, "eclate") + ECART_ECLATEE - gauche(c2, "eclate");
  }
  var n = c1.pieces.length, nc = c1.colonnes.length;
  return {
    pieces: c1.pieces.concat(c2.pieces.map(function (p) {
      return Object.assign({}, p, { monte: [p.monte[0] + dM, p.monte[1] + zM], eclate: [p.eclate[0] + dE, p.eclate[1] + zE], indice: p.indice + n, colonne: p.colonne >= 0 ? p.colonne + nc : -1 });
    })),
    colonnes: c1.colonnes.concat(c2.colonnes.map(function (c) {
      return Object.assign({}, c, { parent: c.parent + n, xMonte: c.xMonte + dM, xEclate: c.xEclate + dE, pieces: c.pieces.map(function (i) { return i + n; }) });
    })),
    erreurs: c1.erreurs.concat(c2.erreurs),
    // La première nourrice : ce que les numéros gardent (vue.js, `numeros`).
    premiere: { pieces: n, modeles: c1.pieces.reduce(function (m, p) { m[p.cle] = true; return m; }, {}) }
  };
}
