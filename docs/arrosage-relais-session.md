# Arrosage : le relais des sessions du 16 au 18 octobre 2026

À lire EN ENTIER, avant toute chose, par la session qui reprend. Tout ce qui
suit est dans le dépôt ; rien ne repose sur la conversation.

## OÙ ON S'EST ARRÊTÉ — 18 octobre 2026 au soir (à lire en premier)

La session du 18 octobre a fini pleine. Ce qui suit est l'état exact ; le
reste du document garde l'historique (lire les corrections comme elles sont
barrées ou annotées).

**Les planches en cours, celles qu'il regarde maintenant :**

| Planche | Lien | Ce qu'il attend / ce qu'on attend de lui |
|---|---|---|
| Le plan d'arrosage (`appli/arrosage-plan.html`) | https://claude.ai/artifact/5JivFEkQW2X7DpwoLnMzHB | C'est LA planche de l'écran à coder. Validé dessus : nourrice éclatée en tête, réseaux sur le plan (pointillé seulement sous le réseau qui l'emprunte, avec la raison), pièces de chaque réseau **posées sur le plan du jardin** (té égal sur le croisement, arroseur à gauche du trait et té taraudé à droite juste dessous), chaîne d'une tête « la B » (« + » vissé, double flèche autour du PEBD emboîté), pièces avec cadre sans fond blanc, liste par nourrice puis réseau, message au fournisseur modifiable (« réf. » seul), grillage avertisseur et sonde de pluie à cocher, couronnes 50 ou 100 m, « deux, en circuit fermé », aucune durée d'arrosage |
| Le plan au robinet (`appli/arrosage-plan-robinet.html`) | https://claude.ai/artifact/Bcdsm4bPC3KDZ5CDhYv5tX | Ses deux montages : nez de robinet SANS nourrice, ou nourrice avec le robinet pour départ. Double sortie proposée. Départ Ø16 (goutte-à-goutte seul), Ø25 ou Ø32 choisi par l'outil, modifiable. Le montage est éclaté sous « Le piquage », sur un axe. **À lui faire regarder** |
| Les pièces du robinet (`appli/arrosage-pieces-robinet.html`) | https://claude.ai/artifact/WwTin3f2Zvq42RiobvWErG | **Son oui ou non par pièce** : BRO3493, Solem BL-NR SP1151, Buddy AEV11401 / AEV11422, raccords femelles Plasson 16, 25, 32 x 3/4" (OPL70301620, OPL70302520, OPL70303220). Photos découpées du catalogue, hors outil tant que non validées |
| La nourrice éclatée | https://claude.ai/artifact/JEXjH6tjyFLQJKePMUEBZc | Validée, puis **corrigée par lui** : pièce 6 = DURA Manchon union 1" FF (ODU329010, SA photo `union-ff.jpg`), pièce 7 = raccord mâle Plasson 25 x 1" (OPL70202526). Vanne de purge retournée (vis en haut, poignée à gauche), « Arrivée d'eau » avec une flèche qui monte au PEHD, « R4 goutte-à-goutte » |

**Les questions ouvertes, à lui reposer telles quelles :**
1. Les pièces du robinet : oui ou non pour chacune (lien ci-dessus).
2. Plus de réseaux que de voies au programmateur en nez de robinet (le BL-NR n'a qu'une voie, le Buddy deux) : l'outil refuse le nez de robinet et garde la nourrice, ou il le propose en prévenant qu'il manque des voies ?
3. Les besoins en eau par saison (`SAISONS` dans `calcul.js`) n'ont aucune source de lui : a-t-il ses chiffres ? (on n'affiche plus de durée, mais le calcul s'en sert)
4. Les buses douteuses, qu'il vérifie lui-même (10SS / 35SS, PRECISION 15Q et 8F, PSU 17A, Maxi-Paw 06, Mini 8 buse 2,5) ; le tube Toro (fiche de SON tube 2 l/h 33 cm : pression mini, autorégulant ou non).
5. La planche de ses demandes du 16 octobre (https://claude.ai/artifact/Aw7JKKNFKZ7ggG9MERVWcj) : clavier iPhone corrigé (toucher ailleurs le referme), son avis général reste à venir.

**SES RÉPONSES, 18 octobre 2026, plus tard dans la soirée (session suivante) :**

| question | sa réponse |
|---|---|
| 1. pièces du robinet | « oui ». Les deux programmateurs en nez de robinet (Solem BL-NR SP1151, Buddy AEV11401 / AEV11422) : **bons**. La double sortie BRO3493 : photo grise refusée, puis **SA photo** (envoyée par lien, `appli/arrosage-robinet-photos/BRO3493.jpg`) avec le nom et la réf. Aqua Plus : *« pas besoin d'avoir 36 références, avec cette photo et le nom n'importe quel fournisseur sait de quoi on parle »*. **Validée ; les autres doubles sorties sont supprimées.** Les raccords Plasson 25 et 32 x 3/4" : validés |
| autres programmateurs | *« oui, tu peux me montrer d'autres marques sans référence Aqua Plus »*, puis **gardés** : Solem LR-NR (SP1152, Aqua Plus p. 26) et Rain Bird ZEH-TMR (1ZEHTMR, fiche truffaut.com). Les Gardena 1874 et 1889 et les Claber 8410 et 8488 sont **retirés** de la planche |
| le robinet sur le plan | sa règle : une **petite croix blanche et « robinet » à côté**, au lieu du rectangle (le trait à gauche retiré à sa demande), et la croix dans la légende des symboles. Le même signe sur un croquis se lit comme le piquage sur un robinet (`lire-croquis.ts`, consigne du modèle). Écrit dans `.claude/rules/arrosage.md` |
| le départ après le robinet | sa correction : *« le raccord Plasson à bague blanche ne fonctionne que pour du PE 25 ou 32 »*. Ø25 : raccord femelle 25 x 3/4" ; Ø32 : raccord femelle 32 x 3/4" ; **Ø16 rigide : PAS le Plasson OPL70301620, un autre raccord taraudé 3/4" pour du 16**. Proposé, à lui faire valider : **embout Palaplast taraudé 16 x 3/4", MID6362** (p. 49, déjà au catalogue) |
| 3. besoins en eau par saison | *« oui, on ne donne pas les durées d'arrosage ni les périodes à arroser »*. **Fait** : `SAISONS`, durées, passages, pluviométrie, heures de départ (`DEPART`, `LEVER`) retirés des deux copies du calcul, des instantanés `arrosage-plan-calcul.js` et `arrosage-schema-calcul.js` (reconstruits), de l'ancienne page `appli/arrosage.html` et de son essai `appli/tests/e2e.js`. Règle ajoutée dans `test-regles-du-patron.ts` (vue rouge sur l'ancien calcul). `arrosage-planche-calcul.js` (planche du 16 octobre) n'est pas reconstruit : elle n'affiche aucune durée |
| le départ en Ø16 | **souple** : embout Palaplast taraudé 16 x 3/4" MID6362, SA photo (neoverda.fr 1015-001). **rigide** : raccord à compression **Plasson** taraudé 16 x 3/4", tout noir, SA photo (arrosage-distribution.fr), `plasson-16-rigide.jpg`, sans référence. *« Je vais t'envoyer d'autres photos de la même gamme pour le 16 rigide : des tés et des manchons de réparation »* : reçus : manchon (PLA_1730), té égal (PLA_1732), té taraudé, coude, manchon fileté, mis sur fond blanc à sa demande, rangés avec leurs adresses dans `docs/arrosage-releve-photos/plasson-16-rigide/`, et posés sur la planche des pièces du robinet sous « La gamme Plasson du Ø16 rigide », chacun nommé « … à compression Plasson 16 rigide ». La photo à bague noircie et l'embout gris du revendeur sont **supprimés** (sa demande). **Entrées dans la liste des raccords** (*« on peut les rajouter à la liste de nos raccords, avec les photos »*) : `CATALOGUE.raccords16Rigide` (les deux copies), SANS référence (*« je ne sais pas si c'est ça la référence »*), noms à sa façon : « manchon à compression Plasson 16 x 16, pour 16 rigide », « té à compression Plasson 16 x 16 x 16 »…, photos dans `appli/arrosage-photos/plasson16-*`, « Réf. du fournisseur » à l'écran. Ajoutées à la liste « ajouter / changer une pièce » des planches plan, vue éclatée et robinet. Le filetage du té taraudé et du manchon fileté : **3/4"** (sa réponse). **Republiées le 18 octobre au soir** : le robinet, les pièces du robinet, le plan et la vue éclatée (ces deux-là avec les photos des raccords PE de l'autre session, qui n'étaient pas encore en ligne) |
| le pointillé du plan au robinet | *« il n'y a aucun endroit où il y a un pointillé »* : le robinet de l'exemple était posé à la place de la nourrice, un mètre hors de la pelouse ; son dessin cachait le pointillé d'un mètre que la phrase annonçait. Corrigé dans la planche : `ROBINET_POSE`, sur le bord de la pelouse |

**Et ensuite, le même soir** : (1) le texte du pointillé ne se met que sous le réseau dont le pointillé SE VOIT : un passage caché sous le rectangle de la nourrice (moins de 0,5 m dehors) n'a ni pointillé ni phrase (`liaisonsDuReseau`, plan et robinet) ; sur le jardin d'exemple, seul le Couloir garde sa phrase. (2) La **sonde de pluie** se coche juste au-dessus de la nourrice éclatée ; cochée, sa photo et son nom s'y montrent, et on la change ou la supprime comme une autre pièce (la liste de la nourrice la compte telle qu'elle est posée).

