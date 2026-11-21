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

- La visite entière jouée au doigt à 390 × 664 (ton écran), 375 × 667,
  320 × 568, 1024 × 768 et 1280 × 800 : à chacune des 75 étapes, le doigt mène
  à la suivante, la cible n'est jamais sous la barre ni hors de l'écran, aucune
  page ne déborde.
- Les huit boutons à essayer (devis et facture) : chacun ouvre sa feuille, se
  pose, et Retour ramène.
- Les 19 rubriques des Réglages libres s'ouvrent et reviennent.
- Faire défiler replie la barre, la toucher la déplie, le chevron la replie.
- Chaque étape regardée en image à 390 points, et des étapes choisies sur
  ordinateur.

**Pas vérifiable ici : Safari sur ton iPhone.** Ce poste n'a que Chromium.
Safari n'envoie un appui que sur ce qui se touche : la visite pose
`cursor: pointer` sur chaque cible pour qu'il le fasse (repris de la seconde
proposition). Si un cadre doré ne réagit pas sur ton téléphone, dis-moi
lequel.

## Ce qui reste ouvert

1. **La longueur** : 75 étapes, environ huit minutes.
2. **Le bouton sur le site** : où poser la visite sur `appli/vente/`.
3. **Le script qui refait la visite** n'a jamais été enregistré
   (`docs/visite-guidee.md`). Un écran de l'appli qui change ne se reporte
   donc pas tout seul dans la visite.
