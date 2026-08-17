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
      pairAvec:'RBT1438' },

    /* ── LES BUSES DE TURBINE — cinquième page, le 17 août 2026 ─────────────
       Six familles (Hunter PGP-ADJ, PGP Ultra, I 20-04 ; Rain Bird 5000 Plus,
       3504 ; Hunter SRM-04, PGJ ; Toro Mini 8). PARTOUT LE MÊME TROU : une
       seule valeur de débit par numéro de buse, à une pression de référence —
       AUCUNE répartition par angle, contrairement aux tuyères VAN/SRS/R-VAN.

       **CE QUI N'EST PAS TRANCHÉ, et ne se devine pas :** sur une turbine, le
       jet est UN SEUL filet qui balaie l'arc réglé — contrairement à une buse
       VAN qui projette plusieurs filets simultanés. Le débit d'une turbine
       est peut-être exactement proportionnel à l'arc (un filet qui balaie
       deux fois moins d'angle consomme deux fois moins d'eau), ce qui
       justifierait de déduire coins/bords depuis ce seul chiffre — mais c'est
       précisément le genre de déduction que sa règle du 17 août interdit tant
       qu'elle n'est pas confirmée : « les valeurs sont lues, jamais déduites »
       a été vérifié FAUX sur les buses VAN (la 6-VAN n'est pas proportionnelle).

       Le débit est donc entré en `debit:{360: …}` SEULEMENT — jamais 90/180 —
       et `busesDe()` (plus haut) exige les trois angles pour poser une buse
       automatiquement : ces turbines restent donc VISIBLES au registre de
       prix, mais ÉCARTÉES du calcul tant que la question n'a pas sa réponse. */
    { ref:'HA2211-B1', nom:'PGP-ADJ · buse 1 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.8, pression:2.8, debit:{ 360:0.14 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B2', nom:'PGP-ADJ · buse 2 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.1, pression:2.8, debit:{ 360:0.18 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B3', nom:'PGP-ADJ · buse 3 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.8, debit:{ 360:0.23 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B4', nom:'PGP-ADJ · buse 4 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.8, debit:{ 360:0.32 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B5', nom:'PGP-ADJ · buse 5 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.0, pression:2.8, debit:{ 360:0.41 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B6', nom:'PGP-ADJ · buse 6 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.6, pression:2.8, debit:{ 360:0.55 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B7', nom:'PGP-ADJ · buse 7 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.2, pression:2.8, debit:{ 360:0.68 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },

    { ref:'HA2210-B1.5', nom:'PGP Ultra · buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.8, pression:3, debit:{ 360:0.35 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B2', nom:'PGP Ultra · buse 2', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.4, pression:3, debit:{ 360:0.43 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B3', nom:'PGP Ultra · buse 3', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.6, pression:3, debit:{ 360:0.68 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B4', nom:'PGP Ultra · buse 4', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.2, pression:3, debit:{ 360:0.90 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B5', nom:'PGP Ultra · buse 5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.8, pression:3, debit:{ 360:1.14 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B6', nom:'PGP Ultra · buse 6', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.10, pression:3, debit:{ 360:1.36 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B8', nom:'PGP Ultra · buse 8', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.4, pression:3, debit:{ 360:1.81 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 13' },

    { ref:'RBA2195', nom:'5000 Plus MPR 7,62 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.62, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13 bis',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },
    { ref:'RBA2196', nom:'5000 Plus MPR 9,14 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.14, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13 bis',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },
    { ref:'RBA2197', nom:'5000 Plus MPR 10,67 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.67, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13 bis',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },

    { ref:'RA5004-B1u', nom:'5000 Plus · buse 1,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.5, pression:2.5, debit:{ 360:0.22 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B15u', nom:'5000 Plus · buse 1,5 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.5, debit:{ 360:0.28 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B2u', nom:'5000 Plus · buse 2,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.8, pression:2.5, debit:{ 360:0.45 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B3u', nom:'5000 Plus · buse 3,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.1, pression:2.5, debit:{ 360:0.71 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B15p', nom:'5000 Plus · buse 1,5 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.5, debit:{ 360:0.39 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B3p', nom:'5000 Plus · buse 3,0 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.20, pression:2.5, debit:{ 360:0.92 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004-B6p', nom:'5000 Plus · buse 6,0 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.70, pression:2.5, debit:{ 360:0.92 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 13 bis',
      aVerifier:'débit identique à la buse 3,0 Portée+ (0,92) — recopié tel quel de la photo, à confirmer' },

    { ref:'TAMINI8-B075', nom:'Mini 8 · buse 0,75', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.0, pression:2.5, debit:{ 360:0.20 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B1', nom:'Mini 8 · buse 1,0', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.9, pression:2.5, debit:{ 360:0.28 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B15', nom:'Mini 8 · buse 1,5', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.3, pression:2.5, debit:{ 360:0.30 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B2', nom:'Mini 8 · buse 2,0', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.3, pression:2.5, debit:{ 360:0.36 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'RA3504-B075', nom:'3504 · buse 0,75', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.2, pression:2.5, debit:{ 360:0.16 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B1', nom:'3504 · buse 1,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.4, pression:2.5, debit:{ 360:0.21 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B15', nom:'3504 · buse 1,5', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.0, pression:2.5, debit:{ 360:0.30 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B2', nom:'3504 · buse 2,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.2, pression:2.5, debit:{ 360:0.39 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B3', nom:'3504 · buse 3,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.5, debit:{ 360:0.60 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B4', nom:'3504 · buse 4,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.5, debit:{ 360:0.83 },
      colisage:20, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'HA2264-B050', nom:'SRM-04 · buse 0,50', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:4.9, pression:2.8, debit:{ 360:0.11 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B075', nom:'SRM-04 · buse 0,75', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.5, pression:2.8, debit:{ 360:0.17 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B1', nom:'SRM-04 · buse 1,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.1, pression:2.8, debit:{ 360:0.23 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B15', nom:'SRM-04 · buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.3, pression:2.8, debit:{ 360:0.34 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B2', nom:'SRM-04 · buse 2,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.90, pression:2.8, debit:{ 360:0.45 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B3', nom:'SRM-04 · buse 3,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.1, pression:2.8, debit:{ 360:0.68 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'HA2274-B075', nom:'PGJ · buse 0,75', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:4.9, pression:2.8, debit:{ 360:0.17 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B1', nom:'PGJ · buse 1,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.8, pression:2.8, debit:{ 360:0.23 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B15', nom:'PGJ · buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.7, pression:2.8, debit:{ 360:0.34 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B2', nom:'PGJ · buse 2,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.6, pression:2.8, debit:{ 360:0.45 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B25', nom:'PGJ · buse 2,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.50, pression:2.8, debit:{ 360:0.57 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B3', nom:'PGJ · buse 3,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.8, debit:{ 360:0.68 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 11' }
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
    { ref:'RT1802', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:5, options:[], detail:'escamotable 5 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1804', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:[], detail:'escamotable 10 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1806', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:[], detail:'escamotable 15 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1812', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:[], detail:'escamotable 30 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1824', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['clapet anti-vidange'], detail:'escamotable 10 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1826', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['clapet anti-vidange'], detail:'escamotable 15 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1822', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['clapet anti-vidange'], detail:'escamotable 30 cm · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1834', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 10 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1836', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 15 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RT1832', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 30 cm · SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'HT1541', nom:'Tuyère Pro-Spray-02', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:5, options:[], detail:'escamotable 5 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1543', nom:'Tuyère Pro-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:[], detail:'escamotable 10 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1544', nom:'Tuyère Pro-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:[], detail:'escamotable 15 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1546', nom:'Tuyère Pro-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:[], detail:'escamotable 30 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1521', nom:'Tuyère I-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['régulateur de pression'], detail:'escamotable 10 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1522', nom:'Tuyère I-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['régulateur de pression'], detail:'escamotable 15 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1523', nom:'Tuyère I-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['régulateur de pression'], detail:'escamotable 30 cm · régulateur',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },

    /* ── LES CORPS DE TURBINE — quatrième page, le 17 août 2026 ────────────
       `pourType:'turbine'` : une famille à part des corps de tuyères
       ci-dessus. Un jour où les turbines seront posées automatiquement, le
       sélecteur de corps devra distinguer les deux — pour l'instant seuls
       les corps `tuyere` sont câblés dans la liste au fournisseur. */
    { ref:'HA2211', nom:'Turbine PGP-ADJ', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable 40°-360°'],
      detail:'escamotable 10 cm · secteur réglable 40°-360°, livré avec 12 buses',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210', nom:'Turbine PGP Ultra', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable et plein cercle'],
      detail:'escamotable 10 cm · réglable ET plein cercle (modèle unique), livré avec 8 buses',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2222', nom:'Turbine I 20-04 Ultra', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['FloStop'],
      detail:'escamotable, réglage par clé 40°-360°, coupure FloStop à la clé, livré avec 12 buses dont 4 angle bas',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2225', nom:'Turbine I 20-04 Ultra SS Inox', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['FloStop','tige inox'],
      detail:'comme I 20-04 Ultra, tige escamotable en acier inox',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA2181', nom:'Turbine 5004 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable'],
      detail:'escamotable 10 cm · secteur réglable, fermeture de débit sur l\'arroseur',
      source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5004FC', nom:'Turbine 5004 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['plein cercle'],
      detail:'escamotable 10 cm · plein cercle',
      source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5006PC', nom:'Turbine 5006 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:15, options:['réglable'],
      detail:'escamotable 15 cm · secteur réglable',
      source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA5012PCSAM', nom:'Turbine 5012 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:30, options:['réglable','clapet anti-vidange'],
      detail:'escamotable 30 cm · secteur réglable · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'RA2180', nom:'Turbine 5004 Plus SS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable','clapet anti-vidange','tige inox'],
      detail:'tige escamotable inox · secteur réglable · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 13 bis' },
    { ref:'TAMINI8-4P', nom:'Turbine Mini 8', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:9.5, options:['faible consommation'],
      detail:'escamotable 9,5 cm · réglage sur le dessus, 5 buses interchangeables',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504', nom:'Turbine 3504', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable'],
      detail:'un seul modèle réglable 40°-360°, livré avec 6 buses',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504SAM', nom:'Turbine 3504 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable','clapet anti-vidange'],
      detail:'comme 3504 · SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264', nom:'Turbine SRM-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable et plein cercle'],
      detail:'faible débit, un seul modèle réglable et plein cercle',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274', nom:'Turbine PGJ-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:10, options:['réglable et plein cercle'],
      detail:'faible débit, escamotable 10 cm, réglable et plein cercle',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2272', nom:'Turbine PGJ-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:30, options:['réglable et plein cercle'],
      detail:'faible débit, escamotable 30 cm, réglable et plein cercle',
      source:'patron', releve:'Aqua Plus 2026, p. 11' }
  ],

  /* ── LES COUDES SBE — sixième page, le 17 août 2026 ─────────────────────
     « Sous les arroseurs il faut obligatoirement des coudes SBE, choisis-les
     en fonction des diamètres, un à chaque fois par arroseur. »

     Tube 16 mm (le tuyau souple qui descend du réseau enterré au corps) vers
     le taraudage du corps : 1/2" ou 3/4" selon la famille. Un coude, jamais un
     droit — c'est le nom de la pièce sur la photo (« coudé »), et il absorbe
     le fait que le tube arrive de côté quand le corps est vertical. */
  coudes: [
    { ref:'OD501', nom:'Coude SBE 050', marqueCle:'generique', fournisseur:'Aqua Plus',
      filetage:'1/2', detail:'16 x 1/2" coudé', source:'patron', releve:'Aqua Plus 2026' },
    { ref:'OD502', nom:'Coude SBE 075', marqueCle:'generique', fournisseur:'Aqua Plus',
      filetage:'3/4', detail:'16 x 3/4" coudé', source:'patron', releve:'Aqua Plus 2026' }
  ],

  /* ── LE RÉSEAU LATÉRAL — sa planche manuscrite du 17 août 2026, deux pages.
     Comment le PE25 relie les arroseurs D'UN MÊME SECTEUR entre eux, depuis
     le regard : ce qu'aucune donnée reçue jusqu'ici ne couvrait — tout portait
     sur UN arroseur (buse, corps, coude), rien sur la LIGNE qui les relie.

     Trois positions le long d'une ligne, sa règle mot pour mot :

       · DÉPART  — Té 90° taraudé 25×3/4"×25 : la ligne continue en 25, une
         sortie 3/4" monte vers l'arroseur.
       · MILIEU  — « exactement la même chose » que le départ. Même té : la
         ligne entre, continue, ET une sortie 3/4" alimente l'arroseur.
       · FIN     — Coude taraudé 25×3/4" : rien ne continue après, donc un
         coude plutôt qu'un té.

     Et une quatrième pièce, PAS un point d'arrosage : JONCTION — Té 90°
     25×25×25 (aucun taraudage), pour un coude de tuyauterie qui ne nourrit
     rien à cet endroit précis.

     **À chaque position d'arrosage (départ, milieu ou fin) :** 1 SBE 3/4"
     (le raccord du bas, sur le té ou le coude — TOUJOURS 3/4", quel que soit
     le corps) + environ 2 m de PEBD rigide Ø16 + l'arroseur complet (corps +
     SON PROPRE SBE, au diamètre du corps cette fois — 1/2" ou 3/4" selon la
     famille, voir `CATALOGUE.corps` — + la buse). Sa phrase : « peu importe
     que ce soit arroseur ou tuyère » — la règle ne distingue pas les deux.

     **DEUX SBE PAR ARROSEUR, PAS UN : celui du bas (toujours 3/4", sur la
     tuyauterie) et celui du haut (au diamètre du corps).** C'était manquant
     dans la liste au fournisseur jusqu'ici — un seul SBE y était compté par
     arroseur, celui du haut.

     **CE QUI N'EST PAS ENCORE CALCULÉ, et ne doit pas être deviné :** combien
     de départs, de milieux, de fins pour UN secteur donné dépend de l'ORDRE
     dans lequel le tuyau visite les arroseurs — une question de tracé, pas de
     position. `pointsDeLaPose` sait où les arroseurs sont, pas dans quel ordre
     un tuyau les relierait. Tant que ce tracé n'est pas donné, ces pièces
     restent au catalogue, VISIBLES au registre de prix, mais ne comptent pas
     encore dans la liste au fournisseur — comme les R-VAN et les turbines
     avant elles. */
  piecesReseau: {
    'te-taraude-25-34-25': { nom:'Té 90° taraudé 25×3/4"×25', marque:'Dura' },
    'coude-taraude-25-34': { nom:'Coude 90° taraudé 25×3/4"', marque:'Dura' },
    'te-25-25-25':         { nom:'Té 90° 25×25×25 (jonction, non taraudé)', marque:'Dura' },
    'pebd16':              { nom:'PEBD rigide Ø16 (tube de reprise)', marque:'Dura', unite:'ml' }
  },

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
    // « crosse » générique retirée le 17 août : remplacée par les coudes SBE
    // réels, choisis selon le taraudage du corps (voir CATALOGUE.coudes).
    { ref:'regard', nom:'Regard de vannes', regle:'parTroisSecteurs', source:'provisoire' },
    { ref:'disconnecteur', nom:'Disconnecteur (obligatoire sur l\'eau potable)', regle:'fixe', source:'provisoire' },
    { ref:'reducteur', nom:'Réducteur de pression', regle:'fixe', source:'provisoire' },
    { ref:'sonde-pluie', nom:'Sonde de pluie', regle:'option', source:'provisoire' },
    { ref:'pe32', nom:'Tuyau PE 32 (ligne principale)', regle:'aMesurer', unite:'ml', source:'provisoire' },
    { ref:'pe25', nom:'Tuyau PE 25 (antennes)', regle:'aMesurer', unite:'ml', source:'provisoire' }
  ],

  /* ── LES PIÈCES DE NOURRICE — un catalogue à part, référencé par les fiches
     ci-dessous. Chaque pièce n'est écrite QU'UNE FOIS ici, même si elle
     revient dans les six fiches (l'électrovanne, par exemple, est dans les
     six) : la retaper à chaque fois aurait fini par diverger — un accent, un
     chiffre — et l'écart se serait vu exactement là où il compare deux
     fiches. Reçues le 17 août 2026 : « voici toutes les pièces pour la
     nourrice, ce qui se trouve dans le regard d'arrosage. » */
  piecesNourrice: {
    'coude-mf':      { nom:'Coude 90° taraudé/fileté MF 1"', marque:'Dura' },
    'coude-mm':      { nom:'Coude 90° taraudé MM 1"', marque:'Dura' },
    'mamelon':       { nom:'Mamelon réduit fileté MM 1"-3/4"', marque:'Dura' },
    'union':         { nom:'Union droite taraudée MM 1"', marque:'Dura' },
    'vanne-purge':   { nom:'Vanne avec vis de purge 3/4"', marque:'Dura' },
    'electrovanne-100dv': { nom:'Électrovanne 100 DV 1" MM 9V', marque:'Rain Bird' },
    'raccord-male25':{ nom:'Raccord mâle 25 1"', marque:'Dura' },
    'regard-rect12': { nom:'Regard rectangle 12"', marque:'Dura' },
    'regard-rg17106':{ nom:'Regard jumbo RG17106', marque:'Dura' },
    'regard-jumbo5': { nom:'Regard jumbo 5 voies', marque:'Dura' },
    'regard-jumbo6': { nom:'Regard jumbo 6 voies', marque:'Dura' },
    'te-mmf':        { nom:'Té taraudé/fileté 1" MMF', marque:'Dura' },
    'clarinette-2v': { nom:'Clarinette taraudée 1" — 2 vannes', marque:'Dura' },
    'clarinette-3v': { nom:'Clarinette taraudée 1" — 3 vannes', marque:'Dura' },
    'clarinette-4v': { nom:'Clarinette taraudée 1" — 4 vannes', marque:'Dura' },
    'prog-1':        { nom:'Programmateur BL-IP 1 station 9V' },
    'prog-2':        { nom:'Programmateur BL-IP 2 stations 9V' },
    'prog-4':        { nom:'Programmateur BL-IP 4 stations 9V' },
    'prog-6':        { nom:'Programmateur BL-IP 6 stations 9V' },
    'pile-9v':       { nom:'Pile alcaline 9V' },
    'connexion':     { nom:'Connexion étanche' },

    /* ── Modification GOUTTE-À-GOUTTE — reçue le 17 août 2026 ───────────────
       « Lorsqu'un réseau est pour du goutte-à-goutte, quelques modifications
       s'appliquent : régulateur de pression FF 3/4", électrovanne 100-DV 1"
       FF (au lieu de MM), 2 mamelons réduits en plus, 1 mamelon droit. »
       Ces pièces ne remplacent PAS une fiche entière : elles s'appliquent
       PAR VOIE, à celles qui alimentent une zone goutte-à-goutte. Voir
       `CATALOGUE.ficheNourrice`, plus bas, qui fait ce mélange. */
    'regulateur-ff34':      { nom:'Régulateur de pression FF 3/4"', marque:'Dura' },
    'electrovanne-100dv-ff':{ nom:'Électrovanne 100 DV 1" FF 9V', marque:'Rain Bird' },
    'mamelon-droit-1':      { nom:'Mamelon fileté MM 1"', marque:'Dura' }
  },

  /* ── Les nourrices, par nombre de voies — reçues le 17 août 2026 ─────────
     « Ce qui se trouve dans le regard d'arrosage » : une fiche = un regard.
     De une à six voies, relevées mot pour mot, transcrites sans un prix.

     **AUCUN PLAFOND À SIX VOIES** — sa réponse du 17 août : « oui tu peux
     prévoir au-delà de 6 ». `nourrices[12]` se poserait comme `nourrices[1]`,
     sans rien changer au code, le jour où il l'enverra.

     **CE QUI N'EST PAS TRANCHÉ, et qui ne sera PAS supposé** : au-delà d'une
     certaine taille, pose-t-il UNE nourrice de douze voies, ou DEUX de six ?
     Les deux se font. Composer une nourrice de douze en doublant celle de six
     serait exactement l'invention que ce fichier interdit — l'écran demande
     donc la fiche, et attend.

     **CE QUI N'EST PAS DANS SES FICHES, et qui ne doit pas s'y ajouter en
     silence** : ni disconnecteur, ni réducteur de pression, ni sonde de
     pluie. Ce sont des pièces de tête de réseau, pas du regard — elles
     restent des lignes séparées ailleurs dans la liste. */
  nourrices: {
    1: {
      nom: 'Nourrice 1 voie', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'coude-mf', q:1 }, { ref:'coude-mm', q:1 },
        { ref:'mamelon', q:2 }, { ref:'union', q:2 },
        { ref:'vanne-purge', q:1 }, { ref:'electrovanne-100dv', q:1 },
        { ref:'raccord-male25', q:2 }, { ref:'regard-rect12', q:1 },
        { ref:'prog-1', q:1 }, { ref:'pile-9v', q:1 }, { ref:'connexion', q:2 }
      ]
    },
    2: {
      nom: 'Nourrice 2 voies', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'te-mmf', q:1 }, { ref:'coude-mm', q:1 }, { ref:'union', q:3 },
        { ref:'electrovanne-100dv', q:2 }, { ref:'raccord-male25', q:3 },
        { ref:'coude-mf', q:1 }, { ref:'mamelon', q:2 }, { ref:'vanne-purge', q:1 },
        { ref:'regard-rect12', q:1 }, { ref:'prog-2', q:1 },
        { ref:'pile-9v', q:1 }, { ref:'connexion', q:6 }
      ]
    },
    3: {
      nom: 'Nourrice 3 voies', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'clarinette-2v', q:1 }, { ref:'union', q:4 },
        { ref:'electrovanne-100dv', q:3 }, { ref:'raccord-male25', q:4 },
        { ref:'coude-mm', q:1 }, { ref:'coude-mf', q:1 },
        { ref:'mamelon', q:2 }, { ref:'vanne-purge', q:1 },
        { ref:'regard-rect12', q:1 }, { ref:'prog-4', q:1 },
        { ref:'pile-9v', q:1 }, { ref:'connexion', q:6 }
      ]
    },
    4: {
      nom: 'Nourrice 4 voies', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'clarinette-3v', q:1 }, { ref:'union', q:5 },
        { ref:'electrovanne-100dv', q:4 }, { ref:'raccord-male25', q:5 },
        { ref:'coude-mm', q:1 }, { ref:'coude-mf', q:1 },
        { ref:'mamelon', q:2 }, { ref:'vanne-purge', q:1 },
        { ref:'regard-rg17106', q:1 }, { ref:'prog-4', q:1 },
        { ref:'pile-9v', q:1 }, { ref:'connexion', q:8 }
      ]
    },
    5: {
      nom: 'Nourrice 5 voies', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'clarinette-4v', q:1 }, { ref:'union', q:6 },
        { ref:'electrovanne-100dv', q:5 }, { ref:'raccord-male25', q:6 },
        { ref:'coude-mm', q:1 }, { ref:'coude-mf', q:1 },
        { ref:'mamelon', q:2 }, { ref:'vanne-purge', q:1 },
        { ref:'regard-jumbo5', q:1 }, { ref:'prog-6', q:1 },
        { ref:'pile-9v', q:1 }, { ref:'connexion', q:12 }
      ]
    },
    6: {
      // Même clarinette « 4 vannes » que la fiche 5 voies, plus un Té 1" MMF
      // absent des autres fiches : CONFIRMÉ par lui le 17 août — « oui c'est
      // voulu, c'est comme ça que se constitue une nourrice 6 voies ». Ce
      // n'était pas une coquille de transcription ; ne pas y toucher.
      nom: 'Nourrice 6 voies', source:'patron', releve:'17 août 2026',
      pieces: [
        { ref:'clarinette-4v', q:1 }, { ref:'union', q:7 },
        { ref:'electrovanne-100dv', q:6 }, { ref:'raccord-male25', q:7 },
        { ref:'coude-mm', q:1 }, { ref:'coude-mf', q:1 },
        { ref:'mamelon', q:2 }, { ref:'vanne-purge', q:1 }, { ref:'te-mmf', q:1 },
        { ref:'regard-jumbo6', q:1 }, { ref:'prog-6', q:1 },
        { ref:'pile-9v', q:1 }, { ref:'connexion', q:20 }
      ]
    }
  }
};

