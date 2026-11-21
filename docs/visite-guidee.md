# La visite guidée du site

*20 novembre 2026. Ta demande : une visite de l'application, depuis le site,
sur les vrais écrans, avec des données toutes inventées.*

**La planche :** `appli/visite-guidee.html`. Pas encore branchée sur le site de
vente : on la branche quand tu l'as validée.

## Ta demande du 21 novembre : un meilleur début, sur les quatre premières étapes

*« Propose une version améliorée juste pour les 4 premières étapes, arrête-toi
avant d'entrer dans le devis, au client. »*

**La planche :** `appli/visite-guidee-debut.html`
<https://florianmarrins0978-svg.github.io/Atlas-app/visite-guidee-debut.html>

Les quatre écrans sont ceux de la visite d'aujourd'hui, recopiés tels quels :
l'accueil, Vos clients, la fiche de Mme Costa, ses factures. Seul le guide
change. La visite d'aujourd'hui n'est pas touchée, et un bouton à la fin de la
proposition y ramène pour comparer.

### Ce qui n'allait pas, relevé sur un écran comme le tien (390 sur 664)

| Aujourd'hui | Dans la proposition |
|---|---|
| À l'étape des factures, la bulle décrit des factures qu'on ne voit pas : elles sont sous l'écran, et la bulle fait toucher autre chose | La facture est à l'écran, « Ouverte le 21/11 » est surligné, et la bulle dit : « Vous voyez si le client a ouvert sa facture. » |
| La page saute au milieu de la liste ou de la fiche : on ne voit jamais le haut de l'écran où l'on arrive | Elle arrive en haut, comme dans l'appli, puis glisse jusqu'au geste |
| La bulle prend 182 points de haut, flotte à 36 points de la barre du bas, et tout le reste est grisé | Elle en prend 151 (99 quand il n'y a rien à toucher), posée sur la barre du bas : 57 points d'écran rendus, et l'appli garde ses couleurs |
| Un titre, une phrase, un geste | Une phrase, un geste. Le titre répétait celui de l'écran |
| « Passer » est le bouton le plus voyant : la bulle pousse à sauter le geste | Il est en retrait tant qu'un geste est attendu. Sans geste, « Suivant » devient le bouton plein |
| Toucher à côté fait trembler la bulle, comme un mot de passe faux | Rien ne tremble : une main revient montrer où toucher |
| Une barre de 74 étapes, presque vide | Quatre traits pour quatre étapes |
| Aucune sortie avant la fin | Une croix, à chaque étape |
| D'un écran à l'autre, tout change d'un coup | Un fondu. Et le trait d'or des onglets glisse de Devis à Factures, comme dans l'appli |

### Ce qui a été fait autrement que la visite d'aujourd'hui, et pourquoi

| | Pourquoi |
|---|---|
| **Le texte de l'étape 4 change** | il parle maintenant de ce qui est surligné. Les trois autres gardent ta phrase ; la 2 perd « rangés par lettre », la 3 « Tout se télécharge d'un coup » |
| **L'étape 4 ne fait plus toucher « Dernier devis »** | c'est l'entrée dans le devis, où tu m'as dit d'arrêter. Dans la visite entière elle se ferait en deux temps : regarder la facture, puis toucher Dernier devis |
| **Le petit titre « Visite guidée » de l'ouverture est parti** | le grand titre suffit. Ta phrase et « Commencer » sont les mêmes |
| **Le guide lit le doigt, pas le clic** | sur un iPhone, Safari n'envoie aucun clic pour un appui hors d'un lien ou d'un bouton : la proposition y serait restée muette |
| **De la marge autour de la cible** | un appui à dix points du bouton compte : on vise mal avec un doigt épais |
| **Deux appuis rapides ne sautent plus une étape** | qui hésite appuie souvent deux fois, et la cible suivante peut tomber sous le même doigt |

### Corrigé en route, sur ces quatre écrans

- **Le trait d'or sous l'onglet ouvert** n'était juste qu'à 390 points de large :
  figé à cette largeur, il tombe à côté du mot sur tout autre écran (15 points
  à 360 de large, 12 à 414, 141 sur un ordinateur). Il est replacé par la règle
  de l'appli. **Mesuré aussi dans la visite d'aujourd'hui, non touchée.**
- **L'onde autour de la cible** grandissait en proportion : sur la ligne de
  Mme Costa, elle débordait de 56 points sur un téléphone et de 106 sur un
  ordinateur. Elle grandit de 13 points, quelle que soit la cible.

### Vu, et non touché : ce n'est pas le guide

- Sur l'accueil, les chantiers en cours sont datés de **juillet** alors que
  l'histoire de Mme Costa est en **novembre**. Deux sont une salle de bain et
  une toiture.
- Sur Vos clients, « Vos partenaires, Aucun » et « Services publics, Aucun ».
- Les changer demande de rejouer la base de démonstration, donc ton accord, et
  le script qui manque (voir plus bas).

### Vérifié ici, et ce qui ne peut pas l'être

**Vérifié ici**, au doigt, dans un vrai navigateur : dix parcours (320, 360,
390 et 414 points de large, une tablette, un ordinateur à 1024 et à 1280, les
animations réduites, sans fondu, et comme sur un iPhone, sans aucun clic hors
des boutons). Chaque geste mène à l'étape suivante, un appui à côté ne fait
rien avancer, un doigt qui glisse ne compte pas, la bulle ne couvre ni la cible
ni la barre du bas, la page ne déborde pas, aucune erreur. Les contrôles ont
été vus rouges avant chaque correction.

**Pas vérifiable ICI : Safari sur ton iPhone.** Ce poste n'a que Chromium. Les
conditions de Safari ont été imitées, pas jouées : à essayer sur ton téléphone.

### Ce qui reste ouvert, et c'est à toi de trancher

1. **Cette direction pour toute la visite**, oui ou non.
2. **La main** : la garder, ou l'anneau seul.
3. **Les deux temps** : là où ce qu'on regarde n'est pas ce qu'on touche, la
   visite gagne un appui sur « Suivant ». Elle est plus claire, et un peu plus
   longue.

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

## Ce qui reste ouvert, et c'est à toi de trancher

1. **La longueur** : 74 étapes, environ huit minutes. On peut en retirer.
2. **Les retours d'intervention sur la fiche du client** : aujourd'hui ils sont dans Terminés seulement.
3. **Le bouton sur le site** : où le poser sur `appli/vente/`.
4. **Dans l'appli elle-même**, trois champs montrent « 06 12 34 56 78 » comme exemple (envoi du devis, transmission, facture). Ce numéro peut appartenir à quelqu'un. Le passer en 06 39 98 00 00 serait plus sûr. C'est un changement de `src/`, il attend ton « oui ».

## Pour la refaire quand un écran change

**Corrigé le 21 novembre : ce qui était écrit ici était faux.** Ce document
disait que `scripts/planche-figee/visite-guidee/tout.sh` rejoue tout le
parcours puis assemble et vérifie la planche. Ce dossier n'a jamais été
enregistré : ni `tout.sh`, ni `histoire.mjs`, ni `parcourir-visite.mjs` ne sont
sur `main`, ni sur la branche de la session qui a fait la visite
(`claude/sleepy-sagan-gq6c0x`). Ils sont restés sur le poste de cette session.

**Ce que ça change :** la planche est bien là et marche, mais elle ne peut pas
être refaite aujourd'hui quand un écran de l'appli change.

**Ce que tu peux faire, et c'est le plus court :** si la session qui a fait la
visite est encore ouverte, dis-lui « enregistre le dossier
scripts/planche-figee/visite-guidee et pousse-le ». Si elle est fermée, le
script est perdu et se réécrit (rejouer le parcours sur une base de
démonstration neuve, figer chaque écran avec `scripts/planche-figee/figer.mjs`,
assembler) : cela demande ton accord, pour la base. Inscrit dans `TODO.md`.

**Vérifié ici :** le parcours entier touché doigt par doigt, à 390 px (téléphone) et à 1280 px (ordinateur). Les 74 doigts mènent tous à l'étape suivante, les 19 rubriques s'ouvrent et reviennent, aucune page ne déborde, aucune erreur.
