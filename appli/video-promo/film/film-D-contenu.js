/*
  LE CONTENU DES FILMS D : ce qui est MONTRÉ, commun aux deux versions.

  Deux films racontent la même journée avec deux traitements (nerveux, récit),
  et un troisième, le mélange des deux, a été monté d'abord. Ce qu'ils montrent
  est identique : les mêmes captures de l'application servie, les mêmes zones
  relevées au pixel sur ces captures, les mêmes points touchés. Une zone
  mesurée trois fois finit par diverger (CLAUDE.md §3) ; elle vit ici, une fois.

  Les ZONES sont en pixels de l'IMAGE (échelle 3 pour les écrans, 300 points
  par pouce pour les PDF) ; les POINTS et les REPÈRES en pixels de l'appli
  (largeur 390). Les défilements disent où chaque longue capture est posée
  dans l'écran du téléphone pour montrer ce qu'il faut.
*/
(function () {
  'use strict';
  window.ContenuD = {
    // Les écrans, dans l'ordre du récit : tous des captures de l'application
    // servie (scripts/capturer-ecrans-du-film.mts), jamais une maquette.
    ECRANS: [
      { nom: 'accueil-avant', src: 'accueil-avant.jpg' },
      { nom: 'fiche-reconnue', src: 'fiche-reconnue.jpg' },
      { nom: 'enregistre', src: 'dictee/enregistre.jpg' },
      { nom: 'devis-redige', src: 'devis-redige-ecran.jpg' },
      { nom: 'transcription', src: 'transcription.jpg' },
      // La page publique du client n'a pas de marge sous l'encoche : descendue
      // de 60 points (95 px d'écran), la bande découverte de la couleur de la page.
      { nom: 'client-date', src: 'client-date.jpg', haut: 95, fond: '#f4f3ee' },
      { nom: 'client-accepte', src: 'client-accepte.jpg', haut: 95, fond: '#f4f3ee' },
      { nom: 'accueil', src: 'accueil.jpg' },
      { nom: 'planning', src: 'planning-jour-entier.jpg' },
      { nom: 'planning-salarie', src: 'planning-salarie.jpg' },
      { nom: 'fiche-salarie', src: 'fiche-intervention-salarie.jpg' },
      { nom: 'facture-avant', src: 'facture-avant.jpg' },
      { nom: 'facture', src: 'facture.jpg' },
      { nom: 'termines', src: 'termines-apres.jpg' },
    ],
    // La dictée : les instants (en millisecondes) des trente-six images de
    // l'onde que l'écran d'enregistrement dessine, et le texte tel que
    // l'application l'a transcrit (transcription.jpg).
    PRISES: [124, 296, 412, 518, 629, 742, 852, 965, 1087, 1203, 1328, 1454, 1568, 1709, 1839, 1950, 2065, 2168, 2297, 2437, 2550, 2652, 2776, 2884, 2998, 3122, 3241, 3346, 3486, 3607, 3720, 3840, 3952, 4066, 4185, 4298],
    DICTEE: 'Chez madame Martin, au 8 impasse du Moulin : élagage du grand chêne, une quinzaine de mètres, en taille douce.',
    // Les zones des raccords : [x, y, largeur, hauteur] dans l'image, et la
    // largeur de l'image.
    ZONES: {
      transcription: { src: 'transcription.jpg', zone: [133, 595, 900, 336], largeurSource: 1170 },
      ligneDuDevis: { src: 'devis-pdf.jpg', zone: [40, 775, 1705, 118], largeurSource: 1785 },
      notification: { src: 'accueil.jpg', zone: [72, 844, 1024, 460], largeurSource: 1170 },
      cartePlanning: { src: 'planning-jour-entier.jpg', zone: [42, 1380, 1092, 492], largeurSource: 1170 },
      ligneTva: { src: 'facture.jpg', zone: [74, 1800, 1022, 64], largeurSource: 1170 },
      tableTva: { src: 'facture-pdf.jpg', zone: [120, 1510, 740, 160], largeurSource: 2481 },
      carteTva: { src: 'termines-apres.jpg', zone: [78, 310, 1014, 252], largeurSource: 1170 },
    },
    // Les défilements, en pixels d'appli.
    DEFILEMENTS: { planning: 300, ficheAuPlanning: 98, ficheAdresse: 520, ficheTravaux: 740, factureTotaux: 440 },
    // Les points touchés, en pixels d'appli (x, y).
    POINTS: {
      creerUnDevis: [271, 172], micro: [195, 663], jeRedige: [195, 764], creerDepuisLaDictee: [195, 386],
      leMardi13: [60, 353], jAccepte: [195, 536],
      chantierDeJulien: [195, 330], creerLaFacture: [195, 333],
    },
    // Les repères (cadre doré qui désigne sans toucher) : [x, y, largeur, hauteur].
    REPERES: {
      micro: [155, 623, 80, 80],
      jeRedige: [83, 740, 224, 48],
    },
    // Où regarder, en pixels d'appli, une fois la capture défilée.
    REGARDS: {
      notification: [195, 358], cartePlanning: [196, 242],
      boutonsDeLaFiche: [195, 147], lignesDesTravaux: [195, 187],
      ligneTva: [195, 170], carteTva: [195, 145],
      transcription: [195, 255],
    },
  };
})();
