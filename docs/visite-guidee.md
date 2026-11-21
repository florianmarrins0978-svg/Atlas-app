# La visite guidée du site

*20 novembre 2026. Ta demande : une visite de l'application, depuis le site,
sur les vrais écrans, avec des données toutes inventées.*

**La planche :** `appli/visite-guidee.html`. Pas encore branchée sur le site de
vente : on la branche quand tu l'as validée.

**Ta demande du 21 novembre, un meilleur début :** deux propositions, sur ses
quatre premières étapes. Leurs retours : `docs/visite-guidee-le-debut.md` et
`docs/visite-guidee-le-debut-2.md`.

## Ce que fait le visiteur

Une bulle dit quoi regarder, et un doigt doré montre où toucher. S'il touche
ailleurs, la bulle tremble. « Passer » avance sans toucher, « Retour » recule.

| | Étapes |
|---|---|
| La fiche d'un client | Vos clients, la fiche de Mme Costa : ses devis, ses factures (ouverte, due), son dernier devis repris, + 10 % sur les prix |
| Le client | l'accueil, Créer un devis, Entreprise, Public, retour à Mr, les champs qui s'écrivent seuls |
| Le devis | le micro, la dictée, « Avant de chiffrer » (25 m de haie), le devis rédigé, le micro en haut à droite pour corriger à la voix, **les boutons à essayer librement** (Remise, Main d'œuvre, Acompte, Ajouter une TVA, Ajouter une ligne : chacun ouvre sa vraie feuille et pose son résultat), l'aperçu PDF, le retour au devis, Choisir la date |
| La date | deux dates proposées, le devis envoyé |
| Chez le client | sa page, la date qu'il choisit, sa signature au doigt |
| Le planning | le 25, la journée, Paul et Kévin ajoutés matin et après-midi, la fiche d'intervention, la fiche de sécurité (sa page s'ouvre sur le décret 2021-1833), les travaux à faire |
| La facture | Terminés, les retours d'intervention (celui de Mme Costa), la facture reprise du devis, **ses boutons à essayer** (Voir le PDF, Travaux en plus, Facture acquittée ; l'envoi par SMS reste hors d'atteinte), l'envoi, ce que reçoit le client |
| Le paiement | le virement vu par la banque sur l'accueil, « Oui », la facture payée |
| Ma TVA | toute la page, un achat écrit à la main, le ticket de carburant scanné, les chiffres de gauche (collectée, déductible, par taux) |
| Le comptable | Ma banque, le check up, les lignes justifiées, le relevé du mois, le dossier arrêté, le document du comptable |
| L'assistant | après la fiche client : « Dans le devis chez Costa, il y avait une ligne de claustra. Retrouve-la avec son prix. » Il la retrouve, avec le devis d'où elle vient |
| La fin | Une idée pour l'appli (« Voir la météo de la semaine sur le planning »), puis les fournisseurs et leurs prix d'achat, puis les Réglages libres. **« Quitter la visite » et « Recommencer » restent toujours affichés** |

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

## Ta demande du 20 novembre au soir : entrer dans la fiche d'un client

Fait. Mme Costa a maintenant une histoire, jouée pour de vrai avant la visite : un devis signé, un chantier passé le 10 novembre, un retour d'intervention, une facture envoyée et ouverte, encore due.

**Ce que l'appli ne fait pas, et que la visite ne montre donc pas :** les retours d'intervention ne sont pas sur la fiche du client. Ils vivent dans Terminés, « Retours d'intervention », rangés client par client. La visite les montre là. Les mettre aussi sur la fiche demanderait un changement de l'appli, à décider.

**Corrigé en route, dans la base d'essai seulement :** le jeu de démonstration écrivait la civilité dans le nom (« Mme Costa »), et le devis repris imprimait « Mme Mme Costa ». Un client créé dans l'appli garde sa civilité à part (vérifié sur M. Lefèvre). Un client dont le nom porterait déjà « Mme » ou « M. », importé par exemple, aurait le même doublon : pas vérifié chez toi.

## Tes remarques du 20 novembre au soir

