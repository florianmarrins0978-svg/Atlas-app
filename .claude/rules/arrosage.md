---
paths:
  - "**/*arrosage*"
  - "**/arrosage/**"
  - "src/server/ai/services/lire-croquis.ts"
  - "scripts/test-regles-du-patron.ts"
---

# L'arrosage : ses règles, mot pour mot

*Sorties de `CLAUDE.md` le 16 octobre 2026, sans une ligne changée. Ce fichier
se charge tout seul dès qu'une session lit ou modifie un fichier d'arrosage
(`src/lib/arrosage/`, `src/app/paysage/arrosage/`, `appli/arrosage-*`, la
lecture du croquis, `test-regles-du-patron.ts`). Une question d'arrosage
posée sans fichier ouvert : le lire d'abord.*

## 4 ter. L'ARROSAGE N'A PAS LE DROIT À L'ERREUR

**Sa consigne du 22 août 2026, et elle prime sur l'envie de livrer :** *« cet
outil n'a pas le droit à l'erreur, parce qu'énormément d'utilisateurs vont s'en
servir. Si jamais il se trompe dans les calculs et que les réseaux d'arrosage ne
se lèvent pas, moi je vais être dans la merde. »*

**Ce que cela change concrètement.** Ailleurs dans ce produit, une erreur se
corrige : un devis se rectifie, une facture s'annule, un planning se déplace. Un
réseau d'arrosage est **enterré**. Le défaut ne se voit qu'en juillet, sur un
gazon jauni, chez un client qui a déjà payé — et c'est le paysagiste qui rouvre
la tranchée à ses frais.

**Trois règles qui en découlent, et qui ne se négocient pas :**

1. **Aucune valeur d'arrosage ne se devine.** Un chiffre sans source relevée ne
   rentre pas dans le calcul : il se demande, ou le calcul refuse de conclure.
   « Plausible » n'est pas une source.
2. **Se tromper vers le SÛR — et le sûr, c'est MOINS D'ARROSEURS PAR RÉSEAU.**

   **Cette règle a d'abord été écrite à l'envers, et c'est lui qui l'a
   redressée le 22 août 2026 :** *« un arroseur de trop fait que le réseau ne
   peut pas se lever ! »* Elle disait « retenir l'hypothèse qui pose un
   arroseur de plus » — une formule qui, appliquée à un RÉSEAU, produit
   exactement la panne qu'elle prétend éviter : une tête de plus sur une vanne,
   c'est du débit en plus sur la même conduite, donc de la pression en moins,
   donc des turbines qui sortent à moitié.

   La bonne formulation, et il n'y en a qu'une :

   | Devant un doute | Ce qu'on retient |
   |---|---|
   | combien d'arroseurs sur **une vanne** | **le moins**, quitte à ouvrir une vanne de plus |
   | combien de **réseaux** | **le plus** |
   | une perte de charge inconnue | **la plus forte** |
   | une portée inconnue | **la plus courte** |

   Une vanne de plus coûte une électrovanne et une voie de programmateur. Un
   réseau qui ne se lève pas coûte le chantier.

   **ET CETTE PRUDENCE NE S'APPLIQUE QU'AUX INCONNUES.** Sa précision du
   22 août, dans la foulée : *« faut pas pour autant qu'il retire un arroseur,
   il faut qu'il me calcule le nombre juste »*.

   | | |
   |---|---|
   | ce qui se **calcule** — la couverture d'une zone, le débit d'une buse, les pertes | **exact**, sans marge ajoutée |
   | ce qu'on **ignore** — une valeur non relevée, une longueur non saisie | prudent, dans le sens ci-dessus |

   Retirer un arroseur « pour être tranquille » n'est pas de la prudence : c'est
   un trou d'arrosage, et il se voit en juillet exactement comme la panne qu'on
   voulait éviter. La marge se prend sur ce qu'on ne sait pas, jamais sur ce
   qu'on sait.
3. **Ce qui n'est pas calculé se DIT à l'écran.** Pas dans le dépôt, pas dans un
   commentaire : sous le plan, là où il le lit. Une réserve tue vaut un mensonge
   — parce qu'un plan silencieux est cru complet.

**Et l'inverse est vrai aussi :** un avertissement qui parle à tort s'apprend à
être ignoré, et l'on perd le garde-fou sans s'en apercevoir. Une réserve se pose
là où le calcul est réellement muet, nulle part ailleurs.

## 4 bis. Tout schéma d'arrosage obéit à sa planche du 17 août

**SANS CROQUIS COMPLET, AUCUN PLAN.** Sa règle du 21 août 2026, et elle passe
avant tout le reste de cette section : *« l'outil doit fonctionner avec un plan
avec toutes les métrés, l'emplacement du piquage et l'endroit définitif de la
nourrice — sans ça il ne doit rien proposer »*.

Trois éléments, tous obligatoires :

| | Sans lui |
|---|---|
| **les métrés** | on ne sait pas combien d'arroseurs, ni où |
| **le piquage** | on ne sait pas quel débit, ni s'il faut couper une ligne |
| **l'endroit DÉFINITIF de la nourrice** | on ne sait ni d'où partent les lignes, ni où creuser |

Il en manque un : on **retire** le plan et l'on dit lequel manque. On ne le grise
pas — un plan affiché en pâle se photographie et se pose quand même.

**LA NOURRICE SE PLACE PAR LUI, JAMAIS PAR L'OUTIL.** Sa règle du 21 août :
*« c'est l'utilisateur qui placera la nourrice où il veut »*. Elle n'est ni
calculée, ni déduite, ni proposée d'office : elle est **lue** sur le croquis.
L'IA qui lit la photo la cherche ; si elle ne la trouve pas, elle refuse et le
dit — elle ne la pose pas au piquage « pour dépanner ».

Ce n'est pas une question de politesse : l'endroit du regard dépend de ce que
lui seul sait — un point d'eau existant, un passage de voiture, un massif qu'on
ne rouvre pas, l'accès pour l'hivernage. Un outil qui le placerait ferait creuser
au mauvais endroit, et une tranchée ne se déplace pas.

**Informer n'est pas proposer.** S'il demande ce que change tel ou tel
emplacement, on répond avec des chiffres — l'amenée s'allonge, les lignes
raccourcissent. On ne dit jamais où le mettre.

**LA DISCUSSION POSE UN PARAMÈTRE, ELLE NE DESSINE JAMAIS.** Sa demande du
21 août, codée le 23. Ce qui sort d'un message est **une consigne** prise dans
une liste fermée — marque, corps, matériel d'une zone, buse d'une zone, sonde —
et c'est le calcul qui refait le plan. Un plan retouché à la main ne se
recalcule plus.