/* Une pièce de nourrice, résolue depuis sa référence — un seul endroit qui
   sait faire le lien entre un `ref` et son nom, sa marque. */
CATALOGUE.piece = function (ref) {
  return CATALOGUE.piecesNourrice[ref] || null;
};

/* La fiche RÉELLEMENT posée pour N voies, DONT `combienGoutte` alimentent une
   zone goutte-à-goutte. La fiche de base (`CATALOGUE.nourrices[n]`) suppose
   tout en arroseur/tuyère ; sa consigne du 17 août modifie CHAQUE VOIE
   goutte-à-goutte, pas la fiche entière : une électrovanne standard en moins,
   une électrovanne FF en plus, un régulateur, des mamelons en plus. Le reste
   — regard, programmateur, pile, connexions, tés/coudes — NE CHANGE PAS,
   « que ce soit pour une voie ou six ».

   `combienGoutte` ne peut pas dépasser `n` : une voie ne peut pas être « à
   moitié » goutte-à-goutte, un mélange dans une même voie n'a pas de sens et
   ce n'est pas à cette fonction de l'inventer. */
CATALOGUE.ficheNourrice = function (n, combienGoutte) {
  var base = CATALOGUE.nourrices[n];
  if (!base) return null;
  var g = Math.max(0, Math.min(combienGoutte || 0, n));
  var pieces = base.pieces.map(function (p) { return { ref: p.ref, q: p.q }; });
  if (g > 0) {
    var electro = pieces.filter(function (p) { return p.ref === 'electrovanne-100dv'; })[0];
    if (electro) electro.q = Math.max(0, electro.q - g);
    pieces.push({ ref: 'electrovanne-100dv-ff', q: g });
    pieces.push({ ref: 'regulateur-ff34', q: g });
    pieces.push({ ref: 'mamelon', q: g * 2 });
    pieces.push({ ref: 'mamelon-droit-1', q: g });
  }
  // Fusionner les lignes de même référence — sinon « mamelon réduit » se voit
  // deux fois à l'écran (2 dans la fiche de base, 2 ajoutés par la voie
  // goutte-à-goutte) au lieu d'une fois à 4. Le total est juste dans les deux
  // cas ; seule la lecture change, et une ligne dédoublée se lit comme un
  // doublon plutôt que comme un total.
  var fusion = {};
  pieces.forEach(function (p) { fusion[p.ref] = (fusion[p.ref] || 0) + p.q; });
  var piecesFusionnees = Object.keys(fusion)
    .filter(function (ref) { return fusion[ref] > 0; })
    .map(function (ref) { return { ref: ref, q: fusion[ref] }; });
  return { nom: base.nom, source: base.source, pieces: piecesFusionnees };
};

