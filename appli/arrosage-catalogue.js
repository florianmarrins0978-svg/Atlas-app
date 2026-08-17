/* ═══════════════════════════════════════════════════════════════════════════
   LE CATALOGUE D'ARROSAGE — la « base de données » de l'outil.

   SA DEMANDE DU 17 AOÛT 2026 : « je vais t'envoyer des photos avec certains
   arroseurs, leur portée, et ça tu vas l'intégrer dans une base de données pour
   cet outil […] et on va également faire ça pour tout le matériel. Donc je vais
   t'envoyer à chaque fois le descriptif, la nomenclature, et toi tu vas
   l'enregistrer. »

   ─────────────────────────────────────────────────────────────────────────────
   LA RÈGLE QUI COMMANDE CE FICHIER, ET ELLE N'EST PAS NÉGOCIABLE

   Chaque entrée porte une SOURCE. Deux valeurs possibles, et une seule est
   digne de confiance :

     source: 'patron'     — relevée de SES photos, de SES devis fournisseurs.
     source: 'provisoire' — une valeur de catalogue générique, mise là pour que
                            l'outil tourne avant qu'il ait envoyé les siennes.

   L'écran AFFICHE la différence. Une valeur provisoire y est signalée, jamais
   présentée comme acquise — c'est la règle du §4 du dépôt (« ne jamais inventer
   un prix, une donnée client, une prestation ») appliquée au matériel : un
   arroseur dont on croit la portée fausse fait acheter le mauvais nombre
   d'arroseurs, et c'est le paysagiste qui revient poser les manquants.

   Le 17 août, il a dit : « plusieurs choses sont fausses ». Tout ce qui porte
   'provisoire' ci-dessous est précisément ce qu'il faut remplacer.

   ─────────────────────────────────────────────────────────────────────────────
   CE QU'IL FAUT POUR AJOUTER UN ARROSEUR (ce que ses photos doivent montrer) :

     · la MARQUE et la RÉFÉRENCE exactes (c'est ce qui part chez le fournisseur) ;
     · la PORTÉE en mètres, et à quelle PRESSION elle est donnée ;
     · le DÉBIT en m³/h ou en L/min, à cette même pression ;
     · l'ANGLE (cercle entier, réglable, secteur fixe) ;
     · si la fiche le donne : la PLUVIOMÉTRIE en mm/h.

   Portée, débit et pression vont TOUJOURS ensemble : une portée relevée à
   3 bars ne vaut rien si l'installation tourne à 2. Une entrée à qui il manque
   la pression est incomplète, et l'écran le dit plutôt que de faire semblant.

   ─────────────────────────────────────────────────────────────────────────────
   LES NOURRICES — sa deuxième demande, et elle est différente.

     « Pour réaliser une nourrice de une voie, on utilise ça, ça, ça. Toi ça tu
      vas l'enregistrer, et comme ça quand par tes calculs tu verras qu'on a
      besoin d'une voie, tu reprendras toute cette fiche. Ensuite je vais faire
      la même chose pour deux voies, trois, quatre, cinq et six voies. »

   Ce n'est pas du matériel, c'est un ASSEMBLAGE : une liste de pièces qui va
   toujours ensemble. Le calcul donne un nombre de voies, la fiche donne les
   pièces. Tant qu'une fiche n'est pas renseignée, l'outil ne devine PAS son
   contenu : il dit qu'elle manque. Une nourrice inventée, c'est un chantier
   arrêté à la pose faute d'un té.
   ═══════════════════════════════════════════════════════════════════════════ */

