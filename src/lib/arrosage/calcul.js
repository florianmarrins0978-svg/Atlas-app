/* eslint-disable @typescript-eslint/no-unused-vars --
   **Ce fichier est une COPIE OCTET POUR OCTET de `appli/arrosage-calcul.js`**,
   et `scripts/verifier-arrosage-une-seule-source.mjs` refuse qu'elles divergent.

   Il porte donc des fonctions que le serveur n'appelle jamais : l'affichage des
   durées, la mémorisation dans le navigateur, la mise en forme des heures.
   Les retirer ici ferait diverger les deux copies — c'est-à-dire créer
   exactement le second calcul que `CLAUDE.md` §3 interdit, celui qui finit par
   ne plus dire la même chose que le premier.

   Le prix de l'identité, c'est ce silence. Il vaut mieux que deux calculs. */
// **CE FICHIER EST UNE COPIE DE `appli/arrosage-calcul.js`**, et c'est la
// première chose à savoir en l'ouvrant.
//
// **Pourquoi une copie et non une réécriture.** Le patron a demandé le 20 août
// 2026 de coder l'outil d'arrosage dans l'application. Le calcul existait déjà,
// éprouvé sur son téléphone depuis le 17 août : le récrire en TypeScript aurait
// produit une SECONDE façon de calculer un plan d'arrosage, et deux calculs qui
// divergent se paient en matériel commandé de travers (`CLAUDE.md` §3).
//
// **Pourquoi il était reprenable tel quel.** Il ne touche ni au document ni à
// la fenêtre : seules `enregistrer` et `charger` lisent `localStorage`, et elles
// sont gardées. Tout ce qui s'affiche vit dans les pages.
//
// **CE QUI SE PASSE SI L'UN DES DEUX CHANGE :**
// `scripts/verifier-arrosage-une-seule-source.mjs` compare les deux fichiers et
// ROUGIT à la moindre divergence. Une correction faite d'un côté doit être
// reportée de l'autre, tant que les deux existent.
//
// **Ils ne doivent pas coexister longtemps.** Une fois que le patron aura validé
// l'écran de l'application, `appli/arrosage.html` et ses deux scripts n'ont plus
// de raison d'être. C'est ouvert dans `TODO.md`.

import { CATALOGUE } from "./catalogue.js";

/* ═══════════════════════════════════════════════════════════════════════════
   LE CALCUL D'ARROSAGE — sorti de la page le 17 août 2026, et voici pourquoi.

   Jusqu'ici, tout vivait dans `arrosage.html` : le catalogue d'un côté, et
   dans la page à la fois le CALCUL (où se posent les arroseurs, comment se
   coupent les réseaux, ce qu'il faut acheter) et le RENDU (les champs, les
   panneaux, le SVG).

   **Une seconde page devait montrer la même chose autrement** — sa demande du
   17 août au soir : entrer par la photo du croquis, et n'obtenir que le plan
   en couleur et la liste des pièces. Recopier le calcul dedans aurait produit
   deux versions de la même règle, et le §3 du dépôt l'interdit pour une raison
   qui a déjà coûté : quand le plan et le compte se sont mis à diverger, un
   arroseur en trop est apparu sur une capture, cerclé en rouge.

   **Ce fichier ne dessine RIEN.** Il ne connaît ni `document`, ni un seul
   identifiant d'élément — sauf `charger`/`enregistrer`, qui touchent
   `localStorage` et rien d'autre. Tout ce qui s'affiche reste dans les pages.

   **La clé de sauvegarde se choisit AVANT de charger ce fichier**, par
   `window.CLE_ETAT`. Sans quoi la page d'essai écraserait le jardin qu'il a
   saisi dans l'outil — deux pages, deux jardins, une seule règle.
   ═══════════════════════════════════════════════════════════════════════════ */

var CLE_ETAT = (typeof window !== 'undefined' && window.CLE_ETAT) || 'atlas-arrosage';

/* ── Mise en forme française ─────────────────────────────────────────────── */
function nb(x, d){ d = d === undefined ? 2 : d;
  return (Math.round(x * Math.pow(10,d)) / Math.pow(10,d)).toFixed(d).replace('.', ','); }
function duree(min){ return min >= 60 ? Math.floor(min/60) + ' h ' + String(min%60).padStart(2,'0') : min + ' min'; }
function heure(min){ var h = Math.floor(min/60) % 24; return h + ' h ' + String(Math.round(min%60)).padStart(2,'0'); }

