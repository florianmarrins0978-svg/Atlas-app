# Le catalogue d'arrosage confronté à Aqua Plus 2026

Relevé le 16 octobre 2026 sur `Catalogue-Aquaplus-2026.pdf`, page par page. Aucun
prix n'est recopié ici.

Les pages citées sont celles imprimées en bas du PDF (« Page 13 »).

## Ce que tu as tranché, et ce qui est fait

| Question | Ta réponse | Où on en est |
|---|---|---|
| 1. La 6,0 Portée+ | oui, 1,36 | **fait** dans le catalogue. Sur le calcul de `main` (celui de l'autre session, fusionné le 16 octobre), aucun plan ne bouge sur 528 jardins essayés |
| 2. Dura ou Plasson | tes fiches de nourrice et ta planche du réseau font foi | **rien ne change**, j'avais tort de les mettre en doute |
| 3. Le tube Ø25 | tes photos : Elydan 25×3.0, Alfatubo 32×3.0 | déjà codé par la branche `tubes-arrosage`, je n'y touche pas |
| 4. Les références de buses inventées | corrige-les, rien ne doit être inventé | **fait** : 43 buses de turbine n'ont plus ni référence ni colisage à elles. Aucune n'est supprimée |
| 5. Le bridage | la règle d'Aqua Plus, la tienne disparaît | dans `TODO.md` : c'est le calcul de l'autre session, à faire une fois sur `main` |
| 6. La sonde de pluie | en option, la Rain Bird filaire blanche (RSD-Bex, RP403) | dans `TODO.md`, et la case entre dans la planche de l'écran |
| 7. 8-VAN et SRS 7A | les chiffres d'Aqua Plus, ou une source sûre | 8-VAN : la fiche Rain Bird donne les mêmes chiffres, **le doute est levé**. SRS 7A : le site Hunter refuse l'accès, on garde Aqua Plus |
| Les 4, 6 et 8-VAN à 330° | oui, coins et bords seulement | **pas encore fait**, voir plus bas |
| Les six provisoires | pas encore répondu | voir la partie 4 |

**Pourquoi les VAN à 330° ne sont pas encore corrigées.** Je l'ai fait, et ta
règle du couloir a rougi : ton couloir de 10 × 2 perdait ses 7 6-VAN pour 5
10-VAN qui arrosent 70 cm au-delà du couloir. La raison : l'outil écarte toute
buse sans chiffre à 360°, même pour une zone où elle ne pose que des bords.
Ça se corrige dans le calcul, que l'autre session réécrit. J'ai donc remis le
360° en attendant, et c'est écrit dans le code et dans `TODO.md`.

**Les contrôles joués sur ce lot**, sans batterie à ta demande : le contrôle
du catalogue, le calcul d'arrosage, tes règles (21 sur 21), les consignes de la
discussion, le tracé, les deux maquettes d'arrosage, les tirets, les
pansements, le code mort. Tous verts.

## 1. Ce qui est faux

| Référence | Le catalogue dit | Aqua Plus dit | Page |
|---|---|---|---|
| RA5004 buse 6,0 Portée+ | 0,92 m³/h à 13,70 m | **1,36 m³/h** à 13,70 m | 13 |
| Té taraudé 25×3/4"×25 | marque Dura | Plasson, OPL71402520 | 31 |
| Coude taraudé 25×3/4" | marque Dura | Plasson, OPL71502520 | 33 |
| Té 25×25×25 | marque Dura | Plasson, OPL704025 | 30 |
| Raccord mâle 25 1" | marque Dura | Plasson, OPL70202526 | 29 |
| Té 1" de la nourrice | « Té 1" MMF » | « DURA Té 1" MFF », ODU301010 | 20 |
| Union de la nourrice | « Union droite taraudée MM 1" » | « DURA Union 1" MF », ODU34MF | 20 |
| Coude MM 1" de la nourrice | « Coude 90° taraudé MM 1" » | Dura ne vend que MF (ODU306009) et FF (ODU306010) | 20 |
| Regard rectangle 12" | marque Dura | RG17100, série VB Carson Nike Rain Bird | 21 |
| Régulateur FF 3/4" | marque Dura | BRP870500, laiton, 1 à 3 m³/h | 54 |
| Électrovanne DV | débit de 0,05 à 9,08 m³/h, de 1 à 10 bar | **0,75** à 9,1 m³/h, de 1,0 à 10,4 bar | 19 |

**La 6,0 Portée+ change le calcul.** Avec 1,36 m³/h, elle consomme presque la
moitié de plus que ce que l'outil compte. Un plan qui la pose aujourd'hui met
trop de têtes sur une vanne.

**Pour les marques des raccords**, il est possible que tu achètes du Dura
ailleurs et que tes fiches viennent de là. Aqua Plus vend ces quatre pièces
sous Plasson. À toi de dire laquelle est la bonne.

## 2. Les tuyaux : Aqua Plus contredit la branche des tubes

| | Branche `tubes-arrosage` (tes photos) | Aqua Plus | Page |
|---|---|---|---|
| Ø25 | Elydan 25×3.0, passage 19,0 mm | UPE225, PE80 10 bars, **20,4 × 25** | 47 |
| Ø32 | Alfatubo 32×3.0, passage 26,0 mm | UPE232, PE80 10 bars, **26,2 × 32** | 47 |
| Ø16 | « PEBD rigide Ø16 », marque Dura | UPE1116, PEBD 6,3 bars, **12 × 16** | 14 et 47 |

Les deux sont vrais : ce sont deux tubes différents. Le passage change le
plafond d'un réseau en Ø25 (1,53 m³/h avec le tien, 1,76 avec celui d'Aqua Plus).
**Tant que tu n'as pas dit lequel tu poses, je garde le plus étroit, le tien :**
c'est le côté sûr.