/* ══ LE DÉBIT D'UNE TURBINE NE DÉPEND PAS DE L'ARC — sa réponse du 17 août ══

   « Les débits, portées qui sont dans le tableau sont donnés pour les
     arroseurs en 360 degrés ; c'est les mêmes données que pour 90 ou
     180 degrés. »

   C'est ce qui manquait pour poser les turbines. Leurs tableaux ne donnent
   qu'UN chiffre par numéro de buse, là où les tuyères VAN en donnent un par
   angle — et `busesDe()` exige les trois angles avant de poser une buse. Les
   six familles de turbines étaient donc entrées mais jamais choisies.

   **Et ce n'est PAS la déduction que le §3 du dépôt interdit.** On ne divise
   rien : sa règle dit que le chiffre du tableau EST la valeur à 90° comme à
   360°. Diviser aurait été inventer — et l'aurait été gravement, puisque la
   moitié des turbines d'un jardin sont en coin ou en bord : un quart du débit
   compté quatre fois de trop, ce sont des secteurs en moins sur le papier et
   un arrosage qui bave sur le chantier.

   Physiquement, cela se tient : une turbine projette UN filet par un orifice
   fixe, qui balaie l'arc réglé. Réduire l'arc ne réduit pas le filet — ça
   arrose plus souvent la même bande. C'est l'inverse d'une tuyère, dont le
   jet est un éventail dont la largeur change avec l'arc : d'où des valeurs
   par angle dans SES tableaux à elle, et la 6-VAN qui n'est pas
   proportionnelle (0,27 à 90°, 0,32 à 360°).

   DONC, ET LA DISTINCTION EST TOUT : quand le tableau donne UN chiffre, il
   vaut pour tous les arcs ; quand il en donne un PAR ANGLE, on lit chaque
   angle. Ce passage n'écrit donc que ce qui manque, et ne recouvre jamais une
   valeur relevée. Il ne touche pas non plus les buses sans aucun débit (les
   MPR 5000 Plus, dont la photo ne portait qu'un rayon) : rien à étendre. */
