/*
  LE CONTENU DU FILM D, VERSION RÉCIT : ce qui est montré, quand il diffère de
  film-D-contenu.js.

  Sa demande du 5 octobre 2026 : un autre exemple (une haie de laurier, un
  érable), une cliente, une adresse et un numéro qui n'existent pas, un
  accueil à « trois jours », une fiche client sans « Repris de sa fiche », plus
  d'écran de transcription (il n'existe pas dans l'application), le devis
  entier avec ce qu'il sait faire, la page de la facture et celle du relevé de
  TVA. Les captures vivent dans recit/ : celles du dossier parent servent
  encore au film nerveuse, qui n'a pas bougé et dont les zones sont mesurées
  dessus.

  Tout est repris de film-D-contenu.js, sauf ce qui change : les écrans, les
  zones, les points touchés, les repères, les défilements. Les mesures viennent
  de scripts/preparer-jeu-du-film.mts (« Repères pris ») et des captures
  elles-mêmes, en pixels de l'application (largeur 390) pour les écrans, en
  pixels de l'image pour les zones.
*/
(function () {
  'use strict';
  const B = window.ContenuD;
  window.ContenuRecit = Object.assign({}, B, {
    ECRANS: [
      { nom: 'accueil-avant', src: 'recit/accueil-avant.jpg' },
      { nom: 'fiche-reconnue', src: 'recit/fiche-reconnue.jpg' },
      { nom: 'enregistre', src: 'recit/dictee/enregistre.jpg' },
      { nom: 'devis-redige', src: 'recit/devis-redige.jpg' },
      { nom: 'devis-rempli', src: 'recit/devis-rempli.jpg' },
      { nom: 'date-proposee', src: 'recit/date-proposee.jpg' },
      // La page publique du client n'a pas de marge sous l'encoche : descendue
      // de 60 points (95 px d'écran), la bande découverte de la couleur de la page.
      { nom: 'client-date', src: 'recit/client-date.jpg', haut: 95, fond: '#f4f3ee' },
      { nom: 'client-accepte', src: 'recit/client-accepte.jpg', haut: 95, fond: '#f4f3ee' },
      { nom: 'accueil', src: 'recit/accueil.jpg' },
      { nom: 'planning', src: 'recit/planning-jour-entier.jpg' },
      { nom: 'planning-salarie', src: 'recit/planning-salarie.jpg' },
      { nom: 'fiche-salarie', src: 'recit/fiche-intervention-salarie.jpg' },
      { nom: 'facture-avant', src: 'recit/facture-avant.jpg' },
      { nom: 'facture', src: 'recit/facture.jpg' },
      { nom: 'termines', src: 'recit/termines-apres.jpg' },
      { nom: 'releve-tva', src: 'recit/tva.jpg' },
    ],
    // Ce que le patron dicte, mot pour mot (scripts/_jeu-du-film.ts).
    DICTEE: "J'ai une haie de laurier à rabattre sur 50 ml et je dois tailler les faces. Une taille de cohabitation d'un érable, et mise en sécurité par suppression des bois morts.",
    ZONES: {
      // La page du devis telle que le client la télécharge, et sa première ligne.
      pageDuDevis: { src: 'recit/devis-pdf.jpg', zone: [0, 0, 2481, 3508], largeurSource: 2481 },
      ligneDuDevis: { src: 'recit/devis-pdf.jpg', zone: [110, 1110, 2270, 125], largeurSource: 2481 },
      notification: { src: 'recit/accueil.jpg', zone: [72, 660, 1024, 462], largeurSource: 1170 },
      cartePlanning: { src: 'recit/planning-jour-entier.jpg', zone: [42, 1380, 1092, 492], largeurSource: 1170 },
      ligneTva: { src: 'recit/facture.jpg', zone: [74, 1831, 1022, 64], largeurSource: 1170 },
      pageDeLaFacture: { src: 'recit/facture-pdf.jpg', zone: [0, 0, 2481, 3508], largeurSource: 2481 },
      tableTva: { src: 'recit/facture-pdf.jpg', zone: [120, 1490, 740, 150], largeurSource: 2481 },
      carteTva: { src: 'recit/termines-apres.jpg', zone: [78, 310, 1014, 252], largeurSource: 1170 },
    },
    DEFILEMENTS: Object.assign({}, B.DEFILEMENTS, { devisPremiereLigne: 300, devisLignes: 640, devisOptions: 1100, releveTva: 160 }),
    POINTS: {
      creerUnDevis: [271, 172], micro: [195, 553], jeRedige: [195, 654],
      choisirLaDate: [195, 807], leJourDuChantier: [103, 458], envoyerLeDevis: [195, 719],
      leMardi13: [60, 378], jAccepte: [195, 650],
      chantierDeJulien: [195, 330], creerLaFacture: [195, 333],
      carteDuReleve: [195, 145],
    },
    // Le cadre doré qui désigne sans toucher : [x, y, largeur, hauteur]. Ceux du
    // devis sont à l'écran défilé de `devisOptions` (page y moins 1100).
    REPERES: {
      micro: [155, 513, 80, 80],
      jeRedige: [82, 629, 226, 52],
      ajouterUneTva: [30, 181, 118, 25],
      mainDOeuvre: [30, 212, 100, 25],
      ajouterUnAcompte: [30, 408, 133, 24],
      remise: [30, 439, 60, 24],
    },
    REGARDS: Object.assign({}, B.REGARDS, {
      notification: [195, 297], ligneTva: [195, 181],
    }),
  });
})();
