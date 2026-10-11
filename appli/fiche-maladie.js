/*
  ═══════════════════════════════════════════════════════════════════════════
  LA BASE COMMUNE DES PLANCHES DE MALADIES — 22 septembre 2026
  ═══════════════════════════════════════════════════════════════════════════

  L'écran du diagnostic végétal, dans l'ordre qu'il a dicté le 22 septembre au
  soir : le nom, les parties atteintes, à quoi ça ressemble, est-ce grave pour
  l'arbre, que faire, comment le reconnaître, comment ça arrive, comment ça se
  propage. Tout le reste derrière « Voir les détails ».

  Ce fichier ne connaît AUCUNE maladie : il rend ce que la planche lui donne
  dans `window.FICHE_LOT`, qui est le futur fichier de donnees/phyto/fiches/.
  Ajouter une maladie n'y touche pas.
*/
(function(){
  "use strict";

  var pole = document.getElementById("pole");
  pole.addEventListener("click", function(){
    var nuit = document.body.classList.toggle("nuit");
    pole.setAttribute("aria-pressed", String(nuit));
    pole.textContent = nuit ? "Voir sur Origine" : "Voir sur Nuit";
  });

  // ── LE BROUILLON DE LA FICHE ──────────────────────────────────────────────
  // Chaque planche déclare son lot avant d'appeler ce fichier. C'est le JSON
  // qui sera versé dans donnees/phyto/fiches/ sur son oui, privé de ses champs
  // de notes, et jamais retapé à la main.
  var LOT = window.FICHE_LOT;
  var F = LOT.fiches[0];
  var SRC = LOT.sources[0];
  var IMG = F.images[0];

  // Ce que l'écran affiche : les mêmes constantes que src/lib/diagnostic-vegetal.ts
  var LIBELLE_GRAVITE = { faible: "Faible", vigilance: "Vigilance", importante: "Importante" };
  var MENTION_MECANIQUE = "Une photo ne permet pas de juger la solidité de l’arbre. Si sa stabilité est en question, faites-le examiner sur place.";
  var stabiliteEnJeu = F.impactMecanique === "avere" || F.impactMecanique === "possible" ||
    (F.impactMecanique === "inconnu" && F.gravite !== "faible");

  // Les parties du vocabulaire fermé, en mots : « les feuilles, les rameaux, le houppier »
  var PARTIES_AU_PLURIEL = { feuille: "les feuilles", aiguille: "les aiguilles", rameau: "les rameaux", branche: "les branches", tronc: "le tronc", ecorce: "l’écorce", collet: "le collet", racine: "les racines", fruit: "les fruits", fleur: "les fleurs", bourgeon: "les bourgeons", champignon_sur_bois: "les champignons sur le bois", houppier: "le houppier", ensemble: "l’arbre entier" };
  // « les feuilles, les rameaux et le houppier » : la dernière se lie par « et »,
  // jamais par une virgule de plus. Majuscule sur la première.
  function enListe(mots){
    var s = mots.length < 2 ? mots.join("") : mots.slice(0, -1).join(", ") + " et " + mots[mots.length - 1];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  function dateCitee(iso){ var p = iso.split("-"); return Number(p[2]) + " " + MOIS[Number(p[1]) - 1] + " " + p[0]; }
  function e(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function entete(){
    return '<div class="retour"><span class="rond">‹</span><span></span></div>' +
      '<div class="titre-ligne"><div><h2>'+e(F.nomCommun)+'</h2><p class="caps">Diagnostic végétal</p></div></div>';
  }
  // La photo se déduit du chemin que la fiche déclare : la planche pose à côté
  // d'elle le même fichier, préfixé « diagnostic- ». Écrire le nom en dur ici
  // faisait afficher la photo du peuplier sur toutes les fiches.
  function photos(){
    if (!IMG) return "";
    var nom = "diagnostic-" + IMG.fichier.split("/").pop();
    return '<div class="photos"><p class="caps gris">À quoi ça ressemble</p>' +
      '<p class="p petit" style="margin-top:6px">Une ressemblance n’est pas une preuve : ces photos servent à comparer, pas à confirmer.</p>' +
      '<figure style="margin:0"><img src="'+nom+'" alt="'+e(IMG.legende)+'">' +
      '<figcaption><span>'+e(IMG.legende)+' </span>'+e(IMG.credit)+', sous licence '+e(IMG.licence)+'.</figcaption></figure></div>';
  }
  // Ce que la SOURCE exige pour confirmer, et ce qu'il faudrait en plus de la
  // photo. Sa règle du 20 août 2026 : si la source demande un laboratoire,
  // Atlas n'affiche jamais « confirmé ». Sous « Que faire ? », dans un cadre,
  // jamais dans les détails : c'est ce qui empêche de traiter un arbre sur la
  // foi d'une photo.
  function confirmation(){
    if (!F.methodeConfirmation) return "";
    return '<div class="carte"><p class="caps gris" style="margin:0">Ce qui reste à confirmer</p>' +
      '<p style="margin-top:6px">'+e(F.methodeConfirmation)+'</p>' +
      (F.informationsRequises && F.informationsRequises.length
        ? '<ul class="puces" style="margin:8px 0 0;padding-left:18px">' +
          F.informationsRequises.map(function(v){ return '<li>'+e(v)+'</li>'; }).join("") + '</ul>'
        : "") + '</div>';
  }
  function bloc(cle, val, fort){
    return '<div class="bloc'+(fort?' fort':'')+'"><p class="caps gris">'+e(cle)+'</p><p class="val">'+e(val)+'</p></div>';
  }
  function listeBloc(cle, vals){
    if (!vals || vals.length === 0) return "";
    return '<div class="bloc"><p class="caps gris">'+e(cle)+'</p><ul class="val puces">' +
      vals.map(function(v){ return '<li>'+e(v)+'</li>'; }).join("") + '</ul></div>';
  }
  function ligne(cle, val){
    if (val === null || val === undefined || val === "") return "";
    return '<div class="ligne"><p class="caps gris">'+e(cle)+'</p><p>'+e(val)+'</p></div>';
  }
  function liste(cle, vals){
    if (!vals || vals.length === 0) return "";
    return '<div class="ligne"><p class="caps gris">'+e(cle)+'</p><ul>'+vals.map(function(v){ return '<li>'+e(v)+'</li>'; }).join("")+'</ul></div>';
  }
  function details(){
    return '<details class="det"><summary>Voir les détails</summary>' +
      ligne("Agent en cause", F.agentCausal) +
      ligne("Quand ça se voit", F.quandCaSeVoit) +
      ligne("Et les autres arbres du jardin ?", F.autresEssences) +
      liste("Ça pourrait aussi être", F.criteresExclusion) +
      liste("Ce qui le favorise", F.facteursFavorisants) +
      ligne("Prévention", F.prevention) +
      ligne("Traitement", F.traitement) +
      '<div class="ligne fiche"><p class="caps gris">La fiche</p>' +
      '<p>'+e(SRC.organisme)+', '+e(SRC.titre)+'. <span style="color:var(--gris)">Page consultée le '+e(dateCitee(SRC.consulteeLe))+'.</span></p>' +
      '<p class="pale">Fiche version '+F.version+', à jour au '+e(dateCitee(F.sourcesAJourLe))+'.</p></div>' +
      '<div class="ligne fiche"><p class="caps gris">Chantier</p><p>Rattacher à un chantier</p></div>' +
      '</details>';
  }

  document.getElementById("ecran").innerHTML =
    '<div class="ecran">' + entete() + '<div class="corps">' +
    bloc("Nom", F.nomCommun + ", " + F.nomScientifique + ".", true) +
    bloc("Parties atteintes", enListe(F.partiesAtteintes.map(function(p){ return PARTIES_AU_PLURIEL[p] || p; })) + ".") +
    '<p class="confiance" style="margin-top:20px">Probable sur '+e(LOT.taxons[0].article)+' '+e(LOT.taxons[0].nomCommun.toLowerCase())+'.</p>' +
    photos() +
    bloc("Est-ce grave pour l’arbre ?", F.graviteSelonLaSource) +
    bloc("Que faire ?", F.conduiteRecommandee, true) +
    confirmation() +
    listeBloc("Comment le reconnaître", F.criteresDiscriminants) +
    bloc("Comment ça arrive", F.commentCaArrive) +
    bloc("Comment ça se propage", F.gestion) +
    '<p class="source">Source : <b>'+e(SRC.organisme)+'</b>, page consultée le '+e(dateCitee(SRC.consulteeLe))+'.</p>' +
    (stabiliteEnJeu ? '<div class="carte"><p>'+e(MENTION_MECANIQUE)+'</p></div>' : '') +
    '<div class="boutons"><span class="btn plein">Nouvelle photo</span></div>' +
    details() +
    '</div></div>';
})();