CATALOGUE.buses.forEach(function (b) {
  if (b.pourType !== 'turbine') return;
  if (b.debit[360] == null) return;
  if (b.debit[90] != null || b.debit[180] != null) return;
  b.debit[90] = b.debit[360];
  b.debit[180] = b.debit[360];
  b.debitMemeQuelQueSoitLArc = true;
});

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
  CATALOGUE.coudes.forEach(function (c) {
    out.push({ ref:c.ref, nom:c.nom, detail:c.detail, famille:'Raccordement' });
  });
  Object.keys(CATALOGUE.piecesNourrice).forEach(function (ref) {
    var p = CATALOGUE.piecesNourrice[ref];
    out.push({ ref:ref, nom:(p.marque ? p.marque + ' ' : '') + p.nom, detail:'', famille:'Nourrice' });
  });
  Object.keys(CATALOGUE.piecesReseau).forEach(function (ref) {
    var p = CATALOGUE.piecesReseau[ref];
    out.push({ ref:ref, nom:(p.marque ? p.marque + ' ' : '') + p.nom, detail:'', famille:'Réseau latéral' });
  });
  CATALOGUE.gaines.forEach(function (g) {
    out.push({ ref:g.ref, nom:g.nom, detail:g.detail, famille:'Goutte-à-goutte' });
  });
  CATALOGUE.materiel.forEach(function (m) {
    out.push({ ref:m.ref, nom:m.nom, detail:m.unite === 'ml' ? 'au mètre' : '', famille:'Matériel' });
  });
  return out;
};