function enregistrer(){
  try { localStorage.setItem(CLE_ETAT, JSON.stringify(etat)); } catch (e) {}
}
function charger(){
  try { var v = localStorage.getItem(CLE_ETAT); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE MATÉRIEL VIENT DU CATALOGUE, plus de cette page.

   Sa demande du 17 août : ses photos d'arroseurs et ses nomenclatures entrent
   dans une base, et l'outil calcule dessus. `arrosage-catalogue.js` est cette
   base. Tant qu'une valeur y porte `source: 'provisoire'`, l'écran le signale :
   une portée qu'on croit juste et qui ne l'est pas fait acheter le mauvais
   nombre d'arroseurs, et c'est lui qui revient poser les manquants.
   ═══════════════════════════════════════════════════════════════════════════ */
var MATERIELS = {};
CATALOGUE.arroseurs.concat(CATALOGUE.gaines).forEach(function(m){ MATERIELS[m.ref] = m; });

/* Le modèle retenu pour un type d'arroseur, dans la marque choisie.
   **Le repli sur le générique est BRUYANT** : il rend aussi `emprunte`, et
   l'écran l'affiche. Un repli muet ferait croire que Rain Bird est renseigné
   alors qu'aucune de ses références n'est encore entrée. */
/* Le modèle retenu pour un type d'arroseur, dans la marque choisie.

   **La buse se choisit sur la ZONE, pas dans l'absolu** : on prend la plus
   grande dont le rayon tienne dans le plus petit côté. Une 18-VAN qui porte à
   5,4 m sur un massif de 3 m arrose surtout le mur d'en face.

   **CETTE RÈGLE EST À CONFIRMER** — c'est la plus grande buse qui tient, donc
   le moins d'arroseurs possible. S'il en choisit une autre (confort de pose,
   régularité, stock d'agence), une ligne suffit à la changer. L'écran l'annonce
   plutôt que de la cacher dans le calcul. */
/* **UN CÔTÉ SE PAVE-T-IL AVEC CETTE PORTÉE ?** Sa règle impose un écart compris
   entre la portée et 1,2 × la portée, coins occupés aux deux bouts. Sur un côté
   de longueur D, le nombre d'arroseurs est donc contraint : on prend le moins
   possible (écart maximal), et on regarde si l'écart obtenu reste au-dessus de
   la portée.

   Exemple qui a tout déclenché : une pelouse de 12 m de large avec une portée
   de 9 m. Deux rangées feraient 12 m d'écart — au-delà de sa limite. Trois
   rangées font 6 m — sous la portée, ce qu'il refuse en majuscules. **Aucune
   pose valable : c'est la BUSE qui est trop grande**, et il faut en prendre une
   plus petite. L'outil choisissait la plus grande qui « rentrait » et affichait
   ensuite une alerte sur chaque zone ; il choisit maintenant celle qui SATISFAIT
   la règle. L'alerte ne parle plus que des cas réellement impossibles. */
function paveSelonSaRegle(dimension, portee){
  if (!(dimension > 0) || !(portee > 0)) return null;
  var n = Math.max(2, Math.ceil(dimension / (portee * ECART_MAX_FACTEUR)) + 1);
  var ecart = dimension / (n - 1);
  return ecart >= portee - 0.01 ? { n:n, ecart:ecart } : null;
}

function modelePour(type, plusPetitCote, dims){
  var marque = marqueCourante();

  var buses = CATALOGUE.busesDe(marque, type);
  if (buses.length){
    var b = null;
    if (dims && dims.L > 0 && dims.l > 0){
      // De la plus grande portée à la plus petite : la première qui pave les
      // deux côtés selon sa règle est la bonne — c'est le moins d'arroseurs
      // possible SANS enfreindre l'écart minimum.
      for (var i = 0; i < buses.length; i++){
        if (paveSelonSaRegle(dims.L, buses[i].rayon) && paveSelonSaRegle(dims.l, buses[i].rayon)){
          b = buses[i]; break;
        }
      }
    }
    if (!b){
      var tenue = buses.filter(function(x){ return !plusPetitCote || x.rayon <= plusPetitCote; });
      b = tenue[0] || buses[buses.length - 1];
    }
    return {
      m: {
        ref: b.ref, nom: type === 'tuyere' ? 'Tuyère' : 'Turbine', detail: b.nom,
        marque: nomDeMarque(b.marqueCle),
        marqueCle: b.marqueCle, type: type, portee: b.rayon, pression: b.pression,
        debit360: b.debit[360], debitParAngle: b.debit, colisage: b.colisage,
        source: b.source, buse: b,
        // La pluviométrie n'est pas au catalogue : elle se déduit du débit et de
        // la surface couverte. Déduite, donc signalée comme telle.
        pluvio: pluviometrie(b),
        famille: 'Arroseurs'
      },
      emprunte: false,
      // Corps de CETTE marque, pas tous marques confondues : Rain Bird peut
      // être complet pendant que Toro n'a encore aucun corps.
      sansCorps: CATALOGUE.corps.filter(function(c){ return c.marqueCle === marque; }).length === 0
    };
  }

  var chez = CATALOGUE.arroseursDe(marque, type);
  if (chez.length) return { m: chez[0], emprunte: false };
  var generique = CATALOGUE.arroseursDe('generique', type);
  return { m: generique[0] || null, emprunte: true };
}

/* Millimètres par heure, en pose tête-bêche : le débit d'un cercle entier
   réparti sur le carré qu'il dessert (espacement × espacement, l'espacement
   valant la portée). 1 m³/h sur 1 m² = 1000 mm/h. */
function pluviometrie(b){
  var carre = b.rayon * b.rayon;
  return carre > 0 ? Math.round((b.debit[360] * 1000) / carre * 10) / 10 : 0;
}

function marqueCourante(){
  var connues = CATALOGUE.marques.map(function(x){ return x.cle; });
  return connues.indexOf(etat.marque) >= 0 ? etat.marque : CATALOGUE.marqueParDefaut();
}
function nomDeMarque(cle){
  var m = CATALOGUE.marques.filter(function(x){ return x.cle === cle; })[0];
  return m ? m.nom : cle;
}

/* **LE CORPS DE TUYÈRE COURANT — ET POURQUOI IL VIT ICI.**

   `listeMateriel` l'appelle pour compter un corps sous chaque tuyère. Il était
   resté dans `arrosage.html` à l'extraction du calcul (18 août) : la liste
   partait donc en `ReferenceError` dès qu'un jardin posait une tuyère, sur
   TOUTE page qui n'est pas `arrosage.html` — et l'écran rendait « la liste se
   remplit dès qu'un jardin est lu », c'est-à-dire un vide qui ressemble à un
   état normal. Les deux suites étaient vertes : aucune ne demandait la liste
   d'un jardin MIXTE. Une pièce de calcul qui reste dans un écran est une pièce
   que le second écran n'a pas. */
function corpsCourant(){
  var chez = CATALOGUE.corpsDe(marqueCourante());
  var choisi = chez.filter(function(c){ return c.ref === etat.corps; })[0];
  return choisi || CATALOGUE.corpsParDefaut(marqueCourante());
}

/* Les besoins en millimètres par semaine, et le nombre de passages.
   LES SECTEURS NE CHANGENT PAS AVEC LA SAISON — c'est du câblage, il est posé
   une fois. Seules les DURÉES changent, et c'est exactement ce que le client
   règle sur son programmateur au fil de l'année. */
var SAISONS = [
  { cle:'avril',   nom:'Avril',        gazon:[10,2], arbustes:[8,1],  potager:[12,2] },
  { cle:'maijuin', nom:'Mai–juin',     gazon:[18,2], arbustes:[15,2], potager:[22,3] },
  { cle:'juillet', nom:'Juillet–août', gazon:[25,3], arbustes:[20,2], potager:[30,3] },
  { cle:'sept',    nom:'Septembre',    gazon:[12,2], arbustes:[10,2], potager:[15,2] }
];

/* La famille de plantes commande le rythme : un potager ne s'arrose pas comme
   une haie. Deux familles dans un secteur, c'est l'une des deux qui perd. */
/* Ses espacements de goutte-à-goutte, le 17 août 2026 :

     « Espacement de 80 cm pour le goutte-à-goutte dans les massifs. À demander
      lors de la rédaction à l'utilisateur s'il veut une ligne ou deux lignes
      de goutte-à-goutte pour ses haies arbustes. Pour le potager, espacé de
      70 cm. »

   Un massif et un potager se mesurent donc en SURFACE (on y couche des lignes
   parallèles), une haie en LONGUEUR (une ou deux lignes, à son choix). C'est
   pour cela que le massif ne se saisit plus en mètres linéaires : demander des
   mètres de gaine à quelqu'un « qui ne connaît rien en arrosage » — ses mots —
   revient à lui faire faire le calcul qu'on lui promettait. */
var TYPES = {
  gazon:   { nom:'Pelouse',  forme:'surface',  famille:'gazon',    materiels:['turbine','tuyere'] },
  massif:  { nom:'Massif',   forme:'nappe',    famille:'arbustes', ecartLignes:0.80 },
  haie:    { nom:'Haie',     forme:'lineaire', famille:'arbustes' },
  potager: { nom:'Potager',  forme:'nappe',    famille:'potager',  ecartLignes:0.70 }
};

var MARGE = 0.85;         // on ne charge jamais un secteur jusqu'au robinet

/* ═══════════════════════════════════════════════════════════════════════
   LA RÈGLE DE POSE — la sienne, le 17 août 2026, et elle a corrigé l'inverse.

     « 80 % minimum entre chaque arroseur. Donc portée 5 m : distance entre
      chaque arroseur ~5,50 m, 6 m max, 5 m étant la perfection. Jamais moins.
      En dessous de 5 m, 4 m, 3 m : JAMAIS. »

   Ce que ça veut dire, et ce que l'outil faisait de travers :

   · LE RECOUVREMENT SE MESURE SUR L'ÉCART, PAS SUR LA PORTÉE. 80 % de
     recouvrement = portée / écart ≥ 0,80, donc écart ≤ portée / 0,80. Pour une
     portée de 5 m : jusqu'à 6,25 m d'écart, et il dit 6 m — on retient sa
     limite, pas la mienne.
   · L'ÉCART IDÉAL VAUT LA PORTÉE (« 5 m étant la perfection »), c'est-à-dire
     la pose tête-bêche.
   · ON NE RESSERRE JAMAIS SOUS LA PORTÉE. L'outil posait un arroseur tous les
     0,8 × portée — soit 4 m pour une portée de 5. C'est précisément le cas
     qu'il écrit en majuscules. Un arroseur de plus tous les quatre mètres,
     c'est un secteur de plus, un devis plus cher, et un client qui compare.
   ═══════════════════════════════════════════════════════════════════════ */
var RECOUVREMENT_MIN = 0.80;   // portée / écart ≥ 0,80
var ECART_MAX_FACTEUR = 1.20;  // sa limite à lui : 6 m pour une portée de 5

/* Quinconce au-delà de quatre arroseurs, carré en dessous — sa règle du
   17 août. Et dans les deux cas : « les derniers arroseurs doivent toujours
   être dans les coins ». Le pourtour est donc régulier, coins compris, et
   seules les rangées INTÉRIEURES se décalent d'un demi-écart. */
var QUINCONCE_AU_DELA_DE = 4;
var DEPART = 3 * 60;      // départ du cycle : 3 h du matin
var LEVER = 6 * 60 + 30;  // au-delà, l'eau s'évapore avant d'entrer

/* ══ CE QU'IL A SAISI, ET CE QUE L'OUTIL A APPRIS DEPUIS ════════════════════

   **`charger() || défauts` était un piège, et il s'est refermé le 17 août.**
   Dès qu'une sauvegarde existait, l'objet de défauts était entièrement sauté —
   donc TOUT CHAMP AJOUTÉ APRÈS SA PREMIÈRE VISITE arrivait `undefined` chez
   lui, et chez lui seul. Le champ « du compteur au regard » s'ouvrait vide,
   le verdict Ø25/Ø32 ne pouvait plus se calculer, et rien ne le disait : la
   page d'un nouveau venu était juste, celle du patron non.

   On part donc TOUJOURS des défauts, et on pose sa saisie par-dessus. Ses
   valeurs gagnent toujours ; les champs qu'il n'a jamais vus prennent la
   valeur du jour. C'est ce qui permet d'ajouter un réglage sans casser les
   jardins déjà enregistrés — et il y aura d'autres réglages. */
var DEFAUTS = {
  seau:10, temps:20, pression:3, saison:'juillet', compteur:null, corps:null,
  marque:null, // null = la marque par défaut du catalogue (Rain Bird)
  amenee:30, pe25:120, sonde:false, croquis:null,
  zones:[
    { id:1, nom:'Pelouse arrière', type:'gazon',   L:18, l:12, materiel:'auto' },
    // **Plus de tuyères imposées sur une grande pelouse (17 août).** Les deux
    // pelouses étaient auparavant forcées en tuyères pour montrer la bascule ;
    // sa règle du jour l'interdit — « un carré de douze par dix, c'est que des
    // arroseurs, pas de tuyères ». Un jardin d'exemple qui la viole enseigne
    // le contraire de ce qu'il vient de dire, et c'est le premier écran qu'on
    // ouvre. Les deux pelouses sont donc sur « au mieux ».
    { id:2, nom:'Pelouse avant',   type:'gazon',   L:12, l:8,  materiel:'auto' },
    // Et les tuyères se montrent là où elles ont leur place, dans SON exemple
    // à lui : « un long couloir qui fait dix mètres sur deux mètres de large ».
    { id:6, nom:'Couloir latéral', type:'gazon',   L:10, l:2,  materiel:'auto' },
    { id:3, nom:'Massifs',         type:'massif',  L:15, l:2.4, materiel:'gaine' },
    { id:4, nom:'Haie',            type:'haie',    ml:60, lignesHaie:1, materiel:'gaine' },
    { id:5, nom:'Potager',         type:'potager', L:8,  l:3,   materiel:'gaine' }
  ]
};

var etat = (function(){
  var sauve = charger();
  if (!sauve) return DEFAUTS;
  var e = {};
  Object.keys(DEFAUTS).forEach(function(k){ e[k] = DEFAUTS[k]; });
  // Sa saisie l'emporte, champ par champ — sauf pour ce qu'il n'a jamais eu.
  Object.keys(sauve).forEach(function(k){ if (sauve[k] !== undefined) e[k] = sauve[k]; });
  // Une clé disparue du produit (le `pe32` d'avant le calcul de diamètre) ne
  // doit pas traîner : elle ne sert plus, et elle ferait croire à un réglage.
  delete e.pe32;
  return e;
})();
var prochainId = 100;

/* ── Le calcul ───────────────────────────────────────────────────────────── */
function debitDisponible(){
  var s = Number(etat.seau) || 0, t = Number(etat.temps) || 0;
  if (s <= 0 || t <= 0) return 0;
  return (s / t) * 3.6;
}

/* ══ LA PERTE DE CHARGE D'UNE AMENÉE, ET LE CHOIX Ø25 / Ø32 ═════════════════

   Sa règle du 17 août : « Du compteur au regard : Ø25 par défaut. Passer en
   Ø32 UNIQUEMENT si le calcul hydraulique démontre que le Ø25 est
   insuffisant. » Le défaut est donc le Ø25, et le Ø32 doit se MÉRITER — il
   coûte plus cher et se pose moins bien.

   La formule est celle de Hazen-Williams, l'usage en arrosage, avec C = 150
   pour le polyéthylène lisse :

       perte (m) = 10,67 × L × (Q/C)^1,852 / D^4,87      Q en m³/s, D en m

   **Le débit retenu est celui du PLUS GROS SECTEUR, pas la somme** : les
   vannes s'ouvrent l'une après l'autre, jamais ensemble — c'est tout l'objet
   du découpage. Prendre la somme surdimensionnerait chaque chantier.

   ⚠ **CE QUE CE CALCUL NE CONTIENT PAS, et il faut le dire à l'écran :** les
   pertes des antennes, des raccords, de l'électrovanne et du disconnecteur.
   Un verdict « le Ø25 suffit » est donc un PLANCHER, pas une garantie. Ce
   qu'il tranche sûrement, c'est l'inverse : si le Ø25 ne passe déjà pas en
   ignorant tout le reste, il ne passera jamais. */
function perteDeCharge(debitM3h, longueurM, dInterieurMm){
  if (!(debitM3h > 0) || !(longueurM > 0) || !(dInterieurMm > 0)) return 0;
  var q = debitM3h / 3600;          // m³/s
  var d = dInterieurMm / 1000;      // m
  var metres = 10.67 * longueurM * Math.pow(q / 150, 1.852) / Math.pow(d, 4.87);
  return metres / 10.2;             // 10,2 m de colonne d'eau = 1 bar
}

/* Ce que devient l'amenée compteur → regard, une fois le jardin découpé. */
function amenee(d){
  var longueur = Number(etat.amenee) || 0;
  var pire = d.secteurs.reduce(function(s, x){ return Math.max(s, x.debit || 0); }, 0);
  // La pression dont les buses posées ont besoin : celle à laquelle leur
  // portée et leur débit sont donnés au catalogue. En dessous, la portée
  // annoncée n'est plus la bonne et tout le pavage est faux.
  var exigee = 0;
  etat.zones.forEach(function(z){
    var p = poser(z);
    if (p.m && p.m.pression) exigee = Math.max(exigee, p.m.pression);
  });
  var t25 = CATALOGUE.tuyaux.pe25, t32 = CATALOGUE.tuyaux.pe32;
  var perte25 = perteDeCharge(pire, longueur, t25.dInterieur);
  var perte32 = perteDeCharge(pire, longueur, t32.dInterieur);
  var source = Number(etat.pression) || 0;
  // Le Ø25 est insuffisant quand, PERTES DES ANTENNES MISES À PART, il ne
  // laisse déjà plus aux buses la pression à laquelle elles sont données.
  var suffit = !(longueur > 0 && pire > 0 && exigee > 0) || (source - perte25 >= exigee);
  return { longueur:longueur, debit:pire, exigee:exigee, source:source,
           perte25:perte25, perte32:perte32, suffit:suffit,
           auRegard: source - (suffit ? perte25 : perte32),
           diametre: suffit ? 25 : 32,
           provisoire: (suffit ? t25 : t32).source === 'provisoire' };
}

/* ══ TUYÈRE OU TURBINE : SA RÈGLE DU 17 AOÛT, ET ELLE CORRIGE UN SEUIL FAUX ══

   « Les tuyères, on s'en sert uniquement pour les petits espaces. Donc
     inférieur à trois mètres cinquante, quatre mètres grand max. Sinon après
     on passe en 3504 ou plus gros. Généralement quand tu as un carré de douze
     mètres par dix, c'est que des arroseurs, pas de tuyères. Les tuyères c'est
     vraiment lorsque derrière un massif il y a une petite zone, un carré de
     trois par trois, ou un long couloir de dix mètres sur deux de large. »

   Le seuil était à 8 m, et il est à 4. L'écart n'est pas cosmétique : une
   pelouse de 12 × 8 partait en tuyères, c'est-à-dire en une pluviométrie
   trois fois plus forte, beaucoup plus de têtes et beaucoup plus de débit —
   donc des secteurs en plus, et une facture qui n'a rien à voir.

   **C'est le PETIT CÔTÉ qui décide, et lui seul** : ses deux exemples le
   disent — le couloir de 10 × 2 m prend des tuyères malgré ses 10 m de long,
   le carré de 12 × 10 n'en prend aucune. Une tuyère porte 3 à 5 m ; ce qu'elle
   ne peut pas faire, c'est traverser une largeur.

   4 m est la limite HAUTE (« grand max »), 3,50 m le cas courant. On retient
   donc 4 m comme frontière, et l'écran écrit la règle pour qu'il la corrige
   d'un coup d'œil s'il la voulait plus serrée.

   Rend un TYPE ('turbine', 'tuyere', 'gaine'), pas une référence : la
   référence dépend de la marque choisie, et elle peut changer sous les pieds
   de la zone quand il bascule de Rain Bird à Toro. Garder un type laisse ses
   zones intactes à la bascule — ce qu'un changement de marque doit faire. */
var TUYERE_JUSQUA = 4;      // mètres, sur le PETIT côté — « 4 m grand max »
var TUYERE_CONFORT = 3.5;   // le cas courant, écrit à l'écran

function materielDe(z){
  if (TYPES[z.type].forme !== 'surface') return 'gaine';
  if (z.materiel === 'turbine' || z.materiel === 'tuyere') return z.materiel;
  var petit = Math.min(Number(z.L)||0, Number(z.l)||0);
  return petit > TUYERE_JUSQUA ? 'turbine' : 'tuyere';
}

/* Les positions réelles d'une pose — la SEULE fonction qui les calcule.
   `poser()` (pour compter et chiffrer) et `dessinerPlans()` (pour le SVG) s'y
   réfèrent tous les deux : deux calculs séparés auraient fini par diverger
   (règle du §3 du dépôt), et c'est justement ce qui s'est produit avant cette
   version — le plan déplaçait des arroseurs sans jamais en retirer, ce qui
   entassait deux têtes voisines d'un côté et laissait un trou de l'autre.

   Le quinconce n'est pas un DÉCALAGE des points existants : c'est une rangée
   sur deux qui porte UN ARROSEUR DE MOINS, posé entre chaque paire de la
   rangée alignée. C'est ce qui rend le quinconce plus économe qu'une grille
   carrée — sinon ce n'est qu'une grille carrée déplacée, donc ni plus économe
   ni mieux couverte, juste plus confuse à l'œil (« un arroseur en trop »,
   signalé le 17 août). Les coins et les bords restent alignés, sur SA règle :
   « les derniers arroseurs doivent toujours être dans les coins ». */
function pointsDeLaPose(nx, ny, ecartX, ecartY, quinconce){
  // ── LE QUINCONCE EST UN DAMIER — son croquis du 18 août 2026 ─────────────
  //
  // *« Dans les couloirs, le but c'est de poser les tuyères en quinconce, car
  // le but c'est que celle de gauche recouvre quasi 100 % jusqu'à celle de
  // droite. Donc le quinconce est optimal. »* Puis son croquis, sans
  // ambiguïté : un couloir à **14** arroseurs alignés, le même à **7** en
  // quinconce — une tête sur deux, en alternant les bords.
  //
  // **C'est exactement un damier : on garde le point (i, j) quand i + j est
  // pair.** Sur deux rangées, cela donne son alternance ; sur davantage, le
  // vrai quinconce triangulaire.
  //
  // **Ce que la version d'avant faisait, et pourquoi c'était faux.** Elle ne
  // décalait que les rangées INTÉRIEURES d'un demi-écart, en gardant tout le
  // pourtour. Un couloir n'ayant que deux rangées, toutes deux en bord, il
  // n'y avait **aucun quinconce du tout** — c'est la grille alignée qu'il a vue
  // à l'écran, et ses 12 tuyères là où il en pose 7.
  //
  // **Et deux coins perdent leur tête, ce qu'il a validé le 18 août** (« oui,
  // ça me va ») : sur un damier, deux coins opposés portent un i + j impair.
  // Ils restent arrosés — c'est `couvreTout` qui l'exige —, simplement sans
  // arroseur dessus. Cela révise sa règle du 17 août (« les derniers arroseurs
  // toujours dans les coins »), qui valait pour la pose alignée.
  var pts = [];
  for (var j = 0; j < ny; j++){
    for (var i = 0; i < nx; i++){
      if (quinconce && (i + j) % 2 !== 0) continue;
      var bordRangee = (j === 0 || j === ny - 1);
      var coin = bordRangee && (i === 0 || i === nx - 1);
      var bord = bordRangee || i === 0 || i === nx - 1;
      pts.push({ x: i * ecartX, y: j * ecartY, zone: coin ? 'coin' : (bord ? 'bord' : 'interieur') });
    }
  }
  return pts;
}

/* ── EST-CE QUE TOUT LE TERRAIN EST ARROSÉ ? ────────────────────────────────

   **Cette fonction existe parce qu'un damier ne couvre pas toujours.** Retirer
   une tête sur deux double la distance entre voisins d'une même rangée : si
   l'écart de départ était au maximum de sa tolérance (1,20 × portée), le coin
   abandonné se retrouve à sec. On ne le SUPPOSE donc pas — on le mesure, et
   `poser` resserre tant que ce n'est pas vrai.

   **On échantillonne au dixième de la portée.** Ni plus fin (cette fonction est
   appelée à chaque frappe), ni plus grossier : un manque plus petit que le
   dixième d'une portée n'existe pas sur un chantier, et le doute penche du bon
   côté puisqu'un échantillon manqué ne fait que resserrer la pose.

   **Elle refuse de conclure sans matière** — le piège du 15 août : sans tête,
   ou sur une zone de dimension nulle, elle rend `false` plutôt qu'un vrai qui
   n'aurait rien regardé. */
function couvreTout(points, portee, L, l){
  if (!points || !points.length || !(portee > 0) || !(L > 0) || !(l > 0)) return false;
  var pas = portee / 10, p2 = portee * portee;
  for (var x = 0; x <= L + 1e-9; x = Math.min(x + pas, L + 1e-9)){
    for (var y = 0; y <= l + 1e-9; y = Math.min(y + pas, l + 1e-9)){
      var atteint = false;
      for (var k = 0; k < points.length; k++){
        var dx = x - points[k].x, dy = y - points[k].y;
        if (dx*dx + dy*dy <= p2 + 1e-9){ atteint = true; break; }
      }
      if (!atteint) return false;
      if (y >= l) break;
    }
    if (x >= L) break;
  }
  return true;
}

function poser(z){
  var petitCote = Math.min(Number(z.L)||0, Number(z.l)||0);
  var dims = { L: Number(z.L)||0, l: Number(z.l)||0 };
  var cle = materielDe(z), choix;
  if (cle === 'gaine'){
    choix = { m: CATALOGUE.gaines[0], emprunte: CATALOGUE.gaines[0].marqueCle === 'generique' };
  } else {
    choix = modelePour(cle, petitCote || null, dims);
    // Si le type retenu d'office ne donne aucune pose valable, on essaie
    // l'autre AVANT de rendre une alerte : une turbine qui ne tient pas sur une
    // petite zone n'est pas une fatalité, c'est une tuyère.
    //
    // **Mais ce repli NE PEUT PLUS ramener une grande zone aux tuyères**
    // (17 août) : au-delà de 4 m de petit côté, sa règle est sans exception —
    // « sinon on passe en 3504 ou plus gros ». Si aucune turbine ne pave, il
    // faut le DIRE, pas retomber en silence sur un matériel qu'il a exclu :
    // le plan serait posable et faux, ce qui est le pire des deux.
    var repliPermis = Math.min(dims.L, dims.l) <= TUYERE_JUSQUA;
    if (z.materiel === 'auto' && choix.m && dims.L > 0 &&
        !(paveSelonSaRegle(dims.L, choix.m.portee) && paveSelonSaRegle(dims.l, choix.m.portee))){
      var vers = cle === 'turbine' ? 'tuyere' : 'turbine';
      if (vers === 'turbine' || repliPermis){
        var autre = modelePour(vers, petitCote || null, dims);
        if (autre.m && paveSelonSaRegle(dims.L, autre.m.portee) && paveSelonSaRegle(dims.l, autre.m.portee)){
          choix = autre; cle = vers;
        }
      }
    }
  }
  var m = choix.m, sais = saisonCourante();
  if (!m) return { cle:cle, m:null, nombre:0, debit:0, minutes:0, nx:0, ny:0, emprunte:true };
  var besoin = sais[TYPES[z.type].famille][0], passages = sais[TYPES[z.type].famille][1];
  var r = { cle:cle, m:m, besoin:besoin, passages:passages, emprunte:choix.emprunte };

  if (TYPES[z.type].forme === 'surface'){
    var L = Number(z.L)||0, l = Number(z.l)||0;
    if (L <= 0 || l <= 0) return Object.assign(r, { nombre:0, debit:0, minutes:0, nx:0, ny:0 });
    // On écarte AU MAXIMUM dans sa limite, puis on répartit : c'est le moins
    // d'arroseurs possible sans jamais descendre sous la portée.
    var px = paveSelonSaRegle(L, m.portee), py = paveSelonSaRegle(l, m.portee);
    var ecartMax = m.portee * ECART_MAX_FACTEUR;
    var nx = px ? px.n : Math.max(2, Math.ceil(L / ecartMax) + 1);
    var ny = py ? py.n : Math.max(2, Math.ceil(l / ecartMax) + 1);
    var ecartX = L / (nx - 1), ecartY = l / (ny - 1);
    r.ecart = Math.max(ecartX, ecartY);
    r.ecartX = ecartX; r.ecartY = ecartY;
    // « Jamais moins que la portée. » Quand la zone est trop étroite pour cette
    // buse, l'écart tombe sous la portée quoi qu'on fasse — puisque les coins
    // doivent rester occupés. L'écran le DIT au lieu de rendre une pose qu'il
    // refuse : c'est le signe qu'il faut une buse plus petite.
    r.tropSerre = (ecartX < m.portee - 0.01) || (ecartY < m.portee - 0.01);
    // ── LE QUINCONCE : ON L'ESSAIE, ON LE MESURE, ON RESSERRE ────────────
    //
    // Sa règle du 18 août, croquis à l'appui : un couloir à 14 arroseurs
    // alignés se pose à **7** en quinconce. Le damier retire une tête sur
    // deux — mais il double du même coup la distance entre voisins d'une
    // rangée, et le coin abandonné peut se retrouver à sec.
    //
    // **On ne le suppose donc pas : on le mesure** (`couvreTout`), et l'on
    // resserre la grille tant que ce n'est pas couvert — en allongeant
    // toujours du côté où l'écart est le plus grand, pour rester régulier.
    // La boucle s'arrête d'elle-même : dès que le damier ne coûte plus moins
    // que l'aligné, on garde l'aligné, qui couvre par construction.
    //
    // **Le compte se décide sur la grille ALIGNÉE** (sa règle du 17 août :
    // « quinconce dès qu'il y a plus de 4 arroseurs »), avant que le damier
    // n'en retire.
    var quinconceVoulu = (nx * ny) > QUINCONCE_AU_DELA_DE;
    var alignes = pointsDeLaPose(nx, ny, ecartX, ecartY, false);
    var points = alignes;
    if (quinconceVoulu){
      var ax = nx, ay = ny, essai = null;
      for (var t = 0; t < 40; t++){
        var ex2 = L / (ax - 1), ey2 = l / (ay - 1);
        var damier = pointsDeLaPose(ax, ay, ex2, ey2, true);
        if (damier.length >= alignes.length) break;      // plus rien à gagner
        if (couvreTout(damier, m.portee, L, l)){
          essai = { pts: damier, nx: ax, ny: ay, ecartX: ex2, ecartY: ey2 };
          break;
        }
        if (ex2 >= ey2) ax++; else ay++;
      }
      if (essai){
        points = essai.pts;
        nx = essai.nx; ny = essai.ny;
        ecartX = essai.ecartX; ecartY = essai.ecartY;
        r.ecart = Math.max(ecartX, ecartY);
        r.ecartX = ecartX; r.ecartY = ecartY;
        r.tropSerre = (ecartX < m.portee - 0.01) || (ecartY < m.portee - 0.01);
      } else {
        quinconceVoulu = false;   // le damier ne couvre pas : on reste aligné
      }
    }
    var coins = points.filter(function(pt){ return pt.zone === 'coin'; }).length;
    var bords = points.filter(function(pt){ return pt.zone === 'bord'; }).length;
    var inter = points.filter(function(pt){ return pt.zone === 'interieur'; }).length;
    // Un arroseur de bord ne tourne que d'un demi-tour, un coin d'un quart.
    // **Le débit de chaque arc est LU au catalogue quand il y est**, pas déduit
    // en divisant : sur les petites buses, quatre fois le quart de tour ne fait
    // pas le tour complet (6-VAN : 0,27 contre 0,32). Diviser aurait surestimé.
    var q = m.debitParAngle ? m.debitParAngle[90]  : m.debit360 / 4;
    var d = m.debitParAngle ? m.debitParAngle[180] : m.debit360 / 2;
    r.nx = nx; r.ny = ny; r.points = points; r.nombre = points.length;
    r.quinconce = quinconceVoulu;
    r.debit = coins*q + bords*d + inter*m.debit360;
    // Le débit de CHAQUE tête, porté par le point lui-même : c'est ce qui
    // permet au découpage de répartir les arroseurs entre les vannes en
    // sachant ce que chacun boit, au lieu de diviser le total en parts égales
    // qu'aucune coupe réelle ne produit.
    points.forEach(function(pt){
      pt.debit = pt.zone === 'coin' ? q : (pt.zone === 'bord' ? d : m.debit360);
    });
    r.sansCorps = choix.sansCorps;
  } else if (TYPES[z.type].forme === 'nappe') {
    // Des lignes parallèles dans la largeur, à l'écart qu'il a donné. La
    // première et la dernière longent les bords : d'où le « + 1 ».
    var L2 = Number(z.L)||0, l2 = Number(z.l)||0;
    if (L2 <= 0 || l2 <= 0) return Object.assign(r, { nombre:0, debit:0, minutes:0 });
    var e = TYPES[z.type].ecartLignes;
    var lignes = Math.max(1, Math.floor(l2 / e) + 1);
    r.lignes = lignes; r.ecartLignes = e;
    r.nombre = Math.round(lignes * L2);
    r.debit = r.nombre * m.debitMetre;
  } else {
    // Une haie : une ou deux lignes, c'est LUI qui décide — sa consigne du
    // 17 août, et l'écran pose la question au lieu de trancher.
    var ml = Number(z.ml)||0;
    var n2 = Number(z.lignesHaie) === 2 ? 2 : 1;
    r.lignes = n2;
    r.nombre = Math.round(ml * n2);
    r.debit = r.nombre * m.debitMetre;
  }
  // La durée dépend de la PLUVIOMÉTRIE, jamais de la surface : la même
  // quantité d'eau demande 45 min de turbine et 13 min de tuyère.
  r.minutes = passages > 0 ? Math.round((besoin / passages / m.pluvio) * 60) : 0;
  return r;
}

/* Le taux réellement obtenu sur une pose : portée / écart. Affiché pour qu'il
   vérifie d'un regard que rien ne descend sous ses 80 %. */
function recouvrementObtenu(portee, ecart){
  return ecart > 0 ? portee / ecart : 0;
}

function saisonCourante(){
  for (var i=0;i<SAISONS.length;i++) if (SAISONS[i].cle === etat.saison) return SAISONS[i];
  return SAISONS[2];
}

function decouper(){
  var dispo = debitDisponible(), limite = dispo * MARGE, groupes = {}, ordre = [];
  etat.zones.forEach(function(z){
    var p = poser(z);
    if (p.debit <= 0) return;
    // La clé du groupe ne contient QUE ce qui ne change pas avec la saison :
    // le matériel et la famille de plantes. Un secteur est du câblage.
    //
    // **ET LA PLUVIOMÉTRIE EN FAIT PARTIE — sa règle du 17 août, « ça ne se
    // mélange jamais ».** Le type ne suffit pas : deux TURBINES peuvent avoir
    // des pluviométries différentes selon leur buse, et une vanne les ouvrirait
    // pour la même durée. Le défaut est resté invisible tant que les deux
    // pelouses du jardin d'exemple étaient l'une en turbines et l'autre en
    // tuyères ; le jour où sa règle sur les tuyères les a mises toutes deux en
    // turbines, elles se sont retrouvées sur la même vanne avec 5,9 et
    // 6,1 mm/h — et c'est le PLAN, en les coloriant de la même couleur, qui l'a
    // montré. Ici l'écart était de 3 % ; entre une 3504 fine et une grosse
    // PGP, il se compte en multiples.
    var clef = p.cle + '|' + TYPES[z.type].famille + '|' + (p.m.pluvio || 0);
    if (!groupes[clef]) { groupes[clef] = { zones:[], membres:[], debit:0, minutes:0, passages:0, m:p.m, cle:p.cle }; ordre.push(clef); }
    groupes[clef].zones.push(z.nom || TYPES[z.type].nom);
    groupes[clef].membres.push({ zoneId: z.id, points: p.points });
    groupes[clef].debit += p.debit;
    groupes[clef].minutes = p.minutes;
    groupes[clef].passages = p.passages;
    groupes[clef].nombre = (groupes[clef].nombre || 0) + p.nombre;
    groupes[clef].forme = TYPES[z.type].forme;
  });

  // **`reseauxDeZone` : quelle zone est sur quelles vannes.** `reseauDuPoint`
  // ne répond que pour une TÊTE — et un massif n'en a aucune. Le plan ne
  // pouvait donc pas colorier la bande du goutte-à-goutte, alors que sa vanne
  // occupe bien une voie de la nourrice : on voyait « nourrice 3 voies » avec
  // deux couleurs au dessin, et rien ne disait où passait la troisième.
  var secteurs = [], reseauDuPoint = {}, reseauxDeZone = {};
  var noterZone = function(zoneId, i){
    if (!reseauxDeZone[zoneId]) reseauxDeZone[zoneId] = [];
    if (reseauxDeZone[zoneId].indexOf(i) < 0) reseauxDeZone[zoneId].push(i);
  };
  ordre.forEach(function(clef){
    var g = groupes[clef];
    var premier = secteurs.length;
    var ajouter = function(debit, combien, rang){
      secteurs.push({
        nom: g.zones.join(' + '),
        part: combien > 1 ? rang + ' sur ' + combien : null,
        famille: g.m.famille,
        debit: debit,
        minutes: g.minutes,
        passages: g.passages
      });
    };

    // **QUEL ARROSEUR EST SUR QUELLE VANNE** — ce que le découpage ne disait
    // pas jusqu'ici. Il comptait « il faut 4 secteurs » sans jamais dire
    // lesquels des arroseurs y étaient, et le plan ne pouvait donc pas les
    // colorier (sa demande du 17 août : « un petit plan avec le nombre de
    // réseaux, avec des couleurs différentes »).
    //
    // **La coupe se fait par RANGÉES CONTIGUËS, et elle REMPLIT jusqu'à la
    // limite** — deux choses, et chacune corrige un défaut.
    //
    // Contiguës : sur un chantier, une vanne dessert une bande d'un seul
    // tenant, pas un arroseur sur deux. Une coupe alternée donnerait le même
    // compte et un plan impossible à poser.
    //
    // Et remplie pour de vrai, au lieu de diviser le total en parts égales :
    // une première version annonçait deux secteurs « à 0,88 m³/h » quand la
    // coupe par rangées en mettait 7 d'un côté et 4 de l'autre. Le plan
    // montrait alors une répartition que la liste des secteurs démentait —
    // exactement la divergence que le §3 du dépôt interdit. Ici, le nombre de
    // secteurs SORT du remplissage : on ferme une vanne quand la rangée
    // suivante la ferait déborder.
    // Les têtes dans L'ORDRE DE POSE (rangée par rangée, et de gauche à droite
    // dans chaque rangée) : c'est `pointsDeLaPose` qui les engendre ainsi, et
    // c'est l'ordre dans lequel un tuyau les visiterait.
    var suite = [];
    g.membres.forEach(function(mb){
      if (!mb.points) return;
      mb.points.forEach(function(pt){ suite.push({ zoneId: mb.zoneId, pt: pt, debit: pt.debit || 0 }); });
    });

    if (!suite.length){
      // Goutte-à-goutte : pas de têtes à répartir, la gaine se coupe où l'on
      // veut. La division en parts égales reste juste pour elle.
      var n = limite > 0 ? Math.max(1, Math.ceil(g.debit / limite)) : 1;
      for (var i=0;i<n;i++){
        ajouter(g.debit / n, n, i+1);
        g.membres.forEach(function(mb){ noterZone(mb.zoneId, premier + i); });
      }
      return;
    }

    // **On coupe AU POINT PRÈS, pas à la rangée.** Couper seulement entre
    // rangées paraissait plus propre, jusqu'à ce que la pelouse avant le
    // démente : sa rangée du milieu boit 1,77 m³/h à elle seule, au-dessus de
    // la limite de 1,53 — insécable, elle fabriquait un secteur en
    // dépassement. Une rangée longue alimentée par deux vannes, une à chaque
    // bout, est pourtant ce qu'on pose tous les jours.
    //
    // **Et l'on VISE l'équilibre au lieu de remplir à ras bord.** Remplir
    // jusqu'à la limite donnait 9 têtes sur une vanne et 2 sur l'autre : juste
    // au sens du débit, absurde au sens du chantier. On calcule donc d'abord
    // combien de vannes il faut, puis on répartit autour de cette moyenne — en
    // gardant la limite comme garde-fou dur, jamais franchi.
    var total = suite.reduce(function(s,x){ return s + x.debit; }, 0);
    var combien = limite > 0 ? Math.max(1, Math.ceil(total / limite)) : 1;
    var visee = total / combien;
    var paquets = [[]], debits = [0];
    suite.forEach(function(x){
      var i = paquets.length - 1;
      var trop = debits[i] + x.debit;
      var ouvrirUnAutre = paquets[i].length > 0 && (
        (paquets.length < combien && trop > visee + 1e-9) ||   // l'équilibre visé
        (limite > 0 && trop > limite + 1e-9)                   // le garde-fou dur
      );
      if (ouvrirUnAutre){ paquets.push([]); debits.push(0); i++; }
      paquets[i].push(x); debits[i] += x.debit;
    });
    paquets.forEach(function(pq, i){
      ajouter(debits[i], paquets.length, i+1);
      pq.forEach(function(x){
        reseauDuPoint[x.zoneId + ':' + x.pt.x.toFixed(3) + ':' + x.pt.y.toFixed(3)] = premier + i;
        noterZone(x.zoneId, premier + i);
      });
    });
  });
  return { secteurs:secteurs, dispo:dispo, limite:limite, reseauDuPoint:reseauDuPoint,
           reseauxDeZone:reseauxDeZone,
           demande: etat.zones.reduce(function(s,z){ return s + poser(z).debit; }, 0) };
}

function voiesProgrammateur(n){
  var tailles = [4,6,8,12,16,24];
  for (var i=0;i<tailles.length;i++) if (tailles[i] >= n) return tailles[i];
  return n;
}

/* Les couleurs des réseaux — les siennes en tête (bleu, vert, jaune),
   puis de quoi tenir au-delà sans que deux voisines se confondent. Le NUMÉRO
   reste écrit à côté : c'est lui qui identifie le réseau, la couleur ne fait
   que le retrouver d'un coup d'œil. */
var COULEURS_RESEAU = ['#2F6FB5','#3E8F4E','#D9A520','#B5502F','#7A4FA3','#1F8A8A','#B5417F','#6B7A2F'];
function couleurReseau(i){ return COULEURS_RESEAU[i % COULEURS_RESEAU.length]; }

function listeMateriel(d){
  var lignes = [], compte = {}, modeles = {};
  // Le tracé du réseau latéral, sa règle du 17 août (planche 73) : un té
  // (« Départ »/« Milieu ») à chaque point sauf le dernier de sa rangée, qui
  // porte un coude (« Fin »). Et depuis le regard, plusieurs lignes
  // parallèles — un té de JONCTION à chaque rangée où le tronc continue vers
  // la suivante, mais RIEN à la dernière : le tuyau s'y courbe sans pièce à
  // couper. D'où, par secteur de `ny` rangées et `nombre` points au total :
  // (nombre − ny) tés de ligne, `ny` coudes de fin, (ny − 1) jonctions.
  var totalPointsReseau = 0, totalRangeesReseau = 0, totalJonctionsReseau = 0;
  etat.zones.forEach(function(z){
    var p = poser(z);
    if (!p.nombre || !p.m) return;
    // Compté par RÉFÉRENCE : c'est elle qui part chez le fournisseur, et elle
    // change quand il bascule de marque. Compter par type ferait commander
    // « des turbines » sans dire lesquelles.
    compte[p.m.ref] = (compte[p.m.ref] || 0) + p.nombre;
    modeles[p.m.ref] = p.m;
    if (p.ny){
      totalPointsReseau += p.nombre;
      totalRangeesReseau += p.ny;
      totalJonctionsReseau += Math.max(0, p.ny - 1);
    }
  });
  var totalArroseurs = 0, totalGaine = 0;
  Object.keys(compte).forEach(function(ref){
    var m = modeles[ref];
    if (m.type === 'gaine'){ totalGaine += compte[ref]; return; }
    totalArroseurs += compte[ref];
    lignes.push({ ref: m.ref,
                  nom: (m.marqueCle === 'generique' ? '' : m.marque + ' ') +
                       m.nom + 's ' + m.detail +
                       (m.colisage ? ' — par ' + m.colisage : ''),
                  q: compte[ref], u:'u' });
  });
  if (totalGaine){
    var g = CATALOGUE.gaines[0];
    lignes.push({ ref:g.ref, nom:'Gaine de goutteurs ' + g.detail, q: totalGaine, u:'ml' });
  }
  // **UN CORPS PAR ARROSEUR, MAIS LE CORPS DE SA FAMILLE.** Une tuyère prend
  // le corps qu'il a choisi à l'écran (10 cm sans option par défaut, sa
  // décision du 17 août) ; une turbine prend le corps de SA série — la buse
  // 0,75 du 3504 ne va que dans un corps 3504, il n'y a rien à trancher là
  // (`CATALOGUE.corpsDeLaBuse`).
  //
  // **Ce partage est né d'un défaut vu SUR L'ÉCRAN, pas d'un test.** Le jour
  // où les turbines sont devenues posables (sa règle du 17 août sur leur
  // débit), cette liste comptait encore un corps de TUYÈRE pour les 22
  // arroseurs du jardin — dont 11 turbines — et 22 coudes SBE en 1/2" quand
  // les turbines se raccordent en 3/4". Les suites étaient toutes vertes :
  // aucune ne regardait le corps par famille. C'est la capture qui l'a montré,
  // la cinquième fois dans ce dépôt (§5).
  //
  // Sans corps enregistré pour la marque courante, on ne compte rien plutôt
  // que de compter un corps qui n'existe pas dans son catalogue.
  var parCorps = {}, corpsDe = {};
  Object.keys(compte).forEach(function(ref){
    var m = modeles[ref];
    if (m.type === 'gaine') return;
    var c = m.type === 'turbine' ? CATALOGUE.corpsDeLaBuse(m.buse) : corpsCourant();
    if (!c) return;
    parCorps[c.ref] = (parCorps[c.ref] || 0) + compte[ref];
    corpsDe[c.ref] = c;
  });
  Object.keys(parCorps).forEach(function(cref){
    var c = corpsDe[cref];
    lignes.push({ ref:c.ref, nom:c.nom + ' — ' + c.detail, q: parCorps[cref], u:'u' });
  });
  // « Sous les arroseurs il faut obligatoirement des coudes SBE, choisis-les
  // en fonction des diamètres, un à chaque fois par arroseur » — sa consigne
  // du 17 août. Le taraudage vient du CORPS posé, pas du hasard : un 1800 se
  // raccorde en 1/2", un PGP Ultra en 3/4". Un jardin qui mêle turbines et
  // tuyères porte donc les DEUX diamètres, chacun pour sa part — c'est
  // exactement ce que la version précédente ne savait pas faire.
  var parFiletage = {};
  Object.keys(parCorps).forEach(function(cref){
    var f = corpsDe[cref].filetage;
    if (f) parFiletage[f] = (parFiletage[f] || 0) + parCorps[cref];
  });
  //
  // **UN PRODUIT, UNE LIGNE — et c'est la suite de sa consigne du 18 août.**
  // Les deux SBE portaient « (haut, au corps) » et « (bas, sur la ligne) » :
  // l'emploi de la pièce, pas sa désignation. Les retirer sans plus aurait
  // produit DEUX lignes identiques dès qu'un corps est en 3/4" (les grosses
  // turbines) — même référence en haut et en bas —, ce qui se lit comme un
  // défaut de comptage. On additionne donc par RÉFÉRENCE : il commande un
  // produit et une quantité, pas un emplacement.
  var parSbe = {}, ordreSbe = [];
  var noterSbe = function(coude, q){
    if (!coude) return;
    if (!parSbe[coude.ref]) { parSbe[coude.ref] = { c: coude, q: 0 }; ordreSbe.push(coude.ref); }
    parSbe[coude.ref].q += q;
  };
  Object.keys(parFiletage).forEach(function(f){
    noterSbe(CATALOGUE.coudes.filter(function(c){ return c.filetage === f; })[0], parFiletage[f]);
  });
  // **Un DEUXIÈME SBE, celui du bas** — sa planche du 17 août sur le réseau
  // latéral : chaque arroseur (départ, milieu ou fin de ligne) porte 1 SBE
  // 3/4" au raccord de tuyauterie, TOUJOURS 3/4" quel que soit le corps —
  // c'est le té ou le coude de la ligne qui impose ce diamètre, pas le corps.
  // Ce raccord-là ne manque à aucun arroseur, contrairement au té/coude de
  // ligne qui dépend du TRACÉ (voir plus bas) : compté ici sans attendre.
  if (totalArroseurs){
    var sbeBas = CATALOGUE.coudes.filter(function(c){ return c.filetage === '3/4'; })[0];
    // Même RÉFÉRENCE que le SBE du haut quand le corps est aussi en 3/4"
    // (grosses turbines) : c'est exactement pourquoi les deux emplois
    // s'additionnent au lieu de faire deux lignes.
    noterSbe(sbeBas, totalArroseurs);
    // « Environ 2 m de PEBD rigide Ø16 » entre la ligne et l'arroseur, par
    // position — sa valeur, pas une supposition. Approximative comme elle
    // l'a donnée : elle varie selon la profondeur réelle de pose.
    var pebd = CATALOGUE.piecesReseau['pebd16'];
    // Le « (~2 m par arroseur) » qui suivait a été retiré le 18 août, même
    // consigne que pour les tés : c'est la règle du COMPTE, pas la désignation
    // de la pièce. Elle reste écrite juste au-dessus, où elle sert.
    lignes.push({ ref:'pebd16', nom:pebd.nom, q: totalArroseurs * 2, u:'ml' });
  }
  // Les SBE, une fois les DEUX emplois comptés : une ligne par référence.
  ordreSbe.forEach(function(ref){
    var e = parSbe[ref];
    lignes.push({ ref: ref, nom: e.c.nom + ' — ' + e.c.detail, q: e.q, u:'u' });
  });
  // **Le tracé du réseau latéral — comptable depuis sa réponse du 17 août
  // (planche 73) : « c'est le B », plusieurs lignes parallèles, avec sa
  // correction sur le té et le coude.** Un té à chaque point de ligne sauf le
  // dernier de sa rangée (qui porte le coude de fin), et une jonction par
  // rangée où le tronc continue au-delà — jamais à la dernière, qui se courbe
  // sans pièce à couper.
  //
  // **CE QUI EST COMPTÉ SE DIT ; POURQUOI, NON — sa consigne du 18 août.** Les
  // lignes portaient « (départ/milieu de ligne) », « (fin de ligne) »,
  // « (jonction, non taraudé) » : *« ce sont des données pour toi, pour que tu
  // comprennes les endroits où doit y avoir des tés et les autres où c'est des
  // tés taraudés. Mais pour l'utilisateur, il n'a pas besoin de ces infos-là.
  // Donc tu peux les supprimer, mais tu les gardes pour toi. »*
  //
  // Il commande ces pièces chez son fournisseur : la désignation doit être
  // celle du catalogue, rien de plus. Le raisonnement reste ici, où il sert —
  // le supprimer, c'est le reperdre à la prochaine conversation.
  //
  // **Les références, elles, ne changent pas.** Deux lignes ne peuvent pas se
  // confondre une fois le commentaire retiré : le té de ligne est taraudé
  // (25×3/4"×25), la jonction ne l'est pas (25×25×25), et le coude de fin est
  // un coude. Ce sont trois produits différents, pas trois emplois d'un même.
  if (totalPointsReseau){
    var teLigne = CATALOGUE.piecesReseau['te-taraude-25-34-25'];
    var coudeLigne = CATALOGUE.piecesReseau['coude-taraude-25-34'];
    var totalTesLigne = totalPointsReseau - totalRangeesReseau;
    if (totalTesLigne > 0) lignes.push({ ref:'te-taraude-25-34-25', nom: teLigne.nom, q: totalTesLigne, u:'u' });
    lignes.push({ ref:'coude-taraude-25-34', nom: coudeLigne.nom, q: totalRangeesReseau, u:'u' });
    if (totalJonctionsReseau > 0){
      var jonction = CATALOGUE.piecesReseau['te-25-25-25'];
      lignes.push({ ref:'te-25-25-25', nom: jonction.nom, q: totalJonctionsReseau, u:'u' });
    }
  }
  if (d.secteurs.length){
    // **Sa fiche de nourrice REMPLACE les lignes génériques**, quand elle
    // existe : électrovanne, regard, clarinette, programmateur — tout ce
    // qu'il a relevé dans le regard, avec les VRAIES références. Tant qu'elle
    // manque, les lignes génériques (source « provisoire ») tiennent la
    // place, comme avant.
    var fiche = CATALOGUE.ficheNourrice(d.secteurs.length, combienGoutteAGoutte(d));
    if (fiche){
      fiche.pieces.forEach(function(x){
        var p = CATALOGUE.piece(x.ref);
        if (!p) return;
        lignes.push({ ref:x.ref, nom:(p.marque ? p.marque + ' ' : '') + p.nom, q:x.q, u:'u' });
      });
    } else {
      lignes.push({ ref:'electrovanne', nom:'Électrovannes 24 V', q: d.secteurs.length, u:'u' });
      lignes.push({ ref:'regard', nom:'Regards de vannes', q: Math.ceil(d.secteurs.length/3), u:'u' });
      lignes.push({ nom:'Programmateur ' + voiesProgrammateur(d.secteurs.length) + ' voies', q:1, u:'u' });
    }
    // Pièces de tête de réseau, pas du regard : jamais dans une fiche de
    // nourrice, toujours présentes.
    //
    // **LE DISCONNECTEUR NE FIGURE PLUS — sa décision du 18 août :** *« le
    // disconnecteur, tu peux le supprimer à tout jamais, je n'en mets
    // jamais. »* La liste sert à commander ce qu'IL pose ; y laisser une pièce
    // qu'il écarte à chaque chantier, c'est lui faire décompter une ligne à
    // chaque commande. Ne pas le remettre « par prudence » : la question a été
    // posée et tranchée, et ce commentaire existe pour éviter qu'on la
    // rouvre.
    lignes.push({ ref:'reducteur', nom:'Réducteur de pression', q:1, u:'u' });
    if (etat.sonde) lignes.push({ ref:'sonde-pluie', nom:'Sonde de pluie', q:1, u:'u' });
  }
  return lignes;
}

/* Combien des voies de CE jardin alimentent une zone goutte-à-goutte : c'est
   ce qui décide de la fiche RÉELLEMENT posée (`CATALOGUE.ficheNourrice`). */
function combienGoutteAGoutte(d){
  return d.secteurs.filter(function(s){ return s.famille === 'Goutte-à-goutte'; }).length;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PORTE D'ENTRÉE DU CÔTÉ SERVEUR — ajoutée le 20 août 2026.

   Le calcul ci-dessus travaille sur un `etat` global : c'est ce qu'il fallait
   pour une page où chaque frappe recalcule tout. L'application, elle, appelle
   une fonction et reçoit un résultat.

   `calculerPlan` fait le pont, et rien de plus : elle POSE l'état, appelle le
   découpage et la liste de matériel qui existent déjà, et rend ce qu'ils
   rendent. **Aucune règle n'est réécrite ici** — c'est tout l'intérêt de
   reprendre ce fichier au lieu d'en écrire un second.

   Elle restaure l'état d'origine en sortant : deux appels de suite ne doivent
   pas se contaminer, et sur un serveur ils sont concurrents.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {{seau?:number, temps?:number, pression?:number, compteur?:string,
 *          marque?:string, corps?:string, sonde?:boolean,
 *          zones:Array<{id?:number,type:string,nom?:string,L?:number,l?:number,ml?:number}>,
 *          amenee?:number}} entree
 */
export function calculerPlan(entree) {
  const avant = etat;
  try {
    etat = {};
    Object.keys(DEFAUTS).forEach(function (k) { etat[k] = DEFAUTS[k]; });
    Object.keys(entree).forEach(function (k) { if (entree[k] !== undefined) etat[k] = entree[k]; });
    // Chaque zone a besoin d'un identifiant : c'est par lui que le découpage
    // dit quelle zone est sur quelle vanne.
    etat.zones = (entree.zones || []).map(function (z, i) {
      return Object.assign({}, z, { id: z.id !== undefined ? z.id : i + 1 });
    });

    const d = decouper();
    return {
      debitDisponible: debitDisponible(),
      secteurs: d.secteurs,
      demande: d.demande,
      limite: d.limite,
      reseauxDeZone: d.reseauxDeZone,
      voies: voiesProgrammateur(d.secteurs.length),
      couleurs: d.secteurs.map(function (_, i) { return couleurReseau(i); }),
      materiel: listeMateriel(d),
      amenee: amenee(d),
    };
  } finally {
    etat = avant;
  }
}

/** Les marques et les corps proposés — pour les menus de l'écran. */
export function optionsCatalogue() {
  return {
    marques: CATALOGUE.marques.filter(function (m) { return !m.cache; }),
    corps: CATALOGUE.corps,
  };
}
