# Batterie commune du 6 novembre au soir : neuf lots, quatre sessions

Ta demande : *« il y a déjà 3 sessions ou 4 sessions qui attendent de jouer une batterie. Fusionne-la avec la tienne. Ne la lance toujours pas. Il y en a une dernière qui continue de coder et dès qu'elle a fini, tu la prendras aussi. »* Puis ton « Oui » pour la batterie.

Branche : `lot/batterie-commune-6-novembre-soir`, partie de `main` (`a5e381e5`), et reposée sur `main` (`1f9a7984`, le site de vente) avant la poussée.

## Les lots

| Session | Lot | Migration | Ce que la rencontre a demandé |
|---|---|---|---|
| 5 | Le vrai sablier | aucune | rien |
| 5 | Hiverner l'arrosage (B) | 0165, devenue **0171** | le mois du planning porte à la fois le férié et la goutte ; « Le prévoir » refuse le férié, comme sur ta planche ; trois boutons carrés arrondis (ta règle du 12 août) |
| 5 | La note sans réseau (B) | 0166, devenue **0172** | la dictée d'une idée n'a pas besoin de l'identifiant d'envoi de la note : l'emballage du son et l'envoi de la note sont séparés |
| 5 | Le plafond de la franchise (A et B) | aucune | la Factur-X : le plafond se contrôle AVANT le dépôt chez la plateforme |
| 3 | Déplacer un chantier en un appui | aucune | rien |
| 3 | La fiche travaux | 0169, devenue **0173** | rien |
| 2 | La fiche de sécurité soignée, avec le « ≤ » | aucune | rien |
| 1 | Fermer son compte | 0166 puis 0171, devenue **0174** | l'effacement d'un client, découpé pour le compte fermé, reprend la règle du brouillon de facture arrivée sur `main` |
| 1 | La facture d'abonnement d'Atlas, avec sa TVA | 0172, devenue **0175** | « qui est le patron » se lisait deux fois : une seule lecture désormais |

Paragraphes d'`ARCHITECTURE.md` renumérotés : §561 à §567. Chaque renvoi à un numéro déplacé a été relu un par un : 0165, 0166 et 0169 désignaient aussi la nature d'une absence, les jours travaillés et la Factur-X, qui gardent les leurs.

## Les mesures

| | Base | Navigateur | Construction | Connexion derrière un proxy |
|---|---|---|---|---|
| 1ʳᵉ batterie | 579 sur 583 | non mesurées | rouge | rouge |
| 2ᵉ batterie | **583 sur 583** | 214 sur 215 | verte | verte |
| rattrapage | 583 sur 583 | la suite rouge, verte | | |
| seconde fois | | la même, verte | | |

Types, style, mémoire du dépôt, fournisseurs d'IA et données de démonstration verts à chaque tour.

## Ce que la batterie a trouvé, et ce qui a été fait

| Rouge | D'où | Ce qui a été fait |
|---|---|---|
| Construction, suites navigateur, connexion | **mon installation** : les dépendances du dossier commun étaient un lien vers celles d'un autre dossier, et Turbopack refuse ce qui est hors du projet | de vraies dépendances installées dans le dossier |
| Les factures d'abonnement d'Atlas manquaient à « Mes données », et leur PDF à la liste des fichiers stockés | facture d'Atlas | **un vrai oubli** : elles partent dans la sauvegarde, leur PDF rangé sous « Abonnement Atlas » |
| « Le prévoir » posait le chantier sans son travail | le test de l'hivernage | **le test se trompait** : il lisait la base sans contexte d'entreprise, donc la RLS lui cachait la ligne. Il relit par `withEntreprise`, vert |
| La fermeture du compte : quatre cas rouges | le test de la fermeture | **le test se trompait, deux fois**, et de même sur la branche de la session 1 seule : il reprogrammait la fermeture d'un compte déjà fermé, donc en lecture seule ; et il comptait tous les comptes là où il ne fallait regarder que l'archivé. 13 sur 13 |
| La note de la fiche neuve « jamais arrivée » | le test de la note sans réseau | **le test lisait trop tôt** : la note était en base 71 ms après le client. Il attend la note, vingt secondes au plus |

## Ce qui a été dit et se révèle faux

- J'avais annoncé les lots de la session 5 comme vérifiés par tous leurs contrôles. Celui de l'hivernage portait trois boutons à coins carrés, contre ta règle : son contrôle n'avait pas été joué. Corrigé à la fusion.
- J'avais d'abord dit que les deux nouveaux rouges de la fermeture pouvaient venir de la fusion. Rejoués sur la branche de la session 1 seule, ils y étaient aussi.

## Ce qui reste, et qui le tranche

| | Qui |
|---|---|
| Regarder sur ton espace : la fiche d'un client avec un arrosage (la goutte, les deux questions, « Le prévoir »), le planning (la goutte dans la semaine et le mois), la note sans réseau (mode avion), le plafond dans Votre TVA et sur Terminés, la fiche travaux, la fiche de sécurité, « Fermer mon compte » | **toi**, une fois ton espace à jour |
| Dans « Le prévoir », les lignes matin, après-midi et journée sont des capsules, plus des rectangles comme sur la planche : c'est ta règle des boutons ronds | **toi**, si tu préférais la planche |
| La phrase « TVA non applicable » : à faire confirmer par ton comptable | **toi**, sans urgence (document à faire, point 18) |
| La ligne « 1 note à envoyer » sur l'accueil : une planche d'abord | **moi**, sur ton accord |
