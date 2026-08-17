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
    { ref:'electrovanne', nom:'Électrovanne 24 V', regle:'parSecteur', source:'provisoire' },
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