Deux bornes qu'il a posées : **la discussion ne crée jamais un plan** (le fil ne
s'affiche qu'avec un plan déjà calculé), et **aucune phrase pré-écrite** (un
champ libre, rien d'autre).

**LE MOINS DE VANNES D'ABORD, LE MOINS D'ARROSEURS ENSUITE — sa colère du
23 août 2026 :** *« cinq réseaux pour ça ??????? »*, devant 208 m² de pelouse.
On ne choisit plus la plus grande buse qui pave : on choisit celle qui demande
le moins de vannes, et l'on départage sur le nombre d'arroseurs. Neuf arroseurs
se posent une fois ; une vanne coûte une électrovanne, une station de
programmateur, sa tranchée et son créneau d'arrosage.

**Et le quinconce ne se resserre JAMAIS sous la portée** — sa règle du 17 août.
Quand le damier ne couvre pas à cet écart-là, on garde la grille alignée. Le
resserrement sans plancher disqualifiait la seule pose qui tenait sur une vanne.
**La portée se mesure ENTRE DEUX TÊTES, pas sur le pas des colonnes** (corrigé
le 11 septembre 2026) : sur un damier, deux têtes voisines sont à deux pas sur
un même bord, ou en diagonale — mesurer le pas refusait son couloir de 10 × 2 à
sept tuyères (§127), et c'est ainsi que sa règle du 18 août était morte.

**LE DAMIER EST POUR LES TUYÈRES DES COULOIRS ; LES TURBINES SE POSENT
ALIGNÉES — « la A », sa réponse du 11 septembre 2026** devant la planche
`appli/arrosage-a-trancher.html` qui lui montrait les deux poses calculées sur
son 12 × 12 : neuf turbines alignées, ou six en damier (où le recouvrement
entre deux têtes voisines tombe à 72 %). Il a gardé ses neuf. Ne pas rouvrir :
`test-regles-du-patron.ts` tient les deux.

**UN CROQUIS À MAIN LEVÉE SE LIT QUAND MÊME — sa correction du 23 août 2026 :**
*« les utilisateurs ne vont pas s'amuser à faire des croquis à l'échelle à
chaque fois ; là, il y a tous les métrés »*. **Les cotes commandent, le dessin
ne fait qu'ordonner.** Ne jamais refuser un plan parce que le dessin n'est pas
proportionné : le placer d'après ses cotes et le DIRE en réserve.

La sévérité reste sur le **trajet du regard** — lui entre dans le calcul de
pression, et un chiffre faux y coûte un plan faux. Une pelouse placée de travers
se voit à l'œil ; une pression fausse ne se voit qu'en juillet.

**DÉDUIRE UNE COTE N'EST PAS LA DEVINER — sa demande du 21 octobre 2026 :**
*« si le jardin fait 10 mètres, que la bande de goutte à goutte fait la même
taille que le jardin, bah forcément, la bande de goutte à goutte fait 10
mètres. L'idée d'avoir mis l'IA dans l'application, c'est qu'elle soit en
mesure de comprendre ça. »* Et : *« si j'écris à l'envers, elle doit être en
mesure de comprendre »*. La lecture retourne chaque chiffre, additionne les
cotes écrites bout à bout, et déduit d'une cote ÉCRITE (bord commun, côté
opposé, somme ou différence). Jamais des proportions du dessin. Une cote
déduite dit d'où elle vient, sinon elle est refusée ; elle se montre en
réserve sous le plan, où « Modifier » la corrige. La règle 1 (« aucune valeur
ne se devine ») tient : une déduction a une source, une devinette n'en a pas.

**Et l'agencement n'est pas l'un des trois éléments obligatoires.** Métrés,
piquage, nourrice : ceux-là retirent le plan. Un agencement illisible ne retire
que le DESSIN — le plan sort, et l'on dit pourquoi il n'est pas dessiné.

**LA PLUVIOMÉTRIE NE SÉPARE PAS DEUX VANNES — sa décision du 23 août 2026 :**
*« ne prends pas en compte la pluviométrie »*. Elle était dans la clé de secteur
depuis le 17 août, mise par lui (« ça ne se mélange jamais ») ; il l'a retirée le
23. **Ne pas la remettre** : deux turbines de buses différentes partagent
désormais une vanne, avec des millimètres/heure différents pour une même durée
d'ouverture, et c'est lui qui arbitre à l'arrosage.

**Ce qui sépare, en revanche, c'est le MATÉRIEL.** Une turbine et une tuyère ne
s'ouvrent jamais ensemble : l'une verse environ trois fois plus vite. Cette
règle-là n'a pas bougé.

**LES PIÈCES SE COMPTENT EN « 13x », PAS EN « 13 u »** — même jour. L'unité reste
dans les données : elle distingue une pièce qu'on compte d'un tuyau qu'on mesure,
et « 80x de PE Ø25 » ne se commande pas. Une seule fonction l'écrit
(`quantiteEcrite`), pour l'application comme pour la page publiée.

**L'AVERTISSEMENT SE LIT AVANT DE PHOTOGRAPHIER**, en gras, **au-dessus** du
croquis : *« votre croquis doit impérativement contenir les métrés, l'endroit
définitif de la nourrice, et l'endroit où le piquage se fait »*. Placé en
dessous, il se lirait après l'envoi d'une photo incomplète — donc trop tard, et
il faudrait retourner au jardin.

**PAS DE PHRASES PRÉ-ÉCRITES DANS L'APPLICATION.** Sa remarque du 21 août :
*« il ne faut pas mettre les phrases pré-écrites, mais il faut un endroit où on
puisse discuter avec toi »*. Un champ libre, rien d'autre. Des suggestions
toutes faites bornent ce qu'on ose demander — et ce qu'il a à dire ne tient
jamais dans trois boutons. Elles n'existent dans les maquettes que parce
qu'aucune ne porte de JavaScript, et cela doit s'y **écrire** pour qu'on ne les
recopie pas en codant.

**ET LA DISCUSSION NE CRÉE JAMAIS UN PLAN.** *« Elle peut seulement modifier, ou
recréer si un croquis avec tous les bons éléments aux bons endroits a été
fourni. »* C'est la tentation exacte d'une conversation : on répond en comblant
ce qui manque, parce qu'une phrase se complète plus facilement qu'un dessin. Un
plan tracé sur une nourrice supposée fait creuser au mauvais endroit — et une
tranchée ne se déplace pas.

**Un manquement à noter, du 21 août :** le plan de son jardin a été tracé avec
une nourrice que J'AI placée, son croquis ne la portant pas. Il aurait dû être
refusé.



Règle posée le 21 août 2026, et qu'il veut **valable partout** : *« sers-t'en
pour tous les schémas, il fonctionnera partout, ça doit être la règle »*.

**Tout part de la nourrice.** *« Règle indiscutable ! »* Un plan où l'on voit le
compteur et des traits qui commencent dans le vide n'est pas un plan : il ne se
pose pas sur le terrain. La nourrice se **dessine**, avec ses vannes, et chaque
ligne en part.

**LE DÉBIT D'UNE TURBINE NE DÉPEND PAS DE SON ARC.** Sa règle du 21 août :
*« les débits à 360° sont les mêmes qu'à 180° et 90° »*. Le jet est un seul
filet qui balaie l'arc réglé — il sort autant d'eau par seconde sur un quart de
cercle que sur le tour entier ; seule la durée passée sur chaque point change.
Un arroseur de coin consomme donc **autant** qu'un plein cercle.

**C'est l'inverse de ce que le dépôt supposait**, et c'est pourquoi il ne l'avait
pas déduit. La déduction plausible — « deux fois moins d'angle, deux fois moins
d'eau » — aurait divisé par quatre le débit d'un coin, et fait poser quatre fois
trop d'arroseurs sur une même voie.

**Et cela ne vaut QUE pour les turbines.** Une buse VAN projette plusieurs filets
simultanés : moins d'arc, moins de filets, moins de débit — ses relevés le
montrent (12-VAN : 0,15 à 90°, 0,30 à 180°, 0,59 à 360°). Pour une tuyère, le
débit se lit par angle.

**80 % DE RECOUVREMENT SUFFIT — pas besoin de 100 %.** Sa règle du 21 août, en
validant la 12-VAN à 3,6 m sur une bande de 4 m. Le recouvrement se lit
`portée ÷ espacement` : deux arroseurs espacés de leur portée exacte se
recouvrent à 100 %, ce qui est confortable et cher. Le seuil est **0,8**, soit
un espacement jusqu'à **1,25 × la portée**. Exiger 100 % partout fait poser des
arroseurs et des raccords que personne ne paie.

**LE RECOUVREMENT VA DE 80 À 100 %, LE BRIDAGE EST PERMIS, ET L'ON VA AU MOINS
CHER — ses réponses du 16 octobre 2026**, devant une pelouse de 20 × 12 qui
recevait six vannes parce qu'une turbine portait 10 cm de trop :

