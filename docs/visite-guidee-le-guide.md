# La visite guidée : le guide revu sur toute la visite

*21 novembre 2026, au soir. Ta réponse devant le début revu : « Très bien tu
peux tout faire maintenant en gardant en tête que l'utilisateur puisse avoir
accès à toutes les informations. Des fois, la petite barre noire cache les
informations. Il faut trouver une manière de soit la masquer temporairement,
soit la déplacer. »*

**La planche :** `appli/visite-guidee.html`, la visite entière, sur les mêmes
vrais écrans figés. Rien dans `src/`.

## Ce que la barre noire fait maintenant pour ne plus rien cacher

Il fallait les deux : la masquer et la déplacer. Et rendre tout l'écran
atteignable même quand elle est là.

| | Ce qui se passe |
|---|---|
| **Vous faites défiler** | elle se replie tout de suite en une seule ligne, qui garde le geste (« Touchez Costa. ») |
| **Vous touchez la ligne** | elle se déplie |
| **Le petit chevron, en haut de la barre** | la replie à la main, sans défiler (une feuille ne défile pas toujours) |
| **Tout en bas de la page** | la page garde sous son contenu la hauteur de la barre : en défilant, la dernière ligne remonte au-dessus d'elle |
| **La cible est en bas** | la page défile pour la poser au-dessus de la barre |
| **Une feuille monte du bas** (remise, date, achat, ticket, signature) | la barre se met en haut, sur ce qui est grisé, et arrive repliée : toute la feuille se lit, jusqu'à « Annuler » |
| **Chez votre client** | la barre arrive repliée, avec « Chez votre client » au-dessus du geste |
| **Rien d'autre ne dégage la cible** | la barre se replie d'elle-même |
| **Sur ordinateur** | elle se tient à côté de l'écran de l'appli et se rétrécit pour y tenir ; elle ne passe dessus qu'en dessous de 1024 points |

Sur les feuilles et chez le client, la barre était retirée (tes captures du
20 novembre). Elle y revient repliée : le geste reste lu sans rien couvrir de
la feuille, et un appui sur la ligne rend Retour et Passer.

## Ce qui change sur toute la visite

| | Avant | Maintenant |
|---|---|---|
| Le titre de la barre | le nom de l'écran | le geste, en grand |
| Retour et Passer | Passer en bouton blanc plein | discrets en haut ; « Suivant » n'est plein que là où il n'y a rien à toucher |
| Le progrès | une barre de 74 | des traits, un par étape du chapitre en cours (12 chapitres) |
| Toucher à côté | la barre tremble | la barre tremble et le cadre doré se rappelle |
| Regarder sans toucher | rien | la lumière sans cadre (les factures de Costa) |
| Les champs | le clavier du téléphone s'ouvrait | aucun clavier |

**Les quatre premières étapes** sont celles que tu as validées, plus une :
l'étape des factures se regarde (« Vous savez s'il l'a ouverte. »), puis
« Touchez Dernier devis. ». La visite compte 75 étapes.

**Trois phrases raccourcies**, parce qu'elles redisaient l'étape suivante :

| Étape | Avant | Maintenant |
|---|---|---|
| Le devis est parti | « Par SMS. Voyons ce que reçoit votre client : il choisit sa date, accepte et signe au doigt, sans compte ni mot de passe. » | « Par SMS. Voyons ce que reçoit votre client. » |
| Elle est partie | « … Voyons ce que reçoit votre client : sa facture, l'IBAN et le numéro à écrire sur son virement. » | « … Voyons ce que reçoit votre client. » |
| Ma TVA | « … Un achat sans ticket s'écrit à la main : la TVA se calcule toute seule. » | « La TVA collectée, la déductible, et ce qu'il reste à payer. » |

## Ta remarque suivante : essayer les boutons à la suite

*« À chaque fois que c'est à nous d'essayer, dès qu'on touche un bouton, on est
obligé de faire retour pour essayer les autres. Il faudrait pouvoir toucher
tous les boutons à la suite, et quand on en a marre, faire passer. »*

