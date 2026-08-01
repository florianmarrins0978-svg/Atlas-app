/* =======================================================================
   Arborea — Barre de navigation partagée.
   Un seul fichier inclus par tous les écrans outils :
     <script src="nav.js"></script>
   Il s'injecte tout seul en haut de la page et surligne l'écran courant.
   Masqué à l'impression. Aucune donnée, aucun réseau : purement local.
   ======================================================================= */
(function () {
  var PAGES = [
    { href: 'devis-vocal.html',    label: 'Nouveau devis' },
    { href: 'devis-modele.html',   label: 'Devis' },
    { href: 'facture-modele.html', label: 'Factures' },
    { href: 'tva-modele.html',     label: 'TVA déductible' },
    { href: 'mes-tarifs.html',     label: 'Mes tarifs' },
  ];

  var current = (location.pathname.split('/').pop() || '').toLowerCase();

  var css = '' +
    '.arborea-appnav{position:sticky;top:0;z-index:200;display:flex;align-items:center;' +
    'gap:1.2rem;flex-wrap:wrap;padding:0.7rem clamp(1rem,4vw,2rem);' +
    'background:#2f3b2f;box-shadow:0 2px 18px rgba(28,28,26,0.16);}' +
    '.arborea-appnav .brand{font-family:"Playfair Display",Georgia,serif;font-weight:600;font-size:1.1rem;' +
    'color:#f5f3ee;letter-spacing:0.01em;text-decoration:none;}' +
    '.arborea-appnav .links{display:flex;gap:0.25rem;flex-wrap:wrap;margin-left:auto;}' +
    '.arborea-appnav .link{color:rgba(245,243,238,0.72);text-decoration:none;font-family:"Inter",sans-serif;' +
    'font-size:0.85rem;font-weight:500;letter-spacing:0.01em;padding:0.42rem 0.9rem;border-radius:30px;' +
    'transition:color .2s ease,background .2s ease;white-space:nowrap;}' +
    '.arborea-appnav .link:hover{color:#f5f3ee;background:rgba(255,255,255,0.09);}' +
    '.arborea-appnav .link.active{color:#1c1c1a;background:#f5f3ee;font-weight:600;}' +
    '.arborea-appnav .link:focus-visible{outline:1.5px solid #9fbd82;outline-offset:2px;}' +
    '@media print{.arborea-appnav{display:none !important;}}' +
    /* Bandeau d'avertissement — voir le commentaire à sa construction. */
    /* Volontairement NON collant, contrairement à la nav : deux bandeaux
       collés au même bord se superposeraient au défilement. On lit
       l'avertissement une fois, la navigation sert en permanence. */
    '.arborea-avis{padding:0.6rem clamp(1rem,4vw,2rem);' +
    'background:#c0621f;color:#fff;font-family:"Inter",sans-serif;font-size:0.82rem;' +
    'line-height:1.45;letter-spacing:0.01em;}' +
    '.arborea-avis strong{font-weight:600;}' +
    '@media print{.arborea-avis{display:none !important;}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var nav = document.createElement('nav');
  nav.className = 'arborea-appnav';
  nav.setAttribute('aria-label', 'Navigation Arborea');

  var html = '<a class="brand" href="app.html">Arborea</a><div class="links">';
  PAGES.forEach(function (p) {
    var active = p.href.toLowerCase() === current ? ' active' : '';
    var aria = active ? ' aria-current="page"' : '';
    html += '<a class="link' + active + '" href="' + p.href + '"' + aria + '>' + p.label + '</a>';
  });
  html += '</div>';
  nav.innerHTML = html;

  document.body.insertBefore(nav, document.body.firstChild);

  /* Ces cinq écrans sont des MAQUETTES : rien n'y est enregistré, et ils ne
     montrent pas le produit d'aujourd'hui. L'application réelle — chantiers,
     planning, réponse du client, facture, TVA collectée — vit dans le projet
     Next.js et n'est hébergée nulle part (voir docs/A-FAIRE.md, point 3).

     Sans ce bandeau, quiconque ouvre cette adresse en conclut que le produit
     s'arrête à ces cinq rubriques. C'est arrivé, et à celui qui le construit.
     Un site public qui se présente mal ne trompe pas les autres : il trompe
     d'abord ceux qui savent ce qu'il devrait être. */
  var avis = document.createElement('p');
  avis.className = 'arborea-avis';
  avis.setAttribute('role', 'note');
  avis.innerHTML =
    '<strong>Maquette de démonstration.</strong> Ces écrans montrent l\'intention, ' +
    'rien n\'y est enregistré. L\'application complète — chantiers, planning, envoi ' +
    'du devis au client, facture et TVA — attend son hébergement.';

  document.body.insertBefore(avis, nav);

  /* Les écrans ont chacun leurs propres marges internes (padding du body).
     On neutralise ces marges pour la nav afin qu'elle soit pleine largeur et
     collée en haut, tout en restituant l'espacement d'origine sous la barre.
     C'est le bandeau, désormais premier élément, qui remonte contre le haut de
     la page ; la nav se contente de le suivre. */
  var cs = getComputedStyle(document.body);
  avis.style.marginTop = '-' + cs.paddingTop;
  avis.style.marginLeft = '-' + cs.paddingLeft;
  avis.style.marginRight = '-' + cs.paddingRight;
  avis.style.marginBottom = '0';

  nav.style.marginTop = '0';
  nav.style.marginLeft = '-' + cs.paddingLeft;
  nav.style.marginRight = '-' + cs.paddingRight;
  nav.style.marginBottom = cs.paddingTop;
})();