## 3. Ce qui est juste, chiffre par chiffre

| Famille | Références | Ce qui a été comparé | Page |
|---|---|---|---|
| Buses VAN | RBT648, 601, 636, 637, 638, 639, 640 | portée, débits à 90°, 180°, 270° et 360°, 2 bar, par 25 | 8 |
| Buses R-VAN | RBT1418, 1419, 1428, 1429, 1438, 1439 | portée, débits, 2,4 bar, par 25 | 8 |
| Buses Hunter SRS | HBT1559 à HBT1563 | portée, débits à 5 angles, 2,1 bar, par 25 | 9 |
| PGP-ADJ | buses 1 à 7 | portée, débit, 2,8 bar | 13 |
| PGP Ultra | buses 1,5 à 8 | portée, débit, 3 bar | 13 |
| 5000 Plus | buses u+ et Portée+, sauf la 6,0 | portée, débit, 2,5 bar | 13 |
| 5000 Plus MPR | RBA2195, 2196, 2197 | portée, par 10, aucun débit chez Aqua Plus non plus | 13 |
| Mini 8 | buses 0,75 à 2,0 | portée, débit, 2,5 bar | 11 |
| 3504 | buses 0,75 à 4,0 | portée, débit, 2,5 bar | 11 |
| SRM-04 | buses 0,50 à 3,0 | portée, débit, 2,8 bar | 11 |
| PGJ | buses 0,75 à 3,0 | portée, débit, 2,8 bar | 11 |
| Tuyères 1800 | RT1802 à RT1832 | hauteur, SAM, PRS à 2,1 bar, 1/2" | 7 |
| Pro-Spray, I-Spray | HT1541 à HT1546, HT1521 à HT1523 | hauteur, régulateur, 1/2" | 9 |
| Corps de turbine | HA2211, HA2210, RA2181, RA5004FC, RA5006PC, RA5012PCSAM, TAMINI8-4P, RA3504, RA3504SAM, HA2264, HA2274, HA2272 | hauteur, 3/4" ou 1/2", nombre de buses livrées | 11 et 13 |
| Coudes SBE | OD501, OD502 | 16 × 1/2" et 16 × 3/4" coudés | 14 |
| Électrovannes 9 V | 100-DV 1" MM 9V (REV100DVM9V), FF 9V (REV100DV9V) | 1", 9 V à impulsion | 19 |
| Programmateurs | BL-IP 1, 2, 4, 6 stations 9 V (SP1721, SP1722, SP1724, SP1726) | stations, 9 V | 26 |
| Pile | ELD60481, pile alcaline 9V 6LR61 | 9 V | 27 |
| Regard Jumbo | RG17106 | référence | 21 |

## 4. Les entrées douteuses, une par une