**Puis** : (3) le PEHD du goutte-à-goutte se pose sous le titre du réseau comme pour les autres, pas en travers du rail ; sa longueur reste « à mesurer » (le calcul ne trace pas la ligne d'un goutte-à-goutte). (4) « En pointillé, » est remplacé par de petits tirets noirs dessinés en tête de la phrase. (5) Le **grillage avertisseur** coché se montre avec une photo et ses rouleaux de 100 m, sans pouvoir se changer (il n'existe qu'en bleu). **Sa photo est trouvée par nous** (Bricomarché, grillage bleu eau potable 0,3 x 100 m, FITT : https://assets-big.cdn-mousquetaires.com/medias/domain11440/media4160/624916-8yurd7x654-large.jpg), `appli/arrosage-photos/grillage-bleu.jpg` : **à lui faire valider**.

**Encore** : (6) la case du grillage est sous celle de la sonde, au-dessus de la nourrice ; cochés, la sonde (à gauche) et le grillage (à droite) s'affichent sur une ligne. Au nez de robinet, sans nourrice, la case du grillage vient seule à sa place. (7) Le départ au robinet propose aussi **Ø16 souple**, qui prend l'embout Palaplast MID6362.

**Et** : (8) la phrase du grillage, à la source (`pieces.ts`), raccourcie à sa demande (« beaucoup trop longue ») : « Rouleau de 100 m. 83 m de tranchée au total. Les pointillés et le tuyau d'amenée ne sont pas mesurés. » (9) Le robinet en ligne montrait encore l'ancien embout gris pour le Ø16 souple : les planches publiées gardent leurs anciens fichiers tant qu'on ne les renvoie pas. Remplacé par SA photo. **Piège : après avoir changé une photo dans `appli/`, la renvoyer à CHAQUE planche qui l'emploie.**

**SA RÈGLE DU TÉ ÉGAL AU DÉPART (18 octobre au soir) — VALIDÉE (« oui, c'est exactement ça ») ET CODÉE** dans `plan-dessine.ts` (l'arrivée compte comme une branche au point d'entrée ; un losange par té égal), règle dans `test-regles-du-patron.ts`. Ses diamètres : 25x25x25 en Ø25, 32x32x32 en Ø32, té à compression Plasson Ø16 en 16 rigide, té Palaplast MID6321 en 16 souple (le calcul ne pose aujourd'hui que du Ø25 sur les réseaux : les autres diamètres serviront avec le Ø32 et le goutte-à-goutte au robinet). Historique : *« si on descend du robinet et qu'on a un réseau qui va à droite, à gauche, il nous faut un té égal 25x25x25 si on est en Ø25, sinon un té égal 16x16x16 à compression si on est en 16 rigide »*. Vérifié dans le calcul (`plan-dessine.ts`, degré des pieds) : le point d'entrée d'un réseau ne compte pas son arrivée, donc une ligne qui part dans deux sens n'a **aucun** té égal compté. Même défaut sur le plan à nourrice : Pelouse avant (+1) et Pelouse arrière (2 au lieu de 1). Planche pour qu'il le voie : `appli/arrosage-te-depart.html`, https://claude.ai/artifact/7XSwo4VmJr8hWK9cpDrxfe. La correction touche le calcul : **lui demander son oui**, et ce qu'il faut en Ø32 (té 32x32x32 ?) et en Ø16 souple. Fait sans attendre : au robinet, le Ø16 ne se propose plus quand il y a des arroseurs (*« ça sera forcément du 25 ou du 32 »*).

**À FAIRE, SA RÈGLE DU 18 OCTOBRE AU SOIR (pas codée)** : un passage en pointillés dont la distance se connaît (cotes entre les zones, plan à l'échelle, outil de dessin du plan) se CALCULE, entre dans le tuyau et la tranchée, et la phrase « Sa longueur doit être mesurée » ne s'affiche pas. Il faut d'abord que le calcul sache si les places des zones sont cotées ou seulement estimées sur le croquis (`lire-croquis.ts` rend des fractions estimées). Écrit dans `.claude/rules/arrosage.md`. Fait le même soir : la phrase finit par « Sa longueur doit être mesurée. ». Une AUTRE session a publié des mesures d'axes de la nourrice (HAUT / COLONNE) sur le plan au robinet sans les commiter ici : reportées dans `appli/arrosage-plan-robinet.html` ; le plan et la nourrice éclatée ne les ont pas, à voir avec elle.

**Et encore, le même soir** : (10) une case **Téflon** avec la sonde et le grillage : « téflon 12 mm le rouleau », Aqua Plus **BDV999** p. 34, 1 rouleau, qui se change ou se supprime ; il compte avec le départ. **Photo à lui faire valider** : Wikimedia Commons `PTFE_Rolls.png` (licence libre), recadrée, `appli/arrosage-photos/teflon.jpg`. (11) Sa demande : *« il faut que l'utilisateur puisse modifier ou supprimer toutes les pièces qu'on lui propose »*, sur TOUS les plans. Fait : les pièces du robinet (double sortie, programmateur, raccord, tuyau). Puis, même soir : les pièces de la nourrice se touchent par leur ligne de **légende numérotée** et dans le **bac « Avec la nourrice »** (clé `nr:<réf>`, `groupeNourrice` applique suppressions et changements) ; et un bouton **« Modifier ma liste »** au-dessus de l'envoi au fournisseur : chaque ligne de chaque groupe se supprime (barrée, « Remettre ») et chaque groupe reçoit « Ajouter une pièce » (`modifierLaListe`). Puis : la **chaîne d'une tête** (té ou coude, SBE 3/4", PEBD Ø16, SBE du haut, arroseur) se touche aussi, et change ou supprime la pièce sur toutes les têtes du réseau (`chaines`, gestes `*-chaine`) ; une pièce de nourrice en plusieurs exemplaires propose « Changer une seule pièce » / « Supprimer une seule pièce » (`nrUne`, la remplaçante entre dans la liste de la nourrice) ; une pièce changée montre la photo de sa remplaçante ; au robinet, grillage et téflon sont sous la double sortie. **PIÈGE PAYÉ** : une autre session a ajouté ~110 photos dans `PHOTOS` sans les envoyer aux planches en ligne, d'où les points d'interrogation bleus. Avant de republier, lister les fichiers de l'artifact (`scope: files`) et envoyer chaque photo que `PHOTOS` emploie et qui manque.

**SON IDÉE DU 18 OCTOBRE AU SOIR, DEUX PLANCHES FAITES, IL A CHOISI LA B (détail juste en dessous)** : *« au moment de faire la photo du plan, est-ce qu'on pourrait pas mettre un petit outil de création du plan ? Ça ouvrirait une page où il y aurait un carré déjà sélectionné, et l'utilisateur peut dessiner ses différentes zones et inclure ses métrés. Ce serait un plan en plus que tu comprendrais et qui serait facile pour toi. »* Une autre session s'en charge, sur une planche dans `appli/`, rien dans `src/app` avant son choix.

**Faites le 18 octobre au soir, deux planches à comparer :**

| | lien | fichier |
|---|---|---|
| A, au doigt : on trace la zone, puis on tape ses cotes (le dessin ordonne) | https://claude.ai/artifact/SW33SH1u9PgBm2r3hSreuC | `appli/arrosage-dessiner-plan-a.html` |
| B, à l'échelle : on tape les cotes, la zone se pose à sa taille, on la glisse | https://claude.ai/artifact/49tTsbNf3VGn3J1KagG9mT | `appli/arrosage-dessiner-plan-b.html` |

Le code commun : `appli/arrosage-dessiner-plan.js` et `.css` ; `appli/arrosage-dessin-calcul.js` est l'instantané esbuild de `etatDuCroquis`, `LIBELLES` et `longueurDeLAmenee` (aucune ligne réécrite). Ses réponses avant les planches : **rectangles, la haie en trait ; le terrain a ses métrés ; deux boutons au départ (photo ou dessin)**. L'outil rend exactement un `CroquisLu`, comme la photo, avec des fractions prises sur un carré dont le côté est le plus grand côté du terrain. Ce qui manque se dit avec `LIBELLES` ; l'amenée sort de `longueurDeLAmenee` (en A elle peut être refusée si le dessin n'est pas à l'échelle, en B jamais).

**Trouvé en les faisant, à lui dire avant de toucher au calcul :**
1. **Le massif** : je lui ai demandé « haie et massif en trait » en lisant `lire-croquis.ts` ; or le calcul (`calcul.js`, `TYPES.massif`, forme « nappe ») mesure le massif en **surface** (L × l), alors que la photo le rend en mètres linéaires (`lire-croquis.ts`, `L: lineaire ? null`, et `actions.ts` ligne 152). Un massif lu sur une photo arrive donc au calcul sans L ni l. Les planches traitent le massif en surface. Non corrigé.
2. **Une photo qui n'est pas carrée** : `echelleDuCroquis` mêle les estimations prises sur la largeur et sur la hauteur de l'image ; sur une photo en 4:3, une unité de fraction ne vaut pas les mêmes mètres dans les deux sens. Non corrigé, à regarder.

**SON CHOIX, le 18 octobre au soir :** *« je pense que le B est le mieux parce qu'il faut que ça soit à l'échelle. Et ensuite, il faut aussi pouvoir mettre la largeur de la haie, pas simplement la longueur. »* La A reste en planche, écartée. **Fait sur la B** (même lien, republiée) : la haie n'est plus un trait, c'est une bande longueur × largeur posée à l'échelle, et les deux cotes sont demandées. Sa longueur part au calcul en `ml`, comme avant ; sa largeur part dans un champ **neuf**, `largeur`, que ni `CroquisLu` ni `calcul.js` ne connaissent. **Question à lui poser avant de coder : à quoi la largeur sert dans le calcul ?** Aujourd'hui une haie reçoit une ou deux lignes à SON choix (`lignesHaie`), et une ligne arrose une bande de 1 m (`LARGEUR_ARROSEE_PAR_LIGNE`) : la largeur pourrait seulement se dessiner, ou proposer le nombre de lignes (il garde la décision). Rien dans `src/` avant sa réponse.

**SA RÉPONSE : « oui, la 2 »** : la largeur PROPOSE le nombre de lignes, il décide. Fait sur la B : jusqu'à 1 m de large, une ligne proposée, au delà deux ; « Une / Deux » à toucher dans la feuille, « Proposé : … » dessous ; le choix part en `lignesHaie` (le nom du calcul). Au delà de 2 m, l'écran dit « Deux lignes arrosent 2 m, … en fait 2,5 m. » (le calcul ne connaît qu'une ou deux lignes). **Attention** : `LARGEUR_ARROSEE_PAR_LIGNE` n'existe plus dans le code (parti avec les durées) ; la règle du mètre par ligne vit seulement ici, au relais. Rien dans `src/`.

~~« Une / Deux »~~ **corrigé par lui le même soir** : *« il ne faut pas forcément mettre une touche, une ou deux, parce que si le carré il est plus grand, peut-être qu'il en faudra 4, 5 »*. Désormais : une ligne par mètre de large, arrondi au-dessus (2,5 m : 3 lignes ; 4,5 m : 5), réglable par « − » et « + », sans plafond ; la phrase « Deux lignes arrosent 2 m » est retirée. **À changer dans le calcul quand on codera** : `calcul.js` ligne 1136 ne connaît que 1 ou 2 (`Number(z.lignesHaie) === 2 ? 2 : 1`).

**Sa remarque suivante** : *« je peux poser un carré de pelouse de 12 par 12 alors que mon cadre fait 10 par 10, il faut pouvoir bloquer ça »*. Fait sur la B (`cotesTropGrandes`) : une zone dont une cote dépasse celle du terrain ne se pose pas (« Ne tient pas dans le terrain, qui fait 10 × 10 m. », les champs en rouge) ; « Tourner » refuse aussi si la zone tournée ne tient plus ; et si le terrain rapetisse sous une zone posée, elle passe en pointillé rouge, « Pas de plan : … ne tient pas dans le terrain de … » et « Faire le plan » disparaît. **À garder quand on codera** : la même règle dans l'écran ET dans l'action serveur.

**LA LIMITE DES RECTANGLES, sa question du même soir** : *« si le terrain n'est pas vraiment carré ou rectangulaire, qu'il y a des zones un peu arrondies, comment on va faire ? »*, puis la photo d'un vrai plan fait main (M. et Mme Labrunye, Le Vésinet, « Échelle 2/100 ») : massifs en festons autour des arbres, ronds, courbes partout, la pelouse est ce qui reste. *« Si on doit reproduire tout ce qui est encadré en marron, dans l'outil c'est pas possible. »* **Il a raison**, et la photo a la même limite : `calcul.js` et `lire-croquis.ts` ne connaissent que des rectangles (L × l, `largeurFraction` × `hauteurFraction`). Le terrain, lui, n'est qu'un cadre : son rectangle englobant suffit. **Proposé, attend son oui** : (1) une planche où la photo du plan se pose en fond, l'échelle se donne (celle du plan ou une cote), et l'on suit les contours au doigt par des points qu'on peut courber ; un massif n'y donne que sa surface (le goutte-à-goutte se compte dessus), une pelouse son contour exact ; (2) ENSUITE, avec son accord, le calcul des pelouses en forme libre : têtes le long du bord réglées à l'angle, puis l'intérieur, et la couverture vérifiée point par point (80 à 100 %). Le (2) est le gros morceau et décide si l'outil sert aux vrais jardins.

**SA QUESTION SUIVANTE, le même soir** : *« est-ce qu'il y a un endroit pour dire, sur ce carré-là, je veux que ça soit des arroseurs, à cet endroit-là du goutte-à-goutte ? Même lorsque je prends une photo d'un croquis, comment je dis à l'outil… »* **Ce que le code fait aujourd'hui** (`calcul.js`, `materielDe`, `TYPES`) : le TYPE décide. Pelouse = arroseurs (turbines si le petit côté dépasse 4 m, tuyères sinon, ou forcé par la discussion : `consignes.ts`, `materiel` turbine / tuyère / auto) ; massif, potager, haie = goutte-à-goutte, toujours. Aucun moyen de mettre du goutte-à-goutte sur une pelouse ni des arroseurs dans un massif, ni sur la photo (le modèle ne lit que le type). ~~Proposition posée, attend sa réponse : un choix par zone dans l'outil, réglé d'office selon le type ; sur la photo, un mot écrit dans la zone.~~ **TRANCHÉ PAR LUI, refusé** : *« on va pas mettre d'arroseur dans un massif, et on mettra pas de goutte-à-goutte sur une pelouse »*. Le type décide, comme aujourd'hui : pelouse = arroseurs, massif, potager, haie = goutte-à-goutte. Rien à faire, ne pas le reproposer.

**ATTENTION : une autre session travaille dans CE MÊME dossier.** Elle a fait la
planche des photos de raccords PE (https://claude.ai/artifact/R3viQnoxAi7biZ6tD5syYS,
commits `9e9db77f`, `724d500e`, puis `941952ea` qui donne leurs photos validées aux raccords PE de la liste dans `arrosage-plan.html` et `arrosage-vue-eclatee.html`). Avant de toucher à ces fichiers, `git log` pour voir si elle a bougé, et ne jamais jeter son travail non commité : demander au patron.

**Côté `main`** : le lot part de `5e850cc1` ; `origin/main` était à `8d3c0c1d`
(15 commits de plus, rien d'arrosage vu) le 18 au soir. Le lot porte 116 commits,
**jamais poussés**, aucune batterie jouée.

## Où est le travail

| | |
|---|---|
| dossier | `C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus` (un worktree à part, chemins complets) |
| branche | `lot/catalogue-aquaplus-corrections`, **locale, jamais poussée** |
| base | `origin/main` à `5e850cc1` (vérifier avec `git fetch` qu'il n'a pas bougé) |
| aussi dedans | les branches de l'autre session arrosage, fusionnées avec son accord : `claude/tubes-arrosage-v2`, `claude/tuyeres-et-planche`, `claude/legende-bridee` |
| batterie | **aucune jouée**, à sa demande : *« une seule batterie pour toutes les corrections, à la fin »*, et on le prévient avant. Le lot est de niveau 3 (`npm run niveau`) |
| `main` | **rien n'y part sans son accord** |

Le PDF du fournisseur : `C:/Users/Flori/Desktop/Catalogue-Aquaplus-2026.pdf`
(texte page par page avec `pdfjs-dist`, déjà dans `node_modules`).

## LES PLANCHES, une par une (ce qu'il a validé ou doit regarder)

Les liens sont des pages privées claude.ai (Artifact). Chaque planche a son
fichier dans `appli/`. Pour republier une planche : retirer `<!doctype>`,
`<html>`, les deux `<meta>` du haut et `</body></html>`, remplacer
`<body data-charte="origine">` par `<script>document.body.dataset.charte = "origine";</script>`,
ajouter `<meta name="claude:viewport-fit-sides" content="cover">` sous le
`<title>`, puis publier avec ses fichiers (`arrosage-photos/…`,
`arrosage-schema-calcul.js`) et, depuis une autre conversation, l'`url`.

| Planche | Fichier | Lien | État |
|---|---|---|---|
| **La nourrice éclatée**, 1 à 6 voies, avec ou sans goutte-à-goutte | `appli/arrosage-nourrice-eclatee.html` | https://claude.ai/artifact/JEXjH6tjyFLQJKePMUEBZc (partagée par lien par lui) | **VALIDÉE** le 18 octobre (voir plus bas) |
| **La vue éclatée** du plan entier (amenée, regard, réseaux tête par tête) | `appli/arrosage-vue-eclatee.html` | https://claude.ai/artifact/LXfjCHKAbZUm78ncXpVqjn | gestes « changer / supprimer » et tuyère avec sa buse au pied **faits à sa demande** ; la nourrice validée doit y ENTRER (pas encore fait) |
| **Tuyères et buses** : chaque tuyère Rain Bird avec ses 13 buses à côté | `appli/arrosage-tuyeres-buses.html` | https://claude.ai/artifact/C35XhJEHKrXJNLxDQTRNrB | faite à sa demande, **à lui faire regarder** |
| **Photos des pièces** : valider ou refuser chaque photo | sources dans `docs/arrosage-releve-photos/` | https://claude.ai/artifact/66tzBpLozFXinZJnpNxNR3 (base `choix`) | **toutes tranchées** le 18 octobre : 98 « oui », 17 « non » (`choix-du-patron.json`, recopié de la base de la planche). Le mamelon Dura MM 1" retenu est le 08303 (photo 2), confirmé par sa photo du 18 octobre |
| **Photos des raccords PE** (« changer une pièce ») : une photo par FORME Plasson, prise EN 25 (sa demande du 18 octobre : « donne-moi la photo d'un manchon pour du 25 directement »), qui servira à tous ses diamètres ; 12 formes en 25 (`manifeste-raccords-pe-25.json`), 4 sans photo du 25 gardent la photo de gamme et le disent | `docs/arrosage-releve-photos/manifeste-raccords-pe.json`, `engendrer-planche-raccords-pe.mjs`, `modele-planche-raccords-pe.html` | https://claude.ai/artifact/R3viQnoxAi7biZ6tD5syYS (base `choix`) | **toutes tranchées** le 18 octobre : 18 « oui », 2 « non » (`choix-raccords-pe.json`). Entrées dans `PHOTOS` de `arrosage-plan.html` et `arrosage-vue-eclatee.html` par `entrer-photos-raccords-pe.mjs` : les 202 références de 16 à 63 ont leur photo (une par forme, la 1re validée), les 5 formes déjà validées comprises. Restent sans photo : la gamme Millenium (75 à 110). Hors liste : les 5 formes qui ont déjà sa photo validée (té égal 7040, té taraudé 7140, coude taraudé 7150, raccord mâle 7020, raccord femelle 7030) et la gamme Millenium 75 à 110. Ses choix faits : les recopier dans `choix-raccords-pe.json`, copier les photos retenues dans `appli/arrosage-photos/` |
| Ses demandes du 16 octobre (l'écran Plan d'arrosage) | `appli/arrosage-demandes-16-octobre.html` | https://claude.ai/artifact/Aw7JKKNFKZ7ggG9MERVWcj | **attend son avis** ; rien dans `src/app` avant |
| Le croquis de 350 m de goutte-à-goutte (3 vannes) | (artifact seul) | https://claude.ai/artifact/VukpwXTzLq8mSACriCvhZa | attend son accord sur le découpage |
| **Le plan d’arrosage** : l’écran rendu une fois mesures et croquis donnés (nourrice éclatée, réseaux sur le plan, pièces tête par tête, les mots du plan) | `appli/arrosage-plan.html` (calcul : `appli/arrosage-plan-calcul.js`, qui ajoute `dessinerPlan`) | https://claude.ai/artifact/5JivFEkQW2X7DpwoLnMzHB | faite le 18 octobre à sa demande, **à lui faire regarder**. C’est la planche de l’écran à coder |
| **Le plan au robinet** : ses deux montages (nez de robinet sans nourrice, ou nourrice), double sortie proposée, départ Ø16, Ø25 ou Ø32 | `appli/arrosage-plan-robinet.html` (engendrée depuis `arrosage-plan.html`) | https://claude.ai/artifact/Bcdsm4bPC3KDZ5CDhYv5tX | faite le 18 octobre, **à lui faire regarder** ; les pièces du robinet sont hors calcul tant qu'il ne les a pas validées |
| **Les pièces du robinet** : BRO3493, Solem BL-NR SP1151, Buddy AEV11401 et AEV11422, raccords Plasson 16, 25, 32 x 3/4" | `appli/arrosage-pieces-robinet.html`, photos découpées du catalogue dans `appli/arrosage-robinet-photos/` | https://claude.ai/artifact/WwTin3f2Zvq42RiobvWErG | **attend son oui ou non par pièce** ; question ouverte : plus de réseaux que de voies au nez de robinet |
| La pelouse de 20 × 12 (recouvrement, bridage) | (artifact seul) | https://claude.ai/artifact/L6obDjwoFG3xau3xYPaRXa | **tranchée** le 16 octobre : 80 à 100 %, bridage 40 %, 75 à 105 % si ça fait gagner des sous (`.claude/rules/arrosage.md`) |
| La tête bridée sur le plan | (artifact seul) | https://claude.ai/artifact/Et9YNGL38cyhJ6bBRRqiW8 | **« la B »** le 16 octobre : « bridée à 6 m » |

*Ces deux dernières manquaient au relais ; retrouvées le 18 octobre dans la liste des artifacts.*

`appli/essais.html` liste la vue éclatée, la nourrice éclatée et les tuyères.

## CE QU'IL A VALIDÉ (ne pas rouvrir)

**La nourrice éclatée, électrovannes MM** — *« parfait, c'est exactement ça ;
lorsqu'on est sur des électrovannes MM, c'est ce schéma-là »*, sur le montage
Dura qu'il a envoyé (`mon-irrigation.com/img/cms/Montage-clarinette-dura.png`),
*« sauf que lui a mis un bouchon à gauche »* :

| | de haut en bas |
|---|---|
| le haut | coude MF 1" à gauche, la clarinette (collecteur Dura), le coude **Dura FF 1"** à droite (*« en haut à droite, un coude femelle »*) : la clarinette est FERMÉE |
| l'arrivée, à gauche | mamelon réduit 1"x3/4" (retourné, le 1" en haut), vanne 3/4" FF, mamelon réduit (le 3/4" en haut), **union Dura MF 1"** (*« c'est MF, pas MM »*), raccord **Plasson femelle 25 x 3/4"** (*« les 8, c'est des 25 taraudés 3/4 »*), PEHD Ø25 |
| chaque voie | électrovanne 100 DV MM, union MF, raccord femelle Plasson 25 x 3/4", PEHD Ø25 ; **pas** de mamelon ni d'union entre la clarinette et l'électrovanne (*« tu peux les supprimer »*) |
| la numérotation | l'arrivée à gauche, puis voie 1, 2, 3… de gauche à droite |
| l'alignement | *« les taraudés en face des taraudés »* : chaque photo est tournée de l'angle exact qui met ses deux bouts de vissage l'un sous l'autre, posée sur l'axe de la sortie, un peu écartée |

**Les autres tailles** — *« tout ce que tu as fait est bon, je valide »* :
2 voies = té 1" MMF entre le coude MF et le coude FF ; 4 et 5 voies =
clarinettes 3 et 4 sorties ; 6 voies = clarinette 4 sorties puis le té MMF
avant le coude FF ; 1 voie = le coude MF vissé dans le coude FF.

**La voie de goutte-à-goutte** — *« c'est exactement ça »* : mamelon MM 1",
électrovanne 100 DV FF, mamelon réduit (1" en haut), régulateur FF 3/4",
mamelon réduit (3/4" en haut), puis union MF, raccord femelle, PEHD ; ces voies
sont les DERNIÈRES, à droite. La photo du régulateur (Rain Bird PSI) sert en
attendant les siennes (*« je vais essayer de t'en envoyer »*).

**Le catalogue, corrigé sur ses réponses** (les deux copies,
`src/lib/arrosage/catalogue.js` et `appli/arrosage-catalogue.js`, et les
maquettes qui les citaient) :

| avant | après |
|---|---|
| « Clarinette taraudée 1" pour 2, 3, 4 vannes » | « Collecteur M x F x 2, 3, 4 sorties 1" », Dura (Aqua Plus ODU3010102 à 104) ; la 2 sorties sert 3 voies, la 3 sorties 4, la 4 sorties 5 ou 6 (N sorties = N + 1 voies : *« c'est la fiche qui est bonne »*) |
| raccords PE en 25 « Dura » | **Plasson** (noirs à bague blanche) |
| « Programmateur BL-IP » | **Solem** BL-IP (boîtier tout blanc, sans écran) |
| « Union droite taraudée MM 1" » | « Union droite taraudée **MF** 1" » |
| « Coude 90° taraudé MM 1" » (clé `coude-mm`) | « Coude 1" FF », Dura (clé `coude-ff`, ODU306010), dans les 6 fiches |
| « Raccord mâle 25 1" » (clé `raccord-male25`) | « Raccord femelle 25 x 3/4" », Plasson (clé `raccord-femelle25`, OPL70302520), mêmes quantités, dans les 6 fiches |

**Le calcul du goutte-à-goutte** (`sortiesGoutte`, `couronnesDuTube`,
`calcul.js`, deux copies identiques — `scripts/verifier-arrosage-une-seule-source.mjs`) :

| | sa règle |
|---|---|
| sorties | une tous les 100 m au plus, et au moins une par vanne de la zone |
| raccords Ø25 | par vanne : un coude taraudé 25x3/4" par sortie, un té égal pour chaque sortie après la première |
| sur le coude | boucle : té Palaplast MID6321, aucun bouchon ; ligne seule : **coude Palaplast MID6341** (*« le coude »*) et un bouchon MID6371 ; té laissé ouvert : MID6321 et deux bouchons |
| le tube | Toro UGGCBL23050, compté en **couronnes de 50 m** (*« ça sera 50 m par 50 m »*), une **jonction MID6301** à chaque raccord de couronnes ; un bout de couronne finit une autre ligne sans raccord, jamais deux bouts recollés |
| la haie | une ligne arrose **50 cm de part et d'autre**, une bande de 1 m (`LARGEUR_ARROSEE_PAR_LIGNE`) ; la durée d'une haie se calcule |
| sans sa réponse « ligne ou boucle » | rien n'est compté, et le plan pose la question |

**Les photos** : seules les photos qu'il a validées entrent dans l'outil,
copiées dans `appli/arrosage-photos/<clé>.<ext>`. Une photo qu'il envoie
lui-même passe devant une photo trouvée. Il a envoyé : les deux électrovannes
(MM, FF), le PEHD Ø25/Ø32 (bandes bleues), le PEBD Ø16 rigide (redressé à
l'horizontale), le tube goutte-à-goutte (détouré sur fond blanc), le mamelon
Dura 1"x3/4", l'union MF. La connexion étanche est la **DBM**
(*« je n'utilise que ça »*). Les droits des photos : *« on s'en fiche »*.

**Les autres décisions de ces jours** : le coude SBE-050 se visse sous les
tuyères 1800 et la 3504, jamais sur la ligne ; le BL-IP est un Solem ; les
6 buses VAN et 6 R-VAN Rain Bird ont leur photo (13 buses) ; MP Rotator :
*« je pense comme les tuyères »* pour le débit (confirmé par la fiche Hunter).

## Ce qu'il doit encore trancher (ne pas inventer de réponse)

1. ~~**MP Rotator** : sur une même vanne, avec les VAN, avec les turbines, ou
   seules ?~~ **Tranché le 18 octobre** : *« les MP Rotator sont pour les
   tuyères »*. Elles vont avec les tuyères, jamais avec une turbine. Leur entrée
   au catalogue se fait avec les buses relevées (point 2).
2. **Les 141 buses relevées** (`docs/arrosage-releve-aquaplus/buses-a-trancher.json`) :
   les lettres d'angle Q, T, H, TT, TQ, F (**confirmées le 18 octobre** : Q 90°, T 120°, H 180°, TT 240°, TQ 270°, F 360°) ; les chiffres douteux, il va les vérifier lui-même (liste donnée le 18 octobre, plus 10SS et 35SS aux mêmes débits) ; **MPR+ 12T** : il a envoyé la fiche Toro MPR Plus (p. 22 et 23) le 18 octobre. 12-T = 120°, 0,72 GPM à 30 psi (2,1 bar), soit 0,16 m³/h, 0,64 GPM (0,15 m³/h) en version PC ; portée 12 pieds (3,7 m). Le 0,60 d'Aqua Plus est une coquille. **Son oui le 18 octobre : 0,16**, écrit dans le relevé ; six chiffres douteux (MPR+ 12T 0,60 ;
   PRECISION 15Q 0,089 et 8F 0,124 ; PSU 17A à 90° 0,41 ; Maxi-Paw 06 à 11,4 m ;
   Mini 8 buse 2,5 à 0,56).
3. ~~**Combien de turbines au plus par réseau**~~ : *« oui, reste comme ça »*
   (18 octobre). On ne touche à rien.
4. **Le tube Toro** (18 octobre : 2 l/h tous les 33 cm, déjà au catalogue ; la fiche qu'il a envoyée dit 2,2 ou 3,5 l/h, 31 ou 46 cm, intérieur 14,2 mm, bobine marron : ce n'est pas ce tube, et elle ne donne ni la pression mini ni « autorégulant ») : la fiche (pression mini, diamètre intérieur). Deux tubes
   Toro de 16 mm à 2 l/h existent (BlueLine Classic non autorégulant, BlueLine
   PC autorégulant de 0,69 à 4,14 bar), 14 mm de passage tous deux ; Aqua Plus dit
   « autorégulé ». Sans confirmation, la pression au bout des lignes n'est pas
   vérifiée et le plan le dit.
5. **Les photos à valider encore** (il les envoie, 18 octobre) : le raccord femelle Plasson 25 x 3/4"
   (photos de gamme, gravées 32 x 3/4) ; la 1812 n'a pas de photo validée ; ses
   photos du régulateur sont à venir.
6. La planche de ses demandes du 16 octobre (l'écran), et le croquis de 350 m.
   **Le croquis de 350 m est dépassé** : il compte des couronnes de 100 m, sa
   règle venue après dit 50 m. Il ne se lui redemande pas tel quel.

## Trouvé en faisant la planche du plan (18 octobre), à lui dire avant de toucher au calcul

| | |
|---|---|
| ~~SBE sous la 3504~~ **corrigé le 18 octobre avec son oui** (`pieces.ts` : le SBE du haut suit le filetage du corps au catalogue) | sa décision : le SBE-050 (1/2") se visse sous la 3504. `piecesDuPlan` compte encore le haut des turbines en SBE 075 (3/4") : 33 SBE 075 et 7 SBE 050 au lieu de 20 et 20 sur le jardin d’exemple |
| ~~coude du goutte-à-goutte~~ **corrigé le 18 octobre avec son oui** (`calculerPlan` rend `goutteAGoutte`, `piecesDuPlan` l’exige) | sa règle : un coude taraudé 25x3/4" par sortie. `piecesDuPlan` ne le compte pas (6 coudes au lieu de 7) |
| ~~numéro du goutte-à-goutte~~ | **corrigé le 18 octobre avec son oui** : le calcul numérotait les réseaux dans l’ordre du croquis, la nourrice met le goutte-à-goutte à droite. Le goutte-à-goutte est désormais numéroté en dernier dans `calcul.js` (deux copies), règle tenue dans `test-regles-du-patron.ts` |
| `verifier-maquette-arrosage-plan.mjs` | plante (`getAttribute` sur null), **déjà avant** la correction du 18 octobre : à regarder |
| clavier de l’iPhone | le pavé numérique n’a pas de touche OK : sur la planche de ses demandes, toucher ailleurs le referme (18 octobre). **L’écran de l’appli (`ArrosageClient.tsx`, `inputMode="decimal"`) aura besoin du même geste quand on le codera**, pas vérifiable ici |
| besoins en eau par saison | `SAISONS` dans `calcul.js` (gazon 25 mm par semaine en 3 passages en juillet et août, etc.) : posés par nous le 17 août 2026, **aucune source de lui**. Ils donnent les durées (« 83 min par arrosage »). Question posée le 18 octobre |
| coude taraudé sur le plan | **sa règle du 18 octobre** : un coude taraudé se dessine en ROND CREUX, sous une tuyère comme sous une turbine. Fait sur la planche du plan ; `PlanDessine.tsx` dessine encore un carré creux sous une tuyère, à changer quand on codera l’écran |
| cote coupée | sur le plan dessiné, la cote d’un massif qui touche le bord droit sort du cadre (« 2,4 r ») |

## CORRIGÉ PAR LUI le 18 octobre au soir : les pièces 6 et 7 de la nourrice

*« Je me suis trompé sur le montage. Le 6, c'est le même mais en femelle-femelle, et la pièce en dessous c'est un 25 x 1". »*
Partout où la nourrice les comptait (arrivée, chaque voie, voie de goutte-à-goutte) :

| | avant (validé le matin, ~~barré~~) | après |
|---|---|---|
| 6 | ~~union Dura MF 1" (ODU34MF)~~ | **DURA Manchon union 1" FF**, ODU329010 |
| 7 | ~~raccord femelle Plasson 25 x 3/4" (OPL70302520)~~ | **raccord mâle Plasson 25 x 1"**, OPL70202526 (clé `raccord-male25`) |

Les photos : le raccord mâle reprend `raccord-male25.jpg` (photo de gamme, validée) ; le manchon union FF a **sa photo à lui** (envoyée le 18 octobre, `appli/arrosage-photos/union-ff.jpg`), posée sur le même axe que l'ancienne union. Les tableaux plus haut qui citent l'union MF et le raccord femelle sont à lire avec cette correction.

## Ses décisions du 18 octobre, l'après-midi (planche du plan)

| | |
|---|---|
| grillage avertisseur | case à cocher en bas du plan ; quantité = tranchée + amenée, en rouleaux de 100 m (Aqua Plus p. 58), **sans référence** (« ils sauront ce que c'est ») ; `piecesDuPlan({ grillage })`, règle dans `test-regles-du-patron.ts` |
| couronnes | 50 m par défaut, 100 m au choix (`couronne` dans `calculerPlan`) ; en 100 m la ligne perd la référence Aqua Plus (`sansReference`), qui désigne la couronne de 50 m |
| les pièces | **B, avec cadre** : le blanc des photos se fond dans la vignette (`mix-blend-mode: multiply`) |
| le message | les références s'écrivent « réf. Aqua Plus … » pour un autre fournisseur |
| vanne de purge | retournée sur la nourrice : vis en haut, poignée à gauche |
| durées d'arrosage | **plus jamais à l'écran** (sa règle, écrite dans `.claude/rules/arrosage.md`) |
| cote coupée | corrigée à la racine : le cadre du plan (`plan-dessine.ts`) contient le texte des cotes ; contrôle dans `test-plan-dessine.ts` |
| pièces sur le plan | essai validé dans l'esprit (« j'aime bien ») : chaque tête porte son té ou coude et son arroseur à sa place, le té égal SUR le croisement avec la tête à côté, et sous le plan la chaîne d'une tête avec des « + » (té + SBE 3/4", PEBD Ø16 2 m, SBE 1/2" + arroseur), tuyère avec sa buse. Essai dans le scratchpad, pas encore dans la planche |
| la chaîne d'une tête | **« la B », validée** : « + » là où ça se visse (té ou coude taraudé + SBE 3/4", SBE 1/2" + arroseur), une **double flèche de chaque côté du PEBD Ø16** là où il s'emboîte |
| té égal sur le plan | **sur le croisement** ; juste dessous, l'arroseur à gauche du trait et le té taraudé à droite |
| **à faire, demandé** | (1) un exemple de piquage **sur un robinet** : proposer, sans l'imposer, une **double sortie** sous le robinet (une pour l'arrosage, une pour le client), un **programmateur en nez de robinet**, puis un départ en Ø25 ou en Ø16 rigide ; pièces et modèles à lui demander, rien à inventer. (2) les pièces de chaque réseau **posées sur le plan du jardin**, à leur place, au lieu d'une colonne : une capture d'abord |

## Ce qui reste à faire, dans cet ordre

1. ~~**Lui refaire le topo**~~ (fait le 18 octobre).
2. **Faire entrer la nourrice éclatée validée dans la vue éclatée** (la vue
   éclatée montre encore la nourrice en vrac, dans l'ordre de la fiche).
3. **Les lignes de réseau en Ø32** : aujourd'hui toutes en Ø25 dans le calcul.
   Sa règle : Ø32 quand le Ø25 ne tient pas la pression, puis une vanne de plus ;
   le choix 25/32 à la fin ; raccords en 32 (OPL71403220, OPL71503220,
   OPL704032, té réduit OPL73403225) dans `piecesAjoutables`. **Avant de
   modifier une règle ou un chiffre du calcul, lui en parler.**
4. **Importer le devis d'un fournisseur** (sa demande, `TODO.md`) : planche
   d'abord.
5. **L'écran** (`src/app`), seulement une fois les planches choisies : il suit
   `appli/arrosage-plan.html` (validée dans l'esprit le 18 octobre), puis le
   robinet une fois ses pièces validées. Le clavier numérique de l'iPhone doit
   se refermer en touchant ailleurs (`ArrosageClient.tsx`, `inputMode="decimal"`),
   et un coude taraudé se dessine en rond creux sous une tuyère aussi
   (`PlanDessine.tsx`). Codé pour de vrai,
   la place de chaque té et coude doit sortir du CALCUL, pas de l'écran.
6. **La batterie unique** (`npm run verifier:avant-livraison`, le prévenir
   avant), le document `docs/arrosage-catalogue-aquaplus.md` mis à jour, puis
   la poussée sur `main` **avec son accord**.

## Les pièges rencontrés (pour ne pas les repayer)

| | |
|---|---|
| fins de ligne | les fichiers sont en CRLF : un remplacement par script lit en LF puis réécrit en CRLF, sinon les deux copies du calcul divergent |
| le calcul des planches | `appli/arrosage-schema-calcul.js` est un **instantané** : après toute retouche du catalogue ou du calcul, le reconstruire avec esbuild depuis une entrée qui exporte `calculerPlan` (`src/lib/arrosage/calcul.js`), `piecesDuPlan` (`pieces.ts`), `debitRetenu` (`mesure-debit.ts`) et `CATALOGUE` (`catalogue.js`) : `npx esbuild entree.ts --bundle --format=iife --global-name=CALCUL --outfile=appli/arrosage-schema-calcul.js` |
| les guillemets | dans Bash, un texte entre `"…"` qui contient des accents graves exécute leur contenu : écrire les longs textes avec l'outil d'écriture ou une heredoc `<<'FIN'` |
| les photos en local | un `<canvas>` refuse de lire une image ouverte en `file://` : lancer Chromium avec `--allow-file-access-from-files` pour regarder une planche |
| les recherches de photos | un agent en arrière-plan les télécharge dans un dossier temporaire ; les garder dans `docs/arrosage-releve-photos/manifeste.json` (adresse d'origine de chaque photo) |
| `rm` sur une variable | refusé par la sécurité : écrire `"${VAR:?}/…"` ou le chemin en entier |

Ses règles changées se barrent dans `scripts/test-regles-du-patron.ts`
(27 tenues), jamais réécrites. Contrôles verts à la fin de la session : calcul,
règles, catalogue, plan dessiné, une seule source, les quatre maquettes
d'arrosage, tirets, flèches, pansements, code mort, couches, types.

## Ce qu'il ne faut pas faire

- Inventer un chiffre, une référence, un prix, un ordre de montage. Une valeur
  absente reste absente ; une proposition se dit comme telle.
- Recopier un prix du PDF (ce sont des prix clients).
- Réécrire une règle de `test-regles-du-patron.ts` : on barre, on ajoute.
- Lancer une batterie ou pousser sans lui demander.
- Toucher `src/app` avant qu'il ait choisi la planche.
- Tuer un processus par son nom : `Stop-Process -Id <pid>` seulement.

## Les photos des autres pièces (18 octobre 2026)

Sa demande : chercher les photos de toutes les pièces de la liste qui n'en ont pas, et « ne pas montrer des photos de 32 pour du 25 ou inversement ».

| | |
|---|---|
| déjà entrées, sans recherche | 20 pièces de la liste qui sont les pièces de nourrice déjà validées (même référence Aqua Plus) : `entrer-photos-par-reference.mjs` |
| la planche | https://claude.ai/artifact/K7Gc7XTXHB7hSrqcevwa8r (base `choix`), 186 photos, quatre lots : polypro, colliers, robinetterie, tubes ; électrovannes, regards, accessoires d'arroseur ; goutte-à-goutte, électricité ; programmateurs et accessoires |
| ses sources | `docs/arrosage-releve-photos/autres-pieces/` : la consigne donnée aux recherches, les pièces et le manifeste de chaque lot, le générateur |
| écartées par nous | une photo qui montre une autre pièce, un autre modèle ou une autre taille (liste `ECARTEES` et `DESSINS` du générateur) |
| pas cherchées | la gamme Millenium (raccords PE 75 à 110) |
| **état** | **tranché le 18 octobre** : 129 « oui », 1 « non » (`choix-autres-pieces.json`). Les photos validées sont dans `PHOTOS` des planches. Sa règle : *« tout ce que je n'ai pas validé, ce sont les pièces que je ne veux pas garder, on peut les supprimer définitivement »*, sauf les vannes, le PEHD NF, la couronne de 16, les électrovannes, la rehausse de regard et le goutte-à-goutte Ø6. **164 lignes retirées** des deux copies du catalogue et des trois instantanés (`retirees.json`) ; il en reste 545. **UPE225 et UPE232, les tubes PEHD irrigation Ø25 et Ø32, restent** : *« tu les supprimes pas, je vais t'envoyer les photos »* (18 octobre). Leur photo est la sienne, donnée le 18 octobre (media.denismateriaux.com, DEN_483, couronne Polybleu NF 25x3), posée sur fond blanc par `detourer-couronne.mjs` : `pehd-couronne.jpg`, *« tu peux utiliser la même photo pour le diamètre 32 »*. Les couronnes PEBD Ø16 (UPE1116, UPE500600) ont aussi la sienne : `pebd-couronne-16.jpg` (media.adeo.com, déjà sur fond blanc), *« diam 16 »* |
