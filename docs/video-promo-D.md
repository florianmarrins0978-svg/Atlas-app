# La vidéo, version D : trois directions à choisir

**Document de retour**, à copier et à envoyer. Écrit le 4 octobre 2026, après
le brief « film publicitaire d'Atlas » (le verdict sur la version C :
*« On dirait un PowerPoint. »*).

**État :** les trois directions sont rendues en vrai MP4 de 8 secondes, avec
leur bande son de travail et leur version muette. **Le film complet n'est pas
fait, exprès** : c'est la règle du dépôt (la maquette d'abord), et c'est ce
qui évite de jeter une journée de rendu si la direction n'est pas la bonne.
Rien n'est sur `main` : branche `claude/new-session-3ab8dh`, lot de niveau 2.

## Sommaire

1. [Ce qu'il faut décider](#1-ce-quil-faut-décider)
2. [Ce qui faisait PowerPoint dans la version C, plan par plan](#2-ce-qui-faisait-powerpoint-dans-la-version-c-plan-par-plan)
3. [Les trois directions](#3-les-trois-directions)
4. [Ma recommandation, et sa raison](#4-ma-recommandation-et-sa-raison)
5. [D'où vient chaque chose affichée](#5-doù-vient-chaque-chose-affichée)
6. [Le cahier du son](#6-le-cahier-du-son)
7. [Les captures qui manquaient, et l'écran retenu pour « la fiche des gars »](#7-les-captures-qui-manquaient-et-lécran-que-jai-retenu-pour--la-fiche-des-gars-)
8. [Ce qui a été fait autrement que le brief, et pourquoi](#8-ce-qui-a-été-fait-autrement-que-le-brief-et-pourquoi)
9. [Ce qui reste, et qui peut le trancher](#9-ce-qui-reste-et-qui-peut-le-trancher)

---

## 1. Ce qu'il faut décider

| | |
|---|---|
| **La direction** | L'objet (Apple), le coup de poing (nerveuse), ou la journée (récit). Les trois sur `appli/video-promo.html`, bouton par bouton |
| **Le nom** | Atlas, ou un autre. Il est écrit dans le film |
| **L'adresse de la fin** | où la vidéo renvoie. Elle s'ajoute sur la signature |
| **La voix** | une voix off, ou le film muet avec sa musique. Un texte de 30 s est proposé en §6 |
| **Le son** | personne n'a pu l'écouter ici. La bande fournie est une bande de TRAVAIL, fabriquée note à note ; le vrai son se pose avec le cahier du §6 |

Une fois la direction choisie, le film entier (30 à 40 s) se monte sur elle,
avec les quatre piliers : le devis, le planning, la fiche des gars, la facture
et sa TVA.

---

## 2. Ce qui faisait PowerPoint dans la version C, plan par plan

Lu sur la planche du film C, une image toutes les demi-secondes
(`node scripts/rendre-film.mjs appli/video-promo/film/film-C.html --planche`).

| Secondes | Ce qu'on voit | Pourquoi c'est une diapositive |
|---|---|---|
| 0 à 4 | « 20 minutes » tapé, barré, « 30 secondes » | tout est au centre, rien ne bouge que le texte : une diapositive de titre |
| 4 à 12 | le téléphone, plat, au centre ; « Vous dictez. » au-dessus | la caméra est fixe, le titre LÉGENDE l'écran au lieu de raconter |
| 12 à 14 | « C'est transcrit. » ; l'écran suivant remplace le précédent | un écran glisse sur l'autre : c'est la transition d'un diaporama |
| 14 à 20 | la feuille du devis passe devant, le téléphone se floute | le seul mouvement de profondeur du film, et il arrive une fois |
| 20 à 26 | « Il choisit sa date, il accepte. » ; trois écrans client | même cadre, même place, même rythme |
| 26 à 30 | « Vous êtes prévenu. » ; accueil puis planning | idem |
| 30 à 35 | « La facture reprend le devis. » ; Terminés, facture | idem |
| 35 à 38 | « Diagnostic, arrosage, sécurité. » | retiré de D, comme demandé |
| 38 à 41 | « Atlas », deux pastilles | une diapositive de fin |

Les quatre défauts nommés dans le brief sont tous là : un téléphone plat au
centre pendant 35 secondes sur 41 ; un titre au-dessus de chaque écran ; une
scène toutes les 5 secondes, sans montée ni silence ; une caméra qui ne bouge
pas. **Rien de l'écran n'était faux** : ce qui manquait, c'est le cinéma.

---

## 3. Les trois directions

Même histoire pour les trois, pour que la comparaison soit juste : le soir et
ses vingt minutes, la bascule, le téléphone, le micro, les mots dictés, et le
premier raccord : **ce qu'on vient d'entendre devient la première ligne du
devis**. Seul le traitement change.

| | L'objet (« Apple ») | Le coup de poing (« nerveuse ») | La journée (« récit ») |
|---|---|---|---|
| **le fichier** | `appli/video-promo/essai-D-apple.mp4` | `appli/video-promo/essai-D-nerveuse.mp4` | `appli/video-promo/essai-D-recit.mp4` |
| **la page** | `appli/video-promo/film/essai-D-apple.html` | `…/essai-D-nerveuse.html` | `…/essai-D-recit.html` |
| **l'accroche** | « 20 minutes » sort du flou dans le noir, s'enfonce ; le téléphone monte du noir, éteint, et la lumière balaie son verre | « LE SOIR. LES DEVIS. LA TVA. LES GARS QUI APPELLENT. 20 MINUTES. » une coupe par temps, noir, papier, vert pin ; un temps de silence ; le téléphone claque | « 21 h 40. Encore un devis à retaper. » lumière froide, le téléphone posé à plat ; l'heure roule jusqu'à « 8 h 05 », la lumière se réchauffe |
| **la bascule** | l'écran s'éveille sur « Vos chantiers », « 30 secondes. » en or ; la caméra entre lentement dans l'écran | « 30 » énorme derrière le téléphone ; la caméra saute dans l'écran en trois crans | le téléphone se lève dans la main, « sur le chantier » |
| **la dictée** | les mots dans le noir au-dessus du téléphone, un par un | les mots en masse, au quart de temps, « chêne » et « élagage » en or | les mots sous l'horloge, à vitesse réelle, un trait d'or qui grandit |
| **le raccord** | la feuille du devis monte du bas, en perspective, et un cadre d'or encadre sa première ligne : « Le devis s'écrit » | un panoramique filé ; la ligne du devis claque en pleine largeur ; « Devis. Prêt. » | « 8 h 06 » : le texte de la transcription SE DÉFORME en ligne du devis, puis « Le devis est prêt. » |
| **tempo de la bande** | 72 à la noire, nappe seule puis arpège | 128 à la noire, pulsation sur chaque temps, silence avant l'impact | 92 à la noire, nappe froide puis chaude |
| **ce qu'elle promet pour le film entier** | chaque pilier est un objet dans la lumière : la feuille du devis, la case du planning, la fiche des gars, la facture, tous en perspective, caméra lente | chaque pilier arrive sur un temps, un mot énorme par pilier (DEVIS. PLANNING. LES GARS. FACTURE. TVA.), gros plans en coupes | chaque pilier est une heure de la journée : 8 h 05 le devis, 12 h 30 le client accepte, 7 h le lendemain la fiche des gars, 18 h la facture, puis le téléphone posé |

**Ce qui est commun aux trois, et qui n'existait pas en C :**

- un téléphone en **vraie 3D** (CSS 3D, épaisseur modelée : quatre faces et
  quatre coins), une lumière calculée depuis son angle, un reflet qui balaie
  le verre, une ombre qui suit sa hauteur ;
- une **caméra** qui vit : travellings, plongée dans l'écran, bougé de main
  (direction nerveuse), rapprochements ;
- des **raccords** : un morceau d'écran qui voyage et devient autre chose,
  jamais un écran qui en remplace un autre ;
- du **flou de mouvement** rendu pour de vrai (deux sous-images par image,
  obturateur à 180°) et un **grain** de pellicule, posés au rendu ;
- 60 images par seconde, 1080 × 1920.

Tout cela vit dans `appli/video-promo/film/moteur-D.js`, commun aux trois
pages et au futur film.

---

## 4. Ma recommandation, et sa raison

**Le coup de poing (nerveuse) pour l'accroche, l'objet (Apple) pour les quatre
piliers.**

Le critère du brief est d'abord **l'arrêt du défilement avant la troisième
seconde, sans le son**. Sur ce critère, seule la direction nerveuse met un mot
lisible et reconnaissable dans la première demi-seconde (« LE SOIR. »), puis
nomme la douleur en toutes lettres en 2,3 secondes : les devis, la TVA, les
gars qui appellent. L'objet est le plus beau, mais son accroche met une seconde
et demie à se lire ; la journée est la plus claire, mais elle demande qu'on
lise une heure et une phrase avant de comprendre.

Ce que la direction nerveuse ne tient pas seule : 35 secondes de coupes sur le
temps fatiguent, et le téléphone n'y a jamais le temps d'être beau. D'où la
seconde moitié de la recommandation : après l'impact du « 30 », le film se
calme et prend le traitement de l'objet pour les quatre piliers, avec les
raccords en perspective (la feuille, la case, la fiche, la facture), et une
seule montée vers la déflagration finale.

**Confiance : moyenne.** Ce qui la ferait changer : votre goût. Si ce que vous
imaginez en disant « digne des plus grandes pubs » est un objet dans la
lumière, c'est l'objet seul, et son accroche se resserre (le texte en 0,8 s au
lieu de 1,5). Si c'est le récit d'une journée qui vous parle, c'est la
journée, et l'horloge devient le fil de tout le film.

---

## 5. D'où vient chaque chose affichée

| Ce qui s'affiche | D'où ça vient |
|---|---|
| « 20 minutes de bureau après chaque visite de chantier » | `docs/AGENT.md` §1 : *« les vingt minutes de bureau qui suivent chaque visite de chantier doivent devenir trente secondes de relecture »* |
| « 30 secondes » | même phrase, même source |
| « Le soir. Les devis à retaper. La TVA. Les gars qui appellent. », « Encore un devis à retaper. » | votre brief du 4 octobre : *« la douleur du soir (retaper les devis, les papiers, la TVA, les gars qui appellent pour savoir où aller) »* |
| « 21 h 40 », « 8 h 05 », « 8 h 06 » | une mise en scène, pas une promesse : l'heure d'une soirée et d'un matin de chantier. Aucun chiffre d'usage n'est affirmé |
| « Chez madame Martin, au 8 impasse du Moulin : élagage du grand chêne, une quinzaine de mètres, en taille douce. » | la transcription réelle de la dictée du jeu de démonstration, telle que l'application l'a écrite (`appli/video-promo/film/transcription.jpg`) |
| la ligne « Élagage d'un chêne de 15 m, taille douce, 1 200,00 €, 1 440,00 € » | le PDF du devis n° 2026-000001 du jeu de démonstration (`devis-pdf.jpg`), sans retouche |
| tout ce qui est dans le téléphone | des captures de l'application servie, prises en jouant le geste (voir §7) |
| aucun prix d'abonnement | comme demandé |

---

## 6. Le cahier du son

**Personne n'a écouté la bande ici** : cet environnement n'a pas de
haut-parleur. La bande livrée est synthétisée (`scripts/musique-film.py`),
dans une seule tonalité, pour qu'elle ne puisse pas être fausse ; elle sert à
sentir le rythme, pas à être gardée. La version muette est à côté.

**Comment le film et le son se tiennent.** Chaque page déclare sa **carte des
temps forts** (`window.SONS` : l'instant de chaque coup, chaque appui, chaque
raccord) et sa **carte musicale** (`window.MUSIQUE` : tempo, tonalité,
sections). Le rendu les écrit dans un fichier (`rendre-film.mjs --sons`), et
c'est ce fichier qu'on donne à qui pose le vrai son : chaque impact a son
instant au centième.

| | L'objet | Le coup de poing | La journée |
|---|---|---|---|
| **durée** | 8,0 s (film entier : 32 à 36 s) | 8,0 s (film entier : 30 à 34 s) | 8,0 s (film entier : 36 à 40 s) |
| **tempo** | 72 à la noire, ré majeur | 128 à la noire, si mineur puis ré majeur | 92 à la noire, si mineur (nuit) puis ré majeur (matin) |
| **style** | silence, nappe grave, un arpège de piano feutré ; une seule cymbale inversée avant l'éveil de l'écran | pulsation électronique sourde sur chaque temps, coupes sèches, un silence d'un temps avant l'impact, charley serré pendant la dictée | nappe froide, tic d'horloge, bascule chaude avec un arpège de cordes pincées ; la basse n'entre qu'au raccord |
| **les impacts** | 1,9 s le téléphone entre ; 3,0 s l'écran s'éveille ; 4,55 s et 5,35 s les appuis ; 7,05 s le raccord ; 7,55 s le total | 0,47 s par temps de 0 à 2,34 s (cinq coups) ; 2,81 s le téléphone claque ; 3,28 s « secondes » ; 6,56 s le filé ; 7,03 s « Devis » ; 7,5 s « Prêt » | 2,0 s l'heure roule ; 3,0 s le matin ; 3,55 s et 4,3 s les appuis ; 6,4 s « 8 h 06 » ; 7,1 s « Le devis est prêt » |

Le détail exact, avec le genre de chaque son, est dans les fichiers
`sons.json` que le rendu écrit (un par direction) ; ils se régénèrent en une
commande.

**Pour le film entier**, quelle que soit la direction : une courbe, pas un
tapis. Silence ou presque sur l'accroche (0 à 3 s) ; UN impact à la bascule ;
une montée régulière sur les quatre piliers (chaque raccord tombe sur un temps
fort) ; un trou de silence d'une demi-seconde avant la signature ; la
déflagration sur « Atlas ». Une musique sous licence qui fait ça : tout
morceau de « lancement » à 90 ou 128 à la noire, instrumental, sans voix. La
carte des temps forts dit où caler ses accents.

**Un texte de voix off, 30 secondes, s'il en veut une** (82 mots, rythme calme) :

> Le soir, après le chantier, il reste les devis. La TVA. Les gars qui
> appellent pour savoir où aller demain.
>
> Avec Atlas, vous dictez sur place. Le devis s'écrit. Votre client accepte,
> et le chantier tombe au planning.
>
> Vos gars ouvrent leur fiche : l'adresse, les travaux, sans vous appeler.
>
> Chantier terminé : la facture reprend le devis, la TVA se calcule toute
> seule.
>
> Trente secondes. Et le soir, le téléphone reste posé.
>
> Atlas.

---

## 7. Les captures qui manquaient, et l'écran que j'ai retenu pour « la fiche des gars »

**La fiche de chantier du planning pour les gars**, c'est **la fiche
d'intervention** : sur le planning, toucher le chantier du jour ouvre une
carte cernée d'or, « Fiche d'intervention », avec le nom du client, Maps,
Waze, Copier l'adresse, Appeler le client, la note, la fiche de sécurité, et le
bandeau « Travaux à faire » qui déplie les lignes du devis en cases à cocher,
avec « Envoyer le retour du jour », puis « Ouvrir le devis sans les prix ».
C'est le seul écran qu'un salarié atteint (`docs/QUESTIONS.md` §10 : *« les
salariés auront accès qu'à la catégorie planning »*), et il a été capturé
**aussi depuis un compte salarié**, sans un prix.

Il existe deux autres choses qui portent le nom « fiche de chantier », et je
ne les ai pas retenues : le PDF « Fiche de chantier » (ce qui a été fait, sans
prix, pour le client : `src/server/pdf/fiche-chantier-pdf.ts`), et l'outil
« Fiche de chantier » de Paysage (le compte rendu de passage, fermé aux
salariés). Si c'est l'un des deux que vous appeliez ainsi, dites-le : les
captures de la fiche d'intervention restent utiles pour le pilier « les gars ».

| Capture | Ce qu'elle montre |
|---|---|
| `planning-jour.jpg` | octobre 2026, le 13 touché, « MARDI 13 OCTOBRE », Élagage d'un chêne, une journée, Rezé, matin et après-midi Julien / Malik |
| `fiche-intervention-ecran.jpg`, `fiche-intervention.jpg` | la fiche d'intervention, « Travaux à faire » fermé |
| `fiche-intervention-ouverte.jpg`, `fiche-intervention-cochee.jpg` | les trois lignes du devis en cases, puis deux sur trois cochées |
| `planning-salarie.jpg`, `fiche-intervention-salarie.jpg` | la même, vue par Julien, salarié |
| `feuille-sans-prix.jpg` | le PDF « Feuille de chantier » sans un prix, en 300 points par pouce |
| `facture-emise.jpg` | la facture F2026-000001 : Total HT 2 340,00, TVA 20 % 468,00, Total TTC 2 808,00 € |
| `facture-pdf.jpg` | le PDF de la facture, avec la table BASE HT / TAUX / TVA, en 300 points par pouce |
| `tva.jpg`, `tva-collectee.jpg` | « Ma TVA » d'octobre 2026, 468,00 € ; la calculette, taux par taux |

**Le jeu de démonstration est désormais dans le dépôt** : `scripts/preparer-jeu-du-film.mts`
le reconstruit en jouant les gestes dans un vrai navigateur (la fiche client,
les trois lignes, l'envoi, la cliente qui accepte le 13 octobre), et
`scripts/capturer-ecrans-du-film.mts` reprend toutes ces captures à l'échelle 3.
C'était la dette laissée par la version C.

**Un seul taux de TVA.** Le chantier de démonstration est à 20 %, donc la
table « par taux » n'a qu'une ligne. Rien n'a été inventé pour en montrer deux :
un élagage est à 20 %.

---

## 8. Ce qui a été fait autrement que le brief, et pourquoi

| Le brief | Ce qui a été fait |
|---|---|
| « Three.js ou CSS 3D » | CSS 3D. Le rendu se fait dans un Chromium sans carte graphique ; un téléphone en WebGL y aurait coûté dix fois plus par image, pour un verre qu'on ne distingue pas à cette taille. L'épaisseur est modelée (quatre faces, quatre coins), la lumière calculée |
| « flou de mouvement » | rendu pour de vrai : deux sous-images par image, moyennées (`rendre-film.mjs --obturateur 2`). Trois coûtaient le double pour un gain invisible à 60 images par seconde |
| « grain léger » | posé par ffmpeg au rendu, à graine fixe (`--grain 8`). Dans la page, il coûtait une demi-seconde par image à capturer |
| « 1920 × 1080 si le temps le permet » | pas fait : on ne décline pas trois directions en deux formats avant d'en avoir choisi une |
| « demande-lui avec une capture de chacun » (la fiche des gars) | retenu la fiche d'intervention sans attendre (§7), parce que c'est le seul écran du planning qu'un salarié voit ; les deux autres candidats sont nommés pour qu'il corrige en un mot |
| « le film complet » | pas avant son choix : c'est la règle du dépôt, et celle du brief lui-même |

**Ce que la version C disait de faux, corrigé noir sur blanc :** rien dans ses
chiffres. Son défaut était de forme, pas de fond.

---

## 9. Ce qui reste, et qui peut le trancher

| | Qui |
|---|---|
| choisir la direction, le nom, l'adresse de fin, la voix | le patron |
| écouter la bande de travail et dire si le rythme est le bon | le patron (rien n'est audible ici) |
| le film entier dans la direction choisie, 32 à 40 s, avec les quatre piliers | la session suivante, un rendu d'une heure |
| le vrai son, sous licence ou enregistré, sur la carte des temps forts | un musicien ou une banque de musique, avec `sons.json` |
| la déclinaison 1920 × 1080 | après le film vertical |
| pousser sur `main` | sur son accord seulement |

**Pour refaire un essai** (chacun prend dix minutes de rendu) :

```
node scripts/rendre-film.mjs appli/video-promo/film/essai-D-apple.html --planche /tmp/p.png --pas 0.25
node scripts/rendre-film.mjs appli/video-promo/film/essai-D-apple.html --ips 60 --obturateur 2 --grain 8 --sons sons.json --sortie muet.mp4
python3 scripts/musique-film.py --sons sons.json --sortie bande.wav
ffmpeg -i muet.mp4 -i bande.wav -c:v copy -c:a aac -shortest essai.mp4
```
