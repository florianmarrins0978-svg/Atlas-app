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
| **espacement** | 60 % du diamètre au plus, soit 1,2 fois la portée (recouvrement 83 %) ; 55 % sans vent ; 50 %, tête à tête, l'usage courant (p. 41 et 42) | 80 à 100 % de recouvrement (jusqu'à 1,25 fois la portée), 75 % s'il fait gagner un réseau ou une gamme (1,33 fois la portée) | l'outil espace au-delà du maximum Rain Bird : 4 % plus loin à 80 %, 11 % plus loin à 75 % |
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
4. **L'espacement.** Sa règle de 80 % dépasse de peu le maximum Rain Bird,
   celle de 75 % nettement. C'est son expérience contre le texte du fabricant.
