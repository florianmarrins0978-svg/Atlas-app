# Le manuel de conception Rain Bird, lu le 22 novembre 2026

**Le document.** *Landscape Irrigation Design Manual*, Rain Bird Corporation,
140 pages, en anglais, unités américaines doublées en unités SI. Fichier reçu du
patron le 22 novembre 2026 sous le nom `IrrigationDesignManual.pdf`, empreinte
sha256 `547fc9849a6771d9faba0190d806773dfcbe1671cb49a4cc684e4b0de72ed038`.
Le PDF n'est pas versé au dépôt (3 Mo, texte de Rain Bird) : ce relevé en garde
ce qui sert, avec les pages.

**Avant ce jour, il n'avait jamais été lu.** Le dépôt ne le citait nulle part ;
les seules sources Rain Bird du calcul sont la fiche des buses VAN (p. 27) et le
catalogue Valves (p. 89, la perte de la 100-DV).

Les pages citées sont celles imprimées dans le manuel (page du PDF moins 8).

## Ce qui sert à l'outil

| | Le manuel | L'outil au 22 novembre 2026 | L'écart |
|---|---|---|---|
| **coefficient C du PE** | **140** pour le polyéthylène, 150 pour le PVC (tables p. 100 et 113) | 150 pour le PE (`perteDeCharge`, `calcul.js`), sans source relevée | l'outil compte la perte de ligne 1,136 fois trop basse, soit 12 % de moins que Rain Bird |
| **dénivelé** | 1 m de dénivelé vaut 0,1 bar (p. 3 à 5 ; la physique donne 0,098) ; une montée s'ajoute aux pertes, une descente s'en retranche (p. 71) | **rien** : aucun calcul ne porte de pente | une tête 2 m au-dessus de la nourrice perd 0,2 bar que l'outil ne voit pas, l'ordre de grandeur de toute la perte d'une ligne |
| **raccords** | 10 % des pertes de tuyau, donné comme estimation (p. 71) | 15 % du linéaire, écrit « non relevée » | l'outil est au-dessus de Rain Bird, donc du côté sûr ; le 15 % a désormais une borne publiée |
| **vitesse** | 1,5 m/s au plus, « établi par la profession » contre les coups de bélier (p. 6) | plafond retiré le 16 octobre 2026, sur sa décision | le commentaire de `calcul.js` dit « ce plafond était le NÔTRE » : c'est faux, c'est la règle écrite du fabricant |
| **espacement** (corrigé, voir plus bas) | sans vent : 55 % du diamètre en **carré**, soit 1,1 fois la portée (recouvrement 91 %) ; 60 % en **triangle**, soit 1,2 fois (83 %) ; 50 %, tête à tête, l'usage courant (p. 41 à 43) | 80 à 100 % de recouvrement (jusqu'à 1,25 fois la portée), 75 % s'il fait gagner un réseau ou une gamme (1,33 fois la portée) | ses turbines se posent alignées, donc en carré : l'outil espace 14 % plus loin que Rain Bird à 80 %, 21 % plus loin à 75 % ; ses tuyères en damier, 4 % et 11 % |
| **méthode** | partir du pire arroseur du pire réseau et remonter en additionnant les pertes (p. 69 à 71) | la même (`pirePerteDeReseau`, débit décroissant tronçon par tronçon) | concordant |

**Recoupement de la formule.** La table PE de Rain Bird (C = 140, colonne
« 25 mm », diamètre intérieur 26,64 mm) se retrouve à 2 % près par la formule de
l'outil passée à C = 140 :