var CATALOGUE = {

  /* ── Les marques ────────────────────────────────────────────────────────
     Sa demande du 17 août 2026 : « de base on va mettre les arroseurs et les
     tuyères de la marque Rain Bird, mais s'il veut, il faudra créer un petit
     bandeau déroulant avec le choix de la marque Toro par exemple, et dans ce
     cas-là tu lui proposeras des arroseurs et des tuyères de la marque Toro.
     Mais de base, ça sera Rain Bird. »

     **RAIN BIRD EST LE DÉFAUT, ET AUCUN MODÈLE NE LUI EST ENCORE ATTRIBUÉ.**
     Les deux entrées ci-dessous portent la marque « générique » : ce sont des
     valeurs de catalogue courantes, et les coller sous le nom de Rain Bird
     ferait passer une supposition pour une référence — c'est précisément ce
     que ce fichier interdit. L'écran choisit donc Rain Bird, constate qu'il n'a
     rien, et le DIT en utilisant les valeurs génériques en attendant.
     `marques` s'allonge sans toucher au code : une marque de plus est une ligne. */
  marques: [
    { cle:'rainbird', nom:'Rain Bird', defaut:true },
    { cle:'toro',     nom:'Toro' },
    // Ajoutée le 17 août 2026 : il a envoyé ses photos Hunter sans qu'on la
    // lui demande — les buses SRS (Hunter, p. 9) et les corps Pro-Spray /
    // I-Spray. Une marque de plus est une ligne, comme prévu.
    { cle:'hunter',   nom:'Hunter' },
    { cle:'generique', nom:'Générique (provisoire)', cache:true }
  ],

  /* ── Les arroseurs ──────────────────────────────────────────────────────
     `portee` en mètres à `pression` bars. `debit360` en m³/h pour un cercle
     entier — un arroseur de bord n'en consomme que la moitié, un coin le quart.
     `pluvio` en mm/h : c'est elle qui donne les DURÉES, jamais la surface. */
  arroseurs: [
    { ref:'turbine-generique', marqueCle:'generique', marque:'—',
      type:'turbine', nom:'Turbine', detail:'buse 3,0',
      portee:9, pression:3, debit360:0.44, pluvio:11, famille:'Arroseurs',
      source:'provisoire' },
    { ref:'tuyere-generique', marqueCle:'generique', marque:'—',
      type:'tuyere', nom:'Tuyère', detail:'buse 12',
      portee:3.7, pression:3, debit360:0.48, pluvio:38, famille:'Arroseurs',
      source:'provisoire' }
  ],

  /* ── LES BUSES — relevées de SES photos de catalogue ────────────────────
     Sa première page, le 17 août 2026 : catalogue Aqua Plus 2026, page 8,
     « ARROSEURS ESCAMOTABLES », buses série VAN à secteur réglable (RBT6xx).

     **Ses mots :** « ça c'est les buses qui vont venir se visser sur les
     tuyères. Donc là tu as toutes les buses avec les distances, les pressions,
     tout. »

     ┌────────────────────────────────────────────────────────────────────────┐
     │ CE QUE CETTE PAGE CHANGE DANS LE CALCUL, ET CE N'EST PAS UN DÉTAIL     │
     │                                                                        │
     │ 1. UN ARROSEUR, C'EST UN CORPS + UNE BUSE. La portée et le débit       │
     │    viennent de la BUSE, pas du corps. Les corps escamotables sont      │
     │    encore à recevoir (`corps` ci-dessous, vide).                       │
     │                                                                        │
     │ 2. LE DÉBIT EST DONNÉ PAR ANGLE, et il ne se calcule PAS en divisant   │
     │    le débit du cercle entier. C'est ce que faisait l'outil jusqu'ici.  │
     │    Sur les grosses buses la division tombe juste (18-VAN : 1,20 / 4 =  │
     │    0,30, exactement la valeur du tableau) ; sur les petites, non —     │
     │    la 6-VAN donne 0,27 à 360° quand quatre fois son 90° ferait 0,32.   │
     │    Les valeurs du tableau sont donc lues, jamais déduites.             │
     │                                                                        │
     │ 3. LA PRESSION DE RÉFÉRENCE EST 2 BAR, pas 3. Une portée relevée à     │
     │    2 bars sur une installation à 3 n'est pas la même — l'écran le dit  │
     │    quand les deux diffèrent.                                           │
     │                                                                        │
     │ 4. LE COLISAGE EST DE 25. Il commande par paquets ; la liste au        │
     │    fournisseur doit le rappeler plutôt que de lui faire découvrir à la │
     │    commande.                                                           │
     └────────────────────────────────────────────────────────────────────────┘

     **LES PRIX NE SONT PAS ICI, ET C'EST SA CONSIGNE :** « sur certaines photos
     tu auras les prix, néanmoins ne les enregistre pas, car c'est des prix pour
     les clients et pas pour les pros. » Un P.U.H.T. figurait sur la page ; il n'est
     recopié nulle part, pas même en commentaire — un prix « pour mémoire » finit
     par être lu comme un prix. Ses prix à lui se saisissent
     dans `arrosage-tarifs.html`, et vivent dans son navigateur.

     **UNE VALEUR À CONFIRMER, et elle n'est pas recopiée à l'aveugle :** la
     8-VAN annonce 0,16 m³/h à 90°, soit PLUS que la 10-VAN (0,14) qui porte
     pourtant plus loin. Recopié tel quel du tableau, signalé ici, à vérifier
     sur le catalogue papier. Un chiffre douteux qu'on tait devient un chiffre
     faux qu'on croit. */
  buses: [
    { ref:'RBT648', nom:'18-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:5.4, pression:2,
      debit:{ 90:0.30, 180:0.60, 270:0.90, 360:1.20 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT601', nom:'15-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.5, pression:2,
      debit:{ 90:0.21, 180:0.42, 270:0.63, 360:0.84 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT636', nom:'12-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:3.6, pression:2,
      debit:{ 90:0.15, 180:0.30, 270:0.45, 360:0.59 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT637', nom:'10-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:2.7, pression:2,
      debit:{ 90:0.14, 180:0.29, 270:0.43, 360:0.57 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT638', nom:'8-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:2.3, pression:2,
      debit:{ 90:0.16, 180:0.26, 270:0.34, 360:0.38 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      aVerifier:'0,16 m³/h à 90° : plus que la 10-VAN, qui porte pourtant plus loin' },
    { ref:'RBT639', nom:'6-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:1.8, pression:2,
      debit:{ 90:0.08, 180:0.13, 270:0.24, 360:0.27 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT640', nom:'4-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:1.2, pression:2,
      debit:{ 90:0.06, 180:0.10, 270:0.16, 360:0.20 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },

    /* ── LES BUSES HUNTER SRS — sa deuxième page, le 17 août 2026 ───────────
       Même forme que les VAN : UNE référence couvre tous les angles, donnée
       « à 2,1 bars ». Il donne aussi le 120°, que le calcul n'utilise pas
       encore (seuls 90°/180°/360° comptent pour les coins, bords, intérieurs) —
       gardé quand même, une donnée relevée ne se jette pas. */
    { ref:'HBT1559', nom:'SRS 7A', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:2.1, pression:2.1,
      debit:{ 90:0.11, 120:0.15, 180:0.22, 270:0.33, 360:0.44 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HBT1560', nom:'SRS 10A', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:3.0, pression:2.1,
      debit:{ 90:0.11, 120:0.15, 180:0.22, 270:0.33, 360:0.44 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HBT1561', nom:'SRS 12A', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:3.7, pression:2.1,
      debit:{ 90:0.16, 120:0.22, 180:0.33, 270:0.49, 360:0.65 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HBT1562', nom:'SRS 15A', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.6, pression:2.1,
      debit:{ 90:0.21, 120:0.28, 180:0.42, 270:0.63, 360:0.84 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HBT1563', nom:'SRS 17A', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:5.5, pression:2.1,
      debit:{ 90:0.27, 120:0.36, 180:0.55, 270:0.82, 360:1.09 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9' },

    /* ── LES BUSES R-VAN — sa troisième page, et une structure DIFFÉRENTE ───
       Contrairement aux VAN : CHAQUE PORTÉE SE VEND EN DEUX RÉFÉRENCES
       SÉPARÉES — une réglable de 45° à 270° (jamais 360°), une fixe à 360°
       (jamais autre chose). Le tableau le montre par ses « X » : la ligne
       « Débit à 360° » est vide pour la réglable, les lignes 90°/180° sont
       vides pour la fixe.

       **CE QUE ÇA CHANGE, ET QUE LA QUESTION POSÉE PLUS BAS DEMANDE À
       CONFIRMER :** une buse qui n'a QUE le 360° ne peut physiquement pas se
       poser dans un coin ou sur un bord (elle arroserait le trottoir du
       voisin) — il y faut sa jumelle réglable. `busesDe()` retient donc
       seulement les entrées qui couvrent 90° ET 180° pour les coins/bords : la
       360°-seule reste au catalogue, visible dans son registre de prix, mais
       n'est pas encore choisie automatiquement par le calcul. RIEN N'EST
       DÉDUIT pour combler le manque — c'est sa règle du 17 août. */
    { ref:'RBT1418', nom:'14 R-VAN réglable', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.0, pression:2.4,
      debit:{ 90:0.066, 180:0.132 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      aVerifier:'270° absent du relevé — seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1419', nom:'14 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.0, pression:2.4,
      debit:{ 360:0.264 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      pairAvec:'RBT1418' },
    { ref:'RBT1428', nom:'18 R-VAN réglable', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.9, pression:2.4,
      debit:{ 90:0.106, 180:0.206 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      aVerifier:'270° absent du relevé — seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1429', nom:'18 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.9, pression:2.4,
      debit:{ 360:0.412 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      pairAvec:'RBT1428' },
    { ref:'RBT1438', nom:'24 R-VAN réglable', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:6.1, pression:2.4,
      debit:{ 90:0.148, 180:0.295 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      aVerifier:'270° absent du relevé — seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1439', nom:'24 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:6.1, pression:2.4,
      debit:{ 360:0.590 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 9 bis',
      pairAvec:'RBT1438' }
  ],

  /* ── LES BUSES « BANDE » (strip) — vues, pas enregistrées comme poseables.
     RBT1400/-D/-G (Rain Bird), HBT1567/1568/1569 (Hunter SS-530, RCS-515,
     LCS-515) : leur zone n'est pas un cercle mais un rectangle
     (« 1,5 × 9,1 m »). Tout le calcul de cette page — portée, coins, bords —
     suppose des couronnes circulaires. Les compter comme une buse ronde
     donnerait une couverture fausse. Elles attendent une question à part :
     le paillage/bordures en jet plat n'est pas encore un cas du calculateur. */

  /* ── LES BUSES MP ROTATOR — vues, pas enregistrées : AUCUNE portée/débit
     n'était lisible sur la photo (juste réf et prix). NA23xx (filetage mâle,
     universel Rain Bird/Hunter/Nelson) et TBT10xxx-1xxx (filetage femelle,
     Toro). Sans rayon ni débit, une entrée ne calculerait rien de juste —
     mieux vaut les demander à part que deviner. */

  /* ── Les corps d'arroseur ───────────────────────────────────────────────
     VIDE : la page reçue donne les BUSES, pas les corps escamotables sur
     lesquels elles se vissent. Ils viendront. Tant qu'ils manquent, la liste au
     fournisseur commande des buses et le DIT — commander une buse sans son
     corps, c'est un chantier arrêté à la pose. */
  /* ── LES CORPS — arrivés le 17 août 2026, série 1800 (Rain Bird) et
     Pro-Spray / I-Spray (Hunter). « Livrée sans buse » : c'est exactement le
     corps qui manquait pour poser les buses ci-dessus.

     `hauteur` = la hauteur d'escamotage en cm (5/10/15/30 selon la gamme).
     `options` : SAM = clapet anti-vidange (évite les fuites en point bas
     après l'arrêt), PRS = régulateur de pression intégré, pré-réglé.

     **CE QUI N'EST PAS TRANCHÉ, et l'écran ne choisit rien à sa place :**
     quatre hauteurs, trois niveaux d'option — c'est un choix de chantier
     (terrain plat ou en pente, herbe haute ou tondue ras), pas une valeur que
     l'outil peut deviner. Tant qu'il n'a pas dit lequel prendre par défaut,
     aucun corps n'est choisi automatiquement dans la liste au fournisseur. */
  corps: [
    { ref:'RT1802', nom:'Corps 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:5, options:[], detail:'escamotable 5 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1804', nom:'Corps 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:10, options:[], detail:'escamotable 10 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1806', nom:'Corps 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:15, options:[], detail:'escamotable 15 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1812', nom:'Corps 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:30, options:[], detail:'escamotable 30 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1824', nom:'Corps 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:10, options:['clapet anti-vidange'], detail:'escamotable 10 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1826', nom:'Corps 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:15, options:['clapet anti-vidange'], detail:'escamotable 15 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1822', nom:'Corps 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:30, options:['clapet anti-vidange'], detail:'escamotable 30 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1834', nom:'Corps 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:10, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 10 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1836', nom:'Corps 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:15, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 15 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1832', nom:'Corps 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      hauteur:30, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 30 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'HT1541', nom:'Corps Pro-Spray-02', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:5, options:[], detail:'escamotable 5 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1543', nom:'Corps Pro-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:10, options:[], detail:'escamotable 10 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1544', nom:'Corps Pro-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:15, options:[], detail:'escamotable 15 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1546', nom:'Corps Pro-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:30, options:[], detail:'escamotable 30 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1521', nom:'Corps I-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:10, options:['régulateur de pression'], detail:'escamotable 10 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1522', nom:'Corps I-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:15, options:['régulateur de pression'], detail:'escamotable 15 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1523', nom:'Corps I-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      hauteur:30, options:['régulateur de pression'], detail:'escamotable 30 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' }
  ],

  /* ── Le goutte-à-goutte ─────────────────────────────────────────────────
     `debitMetre` en m³/h par mètre de gaine. */
  gaines: [
    { ref:'gaine-generique', marqueCle:'generique', marque:'—', type:'gaine',
      nom:'Gaine de goutteurs',
      detail:'2,3 L/h tous les 33 cm', debitMetre:0.007, pluvio:23,
      famille:'Goutte-à-goutte', source:'provisoire' }
  ],

  /* ── Le reste du matériel ───────────────────────────────────────────────
     Ce qui ne s'arrose pas mais qu'il faut acheter. `parSecteur` : une pièce
     par secteur. `parArroseur` : une par arroseur. `fixe` : une par chantier.
     `aMesurer` : la quantité ne se déduit pas, elle se relève sur le terrain. */
  materiel: [
    // **La marque vaut pour elle aussi** — sa réponse du 17 août : « ça sera
    // valable aussi pour les électrovannes, pour le reste non. » Le jour où ses
    // références arriveront, cette ligne se dédoublera par marque.
    { ref:'electrovanne', nom:'Électrovanne 24 V', regle:'parSecteur',
      suitLaMarque:true, source:'provisoire' },
    { ref:'crosse', nom:'Crosse de raccordement', regle:'parArroseur', source:'provisoire' },
    { ref:'regard', nom:'Regard de vannes', regle:'parTroisSecteurs', source:'provisoire' },
    { ref:'disconnecteur', nom:'Disconnecteur (obligatoire sur l\'eau potable)', regle:'fixe', source:'provisoire' },
    { ref:'reducteur', nom:'Réducteur de pression', regle:'fixe', source:'provisoire' },
    { ref:'sonde-pluie', nom:'Sonde de pluie', regle:'option', source:'provisoire' },
    { ref:'pe32', nom:'Tuyau PE 32 (ligne principale)', regle:'aMesurer', unite:'ml', source:'provisoire' },
    { ref:'pe25', nom:'Tuyau PE 25 (antennes)', regle:'aMesurer', unite:'ml', source:'provisoire' }
  ],

  /* ── Les nourrices, par nombre de voies ─────────────────────────────────
     VIDE, ET C'EST VOULU : il les envoie une par une. Tant qu'une fiche manque,
     l'écran le DIT au lieu de composer une nourrice de son cru.

     **AUCUN PLAFOND À SIX VOIES** — sa réponse du 17 août 2026 : « oui tu peux
     prévoir au-delà de 6 ». La table est donc un dictionnaire ouvert, pas une
     liste de six cases : `nourrices[12]` se pose exactement comme
     `nourrices[1]`, sans rien changer au code. Le calcul, lui, monte facilement
     à neuf ou douze voies sur un jardin ordinaire.

     Forme attendue, quand elles arriveront :

       1: { nom:'Nourrice 1 voie', source:'patron', date:'2026-08-…',
            pieces:[ { q:1, u:'u', nom:'…' }, … ] },

     **CE QUI N'EST PAS TRANCHÉ, et qui ne sera PAS supposé** : au-delà d'une
     certaine taille, pose-t-il UNE nourrice de douze voies, ou DEUX de six ?
     Les deux se font. Composer une nourrice de douze en doublant celle de six
     serait exactement l'invention que ce fichier interdit — l'écran demande
     donc la fiche, et attend.
  */
  nourrices: {}
};

/* Ce que l'écran doit savoir dire, et qui se compte ici plutôt qu'à trois
   endroits : combien de valeurs attendent encore ses données. */
/* Les arroseurs d'une marque, par type. Rend un tableau VIDE quand la marque
   n'a rien : c'est à l'écran de le dire, pas à ce fichier de le masquer par un
   repli silencieux — un repli muet ferait croire que Rain Bird est renseigné. */
CATALOGUE.arroseursDe = function (marqueCle, type) {
  return CATALOGUE.arroseurs.filter(function (a) {
    return a.marqueCle === marqueCle && (!type || a.type === type);
  });
};

/* Les buses d'une marque pour un type d'arroseur, de la plus grande portée à
   la plus petite : c'est dans cet ordre qu'on cherche celle qui tient. */
CATALOGUE.busesDe = function (marqueCle, pourType) {
  return CATALOGUE.buses
    .filter(function (b) {
      if (b.marqueCle !== marqueCle || b.pourType !== pourType) return false;
      // **Une pose complète a besoin des TROIS angles.** Coins (1/4 de tour,
      // 90°), bords (1/2 tour, 180°) ET intérieur (tour complet, 360°) — la
      // pluviométrie elle-même se déduit du 360°. Une buse qui n'en a que
      // deux — les R-VAN, vendues en DEUX références séparées : une réglable
      // 45°-270° (jamais 360°), une fixe 360° (jamais autre chose) — ne peut
      // pas, SEULE, couvrir une pose entière. Sa jumelle existe (`pairAvec`),
      // mais tant que le pavage à deux références n'est pas construit, aucune
      // des deux n'est choisie automatiquement : posée seule, l'une manquerait
      // les coins et les bords, l'autre l'intérieur. Toutes deux restent
      // visibles dans son registre de prix (`tousLesProduits`, qui ne filtre
      // rien) — seul le CALCUL les met de côté.
      return b.debit[90] != null && b.debit[180] != null && b.debit[360] != null;
    })
    .sort(function (a, b) { return b.rayon - a.rayon; });
};

/* Tout ce qui peut porter un prix, à un seul endroit : c'est la liste qu'il
   remplira dans son registre, et elle ne doit pas se tenir à deux endroits. */
CATALOGUE.tousLesProduits = function () {
  var out = [];
  CATALOGUE.buses.forEach(function (b) {
    out.push({ ref:b.ref, nom:'Buse ' + b.nom + ' — ' + (b.marque || 'Rain Bird'),
               detail:'rayon ' + String(b.rayon).replace('.', ',') + ' m à ' +
                      String(b.pression).replace('.', ',') + ' bar · par ' + b.colisage,
               famille:'Buses' });
  });
  CATALOGUE.corps.forEach(function (c) {
    out.push({ ref:c.ref, nom:c.nom, detail:c.detail || '', famille:'Corps d\'arroseur' });
  });
  CATALOGUE.gaines.forEach(function (g) {
    out.push({ ref:g.ref, nom:g.nom, detail:g.detail, famille:'Goutte-à-goutte' });
  });
  CATALOGUE.materiel.forEach(function (m) {
    out.push({ ref:m.ref, nom:m.nom, detail:m.unite === 'ml' ? 'au mètre' : '', famille:'Matériel' });
  });
  return out;
};

CATALOGUE.marqueParDefaut = function () {
  var d = CATALOGUE.marques.filter(function (m) { return m.defaut; })[0];
  return d ? d.cle : CATALOGUE.marques[0].cle;
};

CATALOGUE.provisoires = function () {
  var n = 0;
  ['arroseurs','gaines','materiel'].forEach(function (famille) {
    CATALOGUE[famille].forEach(function (x) { if (x.source === 'provisoire') n++; });
  });
  return n;
};
