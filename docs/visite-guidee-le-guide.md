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
