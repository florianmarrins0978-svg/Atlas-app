# La nourrice en 3D, réaliste, avec l'éclaté au toucher

*22 novembre 2026. Ta demande, arrivée dans un texte venu de ChatGPT et lue avant d'agir : « la
nourrice d'arrosage en 3D, vraiment réaliste, avec un éclaté au toucher ».*

**La planche :** `appli/arrosage-nourrice-3d.html`
<https://florianmarrins0978-svg.github.io/Atlas-app/arrosage-nourrice-3d.html>

Rien dans `src/`. C'est le niveau 1 : aucune batterie.

## Le verdict, point par point

| Ce que tu demandais | Verdict | Où le lire |
|---|---|---|
| Des pièces fidèles à tes photos | **fait**, avec des écarts dits plus bas | `appli/nourrice-3d/pieces/` |
| Aucun logo ni texte inventé | **fait** : ni « DURA », ni « VIRAX », ni flèches ON OFF ; les étiquettes jaunes sont des pastilles unies | idem |
| Vrais filetages en hélice, chanfreins, arrondis, cannelures, vis | **fait** | `appli/nourrice-3d/formes.js` |
| Matières physiques : PVC satiné, noir mat, laiton, inox | **fait** | `appli/nourrice-3d/matieres.js` |
| HDRI libre posée dans `appli/vendor/` | **fait, autrement** : Poly Haven est refusé par le réseau de ce poste, elle vient de npm | `appli/vendor/hdri/LISEZMOI.md` |
| ACES, ombres douces, ombre de contact, occlusion ambiante, anticrénelage | **fait** | `appli/nourrice-3d/scene.js` |
| Densité de pixels plafonnée à 2, pièces en instances | **fait** | idem |
| Fluide sur iPhone | **pas vérifiable ici** | voir « Ce qui n'est pas vérifié » |
| L'éclaté au toucher, 2 cm, 0,6 s, chacun sur son axe | **fait, mesuré** | voir « Les contrôles » |
| Les boutons Montée et Éclatée suivent l'état | **fait** | la page |
| Une phrase si le téléphone ne sait pas afficher la 3D | **fait** : trois phrases, selon la cause | la page |
| Un modèle 3D du fabricant si sa licence le permet | **non** : aucune licence ne le permet | voir plus bas |
| Le lien dans `appli/essais.html` | **fait** (le lien existait, son texte est à jour) | `appli/essais.html` |

## Les pièces, une par une

Les noms sont ceux du catalogue. Le sommet du filetage 1" (33,25 mm) sert d'étalon quand la photo en
montre un.

| Pièce | Ta photo | Ce qui est mesuré | Ce qui est estimé |
|---|---|---|---|
| Coude 90° taraudé/fileté MF 1" | `coude-mf-dessus-naturel.png` | le corps de 29,4 mm, son cintre, le col, sept filets, le nez de 3,9 mm | rien |
| Coude 1" FF | `coude-ff-dessus-naturel.png` | le corps de 30,4 mm, ses deux moyeux évasés | rien |
| Té 1" MFF | `te-mmf-dessus-naturel.png` | le corps, la branche, le bossage en losange (sans le nom) | rien |
| L'écrou union, partout | cinq photos | 40 mm de diamètre, 30 de long, huit nervures de 4,6 mm | le dedans (aucune photo) |
| Collecteur M x F x 2, 3, 4 sorties 1" | `clarinette-2v`, `3v`, `4v-dessus-naturel.png` | le tube de 31,2 mm, la première sortie à 70 mm de la bouche, la dernière à 51 mm de la pointe | l'entraxe retenu (100 mm), la profondeur d'une sortie |
| Manchon union 1" FF | `union-ff-dessus-naturel.png` | 94,7 mm, le corps de 25,8, la bague de 27,9 | rien |
| Mamelon réduit fileté MM 1"-3/4" | `mamelon-dessus-naturel.png` | 45,2 mm, le six pans de 39,6 sur plats, la collerette | le pas du 3/4" (la norme, 14 filets au pouce) |
| Mamelon fileté MM 1" | `mamelon-droit-1.jpg` (de trois quarts) | aucune cote : il reprend le côté 1" du réduit | tout |
| Électrovanne 100 DV 1" MM 9V | `electrovanne-100dv-dessus.png`, `electrovanne-100dv.jpg` | les hauteurs et diamètres sur la photo de trois quarts, la place des vis, de la purge et de la bobine | le dessous, le côté caché de la bobine |
| Électrovanne 100 DV 1" FF 9V | `electrovanne-100dv-ff-dessus.png` | ses vis, son bouton de purge, sa bobine carrée | le dessous, la profondeur des bouches |
| Vanne avec vis de purge 3/4" | `vanne-purge-dessus.png` (un profil) | 72,5 mm de long, le fût, la tige, la manette et sa pente, la purge et sa clé | l'échelle (32 mm sur plats), les largeurs de la manette |
| Régulateur de pression FF 3/4" | `regulateur-ff34.jpg` | la couronne, le fût, le corps cannelé, douze nervures | la longueur (131 mm, citée de mémoire d'une fiche) |
| Raccord mâle 25 x 1" | `raccord-male32-dessus.png` | le filetage, les ailettes, la bague cannelée | tout le côté tuyau : c'est le 32 x 1" ramené par 25/32 |
| PEHD Ø25 | `pehd.jpg` | 25 mm, 19 de passage, quatre bandes bleues de 2,8 mm | sa longueur (150 mm, un choix) |

