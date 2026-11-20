# La visite guidée du site

*20 novembre 2026. Ta demande : une visite de l'application, depuis le site,
sur les vrais écrans, avec des données toutes inventées.*

**La planche :** `appli/visite-guidee.html`. Pas encore branchée sur le site de
vente : on la branche quand tu l'as validée.

## Ce que fait le visiteur

Une bulle dit quoi regarder, et un doigt doré montre où toucher. S'il touche
ailleurs, la bulle tremble. « Passer » avance sans toucher, « Retour » recule.

| | Étapes |
|---|---|
| Le client | l'accueil, Vos clients, Créer un devis, Entreprise, Public, retour à Mr, les champs qui s'écrivent seuls |
| Le devis | le micro, la dictée, « Avant de chiffrer » (25 m de haie), le devis rédigé, les totaux, l'aperçu PDF |
| La date | deux dates proposées, le devis envoyé |
| Chez le client | sa page, la date qu'il choisit, sa signature au doigt |
| Le planning | le 25, la journée, Paul et Kévin ajoutés, la fiche d'intervention |
| La facture | Terminés, la facture reprise du devis, l'envoi, ce que reçoit le client |
| Le paiement | le virement vu par la banque sur l'accueil, « Oui », la facture payée |
| Ma TVA | toute la page, un achat écrit à la main, le ticket de carburant scanné, les chiffres de gauche (collectée, déductible, par taux) |
| Le comptable | Ma banque, le check up, les lignes justifiées, le relevé du mois, le dossier arrêté, le document du comptable |
| La fin | les Réglages ouverts : chaque rubrique se touche librement, le doigt reste sur **Une idée pour l'appli** |

## Ce qui a été fait autrement que ta liste, et pourquoi

| | Pourquoi |
|---|---|
| **Le client accepte le devis** avant le planning | sans son accord, le chantier n'a pas de date. C'est le vrai chemin |
| **La notification du virement** vient juste après le paiement, avant Ma TVA | c'est elle qui fait entrer la facture dans la TVA |
| **Le check up** est dans Pour mon comptable, pas sur l'accueil | c'est là qu'il vit dans l'appli. Sur l'accueil, le paiement se valide par « Oui » |
| **« Avant de chiffrer »** ajouté après la dictée | c'est ce que l'appli demande quand la longueur de la haie manque |

## Les données, toutes inventées

- Téléphones de la **tranche de fiction de l'ARCEP** (06 39 98…, 02 61 91…), qui n'est attribuée à personne.
- E-mails sur **example.com**, un domaine réservé qui ne mène nulle part.
- Station du Rond-Point, Pépinière des Saules, Banque Démo, signature : inventées.

## Ce que la planche retouche, et pourquoi

Tout le reste est l'écran tel que l'appli le peint.

| Écran | Retouche | Pourquoi |
|---|---|---|
| Cause IA | « Oui » en vert, au lieu de « Pas encore » | sur ton espace les clés sont posées. Ici, non |
| Le ticket lu | retrait de « La lecture automatique n'est pas disponible ici » | même raison : chez toi, l'IA lit le ticket |
| Les champs vides | l'exemple « 06 12 34 56 78 » devient « 06 39 98 00 00 » | ce numéro peut appartenir à quelqu'un |

## Ce qui reste ouvert, et c'est à toi de trancher

1. **La longueur** : 49 étapes, environ cinq minutes. On peut en retirer.
2. **Le bouton sur le site** : où le poser sur `appli/vente/`.
3. **Dans l'appli elle-même**, trois champs montrent « 06 12 34 56 78 » comme exemple (envoi du devis, transmission, facture). Ce numéro peut appartenir à quelqu'un. Le passer en 06 39 98 00 00 serait plus sûr. C'est un changement de `src/`, il attend ton « oui ».

## Pour la refaire quand un écran change

`scripts/planche-figee/visite-guidee/tout.sh` rejoue tout le parcours dans
l'appli bâtie, puis assemble et vérifie la planche. Il demande une base de
démonstration neuve, donc ton accord.

**Vérifié ici :** le parcours entier touché doigt par doigt, à 390 px (téléphone) et à 1280 px (ordinateur). Les 49 doigts mènent tous à l'étape suivante, les 19 rubriques s'ouvrent et reviennent, aucune page ne déborde, aucune erreur.
