# La fiche du film

```text
GOAL:    un artisan qui fait défiler Instagram se reconnaît dans la première
         seconde, voit l'appli travailler dès la deuxième, comprend en
         trente-six qu'il dicte et que le reste suit, et touche « Essayer 15
         jours gratuits ».
OUTPUT:  HyperFrames, 1080 x 1920, 30 images par seconde.
TIME:    35,75 s x 30 = 1073 images. Pas de musique ici : aucune grille de temps.
LOOK:    le monde du site de vente (appli/vente/chapitres-6.html), rien d'autre.
         Sols : vert nuit #0e2a1b (accroche, facture, TVA, comptable, fin),
         sauge #e4ebda (accueil, dictée, devis, planning), sable #efe6d3 (le
         client). Aplats.
         Encre #12261b sur clair, #f3efe3 sur nuit. Un accent, l'or (#95600f
         sur clair, #f0b43c sur nuit) : un mot par plan, et le bouton de fin.
         Accroche : Instrument Serif 400, 196 px, trois lignes.
         Phrases : Instrument Serif 400, 118 px, interlettrage -1,5 %, deux
         lignes. La phrase dictée : Instrument Serif italique 66 px.
         Le médium : l'écran de l'appli, filmé. Téléphone de 870 px de large à
         l'écran (2,23 fois l'écran réel), coque encre de 22 px, rayon 100 px,
         ombre portée 0 50 px 110 px à 26 %. Il monte du bas du cadre.
OBJECTS: le téléphone de l'artisan (coque encre), celui du client (coque
         claire, sol sable), les écrans réels filmés par tournage/tourner.mjs.
MOTION:  arrivée expo.out, caméra power2.inOut, sortie power3.in.
         Une ligne arrive en 5 images (flou 12 px vers 0), 3 images d'écart.
         Caméra : 13 à 16 images, puis elle tient pendant que l'appli agit.
SHOTS:   0,0 a 1,6    accroche   « Artisans, marre de la paperasse ? »,
                                 entière en un quart de seconde
         1,6 a 5,7    l'accueil  « Dictez vos devis, sur le chantier. »,
                                 Créer un devis, la fiche client qui monte
         5,7 a 9,3    le micro   le chrono, la phrase dictée
         9,3 a 13,65  le devis   « Cause écrit le devis, avec vos prix. »,
                                 la ligne, le total
         13,65 a 19,05 le client « Votre client accepte sur son téléphone. »
         19,05 a 22,85 planning  « Le chantier se pose au planning. »
         22,85 a 26,35 facture   « La facture reprend le devis. »
         26,35 a 31,55 Terminés  « La TVA du mois, déjà calculée. », puis
                                 « Pour votre comptable, tout est justifié. »
         31,55 a 35,75 fin       Cause, Le logiciel des artisans, l'essai
BANNED:  une introduction de plus de deux secondes avant le premier écran
         (ses demandes du 17 novembre), tout écran dessiné, tout bouton
         inventé, un doigt ou un anneau de clic (sa consigne du 6 novembre),
         un titre sur une capture assombrie, le logo dans un coin, lueurs et
         particules, trois cartes en rang, des tirets ou des points médians
         dans les phrases (sa règle).
QA:      0,5 s l'accroche entière ; 2,4 s l'accueil et son titre ; 3,25 s
         le + de Créer un devis qui tourne ; 4,75 s la fiche remplie ; 8,4 s
         la phrase entière, le chrono ; 12,6 s 862,20 EUR ; 17,8 s « C'est
         noté » ; 20,5 s le lundi 16 rempli ; 26,1 s 862,20 EUR sur la
         facture ; 28,1 s 143,70 EUR ; 29,6 s « Tout est justifié » ; 34,5 s
         le bouton de fin.
```

## Ce qui est vrai à l'écran, et d'où cela vient

- Chaque écran est l'appli du 16 novembre 2026, filmée image par image sur une
  base d'essai (tournage/). Aucun n'est redessiné.
- Sans clé d'IA dans le conteneur, la dictée ne rend pas les lignes du devis :
  le geste du micro est filmé pour de vrai, le devis est écrit à la main par
  les vrais champs. Sur son espace, l'IA écrit ces lignes.
- Les phrases reprennent celles du site de vente. « Pour votre comptable, tout
  est justifié. » recopie la carte de l'écran Terminés.
- Le nom : Cause, sa décision du 17 novembre 2026. Aucun écran filmé ne porte
  l'ancien nom.
- 15 jours d'essai : `src/lib/abonnements.ts`.