| | sa règle |
|---|---|
| **recouvrement** | entre **80 % et 100 %** : pour une portée de 10 m, de **10 m à 12,5 m** entre deux têtes (*« 12,5, je me suis trompé dans mes calculs »* ; le code disait 12 m depuis le 17 août) |
| **bridage à la vis** | permis, **jusqu'à 40 %** de portée en moins, et la tête bridée tient la même règle de 80 à 100 %. Mais *« je perds de son intérêt : autant passer sur des arroseurs moins puissants que de trop brider des arroseurs plus puissants »* |
| **l'écart permis** | **75 % à 105 %**, mais SEULEMENT si cela fait gagner des sous : un réseau de moins, ou une gamme moins chère (*« si on passe d'arroseurs 5000 à des 3500, les 5 % sont valables si ça fait gagner des sous »*). Sinon, 80 à 100 % |
| **l'ordre du moins cher** | **1.** le moins de réseaux ; **2.** la gamme la moins chère (3504 avant 5000, 5000 avant les gros arroseurs) ; **3.** le moins d'arroseurs. *« Ton ordre est le bon. »* |

*« L'idée, c'est d'aller au moins cher à chaque fois. Plus tu montes en gamme,
plus l'arroseur va loin, plus il coûte cher. Pareil, plus tu fais de réseaux,
plus ça coûte cher. »*

Le calcul ne connaît pas ses prix (ils sont dans son registre, jamais dans le
catalogue) : « moins cher » s'y lit dans cet ordre, rien d'autre.

**LES TUYÈRES NE SE BRIDENT PAS — sa réponse du 16 octobre 2026 :** *« non, les
tuyères on ne les règle pas à la vis, on ne peut donc pas les brider »*. Le
bridage de 40 % ne vaut que pour les turbines ; une tuyère se pose à sa portée,
entre 80 et 100 % de recouvrement (`poseSelonSaRegle`, `BRIDAGE_MAX`).

**UNE TÊTE BRIDÉE SE DIT « BRIDÉE À 6 M » DANS LA LÉGENDE — « la B », sa
réponse du 16 octobre 2026** devant la planche des trois écritures (« portée
6 m », « bridée à 6 m », « portée 6,4 m bridée à 6 m »). Une tête à sa portée
garde « portée 6,4 m ».

**AUCUNE DURÉE D'ARROSAGE À L'ÉCRAN — sa règle du 18 octobre 2026**, devant
« 6 min par arrosage » sous un réseau : *« là, tu es en train de leur donner le
temps d'arrosage. Ça, il faut pas le faire. »* Le calcul garde ses durées
(`minutes`, `passages`), elles ne s'affichent plus. Les besoins en eau qui
les produisent (`SAISONS`) n'ont d'ailleurs aucune source venue de lui.
L'ancienne page publiée `appli/arrosage.html` en montre encore.

**LE ROBINET SE DESSINE EN PETITE CROIX BLANCHE — sa règle du 18 octobre 2026 :**
*« une croix blanche, et tu écris à côté robinet. À chaque fois que l'utilisateur
mettra sur son plan l'endroit où il se repique avec le robinet, tu le
comprendras ainsi. »* Le petit trait à gauche, d'abord demandé, est retiré le
même jour : *« si robinet, tu l'écris dans le plan, enlève le petit trait »*.
Sur le plan, le piquage au robinet est une petite croix blanche et le mot
« robinet » (jamais le rectangle de la nourrice), et la légende la porte :
« croix : le robinet, là où l'on se repique ». Sur le croquis, ce même signe se
LIT comme le piquage, avec « robinet » pour point d'eau (`lire-croquis.ts`).

**CE QU'IL ÉCRIT DANS UNE ZONE COMMANDE SON ARROSAGE — 20 octobre 2026**, sur
son croquis : *« j'ai marqué que je voulais du goutte à goutte à deux endroits
différents, un écrit GAG pour goutte à goutte et l'autre en toutes lettres, et
arroseur sur la grande partie ; il a compris que le goutte à goutte »*.
« Arroseur », « turbines », « tuyères » : une zone à arroseurs, donc un gazon.
« Goutte à goutte », « GAG », « gaine » : du goutte-à-goutte, jamais un gazon.
Le mot écrit passe avant le type que le modèle rend (`arrosageEcrit`,
`lire-croquis.ts`). Un parking, une allée, une terrasse ne sont pas des zones ; et
quand le croquis porte plus de mots d'arrosage que de zones lues, la réserve
le dit (« 2 zones de goutte-à-goutte sont écrites sur le croquis… »). Et la feuille se lit dans le sens de son ÉCRITURE, pas de la
photo : *« parking est sous le carré et pas à droite »* (même jour, photo prise
feuille couchée). Le modèle dit de combien tourner, le calcul tourne.