| Remarque | Ce qui a été fait |
|---|---|
| La bulle cachait les champs qui s'écrivent | elle se retire pendant l'écriture, et revient une fois tout écrit |
| Un carré autour de la note vocale, qui est ronde | le doigt prend la forme du bouton : rond pour un rond |
| Les boutons du devis à essayer | Remise, Main d'œuvre, Acompte, Ajouter une TVA, Ajouter une ligne : chacun ouvre sa vraie feuille, et son bouton pose sur le devis ce que l'appli y pose. « Retour » revient au devis |
| Montrer la note vocale en haut à droite | une étape la montre, puis l'écoute |
| Le PDF flou | **corrigé à la racine** : la page se peignait à la densité d'un vieil écran. Elle est figée à la densité d'un téléphone récent (trois fois plus de points) |
| Après l'aperçu : retour, puis Choisir la date | fait dans cet ordre |
| Le doigt restait en l'air quand on faisait défiler | il suit son bouton à chaque instant, page ou feuille |
| Après la signature : l'accueil et sa notification, puis le planning | fait : « Devis accepté », puis Planning |

Dans une feuille, les autres choix (5 %, 10 %…) ne changent pas le montant : la visite le dit, et c'est le bouton du bas qui pose.

**L'assistant, honnêtement :** la recherche de la ligne est la vraie, dans la vraie base. La phrase de sa réponse vient du modèle d'essai de ce poste, sans clé d'IA ; chez toi, la réponse sera formulée par la vraie IA.

## Le 21 au soir : le guide revu sur toute la visite

Le début revu a été retenu, puis porté sur les 75 étapes (l'étape des
factures se regarde, puis « Touchez Dernier devis. »). Le guide dit le geste
en grand, se replie en une ligne dès qu'on fait défiler, se met en haut sur
les feuilles, et la page garde de la place sous son contenu : il ne cache plus
rien pour de bon. Le détail, les phrases raccourcies et les informations
cachées trouvées en route : `docs/visite-guidee-le-guide.md`.

**Retouches de la planche ajoutées ce soir-là :** la liste de l'accueil des
deux étapes du virement ne part plus figée défilée (elle cachait le haut de la
carte), ses crans sont coupés sur ce que la visite montre, et le trait d'or
sous l'onglet de la fiche client est replacé par la règle de l'appli.

## Ce qui reste ouvert, et c'est à toi de trancher

1. **La longueur** : 83 étapes, une dizaine de minutes. On peut en retirer.
2. **Les retours d'intervention sur la fiche du client** : aujourd'hui ils sont dans Terminés seulement.
3. **Le bouton sur le site** : où le poser sur `appli/vente/`.
4. **Dans l'appli elle-même**, trois champs montrent « 06 12 34 56 78 » comme exemple (envoi du devis, transmission, facture). Ce numéro peut appartenir à quelqu'un. Le passer en 06 39 98 00 00 serait plus sûr. C'est un changement de `src/`, il attend ton « oui ».

## Pour la refaire quand un écran change

`scripts/planche-figee/visite-guidee/tout.sh` rejoue tout le parcours dans
l'appli bâtie, puis assemble et vérifie la planche. Il demande une base de
démonstration neuve, donc ton accord.

**Corrigé le 21 novembre : ce dossier n'est pas dans le dépôt.** Ni
`tout.sh`, ni `histoire.mjs`, ni `parcourir-visite.mjs` n'ont été commités ;
ils sont restés dans la session qui a fait la planche. Seuls `figer.mjs`,
`composer.mjs` et `parcourir.mjs` existent sous `scripts/planche-figee/`.
Refaire la visite demande donc de réécrire son parcours. **Depuis le 21 au soir, les vingt écrans ajoutés** (fiche de sécurité jusqu'au PDF, véhicules, portes des Réglages) se refont, eux, par `appli/scripts/visite-guidee/` (son `LISEZ-MOI.md`).

**Vérifié ici :** le parcours entier touché doigt par doigt, à 390 px (téléphone) et à 1280 px (ordinateur). Les 74 doigts mènent tous à l'étape suivante, les 19 rubriques s'ouvrent et reviennent, aucune page ne déborde, aucune erreur.