| | Maintenant |
|---|---|
| **Le devis** (Remise, Main d'œuvre, Acompte, Ajouter une TVA, Ajouter une ligne) | une fois un bouton essayé, les quatre autres sont là, sur le même écran : on les touche à la suite. La barre dit « Un autre bouton, ou Suivant. », et ce qui vient d'être posé dessous |
| **La facture** (Voir le PDF, Travaux en plus, Facture acquittée) | pareil. L'aperçu du PDF n'a pas d'autre bouton : sa flèche, ou « Revenir à la facture », ramène à la facture, où les autres attendent |
| **Le même bouton une seconde fois** | l'interrupteur « Facture acquittée » se rabat ; « Ajouter une ligne » fait trembler la barre (une seconde ligne ne se montre pas ici) |
| **Quand on en a assez** | « Suivant » fait avancer la visite, à tout moment |
| **La barre, pendant les essais** | repliée en une ligne, avec son bouton Suivant : la feuille, ce qui vient d'être posé et les autres boutons gardent l'écran |

Sur ton écran, les boutons du devis se touchent sans défiler. Sur un
téléphone plus petit (375 ou 320 points), « Ajouter un acompte » demande de
faire défiler un peu : il est sous la barre fixe « Choisir la date » de l'appli.

**Ce qui ne se cumule pas, et c'est une limite des écrans figés :** chaque essai
repart du devis d'origine. Une remise puis un acompte montrent l'acompte seul,
sans la remise. Les cumuler demanderait de figer chaque combinaison.

Vérifié ici : les cinq essais du devis et les trois de la facture enchaînés au
doigt sans Retour, à 320, 390, 1024 et 1280 points ; les 233 boutons des
écrans d'essai touchés un par un, aucun muet.

## Ta remarque suivante : « on reste sur la page plusieurs secondes »

**Trouvé, et c'était la seule étape sur 75 :** « Un particulier », où la fiche
du client se remplit toute seule. Le guide s'y retirait le temps que les quatre
champs s'écrivent lettre à lettre (72 lettres, à 38 millisecondes chacune, plus
une demi-seconde) : **3,5 secondes sans rien à lire ni à toucher.**

**Ce qui a été fait :**
- les champs s'écrivent en moins d'une seconde ;
- le guide ne se retire plus : il reste replié en bas, avec le geste, loin des
  champs qui s'écrivent en haut (déplié, il les cachait : ta capture du
  20 novembre). Il se déplie, le doigt sur le micro, une fois tout écrit.

**À vérifier sur ton téléphone :** tu as écrit « après envoyer le devis ».
J'ai chronométré l'étape qui suit « Envoyer le devis » : le guide y est là en
un sixième de seconde, même processeur ralenti. Si l'attente que tu as vue est
bien à cet endroit et pas sur la fiche du client, dis-le-moi : c'est alors
propre à Safari, que ce poste ne sait pas jouer.

**Ce qui le tient désormais :** `appli/scripts/visite-guidee/parcourir.mjs`
chronomètre chaque étape, processeur ralenti quatre fois : il a rougi sur
l'ancienne visite (3 546 ms) et passe au vert sur la nouvelle.

## Ta demande suivante : la fiche de sécurité, les véhicules, toutes les portes des Réglages

*« Montrer ce que le client reçoit à la fin, une fois qu'on a rempli la fiche,
avec un petit croquis qui voit comment on dessine à l'intérieur. Expliquer que
les véhicules, on les rentre pour que Cause nous prévienne du contrôle
technique ou de l'anti-pollution. Qu'ils puissent avoir accès à n'importe
quelle porte dans la page réglage. Que des informations bidons. »*

Tu as dit oui pour lancer l'appli ici, sur une base de démonstration neuve.
Rien n'a touché ton espace. Les nouveaux écrans sont les vrais écrans de
l'appli, figés.

