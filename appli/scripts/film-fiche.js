/* =======================================================================
   LE MONTAGE DU FILM DE LA FICHE D'INTERVENTION (site de vente, planche
   vente/cause-2-visite.html, chapitre Planifiez) : du trajet au retour du soir.

   Ce script ne se charge pas seul : film-fiche.cjs l'injecte dans
   rushes/fiche/etats.html, puis photographie le résultat image par image.

   Ses demandes. Le 18 novembre 2026 : « Qu'on voit qu'en un clic on peut
   avoir l'adresse sur Maps », puis « fais une animation où on clique pour
   appeler le client et on voit que ça ouvre l'application téléphone ». Le
   19, devant les travaux cochés et le retour du soir rangés plus bas dans la
   page : « est-ce que les retours du soir, il ne faut pas les mettre sur la
   même cinématique que Waze, le téléphone, et ensuite on montre les travaux
   à cocher, et une fois coché, bam, que ça débarque sur le retour du soir.
   Ça fait peut-être une cinématique de moins. » Il a dit oui à la fusion, et
   oui pour filmer l'appli d'aujourd'hui sur une base d'essai.

   CE QUI VIENT DE L'APPLI (tournage du 19 novembre 2026, sur une base
   d'essai locale : tournage/tourner-fiche.mjs).
   Le chantier de Mr. Lemaire, accepté par son client, est au planning du
   vendredi 6 novembre. Sa fiche d'intervention a été ouverte, ses travaux
   dépliés, cochés un à un, la remarque tapée, le retour du jour envoyé, puis
   retrouvé dans Terminés, Retours d'intervention. À chaque étape l'écran a
   été FIGÉ tel que l'appli le peint (son DOM, ses feuilles de style). C'est
   cet écran qu'on anime : le pli qui s'ouvre, le chevron, le trait d'avance,
   le rond qui se remplit et la coche qui se trace sont les transitions de
   l'appli elle-même (TravauxAFaire.tsx), rejouées à l'instant voulu ; les
   comptes (« 1 sur 4 fait », « Tout est fait »), « Un instant… » et « Retour
   du jour envoyé » sont lus dans les écrans figés à ces étapes.
   film-fiche.cjs refuse de filmer si la fiche du film ne se superpose pas à
   ses photos prises dans l'appli.

   CE QUI EST DESSINÉ. La carte et l'écran d'appel : l'appli n'a ni carte ni
   téléphone. Maps ouvre Google Maps avec l'adresse déjà posée (src/lib/
   itineraire.ts : un itinéraire en voiture), « Appeler le client » ouvre le
   téléphone avec son numéro (un lien tel:). Ces applis ne se filment pas
   ici, et leurs écrans ne sont pas à nous : ce sont deux schémas, sans logo,
   qui disent seulement « on a quitté Cause, et l'adresse (ou le numéro) est
   arrivée ». L'écran d'appel est sombre, comme celui d'un téléphone : on ne
   le prend pas pour un écran de Cause. Le retour « Cause » en haut à gauche
   est celui qu'un iPhone affiche quand une appli en ouvre une autre.
   L'adresse et le numéro sont ceux du chantier Lemaire (12 allée des
   Charmilles, Valmorin, commune inventée ; 06 39 98 12 34, tranche que
   l'Arcep réserve à la fiction : voir l'en-tête de cause.html).

   CE QUI EST DU MONTAGE. Le cadre est la fiche, pas le téléphone entier : la
   barre du bas de l'appli n'y est pas. La fiche défile sous le cadre comme
   sous un pouce (du haut vers les travaux, puis vers la remarque). La
   remarque s'écrit lettre à lettre avec un curseur or, celui de l'appli.
   Rien n'est posé sur l'écran pour montrer le doigt (son refus) : ce qu'on
   touche s'assombrit un instant, comme un lien qu'on appuie. Entre la fiche
   et l'écran du patron, un fondu court et rien d'autre (glisser, empiler et
   zoomer ont été écartés par lui sur defilement.html). L'écran du patron est
   cadré sur sa carte, un peu plus petit que nature (0,88) pour qu'elle
   tienne en largeur.
   Aucun recul de caméra sur un écran immobile : c'est ce qu'il a vu comme un
   bug dans le film des travaux d'avant (« l'écran passe de plein écran à un
   peu plus petit quand on reste figé dessus »).
   Un seul écart avec l'appli dans la fiche : le bouton d'envoi reste éteint
   pendant que les travaux se replient (voir poser, étape 5).

   RELU PAR UN SECOND REGARD le 19 novembre, image par image sur le film
   encodé : les défilements, la cadence des coches, la tenue des appuis, la
   frappe et le fondu ont été trouvés bons. Trois réglages en sont sortis, et
   sont pris : l'éclair du bouton vert pendant le repli, la tenue finale
   (ramenée de 1,4 à 0,3 s, la page pose la dernière image), et deux repos
   raccourcis (l'écran d'appel, l'attente avant « Travaux à faire »). Pas
   relu une seconde fois par lui.

   Tout l'état est une fonction du temps : poser(t).
   ======================================================================= */