/* Le corps par défaut, une fois qu'il l'a tranché le 17 août : « 10 cm sans
   option, mais proposer à chaque fois les autres en expliquant ce qu'il
   apporte — l'utilisateur décidera. » Le choix reste donc RÉGLABLE (ce n'est
   pas une valeur figée), mais avec un point de départ raisonnable et jamais
   une décision cachée : chaque option porte sa phrase, sur l'écran. */
// Par défaut, seuls les corps de TUYÈRE : ce sont les seuls que la page pose
// automatiquement (les corps de turbine sont entrés, mais le calcul ne choisit
// pas encore de turbine automatiquement — voir la note sur `busesDe` plus
// haut). Passer 'turbine' pour lire l'autre famille, une fois qu'elle sera
// câblée.
CATALOGUE.corpsDe = function (marqueCle, pourType) {
  var type = pourType || 'tuyere';
  return CATALOGUE.corps.filter(function (c) { return c.marqueCle === marqueCle && c.pourType === type; });
};
CATALOGUE.corpsParDefaut = function (marqueCle) {
  var chez = CATALOGUE.corpsDe(marqueCle);
  var dix = chez.filter(function (c) { return c.hauteur === 10 && c.options.length === 0; })[0];
  return dix || chez[0] || null;
};

/* LE CORPS QUI VA AVEC UNE BUSE DE TURBINE — et pourquoi ce n'est PAS un choix.

   Une buse de tuyère se visse sur n'importe quel corps de tuyère de la marque :
   c'est pour cela que le corps s'y CHOISIT (son sélecteur, « 10 cm sans option »
   par défaut, sa décision du 17 août). Une turbine, non : la buse 0,75 du 3504
   ne va que dans un corps 3504, celle du PGP que dans un PGP. Le couple est le
   produit, il n'y a rien à trancher.

   Le lien se lit sur la référence, parce que c'est ainsi qu'elles ont été
   relevées de ses photos : la buse porte la référence du corps, suivie de son
   numéro (`RA3504-B075` → `RA3504`, `HA2211-B4` → `HA2211`). Les corps à
   variante allongent ce préfixe plutôt que de le rompre (`RA5004` → `RA5004FC`,
   `TAMINI8` → `TAMINI8-4P`), d'où la comparaison par DÉBUT de référence et non
   par égalité.

   **Une convention de référence peut se casser à la prochaine transcription**,
   et le jour où elle se cassera ce serait silencieux : un corps manquant dans
   la liste, donc un chantier arrêté. Un contrôle exige donc que CHAQUE buse de
   turbine posable trouve son corps (`essai-arrosage-detaille.cjs`). Ici, rien
   n'est deviné : sans correspondance, on rend `null` et l'écran le dit. */