**La fiche de sécurité, après le décret (quatre étapes de plus) :**

| Étape | Ce qu'on voit |
|---|---|
| Touchez Modifier le croquis. | la fiche remplie, son croquis en entier |
| Il se dessine au doigt. | l'éditeur : les repères apparaissent un à un (la parcelle, la voie, l'accès, la maison, le tilleul à tailler, la zone de chute, la haie au crayon, le stockage, le réseau, les secours), et l'outil de chacun s'allume dans la grille |
| Touchez Ouvrir le PDF. | la fiche signée par Julien Morel (le chef d'entreprise, inventé), Paul et Kévin, le 25 au matin ; « Envoyer au client » à l'écran |
| Ce que reçoit votre client. | le PDF de la fiche, croquis et signatures compris |

**Les véhicules, avant les Réglages libres (quatre étapes de plus) :**

| Étape | Ce qu'on voit |
|---|---|
| Touchez Véhicules. | « Cause vous prévient avant le contrôle technique et l'anti-pollution. » |
| Touchez le Camion benne. | trois véhicules inventés, plaques DE-123-MO, DE-456-MO, DE-789-MO |
| Contrôle technique avant le 3 décembre. | la fiche du camion : « Plus que 12 jours » |
| Le rappel, sur l'accueil. | la carte du camion, éclairée : ambre à quinze jours, rouge une fois la date passée |

**Les Réglages libres : 38 portes s'ouvrent**, dont les quatre catégories de
« Devis & factures » (L'allure, Ce qui s'imprime, Mon message, Le numéro),
l'exemple de facture, Nouveau compte et Zones (Équipe), Mes prix, Mes mesures
et le Catalogue, Fermer mon compte, chaque véhicule. La flèche du haut ramène à
l'écran d'avant. Ce qui n'ouvre pas d'écran le dit dans la bulle (« Mes
données » se télécharge ; les flèches de mois changent de mois). La rubrique
Véhicules porte l'explication des rappels.

**Trouvé et corrigé en route :** la photo du ticket restait 1,3 seconde sur
l'étape suivante si l'on passait vite.

**Ce que la visite compte maintenant :** 83 étapes, dans 14 chapitres.

## Ta demande du 22 : la fiche client remplie par la note vocale d'en haut à droite

Deux étapes de plus, juste avant que la fiche se remplisse :

| Étape | Ce qu'on voit |
|---|---|
| Touchez le micro, en haut à droite. | la fiche client vide ; « Pas envie d'écrire ? Dites le nom, le téléphone, l'adresse. » |
| Touchez le micro pour arrêter. | le micro rouge, « J'écoute. Touchez pour arrêter. » dessous, et dans la bulle : « Monsieur Lefèvre, 06 39 98 12 34, lefevre@example.com, 7 chemin du Verger à Nantes. » |
| (l'étape d'après) | les champs se remplissent, la ligne dit « La fiche se remplit. », puis la bulle passe au grand micro du chantier |

L'écoute n'a pas été figée depuis l'appli : la visite la rejoue sur l'écran figé
de la fiche, avec exactement les couleurs et la phrase que pose le code. Ce
micro remplit les champs vides, il n'écrase rien et ne valide rien.

La visite compte 85 étapes.

## Ta demande du 22 : les sauts dans l'aperçu du PDF, et la facture qui s'essaie

*« Expliquer aussi qu'on peut faire des sauts de ligne et des sauts de page avec
l'aperçu du PDF du devis. Sur la facture, je peux pas ajouter un travail ou un
règlement reçu. Faudrait le faire, ça. »*

**L'aperçu du devis, quatre étapes de plus** (figées dans l'appli, sur le devis
de M. Lefèvre) :