## Ce qui a été fait autrement, et pourquoi

1. **L'HDRI vient de npm, pas de Poly Haven.** Le réseau de ce poste refuse polyhaven.com. Le paquet
   `@pmndrs/assets` (CC0) porte une sélection des HDRI de Poly Haven, ramenées à 512 x 256 : j'ai pris
   son studio photo, 111 ko, sans retouche. Si elle ne se charge pas, la scène garde un éclairage de
   secours et la nourrice reste visible.
2. **Aucun modèle de fabricant.** Cherché, sans pouvoir ouvrir leurs sites (refusés eux aussi) : les
   conclusions viennent de résultats de recherche, la confiance est moyenne.

   | Fabricant | Ce qu'il publie | Utilisable ici |
   |---|---|---|
   | Rain Bird | pour la série DV, des dessins 2D seulement (DWG, DXF) ; ses modèles 3D concernent d'autres vannes | non : pas de modèle, et ses conditions interdisent de reproduire, modifier et afficher |
   | Dura | des catalogues et des fiches PDF | sans objet |
   | Plasson | des fichiers BIM, et un fichier « 07020 CAD » de format inconnu | non : une copie pour usage personnel, sans modification ni mise en ligne |

   Les pièces sont donc modélisées. La voie restante serait un accord écrit du fabricant.
3. **Pas de « réglage de débit » sur l'électrovanne.** Ta photo montre une 100 DV simple : c'est la
   100 DVF qui en porte un. J'ai modélisé ce que ta photo montre (la vis de purge), pas la liste.
4. **La vanne est en laiton nickelé**, comme sur ta photo : un corps satiné argenté. Le laiton jaune se
   voit au presse-étoupe et dans les bouches.
5. **Le régulateur est celui de la fiche** (`regulateur-ff34.jpg`, le noir). `regulateur-dn15-dessus.png`
   est un autre régulateur, nickelé, que la planche vue du dessus écarte aussi. Il est posé le corps
   cannelé côté rangée : la flèche moulée sur ta photo pointe vers le fût.
6. **Un seul écrou union, de 40 mm, partout.** Tes photos le donnent de 37 à 44 mm selon l'angle de
   prise. C'est ta demande du 21 sur la planche à plat : toutes les pièces à la même dimension.
7. **100 mm entre deux sorties, pour les trois collecteurs.** Mesuré 101,3 sur le 2 sorties, 98,3 sur
   le 4, 93,3 sur le 3 (sa photo est quatre fois moins fine). Ce sont trois longueurs d'un même moule :
   un seul entraxe. Le 3 sorties fait donc 321 mm, là où sa photo en donne 295.
8. **La vue passe en premier sur la page**, les boutons dessous : le geste se fait sur la vue, elle ne
   doit pas commencer sous le pli de l'écran.
9. **Deux finesses de pièces.** La plus grande nourrice pesait 870 000 triangles. Jusqu'à 400 000 la
   page prend les pièces fines ; au-delà (quatre voies et plus, à peu près) un jeu plus léger, chaque
   pièce étant alors deux fois plus petite à l'écran.
10. **Le code est rangé dans `appli/nourrice-3d/`**, pas dans la page : les pièces font un millier de
    lignes à elles seules (`ARCHITECTURE.md` §600).

## Ce qui n'est pas fait, et ce qui n'est pas vérifié

- **La fluidité sur iPhone n'est pas vérifiable ici.** Ce poste n'a pas de carte graphique : une image
  y prend une demi-seconde. Ce qui est en place : la densité plafonnée à 2, les pièces pareilles
  dessinées en une fois, rien qui se redessine au repos, les ombres refaites seulement quand les pièces
  bougent, et un régulateur qui baisse la qualité le temps d'un mouvement si l'appareil peine.

  | Nourrice | Triangles |
  |---|---|
  | 1 voie | 167 000 |
  | 3 voies | 332 000 |
  | 3 voies dont 1 en goutte-à-goutte | 369 000 |
  | 6 voies (pièces légères) | 410 000 |
  | 6 voies dont 6 en goutte-à-goutte (pièces légères) | 553 000 |

  **À jouer sur ton iPhone :** ouvre la 6 voies dont 6, tourne-la, éclate-la. Si elle saccade, dis-le :
  il reste de la marge sur les électrovannes (35 000 triangles chacune).