CATALOGUE.corpsDeLaBuse = function (buse) {
  if (!buse || buse.pourType !== 'turbine') return null;
  var base = buse.ref.split('-B')[0];
  return CATALOGUE.corps.filter(function (c) {
    return c.pourType === 'turbine' && c.marqueCle === buse.marqueCle &&
           c.ref.indexOf(base) === 0 && c.options.length <= 1;
  })[0] || CATALOGUE.corps.filter(function (c) {
    return c.pourType === 'turbine' && c.marqueCle === buse.marqueCle && c.ref.indexOf(base) === 0;
  })[0] || null;
};
// Ce que chaque option apporte, en une phrase — pour que le choix se fasse
// sur ce que ça change, pas sur un sigle (« SAM », « PRS ») que personne ne
// devine.
CATALOGUE.explicationCorps = function (c) {
  var h = 'Escamotable ' + c.hauteur + ' cm — ' +
    (c.hauteur <= 5 ? 'pour un gazon tondu ras.'
      : c.hauteur <= 10 ? 'le plus courant.'
      : c.hauteur <= 15 ? 'pour une herbe plus haute ou un massif bas.'
      : 'pour une végétation haute, loin de la tondeuse.');
  var opts = c.options.map(function (o) {
    return o === 'clapet anti-vidange'
      ? 'Clapet anti-vidange : évite les fuites au point bas après l\'arrêt — utile sur un terrain en pente.'
      : o === 'régulateur de pression'
      ? 'Pression régulée : utile si la pression varie sur le réseau.'
      : o;
  });
  return [h].concat(opts).join(' ');
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