| Étape | Ce qu'on voit |
|---|---|
| Touchez l'élagage du tilleul. | le PDF, et la phrase de l'appli : « Touchez une ligne pour commencer une nouvelle page à cet endroit. » |
| Touchez Nouvelle page. | la ligne du tilleul encadrée d'or, et en bas « Nouvelle page » ou « Un espace ici » |
| Touchez le ramassage. | le tilleul en haut de la page 2, et la pastille « Saut de page » entre les deux pages |
| Touchez Un espace ici. | la ligne du ramassage encadrée |
| Revenez au devis. | une ligne blanche avant le ramassage, la pastille « Espace », et « Tout remettre » en haut |

**La facture : « Travaux en plus » et ses quatre boutons** s'essaient
maintenant, à la suite, comme ceux du devis :

| Bouton | Ce qu'il montre |
|---|---|
| Ajouter un travail | un dessouchage à 85 € : le total passe à 1 026 € |
| Main d'œuvre | sa vraie feuille, puis la ligne posée : 280 €, le total à 1 260 € |
| Ajouter une TVA | sa vraie feuille, puis une ligne à 10 % |
| Règlement reçu | 300 € d'acompte par virement le 21 : il reste 624 € à payer |

Annuler une feuille, ou retirer ce qu'un bouton a posé, ramène aux travaux en
plus ; « Revenir à la facture » ramène à la facture ; Suivant continue la visite.

**Trouvé en regardant les captures :** en arrivant sur « Travaux en plus », la
page se calait tout en bas, sur Facture acquittée. Les quatre boutons, puis la
ligne ajoutée, restaient au-dessus, hors de l'écran : tu aurais dû faire défiler
pour voir ce que tu venais de faire. Chaque bouton montre maintenant ce qu'il a
posé en arrivant.

**Fait autrement que ta demande, et pourquoi :** tu as demandé le travail et le
règlement. Main d'œuvre et Ajouter une TVA, sur le même écran, ne répondaient
pas non plus : les laisser muets, c'était la même déception un bouton plus loin.

**Ce qui s'est révélé faux de mon côté :** le contrôle des boutons muets
(21 novembre, « 233 boutons touchés, aucun muet ») comptait un guide qui tremble
comme une réponse. Ajouter un travail tremblait : il était donc « vert ». Le
contrôle des essais touche maintenant ces quatre boutons et exige qu'ils
s'ouvrent : rouge sur la visite d'avant (9 défauts), vert après.

**Trouvé en route, dans l'appli elle-même, et pas corrigé :** sur un règlement
reçu, changer le moyen, la date et le montant d'affilée ne garde que le dernier
champ. Chaque champ renvoie la ligne entière telle que l'écran l'a reçue ; si le
précédent n'est pas encore revenu du serveur, il est écrasé, sans message.
Reproduit ici en enchaînant les trois gestes sans pause : « Chèque » et la date
du jour sont revenus. À deux secondes d'écart, tout est gardé. Sur un bon
réseau, ta main est plus lente que l'aller et retour ; **sur un chantier mal
couvert, un « Virement » peut revenir à « Chèque » sans que tu le voies.** Pas
vérifié sur ton téléphone. La correction touche l'argent, donc une batterie :
elle attend ton « oui » (`TODO.md`).

**Le poids de la page :** une même page de PDF (conditions générales, formulaire,
attestation) revenait sur les cinq écrans de l'aperçu. Elle n'est écrite qu'une
fois ; la visite passe de 6,6 à 7,3 Mo au lieu de 8,8.

La visite compte 89 étapes.

## Ta capture du 22 : l'anneau à côté du bouton

*« Quand on arrive sur une page, en ayant cliqué sur passer, la zone qui nous
montre où on doit cliquer est pas vraiment centrée par rapport au bouton. Et ça
arrive assez souvent. »*

**Ce qui se passait :** l'anneau doré était dessiné sur une couche fixée à
l'écran, posée par-dessus la page ; le bouton, lui, est dans la page. Les deux ne
tombent l'un sur l'autre que si Safari garde ses éléments fixes à leur place.
Safari 26 les décale de quelques points quand sa barre d'adresse bouge (un défaut
connu de WebKit, le 297779) : sur ta capture, l'anneau est remonté d'environ
quatre points au-dessus de « Arrêter et ranger ».

