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

  /* ── Les arroseurs ──────────────────────────────────────────────────────
     `portee` en mètres à `pression` bars. `debit360` en m³/h pour un cercle
     entier — un arroseur de bord n'en consomme que la moitié, un coin le quart.
     `pluvio` en mm/h : c'est elle qui donne les DURÉES, jamais la surface. */
  arroseurs: [
    { ref:'turbine-generique', marque:'—', nom:'Turbine', detail:'buse 3,0',
      portee:9, pression:3, debit360:0.44, pluvio:11, famille:'Arroseurs',
      source:'provisoire' },
    { ref:'tuyere-generique', marque:'—', nom:'Tuyère', detail:'buse 12',
      portee:3.7, pression:3, debit360:0.48, pluvio:38, famille:'Arroseurs',
      source:'provisoire' }
  ],

  /* ── Le goutte-à-goutte ─────────────────────────────────────────────────
     `debitMetre` en m³/h par mètre de gaine. */
  gaines: [
    { ref:'gaine-generique', marque:'—', nom:'Gaine de goutteurs',
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
     VIDE, ET C'EST VOULU : il a annoncé les envoyer, une par une, de une à six
     voies. Tant qu'une fiche manque, l'écran le DIT au lieu de composer une
     nourrice de son cru.

     Forme attendue, quand elles arriveront :

       1: { nom:'Nourrice 1 voie', source:'patron', date:'2026-08-…',
            pieces:[ { q:1, u:'u', nom:'…' }, … ] },
  */
  nourrices: {}
};

/* Ce que l'écran doit savoir dire, et qui se compte ici plutôt qu'à trois
   endroits : combien de valeurs attendent encore ses données. */
CATALOGUE.provisoires = function () {
  var n = 0;
  ['arroseurs','gaines','materiel'].forEach(function (famille) {
    CATALOGUE[famille].forEach(function (x) { if (x.source === 'provisoire') n++; });
  });
  return n;
};