| Entrée | Ce qu'Aqua Plus dit | Verdict |
|---|---|---|
| 8-VAN, 0,16 m³/h à 90° | **0,16 aussi** | ce n'est pas une faute de recopie : le chiffre douteux est dans le catalogue Aqua Plus lui-même. Seule la fiche Rain Bird peut trancher |
| SRS 7A et 10A | **les mêmes débits** pour 2,1 m et 3,0 m | même chose : recopié juste, douteux à la source |
| R-VAN réglables, 270° absent | **absent aussi** | le tableau n'a pas de ligne 270°. Rien à corriger |
| 5000 Plus MPR, aucun débit | **aucun débit** | confirmé. Elles restent hors du calcul |
| 5000 Plus 6,0 Portée+ à 0,92 | **1,36** | faux, voir la partie 1 |
| Tuyaux PEHD Ø25 et Ø32 provisoires | 20,4 et 26,2 mm | voir la partie 2 |
| Électrovanne 9 V provisoire | 100-DV 1" MM 9V, REV100DVM9V | elle peut devenir une vraie référence |
| Regard de vannes provisoire | RG17100, regard rectangle 12" | idem |
| Disconnecteur provisoire | SOCLA BA 2860, de 3/4" à 2" | idem, une taille par diamètre |
| Réducteur de pression provisoire | BRP870500 à BRP870800, de 3/4" à 1"1/2 | idem |
| Sonde de pluie provisoire | RSD-Bex (RP403), Mini-Clik (HPMINICLIK), WR2 sans fil (RP6231) | il faut que tu choisisses celle que tu branches sur tes BL-IP |
| Gaine de goutte-à-goutte provisoire | UGGRBXFS, « tube Ø16mm 2,3l/h esp.33cm autorégulé enterrable » | **les mêmes chiffres.** La pluviométrie (23 mm/h), elle, n'est nulle part |
| Turbine et tuyère génériques | rien | elles ne servent plus que de secours caché |

## 5. Ce qui est introuvable chez Aqua Plus (rien n'est effacé)

| Entrée | Ce qui manque |
|---|---|
| « Regard jumbo 5 voies », « Regard jumbo 6 voies » | aucun regard ne porte ce nom. Aqua Plus vend le Jumbo VB1220, le Super Jumbo VB1324 et le Maxi Jumbo VB1730 |
| « Clarinette taraudée 1" pour 2, 3, 4 vannes » | Aqua Plus vend des « DURA Collecteur M x F x 2, 3, 4 sorties 1" » (ODU3010102 à 104). Peut-être les mêmes pièces sous un autre nom |
| « Vanne avec vis de purge 3/4" », Dura | Aqua Plus vend une « vanne 1/4 de tour + purge FF 3/4" » (BVA932), sans marque |
| Les références de buses de turbine | **voir ci-dessous** |

**Une référence que j'ai trouvée inventée.** Les buses de turbine portent des
références comme `RA5004-B3u`, `HA2211-B4`, `TAMINI8-B075`. Aqua Plus n'en
vend aucune : les buses sont livrées avec l'arroseur. Ces références ont été
fabriquées dans le dépôt, et l'outil les affiche comme des références relevées.
C'est exactement ce que tu as interdit le 22 août.

## 6. Ce que le catalogue Aqua Plus dit du réglage à la vis

Ta règle : les tuyères ne se brident jamais, les turbines jusqu'à 40 %. Ce
que le catalogue imprime :

| Matériel | Ce qu'Aqua Plus écrit | Page |
|---|---|---|
| Mini 8 | « Réduction portée de 25% par vis brise jet » | 11 |
| 3504 | « Vis brise jet jusqu'à 35% » | 11 |
| 5000 Plus | « Vis brise jet permettant de réduire la portée de 25% » | 13 |
| Buses Toro 570Z, tuyères | « réduction de 25% de la portée » | 5 |
| Buses Rain Bird MPR, tuyères | « Vis de réglage permet une réduction de la portée et du débit » | 7 |

Ta règle ne bouge pas. Mais pour trois turbines, le constructeur annonce moins
que 40 %. Un plan qui bride une 5000 Plus à 40 % lui demande ce qu'elle ne sait
pas faire.

## 7. Ce que tu dois trancher

1. **La 6,0 Portée+** : je corrige à 1,36 ?
2. **Les raccords du réseau** : Dura ou Plasson ?
3. **Le tube Ø25** : ton Elydan 25×3.0 ou l'UPE225 d'Aqua Plus ?
4. **Les références de buses fabriquées** : je les retire de l'écran, et la
   liste dit « buse 3,0, livrée avec l'arroseur RA2181 » ?
5. **Le bridage** : 40 % partout, ou le chiffre du constructeur quand il est
   plus petit (25 % ou 35 %) ?
6. **Les provisoires** : je les remplace par les références Aqua Plus de la
   partie 4 ? Pour la sonde, laquelle ?
7. **8-VAN et SRS 7A** : on garde le chiffre Aqua Plus, ou tu as la fiche
   Rain Bird ou Hunter ?

## 8. Trois fautes de recopie dans le dépôt, sans effet sur le calcul

| Où | Ce qui est écrit | Ce qui est vrai |
|---|---|---|
| `catalogue.js`, R-VAN | « Aqua Plus 2026, p. 9 bis » | page 8 |
| `catalogue.js`, tuyères 1800 | « Aqua Plus 2026, p. 8 » | page 7 |
| `catalogue.js`, commentaire sur la 6-VAN | « 0,27 à 90° » | 0,08 à 90°, 0,27 à 360° |