**Ce qui a été fait :** l'anneau vit maintenant dans la page avec son bouton, et
défile avec lui. Seul l'anneau d'un bouton posé dans une feuille fixe (le
calendrier de la date) reste sur la couche fixe, avec sa feuille : là, les deux
bougent ensemble.

**Ce qui s'est révélé faux de mon côté :** ma première version de cette
correction cassait une étape, sur ordinateur. Posé dans la page, l'anneau de
l'étape d'avant, éteint mais encore placé plus bas, rallongeait la page ; la
visite calait alors « J'ai bien reçu » chez le client sur une page plus longue
qu'elle n'est, et le bouton finissait sous le guide. Le contrôle complet l'a vu,
deux fois de suite ; c'est corrigé (l'anneau ne peut plus rallonger la page).

**Et elle élargissait la page sur ton iPhone** (ta capture de l'aperçu du
PDF, coupé à droite, et la bulle absente après le choix de la date). Le halo
doré qui pulse autour d'un anneau sort de 16 points autour de lui ; près d'un
bord (le micro en haut à droite), il sortait de l'écran. Chrome le coupe, Safari
a élargi toute la page pour le loger : l'écran débordait à droite, et ce qui est
fixé en bas pouvait passer hors de l'écran. Le halo est maintenant coupé d'une
façon que Safari respecte, et un contrôle refuse un halo qui sort de l'écran
(rouge sur 4 étapes avant la correction). **La bulle absente après l'envoi du
devis n'a pas pu être reproduite ici** : c'est la cause la plus probable, pas
une certitude. Si elle manque encore, une capture de ce moment.

**Pas vérifiable ici :** ce poste n'a que Chromium, où l'anneau tombait déjà
juste à chaque étape (mesuré). Le contrôle de la visite exige maintenant que
l'anneau soit dans le même plan que son bouton : rouge sur la visite d'avant
(53 étapes), vert sur la nouvelle. **À regarder sur ton iPhone** ; si un anneau
tombe encore à côté, une capture me dira lequel.

## Ta remarque du 22 : la page des Réglages qui se balade

*« La page de réglage se balade de droite à gauche. Il faut faire gaffe et
regarder que les autres pages ne se baladent pas non plus. »*

**La cause la plus probable :** les cases des écrans figés (le nom de
l'entreprise dans les Réglages, « Quelle longueur ? » avant de chiffrer)
étaient en lecture seule, mais elles prenaient encore le doigt. Sur l'iPhone,
toucher une case dont le texte fait moins de 16 points fait zoomer la page ;
zoomée, elle glisse ensuite de droite à gauche sous le doigt. Les cases de
l'appli font 15 points.

**Ce qui a été fait :** aucune case d'un écran figé ne prend plus le doigt, ni
le clavier ; le doigt touche ce qui l'entoure, et les deux étapes qui visent une
case (la longueur avant de chiffrer, le 25 du calendrier) avancent toujours. Le
message du devis, qui s'écrivait encore dans la visite, est figé lui aussi. Un
contrôle touche une case à ces deux endroits : rouge sur la visite d'avant (les
deux cases prenaient la main), vert sur la nouvelle.

**Les autres pages :** les 124 écrans de la visite, Réglages libres compris,
ont été mesurés sur trois tailles d'iPhone (SE, 15 Pro, 15 Pro Max) : aucun ne
dépasse de l'écran.

**Pas vérifiable ici :** ce poste n'a pas d'iPhone, et Chromium ne zoome pas
sur une case. À regarder sur ton téléphone ; si une page se balade encore, dis-moi
laquelle et ce que tu as touché juste avant.

## Des informations cachées, trouvées en route