| débit | Rain Bird | outil à C = 140 | outil à C = 150 (aujourd'hui) |
|---|---|---|---|
| 0,454 m³/h | 0,032 bar / 100 m | 0,031 | 0,027 |
| 1,134 m³/h | 0,172 | 0,169 | 0,149 |
| 1,588 m³/h | 0,319 | 0,315 | 0,277 |

La formule est donc juste ; seul le coefficient diffère.

**Corrigé le 22 novembre 2026, le même jour.** La première version de ce relevé,
et la réponse faite au patron, donnaient 1,2 fois la portée comme maximum
Rain Bird, « 1,1 sans vent ». C'était faux : 1,2 est le maximum du TRIANGLE
sans vent ; en CARRÉ, la pose de ses turbines (sa réponse « la A » du
11 septembre 2026), c'est 1,1 même sans vent. L'écart avec sa règle des 80 %
est donc trois fois plus grand que ce qui lui avait été annoncé.

## Quand passer en Ø32 : ce que dit le manuel (p. 65 à 68)

**Sa règle à lui** : chaque tronçon se dimensionne pour le débit qu'IL porte, en
partant de la dernière tête et en remontant vers la vanne, sans dépasser
1,5 m/s ; puis l'on vérifie la pression au pire arroseur. Sur ses tubes, un
tronçon qui porte plus de **1,53 m³/h** passe en Ø32 (qui porte **2,87 m³/h**
au plus).

**L'outil aujourd'hui** : sur un réseau, jamais d'office (sa règle du
20 octobre 2026 : un réseau de plus d'abord, le Ø32 sur son choix, pour le
réseau entier) ; sur l'amenée, il le propose quand la perte mange le budget, et
donne le seuil en mètres (`longueurMaxEn`).

**Ce que le manuel ajoute, chiffré avec la formule de l'outil** (réseau de
6 têtes à 0,3 m³/h, 10 m de la nourrice à la première, 8 m entre têtes, perte
de la seule ligne) :

| la pose | perte de ligne | Ø32 posé |
|---|---|---|
| tout en Ø25 | 0,42 bar | 0 m |
| le seul trajet nourrice, première tête en Ø32, puis un manchon réduit 32 x 25 (OPL71103225, Aqua Plus p. 28) | 0,28 bar | 10 m |
| tout en Ø32 | 0,09 bar | 50 m |
| tout en Ø25, alimenté **par le milieu** (nourrice en face du milieu, un té égal, deux branches de 3 têtes) | 0,23 bar | 0 m |

1. **Le Ø32 sur les seuls tronçons chargés** : le premier tronçon porte tout le
   débit, et la perte croît comme le débit à la puissance 1,852. Dans cet
   exemple il passe 1,76 m/s dans le Ø25 du trajet : Rain Bird le mettrait en
   Ø32, et lui seul. **REFUSÉ par le patron le 22 novembre 2026** : *« c'est
   soit on fait tout les réseau en 32 soit tout en 25 mais pas de 32 jusqu'au
   1er arroseur puis 25 jamais ! »* Et ce n'est pas réseau par réseau, comme je
   l'avais d'abord lu : **tous les réseaux d'une nourrice ont le même
   diamètre** (*« pas un réseau en 25 et un en 32 »*), et si le Ø32 permet un
   réseau de moins, ce sont tous les réseaux restants en Ø32. Ne pas
   reproposer de mélange (`.claude/rules/arrosage.md`).
