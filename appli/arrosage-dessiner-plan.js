/*
  MAQUETTE, RIEN N'EST CODÉ (CLAUDE.md §3 bis). Sa demande du 18 octobre 2026
  au soir : au moment de la photo du croquis, un petit outil pour DESSINER le
  plan. Deux façons, à comparer :

    A, au doigt   on trace chaque zone comme sur le papier, puis on tape ses
                  cotes. Le dessin n'est pas à l'échelle : il ordonne.
    B, à l'échelle on tape les cotes d'abord, la zone se pose à sa taille, on
                  la glisse à sa place.

  Ses réponses du 18 octobre, avant les planches : rectangles ; le terrain a
  ses métrés ; deux boutons au départ, la photo ou le dessin. Le massif est une
  SURFACE (longueur et largeur), parce que c'est ce que le calcul attend
  (calcul.js, TYPES.massif, forme « nappe »).

  SON CHOIX DU 18 OCTOBRE AU SOIR : « la B, parce qu'il faut que ça soit à
  l'échelle », et « il faut aussi pouvoir mettre la largeur de la haie, pas
  simplement la longueur ». La haie n'est donc plus un trait : c'est une
  bande, longueur et largeur, posée à l'échelle comme le reste. Sa longueur
  part au calcul en mètres linéaires (ml), comme aujourd'hui ; sa largeur
  part dans un champ NEUF, « largeur », que ni CroquisLu ni le calcul ne
  connaissent encore.

  SA RÉPONSE, LE MÊME SOIR : « la 2 ». La largeur PROPOSE le nombre de lignes
  de goutte-à-goutte, et c'est lui qui décide. Sa règle (relais, « le calcul
  du goutte-à-goutte ») : une ligne arrose 50 cm de part et d'autre, une bande
  de 1 m. Donc une ligne par mètre de large, arrondi au-dessus : 1 m, une
  ligne ; 2,5 m, trois. Sa correction du même soir : « il ne faut pas
  forcément mettre une touche, une ou deux, parce que si le carré il est plus
  grand, peut-être qu'il en faudra 4, 5 ». Le nombre se règle donc par « − »
  et « + », sans plafond. Le calcul, lui, n'en connaît encore que une ou deux
  (lignesHaie, calcul.js) : à changer quand on codera.

  SA DEMANDE SUIVANTE, après la photo d'un vrai plan fait main : « si j'ai la
  photo du plan, j'ai aucun intérêt à le redessiner ; c'est si jamais j'ai pas
  le plan ». Trois choses :
    l'échelle    « un centième, un deux centième, pour être plus précis ».
                 Sur un téléphone, une échelle est un AGRANDISSEMENT : à 1/100,
                 un mètre fait un centimètre d'écran, et le plan se fait
                 glisser au doigt là où il est vide. Les traits et les textes
                 gardent leur taille (TRAIT).
    les arbres   « des ronds un peu chiffonnés ; on marquerait arbre et on
                 mettrait la taille du rond » : un rond festonné, son nom et
                 son diamètre.
    les dalles   « on cliquerait un endroit, puis un deuxième endroit, et ça
                 nous les mettrait sur la distance ; ensuite il y aurait
                 marqué largeur, longueur ; on clique et ça corrige ». Les
                 dalles s'alignent entre les deux points, leur largeur dans le
                 sens de la marche. L'ÉCART entre deux dalles, il ne l'a pas
                 dit : le champ reste vide (dalles jointives) tant qu'il ne
                 le tape pas, rien n'est supposé.
  SA CORRECTION, LE MÊME SOIR, devant « une dalle sur 3,15 m » : il avait pris
  la longueur pour l'écart entre deux dalles. « Il faut mettre la longueur
  des dalles, la largeur des dalles et l'espacement ; on rajoute la longueur
  qui est préécrite au moment où on clique, comme ça on sait que c'est sur
  6 mètres. » La feuille porte donc d'abord la DISTANCE, remplie par ses deux
  touches et corrigible (la rangée suit), puis « Longueur d'une dalle »,
  « Largeur d'une dalle » et « Espacement entre deux dalles ». Une dalle plus
  large que la distance se refuse.
  SES RÉPONSES DU 19 OCTOBRE : « lorsqu'on pose des dalles, une petite
  question, est-ce qu'on les arrose ou non ? Si on ne les arrose pas, il faudra
  sur le plan les utiliser comme si c'était la fin de la délimitation : les
  arroseurs viendront se poser dans l'angle le long des dalles. » Une rangée
  qu'on n'arrose pas COUPE donc la zone qu'elle traverse : chaque morceau est
  une zone à part, et le calcul pose déjà ses arroseurs aux angles et le long
  des bords d'une zone. Elle doit être droite (couchée ou debout) : un
  découpage en biais ne donne pas des rectangles, et le calcul n'en connaît pas
  d'autres. Presque droite, elle se redresse ; vraiment en biais, elle est
  refusée. Et l'arbre : « je pense que tu peux pas faire grand-chose, dans
  tous les cas ça arrosera le tronc » : il se dessine, et ne change rien au
  plan.
  SA DEMANDE DU 19 OCTOBRE, sur une maison de 10 × 10 dans un terrain de
  20 × 20 : « quand je le colle à gauche, il me fait le calcul automatique de
  là où je le colle jusqu'au bout ; plus je le décale, plus les mètres
  descendent, un compteur qui décompte ; et pareil pour tout ce qu'on peut
  déplacer, une ligne horizontale, verticale, avec les bonnes distances ».
  L'objet qu'on tient ou qu'on vient de toucher porte donc ses quatre cotes
  jusqu'aux bords du terrain (dessinCotes), refaites à chaque pas du doigt. Et
  le doigt avance par PAS (une proposition de nous) : 10 cm sur tout le
  terrain, 5 cm à 1/200, 1 cm à 1/100, pour que les cotes tombent juste.
  SES OUI DU 19 OCTOBRE : le pas du doigt (« oui »), et l'échelle à choisir
  « 2, 3 centièmes, qu'on puisse changer le chiffre 1 » : 1/200, puis 1/100 à
  5/100 (son plan du Vésinet est au 2/100) ; et la MAISON (« oui, tu peux
  l'ajouter ») : un rectangle qui ne s'arrose pas, ne part pas au calcul, et
  coupe la zone qu'il chevauche comme les dalles qu'on n'arrose pas.
  LES COURBES, sa demande du 19 octobre : « si je reste appuyé au milieu d'un
  carré de pelouse et que je le décale vers l'intérieur ou l'extérieur, que ça
  crée une courbure ; je peux l'étirer vers la gauche ; pareil pour le dallage,
  ça peut créer un dallage en S ; les massifs pareil, ils ne sont pas forcément
  linéaires ». Une zone ou une rangée choisie montre ses points : on tire, le
  côté se courbe et passe par le doigt. Et sa règle le même soir : « il faut
  juste qu'ils l'expliquent, mais qu'ils ne refusent pas ; ils disent que ça
  sera quand même arrosé ». Le calcul ne connaît que des rectangles : une zone
  courbe part comme le rectangle qui l'entoure, et l'écran le dit ; une rangée
  courbe qu'on n'arrose pas ne coupe pas la zone, et l'écran le dit aussi.
  SA SUITE, le même soir, sur une capture : « le bout en pointe de la pelouse,
  si je veux le rabattre, je ne peux pas » ; « avoir une touche pour remettre
  sa forme originale » ; « zoomer à n'importe quel endroit avec mes deux
  doigts, et après avec le slide je me déplace ». Chaque coin a donc son point
  carré à tirer (z.coins, en mètres depuis le coin du rectangle) ; « Forme
  d'origine » sous le plan dès que l'objet touché est déformé ; et deux doigts
  agrandissent le plan là où ils sont posés (etat.loupe), un doigt le fait
  glisser.
  Ni les arbres ni les dalles qu'on arrose n'entrent au calcul : ils partent dans deux
  champs NEUFS (arbres, dalles), et l'écran le dit.

  CE QUE L'OUTIL REND EST CE QUE LA PHOTO REND (CroquisLu de
  src/server/ai/services/lire-croquis.ts) : des zones avec leur centre et leur
  emprise en FRACTION du dessin, leurs cotes, la nourrice, le piquage et le
  point d'eau. Les champs neufs s'y ajoutent sans rien retirer.

  Les fractions sont prises sur un CARRÉ dont le côté est le plus grand côté
  du terrain. Sinon un terrain de 34 × 16 donnerait deux échelles, une en
  largeur et une en hauteur, que echelleDuCroquis mélangerait.

  CE QUI DIT CE QUI MANQUE ET CE QUI COMPTE L'AMENÉE, CE SONT LES VRAIES
  FONCTIONS DU DÉPÔT : etatDuCroquis, LIBELLES (croquis-complet.ts),
  longueurDeLAmenee (geometrie-croquis.ts), empaquetées telles quelles le
  18 octobre 2026 dans arrosage-dessin-calcul.js (esbuild). C'est un
  instantané.

  Rien n'est placé d'office : ni la nourrice, ni le piquage. L'exemple pose
  les zones de son jardin d'exemple (arrosage-plan.html), le terrain de 34 × 16
  en est déduit (le massif finit à 34 m, le couloir à 16 m).
*/
(function () {
  "use strict";
  var MODE = window.MODE_DESSIN === "B" ? "B" : "A";
  var C = window.CROQUIS;
  var NS = "http://www.w3.org/2000/svg";
  var MARGE = 9;
  // Un centimètre d'écran, en pixels CSS : c'est ce que vaut un mètre à 1/100.
  var PX_PAR_CM = 96 / 2.54;

  var TYPES = {
    gazon: { nom: "Pelouse", forme: "surface" },
    potager: { nom: "Potager", forme: "surface" },
    massif: { nom: "Massif", forme: "surface" },
    haie: { nom: "Haie", forme: "surface" },
    // Elle ne s'arrose pas : elle se place, elle coupe, elle ne part pas au calcul.
    maison: { nom: "Maison", forme: "obstacle" }
  };
  var POINTS = {
    nourrice: { nom: "La nourrice", consigne: "Touchez l’endroit de la nourrice." },
    compteur: { nom: "Le compteur", consigne: "Touchez l’endroit du compteur." },
    robinet: { nom: "Le robinet", consigne: "Touchez l’endroit du robinet." }
  };

  var etat = {
    terrain: { L: null, l: null },
    echelle: null,
    // Ce que les deux doigts ajoutent à l'échelle choisie : 1, rien.
    loupe: 1,
    zones: [],
    arbres: [],
    dalles: [],
    departDalles: null,
    nourrice: null,
    piquage: null,
    outil: null,
    choisie: null,
    suivant: 1
  };

  function $(id) { return document.getElementById(id); }
  function nombre(v) {
    var n = parseFloat(String(v).replace(",", ".").replace(/\s/g, ""));
    return isFinite(n) && n > 0 && n <= 500 ? n : null;
  }
  function ecrit(n) {
    return String(Math.round(n * 100) / 100).replace(".", ",");
  }
  function cote(n) { return n == null ? "?" : ecrit(n); }

  /* Le côté du carré, en mètres. Sans les cotes du terrain, le carré n'a pas
     d'échelle à lui : les fractions restent celles du dessin. */
  function cote_du_carre() {
    var t = etat.terrain;
    return t.L && t.l ? Math.max(t.L, t.l) : null;
  }
  function terrainU() {
    var s = cote_du_carre();
    if (!s) return { w: 100, h: 100 };
    return { w: etat.terrain.L / s * 100, h: etat.terrain.l / s * 100 };
  }
  function enU(metres) { return metres / cote_du_carre() * 100; }
  function enMetres(u) { return u / 100 * cote_du_carre(); }
  function mesuree(z) {
    // La haie entre au calcul par sa longueur seule (ses mètres linéaires).
    return z.type === "haie" ? z.L != null : z.L != null && z.l != null;
  }
  function nomDe(z) { return z.nom || TYPES[z.type].nom; }

  /* Sa remarque du 18 octobre : « je peux poser un carré de pelouse de 12 par
     12 alors que mon cadre fait 10 par 10, il faut pouvoir bloquer ça ». En B,
     la taille vient des cotes : une zone plus grande que le terrain est une
     cote fausse, l'une ou l'autre. Elle ne se pose pas, et si le terrain
     rapetisse sous une zone déjà posée, le plan ne se fait pas. La place, elle,
     est toujours tenue dans le cadre par le doigt (borne). */
  function cotesTropGrandes(z) {
    var t = etat.terrain;
    if (MODE !== "B" || !t.L || !t.l) return [];
    var trop = [];
    if (z.L != null && z.L > t.L + 1e-9) trop.push("f-L");
    if (z.l != null && z.l > t.l + 1e-9) trop.push("f-l");
    return trop;
  }
  function phraseTropGrande() {
    return "Ne tient pas dans le terrain, qui fait " + cote(etat.terrain.L) + " × " + cote(etat.terrain.l) + " m.";
  }

  /* Une ligne arrose une bande de 1 m (sa règle). Une proposition, jamais une
     décision : la feuille la présélectionne, il la change d'un doigt. */
  var BANDE_PAR_LIGNE = 1;
  function lignesProposees(largeur) {
    // Le millionième retiré : 2 ÷ 1 doit rester 2, pas devenir 3 par l'arrondi.
    return largeur == null ? null : Math.max(1, Math.ceil(largeur / BANDE_PAR_LIGNE - 1e-9));
  }
  function ecritLignes(n) { return n === 1 ? "une ligne" : n + " lignes"; }

  /* Combien de dalles tiennent entre les deux points, et où commence la
     première : la rangée est centrée sur la distance, jamais étirée. */
  /* **La longueur d'une dalle se pose dans le sens de la rangée, sa largeur
     en travers** : sa remarque du 19 octobre, « les dalles se mettent d'office
     à l'envers, on est obligé de les tourner ». C'était l'inverse jusque-là. */
  function rangeeDeDalles(d) {
    var dist = longueurDeLaRangee(d);
    var l = enU(d.L || 0), e = enU(d.e || 0);
    var n = l > 0 ? Math.max(1, Math.floor((dist + e) / (l + e) + 1e-9)) : 0;
    var occupe = n * l + Math.max(0, n - 1) * e;
    return { n: n, dist: dist, l: l, e: e, depart: (dist - occupe) / 2 };
  }
  function ecritDalles(n) { return n === 1 ? "une dalle" : n + " dalles"; }

  /* ── Les courbes ───────────────────────────────────────────────
     Un côté de zone courbé est une courbe de Bézier du second degré, qui passe
     par le point qu'il tire ; une rangée courbée, une courbe du troisième
     degré, deux points, d'où le S. Les points de contrôle se gardent RELATIFS
     au côté (u le long, v en travers) : la zone bouge ou change de cotes, la
     courbe suit. */
  var COTES_ZONE = ["haut", "droite", "bas", "gauche"];
  var COINS_ZONE = ["hg", "hd", "bd", "bg"];
  /* Les quatre coins, là où il les a tirés (en mètres depuis le coin du
     rectangle) : c'est ce qui rabat une pointe. */
  function sommetsDe(z) {
    var base = { hg: { x: z.x, y: z.y }, hd: { x: z.x + z.w, y: z.y }, bd: { x: z.x + z.w, y: z.y + z.h }, bg: { x: z.x, y: z.y + z.h } };
    COINS_ZONE.forEach(function (c) {
      var o = z.coins && z.coins[c];
      if (o) base[c] = { x: base[c].x + enU(o.x), y: base[c].y + enU(o.y) };
    });
    return base;
  }
  function coinsDe(z) {
    var s = sommetsDe(z);
    return { haut: [s.hg, s.hd], droite: [s.hd, s.bd], bas: [s.bd, s.bg], gauche: [s.bg, s.hg] };
  }
  /* Tirer un coin : il suit le doigt, dans le terrain. Reposé à sa place (à
     moins de 5 cm), il y reste. */
  function tirerCoin(z, c, h) {
    var t = terrainU(), base = { hg: [z.x, z.y], hd: [z.x + z.w, z.y], bd: [z.x + z.w, z.y + z.h], bg: [z.x, z.y + z.h] }[c];
    var dx = enMetres(borne(h.x, t.w) - base[0]), dy = enMetres(borne(h.y, t.h) - base[1]);
    z.coins = z.coins || {};
    if (Math.hypot(dx, dy) < 0.05) delete z.coins[c];
    else z.coins[c] = { x: dx, y: dy };
  }
  /* Une forme qui n'est plus le rectangle tapé : un côté courbe, ou un coin tiré. */
  function formeLibre(z) {
    return courbee(z) || (!!z.coins && COINS_ZONE.some(function (c) { return z.coins[c]; }));
  }
  function deformee(o) {
    return !!o && (o.courbe ? true : !!o.type && formeLibre(o));
  }
  /* La normale vers l'extérieur : les côtés tournent dans le sens des aiguilles. */
  function normale(p0, p1) {
    var dx = p1.x - p0.x, dy = p1.y - p0.y, n = Math.hypot(dx, dy) || 1;
    return { x: dy / n, y: -dx / n };
  }
  function courbee(z) {
    return !!z.courbes && COTES_ZONE.some(function (c) { return z.courbes[c]; });
  }
  function controleDe(z, cote) {
    var k = z.courbes && z.courbes[cote];
    if (!k) return null;
    var p = coinsDe(z)[cote], n = normale(p[0], p[1]);
    return { x: p[0].x + (p[1].x - p[0].x) * k.u + n.x * enU(k.v), y: p[0].y + (p[1].y - p[0].y) * k.u + n.y * enU(k.v) };
  }
  function bez2(p0, c, p1, t) {
    var m = 1 - t;
    return { x: m * m * p0.x + 2 * m * t * c.x + t * t * p1.x, y: m * m * p0.y + 2 * m * t * c.y + t * t * p1.y };
  }
  function bez3(a, c1, c2, b, t) {
    var m = 1 - t;
    return {
      x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
      y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y
    };
  }
  function cheminZone(z) {
    var p = coinsDe(z), d = "M" + p.haut[0].x + " " + p.haut[0].y;
    COTES_ZONE.forEach(function (c) {
      var fin = p[c][1], k = controleDe(z, c);
      d += k ? "Q" + k.x + " " + k.y + " " + fin.x + " " + fin.y : "L" + fin.x + " " + fin.y;
    });
    return d + "Z";
  }
  /* Le rectangle qui entoure la zone courbée : c'est lui que le calcul reçoit. */
  function cadreDe(z) {
    if (!formeLibre(z)) return { x: z.x, y: z.y, w: z.w, h: z.h };
    var p = coinsDe(z), t = terrainU(), so = sommetsDe(z);
    var xs = COINS_ZONE.map(function (c) { return so[c].x; }), ys = COINS_ZONE.map(function (c) { return so[c].y; });
    COTES_ZONE.forEach(function (c) {
      var k = controleDe(z, c);
      if (!k) return;
      for (var i = 0; i <= 24; i++) { var q = bez2(p[c][0], k, p[c][1], i / 24); xs.push(q.x); ys.push(q.y); }
    });
    var x1 = borne(Math.min.apply(null, xs), t.w), x2 = borne(Math.max.apply(null, xs), t.w);
    var y1 = borne(Math.min.apply(null, ys), t.h), y2 = borne(Math.max.apply(null, ys), t.h);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  /* Le point qu'il tient : au milieu du côté, sur la courbe. */
  function pointDuCote(z, c) {
    var p = coinsDe(z)[c], k = controleDe(z, c);
    return k ? bez2(p[0], k, p[1], 0.5) : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  }
  /* Tirer le côté : la courbe passe par le doigt, B(1/2) = H. Reposé sur le
     côté droit (à moins de 5 cm), il redevient droit. */
  function tirerCote(z, c, h) {
    var p = coinsDe(z)[c], t = terrainU();
    var hc = { x: borne(h.x, t.w), y: borne(h.y, t.h) };
    var k = { x: borne(2 * hc.x - (p[0].x + p[1].x) / 2, t.w), y: borne(2 * hc.y - (p[0].y + p[1].y) / 2, t.h) };
    var dx = p[1].x - p[0].x, dy = p[1].y - p[0].y, len2 = dx * dx + dy * dy || 1, n = normale(p[0], p[1]);
    var u = ((k.x - p[0].x) * dx + (k.y - p[0].y) * dy) / len2;
    var v = enMetres((k.x - p[0].x) * n.x + (k.y - p[0].y) * n.y);
    z.courbes = z.courbes || {};
    if (Math.abs(v) < 0.05) delete z.courbes[c];
    else z.courbes[c] = { u: u, v: v };
  }

  /* Une rangée : ses deux points de contrôle, relatifs à sa corde (u le long,
     v en travers, en part de la corde : une distance corrigée l'agrandit
     tout entière). Droite, ils sont aux tiers. */
  function controlesDalles(d) {
    var dx = d.b.x - d.a.x, dy = d.b.y - d.a.y, len = Math.hypot(dx, dy), n = normale(d.a, d.b);
    var k = d.courbe || [{ u: 1 / 3, v: 0 }, { u: 2 / 3, v: 0 }];
    return k.map(function (c) { return { x: d.a.x + dx * c.u + n.x * c.v * len, y: d.a.y + dy * c.u + n.y * c.v * len }; });
  }
  function echantillonsDalles(d) {
    var k = controlesDalles(d), pts = [], cum = [0];
    for (var i = 0; i <= 80; i++) {
      pts.push(bez3(d.a, k[0], k[1], d.b, i / 80));
      if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { pts: pts, cum: cum, total: cum[cum.length - 1] };
  }
  /* La longueur de la rangée, le long de sa courbe : c'est elle que la
     feuille appelle « Distance ». */
  function longueurDeLaRangee(d) {
    return d.courbe ? echantillonsDalles(d).total : Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
  }
  function surLaRangee(e, s) {
    for (var i = 1; i < e.cum.length; i++) {
      if (e.cum[i] >= s || i === e.cum.length - 1) {
        var a = e.pts[i - 1], b = e.pts[i], seg = e.cum[i] - e.cum[i - 1] || 1, f = (s - e.cum[i - 1]) / seg;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x) };
      }
    }
  }
  /* Tirer un des deux points de la rangée : la courbe passe par le doigt au
     tiers (ou aux deux tiers), l'autre point reste. */
  function tirerDalles(d, i, h) {
    var t = i === 0 ? 1 / 3 : 2 / 3, m = 1 - t, k = controlesDalles(d), cible;
    if (i === 0) cible = {
      x: (h.x - m * m * m * d.a.x - 3 * m * t * t * k[1].x - t * t * t * d.b.x) / (3 * m * m * t),
      y: (h.y - m * m * m * d.a.y - 3 * m * t * t * k[1].y - t * t * t * d.b.y) / (3 * m * m * t)
    };
    else cible = {
      x: (h.x - m * m * m * d.a.x - 3 * m * m * t * k[0].x - t * t * t * d.b.x) / (3 * m * t * t),
      y: (h.y - m * m * m * d.a.y - 3 * m * m * t * k[0].y - t * t * t * d.b.y) / (3 * m * t * t)
    };
    k[i] = cible;
    var dx = d.b.x - d.a.x, dy = d.b.y - d.a.y, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2), n = normale(d.a, d.b);
    d.courbe = k.map(function (c) {
      return { u: ((c.x - d.a.x) * dx + (c.y - d.a.y) * dy) / len2, v: ((c.x - d.a.x) * n.x + (c.y - d.a.y) * n.y) / len };
    });
    if (d.courbe.every(function (c) { return Math.abs(c.v) < 0.01; })) delete d.courbe;
  }
  function poigneesDalles(d) {
    var k = controlesDalles(d);
    return [bez3(d.a, k[0], k[1], d.b, 1 / 3), bez3(d.a, k[0], k[1], d.b, 2 / 3)];
  }

  /* La bande qu'occupe une rangée droite : toute la distance qu'il a tapée,
     d'un point touché à l'autre, sur la longueur des dalles en travers. C'est
     l'allée entière qui ne s'arrose pas : la borner à la première et à la
     dernière dalle laissait un bout de gazon de quelques centimètres à chaque
     extrémité, que le calcul aurait arrosé à part. En unités du dessin. */
  function bandeDesDalles(d) {
    var L = enU(d.l || 0);
    if (Math.abs(d.b.y - d.a.y) <= Math.abs(d.b.x - d.a.x)) {
      return { x: Math.min(d.a.x, d.b.x), y: d.a.y - L / 2, w: Math.abs(d.b.x - d.a.x), h: L };
    }
    return { x: d.a.x - L / 2, y: Math.min(d.a.y, d.b.y), w: L, h: Math.abs(d.b.y - d.a.y) };
  }

  /* Une rangée qu'on n'arrose pas coupe la zone qu'elle traverse : au-dessus,
     au-dessous, puis à gauche et à droite de la bande. Les morceaux de moins
     d'un centimètre ne sont pas des zones. */
  /* Ce qui coupe une zone : les rangées qu'on n'arrose pas, et les maisons. */
  function coupeurs(z) {
    var aimant = enU(AIMANT_M), liste = [];
    etat.dalles.forEach(function (d) {
      // Une rangée courbe ne coupe pas : le découpage ne donnerait pas des
      // rectangles. L'écran le dit (rendreEtat).
      if (d.arrosees !== false || d.courbe) return;
      var b = bandeDesDalles(d);
      // **L'aimant (une proposition, pas sa règle)** : le doigt ne touche jamais
      // le bord exact d'une pelouse. Un bout de rangée qui s'arrête à moins de
      // 50 cm du bord de la zone va jusqu'au bord, au lieu de laisser une
      // lanière de gazon que le calcul arroserait à part.
      if (b.w >= b.h) {
        if (b.x > z.x && b.x - z.x < aimant) { b.w += b.x - z.x; b.x = z.x; }
        var droite = z.x + z.w - (b.x + b.w);
        if (droite > 0 && droite < aimant) b.w += droite;
      } else {
        if (b.y > z.y && b.y - z.y < aimant) { b.h += b.y - z.y; b.y = z.y; }
        var bas = z.y + z.h - (b.y + b.h);
        if (bas > 0 && bas < aimant) b.h += bas;
      }
      liste.push({ b: b, nom: "les dalles" });
    });
    etat.zones.forEach(function (m) {
      if (m.type === "maison" && m !== z) liste.push({ b: { x: m.x, y: m.y, w: m.w, h: m.h }, nom: m.nom || "la maison" });
    });
    return liste;
  }

  /* Les morceaux de la zone une fois retirés ses coupeurs ; ceux qui la
     touchent vraiment sont rendus avec, pour le dire à l'écran. */
  function morceaux(z) {
    var parts = [cadreDe(z)];
    if (z.type === "maison") return parts;
    var e = enU(0.01), touches = [];
    coupeurs(z).forEach(function (c) {
      var b = c.b, suite = [], coupe = false;
      parts.forEach(function (p) {
        var ix1 = Math.max(p.x, b.x), iy1 = Math.max(p.y, b.y);
        var ix2 = Math.min(p.x + p.w, b.x + b.w), iy2 = Math.min(p.y + p.h, b.y + b.h);
        if (ix2 - ix1 <= e || iy2 - iy1 <= e) { suite.push(p); return; }
        coupe = true;
        [
          { x: p.x, y: p.y, w: p.w, h: iy1 - p.y },
          { x: p.x, y: iy2, w: p.w, h: p.y + p.h - iy2 },
          { x: p.x, y: iy1, w: ix1 - p.x, h: iy2 - iy1 },
          { x: ix2, y: iy1, w: p.x + p.w - ix2, h: iy2 - iy1 }
        ].forEach(function (q) { if (q.w > e && q.h > e) suite.push(q); });
      });
      parts = suite;
      if (coupe && touches.indexOf(c.nom) < 0) touches.push(c.nom);
    });
    parts.coupeurs = touches;
    return parts;
  }

  /* Presque droite (moins de 10° d'écart), la rangée se redresse en gardant sa
     distance ; au-delà, elle ne se découpe pas, et on le dit. */
  var REDRESSE_MAX = Math.tan(10 * Math.PI / 180);
  /* Ce que vaut l'imprécision du doigt au bord d'une zone (voir morceaux). */
  var AIMANT_M = 0.5;
  function redressee(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy);
    if (Math.abs(dy) <= REDRESSE_MAX * Math.abs(dx)) return { x: a.x + Math.sign(dx) * n, y: a.y };
    if (Math.abs(dx) <= REDRESSE_MAX * Math.abs(dy)) return { x: a.x, y: a.y + Math.sign(dy) * n };
    return null;
  }
  /* L'arrivée qui met la rangée à la distance tapée, dans la direction de ses
     deux touches : le départ reste où il l'a touché. */
  function arriveeA(d, metres) {
    var dx = d.b.x - d.a.x, dy = d.b.y - d.a.y, n = Math.hypot(dx, dy);
    if (n < 1e-9) { dx = 1; dy = 0; n = 1; }
    // Courbée, la rangée garde sa forme et s'agrandit : c'est sa longueur le
    // long de la courbe qui vaut la distance tapée.
    var k = enU(metres) / (d.courbe ? longueurDeLaRangee(d) : n);
    return { x: d.a.x + dx * k, y: d.a.y + dy * k };
  }

  /* En B, la taille d'une zone sort de ses cotes, jamais du doigt. */
  function tailleSelonCotes(z) {
    var s = cote_du_carre();
    if (!s) return;
    z.w = (z.L || 0) / s * 100;
    z.h = (z.l || 0) / s * 100;
  }

  /* ── Le dessin ─────────────────────────────────────────────── */
  /* TRAIT : ce que vaut un trait ou une lettre quand le plan est agrandi. À
     l'échelle « tout le terrain », 1 ; à 1/100, moins : le plan grossit, les
     textes et les traits gardent leur taille d'écran. */
  var TRAIT = 1;
  function el(nom, attrs, texte) {
    var e = document.createElementNS(NS, nom);
    for (var k in attrs) {
      var v = attrs[k];
      if ((k === "font-size" || k === "stroke-width") && typeof v === "number") v = v * TRAIT;
      e.setAttribute(k, v);
    }
    if (texte != null) e.textContent = texte;
    return e;
  }
  /* Un signe (nourrice, compteur, poignée) se dessine autour de l'origine, à
     taille d'écran : son groupe porte l'agrandissement, une seule fois. */
  function signe(x, y, attrs, dessin) {
    var g = el("g", attrs);
    g.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + TRAIT + ")");
    var garde = TRAIT;
    TRAIT = 1;
    try { dessin(g); } finally { TRAIT = garde; }
    return g;
  }

  function dessiner() {
    var svg = $("toile");
    var t = terrainU();
    // Caché (feuille de départ), le cadre ne mesure rien : on attend qu'il s'ouvre.
    var boite = Math.max(1, svg.parentNode.clientWidth - 20);
    var auPlusJuste = boite / (t.w + 2 * MARGE);
    var s = cote_du_carre();
    var voulu = etat.echelle && s ? (PX_PAR_CM * 100 / etat.echelle) * s / 100 : auPlusJuste;
    var parU = Math.max(voulu, auPlusJuste) * etat.loupe;
    TRAIT = auPlusJuste / parU;
    var m = MARGE * TRAIT;
    var vb = [-m, -m, t.w + 2 * m, t.h + 2 * m];
    svg.setAttribute("viewBox", vb.join(" "));
    svg.style.width = parU > auPlusJuste + 1e-6 ? Math.round(vb[2] * parU) + "px" : "";
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    svg.appendChild(el("rect", { x: 0, y: 0, width: t.w, height: t.h, rx: 1.2 * TRAIT, fill: "var(--atlas-cream)", stroke: "var(--atlas-ink)", "stroke-width": 0.5 }));
    var dy = 3 * TRAIT;
    svg.appendChild(el("text", { x: t.w / 2, y: -dy, "text-anchor": "middle", "font-size": 3.4, fill: etat.terrain.L ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)" }, etat.terrain.L ? cote(etat.terrain.L) + " m" : "? m"));
    svg.appendChild(el("text", { x: -dy, y: t.h / 2, "text-anchor": "middle", "font-size": 3.4, fill: etat.terrain.l ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)", transform: "rotate(-90 " + -dy + " " + t.h / 2 + ")" }, etat.terrain.l ? cote(etat.terrain.l) + " m" : "? m"));

    // Les maisons par-dessus les zones qu'elles coupent.
    etat.zones.forEach(function (z) { if (z.type !== "maison") svg.appendChild(dessinZone(z)); });
    etat.zones.forEach(function (z) { if (z.type === "maison") svg.appendChild(dessinZone(z)); });
    // Les morceaux d'une zone coupée par des dalles, en pointillé : ce sont eux
    // que le calcul reçoit, et le long d'eux qu'il posera les arroseurs.
    etat.zones.forEach(function (z) {
      var p = morceaux(z);
      if (p.length < 2 && !formeLibre(z)) return;
      p.forEach(function (q) {
        svg.appendChild(el("rect", { x: q.x, y: q.y, width: q.w, height: q.h, fill: "none", stroke: "var(--atlas-plein)", "stroke-width": 0.5, "stroke-dasharray": (1.4 * TRAIT) + " " + (1 * TRAIT), "pointer-events": "none" }));
      });
    });
    etat.dalles.forEach(function (d) { svg.appendChild(dessinDalles(d)); });
    etat.arbres.forEach(function (a) { svg.appendChild(dessinArbre(a)); });
    if (brouillon) svg.appendChild(dessinBrouillon());
    if (etat.departDalles) svg.appendChild(signe(etat.departDalles.x, etat.departDalles.y, {}, function (g) {
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 1.6, fill: "var(--atlas-ink)" }));
    }));
    if (etat.piquage) svg.appendChild(dessinPiquage(etat.piquage));
    if (etat.nourrice) svg.appendChild(dessinNourrice(etat.nourrice));
    if (MODE === "B" && etat.cotesDe != null) dessinCotes(svg, etat.cotesDe);
    $("forme-origine").hidden = !(MODE === "B" && etat.choisie != null && deformee(objetDe(etat.choisie)));
    rendreEtat();
  }

  function remplissage(type) {
    if (type === "maison") return "color-mix(in srgb, var(--atlas-muted) 42%, var(--atlas-card))";
    if (type === "gazon") return "color-mix(in srgb, var(--atlas-vertPale) 75%, var(--atlas-card))";
    if (type === "haie") return "color-mix(in srgb, var(--atlas-plein) 34%, var(--atlas-card))";
    if (type === "potager") return "color-mix(in srgb, var(--atlas-orClair) 38%, var(--atlas-card))";
    return "color-mix(in srgb, var(--atlas-rustDeep) 24%, var(--atlas-card))";
  }

  function dessinZone(z) {
    var g = el("g", { "data-id": z.id, style: "cursor:grab" });
    var choisie = etat.choisie === z.id;
    var ok = mesuree(z) && cotesTropGrandes(z).length === 0;
    var bord = { fill: remplissage(z.type), stroke: ok ? (choisie ? "var(--atlas-ink)" : "var(--atlas-rustDeep)") : "var(--atlas-alerte)", "stroke-width": choisie ? 0.9 : 0.45, "stroke-dasharray": ok ? "none" : (1.6 * TRAIT) + " " + (1.2 * TRAIT) };
    if (formeLibre(z)) g.appendChild(el("path", Object.assign({ d: cheminZone(z) }, bord)));
    else g.appendChild(el("rect", Object.assign({ x: z.x, y: z.y, width: Math.max(z.w, 0.5 * TRAIT), height: Math.max(z.h, 0.5 * TRAIT), rx: 0.8 * TRAIT }, bord)));
    // Le nom, puis « longueur × largeur » : la longueur est le côté couché.
    // Une zone trop basse pour deux lignes les met sur une seule.
    var lesParts = morceaux(z), parts = lesParts.length;
    var cotes = cote(z.L) + " × " + cote(z.l) + (z.type === "haie" && z.lignes ? ", " + ecritLignes(z.lignes) : "") + (parts > 1 ? ", en " + parts + " parts" : "");
    var couleur = ok ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)";
    var cx2 = z.x + z.w / 2, cy2 = z.y + z.h / 2;
    // Coupée par des dalles, la zone porte son nom dans son plus grand morceau :
    // au centre, il tombait sous la rangée.
    if (parts > 1) {
      var grand = lesParts.reduce(function (m, q) { return q.w * q.h > m.w * m.h ? q : m; });
      cx2 = grand.x + grand.w / 2; cy2 = grand.y + grand.h / 2;
    }
    if (z.h >= 9 * TRAIT) {
      g.appendChild(etiquette(cx2, cy2 - 0.6 * TRAIT, nomDe(z), 3.2, z.w, "var(--atlas-ink)"));
      g.appendChild(etiquette(cx2, cy2 + 3.4 * TRAIT, cotes, 2.9, z.w, couleur));
    } else {
      g.appendChild(etiquette(cx2, cy2 + 1.1 * TRAIT, nomDe(z) + ", " + cotes, 3, z.w, couleur));
    }
    if (choisie && MODE === "A") g.appendChild(poignee(z.x + z.w, z.y + z.h, z.id));
    // Les points qui courbent un côté : sur la zone choisie, pas sur la maison.
    if (choisie && MODE === "B" && z.type !== "maison") {
      COTES_ZONE.forEach(function (c) { var q = pointDuCote(z, c); g.appendChild(pointATirer(q, z.id + ":" + c)); });
      var so = sommetsDe(z);
      COINS_ZONE.forEach(function (c) { g.appendChild(coinATirer(so[c], z.id + ":" + c)); });
    }
    return g;
  }

  /* Un coin à tirer : carré, pour ne pas le confondre avec le milieu d'un côté. */
  function coinATirer(q, cle) {
    return signe(q.x, q.y, { "data-coin": cle, style: "cursor:move" }, function (g) {
      g.appendChild(el("rect", { x: -6, y: -6, width: 12, height: 12, fill: "transparent" }));
      g.appendChild(el("rect", { x: -1.9, y: -1.9, width: 3.8, height: 3.8, rx: 0.5, fill: "var(--atlas-card)", stroke: "var(--atlas-plein)", "stroke-width": 0.9 }));
    });
  }

  /* Un point à tirer : petit à l'œil, large sous le doigt. */
  function pointATirer(q, cle) {
    return signe(q.x, q.y, { "data-courbe": cle, style: "cursor:move" }, function (g) {
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 6, fill: "transparent" }));
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 2.1, fill: "var(--atlas-card)", stroke: "var(--atlas-plein)", "stroke-width": 0.9 }));
    });
  }

  /* Un texte qui tient dans sa zone : il rapetisse plutôt que de déborder,
     et un liseré de la couleur du fond le détache des traits qu’il croise. */
  function etiquette(x, y, texte, taille, largeur, couleur) {
    var t = Math.min(taille, Math.max(1.9, (largeur - 1.5 * TRAIT) / (texte.length * 0.56) / TRAIT));
    return el("text", { x: x, y: y, "text-anchor": "middle", "font-size": t, fill: couleur, stroke: "var(--atlas-card)", "stroke-width": 0.7, "paint-order": "stroke", "stroke-linejoin": "round" }, texte);
  }

  function poignee(x, y, id) {
    return signe(x, y, { "data-poignee": id, style: "cursor:nwse-resize" }, function (g) {
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 6, fill: "transparent" }));
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 2.2, fill: "var(--atlas-card)", stroke: "var(--atlas-ink)", "stroke-width": 0.6 }));
    });
  }

  /* L'arbre, comme sur son plan : un rond aux bords festonnés. */
  function dessinArbre(a) {
    var g = el("g", { "data-id": a.id, style: "cursor:grab" });
    var r = enU(a.d) / 2, lobes = Math.max(7, Math.min(14, Math.round(r / TRAIT * 1.4))), d = "";
    for (var i = 0; i <= lobes; i++) {
      var ang = i / lobes * 2 * Math.PI;
      var px = a.x + Math.cos(ang) * r * 0.9, py = a.y + Math.sin(ang) * r * 0.9;
      if (i === 0) { d += "M" + px + " " + py; continue; }
      var mi = (i - 0.5) / lobes * 2 * Math.PI;
      d += "Q" + (a.x + Math.cos(mi) * r * 1.12) + " " + (a.y + Math.sin(mi) * r * 1.12) + " " + px + " " + py;
    }
    g.appendChild(el("path", { d: d + "Z", fill: "color-mix(in srgb, var(--atlas-plein) 52%, var(--atlas-card))", stroke: "var(--atlas-rustDeep)", "stroke-width": 0.45 }));
    g.appendChild(el("text", { x: a.x, y: a.y + r + 3.6 * TRAIT, "text-anchor": "middle", "font-size": 2.9, fill: "var(--atlas-ink)", stroke: "var(--atlas-card)", "stroke-width": 0.7, "paint-order": "stroke", "stroke-linejoin": "round" }, (a.nom || "Arbre") + ", Ø " + cote(a.d) + " m"));
    return g;
  }

  /* Les dalles, posées entre ses deux points : leur longueur dans le sens de
     la rangée, leur largeur en travers (voir rangeeDeDalles). */
  function dessinDalles(d) {
    var g = el("g", { "data-id": d.id, style: "cursor:grab" });
    var r = rangeeDeDalles(d), L = enU(d.l || 0);
    var ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x);
    var teinte = { fill: "color-mix(in srgb, var(--atlas-muted) 60%, var(--atlas-card))", stroke: "var(--atlas-inkSoft)", "stroke-width": 0.3 };
    if (d.courbe) {
      // Courbée : chaque dalle se pose sur la courbe, tournée comme elle.
      var e = echantillonsDalles(d);
      g.appendChild(el("path", { d: "M" + e.pts.map(function (q) { return q.x + " " + q.y; }).join("L"), fill: "none", stroke: "transparent", "stroke-width": Math.max(8, L / TRAIT), "stroke-linecap": "round" }));
      for (var j = 0; j < r.n; j++) {
        var q = surLaRangee(e, r.depart + j * (r.l + r.e) + r.l / 2);
        g.appendChild(el("rect", Object.assign({ x: -r.l / 2, y: -L / 2, width: r.l, height: L, transform: "translate(" + q.x + " " + q.y + ") rotate(" + q.ang * 180 / Math.PI + ")" }, teinte)));
      }
    } else {
      g.appendChild(el("line", { x1: d.a.x, y1: d.a.y, x2: d.b.x, y2: d.b.y, stroke: "transparent", "stroke-width": Math.max(8, L / TRAIT), "stroke-linecap": "round" }));
      var rang = el("g", { transform: "translate(" + d.a.x + " " + d.a.y + ") rotate(" + ang * 180 / Math.PI + ")" });
      for (var i = 0; i < r.n; i++) {
        rang.appendChild(el("rect", Object.assign({ x: r.depart + i * (r.l + r.e), y: -L / 2, width: r.l, height: L }, teinte)));
      }
      g.appendChild(rang);
    }
    if (MODE === "B" && etat.choisie === d.id) {
      poigneesDalles(d).forEach(function (q, k) { g.appendChild(pointATirer(q, d.id + ":" + k)); });
    }
    // Le nom au-dessus de la rangée (à droite si elle est debout) : en dessous,
    // il tombait sur le nom du massif qu'elle longeait.
    var mx = (d.a.x + d.b.x) / 2, my = (d.a.y + d.b.y) / 2, ecart = L / 2 + 3.2 * TRAIT;
    var nx = -Math.sin(ang), ny = Math.cos(ang);
    if (ny > 1e-6 || (Math.abs(ny) <= 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
    if (Math.abs(ny) <= 1e-6) ecart += 2 * TRAIT;
    g.appendChild(el("text", { x: mx + nx * ecart, y: my + ny * ecart + 1 * TRAIT, "text-anchor": "middle", "font-size": 2.8, fill: "var(--atlas-ink)", stroke: "var(--atlas-card)", "stroke-width": 0.7, "paint-order": "stroke", "stroke-linejoin": "round" }, (d.nom || "Dalles") + ", " + ecritDalles(r.n)));
    return g;
  }

  /* Ce qu'occupe un objet sur le terrain : un rectangle, ou un point. */
  function emprise(id) {
    var o = objetDe(id);
    if (!o) return null;
    var sorte = sorteDe(id);
    if (sorte === "point" || sorte === "arbre") return { x: o.x, y: o.y, w: 0, h: 0 };
    if (sorte === "dalles" && o.courbe) {
      var ep = echantillonsDalles(o).pts, demi = enU(o.l || 0) / 2;
      var xs = ep.map(function (q) { return q.x; }), ys = ep.map(function (q) { return q.y; });
      var ex = Math.min.apply(null, xs) - demi, ey = Math.min.apply(null, ys) - demi;
      return { x: ex, y: ey, w: Math.max.apply(null, xs) + demi - ex, h: Math.max.apply(null, ys) + demi - ey };
    }
    if (sorte === "dalles") {
      var L = enU(o.l || 0), x1 = Math.min(o.a.x, o.b.x), y1 = Math.min(o.a.y, o.b.y);
      var couchee = Math.abs(o.b.y - o.a.y) <= Math.abs(o.b.x - o.a.x);
      return couchee
        ? { x: x1, y: o.a.y - L / 2, w: Math.abs(o.b.x - o.a.x), h: L }
        : { x: o.a.x - L / 2, y: y1, w: L, h: Math.abs(o.b.y - o.a.y) };
    }
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  }

  /* LES QUATRE COTES de l'objet tenu, jusqu'aux bords du terrain : sa demande
     du 19 octobre, « une ligne horizontale, verticale, avec les bonnes
     distances ». Une cote nulle (l'objet est collé au bord) ne se dessine pas. */
  function dessinCotes(svg, id) {
    var b = emprise(id);
    if (!b) return;
    var t = terrainU(), cx = b.x + b.w / 2, cy = b.y + b.h / 2, tic = 1.2 * TRAIT;
    var g = el("g", { "pointer-events": "none" });
    var trait = { stroke: "var(--atlas-orTexte)", "stroke-width": 0.35 };
    function cote(x1, y1, x2, y2) {
      var d = Math.hypot(x2 - x1, y2 - y1);
      if (enMetres(d) < 0.005) return;
      var couche = Math.abs(y2 - y1) < 1e-9;
      g.appendChild(el("line", Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2 }, trait)));
      [[x1, y1], [x2, y2]].forEach(function (p) {
        g.appendChild(el("line", Object.assign(couche
          ? { x1: p[0], y1: p[1] - tic, x2: p[0], y2: p[1] + tic }
          : { x1: p[0] - tic, y1: p[1], x2: p[0] + tic, y2: p[1] }, trait)));
      });
      var texte = ecrit(Math.round(enMetres(d) * 100) / 100) + " m";
      g.appendChild(el("text", {
        x: couche ? (x1 + x2) / 2 : x1 + 1.6 * TRAIT,
        y: couche ? y1 - 1.4 * TRAIT : (y1 + y2) / 2 + 1 * TRAIT,
        "text-anchor": couche ? "middle" : "start",
        "font-size": 2.9, "font-weight": 600, fill: "var(--atlas-orTexte)",
        stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round"
      }, texte));
    }
    cote(0, cy, b.x, cy);
    cote(b.x + b.w, cy, t.w, cy);
    cote(cx, 0, cx, b.y);
    cote(cx, b.y + b.h, cx, t.h);
    svg.appendChild(g);
  }

  /* Le doigt avance par pas, pour que les cotes tombent juste : 10 cm sur tout
     le terrain, 5 cm à 1/200, 1 cm à 1/100 (une proposition de nous). */
  function pasDuDoigt() { return !etat.echelle ? 0.1 : etat.echelle > 100 ? 0.05 : 0.01; }
  function auPas(u) {
    if (MODE !== "B" || !cote_du_carre()) return u;
    var pas = pasDuDoigt();
    return enU(Math.round(enMetres(u) / pas) * pas);
  }

  function dessinNourrice(p) {
    return signe(p.x, p.y, { "data-id": "nourrice", style: "cursor:grab" }, function (g) {
      g.appendChild(el("rect", { x: -6, y: -6, width: 12, height: 12, fill: "transparent" }));
      g.appendChild(el("rect", { x: -3.6, y: -2.2, width: 7.2, height: 4.4, rx: 0.6, fill: "var(--atlas-ink)" }));
      g.appendChild(el("text", { x: 0, y: 6, "text-anchor": "middle", "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "nourrice"));
    });
  }

  function dessinPiquage(p) {
    return signe(p.x, p.y, { "data-id": "piquage", style: "cursor:grab" }, function (g) {
      g.appendChild(el("rect", { x: -6, y: -6, width: 12, height: 12, fill: "transparent" }));
      if (p.sorte === "robinet") {
        // Sa règle du 18 octobre : une petite croix blanche, et « robinet » à côté.
        var d = "M-1.8 0H1.8M0 -1.8V1.8";
        g.appendChild(el("path", { d: d, stroke: "var(--atlas-ink)", "stroke-width": 1.5, "stroke-linecap": "round" }));
        g.appendChild(el("path", { d: d, stroke: "#ffffff", "stroke-width": 0.65, "stroke-linecap": "round" }));
        g.appendChild(el("text", { x: 3, y: 1.1, "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "robinet"));
      } else {
        g.appendChild(el("circle", { cx: 0, cy: 0, r: 2, fill: "var(--atlas-card)", stroke: "var(--atlas-ink)", "stroke-width": 0.7 }));
        g.appendChild(el("circle", { cx: 0, cy: 0, r: 0.6, fill: "var(--atlas-ink)" }));
        g.appendChild(el("text", { x: 3, y: 1.1, "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "compteur"));
      }
    });
  }

  /* ── Le doigt ──────────────────────────────────────────────── */
  var brouillon = null;   // A : la zone en train d'être tracée
  var prise = null;       // ce qu'on déplace, étire, ou le plan qu'on fait glisser

  function point(evt) {
    var svg = $("toile");
    var m = svg.getScreenCTM().inverse();
    var p = svg.createSVGPoint();
    p.x = evt.clientX; p.y = evt.clientY;
    var q = p.matrixTransform(m);
    return { x: q.x, y: q.y };
  }
  function borne(v, max) { return Math.max(0, Math.min(max, v)); }
  function dansLeTerrain(p) {
    var t = terrainU();
    return { x: borne(p.x, t.w), y: borne(p.y, t.h) };
  }

  function dessinBrouillon() {
    var b = brouillon;
    var r = rectDe(b);
    return el("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.8, fill: remplissage(b.type), stroke: "var(--atlas-ink)", "stroke-width": 0.5, "stroke-dasharray": "1.6 1.2" });
  }
  function rectDe(b) {
    return { x: Math.min(b.x0, b.x1), y: Math.min(b.y0, b.y1), w: Math.abs(b.x1 - b.x0), h: Math.abs(b.y1 - b.y0) };
  }
  function appui(evt) {
    if (evt.button != null && evt.button !== 0) return;
    var svg = $("toile");
    var p = point(evt);
    var cible = evt.target.closest ? evt.target.closest("[data-id],[data-poignee]") : null;
    var tire = evt.target.closest ? evt.target.closest("[data-courbe],[data-coin]") : null;
    if (tire && !etat.outil) {
      var morceauxCle = (tire.getAttribute("data-courbe") || tire.getAttribute("data-coin")).split(":");
      prise = { courbe: { id: isNaN(+morceauxCle[0]) ? morceauxCle[0] : +morceauxCle[0], cote: morceauxCle[1], coin: tire.hasAttribute("data-coin") }, bouge: false };
      svg.setPointerCapture(evt.pointerId);
      return;
    }

    if (etat.outil && POINTS[etat.outil]) {
      var q = dansLeTerrain(p);
      if (etat.outil === "nourrice") etat.nourrice = q;
      else etat.piquage = { x: q.x, y: q.y, sorte: etat.outil };
      choisirOutil(null);
      dessiner();
      return;
    }
    if (etat.outil === "arbre") {
      var c = dansLeTerrain(p);
      choisirOutil(null);
      ouvrirArbre({ id: null, nom: null, d: null, x: c.x, y: c.y }, true);
      return;
    }
    if (etat.outil === "dalles") {
      var e = dansLeTerrain(p);
      if (!etat.departDalles) {
        etat.departDalles = e;
        $("consigne").textContent = "Touchez l’arrivée des dalles.";
        dessiner();
        return;
      }
      var a = etat.departDalles;
      etat.departDalles = null;
      choisirOutil(null);
      ouvrirDalles({ id: null, nom: null, L: null, l: null, e: null, a: a, b: e }, true);
      return;
    }
    if (etat.outil && MODE === "A") {
      var d = dansLeTerrain(p);
      brouillon = { type: etat.outil, x0: d.x, y0: d.y, x1: d.x, y1: d.y };
      svg.setPointerCapture(evt.pointerId);
      dessiner();
      return;
    }
    var boite = svg.parentNode;
    var agrandi = boite.scrollWidth > boite.clientWidth + 1 || boite.scrollHeight > boite.clientHeight + 1;
    if (cible) {
      var poig = cible.getAttribute("data-poignee");
      var id = poig || cible.getAttribute("data-id");
      var idv = isNaN(+id) ? id : +id;
      // Plan agrandi, presque tout l'écran est couvert de zones : le doigt y
      // fait glisser le plan, et ne déplace que la zone qu'on a choisie en la
      // touchant. Les petits signes (nourrice, piquage) se prennent toujours.
      if (agrandi && !poig && sorteDe(idv) !== "point" && etat.choisie !== idv) {
        prise = { glisse: true, toucher: idv, bouge: false, cx: evt.clientX, cy: evt.clientY, sl: boite.scrollLeft, st: boite.scrollTop };
        svg.setPointerCapture(evt.pointerId);
        return;
      }
      prise = { id: idv, etire: !!poig, depart: p, bouge: false, avant: copie(objetDe(id)) };
      etat.cotesDe = idv;
      etat.choisie = idv;
      // Les points verts ne se devinent pas : une ligne les nomme.
      var sorteChoisie = sorteDe(idv), objetChoisi = objetDe(idv);
      if (MODE === "B" && (sorteChoisie === "dalles" || (sorteChoisie === "zone" && objetChoisi.type !== "maison"))) $("consigne").textContent = "Tirez un point vert pour courber.";
      svg.setPointerCapture(evt.pointerId);
      dessiner();
      return;
    }
    // Le plan agrandi se fait glisser là où il est vide.
    if (agrandi) {
      prise = { glisse: true, cx: evt.clientX, cy: evt.clientY, sl: boite.scrollLeft, st: boite.scrollTop };
      svg.setPointerCapture(evt.pointerId);
    }
    if (etat.choisie !== null || etat.cotesDe != null) { etat.choisie = null; etat.cotesDe = null; dessiner(); }
  }

  function objetDe(id) {
    if (id === "nourrice") return etat.nourrice;
    if (id === "piquage") return etat.piquage;
    var tous = etat.arbres.concat(etat.dalles);
    for (var i = 0; i < tous.length; i++) if (tous[i].id === id) return tous[i];
    return etat.zones.filter(function (z) { return z.id === +id; })[0];
  }
  function sorteDe(id) {
    if (id === "nourrice" || id === "piquage") return "point";
    if (typeof id === "string" && id.charAt(0) === "a") return "arbre";
    if (typeof id === "string" && id.charAt(0) === "d") return "dalles";
    return "zone";
  }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }

  function glisse(evt) {
    if (prise && prise.glisse) {
      var boite = $("toile").parentNode;
      if (Math.abs(evt.clientX - prise.cx) + Math.abs(evt.clientY - prise.cy) > 6) prise.bouge = true;
      boite.scrollLeft = prise.sl - (evt.clientX - prise.cx);
      boite.scrollTop = prise.st - (evt.clientY - prise.cy);
      return;
    }
    var p = point(evt);
    var t = terrainU();
    if (prise && prise.courbe) {
      prise.bouge = true;
      var objet = objetDe(prise.courbe.id);
      if (sorteDe(prise.courbe.id) === "dalles") {
        // La courbe passe par le doigt, mais elle peut sortir du terrain entre
        // ses points : ce tirage-là ne se prend pas, la rangée reste où elle était.
        var avant = objet.courbe ? copie(objet.courbe) : null;
        tirerDalles(objet, +prise.courbe.cote, dansLeTerrain(p));
        var dehors = echantillonsDalles(objet).pts.some(function (q) { return q.x < 0 || q.y < 0 || q.x > t.w || q.y > t.h; });
        if (dehors) { if (avant) objet.courbe = avant; else delete objet.courbe; }
      }
      else if (prise.courbe.coin) tirerCoin(objet, prise.courbe.cote, p);
      else tirerCote(objet, prise.courbe.cote, p);
      dessiner();
      return;
    }
    if (brouillon) {
      var d = dansLeTerrain(p);
      brouillon.x1 = d.x; brouillon.y1 = d.y;
      dessiner();
      return;
    }
    if (!prise) return;
    var dx = p.x - prise.depart.x, dy = p.y - prise.depart.y;
    if (!prise.bouge && Math.abs(dx) + Math.abs(dy) < 1.5 * TRAIT) return;
    prise.bouge = true;
    var o = objetDe(prise.id), a = prise.avant, sorte = sorteDe(prise.id);
    if (sorte === "point" || sorte === "arbre") {
      o.x = borne(auPas(a.x + dx), t.w); o.y = borne(auPas(a.y + dy), t.h);
    } else if (sorte === "dalles") {
      // Les deux bouts bougent ensemble, et restent dans le terrain.
      var mx = Math.min(a.a.x, a.b.x), Mx = Math.max(a.a.x, a.b.x);
      var my = Math.min(a.a.y, a.b.y), My = Math.max(a.a.y, a.b.y);
      var ddx = Math.max(-mx, Math.min(t.w - Mx, auPas(dx))), ddy = Math.max(-my, Math.min(t.h - My, auPas(dy)));
      o.a = { x: a.a.x + ddx, y: a.a.y + ddy };
      o.b = { x: a.b.x + ddx, y: a.b.y + ddy };
    } else if (prise.etire) {
      o.w = Math.max(3, Math.min(t.w - a.x, a.w + dx));
      o.h = Math.max(3, Math.min(t.h - a.y, a.h + dy));
    } else {
      o.x = borne(auPas(a.x + dx), Math.max(0, t.w - o.w));
      o.y = borne(auPas(a.y + dy), Math.max(0, t.h - o.h));
    }
    dessiner();
  }

  function relache() {
    if (brouillon) {
      var b = brouillon;
      brouillon = null;
      var t = terrainU();
      var z = { id: etat.suivant++, type: b.type, nom: null, L: null, l: null };
      var r = rectDe(b);
      if (r.w < 4 || r.h < 4) {
        r = { w: Math.min(22, t.w), h: Math.min(16, t.h) };
        r.x = borne(b.x0 - r.w / 2, t.w - r.w); r.y = borne(b.y0 - r.h / 2, t.h - r.h);
      }
      z.x = r.x; z.y = r.y; z.w = r.w; z.h = r.h;
      etat.zones.push(z);
      etat.choisie = z.id;
      choisirOutil(null);
      dessiner();
      ouvrir(z, true);
      return;
    }
    if (prise && prise.courbe) { prise = null; dessiner(); return; }
    if (prise) {
      var pr = prise;
      prise = null;
      // Un simple toucher sur une zone du plan agrandi la choisit et l'ouvre.
      if (pr.glisse && (pr.bouge || pr.toucher == null)) return;
      if (pr.glisse) { pr.id = pr.toucher; etat.choisie = pr.toucher; }
      if (!pr.bouge && !pr.etire) {
        var o = objetDe(pr.id), sorte = sorteDe(pr.id);
        if (sorte === "point") ouvrirPoint(pr.id);
        else if (sorte === "arbre") ouvrirArbre(o, false);
        else if (sorte === "dalles") ouvrirDalles(o, false);
        else ouvrir(o, false);
      }
      dessiner();
    }
  }

  /* ── Les outils ────────────────────────────────────────────── */
  function choisirOutil(o) {
    etat.outil = etat.outil === o ? null : o;
    if (etat.outil !== "dalles") etat.departDalles = null;
    document.querySelectorAll(".outils button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.outil === etat.outil));
    });
    var c = "";
    if (etat.outil && POINTS[etat.outil]) c = POINTS[etat.outil].consigne;
    else if (etat.outil === "arbre") c = "Touchez le centre de l’arbre.";
    else if (etat.outil === "dalles") c = "Touchez le départ des dalles.";
    else if (etat.outil && MODE === "A") c = etat.outil === "haie" ? "Tracez la haie au doigt." : "Tracez la zone au doigt.";
    $("consigne").textContent = c;
  }

  function surOutil(o) {
    if (MODE === "B" && TYPES[o]) {
      var z = { id: null, type: o, nom: null, L: null, l: null, x: 0, y: 0, w: 0, h: 0 };
      ouvrir(z, true);
      return;
    }
    choisirOutil(o);
  }

  /* ── La feuille des cotes ──────────────────────────────────── */
  var enCours = null;

  /* Une seule feuille sert à tout : on n'y montre que les champs de ce qu'on
     pose. */
  function montrerChamps(c) {
    $("f-cotes").hidden = !c.cotes;
    $("f-distance").hidden = !c.distance;
    $("f-surface").hidden = !c.surface;
    // Pour une dalle, la cote est celle d'UNE dalle : il l'a prise pour l'écart.
    document.querySelector("label[for=f-L]").textContent = c.dalles ? "Longueur d’une dalle" : "Longueur";
    document.querySelector("label[for=f-l]").textContent = c.dalles ? "Largeur d’une dalle" : "Largeur";
    $("f-diametre").hidden = !c.diametre;
    $("f-ecart").hidden = !c.ecart;
    $("f-arrosees").hidden = !c.arrosees;
    $("f-lignes").hidden = !c.lignes;
    $("f-note").textContent = "";
    $("f-erreur").textContent = "";
    ["f-L", "f-l", "f-d", "f-e", "f-dist"].forEach(function (i) { $(i).removeAttribute("aria-invalid"); });
  }
  function boutons(neuf, tourner) {
    $("f-valider").textContent = neuf ? "Poser" : "Valider";
    $("f-tourner").hidden = !tourner;
    $("f-valider").classList.toggle("seul", !tourner);
    $("f-supprimer").hidden = neuf;
    var o = enCours && enCours.z;
    $("f-redresser").hidden = neuf || !deformee(o);
  }

  function ouvrir(z, neuve) {
    enCours = { sorte: "zone", z: z, neuve: neuve };
    $("f-titre").textContent = nomDe(z);
    $("f-nom").value = z.nom || "";
    $("f-nom").placeholder = TYPES[z.type].nom;
    $("f-L").value = z.L == null ? "" : ecrit(z.L);
    $("f-l").value = z.l == null ? "" : ecrit(z.l);
    montrerChamps({ cotes: true, surface: true, lignes: z.type === "haie" });
    lignesEnCours = { n: z.lignes || lignesProposees(z.l), choisies: !!z.lignesChoisies };
    rendreLignes();
    var nouvelleB = MODE === "B" && neuve;
    boutons(nouvelleB, MODE === "B" && !nouvelleB);
    $("feuille").hidden = false;
    setTimeout(function () { $("f-L").focus(); }, 60);
  }

  function ouvrirArbre(a, neuf) {
    enCours = { sorte: "arbre", z: a, neuve: neuf };
    $("f-titre").textContent = a.nom || "Arbre";
    $("f-nom").value = a.nom || "";
    $("f-nom").placeholder = "Arbre";
    $("f-d").value = a.d == null ? "" : ecrit(a.d);
    montrerChamps({ cotes: true, diametre: true });
    boutons(neuf, false);
    $("feuille").hidden = false;
    setTimeout(function () { $("f-d").focus(); }, 60);
  }

  function ouvrirDalles(d, neuves) {
    enCours = { sorte: "dalles", z: d, neuve: neuves };
    $("f-titre").textContent = d.nom || "Dalles";
    $("f-nom").value = d.nom || "";
    $("f-nom").placeholder = "Dalles";
    $("f-L").value = d.L == null ? "" : ecrit(d.L);
    $("f-l").value = d.l == null ? "" : ecrit(d.l);
    $("f-e").value = d.e == null ? "" : ecrit(d.e);
    $("f-dist").value = ecrit(enMetres(longueurDeLaRangee(d)));
    montrerChamps({ cotes: true, distance: true, surface: true, ecart: true, dalles: true, arrosees: true });
    arroseesEnCours = d.arrosees === undefined ? null : d.arrosees;
    rendreArrosees();
    boutons(neuves, !neuves);
    rendreNoteDalles();
    $("feuille").hidden = false;
    setTimeout(function () { $("f-dist").focus(); }, 60);
  }

  /* Combien de dalles, pendant qu'il tape : le compte suit la saisie. */
  function rendreNoteDalles() {
    if (!enCours || enCours.sorte !== "dalles") return;
    var essai = copie(enCours.z);
    lireDalles(essai);
    if (!essai.L || !essai.distance) { $("f-note").textContent = ""; return; }
    essai.b = arriveeA(essai, essai.distance);
    var r = rangeeDeDalles(essai);
    $("f-note").textContent = ecritDalles(r.n) + " sur " + ecrit(enMetres(r.dist)) + " m.";
  }

  /* « On les arrose ? » Pas de réponse d'office : il la donne. */
  var arroseesEnCours = null;
  function rendreArrosees() {
    document.querySelectorAll("#f-arrosees [data-arrosees]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(arroseesEnCours !== null && (b.dataset.arrosees === "oui") === arroseesEnCours));
    });
  }

  var lignesEnCours = { n: null, choisies: false };
  function rendreLignes() {
    $("f-nombre").textContent = lignesEnCours.n ? ecritLignes(lignesEnCours.n) : "?";
    $("f-moins").disabled = !lignesEnCours.n || lignesEnCours.n <= 1;
    var p = lignesProposees(nombre($("f-l").value));
    $("f-propose").textContent = p && p !== lignesEnCours.n ? "Proposé : " + ecritLignes(p) + "." : p ? "Proposé." : "";
  }

  function ouvrirPoint(id) {
    enCours = { sorte: "point", point: id };
    var nom = id === "nourrice" ? "La nourrice" : POINTS[etat.piquage.sorte].nom;
    $("f-titre").textContent = nom;
    montrerChamps({});
    $("f-tourner").hidden = true;
    $("f-valider").textContent = "Fermer";
    $("f-valider").classList.add("seul");
    $("f-supprimer").hidden = false;
    $("feuille").hidden = false;
  }

  /* Toucher à côté referme la feuille (le pavé de l’iPhone n’a pas de touche OK).
     Ce qui n’est pas encore posé s’abandonne : rien n’était dessiné. */
  function horsFeuille() {
    if (enCours && enCours.neuve && (MODE === "B" || enCours.sorte !== "zone")) { fermer(); return; }
    valider();
  }

  function fermer() { $("feuille").hidden = true; enCours = null; dessiner(); }

  function lireFeuille(z) {
    z.nom = $("f-nom").value.trim() || null;
    z.L = nombre($("f-L").value);
    z.l = nombre($("f-l").value);
    if (z.type === "haie") { z.lignes = lignesEnCours.n; z.lignesChoisies = lignesEnCours.choisies; }
  }
  function lireDalles(d) {
    d.nom = $("f-nom").value.trim() || null;
    d.L = nombre($("f-L").value);
    d.l = nombre($("f-l").value);
    // L'écart vide reste vide : des dalles jointives, rien de supposé.
    d.e = nombre($("f-e").value);
    d.distance = nombre($("f-dist").value);
  }

  /* Ce qui manque se dit sur le champ lui-même, et rien ne se pose. */
  function refuseVides(champs) {
    var manque = false;
    champs.forEach(function (v) {
      $(v[0]).setAttribute("aria-invalid", String(v[1] == null));
      if (v[1] == null) manque = true;
    });
    return manque;
  }

  function validerArbre() {
    var a = enCours.z;
    var d = nombre($("f-d").value);
    if (refuseVides([["f-d", d]])) return;
    var t = etat.terrain;
    if (d > Math.max(t.L, t.l) + 1e-9) {
      $("f-d").setAttribute("aria-invalid", "true");
      $("f-erreur").textContent = phraseTropGrande();
      return;
    }
    a.d = d;
    a.nom = $("f-nom").value.trim() || null;
    if (enCours.neuve) { a.id = "a" + etat.suivant++; etat.arbres.push(a); }
    fermer();
  }

  function validerDalles() {
    var d = enCours.z;
    var essai = copie(d);
    lireDalles(essai);
    if (refuseVides([["f-dist", essai.distance], ["f-L", essai.L], ["f-l", essai.l]])) return;
    if (arroseesEnCours === null) { $("f-erreur").textContent = "Dites si on les arrose."; return; }
    var b = arriveeA(essai, essai.distance), t = terrainU(), marge = 1e-6;
    if (essai.courbe) {
      var essaiB = copie(essai); essaiB.b = b;
      var horsDuTerrain = echantillonsDalles(essaiB).pts.some(function (q) { return q.x < -marge || q.y < -marge || q.x > t.w + marge || q.y > t.h + marge; });
      if (horsDuTerrain) { $("f-dist").setAttribute("aria-invalid", "true"); $("f-erreur").textContent = phraseTropGrande(); return; }
    } else if (arroseesEnCours === false) {
      var droite = redressee(essai.a, b);
      if (!droite) { $("f-erreur").textContent = "Pour ne pas les arroser, posez la rangée droite, couchée ou debout."; return; }
      b = droite;
    }
    if (b.x < -marge || b.y < -marge || b.x > t.w + marge || b.y > t.h + marge) {
      $("f-dist").setAttribute("aria-invalid", "true");
      $("f-erreur").textContent = phraseTropGrande();
      return;
    }
    if (essai.L > essai.distance + 1e-9) {
      $("f-L").setAttribute("aria-invalid", "true");
      $("f-erreur").textContent = "Plus longue que la distance, qui fait " + ecrit(essai.distance) + " m.";
      return;
    }
    lireDalles(d);
    d.b = b;
    d.arrosees = arroseesEnCours;
    delete d.distance;
    if (enCours.neuve) { d.id = "d" + etat.suivant++; etat.dalles.push(d); }
    fermer();
  }

  function valider() {
    if (!enCours) return;
    if (enCours.sorte === "point") { fermer(); return; }
    if (enCours.sorte === "arbre") { validerArbre(); return; }
    if (enCours.sorte === "dalles") { validerDalles(); return; }
    var z = enCours.z;
    if (MODE === "B") {
      // En B, c'est la cote qui donne la taille : sans elle, rien à poser.
      var essai = copie(z);
      lireFeuille(essai);
      if (refuseVides([["f-L", essai.L], ["f-l", essai.l]])) return;
      var trop = cotesTropGrandes(essai);
      if (trop.length) {
        trop.forEach(function (i) { $(i).setAttribute("aria-invalid", "true"); });
        $("f-erreur").textContent = phraseTropGrande();
        return;
      }
    }
    lireFeuille(z);
    // En A, le dessin ordonne : une longueur tapée pour le côté que le doigt
    // a tracé debout va sur ce côté-là. La zone est la même, les cotes aussi.
    if (MODE === "A" && z.L != null && z.l != null && (z.L - z.l) * (z.w - z.h) < 0) {
      var L0 = z.L; z.L = z.l; z.l = L0;
    }
    if (MODE === "B") {
      tailleSelonCotes(z);
      if (enCours.neuve) {
        // Posée au milieu du terrain, un peu décalée de la précédente : il la
        // glisse ensuite à sa place. La place n'est pas une donnée, la cote si.
        var t = terrainU(), n = etat.zones.length % 5;
        z.x = borne(t.w / 2 - z.w / 2 + n * 3, Math.max(0, t.w - z.w));
        z.y = borne(t.h / 2 - z.h / 2 + n * 3, Math.max(0, t.h - z.h));
        z.id = etat.suivant++;
        etat.zones.push(z);
        etat.choisie = z.id;
        etat.cotesDe = z.id;
        $("consigne").textContent = "Glissez la zone à sa place.";
      }
    }
    fermer();
  }

  function tourner() {
    if (!enCours) return;
    if (enCours.sorte === "dalles") {
      // Une dalle tournée : sa longueur passe dans le sens de la marche.
      var d = enCours.z;
      lireDalles(d);
      if (d.distance) d.b = arriveeA(d, d.distance);
      delete d.distance;
      var Ld = d.L; d.L = d.l; d.l = Ld;
      fermer();
      return;
    }
    var z = enCours.z;
    var essai = copie(z);
    lireFeuille(essai);
    var L0 = essai.L; essai.L = essai.l; essai.l = L0;
    // Tournée, elle peut ne plus tenir : on refuse plutôt que de déborder.
    if (cotesTropGrandes(essai).length) { $("f-erreur").textContent = phraseTropGrande(); return; }
    lireFeuille(z);
    var L = z.L; z.L = z.l; z.l = L;
    tailleSelonCotes(z);
    var t = terrainU();
    z.x = borne(z.x, Math.max(0, t.w - z.w));
    z.y = borne(z.y, Math.max(0, t.h - z.h));
    fermer();
  }

  function supprimer() {
    if (!enCours) return;
    etat.cotesDe = null;
    if (enCours.point === "nourrice") etat.nourrice = null;
    else if (enCours.point === "piquage") etat.piquage = null;
    else if (enCours.sorte === "arbre") etat.arbres = etat.arbres.filter(function (a) { return a !== enCours.z; });
    else if (enCours.sorte === "dalles") etat.dalles = etat.dalles.filter(function (d) { return d !== enCours.z; });
    else {
      var id = enCours.z.id;
      etat.zones = etat.zones.filter(function (z) { return z.id !== id; });
      etat.choisie = null;
    }
    fermer();
  }

  /* ── Le terrain ────────────────────────────────────────────── */
  function surTerrain() {
    var avant = terrainU(), sAvant = cote_du_carre();
    etat.terrain.L = nombre($("t-L").value);
    etat.terrain.l = nombre($("t-l").value);
    var apres = terrainU(), sApres = cote_du_carre();
    var garde = MODE === "B" && sAvant && sApres;
    // En B, tout garde ses mètres : c'est le carré qui change d'échelle. En A,
    // le dessin suit le cadre : ce qui était au tiers gauche y reste.
    var kx = garde ? sAvant / sApres : apres.w / avant.w;
    var ky = garde ? sAvant / sApres : apres.h / avant.h;
    function deplace(p) {
      if (!p) return;
      p.x = borne(p.x * kx, apres.w); p.y = borne(p.y * ky, apres.h);
    }
    etat.zones.forEach(function (z) {
      z.x *= kx; z.y *= ky;
      if (garde) tailleSelonCotes(z);
      else { z.w *= kx; z.h *= ky; }
      z.x = borne(z.x, Math.max(0, apres.w - z.w));
      z.y = borne(z.y, Math.max(0, apres.h - z.h));
    });
    etat.arbres.forEach(deplace);
    etat.dalles.forEach(function (d) { deplace(d.a); deplace(d.b); });
    deplace(etat.nourrice);
    deplace(etat.piquage);
    rendreOutils();
    dessiner();
  }

  function rendreOutils() {
    var sansEchelle = !cote_du_carre();
    var bloque = MODE === "B" && sansEchelle;
    document.querySelectorAll(".outils button").forEach(function (b) {
      // L'arbre et les dalles ont une taille en mètres : sans terrain coté,
      // ils n'en ont pas, même en A.
      b.disabled = bloque || (sansEchelle && (b.dataset.outil === "arbre" || b.dataset.outil === "dalles"));
    });
    $("t-echelle").disabled = sansEchelle;
    if (bloque) $("consigne").textContent = "Les métrés du terrain d’abord.";
    else if ($("consigne").textContent === "Les métrés du terrain d’abord.") $("consigne").textContent = "";
  }

  /* ── Ce que l'outil comprend ───────────────────────────────── */
  function fraction(p) { return { x: arrondi(p.x / 100), y: arrondi(p.y / 100) }; }
  function croquisLu() {
    var reserves = [];
    // Une zone coupée par des dalles qu'on n'arrose pas part en MORCEAUX :
    // chacun est une zone, avec ses cotes à lui, et le calcul en pose les
    // arroseurs aux angles et le long des bords, donc le long des dalles.
    var zones = [];
    etat.zones.forEach(function (z) {
      if (z.type === "maison") return;
      var haie = z.type === "haie";
      if (!mesuree(z)) reserves.push("« " + nomDe(z) + " » n’a pas ses métrés");
      var parts = morceaux(z);
      parts.forEach(function (q, i) {
        var coupee = parts.length > 1;
        // Courbe ou coupée, la zone part avec les cotes du rectangle qu'elle
        // donne au calcul ; droite et entière, avec les siennes.
        var autre = coupee || formeLibre(z);
        var L = autre ? arrondi(enMetres(q.w)) : z.L, l = autre ? arrondi(enMetres(q.h)) : z.l;
        var lue = {
          type: z.type,
          nom: coupee ? nomDe(z) + " " + (i + 1) : z.nom,
          L: haie ? null : L,
          l: haie ? null : l,
          ml: haie ? L : null,
          x: arrondi((q.x + q.w / 2) / 100),
          y: arrondi((q.y + q.h / 2) / 100),
          largeurFraction: arrondi(q.w / 100),
          hauteurFraction: arrondi(q.h / 100)
        };
        // Le champ neuf : la largeur de la haie, qu'il a demandée le 18 octobre.
        if (haie) { lue.largeur = l; lue.lignesHaie = z.lignes || null; }
        zones.push(lue);
      });
    });
    if (!etat.nourrice) reserves.push("le croquis ne montre pas où la nourrice est posée");
    if (!etat.piquage) reserves.push("le croquis ne montre pas où le piquage se fait");
    var lu = {
      zones: zones,
      pointDEau: etat.piquage ? etat.piquage.sorte : null,
      nourrice: etat.nourrice ? fraction(etat.nourrice) : null,
      piquage: etat.piquage ? fraction(etat.piquage) : null,
      reserves: reserves
    };
    // Les arbres et les dalles ne partent pas : l'arbre ne change rien au plan
    // (sa réponse du 19 octobre), et les dalles qu'on n'arrose pas sont déjà
    // dans les morceaux des zones.
    return lu;
  }
  function arrondi(n) { return Math.round(n * 10000) / 10000; }

  function rendreEtat() {
    var lu = croquisLu();
    // La même règle que le serveur (`zoneMesuree`) : la haie par ses mètres
    // linéaires, le reste par ses deux cotes.
    var mesurees = lu.zones.filter(function (z) { return z.type === "haie" ? z.ml != null : z.L != null && z.l != null; });
    var e = C.etatDuCroquis({
      zonesMesurees: mesurees.length,
      nourrice: !!lu.nourrice,
      piquage: !!lu.piquage,
      branchement: lu.pointDEau === "compteur" ? "compteur" : "ailleurs"
    });
    var ul = $("etat");
    ul.innerHTML = "";
    function ligne(texte, classe) {
      var li = document.createElement("li");
      li.textContent = texte;
      if (classe) li.className = classe;
      ul.appendChild(li);
    }
    e.manque.forEach(function (m) { ligne(C.LIBELLES[m].titre, "rouge"); });
    etat.zones.forEach(function (z) {
      if (z.type !== "maison" && !mesuree(z)) ligne("Les métrés de " + nomDe(z) + " manquent, cette zone n’entre pas dans le plan.");
    });
    var debordent = etat.zones.filter(function (z) { return cotesTropGrandes(z).length > 0; });
    debordent.forEach(function (z) {
      ligne("Pas de plan : " + nomDe(z) + " (" + cote(z.L) + " × " + cote(z.l) + " m) ne tient pas dans le terrain de " + cote(etat.terrain.L) + " × " + cote(etat.terrain.l) + " m.", "rouge");
    });
    etat.zones.forEach(function (z) {
      var n = morceaux(z).length;
      if (z.type === "maison") return;
      var qui = morceaux(z).coupeurs.join(" et ");
      var sujet = qui.charAt(0).toUpperCase() + qui.slice(1);
      var verbe = morceaux(z).coupeurs.length > 1 || qui === "les dalles" ? "coupent" : "coupe";
      if (n === 0) ligne(sujet + " " + (verbe === "coupe" ? "couvre " : "couvrent ") + nomDe(z) + " entièrement, cette zone n’entre pas dans le plan.");
      else if (n > 1) ligne(sujet + " " + verbe + " " + nomDe(z) + " en " + n + " parts.");
    });
    // Sa règle du 19 octobre : expliquer, ne pas refuser, et dire que ce sera
    // arrosé quand même.
    etat.zones.forEach(function (z) {
      if (z.type === "maison" || !formeLibre(z)) return;
      var c = cadreDe(z), dims = ecrit(Math.round(enMetres(c.w) * 100) / 100) + " × " + ecrit(Math.round(enMetres(c.h) * 100) / 100) + " m";
      if (z.type === "gazon") ligne("La forme de " + nomDe(z) + " est arrosée comme le rectangle qui l’entoure, " + dims + ". Les arroseurs du bord peuvent mouiller un peu au-delà.");
      else ligne("Le goutte-à-goutte de " + nomDe(z) + " est compté sur le rectangle qui l’entoure, " + dims + ", un peu plus de tube que la forme.");
    });
    etat.dalles.forEach(function (d) {
      if (d.arrosees !== false || !d.courbe) return;
      var b = emprise(d.id);
      etat.zones.forEach(function (z) {
        if (z.type === "maison") return;
        var c = cadreDe(z);
        if (b.x < c.x + c.w && b.x + b.w > c.x && b.y < c.y + c.h && b.y + b.h > c.y) {
          ligne("Les dalles en courbe ne coupent pas " + nomDe(z) + " : elles sont arrosées avec cette zone.");
        }
      });
    });
    var faire = $("faire");
    faire.hidden = !e.complet || debordent.length > 0;
    if (lu.nourrice && lu.piquage) {
      var places = mesurees.map(function (z) {
        return { position: { x: z.x, y: z.y }, largeurFraction: z.largeurFraction, hauteurFraction: z.hauteurFraction, L: z.L, l: z.l, ml: z.ml };
      });
      var a = C.longueurDeLAmenee(lu.piquage, lu.nourrice, places);
      var depuis = lu.pointDEau === "robinet" ? "Du robinet" : "Du compteur";
      if (a.ok) ligne(depuis + " à la nourrice : " + ecrit(a.metres) + " m.", "bon");
      else ligne("L’amenée n’est pas comptée : " + a.raison + ".", "rouge");
    }
    $("recu-json").textContent = JSON.stringify(lu, null, 2);
  }

  /* ── L'exemple ─────────────────────────────────────────────── */
  function exemple() {
    // Les zones de son jardin d'exemple (arrosage-plan.html), en mètres.
    var Z = [
      { type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
      { type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
      { type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4 },
      { type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2 }
    ];
    // En A, le dessin est fait à main levée : un peu large ici, un peu court
    // là. Les cotes, elles, sont justes. C'est le cas qu'il a demandé de lire.
    var MAIN = [[1.12, 0.95], [0.86, 1.1], [0.9, 1.6], [1.15, 1.5]];
    etat.terrain = { L: 34, l: 16 };
    $("t-L").value = "34"; $("t-l").value = "16";
    var s = 34;
    etat.zones = Z.map(function (z, i) {
      var k = MODE === "A" ? MAIN[i] : [1, 1];
      return { id: i + 1, type: z.type, nom: z.nom, L: z.L, l: z.l, x: z.x / s * 100, y: z.y / s * 100, w: z.L / s * 100 * k[0], h: z.l / s * 100 * k[1] };
    });
    etat.suivant = Z.length + 1;
    etat.arbres = []; etat.dalles = []; etat.departDalles = null; etat.cotesDe = null;
    etat.nourrice = null; etat.piquage = null; etat.choisie = null;
    choisirOutil(null);
    rendreOutils();
    dessiner();
  }

  /* ── Les deux écrans ───────────────────────────────────────── */
  function montrer(outil) {
    $("depart").hidden = outil;
    $("outil").hidden = !outil;
    window.scrollTo(0, 0);
    if (outil) dessiner();
  }

  /* « Forme d'origine » : les côtés droits, les coins à leur place. */
  function formeDOrigine(o) {
    if (!o) return;
    delete o.courbes;
    delete o.coins;
    delete o.courbe;
  }

  /* ── Deux doigts : la loupe ─────────────────────────────────────
     Sa demande du 19 octobre : « zoomer à n'importe quel endroit de la carte
     avec mes deux doigts, et après avec le slide je me déplace ». L'écart des
     doigts règle la loupe, et le point du plan qui était entre eux y reste. */
  var doigts = {}, pince = null;
  function lesDeux() {
    var k = Object.keys(doigts);
    return [doigts[k[0]], doigts[k[1]]];
  }
  function commencerPince() {
    // Le premier doigt tenait peut-être un objet : il le lâche là où il était.
    if (prise && prise.id != null && prise.avant) Object.assign(objetDe(prise.id), prise.avant);
    prise = null; brouillon = null;
    var d = lesDeux(), svg = $("toile");
    var milieu = { x: (d[0].x + d[1].x) / 2, y: (d[0].y + d[1].y) / 2 };
    var m = svg.getScreenCTM().inverse(), q = svg.createSVGPoint();
    q.x = milieu.x; q.y = milieu.y;
    pince = { ecart: Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y) || 1, loupe: etat.loupe, cible: q.matrixTransform(m) };
  }
  function suivrePince() {
    var d = lesDeux(), svg = $("toile"), boite = svg.parentNode;
    var ecart = Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y) || 1;
    etat.loupe = Math.max(1, Math.min(40, pince.loupe * ecart / pince.ecart));
    dessiner();
    var c = svg.getScreenCTM(), cible = pince.cible;
    var sx = c.a * cible.x + c.c * cible.y + c.e, sy = c.b * cible.x + c.d * cible.y + c.f;
    boite.scrollLeft += sx - (d[0].x + d[1].x) / 2;
    boite.scrollTop += sy - (d[0].y + d[1].y) / 2;
  }

  function lancer() {
    var ch = $("charte");
    ["origine", "brume", "pierre", "beurre", "moka", "prune", "sylve", "nuit"].forEach(function (n) {
      var o = document.createElement("option");
      o.value = n; o.textContent = n.charAt(0).toUpperCase() + n.slice(1);
      ch.appendChild(o);
    });
    ch.value = document.body.dataset.charte || "origine";
    ch.addEventListener("change", function () { document.body.dataset.charte = ch.value; });

    $("dessiner").addEventListener("click", function () { montrer(true); });
    $("retour").addEventListener("click", function () { montrer(false); });
    $("exemple").addEventListener("click", function () { montrer(true); exemple(); });
    $("t-L").addEventListener("input", surTerrain);
    $("t-l").addEventListener("input", surTerrain);
    $("t-echelle").addEventListener("change", function () {
      etat.echelle = +$("t-echelle").value || null;
      etat.loupe = 1;
      dessiner();
      if (!etat.outil) $("consigne").textContent = etat.echelle ? "Touchez une zone pour la choisir, puis glissez-la." : "";
    });
    window.addEventListener("resize", function () { if (!$("outil").hidden) dessiner(); });
    document.querySelectorAll(".outils button").forEach(function (b) {
      b.addEventListener("click", function () { surOutil(b.dataset.outil); });
    });
    var svg = $("toile");
    svg.addEventListener("pointerdown", function (e) {
      doigts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(doigts).length === 2) { commencerPince(); return; }
      if (!pince) appui(e);
    });
    svg.addEventListener("pointermove", function (e) {
      if (doigts[e.pointerId]) doigts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pince) { suivrePince(); return; }
      glisse(e);
    });
    function finDuDoigt(e) {
      delete doigts[e.pointerId];
      if (pince) { if (Object.keys(doigts).length < 2) pince = null; return; }
      relache(e);
    }
    svg.addEventListener("pointerup", finDuDoigt);
    svg.addEventListener("pointercancel", function (e) { delete doigts[e.pointerId]; pince = null; brouillon = null; prise = null; dessiner(); });
    $("f-valider").addEventListener("click", valider);
    // Un champ signalé vide cesse de l'être dès qu'on y tape.
    ["f-L", "f-l", "f-d", "f-e", "f-dist"].forEach(function (i) {
      $(i).addEventListener("input", function () {
        $(i).removeAttribute("aria-invalid");
        $("f-erreur").textContent = "";
        rendreNoteDalles();
      });
    });
    $("f-l").addEventListener("input", function () {
      if (!lignesEnCours.choisies) lignesEnCours.n = lignesProposees(nombre($("f-l").value));
      rendreLignes();
    });
    document.querySelectorAll("#f-arrosees [data-arrosees]").forEach(function (b) {
      b.addEventListener("click", function () {
        arroseesEnCours = b.dataset.arrosees === "oui";
        $("f-erreur").textContent = "";
        rendreArrosees();
      });
    });
    [["f-moins", -1], ["f-plus", 1]].forEach(function (c) {
      $(c[0]).addEventListener("click", function () {
        var n = (lignesEnCours.n || lignesProposees(nombre($("f-l").value)) || 1) + c[1];
        lignesEnCours = { n: Math.max(1, n), choisies: true };
        rendreLignes();
      });
    });
    $("f-tourner").addEventListener("click", tourner);
    $("f-supprimer").addEventListener("click", supprimer);
    // « Forme d'origine » : la zone ou la rangée reprend ses côtés droits et ses
    // coins, depuis la feuille ou depuis le bouton sous le plan.
    $("f-redresser").addEventListener("click", function () {
      if (!enCours || !enCours.z) return;
      formeDOrigine(enCours.z);
      fermer();
    });
    $("forme-origine").addEventListener("click", function () {
      formeDOrigine(objetDe(etat.choisie));
      dessiner();
    });
    $("feuille").addEventListener("click", function (e) { if (e.target === $("feuille")) horsFeuille(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("feuille").hidden) horsFeuille();
      if (e.key === "Enter" && !$("feuille").hidden && e.target.tagName === "INPUT") { e.preventDefault(); valider(); }
    });
    $("faire").querySelector("button").addEventListener("click", function () {
      var d = $("recu");
      d.open = true;
      d.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    rendreOutils();
    dessiner();
  }

  document.addEventListener("DOMContentLoaded", lancer);
})();