- **Le raccord Plasson est le 32 x 1" réduit.** Aucune de tes photos ne montre le 25 x 1" à plat.
- **Trois cotes ne viennent d'aucune de tes photos** : les 32 mm sur plats de la vanne (son échelle
  entière), les 131 mm du régulateur, la profondeur des bouches taraudées.
- **Le dessous des électrovannes et l'intérieur de la bague Plasson sont inventés** pour qu'on voie un
  fond plausible en tournant : aucune photo ne les montre.
- **Le nickel et les noirs ont un reflet poussé.** Le studio de l'HDRI est sombre autour de ses deux
  sources : réglé pour un PVC gris, il laissait la vanne presque noire. Les métaux et les noirs
  prennent donc plus de l'ambiance que le gris. C'est un réglage à l'oeil.
- **Le contrôle de la page n'est pas dans le dépôt.** Un script sous `scripts/` aurait fait passer le
  lot du niveau 1 au niveau 2. Ce qu'il vérifie est écrit ci-dessous.
- **Un contraste sous le seuil** : les deux petits titres dorés (« Combien de voies ») font 2,8 pour 1
  sur le fond crème. C'est le doré des surtitres de l'appli, celui que tu as choisi : laissé.

## Ce que j'ai dit ou fait de faux en route

- **La page restait sur « Chargement » sans rien dire.** J'avais posé la carte des imports après un
  préchargement de module : le navigateur l'ignore, et le module ne démarre pas. Corrigé, et la page
  dit maintenant tout échec de chargement au lieu d'attendre.
- **Ma mesure des axes s'est trompée deux fois**, sur des pièces parfaitement centrées : de 0,28 mm
  d'abord, puis de 0,2 mm sur le régulateur en pièces légères. Les deux fois elle moyennait des sommets
  mal répartis. Elle cherche maintenant le centre commun des cercles de chaque face de bout, que la
  place des sommets ne peut plus tirer.
- **J'avais dessiné l'écrou à 48 mm.** Mesuré sur tes photos : 40.
- **J'ai demandé de déplacer la bobine de l'électrovanne.** L'agent a montré que ta photo de dessus est
  prise de biais, d'une vingtaine de degrés : la bobine est bien placée, il ne l'a pas bougée, et il
  avait raison.
- **La pointe des mamelons était trouée** : un profil écrit à l'envers, que le compte des faces
  inversées ne voit pas. Vu au rendu, corrigé.
- **Un premier atelier d'agents a été coupé net par la limite d'usage du compte**, avant de rendre son
  rapport. Son travail était sur le disque ; je l'ai repris, et le second atelier a été resserré.

## Les contrôles

Joués dans Chromium sans écran, à 390 points de large, au doigt. **63 contrôles, tous verts.**

| Ce qui est vérifié | Résultat |
|---|---|
| 1 voie, 3 voies dont 1, 6 voies dont 6 : rendues et regardées, montées et éclatées | fait |
| Chaque bout à moins de 0,5 mm de son axe, montée, éclatée et en trois instants du mouvement | pire écart : 0,00003 mm, sur 121 bouts, aux deux finesses |
| Les 27 compositions (1 à 6 voies, 0 à n en goutte-à-goutte) | axes, vissages, largeur : verts |
| 2 cm entre deux pièces, éclatées | 20,00 mm sur tous les écarts |
| Montée, chaque filetage est entré dans la pièce d'en face | recouvrement de 13 à 34 mm |
| Un toucher sur la nourrice l'éclate, un second la remonte | vert |
| Un toucher à côté, un glissé, un appui de plus de 300 ms, un glissé de 8 px | n'éclatent rien |
| Tourner à la main éteint le bouton du point de vue ; un toucher ne l'éteint pas | vert |
| Chaque bouton (montage, point de vue, voies, goutte-à-goutte), et Entrée au clavier | vert |
| La durée de l'éclaté | 0,6 s réglée, confirmée par l'horloge à une image près |
| Console | vide |
| Défilement horizontal à 390 points, et téléphone couché | aucun |
| Sans WebGL, sans import maps, un fichier manquant | la bonne phrase à chaque fois |
| Sans l'HDRI | la nourrice s'affiche avec l'éclairage de secours |
| Mouvements réduits demandés au système | l'éclaté arrive sans trajet |
| Le contexte graphique perdu puis rendu | l'image revient à l'identique |

Du dépôt : `test-aucun-tiret.ts` et `test-aucune-fleche.ts` verts, `npm run niveau` dit 1,
`verifier:memoire` vert.

## Ce qui reste ouvert, et qui tranche

| | Qui |
|---|---|
| La planche te convient-elle, et tourne-t-elle bien sur ton iPhone ? | toi |
| Le régulateur dans ce sens, la bobine côté rangée ? | toi |
| Une photo à plat du raccord 25 x 1", pour ne plus réduire le 32 | toi |
| La longueur du régulateur et la cote sur plats de la vanne, au pied à coulisse | toi |
| Porter cette nourrice dans l'outil d'arrosage de l'appli | toi, après la planche |
