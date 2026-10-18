var CALCUL = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../../AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/f5f7bbdf-817e-4922-bdba-232ba405467b/scratchpad/entree-schema.ts
  var entree_schema_exports = {};
  __export(entree_schema_exports, {
    CATALOGUE: () => CATALOGUE,
    calculerPlan: () => calculerPlan,
    debitRetenu: () => debitRetenu,
    piecesDuPlan: () => piecesDuPlan
  });

  // src/lib/arrosage/catalogue.js
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
      { cle: "rainbird", nom: "Rain Bird", defaut: true },
      { cle: "toro", nom: "Toro" },
      // Ajoutée le 17 août 2026 : il a envoyé ses photos Hunter sans qu'on la
      // lui demande — les buses SRS (Hunter, p. 9) et les corps Pro-Spray /
      // I-Spray. Une marque de plus est une ligne, comme prévu.
      { cle: "hunter", nom: "Hunter" },
      { cle: "generique", nom: "G\xE9n\xE9rique (provisoire)", cache: true }
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
      {
        ref: "RBT648",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "18-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 5.4,
        pression: 2,
        debit: { 90: 0.3, 180: 0.6, 270: 0.9, 360: 1.2 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      {
        ref: "RBT601",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "15-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4.5,
        pression: 2,
        debit: { 90: 0.21, 180: 0.42, 270: 0.63, 360: 0.84 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      {
        ref: "RBT636",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "12-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 3.6,
        pression: 2,
        debit: { 90: 0.15, 180: 0.3, 270: 0.45, 360: 0.59 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      {
        ref: "RBT637",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "10-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 2.7,
        pression: 2,
        debit: { 90: 0.14, 180: 0.29, 270: 0.43, 360: 0.57 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      // **LES 8, 6 ET 4-VAN S'ARRÊTENT À 330°** (fiche Rain Bird des VAN, pages
      // 27 et 28). Aqua Plus imprime leur dernier chiffre sous « 360° » : c'est
      // celui du 330°. Sa réponse du 16 octobre 2026 : « oui pour les VAN »,
      // coins et bords seulement. Le calcul ne les pose donc jamais sur une zone
      // qui a une rangée intérieure (`poseSelonSaRegle`, `faitLeTour`).
      //
      // La 8-VAN porte 0,16 m³/h à 90°, plus que la 10-VAN : Rain Bird donne le
      // même chiffre (trajectoire de 5°, la 10-VAN est à 10°). Le doute est levé.
      {
        ref: "RBT638",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "8-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 2.3,
        pression: 2,
        debit: { 90: 0.16, 180: 0.26, 270: 0.34, 330: 0.38 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      {
        ref: "RBT639",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "6-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 1.8,
        pression: 2,
        debit: { 90: 0.08, 180: 0.13, 270: 0.24, 330: 0.27 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      {
        ref: "RBT640",
        pressionMin: 1,
        pressionMax: 2.1,
        plageReleve: "Rain Bird, fiche des buses VAN, p. 27",
        nom: "4-VAN",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 1.2,
        pression: 2,
        debit: { 90: 0.06, 180: 0.1, 270: 0.16, 330: 0.2 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8"
      },
      /* ── LES BUSES HUNTER SRS — sa deuxième page, le 17 août 2026 ───────────
         Même forme que les VAN : UNE référence couvre tous les angles, donnée
         « à 2,1 bars ». Il donne aussi le 120°, que le calcul n'utilise pas
         encore (seuls 90°/180°/360° comptent pour les coins, bords, intérieurs) —
         gardé quand même, une donnée relevée ne se jette pas. */
      {
        ref: "HBT1559",
        nom: "SRS 7A",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 2.1,
        pression: 2.1,
        debit: { 90: 0.11, 120: 0.15, 180: 0.22, 270: 0.33, 360: 0.44 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HBT1560",
        nom: "SRS 10A",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 3,
        pression: 2.1,
        debit: { 90: 0.11, 120: 0.15, 180: 0.22, 270: 0.33, 360: 0.44 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HBT1561",
        nom: "SRS 12A",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 3.7,
        pression: 2.1,
        debit: { 90: 0.16, 120: 0.22, 180: 0.33, 270: 0.49, 360: 0.65 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HBT1562",
        nom: "SRS 15A",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4.6,
        pression: 2.1,
        debit: { 90: 0.21, 120: 0.28, 180: 0.42, 270: 0.63, 360: 0.84 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HBT1563",
        nom: "SRS 17A",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 5.5,
        pression: 2.1,
        debit: { 90: 0.27, 120: 0.36, 180: 0.55, 270: 0.82, 360: 1.09 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
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
      {
        ref: "RBT1418",
        nom: "14 R-VAN r\xE9glable",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4,
        pression: 2.4,
        debit: { 90: 0.066, 180: 0.132 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        aVerifier: "270\xB0 absent du relev\xE9, seuls 90\xB0 et 180\xB0 \xE9taient lisibles"
      },
      {
        ref: "RBT1419",
        nom: "14 R-VAN 360\xB0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4,
        pression: 2.4,
        debit: { 360: 0.264 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        pairAvec: "RBT1418"
      },
      {
        ref: "RBT1428",
        nom: "18 R-VAN r\xE9glable",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4.9,
        pression: 2.4,
        debit: { 90: 0.106, 180: 0.206 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        aVerifier: "270\xB0 absent du relev\xE9, seuls 90\xB0 et 180\xB0 \xE9taient lisibles"
      },
      {
        ref: "RBT1429",
        nom: "18 R-VAN 360\xB0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 4.9,
        pression: 2.4,
        debit: { 360: 0.412 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        pairAvec: "RBT1428"
      },
      {
        ref: "RBT1438",
        nom: "24 R-VAN r\xE9glable",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 6.1,
        pression: 2.4,
        debit: { 90: 0.148, 180: 0.295 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        aVerifier: "270\xB0 absent du relev\xE9, seuls 90\xB0 et 180\xB0 \xE9taient lisibles"
      },
      {
        ref: "RBT1439",
        nom: "24 R-VAN 360\xB0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        rayon: 6.1,
        pression: 2.4,
        debit: { 360: 0.59 },
        colisage: 25,
        source: "patron",
        releve: "Aqua Plus 2026, p. 8",
        pairAvec: "RBT1438"
      },
      /* ── LES BUSES MP ROTATOR (Hunter) — Aqua Plus 2026, page 10, entrées le
         18 octobre 2026 avec son oui (« oui je pense que c'est le mieux »).
         La page dit : « turbine multijets à visser sur un corps de tuyère (M&F),
         faible consommation, débit proportionnel au secteur arrosé, pression
         d'utilisation 2 à 3,5 bars, performances débit / portée à 2,8 bars ».
         SA RÈGLE DU 18 OCTOBRE : « les MP Rotator sont pour les tuyères » :
         pourType 'tuyere', elles vont avec les tuyères sur une vanne, jamais
         avec une turbine. Et leur débit SUIT L'ANGLE, lu par angle comme une VAN,
         pas la règle des turbines (débit indépendant de l'arc).
         COMME LES R-VAN, CHAQUE SECTEUR EST UNE RÉFÉRENCE : 90-210°, 210-270°,
         360°. Aucune ne porte les trois angles d'une pose : `busesDe` ne les
         choisit donc pas automatiquement tant que le pavage à deux références
         n'existe pas. Elles sont au catalogue et dans les listes, et se posent à
         la main. Les débits sont ceux du tableau, aux angles que la référence
         couvre ; la colonne 270° de la MP1000 est vide dans le PDF. La portée :
         le tableau dit 4,1 m pour la MP1000 quand l'en-tête annonce « de 4,9 à
         9,1 m » : le tableau est recopié, l'écart est noté. La version Toro
         (MP1000T, MP2000T, MP3000T, tuyère femelle) n'a ni portée ni débit sur
         la page : elle n'entre pas, rien ne s'invente. Les photos (mp1000,
         mp2000, mp3000, une par modèle) sont validées par lui le 18 octobre. */
      {
        ref: "NA2302",
        nom: "MP1000 90-210\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 4.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 90: 0.04, 180: 0.09, 210: 0.1 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10",
        aVerifier: "l'en-t\xEAte de la page dit \xAB port\xE9e de 4,9 \xE0 9,1 m \xBB, le tableau donne 4,1 m"
      },
      {
        ref: "NA2303",
        nom: "MP1000 210-270\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 4.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 210: 0.1 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10",
        aVerifier: "la colonne 270\xB0 de la ligne MP1000 est vide dans le PDF ; port\xE9e 4,1 m au tableau, \xAB 4,9 \xE0 9,1 m \xBB en en-t\xEAte"
      },
      {
        ref: "NA2301",
        nom: "MP1000 360\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 4.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 360: 0.17 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10",
        aVerifier: "0,17 m\xB3/h plac\xE9 sous la colonne 360\xB0 d'apr\xE8s sa position dans le PDF ; port\xE9e 4,1 m au tableau, \xAB 4,9 \xE0 9,1 m \xBB en en-t\xEAte"
      },
      {
        ref: "NA2312",
        nom: "MP2000 90-210\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 5.8,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 90: 0.09, 180: 0.17, 210: 0.2 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
      {
        ref: "NA2313",
        nom: "MP2000 210-270\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 5.8,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 210: 0.2, 270: 0.25 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
      {
        ref: "NA2311",
        nom: "MP2000 360\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 5.8,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 360: 0.33 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
      {
        ref: "NA2321",
        nom: "MP3000 90-210\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 9.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 90: 0.2, 180: 0.41, 210: 0.48 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
      {
        ref: "NA2322",
        nom: "MP3000 210-270\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 9.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 210: 0.48, 270: 0.62 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
      {
        ref: "NA2323",
        nom: "MP3000 360\xB0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        serie: "MP Rotator",
        pourType: "tuyere",
        rayon: 9.1,
        pression: 2.8,
        pressionMin: 2,
        pressionMax: 3.5,
        plageReleve: "Aqua Plus 2026, p. 10",
        debit: { 360: 0.82 },
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 10"
      },
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
      {
        ref: "HA2211-B1",
        nom: "PGP-ADJ buse 1 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 8.8,
        pression: 2.8,
        debit: { 360: 0.14 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B2",
        nom: "PGP-ADJ buse 2 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.1,
        pression: 2.8,
        debit: { 360: 0.18 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B3",
        nom: "PGP-ADJ buse 3 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.4,
        pression: 2.8,
        debit: { 360: 0.23 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B4",
        nom: "PGP-ADJ buse 4 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 10.1,
        pression: 2.8,
        debit: { 360: 0.32 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B5",
        nom: "PGP-ADJ buse 5 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 11,
        pression: 2.8,
        debit: { 360: 0.41 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B6",
        nom: "PGP-ADJ buse 6 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 11.6,
        pression: 2.8,
        debit: { 360: 0.55 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2211-B7",
        nom: "PGP-ADJ buse 7 (rouge std)",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 12.2,
        pression: 2.8,
        debit: { 360: 0.68 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B1.5",
        nom: "PGP Ultra buse 1,5",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.8,
        pression: 3,
        debit: { 360: 0.35 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B2",
        nom: "PGP Ultra buse 2",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 10.4,
        pression: 3,
        debit: { 360: 0.43 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B3",
        nom: "PGP Ultra buse 3",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 11.6,
        pression: 3,
        debit: { 360: 0.68 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B4",
        nom: "PGP Ultra buse 4",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 12.2,
        pression: 3,
        debit: { 360: 0.9 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B5",
        nom: "PGP Ultra buse 5",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 12.8,
        pression: 3,
        debit: { 360: 1.14 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B6",
        nom: "PGP Ultra buse 6",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 13.1,
        pression: 3,
        debit: { 360: 1.36 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210-B8",
        nom: "PGP Ultra buse 8",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 13.4,
        pression: 3,
        debit: { 360: 1.81 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RBA2195",
        nom: "5000 Plus MPR 7,62 m",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 7.62,
        pression: null,
        debit: {},
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13",
        aVerifier: "Buse MPR (d\xE9bit proportionnel \xE0 la surface, 90\xB0-120\xB0-180\xB0-360\xB0) : aucun d\xE9bit donn\xE9 sur la photo"
      },
      {
        ref: "RBA2196",
        nom: "5000 Plus MPR 9,14 m",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.14,
        pression: null,
        debit: {},
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13",
        aVerifier: "Buse MPR (d\xE9bit proportionnel \xE0 la surface, 90\xB0-120\xB0-180\xB0-360\xB0) : aucun d\xE9bit donn\xE9 sur la photo"
      },
      {
        ref: "RBA2197",
        nom: "5000 Plus MPR 10,67 m",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 10.67,
        pression: null,
        debit: {},
        colisage: 10,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13",
        aVerifier: "Buse MPR (d\xE9bit proportionnel \xE0 la surface, 90\xB0-120\xB0-180\xB0-360\xB0) : aucun d\xE9bit donn\xE9 sur la photo"
      },
      {
        ref: "RA5004-B1u",
        nom: "5000 Plus buse 1,0 u+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 8.5,
        pression: 2.5,
        debit: { 360: 0.22 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B15u",
        nom: "5000 Plus buse 1,5 u+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.4,
        pression: 2.5,
        debit: { 360: 0.28 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B2u",
        nom: "5000 Plus buse 2,0 u+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.8,
        pression: 2.5,
        debit: { 360: 0.45 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B3u",
        nom: "5000 Plus buse 3,0 u+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 11.1,
        pression: 2.5,
        debit: { 360: 0.71 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B15p",
        nom: "5000 Plus buse 1,5 Port\xE9e+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 10.1,
        pression: 2.5,
        debit: { 360: 0.39 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B3p",
        nom: "5000 Plus buse 3,0 Port\xE9e+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 12.2,
        pression: 2.5,
        debit: { 360: 0.92 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004-B6p",
        nom: "5000 Plus buse 6,0 Port\xE9e+",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 13.7,
        pression: 2.5,
        debit: { 360: 1.36 },
        // 0,92 jusqu'au 16 octobre 2026 : recopié de la buse 3,0 Portée+ sur une
        // photo. Le catalogue Aqua Plus 2026 donne 1,36, corrigé avec son accord.
        // Comptée 0,92, elle mettait une tête de trop sur une vanne.
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "TAMINI8-B075",
        nom: "Mini 8 buse 0,75",
        marqueCle: "toro",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 6,
        pression: 2.5,
        debit: { 360: 0.2 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "TAMINI8-B1",
        nom: "Mini 8 buse 1,0",
        marqueCle: "toro",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 6.9,
        pression: 2.5,
        debit: { 360: 0.28 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "TAMINI8-B15",
        nom: "Mini 8 buse 1,5",
        marqueCle: "toro",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 8.3,
        pression: 2.5,
        debit: { 360: 0.3 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "TAMINI8-B2",
        nom: "Mini 8 buse 2,0",
        marqueCle: "toro",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.3,
        pression: 2.5,
        debit: { 360: 0.36 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B075",
        nom: "3504 buse 0,75",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 5.2,
        pression: 2.5,
        debit: { 360: 0.16 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B1",
        nom: "3504 buse 1,0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 6.4,
        pression: 2.5,
        debit: { 360: 0.21 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B15",
        nom: "3504 buse 1,5",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 7,
        pression: 2.5,
        debit: { 360: 0.3 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B2",
        nom: "3504 buse 2,0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 8.2,
        pression: 2.5,
        debit: { 360: 0.39 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B3",
        nom: "3504 buse 3,0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.4,
        pression: 2.5,
        debit: { 360: 0.6 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504-B4",
        nom: "3504 buse 4,0",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 10.1,
        pression: 2.5,
        debit: { 360: 0.83 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B050",
        nom: "SRM-04 buse 0,50",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 4.9,
        pression: 2.8,
        debit: { 360: 0.11 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B075",
        nom: "SRM-04 buse 0,75",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 5.5,
        pression: 2.8,
        debit: { 360: 0.17 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B1",
        nom: "SRM-04 buse 1,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 6.1,
        pression: 2.8,
        debit: { 360: 0.23 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B15",
        nom: "SRM-04 buse 1,5",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 7.3,
        pression: 2.8,
        debit: { 360: 0.34 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B2",
        nom: "SRM-04 buse 2,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 7.9,
        pression: 2.8,
        debit: { 360: 0.45 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264-B3",
        nom: "SRM-04 buse 3,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.1,
        pression: 2.8,
        debit: { 360: 0.68 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B075",
        nom: "PGJ buse 0,75",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 4.9,
        pression: 2.8,
        debit: { 360: 0.17 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B1",
        nom: "PGJ buse 1,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 5.8,
        pression: 2.8,
        debit: { 360: 0.23 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B15",
        nom: "PGJ buse 1,5",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 6.7,
        pression: 2.8,
        debit: { 360: 0.34 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B2",
        nom: "PGJ buse 2,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 7.6,
        pression: 2.8,
        debit: { 360: 0.45 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B25",
        nom: "PGJ buse 2,5",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 8.5,
        pression: 2.8,
        debit: { 360: 0.57 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274-B3",
        nom: "PGJ buse 3,0",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        rayon: 9.4,
        pression: 2.8,
        debit: { 360: 0.68 },
        livreeAvecLArroseur: true,
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      }
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
      {
        ref: "RT1802",
        nom: "Tuy\xE8re 1800",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 5,
        options: [],
        detail: "escamotable 5 cm",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1804",
        nom: "Tuy\xE8re 1800",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 10,
        options: [],
        detail: "escamotable 10 cm",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1806",
        nom: "Tuy\xE8re 1800",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 15,
        options: [],
        detail: "escamotable 15 cm",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1812",
        nom: "Tuy\xE8re 1800",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 30,
        options: [],
        detail: "escamotable 30 cm",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1824",
        nom: "Tuy\xE8re 1800 SAM",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 10,
        options: ["clapet anti-vidange"],
        detail: "escamotable 10 cm, SAM",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1826",
        nom: "Tuy\xE8re 1800 SAM",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 15,
        options: ["clapet anti-vidange"],
        detail: "escamotable 15 cm, SAM",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1822",
        nom: "Tuy\xE8re 1800 SAM",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 30,
        options: ["clapet anti-vidange"],
        detail: "escamotable 30 cm, SAM",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1834",
        nom: "Tuy\xE8re 1800 SAM-PRS",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 10,
        options: ["clapet anti-vidange", "r\xE9gulateur de pression"],
        detail: "escamotable 10 cm, SAM-PRS (2,1 bar)",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1836",
        nom: "Tuy\xE8re 1800 SAM-PRS",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 15,
        options: ["clapet anti-vidange", "r\xE9gulateur de pression"],
        detail: "escamotable 15 cm, SAM-PRS (2,1 bar)",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "RT1832",
        nom: "Tuy\xE8re 1800 SAM-PRS",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 30,
        options: ["clapet anti-vidange", "r\xE9gulateur de pression"],
        detail: "escamotable 30 cm, SAM-PRS (2,1 bar)",
        source: "patron",
        releve: "Aqua Plus 2026, p. 7"
      },
      {
        ref: "HT1541",
        nom: "Tuy\xE8re Pro-Spray-02",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 5,
        options: [],
        detail: "escamotable 5 cm",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1543",
        nom: "Tuy\xE8re Pro-Spray-04",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 10,
        options: [],
        detail: "escamotable 10 cm",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1544",
        nom: "Tuy\xE8re Pro-Spray-06",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 15,
        options: [],
        detail: "escamotable 15 cm",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1546",
        nom: "Tuy\xE8re Pro-Spray-12",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 30,
        options: [],
        detail: "escamotable 30 cm",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1521",
        nom: "Tuy\xE8re I-Spray-04",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 10,
        options: ["r\xE9gulateur de pression"],
        detail: "escamotable 10 cm, r\xE9gulateur",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1522",
        nom: "Tuy\xE8re I-Spray-06",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 15,
        options: ["r\xE9gulateur de pression"],
        detail: "escamotable 15 cm, r\xE9gulateur",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      {
        ref: "HT1523",
        nom: "Tuy\xE8re I-Spray-12",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "tuyere",
        filetage: "1/2",
        hauteur: 30,
        options: ["r\xE9gulateur de pression"],
        detail: "escamotable 30 cm, r\xE9gulateur",
        pressionMin: 1,
        pressionMax: 4.8,
        plageReleve: "Aqua Plus 2026, p. 9",
        source: "patron",
        releve: "Aqua Plus 2026, p. 9"
      },
      /* ── LES CORPS DE TURBINE — quatrième page, le 17 août 2026 ────────────
         `pourType:'turbine'` : une famille à part des corps de tuyères
         ci-dessus. Un jour où les turbines seront posées automatiquement, le
         sélecteur de corps devra distinguer les deux — pour l'instant seuls
         les corps `tuyere` sont câblés dans la liste au fournisseur. */
      {
        ref: "HA2211",
        nom: "Turbine PGP-ADJ",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["r\xE9glable 40\xB0-360\xB0"],
        detail: "escamotable 10 cm, secteur r\xE9glable 40\xB0-360\xB0, livr\xE9 avec 12 buses",
        pressionMin: 2.1,
        pressionMax: 4.8,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2210",
        nom: "Turbine PGP Ultra",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["r\xE9glable et plein cercle"],
        detail: "escamotable 10 cm, r\xE9glable ET plein cercle (mod\xE8le unique), livr\xE9 avec 8 buses",
        pressionMin: 2.1,
        pressionMax: 4.8,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2222",
        nom: "Turbine I 20-04 Ultra",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["FloStop"],
        detail: "escamotable, r\xE9glage par cl\xE9 40\xB0-360\xB0, coupure FloStop \xE0 la cl\xE9, livr\xE9 avec 12 buses dont 4 angle bas",
        pressionMin: 2.1,
        pressionMax: 4.8,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "HA2225",
        nom: "Turbine I 20-04 Ultra SS Inox",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["FloStop", "tige inox"],
        detail: "comme I 20-04 Ultra, tige escamotable en acier inox",
        pressionMin: 2.1,
        pressionMax: 4.8,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA2181",
        nom: "Turbine 5004 Plus",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["r\xE9glable"],
        detail: "escamotable 10 cm, secteur r\xE9glable, fermeture de d\xE9bit sur l'arroseur",
        pressionMin: 1.7,
        pressionMax: 4.5,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5004FC",
        nom: "Turbine 5004 Plus",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["plein cercle"],
        detail: "escamotable 10 cm, plein cercle",
        pressionMin: 1.7,
        pressionMax: 4.5,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5006PC",
        nom: "Turbine 5006 Plus",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 15,
        options: ["r\xE9glable"],
        detail: "escamotable 15 cm, secteur r\xE9glable",
        pressionMin: 1.7,
        pressionMax: 4.5,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA5012PCSAM",
        nom: "Turbine 5012 Plus",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 30,
        options: ["r\xE9glable", "clapet anti-vidange"],
        detail: "escamotable 30 cm, secteur r\xE9glable, SAM",
        pressionMin: 1.7,
        pressionMax: 4.5,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "RA2180",
        nom: "Turbine 5004 Plus SS",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "3/4",
        hauteur: 10,
        options: ["r\xE9glable", "clapet anti-vidange", "tige inox"],
        detail: "tige escamotable inox, secteur r\xE9glable, SAM",
        pressionMin: 1.7,
        pressionMax: 4.5,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 13",
        source: "patron",
        releve: "Aqua Plus 2026, p. 13"
      },
      {
        ref: "TAMINI8-4P",
        nom: "Turbine Mini 8",
        marqueCle: "toro",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 9.5,
        options: ["faible consommation"],
        detail: "escamotable 9,5 cm, r\xE9glage sur le dessus, 5 buses interchangeables",
        pressionMin: 2,
        pressionMax: 4.1,
        bridage: 0.25,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504",
        nom: "Turbine 3504",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 0,
        options: ["r\xE9glable"],
        detail: "un seul mod\xE8le r\xE9glable 40\xB0-360\xB0, livr\xE9 avec 6 buses",
        pressionMin: 1.7,
        pressionMax: 3.8,
        bridage: 0.35,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "RA3504SAM",
        nom: "Turbine 3504 SAM",
        marqueCle: "rainbird",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 0,
        options: ["r\xE9glable", "clapet anti-vidange"],
        detail: "comme 3504, SAM",
        pressionMin: 1.7,
        pressionMax: 3.8,
        bridage: 0.35,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2264",
        nom: "Turbine SRM-04",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 0,
        options: ["r\xE9glable et plein cercle"],
        detail: "faible d\xE9bit, un seul mod\xE8le r\xE9glable et plein cercle",
        pressionMin: 2.1,
        pressionMax: 3.4,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2274",
        nom: "Turbine PGJ-04",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 10,
        options: ["r\xE9glable et plein cercle"],
        detail: "faible d\xE9bit, escamotable 10 cm, r\xE9glable et plein cercle",
        pressionMin: 2.1,
        pressionMax: 3.4,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      },
      {
        ref: "HA2272",
        nom: "Turbine PGJ-12",
        marqueCle: "hunter",
        fournisseur: "Aqua Plus",
        pourType: "turbine",
        filetage: "1/2",
        hauteur: 30,
        options: ["r\xE9glable et plein cercle"],
        detail: "faible d\xE9bit, escamotable 30 cm, r\xE9glable et plein cercle",
        pressionMin: 2.1,
        pressionMax: 3.4,
        bridage: 0,
        plageReleve: "Aqua Plus 2026, p. 11",
        source: "patron",
        releve: "Aqua Plus 2026, p. 11"
      }
    ],
    /* ── LES COUDES SBE — sixième page, le 17 août 2026 ─────────────────────
         « Sous les arroseurs il faut obligatoirement des coudes SBE, choisis-les
         en fonction des diamètres, un à chaque fois par arroseur. »
    
         Tube 16 mm (le tuyau souple qui descend du réseau enterré au corps) vers
         le taraudage du corps : 1/2" ou 3/4" selon la famille. Un coude, jamais un
         droit — c'est le nom de la pièce sur la photo (« coudé »), et il absorbe
         le fait que le tube arrive de côté quand le corps est vertical. */
    coudes: [
      {
        ref: "OD501",
        nom: "Coude SBE 050",
        marqueCle: "generique",
        fournisseur: "Aqua Plus",
        filetage: "1/2",
        detail: '16 x 1/2" coud\xE9',
        source: "patron",
        releve: "Aqua Plus 2026, p. 14"
      },
      {
        ref: "OD502",
        nom: "Coude SBE 075",
        marqueCle: "generique",
        fournisseur: "Aqua Plus",
        filetage: "3/4",
        detail: '16 x 3/4" coud\xE9',
        source: "patron",
        releve: "Aqua Plus 2026, p. 14"
      }
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
      pe25: {
        nom: "Tuyau PEHD \xD825",
        dInterieur: 19,
        source: "patron",
        releve: "Elydan Polybleu 25\xD73.0, PE100, SDR 9"
      },
      pe32: {
        nom: "Tuyau PEHD \xD832",
        dInterieur: 26,
        source: "patron",
        releve: "Alfatubo AL 32\xD73.0, PE100, SDR 11, PN16"
      }
    },
    piecesReseau: {
      "te-taraude-25-34-25": { nom: 'T\xE9 90\xB0 taraud\xE9 25\xD73/4"\xD725', marque: "Plasson", aquaplus: "OPL71402520" },
      "coude-taraude-25-34": { nom: 'Coude 90\xB0 taraud\xE9 25\xD73/4"', marque: "Plasson", aquaplus: "OPL71502520" },
      // Le « (jonction, non taraudé) » qui suivait ce nom a été retiré le 18 août
      // sur sa consigne : c'est l'emploi de la pièce, pas sa désignation, et il
      // commande sur la désignation. Le 25×25×25 dit déjà qu'il n'est pas taraudé
      // — un taraudé porte son filetage dans son nom (25×3/4"×25).
      "te-25-25-25": { nom: "T\xE9 90\xB0 25\xD725\xD725", marque: "Plasson", aquaplus: "OPL704025" },
      "pebd16": { nom: "PEBD rigide \xD816 (tube de reprise)", marque: "Dura", unite: "ml" },
      // **Le grillage avertisseur bleu**, au-dessus des tuyaux enterrés : sa demande
      // du 18 octobre 2026, une case à cocher. Le nom et le rouleau de 100 m sont
      // ceux d'Aqua Plus 2026, p. 58 ; sans référence, à sa demande (« ils sauront
      // ce que c'est »).
      "grillage-bleu": { nom: "Grillage avertisseur bleu (dim. 0,3 X 100 ml)", metresParRouleau: 100 }
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
      {
        ref: "UGGCBL23050",
        marqueCle: "toro",
        marque: "Toro",
        type: "gaine",
        nom: "tube \xD816mm 2l/h esp.33cm autor\xE9gul\xE9",
        detail: "2 l/h tous les 33 cm",
        debitGoutteur: 2,
        ecartGoutteurs: 0.33,
        // Par 50 : la colonne « colisage » d'Aqua Plus, et ses couronnes de 50 m.
        colisage: 50,
        famille: "Goutte-\xE0-goutte",
        source: "patron",
        releve: "Aqua Plus 2026, p. 48"
      }
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
      { ref: "RD2198", nom: "tournevis arroseur S\xE9rie 5000 (Rotortool)", categorie: "accessoire d'arroseur", colisage: "10", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "HA2253", nom: "cl\xE9 HUNTER PGM / PGP / I20", categorie: "accessoire d'arroseur", marque: "Hunter", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "NA2316", nom: "cl\xE9 MP ROTATOR", categorie: "accessoire d'arroseur", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "OD501", nom: 'SBE 050 coud\xE9 16 x 1/2"', categorie: "accessoire d'arroseur", diametre: "16", filetage: '1/2"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "OD502", nom: 'SBE 075 coud\xE9 16 x 3/4"', categorie: "accessoire d'arroseur", diametre: "16", filetage: '3/4"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "OD505", nom: "t\xE9 SB-TEE", categorie: "accessoire d'arroseur", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "OD506", nom: "jonction SB-CPLG", categorie: "accessoire d'arroseur", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 14" },
      { ref: "UPE1116", nom: "tube P.E.B.D. \xD8 16mm 6,3 bars (12 x 16)", categorie: "tube PE", diametre: "16", colisage: "25/50", source: "patron", releve: "Aqua Plus 2026, p. 14", aVerifier: "m\xEAme r\xE9f\xE9rence p. 47 avec un colisage de 50 au lieu de 25/50" },
      { ref: "TEVEZP0254", nom: '\xE9lectrovanne EZ FLO+ 1" MM - 24 V', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18" },
      { ref: "TEVEZP0354", nom: '\xE9lectrovanne EZ FLO+ 1" FF - 24 V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18" },
      { ref: "TEVEZP2254", nom: '\xE9lectrovanne EZ FLO+ 1" MM RMD - 24 V', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18" },
      { ref: "TEVEZP2354", nom: '\xE9lectrovanne EZ FLO+ 1" FF RMD - 24 V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18" },
      { ref: "TEVEZP02649V", nom: '\xE9lectrovanne EZ FLO+ 1" MM sol\xE9no\xEFde 9V \xE0 impulsion', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18" },
      { ref: "TEVTPV100MMBSP", nom: 'EV TPV 1" MM 0,06 \xE0 9,06 m3/h', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEVTPV100BSP", nom: 'EV TPV 1" FF 0,06 \xE0 9,06 m\xB3/h', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEV2522656", nom: '\xE9lectrovanne 252 1"1/2 FF RMD 6 \xE0 27 m\xB3/h', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", tension: "24 V", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEV2522658", nom: '\xE9lectrovanne 252 2" FF RMD 13,8 \xE0 40,8 m\xB3/h', categorie: "electrovanne", diametre: '2"', filetage: "FF", tension: "24 V", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEV2640603", nom: '\xE9lectrovanne 264 3/4" MM', categorie: "electrovanne", diametre: '3/4"', filetage: "MM", tension: "24 V", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB ; ligne rang\xE9e sous la \xAB S\xC9RIE 252 \xBB sans \xEAtre une 252, et sans colisage imprim\xE9" },
      { ref: "TEVP2202354", nom: 'EV P220 1" FF 1,2 \xE0 11,3 m\xB3/h - pr\xE9-\xE9quip\xE9e EZReg', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/24", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEVP2202356", nom: 'EV P220 1"1/2 FF RMD 6,9 \xE0 24,9 m\xB3/h - pr\xE9-\xE9quip\xE9e EZReg', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", tension: "24 V", colisage: "1/12", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEVP2202358", nom: 'EV P220 2" FF RMD 18,2 \xE0 40,8 m\xB3/h - pr\xE9-\xE9quip\xE9e EZReg', categorie: "electrovanne", diametre: '2"', filetage: "FF", tension: "24 V", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TEVP2202350", nom: 'EV P220 3" FF RMD 34,1 \xE0 68,1m\xB3/h - pr\xE9-\xE9quip\xE9e EZReg', categorie: "electrovanne", diametre: '3"', filetage: "FF", tension: "24 V", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "TPDCLS", nom: "Sol\xE9no\xEFde DC 9V \xE0 impulsion pour EZFLO et P220", categorie: "electrovanne", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 18", aVerifier: "sol\xE9no\xEFde seul (pi\xE8ce d'\xE9lectrovanne), pas une \xE9lectrovanne compl\xE8te" },
      { ref: "REVV1100", nom: '\xE9lectrovanne 75-DV 3/4" FF 24V', categorie: "electrovanne", diametre: '3/4"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REV201", nom: '\xE9lectrovanne 100-DV 1" FF 24V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REVM201", nom: '\xE9lectrovanne 100-DV 1" MM 24V', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REV75DV9V", nom: '\xE9lectrovanne 75-DV 3/4" FF 9V \xE0 impulsion', categorie: "electrovanne", diametre: '3/4"', filetage: "FF", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REV100DV9V", nom: '\xE9lectrovanne 100-DV 1" FF 9V \xE0 impulsion', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REV100DVM9V", nom: '\xE9lectrovanne 100-DV 1" MM 9V \xE0 impulsion', categorie: "electrovanne", diametre: '1"', filetage: "MM", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REVPGA100", nom: '\xE9lectrovanne 100-PGA 1" FF 0,5 \xE0 9 m\xB3/h', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite sur la ligne : lue dans la description de la s\xE9rie PGA (\xAB Sol\xE9no\xEFde 24V \xE0 fils \xBB)" },
      { ref: "REVPGA150", nom: '\xE9lectrovanne 150-PGA 1"1/2 FF 7 \xE0 22 m\xB3/h', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", tension: "24 V", colisage: "1/8", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite sur la ligne : lue dans la description de la s\xE9rie PGA (\xAB Sol\xE9no\xEFde 24V \xE0 fils \xBB)" },
      { ref: "REVPGA200", nom: '\xE9lectrovanne 200-PGA 2" FF 12 \xE0 34 m\xB3/h', categorie: "electrovanne", diametre: '2"', filetage: "FF", tension: "24 V", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite sur la ligne : lue dans la description de la s\xE9rie PGA (\xAB Sol\xE9no\xEFde 24V \xE0 fils \xBB)" },
      { ref: "REVPGA1009V", nom: '\xE9lectrovanne 100-PGA 1" FF 9V 0,5 \xE0 9 m\xB3/h', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "9 V", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REVPGA1509V", nom: '\xE9lectrovanne 150-PGA 1"1/2 FF 9V 7 \xE0 22 m\xB3/h', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", tension: "9 V", colisage: "1/8", source: "patron", releve: "Aqua Plus 2026, p. 19" },
      { ref: "REVPEB100", nom: '\xE9lectrovanne 100-PEB 1" FF 1 \xE0 10 m\xB3/h', categorie: "electrovanne", diametre: '1"', filetage: "FF", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite (ni sur la ligne, ni dans le titre de section)" },
      { ref: "REVPEB150", nom: '\xE9lectrovanne 150-PEB 1"1/2 FF 5 \xE0 34 m\xB3/h', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", colisage: "1/8", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite (ni sur la ligne, ni dans le titre de section)" },
      { ref: "REVPEB200", nom: '\xE9lectrovanne 200-PEB 2" FF 12 \xE0 45 m\xB3/h', categorie: "electrovanne", diametre: '2"', filetage: "FF", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 19", aVerifier: "tension non \xE9crite (ni sur la ligne, ni dans le titre de section)" },
      { ref: "REV300-BPE", nom: 'EV 300-BPE 3" FF', categorie: "electrovanne", diametre: '3"', filetage: "FF", tension: "24 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "AEV1201", nom: 'EV RICHDEL 2400 MT 1" FF', categorie: "electrovanne", marque: "RICHDEL", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "AEV1205", nom: 'EV RICHDEL 2400 MT 1" FF-L 9V', categorie: "electrovanne", marque: "RICHDEL", diametre: '1"', filetage: "FF", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20" },
      { ref: "HEV1701", nom: '\xE9lectrovanne PGV 100 1"FF 4 VIS 24V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "24 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20" },
      { ref: "HEV1731", nom: '\xE9lectrovanne PGV 100 1"FF 4 VIS 9V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20" },
      { ref: "HEV1721", nom: '\xE9lectrovanne PGV-100JT DC 1" FF 9V', categorie: "electrovanne", diametre: '1"', filetage: "FF", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20" },
      { ref: "HEV1724", nom: "\xE9lectrovanne PGV 100 JT FIL 1'' 9V", categorie: "electrovanne", diametre: "1''", tension: "9 V", colisage: "1/20", source: "patron", releve: "Aqua Plus 2026, p. 20" },
      { ref: "HEV2611", nom: '\xE9lectrovanne PGV-151G 1"1/2 FF en ligne ou en angle', categorie: "electrovanne", diametre: '1"1/2', filetage: "FF", tension: "24 V", colisage: "1/8", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "HEV2612", nom: '\xE9lectrovanne PGV-201G 2" FF en ligne ou en angle', categorie: "electrovanne", diametre: '2"', filetage: "FF", tension: "24 V", colisage: "1/8", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "tension non \xE9crite sur la ligne : lue dans le titre de section \xAB \xC9LECTROVANNES R\xC9SIDENTIELLES ET GRANDS ESPACES 24V \xBB" },
      { ref: "ODU301010", nom: 'DURA T\xE9 1" MFF', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU3010102", nom: 'DURA Collecteur M x F x 2 sorties 1"', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU3010103", nom: 'DURA Collecteur M x F x 3 sorties 1"', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU3010104", nom: 'DURA Collecteur M x F x 4 sorties 1"', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU306009", nom: 'DURA Coude 1" MF', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU306010", nom: 'DURA Coude 1" FF', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU320010", nom: 'DURA Croix 1" MFFF', categorie: "electrovanne", filetage: '1"', colisage: "15", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU329010", nom: 'DURA Manchon union 1" FF', categorie: "electrovanne", filetage: '1"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU348010", nom: 'DURA Bouchon 1"F', categorie: "electrovanne", filetage: '1"', colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU8303", nom: 'DURA Mamelon 1" MM', categorie: "electrovanne", filetage: '1"', colisage: "75", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU8303131", nom: 'DURA Mamelon R\xE9duit 1"x3/4" MM', categorie: "electrovanne", filetage: '1" x 3/4"', colisage: "75", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "ODU34MF", nom: 'DURA Union 1" MF', categorie: "electrovanne", filetage: '1"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 20", aVerifier: "raccord union d\xE9montable DURA (de quoi monter une nourrice), rang\xE9 page \xE9lectrovannes : mat\xE9riau non \xE9crit, aucune cat\xE9gorie pr\xE9vue pour lui, class\xE9 \xAB electrovanne \xBB faute de mieux" },
      { ref: "RG17104", nom: 'regard mini-rond 7" VB708B', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG6200", nom: 'regard rond 10" VB910B', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RGVB910C", nom: 'couvercle regard 10" VB910C', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17100", nom: 'regard rectangle 12" VB1419', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17101", nom: 'r\xE9hausse regard 12" VB1419E', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG1710009", nom: 'couvercle regard 12" VB1419C', categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17106", nom: "regard Jumbo VB1220", categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17107", nom: "r\xE9hausse regard Jumbo VB1220E", categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17108", nom: "couvercle regard Jumbo VB1220C", categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RGVB1324", nom: "regard Super Jumbo L x l x h = 83 x 59 x 39 VB1324", categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "RG17109", nom: "regard Maxi Jumbo L x l x h = 103 x 69 x 46 VB1730", categorie: "regard", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 21" },
      { ref: "TPEVO4IDEU", nom: "Programmateur EVOLUTION 4 voies int\xE9rieur", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "TPEVO4ODEU", nom: "Programmateur EVOLUTION 4 voies ext\xE9rieur", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "RP3242", nom: "ESP-TM2 4 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "RP3193", nom: "ESP-TM2 6 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "RP3146", nom: "ESP-TM2 8 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "RP3147", nom: "ESP-TM2 12 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "RP3315", nom: "CL\xC9 LNK WIFI ESP/ME-RZX", categorie: "accessoire de programmation", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 22" },
      { ref: "HPXC-E-XC401-E", nom: "programmateur XC-401x-E 4 stations avec coffret verrouillable", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPXC-E-XC601-E", nom: "programmateur XC-601x-E 6 stations avec coffret verrouillable", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPXC-801-X", nom: "programmateur XC-801x-E 8 stations avec coffret verrouillable", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPPC-301-E", nom: "programmateur HPC 4 stations extensible", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPX2-4", nom: "programmateur X2 4 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPX2-6", nom: "programmateur X2 6 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPX2-8", nom: "programmateur X2 8 stations", categorie: "programmateur", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 23" },
      { ref: "HPX2", nom: "programmateur X2 14 stations", categorie: "programmateur", tension: "220 V", source: "patron", releve: "Aqua Plus 2026, p. 23", aVerifier: "r\xE9f\xE9rence \xAB HPX2 \xBB sans suffixe, alors que les autres sont HPX2-4, HPX2-6, HPX2-8 : peut-\xEAtre tronqu\xE9e" },
      { ref: "SPVIL4", nom: "PROG SOLEM VILLA 4 VOIES", categorie: "programmateur", marque: "SOLEM", tension: "220 V", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SPVIL6", nom: "PROG SOLEM VILLA 6 VOIES", categorie: "programmateur", marque: "SOLEM", tension: "220 V", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SPVIL9", nom: "PROG SOLEM VILLA 9 VOIES", categorie: "programmateur", marque: "SOLEM", tension: "220 V", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SPVIL12", nom: "PROG SOLEM VILLA 12 VOIES", categorie: "programmateur", marque: "SOLEM", tension: "220 V", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP2741", nom: "PROG SOLEM WIFI SMART-IS 2 STATIONS", categorie: "programmateur", marque: "SOLEM", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP2742", nom: "PROG SOLEM WIFI SMART-IS 4 STATIONS", categorie: "programmateur", marque: "SOLEM", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP2743", nom: "PROG SOLEM WIFI SMART-IS 6 STATIONS", categorie: "programmateur", marque: "SOLEM", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP2744", nom: "PROG SOLEM WIFI SMART-IS 9 STATIONS", categorie: "programmateur", marque: "SOLEM", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP2745", nom: "PROG SOLEM WIFI SMART-IS 12 STATIONS", categorie: "programmateur", marque: "SOLEM", tension: "220 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24" },
      { ref: "SP1739", nom: "RELAIS SOLEM LR-MB10", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 24", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 26" },
      { ref: "SP1740", nom: "RELAIS SOLEM LR-MB30", categorie: "accessoire de programmation", marque: "SOLEM", source: "patron", releve: "Aqua Plus 2026, p. 24", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 26" },
      { ref: "AEV11401", nom: "PROG BUDDY TAP TIMER 1 STAT.", categorie: "programmateur", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le ; programmateur de robinet (se visse sur un robinet), pas un programmateur de r\xE9seau enterr\xE9" },
      { ref: "AEV11422", nom: "PROG BUDDY TAP TIMER 2 STAT.", categorie: "programmateur", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le ; programmateur de robinet (se visse sur un robinet), pas un programmateur de r\xE9seau enterr\xE9" },
      { ref: "RP13711", nom: "ESP-BAT-BT 1 STATION", categorie: "programmateur", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "RP13722", nom: "ESP-BAT-BT 2 STATIONS", categorie: "programmateur", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "RP13744", nom: "ESP-BAT-BT 4 STATIONS", categorie: "programmateur", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "RP13766", nom: "ESP-BAT-BT 6 STATIONS", categorie: "programmateur", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "RP1371", nom: "PROG RB ESP 9V 1 VOIE", categorie: "programmateur", tension: "9 V", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25" },
      { ref: "RP1372", nom: "PROG RB ESP 9V 2 VOIES", categorie: "programmateur", tension: "9 V", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25" },
      { ref: "RP1374", nom: "PROG RB ESP 9V 4 VOIES", categorie: "programmateur", tension: "9 V", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25" },
      { ref: "RP1376", nom: "PROG RB ESP 9V 6 VOIES", categorie: "programmateur", tension: "9 V", colisage: "1/6", source: "patron", releve: "Aqua Plus 2026, p. 25" },
      { ref: "RPJVP300", nom: "sol\xE9no\xEFde compact 9V \xE0 impulsion LU3100", categorie: "electrovanne", tension: "9 V", colisage: "1/4", source: "patron", releve: "Aqua Plus 2026, p. 25", aVerifier: "sol\xE9no\xEFde seul (pi\xE8ce d'\xE9lectrovanne), pas une \xE9lectrovanne compl\xE8te" },
      { ref: "SP1721", nom: "PROG SOLEM BL-IP 1 STATION 9 V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1722", nom: "PROG SOLEM BL-IP 2 STATION 9 V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1724", nom: "PROG SOLEM BL-IP 4 STATION 9 V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1726", nom: "PROG SOLEM BL-IP 6 STATION 9 V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1741", nom: "PROG SOLEM LR-IP 1 STATION 9V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1742", nom: "PROG SOLEM LR-IP 2 STATION 9V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1743", nom: "PROG SOLEM LR-IP 4 STATION 9V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1744", nom: "PROG SOLEM LR-IP 6 STATION 9V", categorie: "programmateur", marque: "SOLEM", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SP1739", nom: "RELAIS SOLEM LR-MB10", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 24" },
      { ref: "SP1740", nom: "RELAIS SOLEM LR-MB30", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 24" },
      { ref: "SP174011", nom: "SOLEM MODULE LR-MS 1", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26" },
      { ref: "SPWOOBEE1", nom: "PROG SOLEM WOOBEE 1 VOIE", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "SPWOOBEE2", nom: "PROG SOLEM WOOBEE 2 VOIES", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "SPWOOBEE4", nom: "PROG SOLEM WOOBEE 4 VOIES", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "SPWOOBEE6", nom: "PROG SOLEM WOOBEE 6 VOIES", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le" },
      { ref: "SP1151", nom: "Programmateur nez de rob. SOLEM BL - NR - 1 voie", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le ; programmateur de nez de robinet, pas un programmateur de r\xE9seau enterr\xE9" },
      { ref: "SP1152", nom: "Programmateur nez de rob. SOLEM BL - LR - 1 voie", categorie: "programmateur", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "tension non \xE9crite pour ce mod\xE8le ; la d\xE9signation dit \xAB BL - LR \xBB sous le titre \xAB SERIE LR - NR \xBB : recopi\xE9e telle quelle" },
      { ref: "SP1739", nom: "RELAIS SOLEM LR-MB10", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 24" },
      { ref: "SP1740", nom: "RELAIS SOLEM LR-MB30", categorie: "accessoire de programmation", marque: "SOLEM", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 26", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 24" },
      { ref: "ELD60481", nom: "pile alcaline 9V 6LR61", categorie: "accessoire de programmation", tension: "9 V", colisage: "1/12", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "ELD40034", nom: "accumulateur rechargeable 9V pour SIRR+,HP et DIALOG+", categorie: "accessoire de programmation", tension: "9 V", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "ELD1605", nom: "pile CR2032 3V pour RainSensor sans fil", categorie: "accessoire de programmation", tension: "3 V", colisage: "2", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "RP403", nom: "sonde pluie RSD-Bex Rain Bird", categorie: "accessoire de programmation", marque: "Rain Bird", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "HPMINICLIK", nom: "pluviom\xE8tre Mini-Clik Hunter", categorie: "accessoire de programmation", marque: "Hunter", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "HPRAINCLIK", nom: "pluviom\xE8tre Rain-Clik WRC-INT radio Hunter", categorie: "accessoire de programmation", marque: "Hunter", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "HP6226", nom: "Sonde d'humidit\xE9 et solaire Solar SYNC", categorie: "accessoire de programmation", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "HP6228", nom: "Sonde d'humidit\xE9 et solaire Solar SYNC SANS FIL", categorie: "accessoire de programmation", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 27" },
      { ref: "ELD550077", nom: "connexion \xE9tanche 3 fils DBM (3 fils de 1,5 mm\xB2)", categorie: "accessoire de programmation", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 27", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 57" },
      { ref: "OPL701016", nom: "manchon 16 x 16", categorie: "raccord PE", diametre: "16", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701020", nom: "manchon 20 x 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701025", nom: "manchon 25 x 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701032", nom: "manchon 32 x 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701040", nom: "manchon 40 x 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701050", nom: "manchon 50 x 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701063", nom: "manchon 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701075", nom: "manchon 75 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL701090", nom: "manchon 90 x 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL7010110", nom: "manchon 110 x 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71102016", nom: "manchon r\xE9duit 20 x 16", categorie: "raccord PE", diametre: "20 x 16", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71102516", nom: "manchon r\xE9duit 25 x 16", categorie: "raccord PE", diametre: "25 x 16", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71102520", nom: "manchon r\xE9duit 25 x 20", categorie: "raccord PE", diametre: "25 x 20", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71103220", nom: "manchon r\xE9duit 32 x 20", categorie: "raccord PE", diametre: "32 x 20", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71103225", nom: "manchon r\xE9duit 32 x 25", categorie: "raccord PE", diametre: "32 x 25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71104025", nom: "manchon r\xE9duit 40 x 25", categorie: "raccord PE", diametre: "40 x 25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71104032", nom: "manchon r\xE9duit 40 x 32", categorie: "raccord PE", diametre: "40 x 32", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71105025", nom: "manchon r\xE9duit 50 x 25", categorie: "raccord PE", diametre: "50 x 25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71105032", nom: "manchon r\xE9duit 50 x 32", categorie: "raccord PE", diametre: "50 x 32", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71105040", nom: "manchon r\xE9duit 50 x 40", categorie: "raccord PE", diametre: "50 x 40", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71106325", nom: "manchon r\xE9duit 63 x 25", categorie: "raccord PE", diametre: "63 x 25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71106332", nom: "manchon r\xE9duit 63 x 32", categorie: "raccord PE", diametre: "63 x 32", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71106340", nom: "manchon r\xE9duit 63 x 40", categorie: "raccord PE", diametre: "63 x 40", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71106350", nom: "manchon r\xE9duit 63 x 50", categorie: "raccord PE", diametre: "63 x 50", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71107550", nom: "manchon r\xE9duit 75 x 50 MILLENIUM", categorie: "raccord PE", diametre: "75 x 50", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71107563", nom: "manchon r\xE9duit 75 x 63 MILLENIUM", categorie: "raccord PE", diametre: "75 x 63", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71109063", nom: "manchon r\xE9duit 90 x 63 MILLENIUM", categorie: "raccord PE", diametre: "90 x 63", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL71109075", nom: "manchon r\xE9duit 90 x 75 MILLENIUM", categorie: "raccord PE", diametre: "90 x 75", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL711011090", nom: "manchon r\xE9duit 110 x 90 MILLENIUM", categorie: "raccord PE", diametre: "110 x 90", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761020", nom: "manchon de r\xE9paration 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761025", nom: "manchon de r\xE9paration 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761032", nom: "manchon de r\xE9paration 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761040", nom: "manchon de r\xE9paration 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761050", nom: "manchon de r\xE9paration 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761063", nom: "manchon de r\xE9paration 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761075", nom: "manchon de r\xE9paration 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL761090", nom: "manchon de r\xE9paration 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL7610110", nom: "manchon de r\xE9paration 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 28" },
      { ref: "OPL70201615", nom: 'raccord m\xE2le 16 x 1/2"', categorie: "raccord PE", diametre: "16", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70201620", nom: 'raccord m\xE2le 16 x 3/4"', categorie: "raccord PE", diametre: "16", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202015", nom: 'raccord m\xE2le 20 x 1/2"', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202020", nom: 'raccord m\xE2le 20 x 3/4"', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202026", nom: 'raccord m\xE2le 20 x 1"', categorie: "raccord PE", diametre: "20", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202515", nom: 'raccord m\xE2le 25 x 1/2"', categorie: "raccord PE", diametre: "25", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202520", nom: 'raccord m\xE2le 25 x 3/4"', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70202526", nom: 'raccord m\xE2le 25 x 1"', categorie: "raccord PE", diametre: "25", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70203220", nom: 'raccord m\xE2le 32 x 3/4"', categorie: "raccord PE", diametre: "32", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70203226", nom: 'raccord m\xE2le 32 x 1"', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70203233", nom: 'raccord m\xE2le 32 x 1"1/4', categorie: "raccord PE", diametre: "32", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70203240", nom: 'raccord m\xE2le 32 x 1"1/2', categorie: "raccord PE", diametre: "32", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70204026", nom: 'raccord m\xE2le 40 x 1"', categorie: "raccord PE", diametre: "40", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70204033", nom: 'raccord m\xE2le 40 x 1"1/4', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70204040", nom: 'raccord m\xE2le 40 x 1"1/2', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70204050", nom: 'raccord m\xE2le 40 x 2"', categorie: "raccord PE", diametre: "40", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70205026", nom: 'raccord m\xE2le 50 x 1"', categorie: "raccord PE", diametre: "50", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70205033", nom: 'raccord m\xE2le 50 x 1"1/4', categorie: "raccord PE", diametre: "50", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70205040", nom: 'raccord m\xE2le 50 x 1"1/2', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70205050", nom: 'raccord m\xE2le 50 x 2"', categorie: "raccord PE", diametre: "50", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70206333", nom: 'raccord m\xE2le 63 x 1"1/4', categorie: "raccord PE", diametre: "63", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70206340", nom: 'raccord m\xE2le 63 x 1"1/2', categorie: "raccord PE", diametre: "63", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70206350", nom: 'raccord m\xE2le 63 x 2"', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70206366", nom: 'raccord m\xE2le 63 x 2"1/2', categorie: "raccord PE", diametre: "63", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70207550", nom: 'raccord m\xE2le 75 x 2" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70207566", nom: 'raccord m\xE2le 75 x 2"1/2 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70207580", nom: 'raccord m\xE2le 75 x 3" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70209050", nom: 'raccord m\xE2le 90 x 2" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70209066", nom: 'raccord m\xE2le 90 x 2"1/2 MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70209080", nom: 'raccord m\xE2le 90 x 3" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL702090102", nom: 'raccord m\xE2le 90 x 4" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 29", aVerifier: `r\xE9f\xE9rence OPL702090102 imprim\xE9e deux fois sur la page, pour le 90 x 4" et pour le 110 x 4" : l'une des deux est fausse` },
      { ref: "OPL702011050", nom: 'raccord m\xE2le 110 x 2" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL702011080", nom: 'raccord m\xE2le 110 x 3" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL702090102", nom: 'raccord m\xE2le 110 x 4" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 29", aVerifier: `r\xE9f\xE9rence OPL702090102 imprim\xE9e deux fois sur la page, pour le 90 x 4" et pour le 110 x 4" : l'une des deux est fausse` },
      { ref: "OPL712020", nom: "bouchon m\xE2le 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712025", nom: "bouchon m\xE2le 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712032", nom: "bouchon m\xE2le 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712040", nom: "bouchon m\xE2le 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712050", nom: "bouchon m\xE2le 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712063", nom: "bouchon m\xE2le 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712075", nom: "bouchon m\xE2le 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL712090", nom: "bouchon m\xE2le 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL7120110", nom: "bouchon m\xE2le 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 29" },
      { ref: "OPL70301615", nom: 'raccord femelle 16 x 1/2"', categorie: "raccord PE", diametre: "16", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70301620", nom: 'raccord femelle 16 x 3/4"', categorie: "raccord PE", diametre: "16", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70302015", nom: 'raccord femelle 20 x 1/2"', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70302020", nom: 'raccord femelle 20 x 3/4"', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70302026", nom: 'raccord femelle 20 x 1"', categorie: "raccord PE", diametre: "20", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70302520", nom: 'raccord femelle 25 x 3/4"', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70302526", nom: 'raccord femelle 25 x 1"', categorie: "raccord PE", diametre: "25", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70303220", nom: 'raccord femelle 32 x 3/4"', categorie: "raccord PE", diametre: "32", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70303226", nom: 'raccord femelle 32 x 1"', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70303233", nom: 'raccord femelle 32 x 1"1/4', categorie: "raccord PE", diametre: "32", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70304026", nom: 'raccord femelle 40 x 1"', categorie: "raccord PE", diametre: "40", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70304033", nom: 'raccord femelle 40 x 1"1/4', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70304040", nom: 'raccord femelle 40 x 1"1/2', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70305033", nom: 'raccord femelle 50 x 1"1/4', categorie: "raccord PE", diametre: "50", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70305040", nom: 'raccord femelle 50 x 1"1/2', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70305050", nom: 'raccord femelle 50 x 2"', categorie: "raccord PE", diametre: "50", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70306333", nom: 'raccord femelle 63 x 1"1/4', categorie: "raccord PE", diametre: "63", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70306340", nom: 'raccord femelle 63 x 1"1/2', categorie: "raccord PE", diametre: "63", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70306350", nom: 'raccord femelle 63 x 2"', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70307550", nom: 'raccord femelle 75 x 2" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70307566", nom: 'raccord femelle 75 x 2"1/2 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70309050", nom: 'raccord femelle 90 x 2" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL70309080", nom: 'raccord femelle 90 x 3" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL703090102", nom: 'raccord femelle 90 x 4" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL703011080", nom: 'raccord femelle 110 x 3" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL7030110102", nom: 'raccord femelle 110 x 4" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704016", nom: "t\xE9 90\xB0 16 x 16 x 16", categorie: "raccord PE", diametre: "16", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704020", nom: "t\xE9 90\xB0 20 x 20 x 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704025", nom: "t\xE9 90\xB0 25 x 25 x 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704032", nom: "t\xE9 90\xB0 32 x 32 x 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704040", nom: "t\xE9 90\xB0 40 x 40 x 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704050", nom: "t\xE9 90\xB0 50 x 50 x 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704063", nom: "t\xE9 90\xB0 63 x 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704075", nom: "t\xE9 90\xB0 75 x 75 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704090", nom: "t\xE9 90\xB0 90 x 90 x 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL7040110", nom: "t\xE9 90\xB0 110 x 110 x 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704520", nom: "t\xE9 90\xB0 de r\xE9paration 20 x 20 x 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704525", nom: "t\xE9 90\xB0 de r\xE9paration 25 x 25 x 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704532", nom: "t\xE9 90\xB0 de r\xE9paration 32 x 32 x 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704540", nom: "t\xE9 90\xB0 de r\xE9paration 40 x 40 x 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704550", nom: "t\xE9 90\xB0 de r\xE9paration 50 x 50 x 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL704563", nom: "t\xE9 90\xB0 de r\xE9paration 63 x 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 30" },
      { ref: "OPL71401615", nom: 't\xE9 90\xB0 taraud\xE9 16 x 1/2" x 16', categorie: "raccord PE", diametre: "16", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71401620", nom: 't\xE9 90\xB0 taraud\xE9 16 x 3/4" x 16', categorie: "raccord PE", diametre: "16", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402015", nom: 't\xE9 90\xB0 taraud\xE9 20 x 1/2" x 20', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402020", nom: 't\xE9 90\xB0 taraud\xE9 20 x 3/4" x 20', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402515", nom: 't\xE9 90\xB0 taraud\xE9 25 x 1/2" x 25', categorie: "raccord PE", diametre: "25", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402520", nom: 't\xE9 90\xB0 taraud\xE9 25 x 3/4" x 25', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402526", nom: 't\xE9 90\xB0 taraud\xE9 25 x 1" x 25', categorie: "raccord PE", diametre: "25", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71402533", nom: 't\xE9 90\xB0 taraud\xE9 25 x 1"1/4 x 25', categorie: "raccord PE", diametre: "25", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71403220", nom: 't\xE9 90\xB0 taraud\xE9 32 x 3/4" x 32', categorie: "raccord PE", diametre: "32", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71403226", nom: 't\xE9 90\xB0 taraud\xE9 32 x 1" x 32', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71403233", nom: 't\xE9 90\xB0 taraud\xE9 32 x 1"1/4 x 32', categorie: "raccord PE", diametre: "32", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71403240", nom: 't\xE9 90\xB0 taraud\xE9 32 x 1"1/2 x 32', categorie: "raccord PE", diametre: "32", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71404026", nom: 't\xE9 90\xB0 taraud\xE9 40 x 1" x 40', categorie: "raccord PE", diametre: "40", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71404033", nom: 't\xE9 90\xB0 taraud\xE9 40 x 1"1/4 x 40', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71404040", nom: 't\xE9 90\xB0 taraud\xE9 40 x 1"1/2 x 40', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71404050", nom: 't\xE9 90\xB0 taraud\xE9 40 x 2" x 40', categorie: "raccord PE", diametre: "40", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71405040", nom: 't\xE9 90\xB0 taraud\xE9 50 x 1"1/2 x 50', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71405050", nom: 't\xE9 90\xB0 taraud\xE9 50 x 2" x 50', categorie: "raccord PE", diametre: "50", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71406333", nom: 't\xE9 90\xB0 taraud\xE9 63 x 1"1/4" x 63', categorie: "raccord PE", diametre: "63", filetage: '1"1/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71406340", nom: 't\xE9 90\xB0 taraud\xE9 63 x 1"1/2" x 63', categorie: "raccord PE", diametre: "63", filetage: '1"1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71406350", nom: 't\xE9 90\xB0 taraud\xE9 63 x 2" x 63', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71407550", nom: 't\xE9 90\xB0 taraud\xE9 75 x 2" x 75 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71407566", nom: 't\xE9 90\xB0 taraud\xE9 75 x 2"1/2 x 75 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71407580", nom: 't\xE9 90\xB0 taraud\xE9 75 x 3" x 75 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL71409080", nom: 't\xE9 90\xB0 taraud\xE9 90 x 3" x 90 MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL7140110102", nom: 't\xE9 90\xB0 taraud\xE9 110 x 4" x 110 MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78402015", nom: 't\xE9 90\xB0 filet\xE9 20 x 1/2" x 20', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78402020", nom: 't\xE9 90\xB0 filet\xE9 20 x 3/4" x 20', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78402515", nom: 't\xE9 90\xB0 filet\xE9 25 x 1/2" x 25', categorie: "raccord PE", diametre: "25", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78402520", nom: 't\xE9 90\xB0 filet\xE9 25 x 3/4" x 25', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78403226", nom: 't\xE9 90\xB0 filet\xE9 32 x 1" x 32', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78404033", nom: 't\xE9 90\xB0 filet\xE9 40 x 1"1/4 x 40', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78404040", nom: 't\xE9 90\xB0 filet\xE9 40 x 1"1/2 x 40', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78405033", nom: 't\xE9 90\xB0 filet\xE9 50 x 1"1/4 x 50', categorie: "raccord PE", diametre: "50", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78405040", nom: 't\xE9 90\xB0 filet\xE9 50 x 1"1/2 x 50', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78406333", nom: 't\xE9 90\xB0 filet\xE9 63 x 1"1/4 x 63', categorie: "raccord PE", diametre: "63", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78406340", nom: 't\xE9 90\xB0 filet\xE9 63 x 1"1/2 x 63', categorie: "raccord PE", diametre: "63", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL78406350", nom: 't\xE9 90\xB0 filet\xE9 63 x 2" x 63', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL764063", nom: "t\xE9 45\xB0 63 x 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL764075", nom: "t\xE9 45\xB0 75 x 75 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL764090", nom: "t\xE9 45\xB0 90 x 90 x 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL7640110", nom: "t\xE9 45\xB0 110 x 110 x 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 31" },
      { ref: "OPL73402016", nom: "t\xE9 90\xB0 r\xE9duit 20 x 16 x 20", categorie: "raccord PE", diametre: "20 x 16 x 20", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73402520", nom: "t\xE9 90\xB0 r\xE9duit 25 x 20 x 25", categorie: "raccord PE", diametre: "25 x 20 x 25", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73403225", nom: "t\xE9 90\xB0 r\xE9duit 32 x 25 x 32", categorie: "raccord PE", diametre: "32 x 25 x 32", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73404025", nom: "t\xE9 90\xB0 r\xE9duit 40 x 25 x 40", categorie: "raccord PE", diametre: "40 x 25 x 40", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73404032", nom: "t\xE9 90\xB0 r\xE9duit 40 x 32 x 40", categorie: "raccord PE", diametre: "40 x 32 x 40", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73405025", nom: "t\xE9 90\xB0 r\xE9duit 50 x 25 x 50", categorie: "raccord PE", diametre: "50 x 25 x 50", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73405032", nom: "t\xE9 90\xB0 r\xE9duit 50 x 32 x 50", categorie: "raccord PE", diametre: "50 x 32 x 50", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73405040", nom: "t\xE9 90\xB0 r\xE9duit 50 x 40 x 50", categorie: "raccord PE", diametre: "50 x 40 x 50", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73406332", nom: "t\xE9 90\xB0 r\xE9duit 63 x 32 x 63", categorie: "raccord PE", diametre: "63 x 32 x 63", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73406340", nom: "t\xE9 90\xB0 r\xE9duit 63 x 40 x 63", categorie: "raccord PE", diametre: "63 x 40 x 63", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73406350", nom: "t\xE9 90\xB0 r\xE9duit 63 x 50 x 63", categorie: "raccord PE", diametre: "63 x 50 x 63", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL73407563", nom: "t\xE9 90\xB0 r\xE9duit 75 x 63 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75 x 63 x 75", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705016", nom: "coude \xE0 90\xB0 16 x 16", categorie: "raccord PE", diametre: "16", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705020", nom: "coude \xE0 90\xB0 20 x 20", categorie: "raccord PE", diametre: "20", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705025", nom: "coude \xE0 90\xB0 25 x 25", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705032", nom: "coude \xE0 90\xB0 32 x 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705040", nom: "coude \xE0 90\xB0 40 x 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705050", nom: "coude \xE0 90\xB0 50 x 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705063", nom: "coude \xE0 90\xB0 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705075", nom: "coude \xE0 90\xB0 75 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL705090", nom: "coude \xE0 90\xB0 90 x 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL7050110", nom: "coude \xE0 90\xB0 110 x 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78502015", nom: 'coude filet\xE9 20 x 1/2"', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78502020", nom: 'coude filet\xE9 20 x 3/4"', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78502515", nom: 'coude filet\xE9 25 x 1/2"', categorie: "raccord PE", diametre: "25", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78502520", nom: 'coude filet\xE9 25 x 3/4"', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78502526", nom: 'coude filet\xE9 25 x 1"', categorie: "raccord PE", diametre: "25", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78503226", nom: 'coude filet\xE9 32 x 1"', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78503233", nom: 'coude filet\xE9 32 x 1"1/4', categorie: "raccord PE", diametre: "32", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78504026", nom: 'coude filet\xE9 40 x 1"', categorie: "raccord PE", diametre: "40", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78504033", nom: 'coude filet\xE9 40 x 1"1/4', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78504040", nom: 'coude filet\xE9 40 x 1"1/2', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78505026", nom: 'coude filet\xE9 50 x 1"', categorie: "raccord PE", diametre: "50", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78505033", nom: 'coude filet\xE9 50 x 1"1/4', categorie: "raccord PE", diametre: "50", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78505040", nom: 'coude filet\xE9 50 x 1"1/2', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78506333", nom: 'coude filet\xE9 63 x 1"1/4', categorie: "raccord PE", diametre: "63", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78506340", nom: 'coude filet\xE9 63 x 1"1/2', categorie: "raccord PE", diametre: "63", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78506350", nom: 'coude filet\xE9 63 x 2"', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78507560", nom: 'coude filet\xE9 75 x 2"1/2 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78507580", nom: 'coude filet\xE9 75 x 3" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL78509080", nom: 'coude filet\xE9 90 x 3" MILLENIUM', categorie: "raccord PE", diametre: "90", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL7850110102", nom: 'coude filet\xE9 110 x 4" MILLENIUM', categorie: "raccord PE", diametre: "110", filetage: '4"', source: "patron", releve: "Aqua Plus 2026, p. 32" },
      { ref: "OPL71501615", nom: 'coude taraud\xE9 16 x 1/2"', categorie: "raccord PE", diametre: "16", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71502015", nom: 'coude taraud\xE9 20 x 1/2"', categorie: "raccord PE", diametre: "20", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71502020", nom: 'coude taraud\xE9 20 x 3/4"', categorie: "raccord PE", diametre: "20", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71502515", nom: 'coude taraud\xE9 25 x 1/2"', categorie: "raccord PE", diametre: "25", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71502520", nom: 'coude taraud\xE9 25 x 3/4"', categorie: "raccord PE", diametre: "25", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71502526", nom: 'coude taraud\xE9 25 x 1"', categorie: "raccord PE", diametre: "25", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71503220", nom: 'coude taraud\xE9 32 x 3/4"', categorie: "raccord PE", diametre: "32", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71503226", nom: 'coude taraud\xE9 32 x 1"', categorie: "raccord PE", diametre: "32", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71503233", nom: 'coude taraud\xE9 32 x 1"1/4', categorie: "raccord PE", diametre: "32", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71504026", nom: 'coude taraud\xE9 40 x 1"', categorie: "raccord PE", diametre: "40", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71504033", nom: 'coude taraud\xE9 40 x 1"1/4', categorie: "raccord PE", diametre: "40", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71504040", nom: 'coude taraud\xE9 40 x 1"1/2', categorie: "raccord PE", diametre: "40", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71504050", nom: 'coude taraud\xE9 40 x 2"', categorie: "raccord PE", diametre: "40", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71505026", nom: 'coude taraud\xE9 50 x 1"', categorie: "raccord PE", diametre: "50", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71505033", nom: 'coude taraud\xE9 50 x 1"1/4', categorie: "raccord PE", diametre: "50", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71505040", nom: 'coude taraud\xE9 50 x 1"1/2', categorie: "raccord PE", diametre: "50", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71505050", nom: 'coude taraud\xE9 50 x 2"', categorie: "raccord PE", diametre: "50", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71506333", nom: 'coude taraud\xE9 63 x 1"1/4', categorie: "raccord PE", diametre: "63", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71506340", nom: 'coude taraud\xE9 63 x 1"1/2', categorie: "raccord PE", diametre: "63", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71506350", nom: 'coude taraud\xE9 63 x 2"', categorie: "raccord PE", diametre: "63", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71507550", nom: 'coude taraud\xE9 75 x 2" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71507566", nom: 'coude taraud\xE9 75 x 2"1/2 MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL71507580", nom: 'coude taraud\xE9 75 x 3" MILLENIUM', categorie: "raccord PE", diametre: "75", filetage: '3"', source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746032", nom: "coude \xE0 45\xB0 32 x 32", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746040", nom: "coude \xE0 45\xB0 40 x 40", categorie: "raccord PE", diametre: "40", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746050", nom: "coude \xE0 45\xB0 50 x 50", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746063", nom: "coude \xE0 45\xB0 63 x 63", categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746075", nom: "coude \xE0 45\xB0 75 x 75 MILLENIUM", categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL746090", nom: "coude \xE0 45\xB0 90 x 90 MILLENIUM", categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL7460110", nom: "coude \xE0 45\xB0 110 x 110 MILLENIUM", categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72205040", nom: 'raccord \xE0 bride 50 DN 40 (1"1/2)', categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72205050", nom: 'raccord \xE0 bride 50 DN 50 (2")', categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72206350", nom: 'raccord \xE0 bride 63 DN 50 (2")', categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72207565", nom: 'raccord \xE0 bride 75 DN 65 (2"1/2) MILLENIUM', categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72209080", nom: 'raccord \xE0 bride 90 DN 80 (3") MILLENIUM', categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL722090100", nom: 'raccord \xE0 bride 90 DN 100 (4") MILLENIUM', categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL7220110100", nom: 'raccord \xE0 bride 110 DN 100 (4") MILLENIUM', categorie: "raccord PE", diametre: "110", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL7220125125", nom: 'raccord \xE0 bride 125 DN 125 (5")', categorie: "raccord PE", diametre: "125", source: "patron", releve: "Aqua Plus 2026, p. 33" },
      { ref: "OPL72365040", nom: 'adaptateur \xE0 bride 50 DN 40 (1"1/2)', categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL72366365", nom: 'adaptateur \xE0 bride 63 DN 65 (2"1/2)', categorie: "raccord PE", diametre: "63", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL72367560", nom: 'adaptateur \xE0 bride 75 DN 65 (2"1/2) MILLENIUM', categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL72367580", nom: 'adaptateur \xE0 bride 75 DN 80 (3") MILLENIUM', categorie: "raccord PE", diametre: "75", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL72369060", nom: 'adaptateur \xE0 bride 90 DN 65 (2"1/2) MILLENIUM', categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL72369080", nom: 'adaptateur \xE0 bride 90 DN 80 (3") MILLENIUM', categorie: "raccord PE", diametre: "90", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79302520", nom: "set de r\xE9duction 25 x 20", categorie: "raccord PE", diametre: "25 x 20", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79303220", nom: "set de r\xE9duction 32 x 20", categorie: "raccord PE", diametre: "32 x 20", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79303225", nom: "set de r\xE9duction 32 x 25", categorie: "raccord PE", diametre: "32 x 25", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79304032", nom: "set de r\xE9duction 40 x 32", categorie: "raccord PE", diametre: "40 x 32", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79305025", nom: "set de r\xE9duction 50 x 25", categorie: "raccord PE", diametre: "50 x 25", source: "patron", releve: "Aqua Plus 2026, p. 34", aVerifier: "r\xE9f\xE9rence OPL79305025 imprim\xE9e deux fois, pour le 50 x 25 et pour le 63 x 25 : l'une des deux est fausse" },
      { ref: "OPL79305032", nom: "set de r\xE9duction 50 x 32", categorie: "raccord PE", diametre: "50 x 32", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79305040", nom: "set de r\xE9duction 50 x 40", categorie: "raccord PE", diametre: "50 x 40", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79305025", nom: "set de r\xE9duction 63 x 25", categorie: "raccord PE", diametre: "63 x 25", source: "patron", releve: "Aqua Plus 2026, p. 34", aVerifier: "r\xE9f\xE9rence OPL79305025 imprim\xE9e deux fois, pour le 50 x 25 et pour le 63 x 25 : l'une des deux est fausse" },
      { ref: "OPL79306340", nom: "set de r\xE9duction 63 x 40", categorie: "raccord PE", diametre: "63 x 40", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPL79306350", nom: "set de r\xE9duction 63 x 50", categorie: "raccord PE", diametre: "63 x 50", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD770101522", nom: "manchon PLASS4 25 x (15 - 22)", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD770102027", nom: "manchon PLASS4 25 x (20 - 27)", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD77010273525", nom: "manchon PLASS4 25 x (27 - 35)", categorie: "raccord PE", diametre: "25", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD77010202732", nom: "manchon PLASS4 32 x (20 - 27)", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD770102735", nom: "manchon PLASS4 32 x (27 - 35)", categorie: "raccord PE", diametre: "32", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OD770103550", nom: "manchon PLASS4 50 x (35 - 50)", categorie: "raccord PE", diametre: "50", source: "patron", releve: "Aqua Plus 2026, p. 34" },
      { ref: "OPP506715", nom: 'mamelon double 1/2" x 1/2"', categorie: "raccord polypro", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP506720", nom: 'mamelon double 3/4" x 3/4"', categorie: "raccord polypro", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP506726", nom: 'mamelon double 1" x 1"', categorie: "raccord polypro", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP506733", nom: 'mamelon double 1"1/4 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP506740", nom: 'mamelon double 1"1/2 x 1"1/2', categorie: "raccord polypro", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP506750", nom: 'mamelon double 2" x 2"', categorie: "raccord polypro", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50652015", nom: 'mamelon r\xE9duit 3/4" x 1/2"', categorie: "raccord polypro", filetage: '3/4" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50652615", nom: 'mamelon r\xE9duit 1" x 1/2"', categorie: "raccord polypro", filetage: '1" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50652620", nom: 'mamelon r\xE9duit 1" x 3/4"', categorie: "raccord polypro", filetage: '1" x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50653315", nom: 'mamelon r\xE9duit 1"1/4 x 1/2"', categorie: "raccord polypro", filetage: '1"1/4 x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50653320", nom: 'mamelon r\xE9duit 1"1/4 x 3/4"', categorie: "raccord polypro", filetage: '1"1/4 x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50653326", nom: 'mamelon r\xE9duit 1"1/4 x 1"', categorie: "raccord polypro", filetage: '1"1/4 x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50654015", nom: 'mamelon r\xE9duit 1"1/2 x 1/2"', categorie: "raccord polypro", filetage: '1"1/2 x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50654020", nom: 'mamelon r\xE9duit 1"1/2 x 3/4"', categorie: "raccord polypro", filetage: '1"1/2 x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50654026", nom: 'mamelon r\xE9duit 1"1/2 x 1"', categorie: "raccord polypro", filetage: '1"1/2 x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50654033", nom: 'mamelon r\xE9duit 1"1/2 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/2 x 1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50655015", nom: 'mamelon r\xE9duit 2" x 1/2"', categorie: "raccord polypro", filetage: '2" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50655020", nom: 'mamelon r\xE9duit 2" x 3/4"', categorie: "raccord polypro", filetage: '2" x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50655026", nom: 'mamelon r\xE9duit 2" x 1"', categorie: "raccord polypro", filetage: '2" x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50655033", nom: 'mamelon r\xE9duit 2" x 1"1/4', categorie: "raccord polypro", filetage: '2" x 1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50655040", nom: 'mamelon r\xE9duit 2" x 1"1/2', categorie: "raccord polypro", filetage: '2" x 1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50272015", nom: 'manchon r\xE9duit MxF 3/4" x 1/2"', categorie: "raccord polypro", filetage: '3/4" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50272615", nom: 'manchon r\xE9duit MxF 1" x 1/2"', categorie: "raccord polypro", filetage: '1" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50272620", nom: 'manchon r\xE9duit MxF 1" x 3/4"', categorie: "raccord polypro", filetage: '1" x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50273315", nom: 'manchon r\xE9duit MxF 1"1/4 x 1/2"', categorie: "raccord polypro", filetage: '1"1/4 x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50273320", nom: 'manchon r\xE9duit MxF 1"1/4 x 3/4"', categorie: "raccord polypro", filetage: '1"1/4 x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50273326", nom: 'manchon r\xE9duit MxF 1"1/4 x 1"', categorie: "raccord polypro", filetage: '1"1/4 x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50274015", nom: 'manchon r\xE9duit MxF 1"1/2 x 1/2"', categorie: "raccord polypro", filetage: '1"1/2 x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50274020", nom: 'manchon r\xE9duit MxF 1"1/2 x 3/4"', categorie: "raccord polypro", filetage: '1"1/2 x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50274026", nom: 'manchon r\xE9duit MxF 1"1/2 x 1"', categorie: "raccord polypro", filetage: '1"1/2 x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50274033", nom: 'manchon r\xE9duit MxF 1"1/2 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/2 x 1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50275015", nom: 'manchon r\xE9duit MxF 2" x 1/2"', categorie: "raccord polypro", filetage: '2" x 1/2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50275020", nom: 'manchon r\xE9duit MxF 2" x 3/4"', categorie: "raccord polypro", filetage: '2" x 3/4"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50275026", nom: 'manchon r\xE9duit MxF 2" x 1"', categorie: "raccord polypro", filetage: '2" x 1"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50275033", nom: 'manchon r\xE9duit MxF 2" x 1"1/4', categorie: "raccord polypro", filetage: '2" x 1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50275040", nom: 'manchon r\xE9duit MxF 2" x 1"1/2', categorie: "raccord polypro", filetage: '2" x 1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50276650", nom: 'manchon r\xE9duit MxF 2"1/2 x 2"', categorie: "raccord polypro", filetage: '2"1/2 x 2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50278040", nom: 'manchon r\xE9duit MxF 3" x 1"1/2', categorie: "raccord polypro", filetage: '3" x 1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50278050", nom: 'manchon r\xE9duit MxF 3" x 2"', categorie: "raccord polypro", filetage: '3" x 2"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP50278065", nom: 'manchon r\xE9duit MxF 3" x 2"1/2', categorie: "raccord polypro", filetage: '3" x 2"1/2', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP502710280", nom: 'manchon r\xE9duit MxF 4" x 3"', categorie: "raccord polypro", filetage: '4" x 3"', source: "patron", releve: "Aqua Plus 2026, p. 35" },
      { ref: "OPP501715", nom: 'manchon 1/2" x 1/2"', categorie: "raccord polypro", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP501720", nom: 'manchon 3/4" x 3/4"', categorie: "raccord polypro", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP501726", nom: 'manchon 1" x 1"', categorie: "raccord polypro", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP501733", nom: 'manchon 1"1/4 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP501740", nom: 'manchon 1"1/2 x 1"1/2', categorie: "raccord polypro", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP501750", nom: 'manchon 2" x 2"', categorie: "raccord polypro", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504715", nom: 't\xE9 90\xB0 1/2" x 1/2" x 1/2"', categorie: "raccord polypro", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504720", nom: 't\xE9 90\xB0 3/4" x 3/4" x 3/4"', categorie: "raccord polypro", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504726", nom: 't\xE9 90\xB0 1" x 1" x 1"', categorie: "raccord polypro", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504733", nom: 't\xE9 90\xB0 1"1/4 x 1"1/4 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504740", nom: 't\xE9 90\xB0 1"1/2 x 1"1/2 x 1"1/2', categorie: "raccord polypro", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP504750", nom: 't\xE9 90\xB0 2" x 2" x 2"', categorie: "raccord polypro", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505715", nom: 'coude 90\xB0 1/2" x 1/2"', categorie: "raccord polypro", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505720", nom: 'coude 90\xB0 3/4" x 3/4"', categorie: "raccord polypro", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505726", nom: 'coude 90\xB0 1" x 1"', categorie: "raccord polypro", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505733", nom: 'coude 90\xB0 1"1/4 x 1"1/4', categorie: "raccord polypro", filetage: '1"1/4', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505740", nom: 'coude 90\xB0 1"1/2 x 1"1/2', categorie: "raccord polypro", filetage: '1"1/2', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505750", nom: 'coude 90\xB0 2" x 2"', categorie: "raccord polypro", filetage: '2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505915", nom: 'coude 90\xB0 MxF 1/2"', categorie: "raccord polypro", filetage: '1/2"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505920", nom: 'coude 90\xB0 MxF 3/4"', categorie: "raccord polypro", filetage: '3/4"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "OPP505926", nom: 'coude 90\xB0 MxF 1"', categorie: "raccord polypro", filetage: '1"', source: "patron", releve: "Aqua Plus 2026, p. 36" },
      { ref: "UPE500600", nom: "tube P.E.B.D. \xD8 16mm 4 bars (13,6 x 16)", categorie: "tube PE", diametre: "16", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE1116", nom: "tube P.E.B.D. \xD8 16mm 6,3 bars (12 x 16)", categorie: "tube PE", diametre: "16", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer ; m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 14" },
      { ref: "UPE225", nom: "tube P.E.H.D. irrigation \xD8 25mm 10 bars (20,4 x 25)", categorie: "tube PE", diametre: "25", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE232", nom: "tube P.E.H.D. irrigation \xD8 32mm 10 bars (26,2 x 32)", categorie: "tube PE", diametre: "32", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE240", nom: "tube P.E.H.D. NF \xD8 40mm 10 bars (32,6 x 40)", categorie: "tube PE", diametre: "40", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE250", nom: "tube P.E.H.D. NF \xD8 50mm 10 bars (40,8 x 50)", categorie: "tube PE", diametre: "50", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE263", nom: "tube P.E.H.D. NF \xD8 63mm 10 bars (51,4 x 63)", categorie: "tube PE", diametre: "63", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UPE275", nom: "tube P.E.H.D. NF \xD8 75mm 10 bars (61,4 x 75)", categorie: "tube PE", diametre: "75", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 47", aVerifier: "longueur de couronne non \xE9crite ; le colisage (50) est peut-\xEAtre la couronne en m\xE8tres, \xE0 confirmer" },
      { ref: "UGGMC-206", nom: "G A G \xD8 6MM 0.15M 2L/H 30ML", categorie: "goutte-\xE0-goutte", diametre: "6", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 48" },
      { ref: "UGGMC-206_N", nom: "G AG \xD8 6MM 0.15M 2L/H 30ML noir", categorie: "goutte-\xE0-goutte", diametre: "6", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 48", aVerifier: "d\xE9signation imprim\xE9e \xAB G AG \xBB (la ligne du dessus dit \xAB G A G \xBB) : recopi\xE9e telle quelle" },
      { ref: "UGGCBL23050", nom: "tube \xD816mm 2l/h esp.33cm autor\xE9gul\xE9", categorie: "goutte-\xE0-goutte", diametre: "16", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 48" },
      { ref: "UGGRBXFS", nom: "tube \xD816mm 2,3l/h esp.33cm autor\xE9gul\xE9 enterrable", categorie: "goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 48" },
      { ref: "UGG1516", nom: "tuyau poreux \xD8 16mm 4l/h par m\xE8tre \xE0 0.5 bars - PS maxi 1 bar", categorie: "goutte-\xE0-goutte", diametre: "16", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 48" },
      { ref: "MIAOCTA8", nom: "schrubbler r\xE9glable 0 \xE0 50l/h bouton can 4x6mm", categorie: "goutte-\xE0-goutte", diametre: "4x6mm", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 48", aVerifier: "diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-\xE0-goutte : class\xE9 \xAB goutte-\xE0-goutte \xBB faute de cat\xE9gorie plus juste" },
      { ref: "MIAOCTA8P", nom: "schrubbler r\xE9glable 0 \xE0 50l/h sur pique 10cm", categorie: "goutte-\xE0-goutte", colisage: "25", source: "patron", releve: "Aqua Plus 2026, p. 48", aVerifier: "diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-\xE0-goutte : class\xE9 \xAB goutte-\xE0-goutte \xBB faute de cat\xE9gorie plus juste" },
      { ref: "MIALST4A", nom: "pique 30cm avec tubing 40cm prise d'eau 4x6m (Micro Stake)", categorie: "goutte-\xE0-goutte", diametre: "4x6m", colisage: "1/100", source: "patron", releve: "Aqua Plus 2026, p. 48", aVerifier: "diffuseur ou micro-tube de micro-irrigation, pas un tube goutte-\xE0-goutte : class\xE9 \xAB goutte-\xE0-goutte \xBB faute de cat\xE9gorie plus juste" },
      { ref: "MID3904", nom: "perceur 3mm pour PE", categorie: "raccord goutte-\xE0-goutte", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 49", aVerifier: "outil (perceur), pas un raccord : class\xE9 avec les accessoires pour micro-tube o\xF9 le catalogue le range" },
      { ref: "MID1221", nom: "perceur pince 3mm 16/20", categorie: "raccord goutte-\xE0-goutte", source: "patron", releve: "Aqua Plus 2026, p. 49", aVerifier: "outil (perceur), pas un raccord : class\xE9 avec les accessoires pour micro-tube o\xF9 le catalogue le range" },
      { ref: "MID1222", nom: "perceur pince 3mm 25/32", categorie: "raccord goutte-\xE0-goutte", source: "patron", releve: "Aqua Plus 2026, p. 49", aVerifier: "outil (perceur), pas un raccord : class\xE9 avec les accessoires pour micro-tube o\xF9 le catalogue le range" },
      { ref: "MID3302", nom: "t\xE9 4x6mm", categorie: "raccord goutte-\xE0-goutte", diametre: "4x6mm", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID3303", nom: "croix 4x6mm", categorie: "raccord goutte-\xE0-goutte", diametre: "4x6mm", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID3304", nom: "coude 4x6mm", categorie: "raccord goutte-\xE0-goutte", diametre: "4x6mm", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID3412", nom: "bouchon gaffeur 4x6mm - grappe de 10", categorie: "raccord goutte-\xE0-goutte", diametre: "4x6mm", colisage: "10", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MIAL3401", nom: "vannette 4x6mm", categorie: "raccord goutte-\xE0-goutte", diametre: "4x6mm", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6101", nom: "jonction cannel\xE9e \xD8 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6102", nom: "jonction cannel\xE9e \xD8 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6121", nom: "t\xE9 cannel\xE9 \xD8 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6122", nom: "t\xE9 cannel\xE9 \xD8 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6141", nom: "coude cannel\xE9 \xD8 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6142", nom: "coude cannel\xE9 \xD8 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6171", nom: "bouchon cannel\xE9 \xD8 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6172", nom: "bouchon cannel\xE9 \xD8 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6711", nom: "collier plastique \xD8 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6712", nom: "collier plastique \xD8 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6511", nom: "crampon de sol \xD8 16-20 noir", categorie: "raccord goutte-\xE0-goutte", diametre: "16-20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6514", nom: "crampon de sol \xD8 16-20 marron", categorie: "raccord goutte-\xE0-goutte", diametre: "16-20", colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6151", nom: 'embout can \xD8 16 x fil 1/2"', categorie: "raccord goutte-\xE0-goutte", diametre: "16", filetage: '1/2"', colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6152", nom: 'embout can \xD8 16 x fil 3/4"', categorie: "raccord goutte-\xE0-goutte", diametre: "16", filetage: '3/4"', colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6254", nom: 'embout can \xD8 20 x fil 3/4"', categorie: "raccord goutte-\xE0-goutte", diametre: "20", filetage: '3/4"', colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6162", nom: 'embout can \xD8 16 x tar 3/4" \xE9crou tournant + joint', categorie: "raccord goutte-\xE0-goutte", diametre: "16", filetage: '3/4"', colisage: "100", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6601", nom: "vannette plastique cannel\xE9e \xD8 16 x 16", categorie: "raccord goutte-\xE0-goutte", diametre: "16", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6602", nom: "vannette plastique cannel\xE9e \xD8 20 x 20", categorie: "raccord goutte-\xE0-goutte", diametre: "20", colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6611", nom: 'vannette plastique fil 3/4" x cannel\xE9e \xD8 16', categorie: "raccord goutte-\xE0-goutte", diametre: "16", filetage: '3/4"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6612", nom: 'vannette plastique fil 3/4" x cannel\xE9e \xD8 20', categorie: "raccord goutte-\xE0-goutte", diametre: "20", filetage: '3/4"', colisage: "50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6301", nom: "jonction Palaplast \xD816", categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6321", nom: "t\xE9 Palaplast \xD816", categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6341", nom: "coude Palaplast \xD816", categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6352", nom: 'embout filet\xE9 Palaplast 16 x 3/4"', categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", filetage: '3/4"', colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6362", nom: 'embout Palaplast taraud\xE9 16 x 3/4"', categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", filetage: '3/4"', colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6371", nom: "bouchon Palaplast \xD816", categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "MID6631", nom: "vannette Palaplast \xD816", categorie: "raccord goutte-\xE0-goutte", marque: "Palaplast", diametre: "16", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 49" },
      { ref: "BVA3861", nom: 'vanne 1/4 de tour FF 1/2"', categorie: "robinetterie", diametre: '1/2"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA3862", nom: 'vanne 1/4 de tour FF 3/4"', categorie: "robinetterie", diametre: '3/4"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA3863", nom: 'vanne 1/4 de tour FF 1"', categorie: "robinetterie", diametre: '1"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA3864", nom: 'vanne 1/4 de tour FF 1"1/4', categorie: "robinetterie", diametre: '1"1/4', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA3865", nom: 'vanne 1/4 de tour FF 1"1/2', categorie: "robinetterie", diametre: '1"1/2', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA3866", nom: 'vanne 1/4 de tour FF 2"', categorie: "robinetterie", diametre: '2"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA931", nom: 'vanne 1/4 de tour + purge FF 1/2"', categorie: "robinetterie", diametre: '1/2"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA932", nom: 'vanne 1/4 de tour + purge FF 3/4"', categorie: "robinetterie", diametre: '3/4"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA933", nom: 'vanne 1/4 de tour + purge FF 1"', categorie: "robinetterie", diametre: '1"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA934", nom: 'vanne 1/4 de tour + purge FF 1"1/4', categorie: "robinetterie", diametre: '1"1/4', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA935", nom: 'vanne 1/4 de tour + purge FF 1"1/2', categorie: "robinetterie", diametre: '1"1/2', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "BVA936", nom: 'vanne 1/4 de tour + purge FF 2"', categorie: "robinetterie", diametre: '2"', filetage: "FF", colisage: "1", source: "patron", releve: "Aqua Plus 2026, p. 56" },
      { ref: "ELC4003", nom: "c\xE2ble 1000 RO2V 3 G 1,5mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4004", nom: "c\xE2ble 1000 RO2V 4 G 1,5mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4005", nom: "c\xE2ble 1000 RO2V 5 G 1,5mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC40325", nom: "c\xE2ble 1000 RO2V 3 G 2,5mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4024", nom: "c\xE2ble 1000 RO2V 4 G 2,5mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4085", nom: "c\xE2ble irrigation 5x0,8mm\xB2 30V maxi - enterrable", categorie: "\xE9lectricit\xE9", colisage: "75/150/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4087", nom: "c\xE2ble irrigation 7x0,8mm\xB2 30V maxi - enterrable", categorie: "\xE9lectricit\xE9", colisage: "75/150/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4089", nom: "c\xE2ble irrigation 9x0,8mm\xB2 30V maxi - enterrable", categorie: "\xE9lectricit\xE9", colisage: "75/150/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELC4090", nom: "c\xE2ble irrigation 13x0,8mm\xB2 30V maxi - enterrable", categorie: "\xE9lectricit\xE9", colisage: "75/150/300", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELD550077", nom: "connexion \xE9tanche 3 fils DBM (3 fils de 1,5 mm\xB2)", categorie: "\xE9lectricit\xE9", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 57", aVerifier: "m\xEAme r\xE9f\xE9rence aussi imprim\xE9e p. 27" },
      { ref: "ELD221413.", nom: "connexion Wago 3x4 mm\xB2", categorie: "\xE9lectricit\xE9", marque: "Wago", colisage: "1/50", source: "patron", releve: "Aqua Plus 2026, p. 57", aVerifier: "la r\xE9f\xE9rence porte un point final dans le catalogue : recopi\xE9e telle quelle" },
      { ref: "ELD221415.", nom: "connexion Wago 5x4 mm\xB2", categorie: "\xE9lectricit\xE9", marque: "Wago", colisage: "1/25", source: "patron", releve: "Aqua Plus 2026, p. 57", aVerifier: "la r\xE9f\xE9rence porte un point final dans le catalogue : recopi\xE9e telle quelle" },
      { ref: "ELD5111", nom: "connexion Blazing BBS 1,5mm MAX 30V", categorie: "\xE9lectricit\xE9", tension: "30 V", colisage: "1/25", source: "patron", releve: "Aqua Plus 2026, p. 57" },
      { ref: "ELD40038", nom: "domino 6 mm\xB2", categorie: "\xE9lectricit\xE9", colisage: "1/10", source: "patron", releve: "Aqua Plus 2026, p. 58" },
      { ref: "ELD40025", nom: "bo\xEEte de d\xE9rivation Plexo \xD8 60mm", categorie: "\xE9lectricit\xE9", colisage: "1/5", source: "patron", releve: "Aqua Plus 2026, p. 58" },
      { ref: "ELD40024", nom: "bo\xEEte de d\xE9rivation Plexo \xD8 70mm", categorie: "\xE9lectricit\xE9", colisage: "1/5", source: "patron", releve: "Aqua Plus 2026, p. 58" },
      { ref: "ELDLEG92110", nom: "bo\xEEte de d\xE9rivation Plexo 65x65x40mm", categorie: "\xE9lectricit\xE9", colisage: "1/5", source: "patron", releve: "Aqua Plus 2026, p. 58" },
      { ref: "ELD40050", nom: "bo\xEEte de d\xE9rivation Plexo 105x105x55mm", categorie: "\xE9lectricit\xE9", colisage: "1/5", source: "patron", releve: "Aqua Plus 2026, p. 58" },
      { ref: "ELD100PAN", nom: "ruban isolant \xE9lectrique (10mx15mm - \xE9p.0,15mm)", categorie: "\xE9lectricit\xE9", colisage: "10", source: "patron", releve: "Aqua Plus 2026, p. 58" }
    ],
    /* ── SES RACCORDS À COMPRESSION PLASSON DU Ø16 RIGIDE ────────────────────
       Ses photos du 18 octobre 2026 : « tout ce que je t'envoie, c'est de la même
       gamme et c'est pour du 16 rigide ». Le Plasson à bague blanche du relevé
       Aqua Plus ne prend que le PE 25 ou 32 : ces pièces-ci sont d'une autre
       gamme. AUCUNE RÉFÉRENCE : il ne sait pas laquelle c'est, et « avec cette
       photo et le nom, n'importe quel fournisseur sait de quoi on parle ». Sans
       `releve`, `referenceDe` n'en écrit donc aucune. Les noms sont les siens :
       « manchon à compression, Plasson, et après 16 par 16 ». Le filetage du té
       taraudé et du manchon fileté : 3/4", sa réponse du 18 octobre 2026. */
    raccords16Rigide: [
      { ref: "plasson16-raccord-taraude", nom: 'raccord taraud\xE9 \xE0 compression Plasson 16 x 3/4", pour 16 rigide', categorie: "raccord PE", marque: "Plasson", diametre: "16", filetage: '3/4"', source: "patron", photo: "sa photo du 18 octobre 2026" },
      { ref: "plasson16-manchon", nom: "manchon \xE0 compression Plasson 16 x 16, pour 16 rigide", categorie: "raccord PE", marque: "Plasson", diametre: "16", source: "patron", photo: "sa photo du 18 octobre 2026" },
      { ref: "plasson16-te", nom: "t\xE9 \xE0 compression Plasson 16 x 16 x 16, pour 16 rigide", categorie: "raccord PE", marque: "Plasson", diametre: "16", source: "patron", photo: "sa photo du 18 octobre 2026" },
      { ref: "plasson16-te-taraude", nom: 't\xE9 taraud\xE9 \xE0 compression Plasson 16 x 3/4" x 16, pour 16 rigide', categorie: "raccord PE", marque: "Plasson", diametre: "16", filetage: '3/4"', source: "patron", photo: "sa photo du 18 octobre 2026" },
      { ref: "plasson16-coude", nom: "coude \xE0 compression Plasson 16 x 16, pour 16 rigide", categorie: "raccord PE", marque: "Plasson", diametre: "16", source: "patron", photo: "sa photo du 18 octobre 2026" },
      { ref: "plasson16-manchon-filete", nom: 'manchon filet\xE9 \xE0 compression Plasson 16 x 3/4", pour 16 rigide', categorie: "raccord PE", marque: "Plasson", diametre: "16", filetage: '3/4"', source: "patron", photo: "sa photo du 18 octobre 2026" }
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
      {
        ref: "RP403",
        nom: "sonde pluie RSD-Bex Rain Bird",
        regle: "option",
        source: "patron",
        releve: "Aqua Plus 2026, p. 27"
      }
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
      debitMin: 0.05,
      debitMax100: 9.08,
      debitMax075: 5,
      pressionMin: 1,
      pressionMax: 10,
      // Au-delà, la notice impose un réducteur AVANT la vanne.
      reducteurAuDelaDe: 5.5,
      // Les modèles mâle-mâle et mâle-cannelé sont déconseillés au-delà.
      debitMaxMMetMB: 6.8,
      source: "patron",
      releve: "Notice Rain Bird DV/DVF, P/N 231576-B (2011)",
      // **SA PERTE DE CHARGE, relevée le 17 octobre 2026 avec son accord** :
      // catalogue Rain Bird, Valves, p. 89, « DV and DVF Valve Pressure Loss (bar)
      // METRIC », colonne « 100-DV/100-DVF 1" », la sienne en MM comme en FF.
      // [débit en m³/h, perte en bar]. Elle remplace le forfait de 0,25 bar,
      // qui comptait trop peu dès 1,2 m³/h.
      perte: [[0.23, 0.23], [0.6, 0.24], [1.2, 0.26], [3.6, 0.32], [4.5, 0.35], [6, 0.41], [9, 0.59]],
      perteReleve: "Catalogue Rain Bird, Valves, p. 89"
    },
    /* ── LES PIÈCES DE NOURRICE — un catalogue à part, référencé par les fiches
       ci-dessous. Chaque pièce n'est écrite QU'UNE FOIS ici, même si elle
       revient dans les six fiches (l'électrovanne, par exemple, est dans les
       six) : la retaper à chaque fois aurait fini par diverger — un accent, un
       chiffre — et l'écart se serait vu exactement là où il compare deux
       fiches. Reçues le 17 août 2026 : « voici toutes les pièces pour la
       nourrice, ce qui se trouve dans le regard d'arrosage. » */
    // Les références Aqua Plus (`aquaplus`) : posées avec son accord le 18 octobre 2026. Le té MMF, la
    // vanne de purge et les regards jumbo 5 et 6 voies sont, selon lui, les pièces que vend Aqua Plus
    // sous un autre nom. Le BL-IP, le régulateur et le PEBD Ø16 s'achètent là-bas sans référence :
    // « juste cette nomenclature-là, ils comprendront ».
    piecesNourrice: {
      "coude-mf": { nom: 'Coude 90\xB0 taraud\xE9/filet\xE9 MF 1"', marque: "Dura", aquaplus: "ODU306009" },
      // Le coude FF et le raccord femelle 25 x 3/4" remplacent, le 18 octobre 2026
      // et sur ses réponses, le « coude MM » et le « raccord mâle 25 1" » de ses
      // fiches du 17 août : ce sont les pièces qu'il pose (Aqua Plus ODU306010, OPL70302520).
      "coude-ff": { nom: 'Coude 1" FF', marque: "Dura", aquaplus: "ODU306010" },
      "mamelon": { nom: 'Mamelon r\xE9duit filet\xE9 MM 1"-3/4"', marque: "Dura", aquaplus: "ODU8303131" },
      // **Les pièces 6 et 7 de la nourrice, corrigées par lui le 18 octobre 2026** :
      // *« je me suis trompé sur le montage, le 6 c'est le même mais en femelle-femelle,
      // et la pièce en dessous c'est un 25 x 1" »*. L'union MF et le raccord femelle
      // 25 x 3/4" de la veille sont remplacés partout où la fiche les comptait.
      "union": { nom: 'Manchon union 1" FF', marque: "Dura", aquaplus: "ODU329010" },
      "vanne-purge": { nom: 'Vanne avec vis de purge 3/4"', marque: "Dura", aquaplus: "BVA932" },
      "electrovanne-100dv": { nom: '\xC9lectrovanne 100 DV 1" MM 9V', marque: "Rain Bird", aquaplus: "REV100DVM9V" },
      "raccord-male25": { nom: 'Raccord m\xE2le 25 x 1"', marque: "Plasson", aquaplus: "OPL70202526" },
      "regard-rect12": { nom: 'Regard rectangle 12"', marque: "Dura", aquaplus: "RG17100" },
      "regard-rg17106": { nom: "Regard jumbo RG17106", marque: "Dura", aquaplus: "RG17106" },
      "regard-jumbo5": { nom: "Regard jumbo 5 voies", marque: "Dura", aquaplus: "RG17106" },
      "regard-jumbo6": { nom: "Regard jumbo 6 voies", marque: "Dura", aquaplus: "RG17106" },
      // Le nom d'Aqua Plus, sa demande du 18 octobre 2026 (il l'appelait « té 1" MMF ») : c'est sous ce
      // nom que le fournisseur le cherche. La clé reste `te-mmf`, elle ne s'affiche nulle part.
      "te-mmf": { nom: 'T\xE9 1" MFF', marque: "Dura", aquaplus: "ODU301010" },
      "clarinette-2v": { nom: 'Collecteur M x F x 2 sorties 1"', marque: "Dura", aquaplus: "ODU3010102" },
      "clarinette-3v": { nom: 'Collecteur M x F x 3 sorties 1"', marque: "Dura", aquaplus: "ODU3010103" },
      "clarinette-4v": { nom: 'Collecteur M x F x 4 sorties 1"', marque: "Dura", aquaplus: "ODU3010104" },
      "prog-1": { nom: "Programmateur BL-IP 1 station 9V", marque: "Solem" },
      "prog-2": { nom: "Programmateur BL-IP 2 stations 9V", marque: "Solem" },
      "prog-4": { nom: "Programmateur BL-IP 4 stations 9V", marque: "Solem" },
      "prog-6": { nom: "Programmateur BL-IP 6 stations 9V", marque: "Solem" },
      "pile-9v": { nom: "Pile alcaline 9V", aquaplus: "ELD60481" },
      "connexion": { nom: "Connexion \xE9tanche", aquaplus: "ELD550077" },
      /* ── Modification GOUTTE-À-GOUTTE — reçue le 17 août 2026 ───────────────
         « Lorsqu'un réseau est pour du goutte-à-goutte, quelques modifications
         s'appliquent : régulateur de pression FF 3/4", électrovanne 100-DV 1"
         FF (au lieu de MM), 2 mamelons réduits en plus, 1 mamelon droit. »
         Ces pièces ne remplacent PAS une fiche entière : elles s'appliquent
         PAR VOIE, à celles qui alimentent une zone goutte-à-goutte. Voir
         `CATALOGUE.ficheNourrice`, plus bas, qui fait ce mélange. */
      "regulateur-ff34": { nom: 'R\xE9gulateur de pression FF 3/4"', marque: "Dura" },
      "electrovanne-100dv-ff": { nom: '\xC9lectrovanne 100 DV 1" FF 9V', marque: "Rain Bird", aquaplus: "REV100DV9V" },
      "mamelon-droit-1": { nom: 'Mamelon filet\xE9 MM 1"', marque: "Dura", aquaplus: "ODU8303" }
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
        nom: "Nourrice 1 voie",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "coude-mf", q: 1 },
          { ref: "coude-ff", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "union", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "electrovanne-100dv", q: 1 },
          { ref: "raccord-male25", q: 2 },
          { ref: "regard-rect12", q: 1 },
          { ref: "prog-1", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 2 }
        ]
      },
      2: {
        nom: "Nourrice 2 voies",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "te-mmf", q: 1 },
          { ref: "coude-ff", q: 1 },
          { ref: "union", q: 3 },
          { ref: "electrovanne-100dv", q: 2 },
          { ref: "raccord-male25", q: 3 },
          { ref: "coude-mf", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "regard-rect12", q: 1 },
          { ref: "prog-2", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 6 }
        ]
      },
      3: {
        nom: "Nourrice 3 voies",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "clarinette-2v", q: 1 },
          { ref: "union", q: 4 },
          { ref: "electrovanne-100dv", q: 3 },
          { ref: "raccord-male25", q: 4 },
          { ref: "coude-ff", q: 1 },
          { ref: "coude-mf", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "regard-rect12", q: 1 },
          { ref: "prog-4", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 6 }
        ]
      },
      4: {
        nom: "Nourrice 4 voies",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "clarinette-3v", q: 1 },
          { ref: "union", q: 5 },
          { ref: "electrovanne-100dv", q: 4 },
          { ref: "raccord-male25", q: 5 },
          { ref: "coude-ff", q: 1 },
          { ref: "coude-mf", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "regard-rg17106", q: 1 },
          { ref: "prog-4", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 8 }
        ]
      },
      5: {
        nom: "Nourrice 5 voies",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "clarinette-4v", q: 1 },
          { ref: "union", q: 6 },
          { ref: "electrovanne-100dv", q: 5 },
          { ref: "raccord-male25", q: 6 },
          { ref: "coude-ff", q: 1 },
          { ref: "coude-mf", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "regard-jumbo5", q: 1 },
          { ref: "prog-6", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 12 }
        ]
      },
      6: {
        // Même clarinette « 4 vannes » que la fiche 5 voies, plus un Té 1" MMF
        // absent des autres fiches : CONFIRMÉ par lui le 17 août — « oui c'est
        // voulu, c'est comme ça que se constitue une nourrice 6 voies ». Ce
        // n'était pas une coquille de transcription ; ne pas y toucher.
        nom: "Nourrice 6 voies",
        source: "patron",
        releve: "17 ao\xFBt 2026",
        pieces: [
          { ref: "clarinette-4v", q: 1 },
          { ref: "union", q: 7 },
          { ref: "electrovanne-100dv", q: 6 },
          { ref: "raccord-male25", q: 7 },
          { ref: "coude-ff", q: 1 },
          { ref: "coude-mf", q: 1 },
          { ref: "mamelon", q: 2 },
          { ref: "vanne-purge", q: 1 },
          { ref: "te-mmf", q: 1 },
          { ref: "regard-jumbo6", q: 1 },
          { ref: "prog-6", q: 1 },
          { ref: "pile-9v", q: 1 },
          { ref: "connexion", q: 20 }
        ]
      }
    }
  };
  CATALOGUE.piece = function(ref) {
    return CATALOGUE.piecesNourrice[ref] || null;
  };
  CATALOGUE.pieceAjoutable = function(ref) {
    return CATALOGUE.piecesAjoutables.filter(function(x) {
      return x.ref === ref;
    })[0] || null;
  };
  CATALOGUE.ficheNourrice = function(n, combienGoutte) {
    var base = CATALOGUE.nourrices[n];
    if (!base) return null;
    var g = Math.max(0, Math.min(combienGoutte || 0, n));
    var pieces = base.pieces.map(function(p) {
      return { ref: p.ref, q: p.q };
    });
    if (g > 0) {
      var electro = pieces.filter(function(p) {
        return p.ref === "electrovanne-100dv";
      })[0];
      if (electro) electro.q = Math.max(0, electro.q - g);
      pieces.push({ ref: "electrovanne-100dv-ff", q: g });
      pieces.push({ ref: "regulateur-ff34", q: g });
      pieces.push({ ref: "mamelon", q: g * 2 });
      pieces.push({ ref: "mamelon-droit-1", q: g });
    }
    var fusion = {};
    pieces.forEach(function(p) {
      fusion[p.ref] = (fusion[p.ref] || 0) + p.q;
    });
    var piecesFusionnees = Object.keys(fusion).filter(function(ref) {
      return fusion[ref] > 0;
    }).map(function(ref) {
      return { ref, q: fusion[ref] };
    });
    return { nom: base.nom, source: base.source, pieces: piecesFusionnees };
  };
  CATALOGUE.gaines.forEach(function(g) {
    g.debitMetre = g.debitGoutteur / g.ecartGoutteurs / 1e3;
  });
  CATALOGUE.buses.forEach(function(b) {
    if (b.pourType !== "turbine") return;
    if (b.debit[360] == null) return;
    if (b.debit[90] != null || b.debit[180] != null) return;
    b.debit[90] = b.debit[360];
    b.debit[180] = b.debit[360];
    b.debitMemeQuelQueSoitLArc = true;
  });
  CATALOGUE.busesDe = function(marqueCle, pourType) {
    return CATALOGUE.buses.filter(function(b) {
      if (b.marqueCle !== marqueCle || b.pourType !== pourType) return false;
      return b.debit[90] != null && b.debit[180] != null && (b.debit[360] != null || b.debit[330] != null);
    }).sort(function(a, b) {
      return b.rayon - a.rayon;
    });
  };
  CATALOGUE.referenceDe = function(cle) {
    if (!cle) return null;
    var piece = CATALOGUE.piecesNourrice[cle] || CATALOGUE.piecesReseau[cle];
    if (piece) return piece.aquaplus && CATALOGUE.pieceAjoutable(piece.aquaplus) ? piece.aquaplus : null;
    var listes = [
      CATALOGUE.buses,
      CATALOGUE.corps,
      CATALOGUE.coudes,
      CATALOGUE.gaines,
      CATALOGUE.materiel,
      CATALOGUE.piecesAjoutables
    ];
    for (var i = 0; i < listes.length; i++) {
      var trouve = (listes[i] || []).filter(function(x) {
        return x.ref === cle;
      })[0];
      if (trouve) return trouve.releve && !trouve.livreeAvecLArroseur ? trouve.ref : null;
    }
    return null;
  };
  CATALOGUE.tousLesProduits = function() {
    var out = [];
    CATALOGUE.buses.forEach(function(b) {
      out.push({
        ref: b.ref,
        nom: "Buse " + b.nom + " \u2014 " + (b.marque || "Rain Bird"),
        detail: "rayon " + String(b.rayon).replace(".", ",") + " m \xE0 " + String(b.pression).replace(".", ",") + " bar" + (b.livreeAvecLArroseur ? ", livr\xE9e avec l'arroseur" : ", par " + b.colisage),
        famille: "Buses"
      });
    });
    CATALOGUE.corps.forEach(function(c) {
      out.push({ ref: c.ref, nom: c.nom, detail: c.detail || "", famille: "Corps d'arroseur" });
    });
    CATALOGUE.coudes.forEach(function(c) {
      out.push({ ref: c.ref, nom: c.nom, detail: c.detail, famille: "Raccordement" });
    });
    Object.keys(CATALOGUE.piecesNourrice).forEach(function(ref) {
      var p = CATALOGUE.piecesNourrice[ref];
      out.push({ ref, nom: (p.marque ? p.marque + " " : "") + p.nom, detail: "", famille: "Nourrice" });
    });
    Object.keys(CATALOGUE.piecesReseau).forEach(function(ref) {
      var p = CATALOGUE.piecesReseau[ref];
      out.push({ ref, nom: (p.marque ? p.marque + " " : "") + p.nom, detail: "", famille: "R\xE9seau lat\xE9ral" });
    });
    CATALOGUE.gaines.forEach(function(g) {
      out.push({ ref: g.ref, nom: g.nom, detail: g.detail, famille: "Goutte-\xE0-goutte" });
    });
    CATALOGUE.materiel.forEach(function(m) {
      out.push({ ref: m.ref, nom: m.nom, detail: m.unite === "ml" ? "au m\xE8tre" : "", famille: "Mat\xE9riel" });
    });
    return out;
  };
  CATALOGUE.corpsDe = function(marqueCle, pourType) {
    var type = pourType || "tuyere";
    return CATALOGUE.corps.filter(function(c) {
      return c.marqueCle === marqueCle && c.pourType === type;
    });
  };
  CATALOGUE.corpsParDefaut = function(marqueCle) {
    var chez = CATALOGUE.corpsDe(marqueCle);
    var dix = chez.filter(function(c) {
      return c.hauteur === 10 && c.options.length === 0;
    })[0];
    return dix || chez[0] || null;
  };
  CATALOGUE.corpsDeLaBuse = function(buse) {
    if (!buse || buse.pourType !== "turbine") return null;
    var base = buse.ref.split("-B")[0];
    return CATALOGUE.corps.filter(function(c) {
      return c.pourType === "turbine" && c.marqueCle === buse.marqueCle && c.ref.indexOf(base) === 0 && c.options.length <= 1;
    })[0] || CATALOGUE.corps.filter(function(c) {
      return c.pourType === "turbine" && c.marqueCle === buse.marqueCle && c.ref.indexOf(base) === 0;
    })[0] || null;
  };
  CATALOGUE.explicationCorps = function(c) {
    var h = "Escamotable " + c.hauteur + " cm \u2014 " + (c.hauteur <= 5 ? "pour un gazon tondu ras." : c.hauteur <= 10 ? "le plus courant." : c.hauteur <= 15 ? "pour une herbe plus haute ou un massif bas." : "pour une v\xE9g\xE9tation haute, loin de la tondeuse.");
    var opts = c.options.map(function(o) {
      return o === "clapet anti-vidange" ? "Clapet anti-vidange : \xE9vite les fuites au point bas apr\xE8s l'arr\xEAt, utile sur un terrain en pente." : o === "r\xE9gulateur de pression" ? "Pression r\xE9gul\xE9e : utile si la pression varie sur le r\xE9seau." : o;
    });
    return [h].concat(opts).join(" ");
  };
  CATALOGUE.marqueParDefaut = function() {
    var d = CATALOGUE.marques.filter(function(m) {
      return m.defaut;
    })[0];
    return d ? d.cle : CATALOGUE.marques[0].cle;
  };
  CATALOGUE.provisoires = function() {
    var n = 0;
    ["gaines", "materiel"].forEach(function(famille) {
      CATALOGUE[famille].forEach(function(x) {
        if (x.source === "provisoire") n++;
      });
    });
    return n;
  };

  // src/lib/arrosage/calcul.js
  var CLE_ETAT = typeof window !== "undefined" && window.CLE_ETAT || "atlas-arrosage";
  function charger() {
    try {
      var v = localStorage.getItem(CLE_ETAT);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  function poseSelonSaRegle(L, l, portee, bridage, tolerant, tour) {
    if (!(L > 0) || !(l > 0) || !(portee > 0)) return null;
    var rMin = tolerant ? RECOUVREMENT_MIN_TOLERE : RECOUVREMENT_MIN;
    var rMax = tolerant ? RECOUVREMENT_MAX_TOLERE : RECOUVREMENT_MAX;
    var plancher = portee * (1 - (bridage || 0));
    var nx = Math.max(2, Math.ceil(L * rMin / portee - 1e-9) + 1);
    var ny = Math.max(2, Math.ceil(l * rMin / portee - 1e-9) + 1);
    for (var t = 0; t < 400; t++) {
      var ex = L / (nx - 1), ey = l / (ny - 1);
      var reglee = Math.min(portee, Math.min(ex, ey) * rMax);
      if (reglee < plancher - 0.01) return null;
      if (Math.max(ex, ey) * rMin <= reglee + 0.01) {
        if (tour === false && nx > 2 && ny > 2) return null;
        return { nx, ny, ecartX: ex, ecartY: ey, reglee: Math.round(reglee * 100) / 100 };
      }
      if (ex >= ey) nx++;
      else ny++;
    }
    return null;
  }
  var EXPOSANT_PORTEE = 1 / 3;
  var pressionDeCalcul = null;
  function pressionRetenue() {
    return pressionDeCalcul !== null ? pressionDeCalcul : Number(etat.pression) || 0;
  }
  function porteeALaPression(b, reelle) {
    var reference = Number(b.pression) || 0;
    if (!(reference > 0) || !(reelle > 0)) return b.rayon;
    var rapport = reelle / reference;
    return rapport < 1 ? Math.round(b.rayon * Math.pow(rapport, EXPOSANT_PORTEE) * 100) / 100 : b.rayon;
  }
  function buseALaPression(b) {
    var reference = Number(b.pression) || 0;
    var reelle = pressionRetenue();
    if (!(reference > 0) || !(reelle > 0) || Math.abs(reelle - reference) < 0.01) return b;
    var rapport = reelle / reference;
    var debit = {};
    Object.keys(b.debit).forEach(function(angle) {
      if (b.debit[angle] == null) return;
      debit[angle] = Math.round(b.debit[angle] * Math.sqrt(rapport) * 1e3) / 1e3;
    });
    var corrigee = {};
    Object.keys(b).forEach(function(k) {
      corrigee[k] = b[k];
    });
    corrigee.debit = debit;
    corrigee.rayon = porteeALaPression(b, reelle);
    corrigee.rayonCatalogue = b.rayon;
    corrigee.debitCatalogue = b.debit;
    corrigee.pressionRetenue = reelle;
    return corrigee;
  }
  function modelePour(type, plusPetitCote, dims, refImposee) {
    var marque = marqueCourante();
    var cleMemo = marque + "|" + type + "|" + pressionRetenue();
    var buses = BUSES_A_LA_PRESSION[cleMemo] || (BUSES_A_LA_PRESSION[cleMemo] = CATALOGUE.busesDe(marque, type).map(buseALaPression).sort(function(x, y) {
      return y.rayon - x.rayon;
    }));
    if (buses.length) {
      var b = null;
      if (refImposee) {
        for (var k = 0; k < buses.length; k++) if (buses[k].ref === refImposee) b = buses[k];
      }
      if (!b && dims && dims.L > 0 && dims.l > 0) {
        for (var i = 0; i < buses.length; i++) {
          if (poseSelonSaRegle(dims.L, dims.l, buses[i].rayon, bridageDe(buses[i]), false, faitLeTour(buses[i]))) {
            b = buses[i];
            break;
          }
        }
      }
      if (!b) {
        var tenue = buses.filter(function(x) {
          return !plusPetitCote || x.rayon <= plusPetitCote;
        });
        b = tenue[0] || buses[buses.length - 1];
      }
      return {
        m: {
          ref: b.ref,
          nom: type === "tuyere" ? "Tuy\xE8re" : "Turbine",
          detail: b.nom,
          marque: nomDeMarque(b.marqueCle),
          marqueCle: b.marqueCle,
          type,
          portee: b.rayon,
          pression: b.pression,
          // **Une valeur corrigée doit pouvoir remonter à sa source.** Sans
          // cela, l'écran annonce « portée 4,8 m » là où le catalogue dit 5,2 et
          // personne ne sait plus lequel des deux croire devant le fournisseur.
          porteeCatalogue: b.rayonCatalogue || b.rayon,
          pressionRetenue: b.pressionRetenue || b.pression,
          debit360: b.debit[360],
          debitParAngle: b.debit,
          colisage: b.colisage,
          source: b.source,
          buse: b,
          famille: "Arroseurs"
        },
        // Les autres buses de cette marque qui PAVENT la zone, du plus grand
        // rayon au plus petit. C'est le champ des possibles que `poser()` explore.
        candidates: dims && dims.L > 0 && dims.l > 0 ? buses.filter(function(x) {
          return poseSelonSaRegle(dims.L, dims.l, x.rayon, bridageDe(x), false, faitLeTour(x)) || poseSelonSaRegle(dims.L, dims.l, x.rayon, bridageDe(x), true, faitLeTour(x));
        }).map(function(x) {
          return x.ref;
        }) : [],
        // Corps de CETTE marque, pas tous marques confondues : Rain Bird peut
        // être complet pendant que Toro n'a encore aucun corps.
        sansCorps: CATALOGUE.corps.filter(function(c) {
          return c.marqueCle === marque;
        }).length === 0
      };
    }
    return { m: null };
  }
  function marqueCourante() {
    var connues = CATALOGUE.marques.map(function(x) {
      return x.cle;
    });
    return connues.indexOf(etat.marque) >= 0 ? etat.marque : CATALOGUE.marqueParDefaut();
  }
  function nomDeMarque(cle) {
    var m = CATALOGUE.marques.filter(function(x) {
      return x.cle === cle;
    })[0];
    return m ? m.nom : cle;
  }
  function corpsCourant() {
    var chez = CATALOGUE.corpsDe(marqueCourante());
    var choisi = chez.filter(function(c) {
      return c.ref === etat.corps;
    })[0];
    return choisi || CATALOGUE.corpsParDefaut(marqueCourante());
  }
  var TYPES = {
    gazon: { nom: "Pelouse", forme: "surface", famille: "gazon", materiels: ["turbine", "tuyere"] },
    massif: { nom: "Massif", forme: "nappe", famille: "arbustes", ecartLignes: 0.8 },
    haie: { nom: "Haie", forme: "lineaire", famille: "arbustes" },
    potager: { nom: "Potager", forme: "nappe", famille: "potager", ecartLignes: 0.7 }
  };
  var MARGE = 0.85;
  var RECOUVREMENT_MIN = 0.8;
  var RECOUVREMENT_MAX = 1;
  var RECOUVREMENT_MIN_TOLERE = 0.75;
  var RECOUVREMENT_MAX_TOLERE = 1.05;
  function pressionMinDe(buse) {
    if (!buse) return null;
    if (buse.pourType === "turbine") {
      var c = CATALOGUE.corpsDeLaBuse(buse);
      return c && c.pressionMin > 0 ? c.pressionMin : null;
    }
    if (buse.pressionMin > 0) return buse.pressionMin;
    var t = corpsCourant();
    return t && t.pressionMin > 0 ? t.pressionMin : null;
  }
  function faitLeTour(buse) {
    return !buse || buse.debit[360] != null;
  }
  function bridageDe(buse) {
    if (!buse || buse.pourType !== "turbine") return 0;
    var c = CATALOGUE.corpsDeLaBuse(buse);
    return c && c.bridage > 0 ? c.bridage : 0;
  }
  var QUINCONCE_AU_DELA_DE = 4;
  var DEFAUTS = {
    seau: 10,
    temps: 20,
    pression: 3,
    compteur: null,
    corps: null,
    marque: null,
    // null = la marque par défaut du catalogue (Rain Bird)
    amenee: 30,
    pe25: 120,
    sonde: false,
    croquis: null,
    // La couronne de tube de goutte-à-goutte que vend son fournisseur, en mètres.
    couronne: 50,
    // Du regard à la première tête, en mètres. Lu sur le croquis quand il montre
    // la nourrice (`geometrie-croquis.ts`) ; zéro sinon, et l'écran le dit.
    regardVersZone: 0,
    zones: [
      { id: 1, nom: "Pelouse arri\xE8re", type: "gazon", L: 18, l: 12, materiel: "auto" },
      // **Plus de tuyères imposées sur une grande pelouse (17 août).** Les deux
      // pelouses étaient auparavant forcées en tuyères pour montrer la bascule ;
      // sa règle du jour l'interdit — « un carré de douze par dix, c'est que des
      // arroseurs, pas de tuyères ». Un jardin d'exemple qui la viole enseigne
      // le contraire de ce qu'il vient de dire, et c'est le premier écran qu'on
      // ouvre. Les deux pelouses sont donc sur « au mieux ».
      { id: 2, nom: "Pelouse avant", type: "gazon", L: 12, l: 8, materiel: "auto" },
      // Et les tuyères se montrent là où elles ont leur place, dans SON exemple
      // à lui : « un long couloir qui fait dix mètres sur deux mètres de large ».
      { id: 6, nom: "Couloir lat\xE9ral", type: "gazon", L: 10, l: 2, materiel: "auto" },
      { id: 3, nom: "Massifs", type: "massif", L: 15, l: 2.4, materiel: "gaine" },
      { id: 4, nom: "Haie", type: "haie", ml: 60, lignesHaie: 1, materiel: "gaine" },
      { id: 5, nom: "Potager", type: "potager", L: 8, l: 3, materiel: "gaine" }
    ]
  };
  var etat = (function() {
    var sauve = charger();
    if (!sauve) return DEFAUTS;
    var e = {};
    Object.keys(DEFAUTS).forEach(function(k) {
      e[k] = DEFAUTS[k];
    });
    Object.keys(sauve).forEach(function(k) {
      if (sauve[k] !== void 0) e[k] = sauve[k];
    });
    delete e.pe32;
    return e;
  })();
  function debitDisponible() {
    var s = Number(etat.seau) || 0, t = Number(etat.temps) || 0;
    if (s <= 0 || t <= 0) return 0;
    return s / t * 3.6;
  }
  function perteDeCharge(debitM3h, longueurM, dInterieurMm) {
    if (!(debitM3h > 0) || !(longueurM > 0) || !(dInterieurMm > 0)) return 0;
    var q = debitM3h / 3600;
    var d = dInterieurMm / 1e3;
    var metres = 10.67 * longueurM * Math.pow(q / 150, 1.852) / Math.pow(d, 4.87);
    return metres / 10.2;
  }
  function longueurMaxEn(budgetBar, debitM3h, dInterieurMm) {
    if (!(budgetBar > 0) || !(debitM3h > 0) || !(dInterieurMm > 0)) return 0;
    var q = debitM3h / 3600;
    var d = dInterieurMm / 1e3;
    return budgetBar * 10.2 * Math.pow(d, 4.87) / (10.67 * Math.pow(q / 150, 1.852));
  }
  function perteElectrovanne(debitM3h) {
    var t = CATALOGUE.electrovanneDV.perte;
    if (!(debitM3h > t[0][0])) return t[0][1];
    for (var i = 1; i < t.length; i++) {
      if (debitM3h <= t[i][0]) {
        return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (debitM3h - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      }
    }
    return t[t.length - 1][1];
  }
  var MAJORATION_RACCORDS = 0.15;
  var METRES_ANTENNE = 2;
  var DIAMETRE_INT_PEBD16 = 12.4;
  function perteDuReseau(secteur) {
    var pts = secteur && secteur.points;
    var t25 = CATALOGUE.tuyaux.pe25;
    if (!pts || pts.length < 1) return null;
    var lineaire = 0;
    var restant = pts.reduce(function(s, p) {
      return s + (p.debit || 0);
    }, 0);
    var debitDuReseau = restant;
    var versLaZone = Number(etat.regardVersZone) || 0;
    var amont = perteDeCharge(debitDuReseau, versLaZone, t25.dInterieur);
    for (var i = 1; i < pts.length; i++) {
      restant -= pts[i - 1].debit || 0;
      var l = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      lineaire += perteDeCharge(restant, l, t25.dInterieur);
    }
    var unitaire = secteur.debitUnitaire || 0;
    var antenne = perteDeCharge(unitaire, METRES_ANTENNE, DIAMETRE_INT_PEBD16);
    return {
      lineaire,
      amont,
      raccords: (lineaire + amont) * MAJORATION_RACCORDS,
      electrovanne: perteElectrovanne(debitDuReseau),
      antenne,
      total: (lineaire + amont) * (1 + MAJORATION_RACCORDS) + perteElectrovanne(debitDuReseau) + antenne
    };
  }
  function pirePerteDeReseau(d) {
    var pire = 0;
    (d.secteurs || []).forEach(function(s) {
      var p = perteDuReseau(s);
      if (p && p.total > pire) pire = p.total;
    });
    return pire;
  }
  function amenee(d) {
    var longueur = Number(etat.amenee) || 0;
    var pire = d.secteurs.reduce(function(s, x) {
      return Math.max(s, x.debit || 0);
    }, 0);
    var exigee = 0;
    etat.zones.forEach(function(z) {
      var p = poser(z);
      if (p.m && p.m.pression) exigee = Math.max(exigee, p.m.pression);
    });
    var t25 = CATALOGUE.tuyaux.pe25, t32 = CATALOGUE.tuyaux.pe32;
    var perte25 = perteDeCharge(pire, longueur, t25.dInterieur);
    var perte32 = perteDeCharge(pire, longueur, t32.dInterieur);
    var source = Number(etat.pression) || 0;
    var budget = source - exigee;
    var tropLoin = longueur > 0 && pire > 0 && exigee > 0 && source - perte25 < exigee;
    var suffit = !tropLoin;
    var motif = tropLoin ? "longueur" : null;
    return {
      longueur,
      debit: pire,
      exigee,
      source,
      perte25,
      perte32,
      suffit,
      motif,
      auRegard: source - (suffit ? perte25 : perte32),
      diametre: suffit ? 25 : 32,
      longueurMax25: longueurMaxEn(budget, pire, t25.dInterieur),
      longueurMax32: longueurMaxEn(budget, pire, t32.dInterieur),
      // Au-delà, même le Ø32 perd trop : c'est le Ø40 ou un secteur de
      // plus, et cela se DIT plutôt que de sortir un plan qui ne tiendra pas.
      insuffisantMemeEn32: longueur > 0 && pire > 0 && exigee > 0 && source - perte32 < exigee,
      budget,
      provisoire: (suffit ? t25 : t32).source === "provisoire"
    };
  }
  var TUYERE_JUSQUA = 4;
  function materielDe(z) {
    if (TYPES[z.type].forme !== "surface") return "gaine";
    if (z.materiel === "turbine" || z.materiel === "tuyere") return z.materiel;
    var petit = Math.min(Number(z.L) || 0, Number(z.l) || 0);
    return petit > TUYERE_JUSQUA ? "turbine" : "tuyere";
  }
  function pointsDeLaPose(nx, ny, ecartX, ecartY, quinconce) {
    var pts = [];
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        if (quinconce && (i + j) % 2 !== 0) continue;
        var bordRangee = j === 0 || j === ny - 1;
        var coin = bordRangee && (i === 0 || i === nx - 1);
        var bord = bordRangee || i === 0 || i === nx - 1;
        pts.push({ x: i * ecartX, y: j * ecartY, zone: coin ? "coin" : bord ? "bord" : "interieur" });
      }
    }
    return pts;
  }
  function distanceEntreTetesDuDamier(ex, ey) {
    return Math.min(2 * ex, 2 * ey, Math.sqrt(ex * ex + ey * ey));
  }
  function couvreTout(points, portee, L, l) {
    if (!points || !points.length || !(portee > 0) || !(L > 0) || !(l > 0)) return false;
    var pas = portee / 10, p2 = portee * portee;
    for (var x = 0; x <= L + 1e-9; x = Math.min(x + pas, L + 1e-9)) {
      for (var y = 0; y <= l + 1e-9; y = Math.min(y + pas, l + 1e-9)) {
        var atteint = false;
        for (var k = 0; k < points.length; k++) {
          var dx = x - points[k].x, dy = y - points[k].y;
          if (dx * dx + dy * dy <= p2 + 1e-9) {
            atteint = true;
            break;
          }
        }
        if (!atteint) return false;
        if (y >= l) break;
      }
      if (x >= L) break;
    }
    return true;
  }
  function gammeDe(m) {
    if (!m || !m.buse || m.type !== "turbine") return 0;
    var base = m.buse.ref.split("-B")[0];
    if (!(base in GAMMES)) {
      GAMMES[base] = CATALOGUE.buses.reduce(function(max, b) {
        return b.ref.split("-B")[0] === base ? Math.max(max, Number(b.rayon) || 0) : max;
      }, 0);
    }
    return GAMMES[base];
  }
  var GAMMES = {};
  function poser(z, refImposee, tolerant) {
    if (!refImposee && z.buse) refImposee = z.buse;
    var petitCote = Math.min(Number(z.L) || 0, Number(z.l) || 0);
    var dims = { L: Number(z.L) || 0, l: Number(z.l) || 0 };
    var cle = materielDe(z), choix;
    if (cle === "gaine") {
      choix = { m: CATALOGUE.gaines[0] || null };
    } else {
      choix = modelePour(cle, petitCote || null, dims, refImposee);
      var repliPermis = Math.min(dims.L, dims.l) <= TUYERE_JUSQUA;
      if (z.materiel === "auto" && choix.m && dims.L > 0 && !poseSelonSaRegle(dims.L, dims.l, choix.m.portee, bridageDe(choix.m.buse), false, faitLeTour(choix.m.buse))) {
        var vers = cle === "turbine" ? "tuyere" : "turbine";
        if (vers === "turbine" || repliPermis) {
          var autre = modelePour(vers, petitCote || null, dims);
          if (autre.m && poseSelonSaRegle(dims.L, dims.l, autre.m.portee, bridageDe(autre.m.buse), false, faitLeTour(autre.m.buse))) {
            choix = autre;
            cle = vers;
          }
        }
      }
    }
    var m = choix.m;
    if (!m) return { cle, m: null, nombre: 0, debit: 0, nx: 0, ny: 0 };
    var r = { cle, m };
    if (TYPES[z.type].forme === "surface") {
      var L = Number(z.L) || 0, l = Number(z.l) || 0;
      if (L <= 0 || l <= 0) return Object.assign(r, { nombre: 0, debit: 0, nx: 0, ny: 0 });
      var pose = poseSelonSaRegle(L, l, m.portee, bridageDe(m.buse), Boolean(tolerant), faitLeTour(m.buse));
      var ecartMax = m.portee / RECOUVREMENT_MIN;
      var nx = pose ? pose.nx : Math.max(2, Math.ceil(L / ecartMax) + 1);
      var ny = pose ? pose.ny : Math.max(2, Math.ceil(l / ecartMax) + 1);
      if (!faitLeTour(m.buse) && nx > 2 && ny > 2) {
        return Object.assign(r, { nombre: 0, debit: 0, nx: 0, ny: 0, tourIncomplet: true });
      }
      var ecartX = L / (nx - 1), ecartY = l / (ny - 1);
      var portee = pose ? pose.reglee : m.portee;
      r.porteeReglee = portee;
      r.tolerant = Boolean(tolerant);
      r.ecart = Math.max(ecartX, ecartY);
      r.ecartX = ecartX;
      r.ecartY = ecartY;
      r.ecartEntreTetes = Math.min(ecartX, ecartY);
      r.tropSerre = !pose;
      var quinconceVoulu = cle === "tuyere" && nx * ny > QUINCONCE_AU_DELA_DE;
      var alignes = pointsDeLaPose(nx, ny, ecartX, ecartY, false);
      var points = alignes;
      if (quinconceVoulu) {
        var ax = nx, ay = ny, essai = null;
        for (var t = 0; t < 40; t++) {
          var ex2 = L / (ax - 1), ey2 = l / (ay - 1);
          var damier = pointsDeLaPose(ax, ay, ex2, ey2, true);
          if (damier.length >= alignes.length) break;
          if (distanceEntreTetesDuDamier(ex2, ey2) < portee - 0.01) break;
          if (couvreTout(damier, portee, L, l)) {
            essai = { pts: damier, nx: ax, ny: ay, ecartX: ex2, ecartY: ey2 };
            break;
          }
          if (ex2 >= ey2) ax++;
          else ay++;
        }
        if (essai) {
          points = essai.pts;
          nx = essai.nx;
          ny = essai.ny;
          ecartX = essai.ecartX;
          ecartY = essai.ecartY;
          r.ecart = Math.max(ecartX, ecartY);
          r.ecartX = ecartX;
          r.ecartY = ecartY;
          r.ecartEntreTetes = distanceEntreTetesDuDamier(ecartX, ecartY);
          r.tropSerre = r.ecartEntreTetes < portee - 0.01;
        } else {
          quinconceVoulu = false;
        }
      }
      var coins = points.filter(function(pt) {
        return pt.zone === "coin";
      }).length;
      var bords = points.filter(function(pt) {
        return pt.zone === "bord";
      }).length;
      var inter = points.filter(function(pt) {
        return pt.zone === "interieur";
      }).length;
      var q = m.debitParAngle ? m.debitParAngle[90] : m.debit360 / 4;
      var d = m.debitParAngle ? m.debitParAngle[180] : m.debit360 / 2;
      r.nx = nx;
      r.ny = ny;
      r.points = points;
      r.nombre = points.length;
      r.quinconce = quinconceVoulu;
      r.debit = coins * q + bords * d + (inter ? inter * m.debit360 : 0);
      points.forEach(function(pt) {
        pt.debit = pt.zone === "coin" ? q : pt.zone === "bord" ? d : m.debit360;
      });
      r.sansCorps = choix.sansCorps;
      if (!refImposee && choix.candidates && choix.candidates.length > 0) {
        var plafond = limiteParVoie();
        var vannesDe = function(pose2) {
          return couperEnVannes(pose2.points, plafond).length;
        };
        var noter = function(pose2) {
          return {
            r: pose2,
            vannes: vannesDe(pose2),
            gamme: gammeDe(pose2.m),
            nombre: pose2.nombre,
            bridage: pose2.m.portee > 0 ? 1 - pose2.porteeReglee / pose2.m.portee : 0
          };
        };
        var avant = function(a, b) {
          if (a.vannes !== b.vannes) return a.vannes < b.vannes;
          if (a.gamme !== b.gamme) return a.gamme < b.gamme;
          if (a.nombre !== b.nombre) return a.nombre < b.nombre;
          return a.bridage < b.bridage - 1e-9;
        };
        var strict = null, tolere = null;
        var essayer = function(pose2) {
          if (!pose2.m || !(pose2.debit > 0) || pose2.tropSerre) return;
          var n = noter(pose2);
          if (pose2.tolerant) {
            if (!tolere || avant(n, tolere)) tolere = n;
          } else if (!strict || avant(n, strict)) strict = n;
        };
        essayer(r);
        choix.candidates.forEach(function(ref) {
          if (!(m && ref === m.ref)) essayer(poser(z, ref, false));
          essayer(poser(z, ref, true));
        });
        var meilleur = strict;
        if (tolere && (!strict || tolere.vannes < strict.vannes || tolere.vannes === strict.vannes && tolere.gamme < strict.gamme)) meilleur = tolere;
        if (meilleur && meilleur.r !== r) return meilleur.r;
      }
    } else if (TYPES[z.type].forme === "nappe") {
      var L2 = Number(z.L) || 0, l2 = Number(z.l) || 0;
      if (L2 <= 0 || l2 <= 0) return Object.assign(r, { nombre: 0, debit: 0 });
      var e = TYPES[z.type].ecartLignes;
      var lignes = Math.max(1, Math.floor(l2 / e + 1e-9) + 1);
      r.lignes = lignes;
      r.ecartLignes = e;
      r.nombre = Math.round(lignes * L2);
      r.debit = r.nombre * m.debitMetre;
    } else {
      var ml = Number(z.ml) || 0;
      var n2 = Number(z.lignesHaie) === 2 ? 2 : 1;
      r.lignes = n2;
      r.nombre = Math.round(ml * n2);
      r.debit = r.nombre * m.debitMetre;
    }
    return r;
  }
  var PLANCHER_UTILE = 0.5;
  var TOLERANCE_CHOIX = 0.01;
  var PAS_CHOIX = 0.01;
  var PAS_GROSSIER = 0.05;
  var SURPRESSION_ADMISE = 0.2;
  function limiteParVoie() {
    var deLaSource = debitDisponible() * MARGE;
    return LIMITE_IMPOSEE !== null ? Math.min(deLaSource, LIMITE_IMPOSEE) : deLaSource;
  }
  var LIMITE_IMPOSEE = null;
  var VANNES_EN_PLUS_MAX = 12;
  var BUSES_A_LA_PRESSION = {};
  function decouper() {
    BUSES_A_LA_PRESSION = {};
    LIMITE_IMPOSEE = null;
    var source = Number(etat.pression) || 0;
    pressionDeCalcul = null;
    var d = decouperUneFois();
    if (!(source > 0) || !(pirePerteDeReseau(d) > 0)) return finirLePlan(d, source, true);
    var trouve = chercherUnPlan(source);
    if (trouve) return trouve;
    var demande = d.demande;
    var deLaSource = limiteParVoie();
    var dejaLa = deLaSource > 0 ? Math.max(1, Math.ceil(demande / deLaSource - 1e-9)) : 1;
    for (var n = dejaLa + 1; demande > 0 && n <= dejaLa + VANNES_EN_PLUS_MAX; n++) {
      LIMITE_IMPOSEE = demande / n * (1 + 1e-6);
      trouve = chercherUnPlan(source);
      if (trouve) return trouve;
    }
    LIMITE_IMPOSEE = null;
    pressionDeCalcul = null;
    return finirLePlan(decouperUneFois(), source, false);
  }
  function chercherUnPlan(source) {
    var limite = limiteParVoie();
    var depart = Math.round((source - perteElectrovanne(0) + TOLERANCE_CHOIX) * 100) / 100;
    var evaluer = function(p2) {
      pressionDeCalcul = p2;
      var essai = decouperUneFois();
      var arrive = source - amenee(essai).perte25 - pirePerteDeReseau(essai);
      var signature = essai.secteurs.length + "|" + essai.poses.map(function(x) {
        return x.buse ? x.buse.ref : "";
      }).join(",");
      var tient = !essai.poses.some(function(x) {
        return x.buse && porteeALaPression(x.buse, arrive) < x.portee - 0.01;
      });
      if (tient && !essai.poses.every(function(x) {
        return seLeve(x.buse, arrive);
      })) tient = false;
      var horsMarge = arrive > p2 + SURPRESSION_ADMISE;
      var gonfle = arrive - p2 > TOLERANCE_CHOIX ? Math.sqrt(arrive / p2) : 1;
      if (tient && limite > 0 && essai.secteurs.some(function(s) {
        return s.debit * gonfle > limite + 1e-9;
      })) tient = false;
      if (!tient) return { p: p2, tient: false, signature };
      return {
        d: essai,
        p: p2,
        tient: true,
        horsMarge,
        signature,
        vannes: essai.secteurs.length,
        gamme: essai.poses.reduce(function(t, x) {
          return t + (x.gamme || 0);
        }, 0),
        tetes: essai.secteurs.reduce(function(t, s) {
          return t + (s.points ? s.points.length : 0);
        }, 0),
        ecart: Math.abs(p2 - arrive)
      };
    };
    var retenu = null, secours = null;
    var garder = function(e2) {
      if (!e2.tient) return;
      if (e2.horsMarge) {
        if (!secours || e2.ecart < secours.ecart) secours = e2;
        return;
      }
      var r = retenu;
      if (!r || e2.vannes < r.vannes || e2.vannes === r.vannes && (e2.gamme < r.gamme || e2.gamme === r.gamme && (e2.tetes < r.tetes || e2.tetes === r.tetes && e2.ecart < r.ecart))) retenu = e2;
    };
    var grossiers = [];
    for (var p = depart; p >= PLANCHER_UTILE - 1e-9; p = Math.round((p - PAS_GROSSIER) * 1e3) / 1e3) {
      var e = evaluer(p);
      garder(e);
      grossiers.push(e);
    }
    for (var k = 0; k + 1 < grossiers.length; k++) {
      var a = grossiers[k], b = grossiers[k + 1];
      if (a.tient === b.tient && a.signature === b.signature) continue;
      for (var q = Math.round((a.p - PAS_CHOIX) * 1e3) / 1e3; q > b.p + 1e-9; q = Math.round((q - PAS_CHOIX) * 1e3) / 1e3) {
        garder(evaluer(q));
      }
    }
    retenu = retenu || secours;
    if (retenu) {
      pressionDeCalcul = retenu.p;
      return finirLePlan(retenu.d, source, true);
    }
    return null;
  }
  function seLeve(buse, pression) {
    if (!buse) return true;
    var min = pressionMinDe(buse);
    return min !== null && pression >= min - 1e-9;
  }
  function finirLePlan(d, source, tient) {
    d.perteAmenee = amenee(d).perte25;
    d.perteReseau = pirePerteDeReseau(d);
    d.pressionAuxArroseurs = source > 0 ? source - d.perteAmenee - d.perteReseau : 0;
    d.pressionRaffinee = pressionDeCalcul !== null;
    d.pressionTropBasse = source > 0 && (!tient || d.pressionAuxArroseurs < PLANCHER_UTILE || !(d.poses || []).every(function(x) {
      return seLeve(x.buse, d.pressionAuxArroseurs);
    }));
    d.pressionDeChoix = pressionRetenue();
    return d;
  }
  function couperEnVannes(elements, limite) {
    var total = elements.reduce(function(s, x) {
      return s + x.debit;
    }, 0);
    var combien = limite > 0 ? Math.max(1, Math.ceil(total / limite)) : 1;
    var visee = total / combien;
    var paquets = [[]], debits = [0];
    elements.forEach(function(x) {
      var i = paquets.length - 1;
      var trop = debits[i] + x.debit;
      var ouvrirUnAutre = paquets[i].length > 0 && (paquets.length < combien && trop > visee + 1e-9 || // l'équilibre visé
      limite > 0 && trop > limite + 1e-9);
      if (ouvrirUnAutre) {
        paquets.push([]);
        debits.push(0);
        i++;
      }
      paquets[i].push(x);
      debits[i] += x.debit;
    });
    return paquets;
  }
  function decouperUneFois() {
    var dispo = debitDisponible();
    var limite = limiteParVoie();
    var groupes = {}, ordre = [], poses = [];
    etat.zones.forEach(function(z) {
      var p = poser(z);
      if (p.debit <= 0) return;
      var clef = p.cle + "|" + TYPES[z.type].famille;
      if (!groupes[clef]) {
        groupes[clef] = { zones: [], nomDeZone: {}, membres: [], debit: 0, m: p.m, cle: p.cle };
        ordre.push(clef);
      }
      groupes[clef].zones.push(z.nom || TYPES[z.type].nom);
      groupes[clef].nomDeZone[z.id] = z.nom || TYPES[z.type].nom;
      groupes[clef].membres.push({ zoneId: z.id, points: p.points });
      groupes[clef].debit += p.debit;
      groupes[clef].nombre = (groupes[clef].nombre || 0) + p.nombre;
      if (p.m && p.m.buse && p.ecartEntreTetes > 0) {
        poses.push({
          ecartEntreTetes: p.ecartEntreTetes,
          portee: p.porteeReglee || p.m.portee,
          gamme: gammeDe(p.m),
          buse: CATALOGUE.buses.filter(function(x) {
            return x.ref === p.m.ref;
          })[0]
        });
      }
      groupes[clef].forme = TYPES[z.type].forme;
    });
    var gouttes = function(c) {
      return groupes[c].m.famille === "Goutte-\xE0-goutte";
    };
    ordre = ordre.filter(function(c) {
      return !gouttes(c);
    }).concat(ordre.filter(gouttes));
    var secteurs = [], reseauDuPoint = {}, reseauxDeZone = {};
    var noterZone = function(zoneId, i) {
      if (!reseauxDeZone[zoneId]) reseauxDeZone[zoneId] = [];
      if (reseauxDeZone[zoneId].indexOf(i) < 0) reseauxDeZone[zoneId].push(i);
    };
    ordre.forEach(function(clef) {
      var g = groupes[clef];
      var premier = secteurs.length;
      var nommer = function(points) {
        if (!points || !points.length) return g.zones.join(" + ");
        var vues = [];
        points.forEach(function(x) {
          var nom = g.nomDeZone[x.zoneId];
          if (nom && vues.indexOf(nom) < 0) vues.push(nom);
        });
        return vues.length ? vues.join(" + ") : g.zones.join(" + ");
      };
      var ajouter = function(debit, combien, rang, points, membres) {
        secteurs.push({
          // **`membres` porte le zoneId, `points` ne le porte pas.** Les têtes
          // rendues par `poser()` ne savent pas de quelle zone elles viennent :
          // c'est le découpage qui l'a noté, et lui seul peut nommer.
          nom: nommer(membres),
          part: combien > 1 ? rang + " sur " + combien : null,
          famille: g.m.famille,
          debit,
          // **Les têtes du réseau, dans l'ordre où le tuyau les visite.** Sans
          // elles, la perte de charge de la ligne ne se calcule pas : il faut
          // savoir combien de mètres séparent chaque arroseur du suivant, et
          // quel débit passe encore dans ce tronçon-là.
          points: points || null,
          // Le débit unitaire d'une tête, pour la perte de son antenne Ø16.
          debitUnitaire: points && points.length ? debit / points.length : 0
        });
      };
      var suite = [];
      g.membres.forEach(function(mb) {
        if (!mb.points) return;
        mb.points.forEach(function(pt) {
          suite.push({ zoneId: mb.zoneId, pt, debit: pt.debit || 0 });
        });
      });
      if (!suite.length) {
        var n = limite > 0 ? Math.max(1, Math.ceil(g.debit / limite)) : 1;
        for (var i = 0; i < n; i++) {
          ajouter(g.debit / n, n, i + 1, null);
          g.membres.forEach(function(mb) {
            noterZone(mb.zoneId, premier + i);
          });
        }
        return;
      }
      var paquets = couperEnVannes(suite, limite);
      var debits = paquets.map(function(pq) {
        return pq.reduce(function(t, x) {
          return t + x.debit;
        }, 0);
      });
      paquets.forEach(function(pq, i2) {
        ajouter(debits[i2], paquets.length, i2 + 1, pq.map(function(x) {
          return x.pt;
        }), pq);
        pq.forEach(function(x) {
          reseauDuPoint[x.zoneId + ":" + x.pt.x.toFixed(3) + ":" + x.pt.y.toFixed(3)] = premier + i2;
          noterZone(x.zoneId, premier + i2);
        });
      });
    });
    return {
      secteurs,
      dispo,
      limite,
      reseauDuPoint,
      poses,
      reseauxDeZone,
      demande: etat.zones.reduce(function(s, z) {
        return s + poser(z).debit;
      }, 0)
    };
  }
  function voiesProgrammateur(n) {
    var tailles = [4, 6, 8, 12, 16, 24];
    for (var i = 0; i < tailles.length; i++) if (tailles[i] >= n) return tailles[i];
    return n;
  }
  var COULEURS_RESEAU = ["#2F6FB5", "#3E8F4E", "#D9A520", "#B5502F", "#7A4FA3", "#1F8A8A", "#B5417F", "#6B7A2F"];
  function couleurReseau(i) {
    return COULEURS_RESEAU[i % COULEURS_RESEAU.length];
  }
  var METRES_PAR_SORTIE = 100;
  var RACCORD_LIGNE_SEULE = "MID6341";
  var SORTIES_GOUTTE = ["boucle", "deux-bouts", "ligne"];
  function sortiesGoutte(d) {
    var zones = [], sorties = 0, lignes = [];
    etat.zones.forEach(function(z) {
      var p = poser(z);
      if (!p.m || p.m.type !== "gaine" || !p.nombre) return;
      var vannes2 = ((d.reseauxDeZone || {})[z.id] || []).length || 1;
      var n = Math.max(Math.ceil(p.nombre / METRES_PAR_SORTIE - 1e-9), vannes2);
      var reponse = SORTIES_GOUTTE.indexOf(z.sortieGoutte) >= 0 ? z.sortieGoutte : null;
      zones.push({ nom: z.nom || TYPES[z.type].nom, sorties: n, reponse });
      sorties += n;
      for (var i = 0; i < n; i++) lignes.push(p.nombre / n);
    });
    var vannes = combienGoutteAGoutte(d);
    var c = couronnesDuTube(lignes);
    return {
      zones,
      sorties,
      tesEgaux: Math.max(0, sorties - vannes),
      couronnes: c.couronnes,
      jonctions: c.jonctions
    };
  }
  var COURONNES_VENDUES = [50, 100];
  function metresParCouronne() {
    return COURONNES_VENDUES.indexOf(Number(etat.couronne)) >= 0 ? Number(etat.couronne) : 50;
  }
  function couronnesDuTube(lignes) {
    var pleines = 0, jonctions = 0, bouts = [];
    var METRES_PAR_COURONNE = metresParCouronne();
    lignes.forEach(function(l) {
      var entieres = Math.floor(l / METRES_PAR_COURONNE + 1e-9);
      var reste = l - entieres * METRES_PAR_COURONNE;
      if (reste < 1e-6) reste = 0;
      pleines += entieres;
      jonctions += Math.max(0, entieres + (reste ? 1 : 0) - 1);
      if (reste) bouts.push(reste);
    });
    var entamees = [];
    bouts.sort(function(a, b) {
      return b - a;
    }).forEach(function(b) {
      for (var i = 0; i < entamees.length; i++) {
        if (entamees[i] + b <= METRES_PAR_COURONNE + 1e-9) {
          entamees[i] += b;
          return;
        }
      }
      entamees.push(b);
    });
    return { couronnes: pleines + entamees.length, jonctions };
  }
  function manquants(d) {
    var phrases = [];
    var marque = nomDeMarque(marqueCourante());
    etat.zones.forEach(function(z) {
      var p = poser(z);
      if (p.m) return;
      var quoi = p.cle === "gaine" ? "aucun tube de goutte-\xE0-goutte" : p.cle === "turbine" ? "aucune turbine " + marque : "aucune tuy\xE8re " + marque;
      phrases.push((z.nom || "Une zone") + " : " + quoi + " au catalogue, elle n\u2019est pas arros\xE9e.");
    });
    etat.zones.forEach(function(z) {
      if (poser(z).tourIncomplet) {
        phrases.push((z.nom || "Une zone") + " : sa buse ne fait pas le tour entier, elle ne se pose qu\u2019aux coins et aux bords.");
      }
    });
    var sg = sortiesGoutte(d);
    sg.zones.forEach(function(zg) {
      if (!zg.reponse) {
        phrases.push(zg.nom + " : une seule ligne de goutte-\xE0-goutte ou une boucle ? Ses raccords ne sont pas compt\xE9s.");
      }
    });
    if (sg.zones.length) {
      phrases.push("Goutte-\xE0-goutte : la pression au bout des lignes n\u2019est pas v\xE9rifi\xE9e, la fiche du tube Toro manque.");
    }
    if (d.secteurs.length && !CATALOGUE.nourrices[d.secteurs.length]) {
      phrases.push("Nourrice de " + d.secteurs.length + " voies : aucune fiche, ses pi\xE8ces ne sont pas compt\xE9es.");
    }
    return phrases;
  }
  function listeMateriel(d) {
    var lignes = [], compte = {}, modeles = {};
    var totalPointsReseau = 0, totalRangeesReseau = 0, totalJonctionsReseau = 0;
    etat.zones.forEach(function(z) {
      var p = poser(z);
      if (!p.nombre || !p.m) return;
      compte[p.m.ref] = (compte[p.m.ref] || 0) + p.nombre;
      modeles[p.m.ref] = p.m;
      if (p.ny) {
        totalPointsReseau += p.nombre;
        totalRangeesReseau += p.ny;
        totalJonctionsReseau += Math.max(0, p.ny - 1);
      }
    });
    var totalArroseurs = 0, totalGaine = 0;
    Object.keys(compte).forEach(function(ref) {
      var m = modeles[ref];
      if (m.type === "gaine") {
        totalGaine += compte[ref];
        return;
      }
      totalArroseurs += compte[ref];
      lignes.push({
        ref: m.ref,
        nom: (m.marqueCle === "generique" ? "" : m.marque + " ") + m.nom + "s " + m.detail + (m.colisage ? ", par " + m.colisage : ""),
        q: compte[ref],
        u: "u"
      });
    });
    if (totalGaine) {
      var g = CATALOGUE.gaines[0];
      var parCouronne = metresParCouronne();
      lignes.push({
        ref: g.ref,
        nom: g.nom + ", couronne de " + parCouronne + " m",
        q: sortiesGoutte(d).couronnes,
        u: "u",
        sansReference: parCouronne !== g.colisage
      });
    }
    var parCorps = {}, corpsDe = {};
    Object.keys(compte).forEach(function(ref) {
      var m = modeles[ref];
      if (m.type === "gaine") return;
      var c = m.type === "turbine" ? CATALOGUE.corpsDeLaBuse(m.buse) : corpsCourant();
      if (!c) return;
      parCorps[c.ref] = (parCorps[c.ref] || 0) + compte[ref];
      corpsDe[c.ref] = c;
    });
    Object.keys(parCorps).forEach(function(cref) {
      var c = corpsDe[cref];
      lignes.push({ ref: c.ref, nom: c.nom + ", " + c.detail, q: parCorps[cref], u: "u" });
    });
    var parFiletage = {};
    Object.keys(parCorps).forEach(function(cref) {
      var f = corpsDe[cref].filetage;
      if (f) parFiletage[f] = (parFiletage[f] || 0) + parCorps[cref];
    });
    var parSbe = {}, ordreSbe = [];
    var noterSbe = function(coude, q) {
      if (!coude) return;
      if (!parSbe[coude.ref]) {
        parSbe[coude.ref] = { c: coude, q: 0 };
        ordreSbe.push(coude.ref);
      }
      parSbe[coude.ref].q += q;
    };
    Object.keys(parFiletage).forEach(function(f) {
      noterSbe(CATALOGUE.coudes.filter(function(c) {
        return c.filetage === f;
      })[0], parFiletage[f]);
    });
    if (totalArroseurs) {
      var sbeBas = CATALOGUE.coudes.filter(function(c) {
        return c.filetage === "3/4";
      })[0];
      noterSbe(sbeBas, totalArroseurs);
      var pebd = CATALOGUE.piecesReseau["pebd16"];
      lignes.push({ ref: "pebd16", nom: pebd.nom, q: totalArroseurs * 2, u: "ml" });
    }
    ordreSbe.forEach(function(ref) {
      var e = parSbe[ref];
      lignes.push({ ref, nom: e.c.nom + ", " + e.c.detail, q: e.q, u: "u" });
    });
    var sg = sortiesGoutte(d);
    var coudesDeLigne = totalRangeesReseau + sg.sorties;
    var jonctions = totalJonctionsReseau + sg.tesEgaux;
    if (totalPointsReseau || sg.sorties) {
      var teLigne = CATALOGUE.piecesReseau["te-taraude-25-34-25"];
      var coudeLigne = CATALOGUE.piecesReseau["coude-taraude-25-34"];
      var totalTesLigne = totalPointsReseau - totalRangeesReseau;
      if (totalTesLigne > 0) lignes.push({ ref: "te-taraude-25-34-25", nom: teLigne.nom, q: totalTesLigne, u: "u" });
      lignes.push({ ref: "coude-taraude-25-34", nom: coudeLigne.nom, q: coudesDeLigne, u: "u" });
      if (jonctions > 0) {
        var jonction = CATALOGUE.piecesReseau["te-25-25-25"];
        lignes.push({ ref: "te-25-25-25", nom: jonction.nom, q: jonctions, u: "u" });
      }
    }
    var palaplast = {};
    var noterPalaplast = function(ref, q) {
      if (ref && q > 0) palaplast[ref] = (palaplast[ref] || 0) + q;
    };
    sg.zones.forEach(function(zg) {
      if (zg.reponse === "boucle") noterPalaplast("MID6321", zg.sorties);
      if (zg.reponse === "deux-bouts") {
        noterPalaplast("MID6321", zg.sorties);
        noterPalaplast("MID6371", 2 * zg.sorties);
      }
      if (zg.reponse === "ligne") {
        noterPalaplast(RACCORD_LIGNE_SEULE, zg.sorties);
        noterPalaplast("MID6371", zg.sorties);
      }
    });
    noterPalaplast("MID6301", sg.jonctions);
    ["MID6321", "MID6341", "MID6352", "MID6301", "MID6371"].forEach(function(ref) {
      if (!palaplast[ref]) return;
      var x = CATALOGUE.pieceAjoutable(ref);
      lignes.push({ ref, nom: x.nom, q: palaplast[ref], u: "u" });
    });
    if (d.secteurs.length) {
      var fiche = CATALOGUE.ficheNourrice(d.secteurs.length, combienGoutteAGoutte(d));
      if (fiche) {
        fiche.pieces.forEach(function(x) {
          var p = CATALOGUE.piece(x.ref);
          if (!p) return;
          lignes.push({ ref: x.ref, nom: (p.marque ? p.marque + " " : "") + p.nom, q: x.q, u: "u" });
        });
      }
      if (etat.sonde) {
        var sonde = CATALOGUE.materiel.filter(function(x) {
          return x.regle === "option";
        })[0];
        if (sonde) lignes.push({ ref: sonde.ref, nom: sonde.nom, q: 1, u: "u" });
      }
    }
    return lignes;
  }
  function combienGoutteAGoutte(d) {
    return d.secteurs.filter(function(s) {
      return s.famille === "Goutte-\xE0-goutte";
    }).length;
  }
  function calculerPlan(entree) {
    const avant = etat;
    try {
      etat = {};
      Object.keys(DEFAUTS).forEach(function(k) {
        etat[k] = DEFAUTS[k];
      });
      Object.keys(entree).forEach(function(k) {
        if (entree[k] !== void 0) etat[k] = entree[k];
      });
      etat.zones = (entree.zones || []).map(function(z, i) {
        return Object.assign({}, z, { id: z.id !== void 0 ? z.id : i + 1 });
      });
      const d = decouper();
      return {
        debitDisponible: debitDisponible(),
        secteurs: d.secteurs,
        demande: d.demande,
        limite: d.limite,
        // **Ce que le trajet mange, du compteur au dernier arroseur.** C'est le
        // chiffre qui manquait : sans lui, un plan pouvait espacer ses arroseurs
        // sur une portée que la pression réelle ne leur donne pas.
        perteAmenee: d.perteAmenee,
        perteReseau: d.perteReseau,
        pressionAuxArroseurs: d.pressionAuxArroseurs,
        pressionRaffinee: d.pressionRaffinee,
        pressionTropBasse: d.pressionTropBasse,
        // **La pression à laquelle les buses ont été CHOISIES.** Elle ne doit
        // jamais dépasser `pressionAuxArroseurs` : sinon les portées retenues
        // sont celles d'une pression qui n'arrive pas (§467).
        pressionDeChoix: d.pressionDeChoix,
        reseauxDeZone: d.reseauxDeZone,
        voies: voiesProgrammateur(d.secteurs.length),
        couleurs: d.secteurs.map(function(_, i) {
          return couleurReseau(i);
        }),
        // **UNE RÉFÉRENCE, OU RIEN** (sa consigne du 22 août : « tu ne dois
        // surtout pas inventer de prix ni de référence »). La clé interne reste
        // dans `ref` — les contrôles s'en servent pour identifier une ligne —
        // mais `reference` ne porte que ce qui a été RELEVÉ sur ses documents.
        // C'est `reference` que l'écran montre, et rien d'autre.
        materiel: listeMateriel(d).map(function(l) {
          return Object.assign({}, l, { reference: l.sansReference ? null : CATALOGUE.referenceDe(l.ref) });
        }),
        manquants: manquants(d),
        // **Les sorties du goutte-à-goutte, comptées une fois.** La liste de
        // l'application lit ses raccords Ø25 sur le plan dessiné, et le massif n'y
        // a pas de tête : sans ce compte, elle perdait le coude taraudé de chaque
        // sortie et le té égal des suivantes (18 octobre 2026).
        goutteAGoutte: (function() {
          var sg = sortiesGoutte(d);
          return { sorties: sg.sorties, tesEgaux: sg.tesEgaux };
        })(),
        amenee: amenee(d),
        // **L'ESTIMATION DE PORTÉE SE DIT** (`CLAUDE.md` §4). Le débit corrigé
        // est de la physique ; la portée, elle, suit un exposant qui n'est pas
        // relevé de ses catalogues. Quand il a servi — c'est-à-dire quand la
        // pression du chantier est SOUS celle du catalogue —, l'écran le
        // signale plutôt que de rendre une portée comme un fait.
        porteeEstimee: etat.zones.some(function(z) {
          const m = poser(z).m;
          return Boolean(m && m.porteeCatalogue && m.portee < m.porteeCatalogue - 1e-3);
        }),
        pression: Number(etat.pression) || 0,
        // **OÙ SONT LES ARROSEURS, ET SUR QUELLE VANNE** — ajouté le 23 août 2026
        // pour que le plan puisse enfin se DESSINER dans l'application.
        //
        // Tout était déjà calculé : `poser()` engendre les points depuis le
        // 17 août, `decouper()` sait depuis le 19 lequel va sur quelle vanne.
        // Rien ne SORTAIT, et le plan restait un dessin fait à la main dans les
        // maquettes, aux cotes de son jardin du 21 août. Ajouter un second calcul
        // des positions aurait fabriqué la divergence que `CLAUDE.md` §3
        // interdit : c'est donc une simple mise au jour.
        dessin: dessinDesZones(d)
      };
    } finally {
      etat = avant;
      pressionDeCalcul = null;
    }
  }
  function dessinDesZones(d) {
    return etat.zones.map(function(z) {
      var p = poser(z);
      var ox = Number(z.x) || 0, oy = Number(z.y) || 0;
      return {
        id: z.id,
        nom: z.nom || TYPES[z.type].nom,
        type: z.type,
        x: ox,
        y: oy,
        L: Number(z.L) || 0,
        l: Number(z.l) || 0,
        /** 'turbine', 'tuyere' ou 'gaine' — c'est elle qui décide de la forme dessinée. */
        cle: p.cle,
        modele: p.m ? p.m.nom : null,
        buse: p.m ? p.m.detail || null : null,
        // La portée RÉGLÉE : celle de la buse, ou moins si elle est bridée à la
        // vis. C'est le chiffre que le poseur règle sur le terrain.
        portee: p.m ? Number(p.porteeReglee || p.m.portee) || 0 : 0,
        bridee: Boolean(p.m && p.porteeReglee && p.porteeReglee < p.m.portee - 0.01),
        points: (p.points || []).map(function(pt) {
          return {
            x: ox + pt.x,
            y: oy + pt.y,
            // La clé est celle que `decouper()` a posée : elle se lit sur les
            // coordonnées RELATIVES, celles d'avant le décalage.
            reseau: d.reseauDuPoint[z.id + ":" + pt.x.toFixed(3) + ":" + pt.y.toFixed(3)]
          };
        })
      };
    });
  }

  // src/lib/arrosage/pieces.ts
  var CAT = CATALOGUE;
  var TE_LIGNE = "te-taraude-25-34-25";
  var COUDE_LIGNE = "coude-taraude-25-34";
  var TE_EGAL = "te-25-25-25";
  var PEBD16 = "pebd16";
  var GRILLAGE = "grillage-bleu";
  function auRegard(l) {
    if (!l.ref) return false;
    return Boolean(CAT.piece(l.ref)) || l.ref === "RP403";
  }
  function nomDe(ref) {
    const p = CAT.piecesReseau[ref];
    return p ? p.marque ? `${p.marque} ${p.nom}` : p.nom : ref;
  }
  function piecesDuPlan(materiel, dessin, options) {
    const parReseau = (f) => dessin ? `par r\xE9seau : ${dessin.reseaux.map((r) => f(r)).join(", ")}` : void 0;
    const seuil = options.seuil25 > 0 ? `\xD825 jusqu\u2019\xE0 ${Math.floor(options.seuil25)} m, \xD832 au-del\xE0` : "\xD832 d\u2019office : le d\xE9bit passe trop vite en \xD825";
    const amenee2 = [
      {
        ref: "pe25-amenee",
        nom: options.amenee !== null && options.seuil25 > 0 && options.amenee > options.seuil25 ? "PEHD \xD832" : "PEHD \xD825",
        q: options.amenee !== null ? Math.ceil(options.amenee) : null,
        u: "ml",
        ou: "amenee",
        detail: options.amenee !== null ? `du piquage \xE0 la nourrice, calcul\xE9 sur le croquis, ${seuil}` : seuil
      }
    ];
    if (options.compteur) {
      amenee2.push({
        ref: TE_EGAL,
        reference: CAT.referenceDe(TE_EGAL),
        nom: nomDe(TE_EGAL),
        q: 1,
        u: "u",
        ou: "amenee",
        detail: "coupe la ligne au compteur"
      });
    }
    const regard = materiel.filter(auRegard).map((l) => ({
      ...l,
      ou: "regard",
      detail: l.ref === "connexion" ? "2 par \xE9lectrovanne" : void 0
    }));
    const jardin = [];
    const sbe = new Set(CAT.coudes.map((c) => c.ref));
    const surLeTrace = /* @__PURE__ */ new Set([TE_LIGNE, COUDE_LIGNE, TE_EGAL]);
    for (const l of materiel) {
      if (auRegard(l)) continue;
      if (dessin && surLeTrace.has(l.ref ?? "")) continue;
      if (sbe.has(l.ref ?? "") && dessin) continue;
      jardin.push({
        ...l,
        ou: "jardin",
        detail: l.ref === PEBD16 ? "2 m par arroseur" : !dessin && surLeTrace.has(l.ref ?? "") ? "compt\xE9 sans le trac\xE9, \xE0 v\xE9rifier sur le plan" : void 0
      });
    }
    if (dessin) {
      const tetes = dessin.reseaux.flatMap((r) => r.tetes);
      const hautParFiletage = /* @__PURE__ */ new Map();
      for (const l of materiel) {
        const c = CAT.corps.find((x) => x.ref === l.ref);
        if (!c) continue;
        const h = hautParFiletage.get(c.filetage) ?? { q: 0, noms: [] };
        h.q += l.q;
        h.noms.push(`${l.q} ${c.nom}`);
        hautParFiletage.set(c.filetage, h);
      }
      const coudeDe = (filetage) => {
        const c = CAT.coudes.find((x) => x.filetage === filetage);
        if (!c) return void 0;
        const ligne = materiel.find((l) => l.ref === c.ref);
        return { ...c, reference: ligne?.reference ?? null };
      };
      const bas = coudeDe("3/4");
      if (bas && tetes.length > 0) {
        jardin.push({ ref: bas.ref, reference: bas.reference, nom: `${bas.nom}, ${bas.detail}`, q: tetes.length, u: "u", ou: "jardin", detail: "en bas de chaque arroseur, sur la ligne" });
      }
      for (const [filetage, h] of hautParFiletage) {
        const haut = coudeDe(filetage);
        if (haut && h.q > 0) jardin.push({ ref: haut.ref, reference: haut.reference, nom: `${haut.nom}, ${haut.detail}`, q: h.q, u: "u", ou: "jardin", detail: `en haut de ${h.noms.join(", ")}` });
      }
      const somme = (f) => dessin.reseaux.reduce((t, r) => t + f(r), 0);
      const tes = somme((r) => r.tes);
      const { sorties, tesEgaux: egauxGoutte } = options.goutte;
      const etGoutte = (n) => n > 0 ? `, et ${n} pour le goutte-\xE0-goutte` : "";
      const coudes = somme((r) => r.coudes) + sorties;
      const egaux = somme((r) => r.tesEgaux) + egauxGoutte;
      if (tes > 0) jardin.push({ ref: TE_LIGNE, reference: CAT.referenceDe(TE_LIGNE), nom: nomDe(TE_LIGNE), q: tes, u: "u", ou: "jardin", detail: parReseau((r) => r.tes) });
      if (coudes > 0) jardin.push({ ref: COUDE_LIGNE, reference: CAT.referenceDe(COUDE_LIGNE), nom: nomDe(COUDE_LIGNE), q: coudes, u: "u", ou: "jardin", detail: `${parReseau((r) => r.coudes)}${etGoutte(sorties)}` });
      if (egaux > 0) jardin.push({ ref: TE_EGAL, reference: CAT.referenceDe(TE_EGAL), nom: nomDe(TE_EGAL), q: egaux, u: "u", ou: "jardin", detail: `${parReseau((r) => r.tesEgaux)}${etGoutte(egauxGoutte)}` });
      const ml = somme((r) => r.metresTuyau);
      if (ml > 0) jardin.push({ ref: "pe25", nom: "PEHD \xD825", q: Math.ceil(ml), u: "ml", ou: "jardin", detail: parReseau((r) => r.metresTuyau) });
      if (options.grillage) {
        const g = CAT.piecesReseau[GRILLAGE];
        const parRouleau = g.metresParRouleau ?? 100;
        const metres = dessin.metresTranchee + (options.amenee ?? 0);
        const rouleaux = Math.max(1, Math.ceil(metres / parRouleau));
        const total = options.amenee !== null ? `${Math.ceil(dessin.metresTranchee)} m de tranch\xE9e et ${Math.ceil(options.amenee)} m d\u2019amen\xE9e au total.` : `${Math.ceil(dessin.metresTranchee)} m de tranch\xE9e au total.`;
        const pointilles = dessin.liaisons.length > 0, amenee3 = options.amenee === null;
        const inconnu = pointilles && amenee3 ? " Les pointill\xE9s et le tuyau d\u2019amen\xE9e ne sont pas mesur\xE9s." : pointilles ? " Les pointill\xE9s ne sont pas mesur\xE9s." : amenee3 ? " Le tuyau d\u2019amen\xE9e n\u2019est pas mesur\xE9." : "";
        const detail = total + inconnu;
        jardin.push({ ref: GRILLAGE, nom: g.nom, q: rouleaux, u: "u", ou: "jardin", detail });
      }
    } else {
      jardin.push({ ref: "pe25", nom: "PEHD \xD825", q: null, u: "ml", ou: "jardin", detail: "le plan n\u2019est pas dessin\xE9 : \xE0 mesurer sur place" });
    }
    return [...amenee2, ...regard, ...jardin];
  }

  // src/lib/arrosage/mesure-debit.ts
  var SEAU_LITRES = 10;
  var DEBIT_COMPTEUR = 2;
  var PRESSION_COMPTEUR = 3;
  var BAR_MINIMUM_DYNAMIQUE = 2.5;
  var BAR_SUPPOSE_AU_SEAU = 2.5;
  var GARANTIE_ABSENTE = "Nous ne garantissons pas la bonne lev\xE9e des arroseurs.";
  function debitRetenu(saisie) {
    const dyn = saisie.barDynamique !== null && saisie.barDynamique > 0 ? saisie.barDynamique : null;
    const stat = saisie.barStatique !== null && saisie.barStatique > 0 ? saisie.barStatique : null;
    const secondes = saisie.secondes !== null && saisie.secondes > 0 ? saisie.secondes : null;
    const reserves = [];
    if (dyn !== null && dyn < BAR_MINIMUM_DYNAMIQUE) {
      reserves.push(
        `${dyn.toString().replace(".", ",")} bar en dynamique : sous ${BAR_MINIMUM_DYNAMIQUE.toString().replace(".", ",")} bar, les arroseurs risquent de ne pas se lever`
      );
    }
    if (stat !== null && dyn !== null && stat - dyn > 1.5) {
      reserves.push(
        `${(stat - dyn).toFixed(1).replace(".", ",")} bar de chute entre statique et dynamique : la conduite qui alimente ce robinet est \xE9troite ou longue`
      );
    }
    const dire = (garantie) => {
      const phrases = reserves.length > 0 ? [reserves.join(", ") + "."] : [];
      if (!garantie) phrases.push(GARANTIE_ABSENTE);
      return phrases.length > 0 ? phrases.join(" ") : null;
    };
    const auSeau = secondes !== null ? Math.round(SEAU_LITRES / secondes * 3.6 * 100) / 100 : null;
    if (auSeau !== null && dyn !== null) {
      return { ok: true, debit: auSeau, pression: dyn, mesure: "seau", reserve: dire(true) };
    }
    if (saisie.piquage === "compteur") {
      return { ok: true, debit: DEBIT_COMPTEUR, pression: PRESSION_COMPTEUR, mesure: "compteur", reserve: dire(false) };
    }
    if (auSeau !== null) {
      if (stat === null) {
        reserves.push(`pression non relev\xE9e : calcul men\xE9 \xE0 ${BAR_SUPPOSE_AU_SEAU.toString().replace(".", ",")} bar`);
      } else {
        reserves.push("pression relev\xE9e robinet ferm\xE9 : la statique est toujours plus haute que ce qui arrive aux arroseurs");
      }
      return { ok: true, debit: auSeau, pression: stat ?? BAR_SUPPOSE_AU_SEAU, mesure: "seau", reserve: dire(false) };
    }
    const pression = dyn ?? stat;
    if (pression !== null) {
      if (dyn === null) {
        reserves.push("pression relev\xE9e robinet ferm\xE9 : la statique est toujours plus haute que ce qui arrive aux arroseurs");
      }
      reserves.push(
        `la pression ne donne pas le d\xE9bit : il est ESTIM\xC9 \xE0 ${DEBIT_COMPTEUR.toFixed(2).replace(".", ",")} m\xB3/h. Chronom\xE9trez un seau de ${SEAU_LITRES} L pour le mesurer`
      );
      return { ok: true, debit: DEBIT_COMPTEUR, pression, mesure: "estime", reserve: dire(false) };
    }
    return {
      ok: false,
      raison: `Aucune mesure : chronom\xE9trez un seau de ${SEAU_LITRES} L, et relevez la pression dynamique au kit buse 5.`
    };
  }
  return __toCommonJS(entree_schema_exports);
})();