2. **Alimenter le réseau par le milieu** (p. 66 : *« eliminated the need for the
   two larger pipe sizes »*, et moins d'écart de pression entre les têtes).
   Chaque branche porte la moitié du débit. Le calcul de l'outil
   (`perteDuReseau`) suit les têtes en une seule file : un réseau alimenté au
   milieu y est compté comme une seule ligne. La perte est surestimée, ce qui
   est le sens sûr, mais peut ajouter un réseau qui ne servait à rien.
3. **Le seuil affiché est trop généreux** : à 1,5 m³/h et 0,5 bar de budget, le
   Ø25 tient 39 m à C = 150, 34 m à C = 140, et 27 m avec 1 m de montée en plus.

## Le piège : ses tables ne se lisent pas pour nos tubes

La colonne « 25 mm » de la table PE est un tube américain 1 pouce IPS, de
26,6 mm de passage. Son Ø25 Polybleu 25×3.0 en a 19,0. **Lire cette colonne
pour son tube sous-estime la perte d'un facteur 5,2.** Même chose pour toutes
les tables du manuel : seule la formule sert, avec le diamètre intérieur relevé
sur SON tube.

## Ce qui ne sert pas

| | Pourquoi |
|---|---|
| pertes des compteurs AWWA (p. 106 et 119) | compteurs américains ; la pression dynamique se mesure déjà au kit buse 5 (`mesure-debit.ts`) |
| longueurs équivalentes des raccords (p. 103 et 116) | acier et cuivre, pas des raccords à compression sur du PE |
| pluviométrie, durées, ETP, sols (p. 19 à 23, 41 à 47, 58 et 59) | retirés de l'outil sur ses décisions du 23 août et du 18 octobre 2026 |
| disconnecteurs (p. 69 à 71) | retirés le 18 août 2026, il n'en pose pas |
| sections de câble en 24 V (p. 75 à 80) | ses programmateurs sont à pile ; ne servirait qu'à un programmateur sur secteur |

## Ce qui reste à trancher, par lui

1. **Passer le PE à C = 140.** Sa règle : une perte inconnue se prend la plus
   forte. Le 150 n'a aucune source ; le 140 est celle du fabricant. Réserve : la
   table Rain Bird vise des PE anciens (2306, 3206, 3306), et un PE100 récent est
   peut-être plus lisse. Effet : un plan à la limite peut prendre une vanne de
   plus.
2. **Compter le dénivelé.** Il faut une saisie (ou une lecture sur le croquis)
   de la hauteur du dernier arroseur par rapport à la nourrice. Tant qu'il n'est
   pas compté, sa règle 3 veut qu'une réserve le dise sous le plan (l'écran n'a
   pas été regardé le 22 novembre : pas vérifié s'il le dit déjà).
3. **La vitesse.** Le plafond retiré était la règle du fabricant. Son retrait
   tient tant qu'il le décide ; une réserve « plus de 1,5 m/s dans ce réseau »,
   qui n'ajoute aucune vanne, serait l'entre-deux.
4. **L'espacement : TRANCHÉ le 22 novembre 2026**, *« Non prend les écartement
   de rainbird »*. Reste le vent, et le coût ci-dessous à lui montrer avant de
   coder.

5. **Le réseau alimenté par le milieu.** Une façon de gagner de la pression
   sans ajouter de réseau ni passer le réseau en Ø32. Elle change le calcul et
   le plan : planche d'abord (`CLAUDE.md` §3 bis). Le Ø32 par tronçon, lui, est
   refusé (point 1 ci-dessus).

## Ce que coûtent les écartements Rain Bird sur ses jardins

Essai du 22 novembre 2026 : le calcul de l'outil, `RECOUVREMENT_MIN` passé de
0,80 à 1 ÷ 1,1 (carré sans vent) puis à 1,0 (tête à tête), le reste inchangé,
source à 1,8 m³/h et 3 bar. **Approché** : la règle du triangle n'y est pas
codée (le damier des tuyères en sort faux, d'où l'absence des couloirs).

| jardin | aujourd'hui (80 %) | Rain Bird sans vent | Rain Bird tête à tête |
|---|---|---|---|
| carré 12 × 12 | 9 turbines, 1 réseau | 9 turbines, **2 réseaux** | 9, 2 |
| pelouse 20 × 12 à 3,7 bar | 12, 2 | 12, 2 | **24, 3** |
| pelouse 18 × 12 | 12, 2 | 12, 2 | 12, 2 |
| pelouse 16 × 10 | 6, 1 | **12, 2** | 24, 3 |
| pelouse 30 × 22 | 12, 2 | **20, 3** | 20, 3 |
   C'est son expérience contre le texte du fabricant.

## La page « calcul des taux d'application », lue le 22 novembre 2026

`https://www.rainbird.com/fr/professionnels/conseil-de-conception-pour-systemes-darrosage-calcul-des-taux-dapplication`,
envoyée par le patron. **C'est la traduction des pages 44 à 47 du même
manuel** ; elle le dit elle-même (« Ces conseils sont extraits du manuel de
conception de l'arrosage »). Rien sur les pertes de charge ni sur le diamètre.

| Ce qu'elle dit | Pour l'outil |
|---|---|
| taux d'application (mm/h) = 1 000 × débit versé dans la maille (m³/h) ÷ (S × L) ; en triangle, L = 0,866 × S | la pluviométrie et les durées sont retirées de l'outil (ses décisions des 23 août et 18 octobre 2026) : ne sert pas |
| un arroseur à impact garde **1 m³/h en demi-cercle** comme en plein cercle ; sa pluviométrie double (6,9 puis 13,9 mm/h sur une maille de 12 × 12) | **confirme sa règle du 21 août 2026** : le débit d'une turbine ne dépend pas de son arc |
| des tuyères « à débit proportionnel à la surface » : 0,56 m³/h en plein cercle, 0,28 en demi, 0,14 en quart | **confirme** que le débit d'une tuyère se lit par angle (ses relevés de la 12-VAN) |
