# Batterie commune du 26 octobre : six lots, une seule mesure

Sa demande : *« 6 sessions attendent de jouer une batterie, numérotées de 1 à 6, fusionne et joue une seule batterie pour toutes »*, puis *« vérifie que tu as tout leur travail ; s'il y a un problème, tu corriges, et une fois que c'est vert, tu fusionnes sur main sans me demander »*.

Branche : `lot/batterie-commune-26-octobre`, partie de `main` (c69c9e8).

## Les six lots, et ce que chaque session a confirmé

| Session | Lot | Branche fusionnée | Reste-t-il quelque chose ? |
|---|---|---|---|
| 1 | Ma TVA soignée | `lot/ma-tva-soignee` (c3c9bed) | Dossier propre. Trois écarts mineurs avec la planche, non demandés, laissés (voir plus bas) |
| 2 | Les seize rubriques des Réglages | `correction-reglages` (a717b5a) | Dossier propre. Planches codées |
| 3 | Créer un compte soigné | `lot/creer-un-compte-soigne` (140019c) | Dossier propre. Planche codée |
| 4 | Pour mon comptable | `claude/pour-mon-comptable-soigne` (3e56651) | Dossier propre. Planches codées |
| 5 | Le plan d'arrosage soigné | `lot/arrosage-soigne` (3eef6a8) | Dossier propre. Planche codée |
| 6 | Le planning soigné | `lot/planning-soigne` (408fa24) | Codé ici |

Chaque branche est entièrement contenue dans la fusion (aucun commit manquant, vérifié après coup).

## Ce que la fusion a demandé

| Rencontre | Ce qui a été fait |
|---|---|
| Deux migrations **0148** (crédits IA sur `main`, virement reçu du comptable) | Celle du comptable devient **0150**. Elle ne touche que `mouvements_bancaires`, que 0149 n'altère pas : la passer après ne change rien à ce qu'elle fait. Jamais passée sur sa base |
| `ARCHITECTURE.md` : six paragraphes neufs, tous numérotés §507 ou §509 | Renumérotés §514 (planning), §515 (comptable), §516 (arrosage), §517 (création de compte), §518 (Réglages) ; chaque renvoi relu un par un |
| Face ID : la création de compte avait sorti le geste dans `useActiverFaceId`, les Réglages avaient redessiné l'écran | L'écran des Réglages, avec le geste partagé |
| Abonnement : les crédits IA de `main` et l'état soigné des Réglages | Les deux |
| Qui a accès, Nouveau compte : la preuve d'identité de l'audit (E11) et l'allure des Réglages | L'allure du lot, et la preuve gardée : donner, changer ou retirer un accès redemande toujours le mot de passe |
| Créer un compte : `main` n'avait changé que deux commentaires | La page du lot |

## Les rouges de la batterie, et leur correction

Batterie entière : 518/522 suites base, 195/197 suites navigateur, connexion derrière un proxy verte.

| Rouge | Cause | Correction |
|---|---|---|
| Mémoire du dépôt | `TODO.md` citait `fournisseurs/actions.ts` sans son chemin | chemin complet |
| `test-geste-retour-partout` | le contrôle lisait la CONDITION d'un ternaire comme un libellé : le champ de la porte passait pour un bouton retour | il ne lit plus que les deux branches |
| `test-tous-les-pdf` | « Voir un exemple » range l'adresse de la visionneuse dans une constante, prise pour un lien direct vers le PDF | même règle pour la constante que pour le lien |
| `test-objets-stockes` | la pièce d'un virement reçu (`mouvements_bancaires.piece_cle`) n'était pas déclarée | déclarée, la cohérence des fichiers la suit |
| `test-mode-emploi` | l'assistant enseignait l'ancien agenda du planning, le mot « La semaine », et « Entrer dans Atlas » au mauvais fichier | fiches réécrites sur les écrans d'aujourd'hui |
| `test-agenda-reglages-e2e` | cherchait l'ancienne phrase de l'agenda | touche « Relier votre agenda », devenu le lien |
| `test-boutons-arrondis` (vu avant la batterie) | deux interrupteurs du plan d'arrosage à 9 px | arrondis, sa règle du 12 août |
| `test-dossiers-comptables-e2e` | « Télécharger » : le navigateur de ce poste nomme « download » un fichier tiré d'un blob | **rouge de la même façon sur `main` seul** (`verifier-rouge-prealable.ts`) : pas ces lots |

Après correction, les rouges et ce qu'ils touchent ont été rejoués (`verifier-ce-qui-a-bouge.ts`) : tout vert, sauf le dernier, préexistant.

## Ce qui reste ouvert

- **Ma TVA**, trois écarts avec la planche, non demandés : le message « montant rentré au relevé » reste en texte gris (la planche : une plage verte) ; le bouton de l'année garde son dessin (la planche le cerne) ; « Payé par » reste au-dessus du déroulant (la planche : à gauche). À lui de dire s'il les veut.
- **Pour mon comptable** : la lecture IA du total d'une facture faite hors d'Atlas n'a jamais été éprouvée faute de clé ici ; la contrainte de cohérence est posée NOT VALID, à valider sur sa base (`TODO.md`).
- **Réglages** : « Annuler » sous FichePhoto, la phrase cassée de `FeuillePiece.tsx`, l'uniformisation des interrupteurs hors des Réglages (`TODO.md`).
- `test-dossiers-comptables-e2e` : rouge sur ce poste avant ces lots, à éprouver sur une machine où le navigateur garde le nom du fichier.

## Corrigé noir sur blanc

Pendant la batterie, j'ai écrit la correction du contrôle des retours dans le dossier qui se mesurait, puis je l'ai retirée aussitôt : l'arbre est revenu identique au contenu près, et la batterie compare des contenus. La correction a été posée après la mesure.
