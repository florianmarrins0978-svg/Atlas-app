# La fiche du film

```text
GOAL:    un artisan qui fait défiler Instagram se reconnaît dans la première
         seconde, comprend en quarante-cinq qu'il dicte et que le reste suit,
         et touche « Essayer 15 jours gratuits ».
OUTPUT:  HyperFrames, 1080 x 1920, 30 images par seconde.
TIME:    46 s x 30 = 1380 images. Pas de musique ici : aucune grille de temps.
LOOK:    le monde du site de vente (appli/vente/chapitres-6.html), rien d'autre.
         Sols : vert nuit #0e2a1b (accroche, corvées, Encaissez, fin),
         sauge #e4ebda (Dictez, Planifiez), sable #efe6d3 (Envoyez). Aplats.
         Encre #12261b sur clair, #f3efe3 sur nuit. Un accent : l'or
         (#95600f sur clair, #f0b43c sur nuit), au point des mots de chapitre,
         au mot « paperasse », au montant de la TVA et au bouton de fin.
         Titres : Instrument Serif 400, 150 a 190 px, interlettrage -1,5 %.
         Lignes : Hanken Grotesk 500, 56 px. La phrase dictée : Instrument
         Serif italique 60 px.
         Le médium : l'écran de l'appli, filmé. Téléphone de 897 px de large
         (2,3 fois l'écran réel), coque encre de 22 px, rayon 96 px, ombre
         portée 0 50 px 110 px à 26 %. Il monte du bas du cadre.
OBJECTS: le téléphone de l'artisan (sol sauge), celui du client (sol sable),
         les écrans réels de l'appli filmés par tournage/tourner.mjs.
MOTION:  arrivée expo.out, caméra power2.inOut, sortie power3.in.
         Un mot arrive en 4 images (flou 10 px vers 0), 2 images d'écart.
         Le téléphone monte en 18 images. Caméra : 15 images, puis elle tient.
SHOTS:   0,0 a 2,6   accroche   « Artisans, marre de la paperasse ? »
         2,4 a 8,6   corvées    trois lignes, barrées par « Atlas s'en occupe. »
         8,4 a 18,2  Dictez     accueil, fiche, micro et chrono, le devis, le total
         18,0 a 26,6 Envoyez    la date proposée, puis le téléphone du client
         26,4 a 31,6 Planifiez  « Devis accepté », le mois, la journée
         31,4 a 39,8 Encaissez  la facture reprend le devis, la TVA, le comptable
         39,6 a 46,0 fin        « Vous restez sur le chantier. », Atlas, l'essai
BANNED:  tout écran dessiné, tout bouton inventé, un doigt ou un anneau de
         clic (sa consigne du 6 novembre), un titre sur une capture assombrie,
         le logo dans un coin, lueurs et particules, trois cartes en rang,
         des tirets ou des points médians dans les phrases (sa règle).
QA:      0,0 s l'accroche est lisible ; 13 s le chrono tourne ; 17 s
         862,20 EUR ; 25 s « C'est noté » ; 30 s le lundi 16 rempli ;
         38 s 143,70 EUR et « Tout est justifié » ; 44 s le bouton de fin.
```

## Ce qui est vrai à l'écran, et d'où cela vient

- Chaque écran est l'appli du 16 novembre 2026, filmée image par image sur une
  base d'essai (tournage/). Aucun n'est redessiné.
- Sans clé d'IA dans le conteneur, la dictée ne rend pas les lignes du devis :
  le geste du micro est filmé pour de vrai, le devis est écrit à la main par
  les vrais champs. Sur son espace, l'IA écrit ces lignes.
- Les phrases reprennent celles du site de vente. « Pour votre comptable, tout
  est justifié. » recopie la carte de l'écran Terminés.
- 15 jours d'essai : `src/lib/abonnements.ts`.
