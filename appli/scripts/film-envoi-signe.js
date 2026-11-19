/* =======================================================================
   LE MONTAGE DU FILM « LE CLIENT SIGNE SON DEVIS » (site de vente, planche
   vente/cause-2.html, chapitre Envoyez).

   Ce script ne se charge pas seul : film-envoi-signe.cjs l'injecte dans
   rushes/envoi-signe/etats.html, puis photographie le résultat image par
   image.

   Sa demande du 18 novembre 2026 : « quand il clique sur accepter le devis,
   il y a le petit truc pour signer électroniquement qui apparaît. Il signe
   et ensuite sa signature vient s'apposer sur le devis. [...] Là tu dessines
   une signature manuellement. Tchac. Ensuite on voit la signature qui se
   transfère et qui vient s'apposer sur le devis. »

   CE QUI VIENT DE L'APPLI (tournage du 19 novembre 2026, sur une base
   d'essai locale : tournage/tourner-signature.mjs).
   Le chantier de Mr. Lemaire a été saisi dans l'appli par ses écrans, le
   devis envoyé, et le lien ouvert comme le client l'ouvre. À chaque étape du
   vrai geste (la page, la date choisie, la feuille « Votre signature », le
   paraphe tracé, l'accord donné) l'écran a été FIGÉ tel que l'appli le
   peint : son DOM, ses feuilles de style, ses polices. Ce sont ces écrans
   qu'on anime ici, et le tournage les a comparés à leurs photos : aucun
   pixel d'écart sur la page, la date et l'accord.
   Le paraphe a été tracé à la souris sur la vraie toile, point par point.
   Une toile ne se fige pas : on la redessine ici avec ces mêmes points et
   les gestes de l'appli (Signature.tsx : trait de 2,2, bouts ronds), et
   film-envoi-signe.cjs refuse de filmer si le résultat ne se superpose pas
   à la photo de la feuille signée.
   La signature qui voyage est le PNG que l'appli a enregistré, celui qu'elle
   montre sous « Votre signature ». Le devis est le PDF que le client
   télécharge, avant puis après son accord : la dernière image du film est le
   PDF signé, tel quel, avec sa signature dans l'encadré et la mention
   « Signé en ligne par ».

   CE QUI EST DU MONTAGE, ET PAS DE L'APPLI. La feuille monte et redescend
   (dans l'appli elle paraît d'un coup), la case des quatorze jours prend sa
   place en glissant (elle paraît d'un coup aussi), et le passage de la page
   du client à son devis (le devis qui paraît sous la signature, la signature
   qui se soulève avec son ombre et retombe dans l'encadré) est une image :
   dans l'appli, le client touche « Télécharger mon devis » et la trouve
   dedans. La caméra aussi, qui s'approche à peine pour la date et recule
   quand la feuille monte : elle ne coupe aucun mot.
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

  var RUSHES = window.RUSHES, TRACE = RUSHES.trace, DEVIS = RUSHES.mesures.devis, PNG = RUSHES.mesures.png;
  var etat = function (nom) { return document.querySelector('[data-planche="' + nom + '"]'); };
  var creer = function (balise, attributs, parent) {
    var e = document.createElement(balise);
    for (var k in attributs) { if (k === "texte") e.textContent = attributs[k]; else e.setAttribute(k, attributs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  };

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

  // ── La scène : un écran de 390 × 664, celui du tournage. La caméra porte
  // la page du client ; le devis, la signature qui voyage et la feuille sont
  // posés sur l'écran lui-même.
  var L = 390, H = 664;
  // Le devis : la première page du PDF (1654 × 2339), vue de près. On en
  // montre 656 pixels de large, entre la colonne des quantités et la marge,
  // des quatre lignes du tableau jusque sous l'encadré « Bon pour accord » :
  // aucun mot, aucun chiffre n'est coupé. Tout ce qui s'y pose se compte
  // dans les pixels de cette image.
  var VUE = { x: 933, y: 843, l: 656 }, ZOOM = L / VUE.l;
  var plateau = creer("div", { id: "plateau" }), camera = creer("div", { id: "camera" }, plateau);
  creer("style", { texte:
    "html,body{margin:0;overflow:hidden;background:#f5f3ee}" +
    "#plateau{position:relative;width:" + L + "px;height:" + H + "px;overflow:hidden;background:#f5f3ee}" +
    "#camera{position:absolute;left:0;top:0;width:" + L + "px;height:" + H + "px;transform-origin:0 0}" +
    "#page,#accepte{position:absolute;left:0;top:0;width:" + L + "px;min-height:" + H + "px}" +
    "#voile{position:absolute}" +
    "#choisie{position:absolute;left:0;top:0;right:0;bottom:0;margin:0;transition:none}" +
    "#delai{position:relative;overflow:hidden}#delai>*{position:absolute;left:0;right:0;top:0}" +
    // L'appui d'un bouton plein, tel que l'appli le fait : on pose ici ce que
    // son :active poserait, à l'instant voulu.
    "#plateau .atlas-plein{transition:none}#plateau .atlas-plein::after{transition:none;opacity:var(--appui,0)}" +
    "#devis{position:absolute;left:0;top:0;width:" + L + "px;height:" + H + "px;overflow:hidden;background:#faf9f5}" +
    "#papier{position:absolute;left:0;top:0;width:" + DEVIS.l + "px;height:" + DEVIS.h + "px;transform-origin:0 0;transform:translate(" + (-VUE.x * ZOOM).toFixed(3) + "px," + (-VUE.y * ZOOM).toFixed(3) + "px) scale(" + ZOOM.toFixed(6) + ")}" +
    "#papier img{position:absolute;left:0;top:0;width:" + DEVIS.l + "px;height:" + DEVIS.h + "px;display:block}" +
    // Ce que le devis ne porte pas encore avant l'accord : deux morceaux du
    // PDF d'avant, posés sur le PDF signé. Le PDF signé a une ligne de plus en
    // tête (la durée du chantier), tout y est plus bas de DEVIS.decalage.
    ".avant{position:absolute;background:url(devis-avant.png) no-repeat;background-size:" + DEVIS.l + "px " + DEVIS.h + "px}" +
    "#griffe{position:absolute;left:0;top:0;width:" + PNG.l + "px;height:" + PNG.h + "px;max-width:none;transform-origin:0 0}"
  }, document.head);

  var page = etat("lien").querySelector("main"); page.id = "page";
  var accepte = etat("accepte").querySelector("main"); accepte.id = "accepte";
  var voile = etat("feuille").querySelector(".atlas-feuille").parentElement; voile.id = "voile";
  var feuille = voile.querySelector(".atlas-feuille");
  // Ce que la page devient quand la date est choisie : sa case, et la
  // demande des quatorze jours qui remplace la phrase du droit de
  // rétractation.
  var caseChoisie = etat("choisi").querySelector('[role="radiogroup"] label'); caseChoisie.id = "choisie";
  var caseDelai = etat("choisi").querySelector('input[name="demarrageAnticipe"]').closest("label"), coche = caseDelai.querySelector("input");
  [page, accepte].forEach(function (e) { camera.appendChild(e); });
  var devis = creer("div", { id: "devis" }, plateau), papier = creer("div", { id: "papier" }, devis);
  creer("img", { src: "devis-signe.png", alt: "" }, papier);
  var avant = function (zone, marge) {
    var x = zone.x - marge, y = zone.y - marge;
    return creer("div", { "class": "avant", style: "left:" + x + "px;top:" + y + "px;width:" + (zone.l + 2 * marge) + "px;height:" + (zone.h + 2 * marge) + "px;background-position:" + (-x) + "px " + (-(y - DEVIS.decalage)) + "px" }, papier);
  };
  var sansSignature = avant(DEVIS.signature, 8), sansMention = avant(DEVIS.mention, 6);
  plateau.appendChild(voile);
  document.body.appendChild(plateau);

  // ── La page avant tout choix ─────────────────────────────────────────────
  // La case de la date : celle d'avant dessous, celle d'après dessus. Dans
  // l'appli, le liseré et le rond passent de l'une à l'autre en 200 ms.
  var groupe = page.querySelector('[role="radiogroup"]');
  groupe.style.position = "relative"; groupe.appendChild(caseChoisie);
  var boutonPage = page.querySelector("form .atlas-plein");
  // Le droit et la case ne s'empilent jamais dans l'appli : l'un remplace
  // l'autre. Ici ils partagent une boîte, dont la hauteur passe de l'un à
  // l'autre.
  var droit = page.querySelector("form > p");
  var delai = creer("div", { id: "delai" }); droit.parentElement.insertBefore(delai, droit);
  delai.appendChild(droit); delai.appendChild(caseDelai);
  var hauteur = function (e) { var s = getComputedStyle(e); return e.offsetHeight + parseFloat(s.marginTop); };
  var H_DROIT = hauteur(droit), H_CASE = hauteur(caseDelai);

  // ── La feuille « Votre signature » ───────────────────────────────────────
  var toile = feuille.querySelector("canvas"), invite = feuille.querySelector('[data-atlas="signature"] > span:last-child');
  var boutonFeuille = feuille.querySelector(".atlas-plein");
  var H_FEUILLE = feuille.offsetHeight;

  // Le paraphe : les points que la vraie toile a reçus, un trait par levée
  // de plume. On les relie comme l'appli (Signature.tsx).
  var encre = toile.getContext("2d"), GRAIN = toile.width / TRACE.toile.l;
  var TRAITS = TRACE.traits.map(function (points) {
    var cumul = [0];
    for (var i = 1; i < points.length; i++) cumul.push(cumul[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    return { points: points, cumul: cumul, longueur: cumul[cumul.length - 1] };
  });
  var tracer = function (parts) {
    encre.setTransform(GRAIN, 0, 0, GRAIN, 0, 0);
    encre.clearRect(0, 0, TRACE.toile.l, TRACE.toile.h);
    encre.lineWidth = TRACE.epaisseur; encre.lineCap = "round"; encre.lineJoin = "round";
    encre.strokeStyle = getComputedStyle(document.body).getPropertyValue("--atlas-ink").trim() || "#1c1c1a";
    TRAITS.forEach(function (trait, i) {
      if (parts[i] === null) return;
      var jusqua = trait.longueur * parts[i], p = trait.points, c = trait.cumul;
      encre.beginPath(); encre.moveTo(p[0][0], p[0][1]);
      for (var k = 1; k < p.length && c[k] <= jusqua; k++) encre.lineTo(p[k][0], p[k][1]);
      // Le dernier pas, entamé : la plume est entre deux points.
      if (k < p.length && jusqua > c[k - 1]) { var f = (jusqua - c[k - 1]) / (c[k] - c[k - 1]); encre.lineTo(entre(p[k - 1][0], p[k][0], f), entre(p[k - 1][1], p[k][1], f)); }
      // Un point posé sans bouger : l'appli le trace d'un trait sans longueur.
      else if (k === 1) encre.lineTo(p[0][0], p[0][1]);
      encre.stroke();
    });
  };
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
  var partDesLettres = TRACE.sortieDuTrait2;
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

  // ── L'accord donné : sa signature dans son cadre, telle que l'appli l'a
  // enregistrée. Celle qui voyage est la même image, posée sur l'écran.
  var signee = accepte.querySelector('[data-atlas="signature-donnee"] img');
  var griffe = creer("img", { id: "griffe", src: signee.getAttribute("src"), alt: "" }, plateau);

  // ── Le déroulé, en secondes ──────────────────────────────────────────────
  // Chaque instant se compte depuis celui qui le précède : raccourcir un
  // geste avance tous les suivants sans changer leurs écarts.
  var T = { approche: .2, date: .74, coche: 1.36, accepte: 1.74, feuille: 1.96, signe: 2.66 };
  T.signeFin = T.signe + DUREE_DU_TRACE; T.valide = T.signeFin + .3; T.envoi = T.valide + .1; T.range = T.envoi + .36;
  // La fin. La signature se décolle seule, page du client encore pleine
  // (6 images) ; le devis paraît (16 images) pendant qu'elle finit de
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
    // Au repos, aucune transformation : l'écran se peint alors exactement
    // comme l'appli le peint (c'est ce que le calage compare).
    var s = entre(A[0], B[0], p), x = entre(A[1], B[1], p), y = entre(A[2], B[2], p);
    camera.style.transform = s === 1 && x === 0 && y === 0 ? "none" : "translate(" + x.toFixed(3) + "px," + y.toFixed(3) + "px) scale(" + s.toFixed(5) + ")";
  };
  // Un bouton reste enfoncé tant que le doigt est dessus, et ne se relâche
  // qu'au moment où l'appli réagit. L'aller en 70 ms, le retour en 190 : les
  // durées de l'appli. Sans rien pour montrer le doigt, c'est la tenue qui
  // fait voir l'appui : à 100 ms, la relecture ne le voyait pas.
  var appuyer = function (bouton, t, pose, leve) {
    var p = t < leve ? doux(part(t, pose, pose + .07)) : 1 - doux(part(t, leve, leve + .19));
    bouton.style.transform = p > 0 ? "scale(" + (1 - .025 * p).toFixed(4) + ")" : "none"; bouton.style.setProperty("--appui", (.14 * p).toFixed(3));
  };
  var envoyer = function (bouton, parti) {
    bouton.disabled = parti; bouton.firstChild.nodeValue = parti ? "Envoi…" : "J'accepte ce devis";
  };

  // La signature qui voyage, à l'écran : elle part de son cadre sur la page
  // du client (caméra au repos) et finit là où le PDF signé la porte. Son
  // encre, dans le PNG de l'appli et dans le PDF, a été mesurée au tournage :
  // l'une donne la place de l'autre.
  var rectangle = function (e) { var r = e.getBoundingClientRect(), o = plateau.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, l: r.width }; };
  var DEPART = rectangle(signee), GRANDEUR = DEVIS.signature.l / PNG.encre.l;
  var ARRIVEE = { x: (DEVIS.signature.x - PNG.encre.x * GRANDEUR - VUE.x) * ZOOM, y: (DEVIS.signature.y - PNG.encre.y * GRANDEUR - VUE.y) * ZOOM, l: PNG.l * GRANDEUR * ZOOM };
  // En l'air, juste avant de tomber : à l'aplomb de sa place, un sixième
  // plus grande que posée, et assez haut pour que le bas de son encre reste
  // au-dessus du bord de l'encadré. Plus bas, elle y était déjà à moitié et
  // la chute se lisait comme un ajustement (relecture du 18 novembre).
  var EN_L_AIR = { l: ARRIVEE.l * 1.16 };
  EN_L_AIR.x = ARRIVEE.x + (ARRIVEE.l - EN_L_AIR.l) / 2;
  EN_L_AIR.y = (DEVIS.encadre.y - VUE.y) * ZOOM - (PNG.encre.y + PNG.encre.h) / PNG.h * EN_L_AIR.l * PNG.h / PNG.l;

  document.querySelectorAll("[data-planche]").forEach(function (e) { e.remove(); });

  window.DUREE = DUREE;
  window.INSTANTS = T;
  window.poser = function (t) {
    cadrer(t);
    // 1. La date : la case prend son liseré, le rond se remplit d'or.
    caseChoisie.style.opacity = doux(part(t, T.date, T.date + .2)).toFixed(3);
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
    feuille.style.transform = monte < 1 ? "translateY(" + ((1 - monte) * H_FEUILLE).toFixed(2) + "px)" : "none";
    // 3. Il signe. L'invite s'en va au premier point, comme dans l'appli.
    var parts = TRAITS.map(function () { return null; }), debut = T.signe;
    GESTES.forEach(function (geste) {
      if (geste.allure && t > debut) {
        var depuis = parts[geste.trait] || 0;
        parts[geste.trait] = depuis + (geste.jusqua - depuis) * geste.allure(part(t, debut, debut + geste.images * IMAGE));
      }
      debut += geste.images * IMAGE;
    });
    tracer(parts);
    invite.style.visibility = t > T.signe ? "hidden" : "visible";
    // 4. Il accepte : les boutons disent « Envoi… », puis la feuille se
    // range. La page a déjà changé derrière elle : en descendant, c'est
    // l'accord qu'elle découvre.
    appuyer(boutonFeuille, t, T.valide, T.envoi);
    envoyer(boutonFeuille, t >= T.envoi); envoyer(boutonPage, t >= T.envoi);
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
    // se referme au contact. Posée, elle laisse la place à celle du PDF
    // signé, qui est dessous au même endroit ; la mention suit.
    var parait = doux(part(t, T.devis, T.tombe));
    devis.style.visibility = parait > 0 ? "visible" : "hidden";
    devis.style.opacity = parait.toFixed(3);
    var envol = lance(part(t, T.leve, T.tombe)), chute = tombe(part(t, T.tombe, T.pose)), enLAir = envol * (1 - chute);
    var gl = entre(entre(DEPART.l, EN_L_AIR.l, envol), ARRIVEE.l, chute), centre = entre(entre(DEPART.x + DEPART.l / 2, EN_L_AIR.x + EN_L_AIR.l / 2, envol), ARRIVEE.x + ARRIVEE.l / 2, chute);
    var haut = entre(entre(DEPART.y, EN_L_AIR.y, envol), ARRIVEE.y, chute), echelle = gl / PNG.l;
    griffe.style.transform = "translate(" + (centre - gl / 2).toFixed(3) + "px," + haut.toFixed(3) + "px) scale(" + echelle.toFixed(5) + ")";
    griffe.style.filter = enLAir > .004 ? "drop-shadow(0 " + (9 * enLAir / echelle).toFixed(2) + "px " + (6 * enLAir / echelle).toFixed(2) + "px rgba(28,28,26," + (.3 * enLAir).toFixed(3) + "))" : "none";
    var posee = t >= T.pose + IMAGE;
    griffe.style.visibility = t >= T.leve && !posee ? "visible" : "hidden";
    signee.style.visibility = t >= T.leve ? "hidden" : "visible";
    sansSignature.style.visibility = posee ? "hidden" : "visible";
    sansMention.style.opacity = (1 - doux(part(t, T.mention, T.mention + 12 * IMAGE))).toFixed(3);
  };
  window.poser(Number(new URLSearchParams(location.search).get("t")) || 0);
})();