(function () {
  "use strict";

  var etat = function (nom) { return document.querySelector('[data-planche="' + nom + '"]'); };
  var creer = function (balise, attributs, parent) {
    var e = document.createElement(balise);
    for (var k in attributs) { if (k === "texte") e.textContent = attributs[k]; else if (k === "html") e.innerHTML = attributs[k]; else e.setAttribute(k, attributs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  };
  var NS = "http://www.w3.org/2000/svg";
  var trait = function (parent, attributs) { var e = document.createElementNS(NS, attributs.tag || "path"); for (var k in attributs) if (k !== "tag") e.setAttribute(k, attributs[k]); parent.appendChild(e); return e; };

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
  // L'écran de l'autre appli sort de sa case en quatre images lisibles, puis
  // se pose longuement. Une courbe plus vive (.2, .84, .2, 1) le posait à
  // 40 % de sa taille dès la deuxième image : la case touchée était
  // recouverte avant qu'on ait vu d'où il venait. Elle reste à l'épingle,
  // qui, elle, doit tomber franchement.
  var SORT = courbe(.3, .3, .15, 1), POSE = courbe(.2, .84, .2, 1), FERME = courbe(.5, 0, .3, 1), TRACE = courbe(.4, 0, .2, 1);
  // La fiche qui défile : elle part, prend son élan, se pose.
  var VA_ET_VIENT = courbe(.5, 0, .2, 1);

  // ── La scène : le cadre, 310 × 537, en haut à gauche de l'écran du
  // tournage (402 × 874). La page garde cette largeur : c'est elle qui
  // décide de ce que l'appli peint. Le cadre est la fiche au repos (294 × 521)
  // avec huit pixels de la page autour d'elle : quand elle défile, ses bords
  // filent sous le cadre au lieu d'être rognés par lui.
  var MARGE = 8, L = 310, H = 537, ECRAN = 402, GRAIN = window.devicePixelRatio || 1;
  creer("style", { texte:
    "html,body{margin:0;overflow:hidden}" +
    "#plateau{position:fixed;left:0;top:0;width:" + L + "px;height:" + H + "px;overflow:hidden;z-index:1000;background:#faf9f5}" +
    "#camera,#soir{position:absolute;left:0;top:0;width:" + ECRAN + "px;transform-origin:0 0}" +
    "#soir{background:var(--atlas-cream,#f5f3ee)}" +
    // Ce qu'on touche s'assombrit un instant.
    ".appui{position:absolute;background:rgba(28,28,26,.13);opacity:0;pointer-events:none}" +
    "#curseur{position:absolute;width:1.6px;border-radius:1px;background:var(--atlas-or,#b98b47);pointer-events:none}" +
    "#toise{position:absolute;left:0;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box}" +
    // ── L'autre appli : un schéma, pas une capture ──
    ".autre{position:absolute;left:0;top:0;width:" + L + "px;height:" + H + "px;overflow:hidden;background:#f0ecdf;opacity:0;will-change:transform;font-family:inherit;color:#1c1c1a}" +
    ".autre > svg{position:absolute;left:0;top:0;display:block}" +
    ".autre .retour{position:absolute;left:10px;top:10px;height:26px;display:flex;align-items:center;gap:4px;padding:0 11px 0 8px;border-radius:13px;background:#fff;box-shadow:0 1px 6px rgba(28,28,26,.14);font-size:12.5px;font-weight:600;line-height:1}" +
    ".autre .retour svg{flex:none}" +
    ".autre .nom{position:absolute;left:0;right:0;top:10px;height:26px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;letter-spacing:-.01em}" +
    ".autre .champ{position:absolute;left:12px;right:12px;top:45px;height:42px;display:flex;align-items:center;gap:8px;padding:0 13px 0 12px;border-radius:13px;background:#fff;box-shadow:0 2px 10px rgba(28,28,26,.12);font-size:13px;font-weight:500;white-space:nowrap}" +
    ".autre .champ svg{flex:none}" +
    // Ce que l'autre appli fait de l'adresse, dit sous elle.
    ".autre .fait{position:absolute;left:12px;top:95px;height:27px;display:flex;align-items:center;gap:7px;padding:0 13px 0 10px;border-radius:13.5px;background:#fff;box-shadow:0 1px 6px rgba(28,28,26,.12);font-size:12.5px;font-weight:600;letter-spacing:-.005em;white-space:nowrap}" +
    ".autre .fait i{flex:none;width:8px;height:8px;border-radius:50%;background:#2f6de0}" +
    // L'écran d'appel : sombre, le numéro en grand, tout dans la moitié du haut.
    "#appel{background:linear-gradient(180deg,#1d1e22,#2b2c31)}" +
    "#appel .retour{background:rgba(255,255,255,.16);box-shadow:none;color:#fff}" +
    "#appel .nom{color:rgba(255,255,255,.72)}" +
    "#appel .rond{position:absolute;left:50%;top:60px;width:58px;height:58px;margin-left:-29px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center}" +
    "#appel .onde{position:absolute;left:50%;top:89px;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);opacity:0}" +
    "#appel .numero{position:absolute;left:0;right:0;top:132px;margin:0;text-align:center;font-size:25px;font-weight:500;letter-spacing:.01em;line-height:1.2;color:#fff;font-variant-numeric:tabular-nums}" +
    "#appel .sonne{position:absolute;left:0;right:0;top:167px;margin:0;text-align:center;font-size:13.5px;line-height:1.3;color:rgba(255,255,255,.66)}" +
    "#appel .sonne b{display:inline-block;width:1.1em;text-align:left;font-weight:400}" +
    "#appel .touche{position:absolute;top:222px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center}" +
    "#appel .touche.raccroche{left:50%;top:217px;width:60px;height:60px;margin-left:-30px;background:#e5483d}"
  }, document.head);

  var plateau = creer("div", { id: "plateau" }), camera = creer("div", { id: "camera" }, plateau), soir = creer("div", { id: "soir" }, plateau);
  var ecran = etat("deplie"), ecranDuPatron = etat("retour");
  // Ce qu'on lit dans les écrans figés aux autres étapes, avant de les ôter.
  var lu = function (nom) { return etat(nom).querySelector('[data-atlas="travaux-a-faire"]'); };
  var COMPTES = ["deplie", "coche1", "coche2", "coche3", "coche4"].map(function (n) { return lu(n).querySelector('[data-atlas="compte-des-travaux"]').textContent; });
  var AVANCES = ["deplie", "coche1", "coche2", "coche3", "coche4"].map(function (n) { return lu(n).querySelector('[data-atlas="avance-des-travaux"] span').style.width; });
  var cochees = [].slice.call(lu("coche4").querySelectorAll('[data-atlas="tache-du-retour"]')).map(function (b) {
    return { rond: b.querySelector("span").getAttribute("style"), coche: b.querySelector("path").getAttribute("stroke-dashoffset"), nom: b.querySelectorAll("span")[1].getAttribute("style") };
  });
  var REMARQUE = lu("remarque").querySelector('[data-atlas="a-signaler"]').value;
  var enEnvoi = lu("envoi").querySelector('[data-atlas="envoyer-le-retour"]').textContent;
  var pilule = lu("envoye").querySelector('[data-atlas="retour-envoye"]');
  var apresEnvoi = { pli: lu("envoye").querySelector('[data-atlas="ouvrir-travaux"]').nextElementSibling.style.gridTemplateRows, chevron: lu("envoye").querySelector('[data-atlas="ouvrir-travaux"] svg').style.transform };

  ecran.hidden = false; ecranDuPatron.hidden = false;
  camera.appendChild(ecran); soir.appendChild(ecranDuPatron);
  document.querySelectorAll("body > [data-planche]").forEach(function (e) { e.remove(); });
  document.body.appendChild(plateau);
  // Ce qui flotte sur l'écran de l'appli (la barre du bas, le tiroir des
  // clients sans date) resterait collé au cadre : le film cadre la fiche.
  plateau.querySelectorAll("*").forEach(function (e) { if (getComputedStyle(e).position === "fixed") e.style.display = "none"; });

  // ── La fiche, et ce qu'elle porte ────────────────────────────────────────
  var fiche = ecran.querySelector('[data-atlas="feuille"]');
  var origine = plateau.getBoundingClientRect();
  var place = function (e) { var r = e.getBoundingClientRect(); return { x: r.left - origine.left, y: r.top - origine.top, l: r.width, h: r.height }; };
  var FICHE = place(fiche);
  var dansLaFiche = function (e) { var p = place(e); return { x: p.x - FICHE.x, y: p.y - FICHE.y, l: p.l, h: p.h }; };
  var cases = fiche.querySelectorAll('[data-atlas="geste-de-la-fiche"]');
  var travaux = fiche.querySelector('[data-atlas="travaux-a-faire"]');
  var barre = travaux.querySelector('[data-atlas="ouvrir-travaux"]'), chevron = barre.querySelector("svg"), compte = travaux.querySelector('[data-atlas="compte-des-travaux"]');
  var avance = travaux.querySelector('[data-atlas="avance-des-travaux"] span'), pli = barre.nextElementSibling;
  var taches = [].slice.call(travaux.querySelectorAll('[data-atlas="tache-du-retour"]')).map(function (b, i) {
    var t = { rond: b.querySelector("span"), coche: b.querySelector("path"), nom: b.querySelectorAll("span")[1] };
    t.avant = { rond: t.rond.getAttribute("style"), coche: t.coche.getAttribute("stroke-dashoffset"), nom: t.nom.getAttribute("style") }; t.apres = cochees[i];
    return t;
  });
  var signaler = travaux.querySelector('[data-atlas="a-signaler"]'), envoyer = travaux.querySelector('[data-atlas="envoyer-le-retour"]'), ENVOYER = envoyer.textContent;
  // « Retour du jour envoyé » : le nœud que l'appli ajoute sous les travaux
  // une fois le retour parti. Il attend son heure.
  travaux.appendChild(pilule); pilule.style.display = "none";

  // Les places, mesurées dépliée (telle que figée) puis une fois le retour
  // envoyé : c'est ce qui dit où la fiche s'arrête sous le cadre.
  var P = { securite: dansLaFiche(fiche.querySelector('[data-atlas="fiche-de-securite"]')), barre: dansLaFiche(barre), envoyer: dansLaFiche(envoyer), signaler: dansLaFiche(signaler), maps: dansLaFiche(cases[0]), appel: dansLaFiche(cases[3]) };
  var RAYON = { caseDeLaFiche: getComputedStyle(cases[0]).borderRadius, barre: getComputedStyle(barre.parentElement).borderRadius, envoyer: getComputedStyle(envoyer).borderRadius };
  var deplie = pli.style.gridTemplateRows, tourne = chevron.style.transform;
  pli.style.transition = "none"; pli.style.gridTemplateRows = apresEnvoi.pli; pilule.style.display = "";
  var H_ENVOYEE = fiche.getBoundingClientRect().height;
  pli.style.gridTemplateRows = "0fr"; pilule.style.display = "none";
  var H_REPOS = fiche.getBoundingClientRect().height;
  pli.style.gridTemplateRows = deplie; pli.style.transition = "";
  // Où la fiche s'arrête sous le cadre (ce qui, d'elle, est au bord haut du
  // cadre) : entière, sa marge au-dessus ; la fiche de sécurité en tête, les
  // quatre travaux et les photos dessous, sans entamer la remarque ; son bas
  // (la remarque, le bouton, sa marge dessous) ; puis, repliée, des quatre
  // cases jusqu'à « Retour du jour envoyé ».
  var HAUT = -MARGE, AUX_TRAVAUX = Math.round(P.securite.y - 14), A_LA_REMARQUE = Math.round(FICHE.h + MARGE - H), ENVOYEE = Math.round(P.maps.y - MARGE);

  // ── Les deux autres applis, dessinées ────────────────────────────────────
  var appuis = {};
  var poserAppui = function (nom, p, rayon) {
    appuis[nom] = creer("div", { "class": "appui", style: "left:" + p.x.toFixed(2) + "px;top:" + p.y.toFixed(2) + "px;width:" + p.l.toFixed(2) + "px;height:" + p.h.toFixed(2) + "px;border-radius:" + rayon }, fiche);
  };
  fiche.style.position = "relative";
  poserAppui("maps", P.maps, RAYON.caseDeLaFiche); poserAppui("appel", P.appel, RAYON.caseDeLaFiche);
  poserAppui("barre", P.barre, RAYON.barre + " " + RAYON.barre + " 0 0"); poserAppui("envoyer", P.envoyer, RAYON.envoyer);
  var FLECHE = function (teinte) { return '<svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="' + teinte + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 1 1.2 5.5 5.6 10"/></svg>'; };
  var maps = creer("div", { "class": "autre", id: "maps", html:
    '<svg viewBox="0 0 294 532" width="' + L + '" height="' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><use href="#plan"/><g class="trajet"></g></svg>' +
    '<div class="retour">' + FLECHE("#1c1c1a") + 'Cause</div><div class="nom">Maps</div>' +
    '<div class="champ"><svg width="13" height="16" viewBox="0 0 13 16" fill="none" stroke="#8a8578" stroke-width="1.5" stroke-linejoin="round"><path d="M6.5 15C3 10.6 1 8.2 1 6a5.5 5.5 0 0 1 11 0c0 2.200-2 4.600-5.500 9z"/><circle cx="6.500" cy="6" r="1.800"/></svg>12 allée des Charmilles, Valmorin</div>' +
    '<div class="fait"><i></i>Itinéraire en voiture</div>' }, plateau);
  var appel = creer("div", { "class": "autre", id: "appel", html:
    '<div class="retour">' + FLECHE("#fff") + 'Cause</div><div class="nom">Téléphone</div>' +
    '<span class="onde"></span><span class="onde"></span>' +
    '<span class="rond"><svg width="26" height="26" viewBox="0 0 26 26" fill="rgba(255,255,255,.82)" aria-hidden="true"><circle cx="13" cy="9" r="5"/><path d="M3 23.500c1-5.600 5-8.500 10-8.500s9 2.900 10 8.500z"/></svg></span>' +
    '<p class="numero">06 39 98 12 34</p><p class="sonne">Appel en cours<b></b></p>' +
    '<span class="touche" style="left:52px"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 9.500a6 6 0 0 0 12 0M10 15.500v3"/></svg></span>' +
    '<span class="touche raccroche"><svg width="28" height="28" viewBox="0 0 28 28" fill="#fff" aria-hidden="true"><path d="M14 10.200c-4.300 0-8.100 1.300-10.900 3.400-.8.600-.9 1.700-.3 2.500l1.600 2c.6.700 1.600.9 2.400.4l2.700-1.600c.6-.4 1-1 1-1.700v-1.900c2.300-.6 4.700-.6 7 0v1.900c0 .7.400 1.300 1 1.700l2.700 1.600c.8.500 1.800.3 2.400-.4l1.600-2c.6-.800.500-1.900-.3-2.500-2.800-2.100-6.600-3.400-10.900-3.400z"/></svg></span>' +
    '<span class="touche" style="left:192px"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.500h3l4-3.500v12l-4-3.500H3z"/><path d="M13.500 7a4 4 0 0 1 0 6M15.800 4.800a7.200 7.200 0 0 1 0 10.400"/></svg></span>' }, plateau);
  var ondes = appel.querySelectorAll(".onde"), points = appel.querySelector(".sonne b");
  // Le plan, dessiné une fois : un bourg, une départementale, une allée en
  // impasse. Aucune carte réelle n'a servi : Valmorin n'existe pas.
  creer("div", { style: "position:absolute;width:0;height:0;overflow:hidden", html:
    '<svg width="0" height="0" aria-hidden="true"><defs><g id="plan">' +
    '<rect width="294" height="532" fill="#f0ecdf"/>' +
    // le parc, sa pièce d'eau, les charmilles au bout de l'allée
    '<path d="M-10 118C22 110 52 126 68 156c10 34-2 70-28 86-16 10-34 10-50 6z" fill="#dde8d0"/><ellipse cx="24" cy="200" rx="17" ry="10" fill="#cfe1e8"/>' +
    '<path d="M100 148c20-14 50-12 62 4 8 14 4 30-12 36-22 8-46 2-54-12-4-10-2-20 4-28z" fill="#dde8d0"/>' +
    // les îlots bâtis, un ton en dessous
    '<path d="M232 296c22-6 46-6 72-2v112c-34-10-60-28-80-58-6-16-4-36 8-52z" fill="#e9e4d5"/><path d="M-10 356c44-2 84-8 118-22 6 26 2 56-14 80-28 26-66 40-104 44z" fill="#e9e4d5"/>' +
    '<path d="M150 420c24-6 52-2 76 12 20 26 28 60 24 100H136c-8-40-4-80 14-112z" fill="#e9e4d5"/>' +
    // les rues : un liseré, puis la chaussée
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#e0d9c6">' +
    '<path d="M-10 336C50 332 104 322 150 302S244 266 304 260" stroke-width="17"/><path d="M84 60c8 80 4 170 26 256" stroke-width="11"/><path d="M214 278C222 230 240 170 252 60" stroke-width="11"/>' +
    '<path d="M228 208c-24-12-52-20-82-28" stroke-width="9"/><path d="M150 302c20 58 60 118 154 138" stroke-width="11"/><path d="M-10 250c40-4 70-18 98-36" stroke-width="9"/>' +
    '<path d="M240 150c22 6 44 8 64 6" stroke-width="9"/><path d="M30 540c10-70 40-140 74-214" stroke-width="9"/><path d="M-10 452c50-6 96-20 130-48" stroke-width="9"/></g><g stroke="#fffdf7">' +
    '<path d="M-10 336C50 332 104 322 150 302S244 266 304 260" stroke-width="14"/><path d="M84 60c8 80 4 170 26 256" stroke-width="8"/><path d="M214 278C222 230 240 170 252 60" stroke-width="8"/>' +
    '<path d="M228 208c-24-12-52-20-82-28" stroke-width="6"/><path d="M150 302c20 58 60 118 154 138" stroke-width="8"/><path d="M-10 250c40-4 70-18 98-36" stroke-width="6"/>' +
    '<path d="M240 150c22 6 44 8 64 6" stroke-width="6"/><path d="M30 540c10-70 40-140 74-214" stroke-width="6"/><path d="M-10 452c50-6 96-20 130-48" stroke-width="6"/></g></g>' +
    // quelques maisons
    '<g fill="#e3ddcb"><rect x="172" y="162" width="13" height="10" rx="1.500" transform="rotate(18 178 167)"/><rect x="196" y="170" width="12" height="10" rx="1.500" transform="rotate(22 202 175)"/>' +
    '<rect x="182" y="204" width="13" height="10" rx="1.500" transform="rotate(20 188 209)"/><rect x="156" y="196" width="12" height="9" rx="1.500" transform="rotate(16 162 200)"/>' +
    '<rect x="242" y="216" width="14" height="10" rx="1.500" transform="rotate(-78 249 221)"/><rect x="248" y="178" width="13" height="10" rx="1.500" transform="rotate(-80 254 183)"/>' +
    '<rect x="100" y="236" width="13" height="10" rx="1.500" transform="rotate(80 106 241)"/><rect x="104" y="270" width="13" height="10" rx="1.500" transform="rotate(78 110 275)"/>' +
    '<rect x="52" y="226" width="13" height="10" rx="1.500" transform="rotate(-30 58 231)"/><rect x="170" y="330" width="14" height="10" rx="1.500" transform="rotate(64 177 335)"/>' +
    '<rect x="196" y="372" width="14" height="10" rx="1.500" transform="rotate(52 203 377)"/><rect x="44" y="300" width="14" height="10" rx="1.500" transform="rotate(-6 51 305)"/>' +
    '<rect x="256" y="240" width="14" height="10" rx="1.500" transform="rotate(-10 263 245)"/><rect x="64" y="372" width="14" height="10" rx="1.500" transform="rotate(-66 71 377)"/>' +
    '<rect x="40" y="428" width="14" height="10" rx="1.500" transform="rotate(-12 47 433)"/></g>' +
    '<path id="allee" d="M148 170c30 8 56 16 80 28 10 5 18 10 26 16" fill="none"/>' +
    '<text font-size="7.800" font-weight="500" fill="#7d786b" letter-spacing=".015em"><textPath href="#allee" startOffset="17">Allée des Charmilles</textPath></text>' +
    '</g></defs></svg>' }, plateau);

  // Le trajet : il suit les rues du plan, au point près. Une rue est une
  // courbe de Bézier ; le trajet en emprunte des morceaux.
  var morceau = function (c, a, b) {
    var mi = function (p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    var coupe = function (c, t) {
      var ab = mi(c[0], c[1], t), bc = mi(c[1], c[2], t), cd = mi(c[2], c[3], t);
      var abc = mi(ab, bc, t), bcd = mi(bc, cd, t), p = mi(abc, bcd, t);
      return [[c[0], ab, abc, p], [p, bcd, cd, c[3]]];
    };
    var fin = coupe(c, b)[0];
    return a > 0 ? coupe(fin, a / b)[1] : fin;
  };
  var ROUTE_1 = [[-10, 336], [50, 332], [104, 322], [150, 302]];
  var ROUTE_2 = [[150, 302], [196, 282], [244, 266], [304, 260]];
  var MONTEE = [[214, 278], [222, 230], [240, 170], [252, 60]];
  var ALLEE = [[228, 208], [204, 196], [176, 188], [146, 180]];
  var etapes = [morceau(ROUTE_1, .28, 1), morceau(ROUTE_2, 0, .45), morceau(MONTEE, 0, .42), ALLEE];
  var n2 = function (v) { return Math.round(v * 100) / 100; };
  var chemin = "M" + n2(etapes[0][0][0]) + " " + n2(etapes[0][0][1]);
  etapes.forEach(function (c, i) {
    // Les jonctions tombent à une fraction de pixel l'une de l'autre : on
    // rejoint le début du morceau suivant par un trait, invisible à cette taille.
    if (i) chemin += "L" + n2(c[0][0]) + " " + n2(c[0][1]);
    chemin += "C" + c.slice(1).map(function (p) { return n2(p[0]) + " " + n2(p[1]); }).join(" ");
  });
  var ARRIVEE = ALLEE[3];
  var TRAJET = (function () {
    var g = maps.querySelector(".trajet");
    var dessous = trait(g, { d: chemin, fill: "none", stroke: "#2251b4", "stroke-width": 7.6, "stroke-linecap": "round", "stroke-linejoin": "round" });
    var dessus = trait(g, { d: chemin, fill: "none", stroke: "#2f6de0", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    var longueur = dessus.getTotalLength();
    [dessous, dessus].forEach(function (p) { p.setAttribute("stroke-dasharray", longueur + " " + longueur); });
    // L'épingle de l'arrivée, et son ombre au sol.
    var ombre = trait(g, { tag: "ellipse", cx: ARRIVEE[0], cy: ARRIVEE[1] + .5, rx: 5.5, ry: 2, fill: "rgba(28,28,26,.22)" });
    var epingle = trait(g, { tag: "g" });
    trait(epingle, { d: "M0 0c-8.600-11.400-12.500-16.600-12.500-23.300a12.500 12.500 0 0 1 25 0c0 6.700-3.900 11.900-12.500 23.300z", fill: "#d8503f", stroke: "#b23c2e", "stroke-width": 1 });
    trait(epingle, { tag: "circle", cx: 0, cy: -23.3, r: 4.4, fill: "#fff" });
    // Le départ : là où l'on est.
    var debut = dessus.getPointAtLength(0), depart = trait(g, { tag: "g", transform: "translate(" + n2(debut.x) + " " + n2(debut.y) + ")" });
    trait(depart, { tag: "circle", r: 13, fill: "#2f6de0", opacity: .16 });
    trait(depart, { tag: "circle", r: 6.6, fill: "#fff" });
    trait(depart, { tag: "circle", r: 4.4, fill: "#2f6de0" });
    return { dessous: dessous, dessus: dessus, longueur: longueur, ombre: ombre, epingle: epingle };
  })();

  // ── L'écran du patron : Terminés, Retours d'intervention ─────────────────
  // Cadré sur les retours du client (son nom, « 1 retour », la carte dépliée),
  // un rien de marge autour.
  var groupe = place(ecranDuPatron.querySelector('[data-atlas="groupe-de-retours"]'));
  var SOIR = { x: groupe.x - 6, y: groupe.y - 12, l: groupe.l + 12 };
  SOIR.echelle = L / SOIR.l;
  var cadrerLeSoir = function () { soir.style.transform = "translate(" + (-SOIR.x * SOIR.echelle).toFixed(3) + "px," + (-SOIR.y * SOIR.echelle).toFixed(3) + "px) scale(" + SOIR.echelle.toFixed(5) + ")"; };

  // ── Le curseur de la remarque ────────────────────────────────────────────
  // Une toise invisible, composée comme le cadre de saisie, dit où finit le
  // texte : c'est là que le curseur se tient.
  var styleDeSaisie = getComputedStyle(signaler);
  var toise = creer("div", { id: "toise" }, signaler.parentElement), fin = creer("span", {}, null), curseur = creer("span", { id: "curseur" }, signaler.parentElement);
  ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].forEach(function (k) { toise.style[k] = styleDeSaisie[k]; });
  signaler.parentElement.style.position = "relative";
  var HAUTEUR_DE_LIGNE = parseFloat(styleDeSaisie.lineHeight), CORPS = parseFloat(styleDeSaisie.fontSize);
  var poserLeCurseur = function (ecrit, visible) {
    toise.style.width = signaler.offsetWidth + "px"; toise.style.left = signaler.offsetLeft + "px"; toise.style.top = signaler.offsetTop + "px";
    toise.textContent = ecrit; toise.appendChild(fin);
    curseur.style.left = (signaler.offsetLeft + fin.offsetLeft).toFixed(2) + "px";
    curseur.style.top = (signaler.offsetTop + fin.offsetTop + (HAUTEUR_DE_LIGNE - 1.2 * CORPS) / 2).toFixed(2) + "px";
    curseur.style.height = (1.2 * CORPS).toFixed(2) + "px";
    curseur.style.visibility = visible && !window.SANS_CURSEUR ? "visible" : "hidden";
  };

  // ── Le déroulé, en secondes ──────────────────────────────────────────────
  // Chaque écran garde un repos une fois posé : refermé aussitôt, ce qu'il
  // dit n'était qu'un tressaillement (relecture du 18 novembre). Le repos du
  // début est court : la page attend déjà une demi-seconde avant de lancer
  // le film.
  var T = {
    maps: { appui: .24, ouvre: .36, trace: .78, tracee: .70, ferme: 2.06, centre: [MARGE + P.maps.x + P.maps.l / 2, MARGE + P.maps.y + P.maps.h / 2] },
    appel: { appui: 2.58, ouvre: 2.70, ferme: 3.75, centre: [MARGE + P.appel.x + P.appel.l / 2, MARGE + P.appel.y + P.appel.h / 2] }
  };
  var DUREE_OUVRE = .46, DUREE_FERME = .36;
  // Les travaux. La barre se tient appuyée jusqu'à ce que le pli s'ouvre ;
  // la fiche défile pendant qu'il s'ouvre. Une coche toutes les 280 ms : le
  // rond met 200 ms à se remplir, la coche 300 à se tracer.
  T.barre = T.appel.ferme + DUREE_FERME + .13; T.deplie = T.barre + .15; T.auxTravaux = T.deplie + .04;
  T.coches = [0, 1, 2, 3].map(function (i) { return T.deplie + .82 + i * .28; });
  T.aLaRemarque = T.coches[3] + .62;
  T.curseur = T.aLaRemarque + .56; T.ecrit = T.curseur + .16;
  // La frappe : régulière sans être mécanique, un souffle après un point ou
  // une virgule. Une quarantaine de millisecondes par lettre.
  var instants = [], h = T.ecrit;
  for (var i = 0; i < REMARQUE.length; i++) {
    instants.push(h);
    var car = REMARQUE.charAt(i), alea = ((i * 7919 + 13) % 23) / 1000;
    h += .026 + alea + (car === "." ? .14 : car === "," ? .08 : 0);
  }
  T.ecritFin = instants[instants.length - 1];
  T.appuiEnvoyer = T.ecritFin + .42; T.envoi = T.appuiEnvoyer + .14; T.envoye = T.envoi + .36;
  // « Retour du jour envoyé » se lit, puis l'écran du patron paraît. Le film
  // s'arrête peu après le fondu : dans la page, sa dernière image se pose
  // par-dessus et reste, on lit l'écran du patron sur elle (relecture du
  // 19 novembre : 1,4 s de tenue dans le film était du temps mort).
  T.soir = T.envoye + 1.15;
  var FONDU = .27, DUREE = Math.ceil((T.soir + FONDU + .3) * 60) / 60;

  // L'écran de l'autre appli part de la taille d'une case (un cinquième de
  // la sienne), posé SUR elle. Le point fixe d'une mise à l'échelle n'est pas
  // le centre de ce qu'on veut voir rétrécir dessus : il se calcule, c'est
  // celui qui amène le centre de l'écran sur le centre de la case à l'échelle
  // de départ.
  var PETIT = .2, CENTRE = [L / 2, H / 2];
  var pointFixe = function (centre) { return [(centre[0] - PETIT * CENTRE[0]) / (1 - PETIT), (centre[1] - PETIT * CENTRE[1]) / (1 - PETIT)]; };
  var appuyer = function (nom, t, pose, leve) { appuis[nom].style.opacity = (doux(part(t, pose, pose + .07)) * (1 - doux(part(t, leve, leve + .19)))).toFixed(3); };
  var poserAutre = function (el, nom, t) {
    var r = T[nom];
    appuyer(nom, t, r.appui, r.ouvre + .1);
    var ouvert = t < r.ferme ? SORT(part(t, r.ouvre, r.ouvre + DUREE_OUVRE)) : 1 - FERME(part(t, r.ferme, r.ferme + DUREE_FERME));
    if (ouvert <= 0) { el.style.opacity = "0"; el.style.transform = "scale(" + PETIT + ")"; return; }
    // L'échelle part de la taille de la case, avec son arrondi, et les coins
    // s'ouvrent avec elle.
    var echelle = PETIT + (1 - PETIT) * ouvert, fixe = pointFixe(r.centre);
    el.style.transformOrigin = fixe[0].toFixed(3) + "px " + fixe[1].toFixed(3) + "px";
    el.style.transform = "scale(" + echelle.toFixed(4) + ")";
    el.style.borderRadius = (12 * (1 - ouvert) / echelle).toFixed(2) + "px";
    el.style.opacity = doux(part(ouvert, 0, t < r.ferme ? .3 : .2)).toFixed(3);
  };
  // Maps : le trajet se trace du départ à l'arrivée ; l'épingle se pose au bout.
  var tracer = function (t) {
    var r = T.maps, j = TRAJET;
    var decalage = (j.longueur * (1 - TRACE(part(t, r.trace, r.trace + r.tracee)))).toFixed(2);
    j.dessous.setAttribute("stroke-dashoffset", decalage); j.dessus.setAttribute("stroke-dashoffset", decalage);
    var pose = part(t, r.trace + r.tracee * .62, r.trace + r.tracee * .62 + .34), chute = POSE(pose);
    j.epingle.setAttribute("transform", "translate(" + ARRIVEE[0] + " " + (ARRIVEE[1] - 16 * (1 - chute)).toFixed(2) + ") scale(" + (.6 + .4 * chute).toFixed(3) + ")");
    j.epingle.setAttribute("opacity", doux(part(pose, 0, .35)).toFixed(3));
    j.ombre.setAttribute("opacity", doux(part(pose, .3, 1)).toFixed(3));
  };
  // Le téléphone : l'appel part. Deux ondes quittent le rond l'une après
  // l'autre, et les points de suspension se comptent.
  var sonner = function (t) {
    var depuis = t - (T.appel.ouvre + .3);
    points.textContent = depuis < 0 ? "" : "...".slice(0, 1 + Math.floor(depuis / .3) % 3);
    [0, 1].forEach(function (k) {
      var tour = depuis < 0 ? -1 : ((depuis - k * .55) / 1.1) % 1, o = ondes[k];
      if (tour < 0) { o.style.opacity = "0"; return; }
      o.style.transform = "scale(" + (1 + 1.1 * tour).toFixed(3) + ")";
      o.style.opacity = (.55 * (1 - tour) * doux(part(tour, 0, .12))).toFixed(3);
    });
  };

  // ── Rejouer une transition de l'appli à l'instant voulu ──────────────────
  // L'appli change un style, et sa feuille de style fait le mouvement. Ici :
  // on pose l'état d'avant sans transition, puis chaque changement dans
  // l'ordre, avec la transition de l'appli, qu'on arrête à l'instant où le
  // changement suivant arrive (c'est de là qu'il repart), et pour le dernier
  // à l'instant filmé.
  var rejouer = function (el, poserUnEtat, depart, changements, t) {
    el.style.transition = "none"; poserUnEtat(depart); void el.getBoundingClientRect();
    el.style.transition = "";
    for (var i = 0; i < changements.length && changements[i][0] <= t; i++) {
      poserUnEtat(changements[i][1]); void el.getBoundingClientRect();
      var jusqua = i + 1 < changements.length && changements[i + 1][0] <= t ? changements[i + 1][0] : t;
      el.getAnimations().forEach(function (a) { a.pause(); a.currentTime = (jusqua - changements[i][0]) * 1000; });
      void el.getBoundingClientRect();
    }
  };
  var style = function (propriete) { return function (el) { return function (valeur) { el.style[propriete] = valeur; }; }; };
  var tout = function (el) { return function (valeur) { el.setAttribute("style", valeur); }; };

  // La fiche sous le cadre : [instant, où elle s'arrête], et le temps du
  // trajet. Quand le retour est parti, les travaux se replient et la fiche
  // raccourcit de près de cinq cents pixels en 300 ms : le cadre suit alors
  // son bord bas (c'est ce qu'on voit sur un téléphone resté en bas de page),
  // sans quoi il montrerait un instant la suite du planning, sous la fiche.
  var ARRETS = [[0, HAUT, 0], [T.auxTravaux, AUX_TRAVAUX, .56], [T.aLaRemarque, A_LA_REMARQUE, .5]];
  var DUREE_DU_PLI = .3;
  var defiler = function (t) {
    var y = ARRETS[0][1];
    for (var i = 1; i < ARRETS.length; i++) y = entre(y, ARRETS[i][1], VA_ET_VIENT(part(t, ARRETS[i][0], ARRETS[i][0] + ARRETS[i][2])));
    if (t >= T.envoye) {
      var auBord = fiche.getBoundingClientRect().height + MARGE - H;
      y = auBord - (H_ENVOYEE + MARGE - H - ENVOYEE) * doux(part(t, T.envoye, T.envoye + DUREE_DU_PLI));
    }
    // La fiche est à un demi-pixel dans la page : on la déplace d'un nombre
    // entier de pixels d'écran, sans quoi tout son texte serait refait flou.
    camera.style.transform = "translate(" + (MARGE - FICHE.x).toFixed(3) + "px," + (-Math.round((FICHE.y + y) * GRAIN) / GRAIN).toFixed(4) + "px)";
    return y;
  };

  window.DUREE = DUREE;
  window.INSTANTS = T;
  window.ARRETS = { haut: HAUT, auxTravaux: AUX_TRAVAUX, aLaRemarque: A_LA_REMARQUE, envoyee: ENVOYEE };
  // Ce que le cadre suppose de la fiche : film-fiche.cjs refuse de filmer si
  // elle a changé de taille (le cadre et ses arrêts seraient à repenser).
  window.FICHE = { marge: MARGE, l: FICHE.l, hauteurAuRepos: H_REPOS, hauteurDepliee: FICHE.h, hauteurEnvoyee: H_ENVOYEE };
  window.poser = function (t) {
    // 1. Maps, puis le téléphone.
    poserAutre(maps, "maps", t); tracer(t);
    poserAutre(appel, "appel", t); sonner(t);
    // 2. « Travaux à faire » : le pli s'ouvre, le chevron tourne. Il se
    // referme quand le retour est parti.
    appuyer("barre", t, T.barre, T.deplie);
    rejouer(pli, style("gridTemplateRows")(pli), "0fr", [[T.deplie, deplie], [T.envoye, apresEnvoi.pli]], t);
    rejouer(chevron, style("transform")(chevron), "none", [[T.deplie, tourne], [T.envoye, apresEnvoi.chevron]], t);
    barre.setAttribute("aria-expanded", String(t >= T.deplie && t < T.envoye));
    // 3. Les quatre travaux, cochés un à un : le rond se remplit, la coche
    // se trace, le nom s'éteint, le compte et le trait d'avance suivent.
    var faits = 0;
    taches.forEach(function (tache, k) {
      var quand = T.coches[k], fait = t >= quand;
      if (fait) faits++;
      rejouer(tache.rond, tout(tache.rond), tache.avant.rond, [[quand, tache.apres.rond]], t);
      rejouer(tache.coche, function (v) { tache.coche.setAttribute("stroke-dashoffset", v); }, tache.avant.coche, [[quand, tache.apres.coche]], t);
      tache.nom.setAttribute("style", fait ? tache.apres.nom : tache.avant.nom);
      tache.rond.parentElement.setAttribute("aria-pressed", String(fait));
    });
    compte.textContent = COMPTES[faits];
    rejouer(avance, style("width")(avance), AVANCES[0], T.coches.map(function (quand, k) { return [quand, AVANCES[k + 1]]; }), t);
    // 4. La remarque, lettre à lettre.
    var ecrits = 0; while (ecrits < instants.length && instants[ecrits] <= t) ecrits++;
    signaler.value = REMARQUE.slice(0, ecrits);
    var dernier = ecrits ? instants[ecrits - 1] : T.curseur;
    var enFrappe = ecrits > 0 && ecrits < instants.length || t - dernier < .3, bat = Math.floor((t - dernier) / .53) % 2 === 0;
    poserLeCurseur(signaler.value, t >= T.curseur && t < T.appuiEnvoyer && (enFrappe || bat));
    // 5. « Envoyer le retour du jour » : « Un instant… », puis les travaux se
    // replient et « Retour du jour envoyé » paraît dessous, comme dans l'appli.
    // Un écart avec elle, voulu : dans l'appli le bouton redevient vert plein
    // (« Envoyer le retour du jour ») pendant les 300 ms du repli, et dans un
    // film cela se lit comme un éclair, un « Envoyer » alors que c'est envoyé
    // (relecture du 19 novembre). Ici il reste éteint jusqu'à ce que le pli
    // l'ait caché. C'est noté pour l'appli dans TODO.md.
    appuyer("envoyer", t, T.appuiEnvoyer, T.envoi);
    var part_i = t >= T.envoi && t < T.envoye + DUREE_DU_PLI;
    envoyer.disabled = part_i; envoyer.textContent = part_i ? enEnvoi : ENVOYER;
    pilule.style.display = t >= T.envoye ? "" : "none";
    // La fiche défile sous le cadre : après ses états, puisque le cadre suit
    // sa hauteur quand elle se replie.
    defiler(t);
    // 6. Le soir, chez le patron : un fondu court.
    var arrive = doux(part(t, T.soir, T.soir + FONDU));
    cadrerLeSoir();
    soir.style.opacity = arrive.toFixed(3); soir.style.visibility = arrive > 0 ? "visible" : "hidden";
  };
  // Pour le calage (film-fiche.cjs) : l'écran du patron à sa taille, son
  // cadre posé au coin, pour le comparer à sa photo ; et la remarque sans son
  // curseur, que la photo n'a pas (window.SANS_CURSEUR).
  window.calageDuSoir = function () {
    var x = Math.round(SOIR.x), y = Math.round(SOIR.y);
    soir.style.opacity = "1"; soir.style.visibility = "visible"; soir.style.transform = "translate(" + (-x) + "px," + (-y) + "px)";
    return { x: x, y: y };
  };
  window.poser(Number(new URLSearchParams(location.search).get("t")) || 0);
})();
