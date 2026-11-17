# La fiche du film

```text
GOAL:    un artisan qui fait défiler Instagram voit l'appli travailler dès la
         première image, comprend en trente secondes qu'il dicte et que le
         reste suit, et touche « Essayer 15 jours gratuits ».
OUTPUT:  HyperFrames, 1080 x 1920, 30 images par seconde.
TIME:    30,5 s x 30 = 915 images. Pas de musique ici : aucune grille de temps.
LOOK:    le monde du site de vente (appli/vente/chapitres-6.html), rien d'autre.
         Sols : sauge #e4ebda (dictée, devis, planning), sable #efe6d3 (le
         client), vert nuit #0e2a1b (facture, TVA, comptable, fin). Aplats.
         Encre #12261b sur clair, #f3efe3 sur nuit. Un accent, l'or (#95600f
         sur clair, #f0b43c sur nuit) : un mot par plan, et le bouton de fin.
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
SHOTS:   0,0 a 4,2    le micro   « Artisans, dictez vos devis. », le chrono,
                                la phrase dictée
         4,2 a 8,4    le devis   « Cause écrit le devis, avec vos prix. »,
                                la ligne, le total
         8,4 a 13,8   le client  « Votre client accepte sur son téléphone. »
         13,8 a 17,6  planning   « Le chantier se pose au planning. »
         17,6 a 21,1  facture    « La facture reprend le devis. »
         21,1 a 26,3  Terminés   « La TVA du mois, déjà calculée. », puis
                                « Pour votre comptable, tout est justifié. »
         26,3 a 30,5  fin        Cause, Le logiciel des artisans, l'essai
BANNED:  toute introduction avant le premier écran (sa demande du 17
         novembre), tout écran dessiné, tout bouton inventé, un doigt ou un
         anneau de clic (sa consigne du 6 novembre), un titre sur une capture
         assombrie, le logo dans un coin, lueurs et particules, trois cartes
         en rang, des tirets ou des points médians dans les phrases (sa règle).
QA:      0,0 s le titre et le micro ; 3,8 s la phrase entière, le chrono ;
         7,8 s 862,20 EUR ; 12,6 s « C'est noté » ; 15,2 s le lundi 16 rempli ;
         20,9 s 862,20 EUR sur la facture ; 22,8 s 143,70 EUR ; 24,3 s « Tout
         est justifié » ; 29 s le bouton de fin.
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
