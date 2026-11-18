/* =======================================================================
   LA COMPOSITION DU FILM « LE CLIENT SIGNE SON DEVIS » (site de vente,
   planche vente/cause-2.html, chapitre Envoyez).

   Ce script ne se charge pas seul : film-envoi-signe.cjs l'injecte dans la
   planche soignee/devis-signe-dans-une-feuille.html, puis photographie le
   résultat image par image.

   Sa demande du 18 novembre 2026 : « ce que reçoit le client pour accepter
   le devis. Maintenant, il y a une nouvelle planche qui est sortie, qui est
   en train d'être codée dans l'application. Il faudrait l'ajouter à
   l'animation. [...] quand il clique sur accepter le devis, il y a le petit
   truc pour signer électroniquement qui apparaît. Il signe et ensuite sa
   signature vient s'apposer sur le devis. [...] Là tu dessines une
   signature manuellement. Tchac. Ensuite on voit la signature qui se
   transfère et qui vient s'apposer sur le devis. »

   CE QUI EST VRAI, ET CE QUI NE L'EST PAS ENCORE.
   Les écrans sont ceux de la planche, c'est-à-dire la vraie page que reçoit
   le client, figée telle que l'appli la peint, et la feuille « Votre
   signature » de la planche B, celle qu'il décrit (la signature paraît
   quand on touche « J'accepte ce devis » ; son choix entre elle et la
   planche d'avant n'était pas encore écrit dans le dépôt ce jour-là). Rien
   n'est redessiné : on reprend ses nœuds, on les anime.
   La planche est faite sur le jeu d'essai (Perret Paysage, Mme Lefèvre). Le
   site, lui, suit UN chantier, celui de Mr. Lemaire (en-tête de cause.html) :
   les mots et les montants sont donc remplacés par les siens, relevés sur le
   film d'avant (vente/images/nov-film-envoi.mp4, filmé dans l'appli). Le
   rendu est comparé à la première image de ce film, et l'outil refuse de
   continuer s'ils ne se recouvrent pas.
   La signature de la planche disait « Lefèvre » : celle-ci est tracée à la
   main pour ce film, et ne dit rien de plus qu'un paraphe.
   Le devis sur lequel elle se pose est le vrai PDF du chantier Lemaire
   (vente/images/nov-devis.jpg). La signature dans son encadré et la mention
   « Signé en ligne par » sont posées dessus comme la planche les montre, à
   la même place et dans le même caractère : la fonction est en cours de
   codage, il n'existe pas encore de PDF signé à photographier. Le jour où
   elle est dans l'appli, ce film se refait en filmant l'appli.

   CE QUI EST DU MONTAGE, ET PAS DE L'APPLI. La feuille monte et redescend
   (dans l'appli elle apparaît d'un coup), la case des quatorze jours prend
   sa place en glissant, et le passage de la page du client à son devis (le
   devis qui paraît sous la signature, la signature qui se soulève avec son
   ombre et retombe dans l'encadré) est une image : dans l'appli, le client
   ouvre son PDF et la trouve dedans. La
   caméra aussi, qui s'approche à peine pour la date et recule quand la
   feuille monte : elle ne coupe aucun mot.
   D'un écran à l'autre, un fondu court et rien d'autre : glisser, empiler
   et zoomer ont été écartés par lui sur defilement.html (« ça ne fait pas
   professionnel »). Le devis ne glisse donc pas dans le téléphone.
   Les appuis, eux, sont ceux de l'appli : le bouton plein s'enfonce et
   s'éclaire (globals.css, .atlas-plein:active). Rien n'est posé sur l'écran
   pour montrer le doigt (son refus).

   Tout l'état est une fonction du temps : poser(t).
   ======================================================================= */