**CE QUE L'IA A MAL LU SE CORRIGE À LA MAIN — « la A », sa réponse du
20 octobre 2026** devant `appli/arrosage-cotes-des-zones.html` : « Modifier »
à droite du nom de chaque zone (longueur, largeur, et Supprimer la zone, *« lue
à tort ou qu'on ne voudrait plus »*), et « Ajouter une zone » que l'IA n'a pas
lue, glissée au doigt sur le plan avec l'aimant de 50 cm. Pour une photo comme
pour un plan dessiné : la photo devient un plan en mètres, et c'est sur lui
qu'on pose la zone, jamais sur la photo, qui n'est pas à l'échelle. Le glissement
est FACULTATIF : non glissée, la zone est comptée (réseaux, arroseurs,
pièces), et la réserve dit que sa distance à la nourrice ne l'est pas.

**PLUS DE COIN TIRÉ SUR UNE PELOUSE NI UN MASSIF — sa décision du 27 octobre
2026 :** *« on va retirer la possibilité de faire des coins tirés pour la
pelouse et les massifs, on le laisse juste pour le dallage »*. Un coin attrapé
en glissant sa zone d'arroseurs l'avait étirée de 12 à 15,06 m, l'étiquette
disant toujours 12 × 10, et le plan était calculé sur 15,06. Ce que les cotes
disent est ce qui part au calcul. Les côtés courbes et les rangées en S restent.
Pour tourner une zone d'un quart de tour : « Tourner », dans sa feuille.

**UNE COTE ÉCRITE PASSE AVANT TOUTE DÉDUCTION** (même jour). Son massif coté
6 m, dessiné dans la pelouse de 10 m, avait été lu 10 m : la consigne donnait en
exemple d'étendre une bande « sur toute la hauteur de la pelouse ». On ne déduit
qu'un bord qui ne porte aucune cote.

**LE Ø25 D'ABORD, UN RÉSEAU DE PLUS ENSUITE, LE Ø32 SUR SON CHOIX — sa règle
du 20 octobre 2026**, qui remplace l'ordre du 16 octobre (Ø25, puis Ø32, puis
un réseau de plus) : *« il fait le calcul en diamètre 25 ; si le 25 ne passe
pas, il rajoute un réseau »*. Sur chaque réseau et sur l'amenée, il choisit
Ø25 ou Ø32 et voit ce que ça change (un arroseur de plus par réseau, un réseau
de moins) ; et un Ø32 que l'outil propose sur l'amenée, il peut le refuser. **La forme, « la C »**
(même soir, `appli/arrosage-choix-du-diametre.html`) : deux petites cases 25 et
32 à droite du nom du réseau et de l'amenée, au compteur comme au robinet
(*« il le faut aussi à partir du compteur ou du robinet »*), un Ø doré devant (le doré du surtitre « Le
piquage, au compteur », `or` ; *« celui que tu m'as mis est trop foncé »*), la case choisie en noir, ce que ça change écrit dessous. **Codées toutes
les deux le 20 octobre au soir** (`ARCHITECTURE.md` §476). Le goutte-à-goutte n'a
pas d'interrupteur : le calcul ne lui compte pas de perte de ligne. **Au compteur, une
amenée en Ø32 prend un té réduit 25 x 32 x 25** à la place du té égal : sa réponse
du même soir, *« il faut un 25 x 32 x 25 »*. Absent du relevé Aqua Plus, il
part sans référence. **À la nourrice, un tuyau en Ø32 se visse par un raccord
mâle 32 x 1"** (OPL70203226) à la place du 25 x 1" de la fiche, sur la vanne
d'un réseau en Ø32 et à l'entrée d'une amenée en Ø32 (proposé, et son « oui »).
Son idée d'un té taraudé 25 et d'un raccord 32 x 3/4" marchait, mais faisait
repasser l'eau par du 25 et du 3/4" à la sortie de la vanne.

**LE Ø25 VA JUSQU'À CHAQUE SORTIE DU GOUTTE-À-GOUTTE — sa capture du
21 octobre 2026 :** *« il y a deux endroits, deux massifs pour le goutte à
goutte ; sur le plan, il n'en a compté qu'un, et pour les pièces aussi ; il n'a
pas compté qu'il fallait faire deux sorties pour aller alimenter les deux
zones »*. Chaque sortie se trace comme le pied d'un arroseur sans tête : le
tuyau, la tranchée, le coude taraudé et le té égal se lisent sur le plan, et
chaque zone de la vanne se borde de sa couleur. Les pièces des sorties restent
À PART des raccords d'arroseurs, pour que `tés + coudes = arroseurs` tienne
réseau par réseau (`coudesDesSorties`, `egauxDesSorties`, `plan-dessine.ts`).

**LES LIGNES DE GOUTTE-À-GOUTTE : UN ÉCART D'OFFICE, JAMAIS AU BORD, ET
L'ÉCART SE VOIT — ses réponses des 21 et 22 octobre 2026.** *« Massif, tu peux
faire tous les 60 cm d'office, mais pareil avec une proposition »* ; *« il ne
faut pas commencer à 0 la première ligne »* ; puis, sur la planche : *« mets
l'espacement aussi tous les 50 cm d'office en partant de 0,50 et pas de 0, donc
pour 2 m ça fait 4 lignes. Et lorsque l'utilisateur augmente ou réduit le
nombre de lignes de goutte à goutte, il voit l'espacement qui augmente ou qui
réduit. »*

| | l'écart d'office | combien de lignes |
|---|---|---|
| haie | **50 cm** | largeur ÷ écart, arrondi au-dessous : 2 m font 4 lignes, à 0,50, 1, 1,50 et 2 m |
| massif | **60 cm** (le calcul disait 80 cm) | idem : 3 m font 5 lignes |

La première ligne est à un écart du bord, jamais à 0. **La dernière peut
tomber sur l'autre bord** : 2 m à 50 cm, c'est 4 lignes et la quatrième à 2 m
(question posée le 22 octobre, sa réponse : *« oui »*). Le nombre est une
PROPOSITION : les boutons − et + le changent, et l'écart affiché suit (le
bord gardé, la dernière sur l'autre bord : 2 m sur 3 lignes, à 0,50, 1,25 et
2 m, tous les 75 cm ; la règle disait « largeur ÷ nombre », 67 cm, avant les
deux écarts). **Et l'écart se TAPE
aussi**, en cm, pour une haie comme pour un massif (*« faut aussi pouvoir
modifier l'espacement en cm, une donnée à écrire »*, même jour) : taper
45 cm sur 2 m donne 4 lignes, la dernière à 20 cm du bord. Les lignes se
comptent sur le côté que le SENS désigne. **Puis, sur la planche
`appli/arrosage-feuille-des-lignes.html`, le même jour :** *« il faut aussi
qu'on puisse renseigner l'écart entre deux lignes »*, et *« demander s'il veut
le poser dans la longueur ou dans la largeur, parce que c'est pas la même
chose »*. Deux écarts donc, l'un **du bord** à la première ligne, l'autre
**entre deux** lignes (tous deux 50 ou 60 cm d'office) : n lignes valent
`(largeur − bord) ÷ entre + 1`, arrondi au-dessous, et les boutons gardent le
bord et refont l'écart entre deux. Et le **sens** : dans la longueur, les
lignes se comptent sur la largeur ; dans la largeur, sur la longueur ; sans
choix, elles courent sur le grand côté. **Codé le 22 octobre 2026** :
`ECARTS_GOUTTE` et `lignesPourEcart` dans `calcul.js` (les deux copies),
`sensDesLignes` dans `calcul.js`, `lignesDeLaZone` dans `dessin-du-plan.ts`
pour la feuille de « Dessiner le plan » ; éprouvé par
`scripts/test-lignes-goutte.ts` et `test-dessin-du-plan.ts`.

**LE Ø16 SE RACCORDE AU ROBINET PAR UN RACCORD TARAUDÉ 3/4" PROPRE À SON TUBE —
sa règle du 18 octobre 2026.** Le Plasson à bague blanche ne prend que le PE 25
ou 32. Le Ø16 **souple** : l'embout Palaplast taraudé 16 x 3/4" (MID6362, sa
photo). Le Ø16 **rigide** : un raccord à compression **Plasson** taraudé 16 x 3/4",
tout noir (sa photo), d'une gamme à part pour le 16 rigide, avec ses tés et
ses manchons de réparation. Sans référence relevée : *« n'importe quel
fournisseur sait de quoi on parle, au pire il mettra sa référence »*. Le
taraudé en haut, l'embout en bas.

**LE TÉ ÉGAL AU DÉPART — sa règle du 18 octobre 2026 :** *« si on descend du
robinet et qu'on a un réseau qui va à droite, à gauche, il nous faut un té
égal »*, puis, devant la planche `appli/arrosage-te-depart.html` : *« oui,
c'est exactement ça »*. L'eau arrive au point d'entrée d'un réseau par une
branche que le dessin ne porte pas (de la nourrice ou du robinet) : elle compte
comme une branche (`plan-dessine.ts`). Ça vaut au robinet comme à la nourrice.
Le té selon le diamètre : **25x25x25 en Ø25, 32x32x32 en Ø32, le té à
compression Plasson Ø16 en 16 rigide, le té Palaplast Ø16 (MID6321) en 16
souple**. Et un losange par té égal sur le plan, côte à côte.

**DÈS QU'IL Y A DES ARROSEURS, LE DÉPART EST EN Ø25 OU EN Ø32** (même jour) : le
Ø16, rigide ou souple, ne sert qu'au goutte-à-goutte.

**PLUS DE RÉSEAUX QUE DE VOIES AU NEZ DE ROBINET : ON LE GARDE ET ON PRÉVIENT —
sa réponse du 18 octobre 2026 :** *« si le programmateur est en nez de robinet,
il le garde et il prévient qu'il manque des voies »*. L'outil ne bascule pas de
lui-même sur la nourrice : le montage reste celui qu'il a choisi, et la réserve
dit le manque en nombre de voies (« Il manque 3 voies au programmateur : il en
a 1, ce jardin demande 4 réseaux »). C'est lui qui décide ensuite.

**AU ROBINET, LE CALCUL DE PRESSION EST CELUI DU COMPTEUR, QUEL QUE SOIT LE
MONTAGE — sa réponse du 19 octobre 2026 :** *« si c'est un programmateur en nez
de robinet avec départ en 16, il faut faire le calcul lambda avec la pression et
le débit, comme on fait pour le compteur. L'utilisateur doit te dire combien il y
a de pression et combien il y a de débit, et toi tu feras ton calcul de perte de
charge en fonction de ça. Et si on part du robinet pour aller à la nourrice,
c'est la même chose. En fait, ça ne change rien. »* Donc : la pression et le
débit qu'il mesure au robinet sont le point de départ, et les pertes se
calculent comme au compteur, dans les deux montages, avec le tuyau d'amenée et
le trajet tels que le croquis les donne. **Ne pas retirer la perte de l'amenée
au nez de robinet** : la proposition qui le faisait lui a été posée, et il l'a
écartée. Tenu dans `test-regles-du-patron.ts`.

**UN NOMBRE DE PIÈCES SE CHOISIT, JAMAIS « UNE » OU « TOUTES » — sa correction du
18 octobre 2026**, devant « Changer une seule pièce / Changer les 4 » : *« il
faut faire un choix avec le nombre de pièces à modifier. On clique et on choisit
si on va modifier 1, 2, 3, 4. On ne va pas à chaque fois faire une par une.
Pareil pour la suppression. »* Une pièce en plusieurs exemplaires offre une
rangée Changer et une rangée Supprimer, un bouton par nombre.

**ET ÇA VAUT PARTOUT, SANS QU'IL LE REDISE** (même soir, devant « Changer les
7 » sur la chaîne d'une tête) : *« la modification que je t'ai demandée pour la
nourrice, c'est valable pour toutes les pièces où il y en a plusieurs. Je vais
pas te le redire à chaque fois. Si j'ai envie de changer qu'une seule tuyère,
il faut que je puisse le faire. Et fais-moi ça pour chaque planche, le plan
d'arrosage comme le plan du robinet. »* La nourrice, la chaîne d'une tête (les
têtes d'un réseau), les lignes de la liste : toute pièce comptée à plus d'une
se change ou se supprime au nombre choisi, sur toutes les planches, et dans
l'écran quand on le codera.

**TOUTE MODIFICATION DU PLAN VAUT AUSSI POUR LE PLAN AU ROBINET — sa règle du
19 octobre 2026 :** *« ça va de soi que les modifications que je te demande, il
faut également que tu me les fasses sur le plan du robinet »*. Une demande faite
sur `arrosage-plan.html` se porte sur `arrosage-plan-robinet.html` dans le même
geste, dans ses deux montages, sans qu'il le redise.

**LA FORME, « LA A » (même soir, planche `appli/arrosage-choix-du-nombre.html`) :**
*« Pourquoi tu ne mets pas un bandeau déroulant avec le choix ? On choisit le
nombre. »*, puis *« mets-moi la A partout où il y a des choix multiples, dans
les deux planches arrosage et robinet »*. Un bandeau déroulant « Combien » (le
sélecteur du téléphone, qui part sur « toutes les N »), puis le geste : Changer
ou Supprimer, dont le libellé suit le nombre. Jamais une rangée de boutons
numérotés (la B, un bandeau par geste, est écartée).

**UN PASSAGE EN POINTILLÉS QUI SE MESURE SUR LE PLAN NE SE DIT PAS « À MESURER »** — sa
règle du 18 octobre 2026 : *« si quelqu'un te fait un plan à l'échelle et que tu
sais que la pelouse fait tant de mètres, que le passage entre la pelouse et
l'autre carré fait tant de mètres, tu peux calculer cette mesure ; dans ce
cas-là, il ne faudra pas afficher ce texte-là »*. Quand la distance est connue
(cotée entre les zones, ou tracée dans l'outil de dessin du plan), elle se compte
dans le tuyau et la tranchée, et la phrase disparaît. Sinon : « Sa longueur doit
être mesurée. » **Pas encore codé** : aujourd'hui `dessinerPlan` ne sait pas si les
places des zones sont cotées ou estimées sur le croquis.

**AUCUNE PÉRIODE NON PLUS — 18 octobre 2026 :** *« on ne donne pas les durées
d'arrosage ni les périodes à arroser »*. Les besoins par saison, les heures de
départ et la pluviométrie, qui ne servaient qu'aux durées, sont retirés du
calcul.

**LA TENSION S'ACCORDE, SINON RIEN N'ARROSE.** Sa règle du 21 août :

| Le programmateur | L'électrovanne |
|---|---|
| à pile, **9 V** | **9 V** |
| sur secteur, **220 V** | **24 V** |

Ce n'est pas une préférence mais une condition de fonctionnement : une vanne
24 V pilotée par un boîtier à pile **ne s'ouvre pas**. Le réseau n'arrose pas du
tout, et on ne s'en aperçoit qu'après avoir rebouché. Cette faute ne se voit ni
sur un plan, ni sur un devis. **Tous ses programmateurs sont à pile** — donc
toutes ses vannes sont en 9 V.

**Une valeur « provisoire » qui survit devient un mensonge.** Le catalogue
portait une « Électrovanne 24 V » générique, posée avant qu'il donne ses
références et jamais confrontée à elles. Il a demandé d'où elle sortait : de
nulle part. Quand ses vraies références arrivent, les lignes provisoires qu'elles
remplacent se **corrigent**, elles ne se laissent pas dormir.

**CE QUI COMPTE, C'EST LA PRESSION AU DERNIER ARROSEUR, PAS AU COMPTEUR.** Sa
demande du 22 août 2026 au soir : *« oui corrige la 1 »*. Entre le compteur et
le bout d'une ligne se perdent l'amenée, l'électrovanne, la ligne elle-même,
ses raccords et l'antenne Ø16 — de l'ordre d'un demi à trois quarts de bar sur
un jardin ordinaire. Dimensionner sur la pression du compteur, c'est prêter aux
arroseurs de bout de ligne une portée qu'ils n'ont pas.

**Le débit DÉCROÎT le long de la ligne**, et c'est tout le calcul : entre la
vanne et la première tête passe le débit du réseau entier, puis une tête de
moins à chaque tronçon. Compter le débit total partout surestime la perte de
75 % — assez pour condamner des plans qui tiennent.

**Deux passes, jamais trois : FAUX, corrigé le 16 octobre 2026.** La règle
(la nôtre, pas la sienne) disait qu'une troisième passe remonterait la pression.
En réalité la deuxième passe peut changer de plan et perdre PLUS que la
première : les buses étaient alors choisies jusqu'à 0,31 bar au-dessus de ce
qui arrive au dernier arroseur. **Ce qui la remplace** : on essaie chaque
pression de choix, de centième en centième, et l'on ne garde qu'un plan qui
marche à la pression qui arrive vraiment (portées tenues, chaque vanne sous la
limite du tuyau au débit réel, au plus 0,2 bar de plus que la pression de
choix). Parmi ceux-là, le moins de vannes puis le moins d'arroseurs
(`ARCHITECTURE.md` §467).

**LES PLACES SE LISENT SUR LE CROQUIS, EN FRACTION — les mètres se DÉDUISENT.**
Sa demande du 22 août au soir : *« oui fais-le lire les proportions »*, après
que je lui ai dit à tort qu'aucune saisie ne donnait le trajet du regard à la
première tête. *« Il a tous les métrés du terrain, il a juste à calculer. »*

Le modèle rend des places entre 0 et 1 — il voit qu'une pelouse occupe le tiers
gauche, pas qu'elle est à douze mètres. **L'échelle sort des cotes déjà lues** :
16 m sur 0,40 du croquis font 40 m par unité. On retient la **médiane** des
estimations, jamais la moyenne, et **on refuse de conclure** au-delà du double
d'écart entre zones — un croquis pas à l'échelle ne rend pas une distance
moyenne, il rend une réserve.

**Ce qui reste non compté se dit à l'écran** : quand la nourrice n'est pas
dessinée, le trajet ne se calcule pas — et il ne se suppose pas davantage. La
pression annoncée est alors un plafond.

**UN RÉSEAU EST PLAFONNÉ PAR SON TUYAU, PAS SEULEMENT PAR LE COMPTEUR.** Sa
déduction du 22 août 2026 : *« en diamètre vingt-cinq c'est 1,76 m³/h, donc dans
tous les cas le calcul doit se faire là-dessus, peu importe qu'on ait 2 ou
1,80 »*. Toutes ses lignes de réseau sont en Ø25 — c'est le diamètre de tous ses
raccords. La limite d'un réseau est donc **le plus petit** de :

| | |
|---|---|
| ce que la source donne | débit au seau × 0,85 |
| ce que le tuyau passe | **1,53 m³/h en Ø25** (ses tubes 25×3.0) |

**Le 1,76 était faux, corrigé le 16 octobre 2026 avec son accord.** Il venait
d'un diamètre intérieur supposé (20,4 mm). Ses tubes photographiés : Ø25
Elydan Polybleu 25×3.0, donc 19,0 mm de passage ; Ø32 Alfatubo 32×3.0, donc
26,0 mm. Sur le Ø25, **40 % de perte en plus** que ce que l'outil comptait.
La règle reste la sienne ; c'est le chiffre qui était faux.

**Ce défaut était invisible chez lui** : son compteur donne 1,80, donc la source
a toujours commandé. Il serait apparu chez le premier utilisateur mieux
alimenté. Une règle éprouvée sur un seul chantier n'est pas une règle éprouvée.

**UNE BUSE SE CALCULE À LA PRESSION DU CHANTIER, PAS À CELLE DU CATALOGUE.**
Ses catalogues ne donnent qu'une valeur par buse, à une pression de référence
(2,5 bar pour ses turbines Rain Bird, 2 bar pour ses tuyères VAN). Les prendre
telles quelles met un arroseur de trop par réseau dès que le chantier est en
dessous.

| | La loi | Son statut | Sens |
|---|---|---|---|
| **débit** | `Q ∝ √P` — Torricelli | **physique** | les deux sens |
| **portée** | `R ∝ P^(1/3)` | **estimation** | **vers le bas seulement** |

**La portée ne se gonfle JAMAIS.** L'exposant vient des tables des
constructeurs, pas de ses relevés à lui : au-dessus de la pression de
référence, on garde la portée du catalogue. Espacer les arroseurs sur un chiffre
supposé fabrique un trou d'arrosage qu'on ne voit qu'en juillet ; réduire coûte
au pire une vanne de plus. **Et une portée réduite se DIT à l'écran** — c'est
une estimation, pas un fait.

**LE DIAMÈTRE DU TUYAU SE CALCULE, ET SUR DEUX CRITÈRES — jamais un seul.**
Sa demande du 22 août 2026 : *« passé un certain nombre de mètres linéaires, il
faut passer du PEHD Ø25 à celui en Ø32 ; j'aimerais que mon outil arrosage
puisse faire la même chose »*. Ses fournisseurs savent le lui dire ; c'est un
calcul, pas un tour de main.

| Ce qui impose le Ø32 | La règle | Le chiffre |
|---|---|---|
| **le débit** — l'eau va trop vite | vitesse ≤ 1,5 m/s | Ø25 : **1,53 m³/h**, Ø32 : **2,87** (ses tubes, 16 octobre 2026) |
| **la longueur** — la perte mange la marge | Hazen-Williams, retournée | dépend du débit et du budget |

**Le piège, et il était dans le dépôt.** Le calcul ne regardait QUE la perte de
charge. Or un tuyau court n'en perd presque aucune : sur ce seul critère, **un
Ø25 « passe » à n'importe quel débit pourvu qu'il soit assez court**. C'est
faux — au-delà de 1,5 m/s l'eau cogne, le coup de bélier fatigue les
électrovannes, et le bruit s'entend dans la maison. Le critère de vitesse est
donc entré, et c'est lui qui donne les débits maximaux que les fournisseurs
annoncent par diamètre.

**Ce paragraphe disait que le chiffre recoupait SA mesure au seau** (1,80
contre 1,76). C'était une coïncidence bâtie sur un diamètre supposé, et elle a
fait croire le 1,76 pendant deux mois. Le seau mesure ce que donne le compteur ;
la vitesse dit ce qu'une ligne enterrée supporte. **Un diamètre se lit sur le
tube (« 25×3.0 »), il ne se déduit pas d'une coïncidence.**

**Et l'outil dit le SEUIL, pas seulement le verdict.** « Le Ø25 tient jusqu'à
73 m à ce débit » se compare au mètre ruban avant de creuser ; un oui/non sur
une longueur saisie oblige à la ressaisir trois fois pour trouver la bascule.
Quand le débit interdit le Ø25, le seuil vaut **zéro**, jamais un nombre de
mètres qu'on croirait.

**LA PRESSION NE DONNE PAS LE DÉBIT, ET LE DÉBIT NE DONNE PAS LA PRESSION.**
Les deux se calculent, mais séparément : le débit vient du diamètre (vitesse ×
section) ou du seau chronométré ; la pression dit ce qui arrivera aux arroseurs
une fois les pertes retirées. Les confondre met trop d'arroseurs sur un réseau.

**SE PIQUER AU COMPTEUR, C'EST COUPER UNE LIGNE EN SERVICE.** Sa précision du
21 août : *« le compteur, c'est une ligne directe qui part vers la maison ; on va
devoir la couper et mettre un té égal à cet endroit-là »*. Donc **dès que le
piquage est au compteur, un té égal 25×25×25 entre dans les pièces d'amenée** —
celles qui vont du compteur à la nourrice.

C'est une pièce qu'aucun calcul de réseau ne produit : elle ne dépend ni des
arroseurs, ni des voies, ni du débit, mais du **point de piquage** seul. Elle
manquait donc, et elle aurait manqué sur chaque plan. L'oublier, c'est un
aller-retour au magasin avec la tranchée ouverte.

**Trois zones, jamais mélangées** : ce qui va du **compteur à la nourrice**, ce
qui est **dans le regard**, ce qui part **au jardin**. Les confondre a déjà fait
compter un coude du regard comme une fin de ligne d'arroseur.

**CE QU'ON MINIMISE, C'EST LA TRANCHÉE — PAS LE TUYAU.** Sa règle du 21 août,
et elle prime sur tout le reste du tracé : *« le trait jaune, c'est une tranchée.
C'est une équipe qui va devoir creuser la terre. Donc l'idée, c'est de faire le
moins de tranchée possible. Si on peut réutiliser une tranchée déjà faite et
juste faire une petite antenne — un mètre par exemple — pour aller chercher
l'arroseur, c'est moins éprouvant que de faire tout le tour. »*

**Deux tuyaux qui suivent le même chemin n'occupent qu'UNE tranchée.** Le mètre
de tuyau se paie une fois ; le mètre de tranchée se paie en heures d'homme, et
en gazon rouvert. Un réseau a donc raison de **rallonger son tuyau** pour rester
dans une saignée déjà ouverte.

Ce qu'il faut chercher, dans cet ordre :

1. une **tranchée principale** que plusieurs réseaux empruntent ;
2. des **antennes courtes** qui s'y greffent pour desservir un arroseur isolé ;
3. jamais un contournement complet quand un mètre d'antenne suffit.

**On CHERCHE les deux économies à la fois** — le tuyau et la tranchée. *« Il faut
combiner économie de ml de tuyau et réutiliser une tranchée. »* Et quand les deux
solutions se valent : **la tranchée l'emporte**, *« car c'est moins fatigant »*.
Un mètre de tuyau se pose ; un mètre de tranchée se creuse, se remblaie, et se
voit encore dans le gazon l'été suivant.

**ON TRAVERSE LE MOINS POSSIBLE LE JARDIN DANS SA LARGEUR.** Sa règle du
21 août : *« beaucoup de choses enterrées — pour le réseau jaune j'aurais fait le
tour et non traversé »*. Ce n'est pas une question de mètres mais de **risque** :
au milieu d'un terrain passent des gaines, des drains, une fosse, des racines
qu'on ne verra qu'à la pelle. Le tour se rebouche ; la traversée se retrouve.

On ne rentre donc dans le jardin **que** pour aller chercher un arroseur qui s'y
trouve, et par le plus court. **Le tour vaut mieux que la coupe, même à longueur
égale** — son exemple du 21 août : sur une bande de 8 × 4, faire le tour par
haut-gauche → haut-droite → bas-droite → bas-gauche coûte exactement autant que
de la couper en deux, et ne creuse que le long des bords.

**Le critère est géométrique, pas métrique.** Une première version comptait la
tranchée à plus de 2 m d'un bord : dans une bande de 4 m de large, le milieu est
à 2 m des deux bords, donc aucune traversée n'y était **jamais** détectée — le
contrôle dormait exactement là où il fallait qu'il parle. La bonne question est :
*ce segment part-il d'un bord pour arriver sur un bord en passant par
l'intérieur ?* Si oui, c'est une coupe, et le tour existe toujours. Un segment
qui va chercher un arroseur du milieu n'arrive sur aucun bord : ce n'en est pas
une.

Cela se mesure : la tranchée est l'**union** des tracés — ce qui se superpose ne
compte qu'une fois — et se compare à l'arbre couvrant minimal de la nourrice et
des arroseurs, en distance de Manhattan (un tuyau suit les axes). Sur son plan
du 21 août, à longueur de tuyau **égale** (76 ml), faire remonter le troisième
réseau par le bord haut déjà creusé a économisé **10 m de tranchée** — 74 → 64.

**Un tracé ne doit pas revenir sur lui-même** pour rattraper un arroseur déjà
dépassé : mieux vaut un té de jonction et deux branches courtes. Mais ce défaut-
là se juge largement, car rallonger un tuyau pour suivre une tranchée est un bon
calcul, pas un détour.

**Une antenne part du RÉSEAU, pas de la nourrice.** Seul le réseau part du
regard ; ses antennes se greffent sur un point qu'il dessert déjà.

**LE Ø25 PASSE, L'ANTENNE Ø16 VA CHERCHER LA TÊTE — ET ELLE FAIT 2 M AU
MAXIMUM.** Sa règle du 11 septembre 2026, donnée en corrigeant un plan qui
amenait le Ø25 jusqu'à chaque tuyère d'un couloir, en deux lignes :

*« Pour la tranchée, il faut faire juste un passage au mieux pour le 25, et
ensuite ce sont des antennes en diamètre 16 rigide qui vont de part et d'autre
pour poser les tuyères — et elles doivent être posées en quinconce. »*

*« Si le couloir fait 3 m, on fait une seule tranchée au milieu et les antennes
pour les tuyères de chaque côté — donc 1,50 m de 16 rigide, ça passe. Si le
couloir fait 5 m, on ne peut plus faire une seule tranchée au milieu, parce que
là ça fait des antennes de 2,50 m de chaque côté, et le max c'est 2 m de 16
rigide. »*

| | |
|---|---|
| la ligne Ø25 | **un seul passage**, au mieux — elle ne va pas à chaque tête |
| l'antenne Ø16 rigide | du té de la ligne à l'arroseur, **2 m au plus** |
| un couloir jusqu'à **4 m** de large | une tranchée au milieu, des antennes des deux côtés |
| au-delà de 4 m | une tranchée ne suffit plus : la ligne doit repasser assez près de chaque tête |

**L'AMENÉE SE CALCULE — « NI LUE, NI SUPPOSÉE ».** Sa règle du 11 septembre
2026, devant une planche qui lui proposait de la « lire » ou de garder 30 m :
*« pour la 2, elle doit être calculée, ni lue ni supposée »*. Le croquis porte
le piquage et la nourrice — deux des trois éléments obligatoires —, les cotes
donnent l'échelle : la longueur du compteur à la nourrice se calcule entre les
deux places, en Manhattan, comme le trajet du regard
(`longueurDeLAmenee`, `geometrie-croquis.ts`). Le modèle ne rend jamais des
mètres ; il rend des places. Et **sans piquage dessiné, aucun plan** — c'est le
troisième élément, et il se lit désormais sur le croquis, pas seulement dans le
déroulant (qui, lui, ne commande que le débit). Quand l'échelle ne se déduit
pas, l'amenée n'est pas comptée et l'écran le dit — jamais 30 m tus.

**Pourquoi 2 m et pas « environ 2 m ».** La nomenclature du 17 août comptait
*« environ 2 m de PEBD rigide Ø16 par arroseur »* — une règle de COMPTE, qu'on
a prise pour la seule règle. Celle-ci est une règle de POSE : au-delà, ce n'est
plus une antenne, et la ligne doit venir plus près. Le tracé doit donc placer
le Ø25 de sorte qu'aucune tête ne soit à plus de 2 m de lui.

**Cette règle avait déjà été donnée avant le 11 septembre, et elle avait été
perdue** avant d'être écrite — comme le quinconce du couloir (§127), mort le
24 août quand un contrôle rouge a été réécrit au lieu d'être compris. Les deux
vivent désormais dans `scripts/test-regles-du-patron.ts`, avec ses chiffres à
lui : **un rouge dans cette suite ne se réécrit jamais, il lui est posé.**

**Les raccords se comptent par POSITION, jamais par arroseur** — sa planche du
17 août, écrite dans `appli/arrosage-catalogue.js` :

| Position sur la ligne | La pièce |
|---|---|
| départ, milieu | Té 90° taraudé 25×3/4"×25 |
| **fin de ligne** | Coude 90° taraudé 25×3/4" |
| jonction sans arroseur | Té 25×25×25, non taraudé |

**D'où le contrôle qui vaut pour tout schéma : `tés + coudes = arroseurs`**, et
`coudes = nombre de lignes`.

**ET IL S'APPLIQUE À CHAQUE RÉSEAU, UN PAR UN — jamais au total.** Sa règle du
21 août : *« il faut que tu l'appliques pour chaque réseau que tu crées »*. Une
vérification faite sur la somme laisse passer exactement ce qu'elle prétend
attraper : un réseau en excès et un autre en manque se **compensent**, le total
tombe juste, et c'est sur le terrain qu'on découvre qu'une voie n'a pas de quoi
raccorder son dernier arroseur.

Le gabarit, à dérouler pour **chaque** réseau créé :

| Ce qu'on compte | Comment |
|---|---|
| arroseurs | ce que le réseau dessert |
| coudes taraudés | **une fin par ligne** du réseau |
| tés taraudés | arroseurs − coudes |
| tés de jonction | les ramifications, qui n'arrosent rien |
| SBE | **2 × arroseurs** : 3/4" en bas, diamètre du corps en haut |
| PEBD Ø16 | 2 m par arroseur |
| PE Ø25 | mesuré sur le tracé, comparé au plus court |

Et ce que le réseau **annonce** doit être ce que le plan **dessine** : si les
deux divergent, l'un des deux ment et rien ne dit lequel au moment de commander. En dessous, des arroseurs ne sont raccordés à rien.
C'est lui qui l'a relevé, au chiffre près, sur un plan qui paraissait juste :
*« il y a quatre arroseurs qui ne sont pas alimentés »*. Aucun test ne le voyait,
parce qu'aucun ne comparait la liste des pièces au tracé.

Et **deux SBE par arroseur** : celui du bas toujours en 3/4" (sur le té ou le
coude), celui du corps au diamètre de la famille — 3/4" turbine, 1/2" tuyère.

**LE PLAN DIT QUEL ARROSEUR, OÙ, ET POURQUOI.** *« Sur le plan, tu dois savoir
me dire où sont les tuyères et pourquoi, et quelle buse tu utilises — pareil pour
les 5004. Il faut que l'utilisateur, en regardant son plan, sache tout de suite
où les réseaux passent, quels arroseurs à quel endroit, et pourquoi. »*

Un plan qui ne montre que des points ne se pose pas : sur le terrain, on ne sait
pas lequel visser où. Donc **la forme porte la famille** (rond : turbine ; carré :
tuyère), le remplissage porte la position sur la ligne, et la légende nomme la
**buse** — « 12-VAN », pas « une tuyère » : on ne commande pas avec le second.

Et le **pourquoi** s'écrit, parce qu'un choix qu'on ne comprend pas se refait au
hasard le chantier suivant. Exemple, sur son plan : une bande de 4 m de large
reçoit des tuyères, jamais des turbines — une portée de 6 m y arroserait 2 m
au-delà de la limite, chez le voisin ou sur l'allée.

**UNE LÉGENDE MONTRE, ELLE NE DÉCRIT PAS.** Sa remarque du 21 août : *« on ne
sait pas vraiment à quel endroit tu veux utiliser un coude taraudé, à quel
endroit un té égal ou un té taraudé. Là où tu as marqué plein, à côté tu peux
mettre un rond plein. »* Le symbole se **dessine** à côté du mot, et c'est celui
qui est sur le plan — un « ● » écrit en toutes lettres ne rend ni la nuance
plein/creux, ni la forme.

Et chaque symbole **nomme la pièce** qu'il implique : plein → té taraudé ; creux
→ coude taraudé ; losange → té égal. Sans cela on lit le plan sans savoir quoi
visser. **Toute pièce facturée se voit quelque part sur le plan** — une pièce
commandée qu'on ne sait pas où poser ne sert à rien.

**DEUX SYMBOLES AU MÊME POINT SE DESSINENT CÔTE À CÔTE, JAMAIS L'UN SUR
L'AUTRE.** Sa règle du 11 septembre 2026 : *« même si c'est au même endroit, tu
ne dois pas superposer les ronds, carrés ou losanges : mets-les côte à côte,
qu'on les voie bien — l'utilisateur comprendra que c'est au même endroit »*.
Deux pelouses qui se touchent posent chacune sa tête sur l'arête commune ; le
dessin en montrait une, la seconde exactement dessous, et seule la réserve le
disait. Le point vrai ne bouge pas (c'est lui qui arrose) ; le symbole s'écarte
(`Tete.decalage`). Et le té égal d'une tête à trois branches se dessine **à côté
d'elle**, pas dessous — *« il faut un té égal à côté du premier arroseur pour
faire la jonction »*, sa lecture du plan le même jour.

**UNE LÉGENDE SE VÉRIFIE CONTRE LE CATALOGUE ET CONTRE LA COMMANDE.** Payé le
22 août 2026, et c'est lui qui l'a relevé : *« il m'a déjà donné 4 arroseurs en
5004 buse 3 sur un seul réseau avec 3 bar et du Ø25 — est-ce correct ? »* Ça ne
l'était pas (2,84 m³/h pour un Ø25 qui en passe 1,76), **mais le plan ne posait
pas de 5004** : la légende, elle, était restée sur le matériel de la première
version de la planche, et son contrôle **exigeait ce libellé en dur**. La
légende ne pouvait donc plus être corrigée sans faire rougir la batterie.

Trois choses doivent s'accorder, et un contrôle doit les confronter :

| | |
|---|---|
| le nom de la buse | **exactement** celui du catalogue |
| la portée annoncée | celle du catalogue, pas une valeur ronde |
| le matériel cité | celui que **la liste des pièces facture** |

**Ce qui est une règle POUR NOUS ne va pas à l'écran.** *« La phrase sur la
tranchée creusée une fois, tu peux la supprimer. Il faut juste que ça soit une
règle que toi tu conserves, mais l'utilisateur n'a pas besoin de voir ça. »* Nos
raisons de conception restent ici ; l'écran ne porte que ce dont il a besoin pour
poser le chantier.

**RIEN NE SE RÉSUME EN UNE LIGNE SI ÇA SE POSE EN DIX PIÈCES.** Sa question du
21 août : *« où sont les pièces pour la nourrice 3 voies ? »* Elle tenait en
trois lignes — 3 électrovannes, 1 regard, 1 programmateur — qui ne se montent
pas : il manquait la clarinette qui relie les vannes, les unions qui permettent
de démonter, les raccords d'entrée, la vanne de purge pour l'hivernage. **Tout
était déjà relevé** dans `CATALOGUE.nourrices[3]` — un ensemble décrit au
catalogue se recopie, il ne se résume pas.

**Et un récapitulatif se RECALCULE, il ne se recopie pas.** Un écran portait
« 8 tés, 5 coudes » au tableau et « 9 tés + 4 coudes » dans la phrase en dessous :
la phrase, écrite en dur, disait vrai la veille. C'est le pire des cas, parce
qu'on la relit sans méfiance. Deux chiffres qui se contredisent dans le même
écran, c'est toute la liste qu'on cesse de croire.

**PAS DE GRAS DANS UNE LISTE DE PIÈCES.** Sa demande du 21 août. Une liste de
commande se lit ligne à ligne : y appuyer des mots hiérarchise ce qui n'a pas à
l'être, et attire l'œil sur la moitié d'une désignation. Le gras sert dans une
explication, pas dans un tableau où chaque ligne compte autant que la suivante.

**Chaque quantité doit pouvoir se RECOMPOSER à la main.** Sa question du
21 août — *« je ne comprends pas d'où sortent tes vingt-deux coudes SBE, ça
correspond à quoi ? »* — portait sur un chiffre JUSTE. Le défaut n'était pas le
calcul mais la ligne : « 22 u Coude SBE 075 » ne dit pas à quoi ils servent. On
recompte, on n'y arrive pas, et c'est toute la liste dont on doute. Une pièce
qui sert à deux endroits se écrit donc en **deux lignes**, chacune nommant sa
position.

## 4 bis. Une maquette qui montre du matériel le prend dans le catalogue

**Payé le 20 août 2026, sur sa question :** *« les pièces que tu as utilisées
pour l'exemple sont choisies au hasard ? »* — et la réponse était **oui** pour
une partie d'entre elles. La maquette d'arrosage annonçait « Turbines, portée
5 m · 0,30 m³/h », des « colliers de prise en charge », un « filtre à tamis » et
un « clapet anti-retour ». Aucune de ces pièces n'existe.

Le dépôt tient pourtant `appli/arrosage-catalogue.js`, où **chaque entrée porte
sa source** — `'patron'` (relevée de ses photos, de ses devis Aqua Plus) ou
`'provisoire'`. Un arroseur dont on croit la portée fausse fait acheter le
mauvais nombre d'arroseurs, et c'est le paysagiste qui revient poser les
manquants.

**La règle, donc :**

- **Aucun matériel inventé dans une maquette.** Les libellés se recopient
  **mot pour mot** du catalogue : c'est ce qu'il portera chez son fournisseur, et
  une virgule de plus rend la référence introuvable.
- **Les chiffres viennent du calcul, pas de la tête.** `appli/arrosage-calcul.js`
  existe et tourne : on le pilote (Playwright suffit) et on écrit ce qu'il rend.
  Refaire le calcul à la main dans une maquette, c'est une seconde
  implémentation qui divergera (§3).
- **Ce qui ne se devine pas reste vide et le dit.** Les longueurs de tuyau
  dépendent du chemin réel dans le jardin : le calcul répond « à mesurer », et la
  maquette doit répondre pareil. Un plan qui chiffre ce que la liste dit ignorer
  se contredit lui-même — et c'est le chiffre du plan qu'on recopie sur un devis.
- **La source se montre.** Ce qui est encore `provisoire` est signalé comme tel,
  jamais présenté comme acquis.

**Le contrôle qui tient tout ça**
(`scripts/verifier-maquette-arrosage-simple.mjs`) compare chaque libellé au
catalogue **à l'identique**. Sa première version acceptait une inclusion : le
catalogue portant une entrée générique nommée « Turbine », l'invention
« Turbine portée 5 m » la contenait et passait au vert. **Un contrôle trop
tolérant ne prouve rien** — celui-là a été trouvé en le confrontant à
l'invention même qu'il devait bannir.