| Où | Ce qui était caché | Ce qui a été fait |
|---|---|---|
| **Le virement reçu**, sur l'accueil (deux étapes) | le haut de la carte : « Virement reçu, M. Lefèvre, 924,00 € », puis « La facture est payée » | la liste avait été figée déjà défilée. Elle repart du haut, et la visite garde la carte en vue |
| **Le même virement, sur ordinateur** | le haut de la carte, encore | la liste de l'accueil défile par crans (`globals.css`) et revenait d'elle-même au premier chantier. La visite coupe les crans sur ce qu'elle montre |
| **Le trait d'or sous l'onglet** de la fiche client | à côté du mot, sauf à 390 points | replacé par la règle de l'appli, repris de la seconde proposition du début |
| **Le calendrier de la date** | le 25 était sous la barre « Envoyer le devis » de la feuille | la visite vérifie que la cible se voit vraiment, et fait défiler la feuille sinon |
| **La feuille Main d'œuvre** | son bouton « Ajouter » sous le bas de l'écran | même chose |
| **Le ticket scanné, sur ordinateur** | son bouton dépassait de 8 points sous l'écran | même chose |

**Une question pour l'appli elle-même, pas vérifiable ici :** sur
ordinateur, la liste de l'accueil s'ouvre-t-elle déjà défilée quand une carte
(virement, devis accepté) est en tête ? Si oui, c'est un défaut de l'appli. À
regarder sur ton espace.

## Vérifié ici

*Mis à jour le 22 novembre, sur la visite de 89 étapes.*

- La visite entière jouée au doigt à 320 × 568, 390 × 664 (ton écran),
  1024 × 768 et 1280 × 800 : à chacune des 89 étapes, le doigt mène à la
  suivante, la cible n'est jamais sous la barre ni hors de l'écran, aucune page
  ne déborde, et l'anneau est dans le plan de son bouton.
- Les boutons à essayer du devis et de la facture, dont les quatre des travaux
  en plus : chacun s'ouvre, se pose, montre ce qu'il a posé, et ramène.
- 304 boutons des écrans d'essai touchés un par un : aucun muet.
- Les 19 rubriques et les 38 portes des Réglages libres s'ouvrent et reviennent.
- Le guide paraît en moins d'une demi-seconde à chaque étape (482 ms au pire),
  processeur ralenti quatre fois.
- Les nouveaux écrans regardés en image à 390 points, avec le guide.

**Pas vérifiable ici : Safari sur ton iPhone.** Ce poste n'a que Chromium.
Safari n'envoie un appui que sur ce qui se touche : la visite pose
`cursor: pointer` sur chaque cible pour qu'il le fasse (repris de la seconde
proposition). Si un cadre doré ne réagit pas sur ton téléphone, dis-moi
lequel.

## Ce qui reste ouvert

1. **La longueur** : 89 étapes, une dizaine de minutes.
2. ~~**Le règlement reçu qui perd un champ**~~ **corrigé le 22 au soir**, sur
   ton « oui » : l'écran n'envoie que le champ changé, et l'appli le pose sur la
   ligne telle qu'elle est en base. Vu rouge avant (en base, et au navigateur
   avec les trois champs changés sans attendre), vert après ; batterie complète
   au vert, avec la nourrice 3D de l'autre session, et c'est sur `main`.
3. **Le bouton sur le site** : la planche porte tes choix
   (`appli/vente/cause-2-visite.html`) : la carte dans l'ouverture et sous
   l'option des outils, son téléphone qui gigote, et la bande avant les prix.
   Rien n'est posé sur le vrai site tant que tu n'as pas dit oui.
4. **Le script qui refait la visite** n'a jamais été enregistré pour ses
   écrans d'origine (`docs/visite-guidee.md`). Ceux ajoutés depuis le 21 se
   refont, eux, par `appli/scripts/visite-guidee/`.
5. **L'anneau sur ton iPhone** : corrigé sans pouvoir le voir ici. Une capture
   si un anneau tombe encore à côté de son bouton.
