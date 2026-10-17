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

export const CATALOGUE = {

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

  /* ── Les arroseurs génériques sont RETIRÉS, le 16 octobre 2026 ──────────
     Une « Turbine » et une « Tuyère » sans marque, posées avant ses photos,
     servaient de repli quand une marque n'avait rien : une zone en tuyères
     Toro recevait ainsi des tuyères inventées (portée 3,7 m, 0,48 m³/h), sans
     que rien le dise. Sa consigne : « supprime toutes les lignes provisoires ».
     Une marque qui n'a rien pour une zone le DIT désormais sous le plan
     (`manquants`, dans `calcul.js`). */

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
     │    la 6-VAN donne 0,27 à 330° quand quatre fois son 90° ferait 0,32.   │
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
    { ref:'RBT648', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'18-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:5.4, pression:2,
      debit:{ 90:0.30, 180:0.60, 270:0.90, 360:1.20 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT601', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'15-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.5, pression:2,
      debit:{ 90:0.21, 180:0.42, 270:0.63, 360:0.84 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT636', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'12-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:3.6, pression:2,
      debit:{ 90:0.15, 180:0.30, 270:0.45, 360:0.59 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT637', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'10-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:2.7, pression:2,
      debit:{ 90:0.14, 180:0.29, 270:0.43, 360:0.57 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    // **LES 8, 6 ET 4-VAN S'ARRÊTENT À 330°** (fiche Rain Bird des VAN, pages
    // 27 et 28). Aqua Plus imprime leur dernier chiffre sous « 360° » : c'est
    // celui du 330°. Sa réponse du 16 octobre 2026 : « oui pour les VAN »,
    // coins et bords seulement. Le calcul ne les pose donc jamais sur une zone
    // qui a une rangée intérieure (`poseSelonSaRegle`, `faitLeTour`).
    //
    // La 8-VAN porte 0,16 m³/h à 90°, plus que la 10-VAN : Rain Bird donne le
    // même chiffre (trajectoire de 5°, la 10-VAN est à 10°). Le doute est levé.
    { ref:'RBT638', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'8-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:2.3, pression:2,
      debit:{ 90:0.16, 180:0.26, 270:0.34, 330:0.38 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT639', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'6-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:1.8, pression:2,
      debit:{ 90:0.08, 180:0.13, 270:0.24, 330:0.27 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8' },
    { ref:'RBT640', pressionMin:1.0, pressionMax:2.1, plageReleve:'Rain Bird, fiche des buses VAN, p. 27', nom:'4-VAN', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:1.2, pression:2,
      debit:{ 90:0.06, 180:0.10, 270:0.16, 330:0.20 },
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
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      aVerifier:'270° absent du relevé, seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1419', nom:'14 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.0, pression:2.4,
      debit:{ 360:0.264 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      pairAvec:'RBT1418' },
    { ref:'RBT1428', nom:'18 R-VAN réglable', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.9, pression:2.4,
      debit:{ 90:0.106, 180:0.206 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      aVerifier:'270° absent du relevé, seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1429', nom:'18 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:4.9, pression:2.4,
      debit:{ 360:0.412 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      pairAvec:'RBT1428' },
    { ref:'RBT1438', nom:'24 R-VAN réglable', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:6.1, pression:2.4,
      debit:{ 90:0.148, 180:0.295 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      aVerifier:'270° absent du relevé, seuls 90° et 180° étaient lisibles' },
    { ref:'RBT1439', nom:'24 R-VAN 360°', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', rayon:6.1, pression:2.4,
      debit:{ 360:0.590 },
      colisage:25, source:'patron', releve:'Aqua Plus 2026, p. 8',
      pairAvec:'RBT1438' },

    /* ── LES BUSES DE TURBINE — cinquième page, le 17 août 2026 ─────────────
       Six familles (Hunter PGP-ADJ, PGP Ultra, I 20-04 ; Rain Bird 5000 Plus,
       3504 ; Hunter SRM-04, PGJ ; Toro Mini 8). PARTOUT LE MÊME TROU : une
       seule valeur de débit par numéro de buse, à une pression de référence —
       AUCUNE répartition par angle, contrairement aux tuyères VAN/SRS/R-VAN.

       **TRANCHÉ PAR LE PATRON LE 21 AOÛT 2026 :** *« les débits à 360° sont les
       mêmes qu'à 180° et 90° »*. Sur une turbine, le jet est UN SEUL filet qui
       balaie l'arc réglé : il sort autant d'eau par seconde qu'il balaie un
       quart de cercle ou le tour entier — seule la durée passée sur chaque
       point change. **Le débit d'une turbine ne dépend donc PAS de son arc**,
       et `debit:{360: …}` vaut pour tous les angles.

       **C'EST L'INVERSE DE CE QU'ON AVAIT SUPPOSÉ ICI**, et c'est pour cela
       qu'on ne l'avait pas déduit : on imaginait un débit proportionnel à
       l'arc (« deux fois moins d'angle, deux fois moins d'eau »). Faux. La
       règle du 17 août — « les valeurs sont lues, jamais déduites » — a bien
       servi : la déduction plausible aurait divisé par quatre le débit d'un
       arroseur de coin, et fait poser quatre fois trop d'arroseurs sur une
       même voie.

       **ET CELA NE VAUT QUE POUR LES TURBINES.** Une buse VAN projette
       PLUSIEURS filets simultanés : moins d'arc, moins de filets, moins de
       débit. Ses propres relevés le montrent (12-VAN : 0,15 à 90°, 0,30 à
       180°, 0,59 à 360°) — pour une tuyère, le débit se lit par angle, comme
       il est écrit. Étendre la règle des turbines aux tuyères contredirait
       ses mesures. */
    { ref:'HA2211-B1', nom:'PGP-ADJ buse 1 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.8, pression:2.8, debit:{ 360:0.14 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B2', nom:'PGP-ADJ buse 2 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.1, pression:2.8, debit:{ 360:0.18 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B3', nom:'PGP-ADJ buse 3 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.8, debit:{ 360:0.23 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B4', nom:'PGP-ADJ buse 4 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.8, debit:{ 360:0.32 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B5', nom:'PGP-ADJ buse 5 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.0, pression:2.8, debit:{ 360:0.41 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B6', nom:'PGP-ADJ buse 6 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.6, pression:2.8, debit:{ 360:0.55 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2211-B7', nom:'PGP-ADJ buse 7 (rouge std)', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.2, pression:2.8, debit:{ 360:0.68 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },

    { ref:'HA2210-B1.5', nom:'PGP Ultra buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.8, pression:3, debit:{ 360:0.35 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B2', nom:'PGP Ultra buse 2', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.4, pression:3, debit:{ 360:0.43 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B3', nom:'PGP Ultra buse 3', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.6, pression:3, debit:{ 360:0.68 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B4', nom:'PGP Ultra buse 4', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.2, pression:3, debit:{ 360:0.90 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B5', nom:'PGP Ultra buse 5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.8, pression:3, debit:{ 360:1.14 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B6', nom:'PGP Ultra buse 6', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.10, pression:3, debit:{ 360:1.36 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210-B8', nom:'PGP Ultra buse 8', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.4, pression:3, debit:{ 360:1.81 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },

    { ref:'RBA2195', nom:'5000 Plus MPR 7,62 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.62, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },
    { ref:'RBA2196', nom:'5000 Plus MPR 9,14 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.14, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },
    { ref:'RBA2197', nom:'5000 Plus MPR 10,67 m', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.67, pression:null, debit:{},
      colisage:10, source:'patron', releve:'Aqua Plus 2026, p. 13',
      aVerifier:'Buse MPR (débit proportionnel à la surface, 90°-120°-180°-360°) : aucun débit donné sur la photo' },

    { ref:'RA5004-B1u', nom:'5000 Plus buse 1,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.5, pression:2.5, debit:{ 360:0.22 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B15u', nom:'5000 Plus buse 1,5 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.5, debit:{ 360:0.28 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B2u', nom:'5000 Plus buse 2,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.8, pression:2.5, debit:{ 360:0.45 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B3u', nom:'5000 Plus buse 3,0 u+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:11.1, pression:2.5, debit:{ 360:0.71 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B15p', nom:'5000 Plus buse 1,5 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.5, debit:{ 360:0.39 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B3p', nom:'5000 Plus buse 3,0 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:12.20, pression:2.5, debit:{ 360:0.92 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004-B6p', nom:'5000 Plus buse 6,0 Portée+', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:13.70, pression:2.5, debit:{ 360:1.36 },
      // 0,92 jusqu'au 16 octobre 2026 : recopié de la buse 3,0 Portée+ sur une
      // photo. Le catalogue Aqua Plus 2026 donne 1,36, corrigé avec son accord.
      // Comptée 0,92, elle mettait une tête de trop sur une vanne.
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 13' },

    { ref:'TAMINI8-B075', nom:'Mini 8 buse 0,75', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.0, pression:2.5, debit:{ 360:0.20 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B1', nom:'Mini 8 buse 1,0', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.9, pression:2.5, debit:{ 360:0.28 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B15', nom:'Mini 8 buse 1,5', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.3, pression:2.5, debit:{ 360:0.30 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'TAMINI8-B2', nom:'Mini 8 buse 2,0', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.3, pression:2.5, debit:{ 360:0.36 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'RA3504-B075', nom:'3504 buse 0,75', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.2, pression:2.5, debit:{ 360:0.16 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B1', nom:'3504 buse 1,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.4, pression:2.5, debit:{ 360:0.21 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B15', nom:'3504 buse 1,5', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.0, pression:2.5, debit:{ 360:0.30 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B2', nom:'3504 buse 2,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.2, pression:2.5, debit:{ 360:0.39 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B3', nom:'3504 buse 3,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.5, debit:{ 360:0.60 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504-B4', nom:'3504 buse 4,0', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:10.1, pression:2.5, debit:{ 360:0.83 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'HA2264-B050', nom:'SRM-04 buse 0,50', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:4.9, pression:2.8, debit:{ 360:0.11 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B075', nom:'SRM-04 buse 0,75', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.5, pression:2.8, debit:{ 360:0.17 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B1', nom:'SRM-04 buse 1,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.1, pression:2.8, debit:{ 360:0.23 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B15', nom:'SRM-04 buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.3, pression:2.8, debit:{ 360:0.34 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B2', nom:'SRM-04 buse 2,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.90, pression:2.8, debit:{ 360:0.45 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264-B3', nom:'SRM-04 buse 3,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.1, pression:2.8, debit:{ 360:0.68 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },

    { ref:'HA2274-B075', nom:'PGJ buse 0,75', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:4.9, pression:2.8, debit:{ 360:0.17 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B1', nom:'PGJ buse 1,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:5.8, pression:2.8, debit:{ 360:0.23 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B15', nom:'PGJ buse 1,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:6.7, pression:2.8, debit:{ 360:0.34 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B2', nom:'PGJ buse 2,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:7.6, pression:2.8, debit:{ 360:0.45 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B25', nom:'PGJ buse 2,5', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:8.50, pression:2.8, debit:{ 360:0.57 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274-B3', nom:'PGJ buse 3,0', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', rayon:9.4, pression:2.8, debit:{ 360:0.68 },
      livreeAvecLArroseur:true, source:'patron', releve:'Aqua Plus 2026, p. 11' }
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
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1804', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:[], detail:'escamotable 10 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1806', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:[], detail:'escamotable 15 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1812', nom:'Tuyère 1800', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:[], detail:'escamotable 30 cm',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1824', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['clapet anti-vidange'], detail:'escamotable 10 cm, SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1826', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['clapet anti-vidange'], detail:'escamotable 15 cm, SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1822', nom:'Tuyère 1800 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['clapet anti-vidange'], detail:'escamotable 30 cm, SAM',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1834', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 10 cm, SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1836', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 15 cm, SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'RT1832', nom:'Tuyère 1800 SAM-PRS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['clapet anti-vidange','régulateur de pression'],
      detail:'escamotable 30 cm, SAM-PRS (2,1 bar)',
      source:'patron', releve:'Aqua Plus 2026, p. 7' },
    { ref:'HT1541', nom:'Tuyère Pro-Spray-02', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:5, options:[], detail:'escamotable 5 cm',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1543', nom:'Tuyère Pro-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:[], detail:'escamotable 10 cm',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1544', nom:'Tuyère Pro-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:[], detail:'escamotable 15 cm',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1546', nom:'Tuyère Pro-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:[], detail:'escamotable 30 cm',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1521', nom:'Tuyère I-Spray-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:10, options:['régulateur de pression'], detail:'escamotable 10 cm, régulateur',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1522', nom:'Tuyère I-Spray-06', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:15, options:['régulateur de pression'], detail:'escamotable 15 cm, régulateur',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },
    { ref:'HT1523', nom:'Tuyère I-Spray-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'tuyere', filetage:'1/2', hauteur:30, options:['régulateur de pression'], detail:'escamotable 30 cm, régulateur',
      pressionMin:1, pressionMax:4.8, plageReleve:'Aqua Plus 2026, p. 9',
      source:'patron', releve:'Aqua Plus 2026, p. 9' },

    /* ── LES CORPS DE TURBINE — quatrième page, le 17 août 2026 ────────────
       `pourType:'turbine'` : une famille à part des corps de tuyères
       ci-dessus. Un jour où les turbines seront posées automatiquement, le
       sélecteur de corps devra distinguer les deux — pour l'instant seuls
       les corps `tuyere` sont câblés dans la liste au fournisseur. */
    { ref:'HA2211', nom:'Turbine PGP-ADJ', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable 40°-360°'],
      detail:'escamotable 10 cm, secteur réglable 40°-360°, livré avec 12 buses',
      pressionMin:2.1, pressionMax:4.8, bridage:0, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2210', nom:'Turbine PGP Ultra', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable et plein cercle'],
      detail:'escamotable 10 cm, réglable ET plein cercle (modèle unique), livré avec 8 buses',
      pressionMin:2.1, pressionMax:4.8, bridage:0, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2222', nom:'Turbine I 20-04 Ultra', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['FloStop'],
      detail:'escamotable, réglage par clé 40°-360°, coupure FloStop à la clé, livré avec 12 buses dont 4 angle bas',
      pressionMin:2.1, pressionMax:4.8, bridage:0, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'HA2225', nom:'Turbine I 20-04 Ultra SS Inox', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['FloStop','tige inox'],
      detail:'comme I 20-04 Ultra, tige escamotable en acier inox',
      pressionMin:2.1, pressionMax:4.8, bridage:0, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA2181', nom:'Turbine 5004 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable'],
      detail:'escamotable 10 cm, secteur réglable, fermeture de débit sur l\'arroseur',
      pressionMin:1.7, pressionMax:4.5, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5004FC', nom:'Turbine 5004 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['plein cercle'],
      detail:'escamotable 10 cm, plein cercle',
      pressionMin:1.7, pressionMax:4.5, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5006PC', nom:'Turbine 5006 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:15, options:['réglable'],
      detail:'escamotable 15 cm, secteur réglable',
      pressionMin:1.7, pressionMax:4.5, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA5012PCSAM', nom:'Turbine 5012 Plus', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:30, options:['réglable','clapet anti-vidange'],
      detail:'escamotable 30 cm, secteur réglable, SAM',
      pressionMin:1.7, pressionMax:4.5, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'RA2180', nom:'Turbine 5004 Plus SS', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'3/4', hauteur:10, options:['réglable','clapet anti-vidange','tige inox'],
      detail:'tige escamotable inox, secteur réglable, SAM',
      pressionMin:1.7, pressionMax:4.5, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 13',
      source:'patron', releve:'Aqua Plus 2026, p. 13' },
    { ref:'TAMINI8-4P', nom:'Turbine Mini 8', marqueCle:'toro', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:9.5, options:['faible consommation'],
      detail:'escamotable 9,5 cm, réglage sur le dessus, 5 buses interchangeables',
      pressionMin:2, pressionMax:4.1, bridage:0.25, plageReleve:'Aqua Plus 2026, p. 11',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504', nom:'Turbine 3504', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable'],
      detail:'un seul modèle réglable 40°-360°, livré avec 6 buses',
      pressionMin:1.7, pressionMax:3.8, bridage:0.35, plageReleve:'Aqua Plus 2026, p. 11',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'RA3504SAM', nom:'Turbine 3504 SAM', marqueCle:'rainbird', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable','clapet anti-vidange'],
      detail:'comme 3504, SAM',
      pressionMin:1.7, pressionMax:3.8, bridage:0.35, plageReleve:'Aqua Plus 2026, p. 11',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2264', nom:'Turbine SRM-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:0, options:['réglable et plein cercle'],
      detail:'faible débit, un seul modèle réglable et plein cercle',
      pressionMin:2.1, pressionMax:3.4, bridage:0, plageReleve:'Aqua Plus 2026, p. 11',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2274', nom:'Turbine PGJ-04', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:10, options:['réglable et plein cercle'],
      detail:'faible débit, escamotable 10 cm, réglable et plein cercle',
      pressionMin:2.1, pressionMax:3.4, bridage:0, plageReleve:'Aqua Plus 2026, p. 11',
      source:'patron', releve:'Aqua Plus 2026, p. 11' },
    { ref:'HA2272', nom:'Turbine PGJ-12', marqueCle:'hunter', fournisseur:'Aqua Plus',
      pourType:'turbine', filetage:'1/2', hauteur:30, options:['réglable et plein cercle'],
      detail:'faible débit, escamotable 30 cm, réglable et plein cercle',
      pressionMin:2.1, pressionMax:3.4, bridage:0, plageReleve:'Aqua Plus 2026, p. 11',
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
      filetage:'1/2', detail:'16 x 1/2" coudé', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD502', nom:'Coude SBE 075', marqueCle:'generique', fournisseur:'Aqua Plus',
      filetage:'3/4', detail:'16 x 3/4" coudé', source:'patron', releve:'Aqua Plus 2026, p. 14' }
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
  /* ── LES TUYAUX D'AMENÉE, et leur diamètre INTÉRIEUR ────────────────────
     Sa règle du 17 août : « Du compteur au regard : Ø25 par défaut. Passer en
     Ø32 uniquement si le calcul hydraulique démontre que le Ø25 est
     insuffisant. » Le calcul, lui, ne travaille pas sur le diamètre écrit sur
     le tuyau (extérieur) mais sur le diamètre INTÉRIEUR : l'extérieur moins
     deux fois la paroi, les deux chiffres imprimés sur chaque tube (« 25×3.0 »).

     **Relevés de ses photos du 16 octobre 2026**, et non plus supposés. Le
     catalogue portait jusque-là 20,4 et 26,2 mm, « ceux du PN10, le plus
     courant », marqués provisoires et jamais confrontés à ses tubes. Son Ø25
     a une paroi de 3 mm : 19,0 mm de passage. L'écart n'est pas un détail, le
     diamètre entre à la puissance 4,87 dans la perte : **40 % de perte en
     plus**, et un plafond par réseau qui tombe de 1,76 à 1,53 m³/h. L'erreur
     allait dans le sens dangereux, celui du réseau qui ne se lève pas.

     Ce sont SES tubes. Un artisan qui pose une paroi plus fine a plus de
     passage : les tenir pour lui aussi pose une vanne de trop, jamais un
     réseau qui ne se lève pas. Le choix par artisan est dans `TODO.md`. */
  tuyaux: {
    pe25: { nom:'Tuyau PEHD Ø25', dInterieur:19.0, source:'patron',
            releve:'Elydan Polybleu 25×3.0, PE100, SDR 9' },
    pe32: { nom:'Tuyau PEHD Ø32', dInterieur:26.0, source:'patron',
            releve:'Alfatubo AL 32×3.0, PE100, SDR 11, PN16' }
  },

  piecesReseau: {
    'te-taraude-25-34-25': { nom:'Té 90° taraudé 25×3/4"×25', marque:'Plasson' },
    'coude-taraude-25-34': { nom:'Coude 90° taraudé 25×3/4"', marque:'Plasson' },
    // Le « (jonction, non taraudé) » qui suivait ce nom a été retiré le 18 août
    // sur sa consigne : c'est l'emploi de la pièce, pas sa désignation, et il
    // commande sur la désignation. Le 25×25×25 dit déjà qu'il n'est pas taraudé
    // — un taraudé porte son filetage dans son nom (25×3/4"×25).
    'te-25-25-25':         { nom:'Té 90° 25×25×25', marque:'Plasson' },
    'pebd16':              { nom:'PEBD rigide Ø16 (tube de reprise)', marque:'Dura', unite:'ml' }
  },

  /* ── Le goutte-à-goutte : SON tube, le 16 octobre 2026 ──────────────────
     *« Voici le goutte-à-goutte que j'utilise : UGGCBL23050, un tube de 16 mm
     à goutteurs intégrés autorégulants, 2 l/h espacés de 33 cm, la marque
     Toro »*, puis *« et c'est bien 2 l/h »*. Il remplace la « gaine de
     goutteurs » provisoire (2,3 l/h, 23 mm/h), qui ne venait de nulle part.

     `debitMetre` se CALCULE sur ses deux chiffres (plus bas), il ne s'écrit
     pas : 2 l/h tous les 33 cm font 6,06 l/h par mètre. La pluviométrie, elle,
     dépend de l'écart entre les lignes de la zone : c'est le calcul qui la
     fait (`poser`), plus ce fichier. */
  gaines: [
    { ref:'UGGCBL23050', marqueCle:'toro', marque:'Toro', type:'gaine',
      nom:'tube Ø16mm 2l/h esp.33cm autorégulé',
      detail:'2 l/h tous les 33 cm', debitGoutteur:2, ecartGoutteurs:0.33,
      // Par 50 : la colonne « colisage » d'Aqua Plus, et ses couronnes de 50 m.
      colisage:50, famille:'Goutte-à-goutte', source:'patron',
      releve:'Aqua Plus 2026, p. 48' }
  ],

  /* ── LES PIÈCES QU'ON AJOUTE À LA MAIN — relevées le 16 octobre 2026 ──────
     Sa demande du même jour : *« une petite touche "ajouter une pièce" ; on
     clique, ça ouvre des catégories, genre électrovanne, avec les différentes
     qui existent, et l'utilisateur choisit les pièces qu'il veut rajouter ou
     enlever »*. Ce sont ces pièces-là : tout ce qui sert à poser un réseau dans
     le catalogue Aqua Plus 2026 (raccords PE dont le Ø32, électrovannes,
     regards, programmateurs, tubes, goutte-à-goutte, robinetterie, électricité).

     **Le calcul n'en compte que cinq** : les pièces Palaplast d'une sortie de
     goutte-à-goutte (MID6321, MID6341, MID6352, MID6301, MID6371), ses règles
     du 16 octobre 2026 (`sortiesGoutte`). Les autres ne servent qu'à
     compléter la liste.
     Désignation recopiée mot pour mot, page imprimée, AUCUN prix. Un doute du
     relevé reste écrit dans `aVerifier` : une tension lue dans un titre de
     section, une référence imprimée deux fois. */
  piecesAjoutables: [
    { ref:'TD102-2024', nom:'clé Toro Mini8', categorie:'accessoire d\'arroseur', marque:'Toro', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'TD99533', nom:'clé Toro Série S700', categorie:'accessoire d\'arroseur', marque:'Toro', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'RD2198', nom:'tournevis arroseur Série 5000 (Rotortool)', categorie:'accessoire d\'arroseur', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'HA2253', nom:'clé HUNTER PGM / PGP / I20', categorie:'accessoire d\'arroseur', marque:'Hunter', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'NA2316', nom:'clé MP ROTATOR', categorie:'accessoire d\'arroseur', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'TD92825', nom:'joint étoile arroseur 300 & 340', categorie:'accessoire d\'arroseur', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'TD890805', nom:'bague anti-fuite Toro Série S700', categorie:'accessoire d\'arroseur', marque:'Toro', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'TD890266', nom:'clapet anti-vidange Toro Série S700', categorie:'accessoire d\'arroseur', marque:'Toro', colisage:'20', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'RD2105', nom:'kit anti-vidange SAM Rain Bird arroseur 5000 Plus', categorie:'accessoire d\'arroseur', marque:'Rain Bird', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'HD2268', nom:'clapet anti-vidange Hunter PGJ / SRM', categorie:'accessoire d\'arroseur', marque:'Hunter', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'HD2256', nom:'clapet anti-vidange Hunter PGP / I20 - I-20 ULTRA INOX', categorie:'accessoire d\'arroseur', marque:'Hunter', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD85046', nom:'allonge réglable 14 cm 1/2" x 1/2"', categorie:'accessoire d\'arroseur', filetage:'1/2"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD85040', nom:'allonge réglable 14 cm 3/4" x 1/2"', categorie:'accessoire d\'arroseur', filetage:'3/4" x 1/2"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD85051', nom:'allonge réglable 14 cm 3/4" x 3/4"', categorie:'accessoire d\'arroseur', filetage:'3/4"', colisage:'20', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD501', nom:'SBE 050 coudé 16 x 1/2"', categorie:'accessoire d\'arroseur', diametre:'16', filetage:'1/2"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD502', nom:'SBE 075 coudé 16 x 3/4"', categorie:'accessoire d\'arroseur', diametre:'16', filetage:'3/4"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD503', nom:'SBA 050 droit 16 x 1/2"', categorie:'accessoire d\'arroseur', diametre:'16', filetage:'1/2"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD504', nom:'SBA 075 droit 16 x 3/4"', categorie:'accessoire d\'arroseur', diametre:'16', filetage:'3/4"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD505', nom:'té SB-TEE', categorie:'accessoire d\'arroseur', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'OD506', nom:'jonction SB-CPLG', categorie:'accessoire d\'arroseur', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'RDACV050', nom:'clapet anti-vidange réglable 1/2"', categorie:'accessoire d\'arroseur', filetage:'1/2"', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'RDACV0_75', nom:'clapet anti-vidange réglable 3/4"', categorie:'accessoire d\'arroseur', filetage:'3/4"', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'BCL304', nom:'raccord anti-vandale MF 3/4"x3/4" coudé', categorie:'accessoire d\'arroseur', filetage:'3/4"', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 14' },
    { ref:'UPE1116', nom:'tube P.E.B.D. Ø 16mm 6,3 bars (12 x 16)', categorie:'tube PE', diametre:'16', colisage:'25/50', source:'patron', releve:'Aqua Plus 2026, p. 14', aVerifier:'même référence p. 47 avec un colisage de 50 au lieu de 25/50' },
    { ref:'TEVEZP0254', nom:'électrovanne EZ FLO+ 1" MM - 24 V', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18' },
    { ref:'TEVEZP0354', nom:'électrovanne EZ FLO+ 1" FF - 24 V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18' },
    { ref:'TEVEZP2254', nom:'électrovanne EZ FLO+ 1" MM RMD - 24 V', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18' },
    { ref:'TEVEZP2354', nom:'électrovanne EZ FLO+ 1" FF RMD - 24 V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18' },
    { ref:'TEVEZP02649V', nom:'électrovanne EZ FLO+ 1" MM solénoïde 9V à impulsion', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18' },
    { ref:'TEVTPV100MMBSP', nom:'EV TPV 1" MM 0,06 à 9,06 m3/h', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEVTPV100BSP', nom:'EV TPV 1" FF 0,06 à 9,06 m³/h', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEV2522656', nom:'électrovanne 252 1"1/2 FF RMD 6 à 27 m³/h', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', tension:'24 V', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEV2522658', nom:'électrovanne 252 2" FF RMD 13,8 à 40,8 m³/h', categorie:'electrovanne', diametre:'2"', filetage:'FF', tension:'24 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEV2640603', nom:'électrovanne 264 3/4" MM', categorie:'electrovanne', diametre:'3/4"', filetage:'MM', tension:'24 V', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V » ; ligne rangée sous la « SÉRIE 252 » sans être une 252, et sans colisage imprimé' },
    { ref:'TEVP2202354', nom:'EV P220 1" FF 1,2 à 11,3 m³/h - pré-équipée EZReg', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/24', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEVP2202356', nom:'EV P220 1"1/2 FF RMD 6,9 à 24,9 m³/h - pré-équipée EZReg', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', tension:'24 V', colisage:'1/12', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEVP2202358', nom:'EV P220 2" FF RMD 18,2 à 40,8 m³/h - pré-équipée EZReg', categorie:'electrovanne', diametre:'2"', filetage:'FF', tension:'24 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEVP2202350', nom:'EV P220 3" FF RMD 34,1 à 68,1m³/h - pré-équipée EZReg', categorie:'electrovanne', diametre:'3"', filetage:'FF', tension:'24 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'TEVEZR-100', nom:'Régulateur de pression EZReg 100 sortie 0,3 à 7,0 bars', categorie:'robinetterie', colisage:'1/5', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'régulateur de pression d\'électrovanne, imprimé page électrovannes' },
    { ref:'TPDCLS', nom:'Solénoïde DC 9V à impulsion pour EZFLO et P220', categorie:'electrovanne', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 18', aVerifier:'solénoïde seul (pièce d\'électrovanne), pas une électrovanne complète' },
    { ref:'REVV1100', nom:'électrovanne 75-DV 3/4" FF 24V', categorie:'electrovanne', diametre:'3/4"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REV201', nom:'électrovanne 100-DV 1" FF 24V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REVM201', nom:'électrovanne 100-DV 1" MM 24V', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REV75DV9V', nom:'électrovanne 75-DV 3/4" FF 9V à impulsion', categorie:'electrovanne', diametre:'3/4"', filetage:'FF', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REV100DV9V', nom:'électrovanne 100-DV 1" FF 9V à impulsion', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REV100DVM9V', nom:'électrovanne 100-DV 1" MM 9V à impulsion', categorie:'electrovanne', diametre:'1"', filetage:'MM', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REVPGA100', nom:'électrovanne 100-PGA 1" FF 0,5 à 9 m³/h', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite sur la ligne : lue dans la description de la série PGA (« Solénoïde 24V à fils »)' },
    { ref:'REVPGA150', nom:'électrovanne 150-PGA 1"1/2 FF 7 à 22 m³/h', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', tension:'24 V', colisage:'1/8', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite sur la ligne : lue dans la description de la série PGA (« Solénoïde 24V à fils »)' },
    { ref:'REVPGA200', nom:'électrovanne 200-PGA 2" FF 12 à 34 m³/h', categorie:'electrovanne', diametre:'2"', filetage:'FF', tension:'24 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite sur la ligne : lue dans la description de la série PGA (« Solénoïde 24V à fils »)' },
    { ref:'REVPGA1009V', nom:'électrovanne 100-PGA 1" FF 9V 0,5 à 9 m³/h', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'9 V', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REVPGA1509V', nom:'électrovanne 150-PGA 1"1/2 FF 9V 7 à 22 m³/h', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', tension:'9 V', colisage:'1/8', source:'patron', releve:'Aqua Plus 2026, p. 19' },
    { ref:'REVPRSDIAL', nom:'Régulateur de pression PRS-DIAL', categorie:'robinetterie', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'régulateur de pression d\'électrovanne, imprimé page électrovannes ; même référence aussi imprimée p. 20' },
    { ref:'REVPEB100', nom:'électrovanne 100-PEB 1" FF 1 à 10 m³/h', categorie:'electrovanne', diametre:'1"', filetage:'FF', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite (ni sur la ligne, ni dans le titre de section)' },
    { ref:'REVPEB150', nom:'électrovanne 150-PEB 1"1/2 FF 5 à 34 m³/h', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', colisage:'1/8', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite (ni sur la ligne, ni dans le titre de section)' },
    { ref:'REVPEB200', nom:'électrovanne 200-PEB 2" FF 12 à 45 m³/h', categorie:'electrovanne', diametre:'2"', filetage:'FF', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 19', aVerifier:'tension non écrite (ni sur la ligne, ni dans le titre de section)' },
    { ref:'REV300-BPE', nom:'EV 300-BPE 3" FF', categorie:'electrovanne', diametre:'3"', filetage:'FF', tension:'24 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'REVPRSDIAL', nom:'Régulateur de pression PRS-DIAL', categorie:'robinetterie', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'régulateur de pression d\'électrovanne, imprimé page électrovannes ; même référence aussi imprimée p. 19' },
    { ref:'AEV1201', nom:'EV RICHDEL 2400 MT 1" FF', categorie:'electrovanne', marque:'RICHDEL', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'AEV1205', nom:'EV RICHDEL 2400 MT 1" FF-L 9V', categorie:'electrovanne', marque:'RICHDEL', diametre:'1"', filetage:'FF', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20' },
    { ref:'HEV1701', nom:'électrovanne PGV 100 1"FF 4 VIS 24V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'24 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20' },
    { ref:'HEV1731', nom:'électrovanne PGV 100 1"FF 4 VIS 9V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20' },
    { ref:'HEV1721', nom:'électrovanne PGV-100JT DC 1" FF 9V', categorie:'electrovanne', diametre:'1"', filetage:'FF', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20' },
    { ref:'HEV1724', nom:'électrovanne PGV 100 JT FIL 1\'\' 9V', categorie:'electrovanne', diametre:'1\'\'', tension:'9 V', colisage:'1/20', source:'patron', releve:'Aqua Plus 2026, p. 20' },
    { ref:'HEV2611', nom:'électrovanne PGV-151G 1"1/2 FF en ligne ou en angle', categorie:'electrovanne', diametre:'1"1/2', filetage:'FF', tension:'24 V', colisage:'1/8', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'HEV2612', nom:'électrovanne PGV-201G 2" FF en ligne ou en angle', categorie:'electrovanne', diametre:'2"', filetage:'FF', tension:'24 V', colisage:'1/8', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'tension non écrite sur la ligne : lue dans le titre de section « ÉLECTROVANNES RÉSIDENTIELLES ET GRANDS ESPACES 24V »' },
    { ref:'ODU301010', nom:'DURA Té 1" MFF', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU3010102', nom:'DURA Collecteur M x F x 2 sorties 1"', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU3010103', nom:'DURA Collecteur M x F x 3 sorties 1"', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU3010104', nom:'DURA Collecteur M x F x 4 sorties 1"', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU306009', nom:'DURA Coude 1" MF', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU306010', nom:'DURA Coude 1" FF', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU320010', nom:'DURA Croix 1" MFFF', categorie:'electrovanne', filetage:'1"', colisage:'15', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU329010', nom:'DURA Manchon union 1" FF', categorie:'electrovanne', filetage:'1"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU348010', nom:'DURA Bouchon 1"F', categorie:'electrovanne', filetage:'1"', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU8303', nom:'DURA Mamelon 1" MM', categorie:'electrovanne', filetage:'1"', colisage:'75', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU8303131', nom:'DURA Mamelon Réduit 1"x3/4" MM', categorie:'electrovanne', filetage:'1" x 3/4"', colisage:'75', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'ODU34MF', nom:'DURA Union 1" MF', categorie:'electrovanne', filetage:'1"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 20', aVerifier:'raccord union démontable DURA (de quoi monter une nourrice), rangé page électrovannes : matériau non écrit, aucune catégorie prévue pour lui, classé « electrovanne » faute de mieux' },
    { ref:'RG17104', nom:'regard mini-rond 7" VB708B', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG6200', nom:'regard rond 10" VB910B', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RGVB910C', nom:'couvercle regard 10" VB910C', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17100', nom:'regard rectangle 12" VB1419', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17101', nom:'réhausse regard 12" VB1419E', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG1710009', nom:'couvercle regard 12" VB1419C', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17106', nom:'regard Jumbo VB1220', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17107', nom:'réhausse regard Jumbo VB1220E', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17108', nom:'couvercle regard Jumbo VB1220C', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RGVB1324', nom:'regard Super Jumbo L x l x h = 83 x 59 x 39 VB1324', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG17109', nom:'regard Maxi Jumbo L x l x h = 103 x 69 x 46 VB1730', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RD6210', nom:'vis verrouillage 5 pans nue VBLOCK', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RD6212', nom:'vis verrouillage 5 pans RB 71P51186', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RGVB1419CA', nom:'couvercle fonte pour regard 12" VBSTDCA', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RGVB1220CA', nom:'couvercle fonte pour regard jumbo VBJMBCA', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'RG6221', nom:'grille de base pour regard 12" VB1419G', categorie:'regard', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 21' },
    { ref:'TPTEMP-4', nom:'programmateur Tempus 4 voies avec transformateurs', categorie:'programmateur', tension:'220 V', colisage:'1/12', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPTEMP-6', nom:'programmateur Tempus 6 voies avec transformateurs', categorie:'programmateur', tension:'220 V', colisage:'1/12', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPTEMP-8', nom:'programmateur Tempus 8 voies avec transformateurs', categorie:'programmateur', tension:'220 V', colisage:'1/12', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPTEMP-WF', nom:'module WIFI pour programmateur Tempus', categorie:'accessoire de programmation', source:'patron', releve:'Aqua Plus 2026, p. 22', aVerifier:'ni prix ni colisage imprimés sur la ligne' },
    { ref:'TPEVO4IDEU', nom:'Programmateur EVOLUTION 4 voies intérieur', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPEVO4ODEU', nom:'Programmateur EVOLUTION 4 voies extérieur', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPEMOD4', nom:'Module extension 4 voies', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'TPEMOD12', nom:'Module extension 12 voies', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3242', nom:'ESP-TM2 4 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3193', nom:'ESP-TM2 6 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3146', nom:'ESP-TM2 8 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3147', nom:'ESP-TM2 12 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3315', nom:'CLÉ LNK WIFI ESP/ME-RZX', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3314', nom:'ESP-ME3 WIFI 4 STATIONS', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3312', nom:'module d\'extension ESP 3 stations', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3313', nom:'module d’extension ESP 6 stations', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3322', nom:'ESP-LXME2 12 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3326', nom:'ESP-LXME2 PRO 12 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'RP3329', nom:'Module extension 12 voies', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 22' },
    { ref:'HPXC-E-XC401-E', nom:'programmateur XC-401x-E 4 stations avec coffret verrouillable', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPXC-E-XC601-E', nom:'programmateur XC-601x-E 6 stations avec coffret verrouillable', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPXC-801-X', nom:'programmateur XC-801x-E 8 stations avec coffret verrouillable', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPPC-301-E', nom:'programmateur HPC 4 stations extensible', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HP3942', nom:'module Pro-C et P2C - 3 Stations', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HP3943', nom:'module Pro-C et P2C - 9 Stations', categorie:'accessoire de programmation', colisage:'2', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HP3947', nom:'module Pro-C et P2C - 16 Stations', categorie:'accessoire de programmation', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPX2-4', nom:'programmateur X2 4 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPX2-6', nom:'programmateur X2 6 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPX2-8', nom:'programmateur X2 8 stations', categorie:'programmateur', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'HPX2', nom:'programmateur X2 14 stations', categorie:'programmateur', tension:'220 V', source:'patron', releve:'Aqua Plus 2026, p. 23', aVerifier:'référence « HPX2 » sans suffixe, alors que les autres sont HPX2-4, HPX2-6, HPX2-8 : peut-être tronquée' },
    { ref:'HP3995', nom:'module WIFI 2,4 GHz', categorie:'accessoire de programmation', source:'patron', releve:'Aqua Plus 2026, p. 23' },
    { ref:'SPVIL4', nom:'PROG SOLEM VILLA 4 VOIES', categorie:'programmateur', marque:'SOLEM', tension:'220 V', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SPVIL6', nom:'PROG SOLEM VILLA 6 VOIES', categorie:'programmateur', marque:'SOLEM', tension:'220 V', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SPVIL9', nom:'PROG SOLEM VILLA 9 VOIES', categorie:'programmateur', marque:'SOLEM', tension:'220 V', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SPVIL12', nom:'PROG SOLEM VILLA 12 VOIES', categorie:'programmateur', marque:'SOLEM', tension:'220 V', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP2741', nom:'PROG SOLEM WIFI SMART-IS 2 STATIONS', categorie:'programmateur', marque:'SOLEM', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP2742', nom:'PROG SOLEM WIFI SMART-IS 4 STATIONS', categorie:'programmateur', marque:'SOLEM', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP2743', nom:'PROG SOLEM WIFI SMART-IS 6 STATIONS', categorie:'programmateur', marque:'SOLEM', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP2744', nom:'PROG SOLEM WIFI SMART-IS 9 STATIONS', categorie:'programmateur', marque:'SOLEM', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP2745', nom:'PROG SOLEM WIFI SMART-IS 12 STATIONS', categorie:'programmateur', marque:'SOLEM', tension:'220 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24' },
    { ref:'SP1739', nom:'RELAIS SOLEM LR-MB10', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 24', aVerifier:'même référence aussi imprimée p. 26' },
    { ref:'SP1740', nom:'RELAIS SOLEM LR-MB30', categorie:'accessoire de programmation', marque:'SOLEM', source:'patron', releve:'Aqua Plus 2026, p. 24', aVerifier:'même référence aussi imprimée p. 26' },
    { ref:'AEV11401', nom:'PROG BUDDY TAP TIMER 1 STAT.', categorie:'programmateur', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle ; programmateur de robinet (se visse sur un robinet), pas un programmateur de réseau enterré' },
    { ref:'AEV11422', nom:'PROG BUDDY TAP TIMER 2 STAT.', categorie:'programmateur', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle ; programmateur de robinet (se visse sur un robinet), pas un programmateur de réseau enterré' },
    { ref:'RP13711', nom:'ESP-BAT-BT 1 STATION', categorie:'programmateur', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'RP13722', nom:'ESP-BAT-BT 2 STATIONS', categorie:'programmateur', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'RP13744', nom:'ESP-BAT-BT 4 STATIONS', categorie:'programmateur', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'RP13766', nom:'ESP-BAT-BT 6 STATIONS', categorie:'programmateur', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'RP1313', nom:'KIT ESP-9V + vanne', categorie:'programmateur', tension:'9 V', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'RP1371', nom:'PROG RB ESP 9V 1 VOIE', categorie:'programmateur', tension:'9 V', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'RP1372', nom:'PROG RB ESP 9V 2 VOIES', categorie:'programmateur', tension:'9 V', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'RP1374', nom:'PROG RB ESP 9V 4 VOIES', categorie:'programmateur', tension:'9 V', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'RP1376', nom:'PROG RB ESP 9V 6 VOIES', categorie:'programmateur', tension:'9 V', colisage:'1/6', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'RPJVP300', nom:'solénoïde compact 9V à impulsion LU3100', categorie:'electrovanne', tension:'9 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'solénoïde seul (pièce d\'électrovanne), pas une électrovanne complète' },
    { ref:'HP1500', nom:'NODE 100+ EV PGV prog 1 station avec électrovanne PGV 1" FF', categorie:'programmateur', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension 9 V lue dans la description de la série, pas sur la ligne' },
    { ref:'HP1541', nom:'HUNTER PROG NODE BT 100 + SOLENOIDE 9V', categorie:'programmateur', marque:'Hunter', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25' },
    { ref:'HP1541-L', nom:'HUNTER PROG NODE BT 100', categorie:'programmateur', marque:'Hunter', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension 9 V lue dans la description de la série, pas sur la ligne' },
    { ref:'HP1542', nom:'HUNTER PROG NODE BT 200', categorie:'programmateur', marque:'Hunter', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension 9 V lue dans la description de la série, pas sur la ligne' },
    { ref:'HP1544', nom:'HUNTER PROG NODE BT 400', categorie:'programmateur', marque:'Hunter', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 25', aVerifier:'tension 9 V lue dans la description de la série, pas sur la ligne' },
    { ref:'SP1721', nom:'PROG SOLEM BL-IP 1 STATION 9 V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1722', nom:'PROG SOLEM BL-IP 2 STATION 9 V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1724', nom:'PROG SOLEM BL-IP 4 STATION 9 V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1726', nom:'PROG SOLEM BL-IP 6 STATION 9 V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1741', nom:'PROG SOLEM LR-IP 1 STATION 9V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1742', nom:'PROG SOLEM LR-IP 2 STATION 9V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1743', nom:'PROG SOLEM LR-IP 4 STATION 9V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1744', nom:'PROG SOLEM LR-IP 6 STATION 9V', categorie:'programmateur', marque:'SOLEM', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP1739', nom:'RELAIS SOLEM LR-MB10', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'même référence aussi imprimée p. 24' },
    { ref:'SP1740', nom:'RELAIS SOLEM LR-MB30', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'même référence aussi imprimée p. 24' },
    { ref:'SP174011', nom:'SOLEM MODULE LR-MS 1', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SP67669398', nom:'SONDE SOLEM TRUEBNER SMT50', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26' },
    { ref:'SPWOOBEE1', nom:'PROG SOLEM WOOBEE 1 VOIE', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'SPWOOBEE2', nom:'PROG SOLEM WOOBEE 2 VOIES', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'SPWOOBEE4', nom:'PROG SOLEM WOOBEE 4 VOIES', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'SPWOOBEE6', nom:'PROG SOLEM WOOBEE 6 VOIES', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle' },
    { ref:'SP1151', nom:'Programmateur nez de rob. SOLEM BL - NR - 1 voie', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle ; programmateur de nez de robinet, pas un programmateur de réseau enterré' },
    { ref:'SP1152', nom:'Programmateur nez de rob. SOLEM BL - LR - 1 voie', categorie:'programmateur', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'tension non écrite pour ce modèle ; la désignation dit « BL - LR » sous le titre « SERIE LR - NR » : recopiée telle quelle' },
    { ref:'SP1739', nom:'RELAIS SOLEM LR-MB10', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'même référence aussi imprimée p. 24' },
    { ref:'SP1740', nom:'RELAIS SOLEM LR-MB30', categorie:'accessoire de programmation', marque:'SOLEM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 26', aVerifier:'même référence aussi imprimée p. 24' },
    { ref:'ELDM3', nom:'pile alcaline 1,5V LR6', categorie:'accessoire de programmation', tension:'1,5 V', colisage:'1/4', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'ELD60481', nom:'pile alcaline 9V 6LR61', categorie:'accessoire de programmation', tension:'9 V', colisage:'1/12', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'ELD40034', nom:'accumulateur rechargeable 9V pour SIRR+,HP et DIALOG+', categorie:'accessoire de programmation', tension:'9 V', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'TPTRS', nom:'pluviomètre TRS câblé 7,6 m TORO', categorie:'accessoire de programmation', marque:'Toro', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'ELD1605', nom:'pile CR2032 3V pour RainSensor sans fil', categorie:'accessoire de programmation', tension:'3 V', colisage:'2', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'RP6231', nom:'SONDE SANS FIL WR2-RC Rain Bird', categorie:'accessoire de programmation', marque:'Rain Bird', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence RP6231 imprimée deux fois sur la page, avec deux désignations (« SONDE SANS FIL WR2-RC Rain Bird » et « Sonde de pluie sans fil »)' },
    { ref:'RP403', nom:'sonde pluie RSD-Bex Rain Bird', categorie:'accessoire de programmation', marque:'Rain Bird', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'HPMINICLIK', nom:'pluviomètre Mini-Clik Hunter', categorie:'accessoire de programmation', marque:'Hunter', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'HPRAINCLIK', nom:'pluviomètre Rain-Clik WRC-INT radio Hunter', categorie:'accessoire de programmation', marque:'Hunter', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'RPSMRT-Y', nom:'Sonde d\'humidité de sol SMRT-Y', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'RP6231', nom:'Sonde de pluie sans fil', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence RP6231 imprimée deux fois sur la page, avec deux désignations (« SONDE SANS FIL WR2-RC Rain Bird » et « Sonde de pluie sans fil »)' },
    { ref:'HP6226', nom:'Sonde d\'humidité et solaire Solar SYNC', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'HP6228', nom:'Sonde d\'humidité et solaire Solar SYNC SANS FIL', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'ELC40060', nom:'câble pluviomètre 2 x 0,8 mm²', categorie:'accessoire de programmation', colisage:'1/150/300', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 57' },
    { ref:'ELDTRM85778', nom:'connexion 3M UR2 (la boîte de 100)', categorie:'accessoire de programmation', marque:'3M', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'ELD550077', nom:'connexion étanche 3 fils DBM (3 fils de 1,5 mm²)', categorie:'accessoire de programmation', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 57' },
    { ref:'ELD55008', nom:'connexion étanche jaune DBRY-6 (3 fils de 2,5 mm²)', categorie:'accessoire de programmation', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 57' },
    { ref:'ELDLEG01301', nom:'coffret cache 1 module', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 58' },
    { ref:'ELDLEG01304', nom:'coffret cache 4 modules', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 58' },
    { ref:'ELDLEG01306', nom:'coffret cache 6 modules', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27', aVerifier:'même référence aussi imprimée p. 58' },
    { ref:'RD20001', nom:'transformateur ITC / Image', categorie:'accessoire de programmation', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 27' },
    { ref:'OPL701016', nom:'manchon 16 x 16', categorie:'raccord PE', diametre:'16', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701020', nom:'manchon 20 x 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701025', nom:'manchon 25 x 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701032', nom:'manchon 32 x 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701040', nom:'manchon 40 x 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701050', nom:'manchon 50 x 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701063', nom:'manchon 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701075', nom:'manchon 75 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL701090', nom:'manchon 90 x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL7010110', nom:'manchon 110 x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71102016', nom:'manchon réduit 20 x 16', categorie:'raccord PE', diametre:'20 x 16', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71102516', nom:'manchon réduit 25 x 16', categorie:'raccord PE', diametre:'25 x 16', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71102520', nom:'manchon réduit 25 x 20', categorie:'raccord PE', diametre:'25 x 20', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71103220', nom:'manchon réduit 32 x 20', categorie:'raccord PE', diametre:'32 x 20', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71103225', nom:'manchon réduit 32 x 25', categorie:'raccord PE', diametre:'32 x 25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71104025', nom:'manchon réduit 40 x 25', categorie:'raccord PE', diametre:'40 x 25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71104032', nom:'manchon réduit 40 x 32', categorie:'raccord PE', diametre:'40 x 32', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71105025', nom:'manchon réduit 50 x 25', categorie:'raccord PE', diametre:'50 x 25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71105032', nom:'manchon réduit 50 x 32', categorie:'raccord PE', diametre:'50 x 32', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71105040', nom:'manchon réduit 50 x 40', categorie:'raccord PE', diametre:'50 x 40', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71106325', nom:'manchon réduit 63 x 25', categorie:'raccord PE', diametre:'63 x 25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71106332', nom:'manchon réduit 63 x 32', categorie:'raccord PE', diametre:'63 x 32', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71106340', nom:'manchon réduit 63 x 40', categorie:'raccord PE', diametre:'63 x 40', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71106350', nom:'manchon réduit 63 x 50', categorie:'raccord PE', diametre:'63 x 50', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71107550', nom:'manchon réduit 75 x 50 MILLENIUM', categorie:'raccord PE', diametre:'75 x 50', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71107563', nom:'manchon réduit 75 x 63 MILLENIUM', categorie:'raccord PE', diametre:'75 x 63', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71109063', nom:'manchon réduit 90 x 63 MILLENIUM', categorie:'raccord PE', diametre:'90 x 63', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL71109075', nom:'manchon réduit 90 x 75 MILLENIUM', categorie:'raccord PE', diametre:'90 x 75', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL711011090', nom:'manchon réduit 110 x 90 MILLENIUM', categorie:'raccord PE', diametre:'110 x 90', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761020', nom:'manchon de réparation 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761025', nom:'manchon de réparation 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761032', nom:'manchon de réparation 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761040', nom:'manchon de réparation 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761050', nom:'manchon de réparation 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761063', nom:'manchon de réparation 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761075', nom:'manchon de réparation 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL761090', nom:'manchon de réparation 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL7610110', nom:'manchon de réparation 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 28' },
    { ref:'OPL70201615', nom:'raccord mâle 16 x 1/2"', categorie:'raccord PE', diametre:'16', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70201620', nom:'raccord mâle 16 x 3/4"', categorie:'raccord PE', diametre:'16', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202015', nom:'raccord mâle 20 x 1/2"', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202020', nom:'raccord mâle 20 x 3/4"', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202026', nom:'raccord mâle 20 x 1"', categorie:'raccord PE', diametre:'20', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202515', nom:'raccord mâle 25 x 1/2"', categorie:'raccord PE', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202520', nom:'raccord mâle 25 x 3/4"', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70202526', nom:'raccord mâle 25 x 1"', categorie:'raccord PE', diametre:'25', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70203220', nom:'raccord mâle 32 x 3/4"', categorie:'raccord PE', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70203226', nom:'raccord mâle 32 x 1"', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70203233', nom:'raccord mâle 32 x 1"1/4', categorie:'raccord PE', diametre:'32', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70203240', nom:'raccord mâle 32 x 1"1/2', categorie:'raccord PE', diametre:'32', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70204026', nom:'raccord mâle 40 x 1"', categorie:'raccord PE', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70204033', nom:'raccord mâle 40 x 1"1/4', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70204040', nom:'raccord mâle 40 x 1"1/2', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70204050', nom:'raccord mâle 40 x 2"', categorie:'raccord PE', diametre:'40', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70205026', nom:'raccord mâle 50 x 1"', categorie:'raccord PE', diametre:'50', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70205033', nom:'raccord mâle 50 x 1"1/4', categorie:'raccord PE', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70205040', nom:'raccord mâle 50 x 1"1/2', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70205050', nom:'raccord mâle 50 x 2"', categorie:'raccord PE', diametre:'50', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70206333', nom:'raccord mâle 63 x 1"1/4', categorie:'raccord PE', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70206340', nom:'raccord mâle 63 x 1"1/2', categorie:'raccord PE', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70206350', nom:'raccord mâle 63 x 2"', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70206366', nom:'raccord mâle 63 x 2"1/2', categorie:'raccord PE', diametre:'63', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70207550', nom:'raccord mâle 75 x 2" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70207566', nom:'raccord mâle 75 x 2"1/2 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70207580', nom:'raccord mâle 75 x 3" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70209050', nom:'raccord mâle 90 x 2" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70209066', nom:'raccord mâle 90 x 2"1/2 MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70209080', nom:'raccord mâle 90 x 3" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL702090102', nom:'raccord mâle 90 x 4" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 29', aVerifier:'référence OPL702090102 imprimée deux fois sur la page, pour le 90 x 4" et pour le 110 x 4" : l\'une des deux est fausse' },
    { ref:'OPL702011050', nom:'raccord mâle 110 x 2" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL702011080', nom:'raccord mâle 110 x 3" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL702090102', nom:'raccord mâle 110 x 4" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 29', aVerifier:'référence OPL702090102 imprimée deux fois sur la page, pour le 90 x 4" et pour le 110 x 4" : l\'une des deux est fausse' },
    { ref:'OPL712020', nom:'bouchon mâle 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712025', nom:'bouchon mâle 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712032', nom:'bouchon mâle 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712040', nom:'bouchon mâle 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712050', nom:'bouchon mâle 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712063', nom:'bouchon mâle 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712075', nom:'bouchon mâle 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL712090', nom:'bouchon mâle 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL7120110', nom:'bouchon mâle 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 29' },
    { ref:'OPL70301615', nom:'raccord femelle 16 x 1/2"', categorie:'raccord PE', diametre:'16', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70301620', nom:'raccord femelle 16 x 3/4"', categorie:'raccord PE', diametre:'16', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70302015', nom:'raccord femelle 20 x 1/2"', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70302020', nom:'raccord femelle 20 x 3/4"', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70302026', nom:'raccord femelle 20 x 1"', categorie:'raccord PE', diametre:'20', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70302520', nom:'raccord femelle 25 x 3/4"', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70302526', nom:'raccord femelle 25 x 1"', categorie:'raccord PE', diametre:'25', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70303220', nom:'raccord femelle 32 x 3/4"', categorie:'raccord PE', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70303226', nom:'raccord femelle 32 x 1"', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70303233', nom:'raccord femelle 32 x 1"1/4', categorie:'raccord PE', diametre:'32', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70304026', nom:'raccord femelle 40 x 1"', categorie:'raccord PE', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70304033', nom:'raccord femelle 40 x 1"1/4', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70304040', nom:'raccord femelle 40 x 1"1/2', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70305033', nom:'raccord femelle 50 x 1"1/4', categorie:'raccord PE', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70305040', nom:'raccord femelle 50 x 1"1/2', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70305050', nom:'raccord femelle 50 x 2"', categorie:'raccord PE', diametre:'50', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70306333', nom:'raccord femelle 63 x 1"1/4', categorie:'raccord PE', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70306340', nom:'raccord femelle 63 x 1"1/2', categorie:'raccord PE', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70306350', nom:'raccord femelle 63 x 2"', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70307550', nom:'raccord femelle 75 x 2" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70307566', nom:'raccord femelle 75 x 2"1/2 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70309050', nom:'raccord femelle 90 x 2" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL70309080', nom:'raccord femelle 90 x 3" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL703090102', nom:'raccord femelle 90 x 4" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL703011080', nom:'raccord femelle 110 x 3" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL7030110102', nom:'raccord femelle 110 x 4" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704016', nom:'té 90° 16 x 16 x 16', categorie:'raccord PE', diametre:'16', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704020', nom:'té 90° 20 x 20 x 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704025', nom:'té 90° 25 x 25 x 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704032', nom:'té 90° 32 x 32 x 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704040', nom:'té 90° 40 x 40 x 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704050', nom:'té 90° 50 x 50 x 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704063', nom:'té 90° 63 x 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704075', nom:'té 90° 75 x 75 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704090', nom:'té 90° 90 x 90 x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL7040110', nom:'té 90° 110 x 110 x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704520', nom:'té 90° de réparation 20 x 20 x 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704525', nom:'té 90° de réparation 25 x 25 x 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704532', nom:'té 90° de réparation 32 x 32 x 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704540', nom:'té 90° de réparation 40 x 40 x 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704550', nom:'té 90° de réparation 50 x 50 x 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL704563', nom:'té 90° de réparation 63 x 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 30' },
    { ref:'OPL71401615', nom:'té 90° taraudé 16 x 1/2" x 16', categorie:'raccord PE', diametre:'16', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71401620', nom:'té 90° taraudé 16 x 3/4" x 16', categorie:'raccord PE', diametre:'16', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402015', nom:'té 90° taraudé 20 x 1/2" x 20', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402020', nom:'té 90° taraudé 20 x 3/4" x 20', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402515', nom:'té 90° taraudé 25 x 1/2" x 25', categorie:'raccord PE', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402520', nom:'té 90° taraudé 25 x 3/4" x 25', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402526', nom:'té 90° taraudé 25 x 1" x 25', categorie:'raccord PE', diametre:'25', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71402533', nom:'té 90° taraudé 25 x 1"1/4 x 25', categorie:'raccord PE', diametre:'25', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71403220', nom:'té 90° taraudé 32 x 3/4" x 32', categorie:'raccord PE', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71403226', nom:'té 90° taraudé 32 x 1" x 32', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71403233', nom:'té 90° taraudé 32 x 1"1/4 x 32', categorie:'raccord PE', diametre:'32', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71403240', nom:'té 90° taraudé 32 x 1"1/2 x 32', categorie:'raccord PE', diametre:'32', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71404026', nom:'té 90° taraudé 40 x 1" x 40', categorie:'raccord PE', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71404033', nom:'té 90° taraudé 40 x 1"1/4 x 40', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71404040', nom:'té 90° taraudé 40 x 1"1/2 x 40', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71404050', nom:'té 90° taraudé 40 x 2" x 40', categorie:'raccord PE', diametre:'40', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71405040', nom:'té 90° taraudé 50 x 1"1/2 x 50', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71405050', nom:'té 90° taraudé 50 x 2" x 50', categorie:'raccord PE', diametre:'50', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71406333', nom:'té 90° taraudé 63 x 1"1/4" x 63', categorie:'raccord PE', diametre:'63', filetage:'1"1/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71406340', nom:'té 90° taraudé 63 x 1"1/2" x 63', categorie:'raccord PE', diametre:'63', filetage:'1"1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71406350', nom:'té 90° taraudé 63 x 2" x 63', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71407550', nom:'té 90° taraudé 75 x 2" x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71407566', nom:'té 90° taraudé 75 x 2"1/2 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71407580', nom:'té 90° taraudé 75 x 3" x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL71409080', nom:'té 90° taraudé 90 x 3" x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL7140110102', nom:'té 90° taraudé 110 x 4" x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78402015', nom:'té 90° fileté 20 x 1/2" x 20', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78402020', nom:'té 90° fileté 20 x 3/4" x 20', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78402515', nom:'té 90° fileté 25 x 1/2" x 25', categorie:'raccord PE', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78402520', nom:'té 90° fileté 25 x 3/4" x 25', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78403226', nom:'té 90° fileté 32 x 1" x 32', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78404033', nom:'té 90° fileté 40 x 1"1/4 x 40', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78404040', nom:'té 90° fileté 40 x 1"1/2 x 40', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78405033', nom:'té 90° fileté 50 x 1"1/4 x 50', categorie:'raccord PE', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78405040', nom:'té 90° fileté 50 x 1"1/2 x 50', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78406333', nom:'té 90° fileté 63 x 1"1/4 x 63', categorie:'raccord PE', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78406340', nom:'té 90° fileté 63 x 1"1/2 x 63', categorie:'raccord PE', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL78406350', nom:'té 90° fileté 63 x 2" x 63', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL764063', nom:'té 45° 63 x 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL764075', nom:'té 45° 75 x 75 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL764090', nom:'té 45° 90 x 90 x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL7640110', nom:'té 45° 110 x 110 x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 31' },
    { ref:'OPL73402016', nom:'té 90° réduit 20 x 16 x 20', categorie:'raccord PE', diametre:'20 x 16 x 20', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73402520', nom:'té 90° réduit 25 x 20 x 25', categorie:'raccord PE', diametre:'25 x 20 x 25', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73403225', nom:'té 90° réduit 32 x 25 x 32', categorie:'raccord PE', diametre:'32 x 25 x 32', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73404025', nom:'té 90° réduit 40 x 25 x 40', categorie:'raccord PE', diametre:'40 x 25 x 40', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73404032', nom:'té 90° réduit 40 x 32 x 40', categorie:'raccord PE', diametre:'40 x 32 x 40', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73405025', nom:'té 90° réduit 50 x 25 x 50', categorie:'raccord PE', diametre:'50 x 25 x 50', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73405032', nom:'té 90° réduit 50 x 32 x 50', categorie:'raccord PE', diametre:'50 x 32 x 50', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73405040', nom:'té 90° réduit 50 x 40 x 50', categorie:'raccord PE', diametre:'50 x 40 x 50', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73406332', nom:'té 90° réduit 63 x 32 x 63', categorie:'raccord PE', diametre:'63 x 32 x 63', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73406340', nom:'té 90° réduit 63 x 40 x 63', categorie:'raccord PE', diametre:'63 x 40 x 63', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73406350', nom:'té 90° réduit 63 x 50 x 63', categorie:'raccord PE', diametre:'63 x 50 x 63', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL73407563', nom:'té 90° réduit 75 x 63 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75 x 63 x 75', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705016', nom:'coude à 90° 16 x 16', categorie:'raccord PE', diametre:'16', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705020', nom:'coude à 90° 20 x 20', categorie:'raccord PE', diametre:'20', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705025', nom:'coude à 90° 25 x 25', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705032', nom:'coude à 90° 32 x 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705040', nom:'coude à 90° 40 x 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705050', nom:'coude à 90° 50 x 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705063', nom:'coude à 90° 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705075', nom:'coude à 90° 75 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL705090', nom:'coude à 90° 90 x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL7050110', nom:'coude à 90° 110 x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78502015', nom:'coude fileté 20 x 1/2"', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78502020', nom:'coude fileté 20 x 3/4"', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78502515', nom:'coude fileté 25 x 1/2"', categorie:'raccord PE', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78502520', nom:'coude fileté 25 x 3/4"', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78502526', nom:'coude fileté 25 x 1"', categorie:'raccord PE', diametre:'25', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78503226', nom:'coude fileté 32 x 1"', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78503233', nom:'coude fileté 32 x 1"1/4', categorie:'raccord PE', diametre:'32', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78504026', nom:'coude fileté 40 x 1"', categorie:'raccord PE', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78504033', nom:'coude fileté 40 x 1"1/4', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78504040', nom:'coude fileté 40 x 1"1/2', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78505026', nom:'coude fileté 50 x 1"', categorie:'raccord PE', diametre:'50', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78505033', nom:'coude fileté 50 x 1"1/4', categorie:'raccord PE', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78505040', nom:'coude fileté 50 x 1"1/2', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78506333', nom:'coude fileté 63 x 1"1/4', categorie:'raccord PE', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78506340', nom:'coude fileté 63 x 1"1/2', categorie:'raccord PE', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78506350', nom:'coude fileté 63 x 2"', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78507560', nom:'coude fileté 75 x 2"1/2 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78507580', nom:'coude fileté 75 x 3" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL78509080', nom:'coude fileté 90 x 3" MILLENIUM', categorie:'raccord PE', diametre:'90', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL7850110102', nom:'coude fileté 110 x 4" MILLENIUM', categorie:'raccord PE', diametre:'110', filetage:'4"', source:'patron', releve:'Aqua Plus 2026, p. 32' },
    { ref:'OPL71501615', nom:'coude taraudé 16 x 1/2"', categorie:'raccord PE', diametre:'16', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71502015', nom:'coude taraudé 20 x 1/2"', categorie:'raccord PE', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71502020', nom:'coude taraudé 20 x 3/4"', categorie:'raccord PE', diametre:'20', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71502515', nom:'coude taraudé 25 x 1/2"', categorie:'raccord PE', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71502520', nom:'coude taraudé 25 x 3/4"', categorie:'raccord PE', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71502526', nom:'coude taraudé 25 x 1"', categorie:'raccord PE', diametre:'25', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71503220', nom:'coude taraudé 32 x 3/4"', categorie:'raccord PE', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71503226', nom:'coude taraudé 32 x 1"', categorie:'raccord PE', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71503233', nom:'coude taraudé 32 x 1"1/4', categorie:'raccord PE', diametre:'32', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71504026', nom:'coude taraudé 40 x 1"', categorie:'raccord PE', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71504033', nom:'coude taraudé 40 x 1"1/4', categorie:'raccord PE', diametre:'40', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71504040', nom:'coude taraudé 40 x 1"1/2', categorie:'raccord PE', diametre:'40', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71504050', nom:'coude taraudé 40 x 2"', categorie:'raccord PE', diametre:'40', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71505026', nom:'coude taraudé 50 x 1"', categorie:'raccord PE', diametre:'50', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71505033', nom:'coude taraudé 50 x 1"1/4', categorie:'raccord PE', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71505040', nom:'coude taraudé 50 x 1"1/2', categorie:'raccord PE', diametre:'50', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71505050', nom:'coude taraudé 50 x 2"', categorie:'raccord PE', diametre:'50', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71506333', nom:'coude taraudé 63 x 1"1/4', categorie:'raccord PE', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71506340', nom:'coude taraudé 63 x 1"1/2', categorie:'raccord PE', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71506350', nom:'coude taraudé 63 x 2"', categorie:'raccord PE', diametre:'63', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71507550', nom:'coude taraudé 75 x 2" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71507566', nom:'coude taraudé 75 x 2"1/2 MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL71507580', nom:'coude taraudé 75 x 3" MILLENIUM', categorie:'raccord PE', diametre:'75', filetage:'3"', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746032', nom:'coude à 45° 32 x 32', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746040', nom:'coude à 45° 40 x 40', categorie:'raccord PE', diametre:'40', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746050', nom:'coude à 45° 50 x 50', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746063', nom:'coude à 45° 63 x 63', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746075', nom:'coude à 45° 75 x 75 MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL746090', nom:'coude à 45° 90 x 90 MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL7460110', nom:'coude à 45° 110 x 110 MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72205040', nom:'raccord à bride 50 DN 40 (1"1/2)', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72205050', nom:'raccord à bride 50 DN 50 (2")', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72206350', nom:'raccord à bride 63 DN 50 (2")', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72207565', nom:'raccord à bride 75 DN 65 (2"1/2) MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72209080', nom:'raccord à bride 90 DN 80 (3") MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL722090100', nom:'raccord à bride 90 DN 100 (4") MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL7220110100', nom:'raccord à bride 110 DN 100 (4") MILLENIUM', categorie:'raccord PE', diametre:'110', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL7220125125', nom:'raccord à bride 125 DN 125 (5")', categorie:'raccord PE', diametre:'125', source:'patron', releve:'Aqua Plus 2026, p. 33' },
    { ref:'OPL72365040', nom:'adaptateur à bride 50 DN 40 (1"1/2)', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL72366365', nom:'adaptateur à bride 63 DN 65 (2"1/2)', categorie:'raccord PE', diametre:'63', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL72367560', nom:'adaptateur à bride 75 DN 65 (2"1/2) MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL72367580', nom:'adaptateur à bride 75 DN 80 (3") MILLENIUM', categorie:'raccord PE', diametre:'75', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL72369060', nom:'adaptateur à bride 90 DN 65 (2"1/2) MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL72369080', nom:'adaptateur à bride 90 DN 80 (3") MILLENIUM', categorie:'raccord PE', diametre:'90', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79302520', nom:'set de réduction 25 x 20', categorie:'raccord PE', diametre:'25 x 20', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79303220', nom:'set de réduction 32 x 20', categorie:'raccord PE', diametre:'32 x 20', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79303225', nom:'set de réduction 32 x 25', categorie:'raccord PE', diametre:'32 x 25', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79304032', nom:'set de réduction 40 x 32', categorie:'raccord PE', diametre:'40 x 32', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79305025', nom:'set de réduction 50 x 25', categorie:'raccord PE', diametre:'50 x 25', source:'patron', releve:'Aqua Plus 2026, p. 34', aVerifier:'référence OPL79305025 imprimée deux fois, pour le 50 x 25 et pour le 63 x 25 : l\'une des deux est fausse' },
    { ref:'OPL79305032', nom:'set de réduction 50 x 32', categorie:'raccord PE', diametre:'50 x 32', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79305040', nom:'set de réduction 50 x 40', categorie:'raccord PE', diametre:'50 x 40', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79305025', nom:'set de réduction 63 x 25', categorie:'raccord PE', diametre:'63 x 25', source:'patron', releve:'Aqua Plus 2026, p. 34', aVerifier:'référence OPL79305025 imprimée deux fois, pour le 50 x 25 et pour le 63 x 25 : l\'une des deux est fausse' },
    { ref:'OPL79306340', nom:'set de réduction 63 x 40', categorie:'raccord PE', diametre:'63 x 40', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPL79306350', nom:'set de réduction 63 x 50', categorie:'raccord PE', diametre:'63 x 50', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD770101522', nom:'manchon PLASS4 25 x (15 - 22)', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD770102027', nom:'manchon PLASS4 25 x (20 - 27)', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD77010273525', nom:'manchon PLASS4 25 x (27 - 35)', categorie:'raccord PE', diametre:'25', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD77010202732', nom:'manchon PLASS4 32 x (20 - 27)', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD770102735', nom:'manchon PLASS4 32 x (27 - 35)', categorie:'raccord PE', diametre:'32', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OD770103550', nom:'manchon PLASS4 50 x (35 - 50)', categorie:'raccord PE', diametre:'50', source:'patron', releve:'Aqua Plus 2026, p. 34' },
    { ref:'OPP506715', nom:'mamelon double 1/2" x 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP506720', nom:'mamelon double 3/4" x 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP506726', nom:'mamelon double 1" x 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP506733', nom:'mamelon double 1"1/4 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP506740', nom:'mamelon double 1"1/2 x 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP506750', nom:'mamelon double 2" x 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50652015', nom:'mamelon réduit 3/4" x 1/2"', categorie:'raccord polypro', filetage:'3/4" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50652615', nom:'mamelon réduit 1" x 1/2"', categorie:'raccord polypro', filetage:'1" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50652620', nom:'mamelon réduit 1" x 3/4"', categorie:'raccord polypro', filetage:'1" x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50653315', nom:'mamelon réduit 1"1/4 x 1/2"', categorie:'raccord polypro', filetage:'1"1/4 x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50653320', nom:'mamelon réduit 1"1/4 x 3/4"', categorie:'raccord polypro', filetage:'1"1/4 x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50653326', nom:'mamelon réduit 1"1/4 x 1"', categorie:'raccord polypro', filetage:'1"1/4 x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50654015', nom:'mamelon réduit 1"1/2 x 1/2"', categorie:'raccord polypro', filetage:'1"1/2 x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50654020', nom:'mamelon réduit 1"1/2 x 3/4"', categorie:'raccord polypro', filetage:'1"1/2 x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50654026', nom:'mamelon réduit 1"1/2 x 1"', categorie:'raccord polypro', filetage:'1"1/2 x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50654033', nom:'mamelon réduit 1"1/2 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/2 x 1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50655015', nom:'mamelon réduit 2" x 1/2"', categorie:'raccord polypro', filetage:'2" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50655020', nom:'mamelon réduit 2" x 3/4"', categorie:'raccord polypro', filetage:'2" x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50655026', nom:'mamelon réduit 2" x 1"', categorie:'raccord polypro', filetage:'2" x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50655033', nom:'mamelon réduit 2" x 1"1/4', categorie:'raccord polypro', filetage:'2" x 1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50655040', nom:'mamelon réduit 2" x 1"1/2', categorie:'raccord polypro', filetage:'2" x 1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50272015', nom:'manchon réduit MxF 3/4" x 1/2"', categorie:'raccord polypro', filetage:'3/4" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50272615', nom:'manchon réduit MxF 1" x 1/2"', categorie:'raccord polypro', filetage:'1" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50272620', nom:'manchon réduit MxF 1" x 3/4"', categorie:'raccord polypro', filetage:'1" x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50273315', nom:'manchon réduit MxF 1"1/4 x 1/2"', categorie:'raccord polypro', filetage:'1"1/4 x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50273320', nom:'manchon réduit MxF 1"1/4 x 3/4"', categorie:'raccord polypro', filetage:'1"1/4 x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50273326', nom:'manchon réduit MxF 1"1/4 x 1"', categorie:'raccord polypro', filetage:'1"1/4 x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50274015', nom:'manchon réduit MxF 1"1/2 x 1/2"', categorie:'raccord polypro', filetage:'1"1/2 x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50274020', nom:'manchon réduit MxF 1"1/2 x 3/4"', categorie:'raccord polypro', filetage:'1"1/2 x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50274026', nom:'manchon réduit MxF 1"1/2 x 1"', categorie:'raccord polypro', filetage:'1"1/2 x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50274033', nom:'manchon réduit MxF 1"1/2 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/2 x 1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50275015', nom:'manchon réduit MxF 2" x 1/2"', categorie:'raccord polypro', filetage:'2" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50275020', nom:'manchon réduit MxF 2" x 3/4"', categorie:'raccord polypro', filetage:'2" x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50275026', nom:'manchon réduit MxF 2" x 1"', categorie:'raccord polypro', filetage:'2" x 1"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50275033', nom:'manchon réduit MxF 2" x 1"1/4', categorie:'raccord polypro', filetage:'2" x 1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50275040', nom:'manchon réduit MxF 2" x 1"1/2', categorie:'raccord polypro', filetage:'2" x 1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50276650', nom:'manchon réduit MxF 2"1/2 x 2"', categorie:'raccord polypro', filetage:'2"1/2 x 2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50278040', nom:'manchon réduit MxF 3" x 1"1/2', categorie:'raccord polypro', filetage:'3" x 1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50278050', nom:'manchon réduit MxF 3" x 2"', categorie:'raccord polypro', filetage:'3" x 2"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP50278065', nom:'manchon réduit MxF 3" x 2"1/2', categorie:'raccord polypro', filetage:'3" x 2"1/2', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP502710280', nom:'manchon réduit MxF 4" x 3"', categorie:'raccord polypro', filetage:'4" x 3"', source:'patron', releve:'Aqua Plus 2026, p. 35' },
    { ref:'OPP501715', nom:'manchon 1/2" x 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP501720', nom:'manchon 3/4" x 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP501726', nom:'manchon 1" x 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP501733', nom:'manchon 1"1/4 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP501740', nom:'manchon 1"1/2 x 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP501750', nom:'manchon 2" x 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504715', nom:'té 90° 1/2" x 1/2" x 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504720', nom:'té 90° 3/4" x 3/4" x 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504726', nom:'té 90° 1" x 1" x 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504733', nom:'té 90° 1"1/4 x 1"1/4 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504740', nom:'té 90° 1"1/2 x 1"1/2 x 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP504750', nom:'té 90° 2" x 2" x 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505715', nom:'coude 90° 1/2" x 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505720', nom:'coude 90° 3/4" x 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505726', nom:'coude 90° 1" x 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505733', nom:'coude 90° 1"1/4 x 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505740', nom:'coude 90° 1"1/2 x 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505750', nom:'coude 90° 2" x 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507715', nom:'bouchon taraudé 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507720', nom:'bouchon taraudé 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507726', nom:'bouchon taraudé 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507733', nom:'bouchon taraudé 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507740', nom:'bouchon taraudé 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP507750', nom:'bouchon taraudé 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517715', nom:'bouchon fileté 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517720', nom:'bouchon fileté 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517726', nom:'bouchon fileté 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517733', nom:'bouchon fileté 1"1/4', categorie:'raccord polypro', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517740', nom:'bouchon fileté 1"1/2', categorie:'raccord polypro', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP517750', nom:'bouchon fileté 2"', categorie:'raccord polypro', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP50372015', nom:'manchon réduit FxM 3/4" x 1/2"', categorie:'raccord polypro', filetage:'3/4" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP50372615', nom:'manchon réduit FxM 1" x 1/2"', categorie:'raccord polypro', filetage:'1" x 1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP50372620', nom:'manchon réduit FxM 1" x 3/4"', categorie:'raccord polypro', filetage:'1" x 3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505915', nom:'coude 90° MxF 1/2"', categorie:'raccord polypro', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505920', nom:'coude 90° MxF 3/4"', categorie:'raccord polypro', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OPP505926', nom:'coude 90° MxF 1"', categorie:'raccord polypro', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 36' },
    { ref:'OD60862015', nom:'CPC 20 x 1/2"', categorie:'collier', diametre:'20', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60862515', nom:'CPC 25 x 1/2"', categorie:'collier', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60862520', nom:'CPC 25 x 3/4"', categorie:'collier', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60863215', nom:'CPC 32 x 1/2"', categorie:'collier', diametre:'32', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60863220', nom:'CPC 32 x 3/4"', categorie:'collier', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60863226', nom:'CPC 32 x 1"', categorie:'collier', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60864015', nom:'CPC 40 x 1/2"', categorie:'collier', diametre:'40', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60864020', nom:'CPC 40 x 3/4"', categorie:'collier', diametre:'40', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60864026', nom:'CPC 40 x 1"', categorie:'collier', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60865015', nom:'CPC 50 x 1/2"', categorie:'collier', diametre:'50', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60865020', nom:'CPC 50 x 3/4"', categorie:'collier', diametre:'50', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60865026', nom:'CPC 50 x 1"', categorie:'collier', diametre:'50', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60865033', nom:'CPC 50 x 1"1/4', categorie:'collier', diametre:'50', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60866315', nom:'CPC 63 x 1/2"', categorie:'collier', diametre:'63', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60866320', nom:'CPC 63 x 3/4"', categorie:'collier', diametre:'63', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60866326', nom:'CPC 63 x 1"', categorie:'collier', diametre:'63', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60866333', nom:'CPC 63 x 1"1/4', categorie:'collier', diametre:'63', filetage:'1"1/4', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD60866340', nom:'CPC 63 x 1"1/2', categorie:'collier', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160762515', nom:'CPC renforcé 25 x 1/2"', categorie:'collier', diametre:'25', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160762520', nom:'CPC renforcé 25 x 3/4"', categorie:'collier', diametre:'25', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160763215', nom:'CPC renforcé 32 x 1/2"', categorie:'collier', diametre:'32', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160763220', nom:'CPC renforcé 32 x 3/4"', categorie:'collier', diametre:'32', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160763226', nom:'CPC renforcé 32 x 1"', categorie:'collier', diametre:'32', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160764015', nom:'CPC renforcé 40 x 1/2"', categorie:'collier', diametre:'40', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160764020', nom:'CPC renforcé 40 x 3/4"', categorie:'collier', diametre:'40', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160764026', nom:'CPC renforcé 40 x 1"', categorie:'collier', diametre:'40', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160765015', nom:'CPC renforcé 50 x 1/2"', categorie:'collier', diametre:'50', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160765020', nom:'CPC renforcé 50 x 3/4"', categorie:'collier', diametre:'50', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160765026', nom:'CPC renforcé 50 x 1"', categorie:'collier', diametre:'50', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160766315', nom:'CPC renforcé 63 x 1/2"', categorie:'collier', diametre:'63', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160766320', nom:'CPC renforcé 63 x 3/4"', categorie:'collier', diametre:'63', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160766326', nom:'CPC renforcé 63 x 1"', categorie:'collier', diametre:'63', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160766340', nom:'CPC renforcé 63 x 1"1/2', categorie:'collier', diametre:'63', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160767515', nom:'CPC renforcé 75 x 1/2"', categorie:'collier', diametre:'75', filetage:'1/2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160767520', nom:'CPC renforcé 75 x 3/4"', categorie:'collier', diametre:'75', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160767526', nom:'CPC renforcé 75 x 1"', categorie:'collier', diametre:'75', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160767540', nom:'CPC renforcé 75 x 1"1/2', categorie:'collier', diametre:'75', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160767550', nom:'CPC renforcé 75 x 2"', categorie:'collier', diametre:'75', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160769020', nom:'CPC renforcé 90 x 3,4"', categorie:'collier', diametre:'90', filetage:'3,4"', source:'patron', releve:'Aqua Plus 2026, p. 37', aVerifier:'filetage imprimé « 3,4" » : probablement 3/4" (la référence finit par 20 comme les autres 3/4"), à confirmer' },
    { ref:'OD160769026', nom:'CPC renforcé 90 x 1"', categorie:'collier', diametre:'90', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160769040', nom:'CPC renforcé 90 x 1"1/2', categorie:'collier', diametre:'90', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD160769050', nom:'CPC renforcé 90 x 2"', categorie:'collier', diametre:'90', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD17111020', nom:'CPC renforcé 110 x 3/4"', categorie:'collier', diametre:'110', filetage:'3/4"', source:'patron', releve:'Aqua Plus 2026, p. 37', aVerifier:'référence de forme différente de ses voisines (OD1607611026…) : recopiée telle quelle' },
    { ref:'OD1607611026', nom:'CPC renforcé 110 x 1"', categorie:'collier', diametre:'110', filetage:'1"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'OD1701140', nom:'CPC renforcé 110 x 1"1/2', categorie:'collier', diametre:'110', filetage:'1"1/2', source:'patron', releve:'Aqua Plus 2026, p. 37', aVerifier:'référence de forme différente de ses voisines (OD1607611026…) : recopiée telle quelle' },
    { ref:'OD1607611050', nom:'CPC renforcé 110 x 2"', categorie:'collier', diametre:'110', filetage:'2"', source:'patron', releve:'Aqua Plus 2026, p. 37' },
    { ref:'UPE500600', nom:'tube P.E.B.D. Ø 16mm 4 bars (13,6 x 16)', categorie:'tube PE', diametre:'16', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE101220', nom:'tube P.E.B.D. Ø 20mm 4 bars (17,2 x 20)', categorie:'tube PE', diametre:'20', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE1116', nom:'tube P.E.B.D. Ø 16mm 6,3 bars (12 x 16)', categorie:'tube PE', diametre:'16', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer ; même référence aussi imprimée p. 14' },
    { ref:'UPE220', nom:'tube P.E.H.D. irrigation Ø 20mm 10 bars (15,4 x 20)', categorie:'tube PE', diametre:'20', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE225', nom:'tube P.E.H.D. irrigation Ø 25mm 10 bars (20,4 x 25)', categorie:'tube PE', diametre:'25', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE232', nom:'tube P.E.H.D. irrigation Ø 32mm 10 bars (26,2 x 32)', categorie:'tube PE', diametre:'32', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE240', nom:'tube P.E.H.D. NF Ø 40mm 10 bars (32,6 x 40)', categorie:'tube PE', diametre:'40', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE250', nom:'tube P.E.H.D. NF Ø 50mm 10 bars (40,8 x 50)', categorie:'tube PE', diametre:'50', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE263', nom:'tube P.E.H.D. NF Ø 63mm 10 bars (51,4 x 63)', categorie:'tube PE', diametre:'63', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE275', nom:'tube P.E.H.D. NF Ø 75mm 10 bars (61,4 x 75)', categorie:'tube PE', diametre:'75', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UPE290', nom:'tube P.E.H.D. irrigation Ø 90mm 10 bars (73,6 x 90)', categorie:'tube PE', diametre:'90', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 47', aVerifier:'longueur de couronne non écrite ; le colisage (50) est peut-être la couronne en mètres, à confirmer' },
    { ref:'UGGMC-206', nom:'G A G Ø 6MM 0.15M 2L/H 30ML', categorie:'goutte-à-goutte', diametre:'6', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48' },
    { ref:'UGGMC-206_N', nom:'G AG Ø 6MM 0.15M 2L/H 30ML noir', categorie:'goutte-à-goutte', diametre:'6', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'désignation imprimée « G AG » (la ligne du dessus dit « G A G ») : recopiée telle quelle' },
    { ref:'UGGCBL23050', nom:'tube Ø16mm 2l/h esp.33cm autorégulé', categorie:'goutte-à-goutte', diametre:'16', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 48' },
    { ref:'UGGRBXFS', nom:'tube Ø16mm 2,3l/h esp.33cm autorégulé enterrable', categorie:'goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 48' },
    { ref:'UGG1516', nom:'tuyau poreux Ø 16mm 4l/h par mètre à 0.5 bars - PS maxi 1 bar', categorie:'goutte-à-goutte', diametre:'16', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 48' },
    { ref:'MIAOCTA8', nom:'schrubbler réglable 0 à 50l/h bouton can 4x6mm', categorie:'goutte-à-goutte', diametre:'4x6mm', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIAOCTA8P', nom:'schrubbler réglable 0 à 50l/h sur pique 10cm', categorie:'goutte-à-goutte', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIALST4A', nom:'pique 30cm avec tubing 40cm prise d\'eau 4x6m (Micro Stake)', categorie:'goutte-à-goutte', diametre:'4x6m', colisage:'1/100', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA4254', nom:'allonge 30cm (pour MIALST4A)', categorie:'goutte-à-goutte', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2131', nom:'micro jet 360° 98l/h - réglable 0 à 4m', categorie:'goutte-à-goutte', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2132', nom:'micro jet 180° 98l/h - réglable 0 à 3m', categorie:'goutte-à-goutte', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2133', nom:'micro jet 90° 98l/h - réglable 0 à 2,9m', categorie:'goutte-à-goutte', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA5121', nom:'VARI AQUILA SPIKE 360°', categorie:'goutte-à-goutte', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA5122', nom:'VARI AQUILA SPIKE 180°', categorie:'goutte-à-goutte', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA5123', nom:'VARI AQUILA SPIKE 90°', categorie:'goutte-à-goutte', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA20340', nom:'micro jet brouillard 20l/h - 0,4m', categorie:'goutte-à-goutte', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2137', nom:'micro jet rotatif 360° 123l/h - réglable 0 à 4m', categorie:'goutte-à-goutte', colisage:'25', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2035', nom:'MICRO SINGLE JET STRIP BLEU', categorie:'goutte-à-goutte', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIA2036', nom:'MINIJET 90° BLEU (100)', categorie:'goutte-à-goutte', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIDT7MM25', nom:'micro-tube 4x6mm par 25ml', categorie:'goutte-à-goutte', diametre:'4x6mm', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MIDT7MM50', nom:'micro-tube 4x6mm par 50ml', categorie:'goutte-à-goutte', diametre:'4x6mm', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 48', aVerifier:'diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-à-goutte : classé « goutte-à-goutte » faute de catégorie plus juste' },
    { ref:'MID3904', nom:'perceur 3mm pour PE', categorie:'raccord goutte-à-goutte', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 49', aVerifier:'outil (perceur), pas un raccord : classé avec les accessoires pour micro-tube où le catalogue le range' },
    { ref:'MID1221', nom:'perceur pince 3mm 16/20', categorie:'raccord goutte-à-goutte', source:'patron', releve:'Aqua Plus 2026, p. 49', aVerifier:'outil (perceur), pas un raccord : classé avec les accessoires pour micro-tube où le catalogue le range' },
    { ref:'MID1222', nom:'perceur pince 3mm 25/32', categorie:'raccord goutte-à-goutte', source:'patron', releve:'Aqua Plus 2026, p. 49', aVerifier:'outil (perceur), pas un raccord : classé avec les accessoires pour micro-tube où le catalogue le range' },
    { ref:'MID3201', nom:'prise d\'eau 4x6mm', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID3302', nom:'té 4x6mm', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID3303', nom:'croix 4x6mm', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID3304', nom:'coude 4x6mm', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID3412', nom:'bouchon gaffeur 4x6mm - grappe de 10', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MIAL3401', nom:'vannette 4x6mm', categorie:'raccord goutte-à-goutte', diametre:'4x6mm', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6101', nom:'jonction cannelée Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6102', nom:'jonction cannelée Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6121', nom:'té cannelé Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6122', nom:'té cannelé Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6141', nom:'coude cannelé Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6142', nom:'coude cannelé Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6171', nom:'bouchon cannelé Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6172', nom:'bouchon cannelé Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6451', nom:'bouchon "8 fin de ligne" Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6711', nom:'collier plastique Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6712', nom:'collier plastique Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6511', nom:'crampon de sol Ø 16-20 noir', categorie:'raccord goutte-à-goutte', diametre:'16-20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6514', nom:'crampon de sol Ø 16-20 marron', categorie:'raccord goutte-à-goutte', diametre:'16-20', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6151', nom:'embout can Ø 16 x fil 1/2"', categorie:'raccord goutte-à-goutte', diametre:'16', filetage:'1/2"', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6152', nom:'embout can Ø 16 x fil 3/4"', categorie:'raccord goutte-à-goutte', diametre:'16', filetage:'3/4"', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6254', nom:'embout can Ø 20 x fil 3/4"', categorie:'raccord goutte-à-goutte', diametre:'20', filetage:'3/4"', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6162', nom:'embout can Ø 16 x tar 3/4" écrou tournant + joint', categorie:'raccord goutte-à-goutte', diametre:'16', filetage:'3/4"', colisage:'100', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6601', nom:'vannette plastique cannelée Ø 16 x 16', categorie:'raccord goutte-à-goutte', diametre:'16', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6602', nom:'vannette plastique cannelée Ø 20 x 20', categorie:'raccord goutte-à-goutte', diametre:'20', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6611', nom:'vannette plastique fil 3/4" x cannelée Ø 16', categorie:'raccord goutte-à-goutte', diametre:'16', filetage:'3/4"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6612', nom:'vannette plastique fil 3/4" x cannelée Ø 20', categorie:'raccord goutte-à-goutte', diametre:'20', filetage:'3/4"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6621', nom:'vannette plastique fil 1/2" x 1/2"', categorie:'raccord goutte-à-goutte', filetage:'1/2"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID31562020', nom:'vannette plastique fil 3/4" x 3/4"', categorie:'raccord goutte-à-goutte', filetage:'3/4"', colisage:'50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6301', nom:'jonction Palaplast Ø16', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6321', nom:'té Palaplast Ø16', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6341', nom:'coude Palaplast Ø16', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6352', nom:'embout fileté Palaplast 16 x 3/4"', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', filetage:'3/4"', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6362', nom:'embout Palaplast taraudé 16 x 3/4"', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', filetage:'3/4"', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6371', nom:'bouchon Palaplast Ø16', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'MID6631', nom:'vannette Palaplast Ø16', categorie:'raccord goutte-à-goutte', marque:'Palaplast', diametre:'16', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 49' },
    { ref:'BFI2011', nom:'filtre plastique MM 3/4" - tamis inox 130μ', categorie:'robinetterie', diametre:'3/4"', filetage:'MM', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BFI210140', nom:'filtre plastique à disque ARKAL 130μ fil 3/4"', categorie:'robinetterie', marque:'ARKAL', diametre:'3/4"', filetage:'fil', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BFI210110', nom:'filtre plastique à disque ARKAL 130μ fil 1"', categorie:'robinetterie', marque:'ARKAL', diametre:'1"', filetage:'fil', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BFI210313', nom:'filtre plastique à disque ARKAL 130μ fil 1"1/2', categorie:'robinetterie', marque:'ARKAL', diametre:'1"1/2', filetage:'fil', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BDI9001', nom:'clapet antipollution type EA 3/4"', categorie:'robinetterie', diametre:'3/4"', filetage:'entrée union femelle, sortie mâle', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BDI9002', nom:'clapet antipollution type EA 1"', categorie:'robinetterie', diametre:'1"', filetage:'entrée union femelle, sortie mâle', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BDI9003', nom:'clapet antipollution type EA 1"1/4', categorie:'robinetterie', diametre:'1"1/4', filetage:'entrée union femelle, sortie mâle', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BDI9004', nom:'clapet antipollution type EA 1"1/2', categorie:'robinetterie', diametre:'1"1/2', filetage:'entrée union femelle, sortie mâle', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BDI9005', nom:'clapet antipollution type EA 2"', categorie:'robinetterie', diametre:'2"', filetage:'entrée union femelle, sortie mâle', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 55' },
    { ref:'BVA3861', nom:'vanne 1/4 de tour FF 1/2"', categorie:'robinetterie', diametre:'1/2"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA3862', nom:'vanne 1/4 de tour FF 3/4"', categorie:'robinetterie', diametre:'3/4"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA3863', nom:'vanne 1/4 de tour FF 1"', categorie:'robinetterie', diametre:'1"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA3864', nom:'vanne 1/4 de tour FF 1"1/4', categorie:'robinetterie', diametre:'1"1/4', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA3865', nom:'vanne 1/4 de tour FF 1"1/2', categorie:'robinetterie', diametre:'1"1/2', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA3866', nom:'vanne 1/4 de tour FF 2"', categorie:'robinetterie', diametre:'2"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA931', nom:'vanne 1/4 de tour + purge FF 1/2"', categorie:'robinetterie', diametre:'1/2"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA932', nom:'vanne 1/4 de tour + purge FF 3/4"', categorie:'robinetterie', diametre:'3/4"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA933', nom:'vanne 1/4 de tour + purge FF 1"', categorie:'robinetterie', diametre:'1"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA934', nom:'vanne 1/4 de tour + purge FF 1"1/4', categorie:'robinetterie', diametre:'1"1/4', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA935', nom:'vanne 1/4 de tour + purge FF 1"1/2', categorie:'robinetterie', diametre:'1"1/2', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'BVA936', nom:'vanne 1/4 de tour + purge FF 2"', categorie:'robinetterie', diametre:'2"', filetage:'FF', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 56' },
    { ref:'ELC4001', nom:'câble 1000 RO2V 1x1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4002', nom:'câble 1000 RO2V 2x1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4003', nom:'câble 1000 RO2V 3 G 1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4004', nom:'câble 1000 RO2V 4 G 1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4005', nom:'câble 1000 RO2V 5 G 1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4007', nom:'câble 1000 RO2V 7 G 1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC40012', nom:'câble 1000 RO2V 12 G 1,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC40325', nom:'câble 1000 RO2V 3 G 2,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4024', nom:'câble 1000 RO2V 4 G 2,5mm²', categorie:'électricité', colisage:'1/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC40060', nom:'câble irrigation 2x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57', aVerifier:'même référence aussi imprimée p. 27' },
    { ref:'ELC4083', nom:'câble irrigation 3x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4085', nom:'câble irrigation 5x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4087', nom:'câble irrigation 7x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4089', nom:'câble irrigation 9x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELC4090', nom:'câble irrigation 13x0,8mm² 30V maxi - enterrable', categorie:'électricité', colisage:'75/150/300', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELD550077', nom:'connexion étanche 3 fils DBM (3 fils de 1,5 mm²)', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 57', aVerifier:'même référence aussi imprimée p. 27' },
    { ref:'ELD55008', nom:'connexion étanche jaune DBRY-6 (3 fils de 2,5 mm²)', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 57', aVerifier:'même référence aussi imprimée p. 27' },
    { ref:'ELD550081', nom:'connexion étanche jaune DBY-20', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELD221413.', nom:'connexion Wago 3x4 mm²', categorie:'électricité', marque:'Wago', colisage:'1/50', source:'patron', releve:'Aqua Plus 2026, p. 57', aVerifier:'la référence porte un point final dans le catalogue : recopiée telle quelle' },
    { ref:'ELD221415.', nom:'connexion Wago 5x4 mm²', categorie:'électricité', marque:'Wago', colisage:'1/25', source:'patron', releve:'Aqua Plus 2026, p. 57', aVerifier:'la référence porte un point final dans le catalogue : recopiée telle quelle' },
    { ref:'ELD5111', nom:'connexion Blazing BBS 1,5mm MAX 30V', categorie:'électricité', tension:'30 V', colisage:'1/25', source:'patron', releve:'Aqua Plus 2026, p. 57' },
    { ref:'ELD40038', nom:'domino 6 mm²', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD40039', nom:'domino 10 mm²', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD34233', nom:'domino 16 mm²', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD34219', nom:'domino 25 mm²', categorie:'électricité', colisage:'1/10', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD40025', nom:'boîte de dérivation Plexo Ø 60mm', categorie:'électricité', colisage:'1/5', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD40024', nom:'boîte de dérivation Plexo Ø 70mm', categorie:'électricité', colisage:'1/5', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELDLEG92110', nom:'boîte de dérivation Plexo 65x65x40mm', categorie:'électricité', colisage:'1/5', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD40050', nom:'boîte de dérivation Plexo 105x105x55mm', categorie:'électricité', colisage:'1/5', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD40021', nom:'résine Scotchcast 90gr', categorie:'électricité', marque:'Scotchcast', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELDTRM92802', nom:'résine Scotchcast 420gr', categorie:'électricité', marque:'Scotchcast', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELDTRM80155', nom:'résine - trousse de jonction Scotchcast 92MAO', categorie:'électricité', marque:'Scotchcast', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELD100PAN', nom:'ruban isolant électrique (10mx15mm - ép.0,15mm)', categorie:'électricité', colisage:'10', source:'patron', releve:'Aqua Plus 2026, p. 58' },
    { ref:'ELDGEL', nom:'Gel isolant bi-composant 2 x 500 ml', categorie:'électricité', colisage:'1', source:'patron', releve:'Aqua Plus 2026, p. 58' }
  ],

  /* ── Le reste du matériel ───────────────────────────────────────────────
     **Ses lignes provisoires sont RETIRÉES, le 16 octobre 2026** (« supprime
     toutes les lignes provisoires ») : électrovanne et regard génériques,
     disconnecteur, réducteur de pression, tuyaux PE 25 et 32. Aucune n'avait de
     référence ni ne venait de ses documents. Ce qui les remplace, et vient de
     lui : ses fiches de nourrice (électrovanne 100 DV, regard, programmateur
     BL-IP), son « Régulateur de pression FF 3/4" » par voie de goutte-à-goutte,
     et ses tubes dans `tuyaux`. Ne pas les remettre « pour dépanner ».

     Reste la sonde de pluie, qu'il veut EN OPTION : *« si l'utilisateur coche
     oui on la rajoute dans la liste »*, la Rain Bird filaire blanche. */
  materiel: [
    // Le libellé est celui d'Aqua Plus, mot pour mot : c'est ce qu'il demande
    // au comptoir.
    { ref:'RP403', nom:'sonde pluie RSD-Bex Rain Bird', regle:'option',
      source:'patron', releve:'Aqua Plus 2026, p. 27' }
  ],

  /* ══ CE QUE SA NOTICE RAIN BIRD DIT DE L'ÉLECTROVANNE ══════════════════════

     **Relevé le 22 août 2026** sur la notice qu'il a envoyée
     (`man_DV_DVF.pdf`, Rain Bird, P/N 231576-B). Ce sont ses vannes : toutes
     ses fiches de nourrice montent des 100-DV.

     | | 075-DV (3/4") | 100-DV (1") |
     |---|---|---|
     | débit admis | 0,05 à 5,0 m³/h | 0,05 à 9,08 m³/h |
     | pression admise | 1 à 10 bar | 1 à 10 bar |

     Et une règle que le dépôt appliquait de travers : **le réducteur de
     pression ne sert qu'au-delà de 5,5 bar** (*« if pressure is greater than
     80 psi (5,5 bar), install a pressure regulator on the line before the
     valve »*). Il était facturé d'office sur chaque chantier.

     ⚠ **CE QUE CETTE NOTICE NE DONNE PAS :** la perte de charge de la vanne.
     C'est une notice d'installation, pas une fiche technique — il n'y a ni
     courbe ni tableau ΔP. Le forfait majorant de `PERTE_ELECTROVANNE` reste
     donc en place, et reste non relevé. */
  electrovanneDV: {
    debitMin: 0.05, debitMax100: 9.08, debitMax075: 5.0,
    pressionMin: 1, pressionMax: 10,
    // Au-delà, la notice impose un réducteur AVANT la vanne.
    reducteurAuDelaDe: 5.5,
    // Les modèles mâle-mâle et mâle-cannelé sont déconseillés au-delà.
    debitMaxMMetMB: 6.8,
    source: 'patron', releve: 'Notice Rain Bird DV/DVF, P/N 231576-B (2011)',
    // **SA PERTE DE CHARGE, relevée le 17 octobre 2026 avec son accord** :
    // catalogue Rain Bird, Valves, p. 89, « DV and DVF Valve Pressure Loss (bar)
    // METRIC », colonne « 100-DV/100-DVF 1" », la sienne en MM comme en FF.
    // [débit en m³/h, perte en bar]. Elle remplace le forfait de 0,25 bar,
    // qui comptait trop peu dès 1,2 m³/h.
    perte: [[0.23, 0.23], [0.60, 0.24], [1.20, 0.26], [3.60, 0.32], [4.50, 0.35], [6.00, 0.41], [9.00, 0.59]],
    perteReleve: 'Catalogue Rain Bird, Valves, p. 89'
  },

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
    'union':         { nom:'Union droite taraudée MF 1"', marque:'Dura' },
    'vanne-purge':   { nom:'Vanne avec vis de purge 3/4"', marque:'Dura' },
    'electrovanne-100dv': { nom:'Électrovanne 100 DV 1" MM 9V', marque:'Rain Bird' },
    'raccord-male25':{ nom:'Raccord mâle 25 1"', marque:'Plasson' },
    'regard-rect12': { nom:'Regard rectangle 12"', marque:'Dura' },
    'regard-rg17106':{ nom:'Regard jumbo RG17106', marque:'Dura' },
    'regard-jumbo5': { nom:'Regard jumbo 5 voies', marque:'Dura' },
    'regard-jumbo6': { nom:'Regard jumbo 6 voies', marque:'Dura' },
    'te-mmf':        { nom:'Té taraudé/fileté 1" MMF', marque:'Dura' },
    'clarinette-2v': { nom:'Collecteur M x F x 2 sorties 1"', marque:'Dura' },
    'clarinette-3v': { nom:'Collecteur M x F x 3 sorties 1"', marque:'Dura' },
    'clarinette-4v': { nom:'Collecteur M x F x 4 sorties 1"', marque:'Dura' },
    'prog-1':        { nom:'Programmateur BL-IP 1 station 9V', marque:'Solem' },
    'prog-2':        { nom:'Programmateur BL-IP 2 stations 9V', marque:'Solem' },
    'prog-4':        { nom:'Programmateur BL-IP 4 stations 9V', marque:'Solem' },
    'prog-6':        { nom:'Programmateur BL-IP 6 stations 9V', marque:'Solem' },
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

/* Une pièce Aqua Plus relevée, par sa référence : celles que le calcul compte
   à la sortie du goutte-à-goutte se lisent ici, pas recopiées à côté. */
CATALOGUE.pieceAjoutable = function (ref) {
  return CATALOGUE.piecesAjoutables.filter(function (x) { return x.ref === ref; })[0] || null;
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
   proportionnelle (0,08 à 90°, donc 0,32 sur quatre quarts, mais 0,27 à 330°).

   DONC, ET LA DISTINCTION EST TOUT : quand le tableau donne UN chiffre, il
   vaut pour tous les arcs ; quand il en donne un PAR ANGLE, on lit chaque
   angle. Ce passage n'écrit donc que ce qui manque, et ne recouvre jamais une
   valeur relevée. Il ne touche pas non plus les buses sans aucun débit (les
   MPR 5000 Plus, dont la photo ne portait qu'un rayon) : rien à étendre. */
// Le débit au mètre d'un tube de goutte-à-goutte : ses goutteurs, divisés par
// leur écart, en m³/h. Calculé une fois, ici, pour que l'écran et le calcul
// lisent le même chiffre.
CATALOGUE.gaines.forEach(function (g) {
  g.debitMetre = g.debitGoutteur / g.ecartGoutteurs / 1000;
});

CATALOGUE.buses.forEach(function (b) {
  if (b.pourType !== 'turbine') return;
  if (b.debit[360] == null) return;
  if (b.debit[90] != null || b.debit[180] != null) return;
  b.debit[90] = b.debit[360];
  b.debit[180] = b.debit[360];
  b.debitMemeQuelQueSoitLArc = true;
});


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
      // Les 4, 6 et 8-VAN s'arrêtent à 330° : sans 360°, elles restent
      // posables aux coins et aux bords, et le pavage les refuse dès qu'une
      // rangée intérieure existe (`calcul.js`, `faitLeTour`).
      return b.debit[90] != null && b.debit[180] != null && (b.debit[360] != null || b.debit[330] != null);
    })
    .sort(function (a, b) { return b.rayon - a.rayon; });
};

/* ══ UNE RÉFÉRENCE, OU RIEN ════════════════════════════════════════════════

   **Sa consigne du 22 août 2026, en majuscules et six points d'exclamation :**
   *« tu ne dois surtout pas inventer de prix ni de référence !!!!!!! »*

   **Il avait raison, et le défaut était à l'écran.** La liste de matériel
   affichait une colonne « référence » remplie avec les CLÉS INTERNES du
   catalogue : `te-taraude-25-34-25`, `electrovanne-100dv`, `regard-rect12`,
   `sonde-pluie`. Ce ne sont pas des références : ce sont des noms de variables.
   Un paysagiste qui arrive chez Aqua Plus en demandant un « te-taraude-25-34-25 »
   se fait regarder de travers, et il a raison — ça n'existe pas.

   **Ce qui EST une référence :** celle qu'on a relevée sur ses documents. Ces
   entrées-là portent toutes un champ `releve` (« Aqua Plus 2026, p. 11 ») —
   RA3504, RA3504-B075, OD501, RBT636. Les autres n'ont qu'un nom et une
   marque, ce qui suffit pour commander au comptoir mais n'est PAS une
   référence.

   Cette fonction rend l'une ou l'autre, jamais un entre-deux. Le silence est
   la bonne réponse quand on ne sait pas : un nom sans référence se commande,
   une référence inventée fait perdre une matinée. */
CATALOGUE.referenceDe = function (cle) {
  if (!cle) return null;
  var listes = [CATALOGUE.buses, CATALOGUE.corps, CATALOGUE.coudes,
                CATALOGUE.gaines, CATALOGUE.materiel, CATALOGUE.piecesAjoutables];
  for (var i = 0; i < listes.length; i++) {
    var trouve = (listes[i] || []).filter(function (x) { return x.ref === cle; })[0];
    // **`releve` est le seul juge.** Une entrée sans relevé est une entrée
    // dont la référence n'a jamais été lue sur un document du patron.
    //
    // **Et une buse livrée avec l'arroseur n'en a pas.** Sa clé (`RA5004-B3u`)
    // a été fabriquée dans le dépôt pour la lier à son corps ; Aqua Plus ne la
    // vend pas seule (16 octobre 2026, « rien ne doit être inventé »).
    if (trouve) return trouve.releve && !trouve.livreeAvecLArroseur ? trouve.ref : null;
  }
  return null;
};

/* Tout ce qui peut porter un prix, à un seul endroit : c'est la liste qu'il
   remplira dans son registre, et elle ne doit pas se tenir à deux endroits. */
CATALOGUE.tousLesProduits = function () {
  var out = [];
  CATALOGUE.buses.forEach(function (b) {
    out.push({ ref:b.ref, nom:'Buse ' + b.nom + ' — ' + (b.marque || 'Rain Bird'),
               detail:'rayon ' + String(b.rayon).replace('.', ',') + ' m à ' +
                      String(b.pression).replace('.', ',') + ' bar' +
                      (b.livreeAvecLArroseur ? ', livrée avec l\'arroseur' : ', par ' + b.colisage),
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
      ? 'Clapet anti-vidange : évite les fuites au point bas après l\'arrêt, utile sur un terrain en pente.'
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

/* Ce que l'écran doit savoir dire, et qui se compte ici plutôt qu'à trois
   endroits : combien de valeurs attendent encore ses données. */
CATALOGUE.provisoires = function () {
  var n = 0;
  ['gaines','materiel'].forEach(function (famille) {
    CATALOGUE[famille].forEach(function (x) { if (x.source === 'provisoire') n++; });
  });
  return n;
};