(function () {
  "use strict";

  var etat = function (nom) { return document.querySelector('[data-planche="' + nom + '"]'); };
  var creer = function (balise, attributs, parent) {
    var e = document.createElement(balise);
    for (var k in attributs) { if (k === "texte") e.textContent = attributs[k]; else e.setAttribute(k, attributs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  };
  var NS = "http://www.w3.org/2000/svg";
  var svg = function (balise, attributs, parent) { var e = document.createElementNS(NS, balise); for (var k in attributs) e.setAttribute(k, attributs[k]); if (parent) parent.appendChild(e); return e; };

  // ── Les courbes ──────────────────────────────────────────────────────────
  var courbe = function (x1, y1, x2, y2) {
    return function (p) {
      if (p <= 0) return 0; if (p >= 1) return 1;
      var a = 0, b = 1, m;
      for (var i = 0; i < 40; i++) { m = (a + b) / 2; if (3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m < p) a = m; else b = m; }
      m = (a + b) / 2;
      return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m;
    };
  };
  var borne = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var part = function (t, a, b) { return borne((t - a) / (b - a)); };
  var doux = function (v) { return v * v * (3 - 2 * v); };
  var entre = function (a, b, p) { return a + (b - a) * p; };
  // ARRIVE : ce qui entre à l'écran part vite et se pose longuement (la
  // feuille). SORT : ce qui s'en va prend son élan d'abord.
  var VA_ET_VIENT = courbe(.5, 0, .2, 1), ARRIVE = courbe(.2, .8, .2, 1), SORT = courbe(.3, 0, .1, 1);
  // Ce qu'on lance en l'air ralentit jusqu'en haut, et ce qui tombe accélère
  // jusqu'au contact : il n'y a ni pause en haut ni freinage en bas.
  var lance = function (p) { return 1 - (1 - p) * (1 - p); }, tombe = function (p) { return Math.pow(p, 2.4); };
  var IMAGE = 1 / 60;

  // ── La scène : un écran de 390 × 664. La caméra porte la page du client ;
  // le devis, la signature qui voyage et la feuille sont posés sur l'écran
  // lui-même.
  var L = 390, H = 664;
  // Le devis : la première page du PDF (1654 × 2339), vue de près. On en
  // montre 656 pixels de large, entre la colonne des quantités et la marge,
  // des quatre lignes du tableau jusque sous l'encadré « Bon pour accord » :
  // aucun mot, aucun chiffre n'est coupé. Tout ce qui s'y pose se compte
  // dans les pixels de cette image.
  var VUE = { x: 933, y: 815, l: 656 }, ZOOM = L / VUE.l;
  var ENCADRE = { x: 1065, y: 1534, l: 502, h: 140 };
  var plateau = creer("div", { id: "plateau" }), camera = creer("div", { id: "camera" }, plateau);
  creer("style", { texte:
    "html,body{margin:0;overflow:hidden;background:#f5f3ee}" +
    "#plateau{position:relative;width:" + L + "px;height:" + H + "px;overflow:hidden;background:#f5f3ee}" +
    "#camera{position:absolute;left:0;top:0;width:" + L + "px;height:" + H + "px;transform-origin:0 0}" +
    "#page,#accepte{position:absolute;left:0;top:0;width:" + L + "px;min-height:" + H + "px}" +
    "#voile{position:absolute}" +
    "#delai{position:relative;overflow:hidden}#delai>*{position:absolute;left:0;right:0;top:0}" +
    // L'appui d'un bouton plein, tel que l'appli le fait : on pose ici ce que
    // son :active poserait, à l'instant voulu.
    "#plateau .atlas-plein{transition:none}#plateau .atlas-plein::after{transition:none;opacity:var(--appui,0)}" +
    "#devis{position:absolute;left:0;top:0;width:" + L + "px;height:" + H + "px;overflow:hidden;background:#faf9f5}" +
    "#papier{position:absolute;left:0;top:0;width:1654px;height:2339px;transform-origin:0 0;transform:translate(" + (-VUE.x * ZOOM).toFixed(3) + "px," + (-VUE.y * ZOOM).toFixed(3) + "px) scale(" + ZOOM.toFixed(6) + ")}" +
    "#papier img{position:absolute;left:0;top:0;width:1654px;height:2339px;display:block}" +
    // La mention du PDF signé, dans le caractère du PDF : « Bon pour accord,
    // signature du client » y fait 346 pixels de large, soit un corps de
    // 21,61 dans ce caractère. Elle se centre sous l'encadré, une ligne plus
    // bas (ligne de base de « Bon pour accord » à 1711,5 ; l'interligne du
    // PDF signé de la planche fait 34 de ces pixels). La ligne de base d'un
    // texte en Liberation Sans, interligne 1, est à 0,8465 de son corps.
    "#mention{position:absolute;margin:0;left:" + (ENCADRE.x + ENCADRE.l / 2) + "px;top:" + (1745.5 - .8465 * 21.61).toFixed(2) + "px;font:21.61px/1 'Liberation Sans',Arimo,Helvetica,Arial,sans-serif;color:#7a7770;white-space:nowrap;transform:translateX(-50%)}" +
    "#griffe{position:absolute;left:0;top:0;width:300px;height:120px;transform-origin:0 0;overflow:visible}"
  }, document.head);

  var page = etat("lien").querySelector("main"); page.id = "page";
  var accepte = etat("accepte").querySelector("main"); accepte.id = "accepte";
  var voile = etat("trace").querySelector(".atlas-feuille").parentElement; voile.id = "voile";
  var feuille = voile.querySelector(".atlas-feuille");
  // Le droit de rétractation, tel qu'il se lit avant qu'une date soit choisie,
  // et l'invite de la feuille vide : la planche les porte dans son état
  // « feuille ».
  var droit = etat("feuille").querySelector("form > p");
  var invite = etat("feuille").querySelector('.atlas-feuille [data-va="trace"] span:last-child');
  [page, accepte].forEach(function (e) { camera.appendChild(e); });
  var devis = creer("div", { id: "devis" }, plateau), papier = creer("div", { id: "papier" }, devis);
  creer("img", { src: "../vente/images/nov-devis.jpg", alt: "" }, papier);
  var mention = creer("p", { id: "mention", texte: "Signé en ligne par Mr. Lemaire, le 06/11/2026." }, papier);
  document.querySelectorAll("[data-planche], .planche-tete, .planche-dit").forEach(function (e) { e.remove(); });
  document.body.appendChild(plateau);

  // ── Le chantier du site : Mr. Lemaire ────────────────────────────────────
  var REMPLACE = [
    ["Perret Paysage", "Les Jardins de Valmorin EI"], ["Mme Lefèvre", "Mr. Lemaire"],
    ["8 allée des Charmes, 78000 Versailles", "12 allée des Charmilles, Valmorin"],
    ["792,00\u00a0€", "862,20\u00a0€"], ["660,00\u00a0€", "718,50\u00a0€"], ["132,00\u00a0€", "143,70\u00a0€"],
    ["20 novembre", "6 novembre"], ["Signé le 18 novembre 2026.", "Signé le 6 novembre 2026."], ["PP", "LJ"]
  ];
  var faits = {};
  [page, accepte].forEach(function (racine) {
    var marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT), n;
    while ((n = marcheur.nextNode())) REMPLACE.forEach(function (r) {
      var avant = n.nodeValue.replace(/ (?=€)/g, "\u00a0");
      if (avant.indexOf(r[0]) < 0) return;
      // « PP » n'est remplacé que s'il est seul : c'est le monogramme.
      if (r[0] === "PP" && avant.trim() !== "PP") return;
      n.nodeValue = avant.split(r[0]).join(r[1]); faits[r[0]] = (faits[r[0]] || 0) + 1;
    });
    // Le numéro du devis est coupé en trois morceaux : le dernier seul change.
    var numero = racine.querySelector("h1 .inline-flex span:last-child");
    if (numero && numero.textContent === "01") { numero.textContent = "02"; faits.numero = (faits.numero || 0) + 1; }
  });
  // Ce que le tournage vérifie avant de filmer : un mot de la planche qui
  // n'a pas été trouvé, et la mention composée dans un autre caractère que
  // celui du PDF (sa largeur le dit).
  var toise = creer("span", { style: "position:absolute;visibility:hidden;white-space:nowrap;font:100px/1 'Liberation Sans',Arimo,Helvetica,Arial,sans-serif", texte: "Bon pour accord, signature du client" }, plateau);
  window.CALAGE = { manquent: REMPLACE.map(function (r) { return r[0]; }).concat("numero").filter(function (k) { return !faits[k]; }), largeurDuCaractere: toise.getBoundingClientRect().width };
  toise.remove();

  // ── La page avant tout choix ─────────────────────────────────────────────
  var caseDate = page.querySelector('[role="radiogroup"] label'), rond = caseDate.querySelector("input");
  var caseDelai = page.querySelector('input[name="demarrageAnticipe"]').closest("label"), coche = caseDelai.querySelector("input");
  var boutonPage = page.querySelector('button[value="accepte"]');
  caseDate.style.transition = "none"; rond.style.transition = "none";
  // Le droit et la case ne s'empilent jamais dans l'appli : l'un remplace
  // l'autre. Ici ils partagent une boîte, dont la hauteur passe de l'un à
  // l'autre.
  var delai = creer("div", { id: "delai" }); caseDelai.parentElement.insertBefore(delai, caseDelai);
  delai.appendChild(droit); delai.appendChild(caseDelai);
  var hauteur = function (e) { var s = getComputedStyle(e); return e.offsetHeight + parseFloat(s.marginTop); };
  var H_DROIT = hauteur(droit), H_CASE = hauteur(caseDelai);

  // ── La feuille « Votre signature » ───────────────────────────────────────
  plateau.appendChild(voile);
  var toile = feuille.querySelector("[data-va=trace]"), effacer = feuille.querySelector("button[data-va=feuille]");
  var boutonFeuille = feuille.querySelector(".atlas-plein");
  toile.appendChild(invite);
  var H_FEUILLE = feuille.offsetHeight;

  // La signature : un paraphe « Lemaire », tracé pour ce film. Un trait par
  // levée de plume, dans le repère de la toile de la planche (300 × 120),
  // puis penché comme une main qui va vite.
  var TRAITS = [
    "M74 46C69 33 54 32 55 49C56 68 66 88 60 104C56 115 41 114 40 103C40 94 52 93 65 100C78 107 91 106 101 98",
    "M101 98C109 92 113 82 107 80C100 78 97 92 103 99C109 105 119 100 123 92C125 86 129 84 131 90L132 101C133 90 139 84 143 90L144 101C145 90 151 84 155 90C157 96 157 102 161 101C171 100 175 86 167 84C159 82 155 96 163 100C169 103 175 94 177 88L178 98C179 103 184 101 187 96L191 86L192 98C193 103 198 101 201 96L205 86C209 82 213 90 219 86L220 98C222 104 233 100 237 92C239 86 233 82 229 88C225 96 233 104 245 101C263 96 281 80 301 62",
    "M191 75L192.500 76.500",
    "M38 126C110 115 212 113 308 121"
  ];
  var PENCHE = "translate(19.400 0) skewX(-11)";
  var poserTraits = function (parent) {
    var g = svg("g", { transform: PENCHE, fill: "none", stroke: "#1c1c1a", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, parent);
    return TRAITS.map(function (d) { return svg("path", { d: d }, g); });
  };
  var dessin = toile.querySelector("svg");
  dessin.querySelector("path").remove();
  var plume = poserTraits(dessin).map(function (p) { var l = p.getTotalLength(); p.setAttribute("stroke-dasharray", l + " " + l); return { trait: p, longueur: l }; });
  // La plume, geste par geste : quel trait, jusqu'à quelle part de sa
  // longueur, en combien d'images, à quelle allure ; entre deux, la plume
  // levée. Une main ne va pas d'un pas égal, et surtout elle ne freine pas
  // là où elle s'élance : le trait de sortie et le soulignement accélèrent
  // jusqu'au bout et s'arrêtent net (relecture du 18 novembre : ils
  // traînaient, c'était le passage le plus lent du paraphe).
  var main = function (q) { return VA_ET_VIENT(q) * .5 + q * .5; };        // part, prend son élan, freine
  var pente = function (f) { return (f(1) - f(.999)) / .001; };
  // Les lettres vont comme le début d'un trait entier, coupé avant qu'il
  // freine : le trait de sortie les prolonge, il repart à la vitesse où
  // elles finissent et accélère.
  var SORTIE = TRAITS[1].lastIndexOf("C"), partDesLettres = (function () { var e = svg("path", { d: TRAITS[1].slice(0, SORTIE) }, dessin), l = e.getTotalLength(); e.remove(); return l / plume[1].longueur; })();
  var coupe = (function () { var a = 0, b = 1, m; for (var i = 0; i < 40; i++) { m = (a + b) / 2; if (main(m) < partDesLettres) a = m; else b = m; } return (a + b) / 2; })();
  var lettres = function (q) { return main(q * coupe) / main(coupe); };
  var IMAGES_DES_LETTRES = 32.1 * coupe, IMAGES_DE_LA_SORTIE = 4.5;
  var entree = pente(lettres) * (partDesLettres / IMAGES_DES_LETTRES) * IMAGES_DE_LA_SORTIE / (1 - partDesLettres);
  var GESTES = [
    { trait: 0, jusqua: 1, images: 13, allure: main },                                        // le L
    { images: 4.2 },
    { trait: 1, jusqua: partDesLettres, images: IMAGES_DES_LETTRES, allure: lettres },        // « emaire »
    { trait: 1, jusqua: 1, images: IMAGES_DE_LA_SORTIE, allure: function (w) { return entree * w + (1 - entree) * w * w; } },
    { images: 6.5 },
    { trait: 2, jusqua: 1, images: 2, allure: function (w) { return w; } },                   // le point du i
    { images: 6.5 },
    { trait: 3, jusqua: 1, images: 10, allure: function (w) { return Math.pow(w, 1.3); } }    // le soulignement
  ];
  var DUREE_DU_TRACE = GESTES.reduce(function (s, g) { return s + g.images; }, 0) * IMAGE;

  // ── L'accord donné : sa signature dans son cadre ─────────────────────────
  var image = accepte.querySelector('[data-atlas="signature-donnee"] img');
  var signee = svg("svg", { viewBox: "20 20 300 120", "aria-hidden": "true" }); signee.setAttribute("style", "display:block;height:70px;width:auto;margin:0 auto");
  poserTraits(signee); image.parentElement.replaceChild(signee, image);
  // Celle qui voyage : la même, posée sur l'écran.
  var griffe = svg("svg", { id: "griffe", viewBox: "20 20 300 120" }, plateau); poserTraits(griffe);

  // ── Le déroulé, en secondes ──────────────────────────────────────────────
  // Chaque instant se compte depuis celui qui le précède : raccourcir un
  // geste avance tous les suivants sans changer leurs écarts.
  var T = { approche: .2, date: .74, coche: 1.36, accepte: 1.74, feuille: 1.96, signe: 2.66 };
  T.signeFin = T.signe + DUREE_DU_TRACE; T.valide = T.signeFin + .3; T.envoi = T.valide + .1; T.range = T.envoi + .36;
  // La fin. La signature se décolle seule, page du client encore pleine
  // (8 images) ; le devis paraît (16 images) pendant qu'elle finit de
  // monter ; en haut elle retombe aussitôt, en 12 images ; la mention suit
  // le contact de 7 images.
  T.leve = T.range + 1.13; T.devis = T.leve + 6 * IMAGE; T.tombe = T.devis + 16 * IMAGE; T.pose = T.tombe + 12 * IMAGE; T.mention = T.pose + 7 * IMAGE;
  var DUREE = Math.ceil((T.mention + 12 * IMAGE + .65) * 60) / 60;

  // Ce que la caméra cadre : [x, y, largeur] de la page. De près, elle laisse
  // l'en-tête et garde tout le reste, cartes comprises : la page tient déjà
  // toute la largeur, s'approcher davantage couperait le droit de
  // rétractation et les boutons.
  var PLEIN = [0, 0, L], PRES = [15.3, 84, 359.4];
  var CADRES = [
    [0, PLEIN], [T.approche, PLEIN], [T.approche + .44, PRES, VA_ET_VIENT], [T.feuille, PRES], [T.feuille + .42, PLEIN, VA_ET_VIENT], [DUREE, PLEIN]
  ];
  // Une caméra va d'un cadrage à l'autre en ligne droite à l'écran : on mêle
  // l'échelle et le décalage, pas la largeur cadrée.
  var reglage = function (c) { var s = L / c[2]; return [s, -c[0] * s, -c[1] * s]; };
  var cadrer = function (t) {
    var i = 0; while (i < CADRES.length - 2 && t >= CADRES[i + 1][0]) i++;
    var a = CADRES[i], b = CADRES[i + 1], p = (b[2] || doux)(part(t, a[0], b[0])), A = reglage(a[1]), B = reglage(b[1]);
    camera.style.transform = "translate(" + entre(A[1], B[1], p).toFixed(3) + "px," + entre(A[2], B[2], p).toFixed(3) + "px) scale(" + entre(A[0], B[0], p).toFixed(5) + ")";
  };
  // Un bouton reste enfoncé tant que le doigt est dessus, et ne se relâche
  // qu'au moment où l'appli réagit. L'aller en 70 ms, le retour en 190 : les
  // durées de l'appli. Sans rien pour montrer le doigt, c'est la tenue qui
  // fait voir l'appui : à 100 ms, la relecture ne le voyait pas.
  var appuyer = function (bouton, t, pose, leve) {
    var p = t < leve ? doux(part(t, pose, pose + .07)) : 1 - doux(part(t, leve, leve + .19));
    bouton.style.transform = "scale(" + (1 - .025 * p).toFixed(4) + ")"; bouton.style.setProperty("--appui", (.14 * p).toFixed(3));
  };

  // La signature qui voyage, à l'écran : elle part de son cadre sur la page
  // du client (caméra au repos) et finit dans l'encadré du devis. Dans
  // l'encadré, elle prend sa hauteur, comme sur le PDF signé de la planche.
  var rectangle = function (e) { var r = e.getBoundingClientRect(), o = plateau.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, l: r.width }; };
  var DEPART = rectangle(signee), largeurPosee = ENCADRE.h * 300 / 120;
  var ARRIVEE = { x: (ENCADRE.x + (ENCADRE.l - largeurPosee) / 2 - VUE.x) * ZOOM, y: (ENCADRE.y - VUE.y) * ZOOM, l: largeurPosee * ZOOM };
  // En l'air, juste avant de tomber : à l'aplomb de l'encadré, un sixième
  // plus grande que posée, et assez haut pour que son encre (elle descend
  // jusqu'à 89 % de sa hauteur) reste au-dessus du bord de l'encadré. Plus
  // bas, elle y était déjà à moitié et la chute se lisait comme un
  // ajustement (relecture du 18 novembre).
  var EN_L_AIR = { l: ARRIVEE.l * 1.16 };
  EN_L_AIR.x = ARRIVEE.x + (ARRIVEE.l - EN_L_AIR.l) / 2; EN_L_AIR.y = ARRIVEE.y - .89 * EN_L_AIR.l * 120 / 300;

  window.DUREE = DUREE;
  window.INSTANTS = T;
  window.poser = function (t) {
    cadrer(t);
    // 1. La date : la case prend son liseré, le rond se remplit d'or.
    var d = doux(part(t, T.date, T.date + .2));
    caseDate.style.backgroundColor = "color-mix(in srgb, #faf9f5 " + (d * 100).toFixed(1) + "%, #f5f3ee)";
    caseDate.style.boxShadow = "inset 0 0 0 " + entre(1, 2, d).toFixed(2) + "px color-mix(in srgb, #2f3b2f " + (d * 100).toFixed(1) + "%, rgba(28,28,26,.12))";
    rond.style.boxShadow = "inset 0 0 0 " + entre(1.5, 7, d).toFixed(2) + "px color-mix(in srgb, #b98b47 " + (d * 100).toFixed(1) + "%, rgba(28,28,26,.28))";
    // Choisie, elle tombe dans le délai de rétractation : la case des
    // quatorze jours prend la place de la phrase.
    var g = SORT(part(t, T.date + .08, T.date + .38));
    delai.style.height = entre(H_DROIT, H_CASE, g).toFixed(2) + "px";
    droit.style.opacity = (1 - doux(part(g, 0, .45))).toFixed(3); caseDelai.style.opacity = doux(part(g, .4, 1)).toFixed(3);
    coche.checked = t >= T.coche;
    // 2. « J'accepte ce devis » : la feuille monte, la page recule.
    appuyer(boutonPage, t, T.accepte, T.feuille);
    var monte = t < T.range ? ARRIVE(part(t, T.feuille, T.feuille + .4)) : 1 - SORT(part(t, T.range, T.range + .34));
    voile.style.display = monte > 0 ? "" : "none";
    voile.style.backgroundColor = "rgba(0,0,0," + (.35 * monte).toFixed(3) + ")";
    feuille.style.transform = "translateY(" + ((1 - monte) * H_FEUILLE).toFixed(2) + "px)";
    // 3. Il signe. L'invite s'efface au premier trait, « Effacer » arrive.
    var trace = plume.map(function () { return null; }), debut = T.signe;
    GESTES.forEach(function (g) {
      if (g.allure && t > debut) {
        var depuis = trace[g.trait] || 0;
        trace[g.trait] = depuis + (g.jusqua - depuis) * g.allure(part(t, debut, debut + g.images * IMAGE));
      }
      debut += g.images * IMAGE;
    });
    plume.forEach(function (p, i) {
      p.trait.style.visibility = trace[i] === null ? "hidden" : "visible";
      p.trait.setAttribute("stroke-dashoffset", (p.longueur * (1 - (trace[i] || 0))).toFixed(2));
    });
    var commence = doux(part(t, T.signe, T.signe + .16));
    invite.style.opacity = (1 - commence).toFixed(3); effacer.style.opacity = commence.toFixed(3);
    // 4. Il accepte : le bouton dit « Envoi… », puis la feuille se range. La
    // page a déjà changé derrière elle : en descendant, c'est l'accord
    // qu'elle découvre.
    appuyer(boutonFeuille, t, T.valide, T.envoi);
    boutonFeuille.firstChild.nodeValue = t >= T.envoi ? "Envoi…" : "J'accepte ce devis";
    boutonFeuille.style.opacity = t >= T.envoi ? ".5" : "1";
    var note = doux(part(t, T.range - .06, T.range + .08));
    accepte.style.opacity = note.toFixed(3); accepte.style.visibility = note > 0 ? "visible" : "hidden";
    page.style.visibility = note < 1 ? "visible" : "hidden";
    // 5. La signature se décolle de son cadre, seule d'abord, pour qu'on la
    // voie quitter la page du client ; le devis paraît dessous dans un fondu
    // court pendant qu'elle finit de monter. Elle monte comme ce qu'on lance
    // (elle ralentit jusqu'en haut), s'y trouve au-dessus de l'encadré « Bon
    // pour accord », plus grande que posée, sur du papier blanc ; et elle y
    // retombe aussitôt, tout droit, en accélérant jusqu'au contact : c'est
    // l'arrêt net qui fait le coup de tampon. Son ombre s'ouvre en montant et
    // se referme au contact. La mention du PDF signé suit.
    var parait = doux(part(t, T.devis, T.tombe));
    devis.style.visibility = parait > 0 ? "visible" : "hidden";
    devis.style.opacity = parait.toFixed(3);
    var envol = lance(part(t, T.leve, T.tombe)), chute = tombe(part(t, T.tombe, T.pose)), enLAir = envol * (1 - chute);
    var gl = entre(entre(DEPART.l, EN_L_AIR.l, envol), ARRIVEE.l, chute), centre = entre(DEPART.x + DEPART.l / 2, EN_L_AIR.x + EN_L_AIR.l / 2, envol);
    var haut = entre(entre(DEPART.y, EN_L_AIR.y, envol), ARRIVEE.y, chute), echelle = gl / 300;
    griffe.style.transform = "translate(" + (centre - gl / 2).toFixed(3) + "px," + haut.toFixed(3) + "px) scale(" + echelle.toFixed(5) + ")";
    griffe.style.filter = enLAir > .004 ? "drop-shadow(0 " + (9 * enLAir / echelle).toFixed(2) + "px " + (6 * enLAir / echelle).toFixed(2) + "px rgba(28,28,26," + (.3 * enLAir).toFixed(3) + "))" : "none";
    griffe.style.visibility = t >= T.leve ? "visible" : "hidden";
    signee.style.visibility = t >= T.leve ? "hidden" : "visible";
    mention.style.opacity = doux(part(t, T.mention, T.mention + 12 * IMAGE)).toFixed(3);
  };
  window.poser(Number(new URLSearchParams(location.search).get("t")) || 0);
})();
