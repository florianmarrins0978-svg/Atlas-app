# L'assistant dit où les choses sont rangées

**Lot du 24 septembre 2026.** Ta demande : *« s'il cherche une touche ou
l'endroit où on range les devis, facture, avoir, fiche de sécurité, fiche
d'intervention, n'importe quoi, il DOIT pouvoir lui répondre ! »*

## Ce qui ne marchait pas (mesuré avant de toucher)

| Ta question | Ce qu'il répondait avant | Ce qu'il répond maintenant |
|---|---|---|
| où sont mes factures | comment créer une facture | Terminés, puis la ligne du chantier. Par client : Vos clients, son nom, onglet Factures |
| où sont mes devis | l'allure des devis (Réglages) | En cours : dans Chantiers. Partis : Vos clients, son nom, onglet Devis |
| où est la fiche de sécurité | la fiche d'entretien de Paysage | Paysage, puis Fiches de sécurité (gardées deux ans) |
| comment remplir la fiche de sécurité | rien | Planning, le nom du chantier, bandeau Fiche de sécurité, Remplir la fiche |
| où est la fiche d'intervention | la fiche d'entretien de Paysage | Planning, puis le nom du chantier dans sa journée |
| où sont les avoirs, comment faire un avoir | rien | Atlas ne fait pas encore d'avoir (voir plus bas) |
| il m'a payé, où je le note | la note vocale | Terminés, Ma TVA à déclarer, Factures en attente, J'ai reçu le paiement |
| où sont les retours d'intervention | rien | Terminés, puis Retours d'intervention |
| une facture sans devis | les réglages des documents | Terminés, puis Créer une facture |
| où est le planning, les réglages… | le plan d'arrosage, ou rien | l'onglet du bas qui porte ce nom |
| comment ajouter un salarié | les prestations d'un chantier | Réglages, Équipe, Donner un accès |

## Ce qui a été fait

| | Fichier |
|---|---|
| **16 fiches neuves** « où se trouve quoi », chacune prouvée contre le code | `src/lib/mode-emploi.ts` |
| une question en « où » préfère la fiche qui dit l'endroit | `chercherFiches` |
| **quand les mots ne suffisent pas, l'assistant lit la liste des fiches** et prend celle qui répond (« la touche pour… », « c'est rangé où ») ; il récite toujours la fiche, jamais de mémoire | `rechercher-mode-emploi.ts`, `assistant-service.ts` |
| il dit par quel onglet du bas on entre, avant le geste | consigne de l'assistant |

## Trouvé en chemin, et corrigé

**Quatre réponses enseignaient un bouton qui n'existe plus** : l'onglet
« À facturer » de Terminés (parti le 13 septembre, c'est l'œil maintenant),
« Ajouter un chantier » au planning (devenu « Ajouter » puis « Client en
attente »), l'onglet « Fiche chantier » du client (devenu « Fiches »), les
chartes Nuit et Sylve. Le contrôle aurait dû le voir : il se laissait tromper
par un commentaire du code qui citait l'ancien nom. Il ne l'est plus.

## Ce qui reste ouvert

| | Qui |
|---|---|
| **L'avoir n'existe pas dans l'application.** La facture écrit pourtant « Une correction passerait par un avoir ». L'assistant le dit franchement ; la fiche se récrira d'elle-même le jour où l'écran arrivera (la planche « il ne paie pas » est dessinée, pas codée) | toi : c'est ton arbitrage de le faire coder |
| **Pas essayé avec la vraie IA** (aucune clé sur ce poste). Tout a été éprouvé avec le fournisseur d'essai | toi, sur ton espace : pose-lui « où sont mes factures », « je cherche la touche pour envoyer le devis », « comment je fais un avoir » |
| La fiche d'intervention n'a pas été regardée à l'écran ici (le jeu d'essai n'a aucun chantier ce jour-là) ; son chemin est vérifié dans le code | vérifiable sur ton espace |

## Les chiffres

| Contrôle | Résultat |
|---|---|
| `test-mode-emploi` | 17 / 17, dont 23 de tes questions retrouvées |
| `test-assistant-explique-l-appli` | 14 / 14 ; les 4 nouveaux cas étaient **rouges avant** le lot |
| `test-assistant-se-corrige`, `test-ia-02-assistant`, `test-agent-gestes` | verts |
| types, lint, tirets, flèches, couches, code mort, pansements | verts |
| Écrans regardés : Terminés, Ma TVA, Paysage, Vos clients, un dossier client | les libellés enseignés y sont |
| **Batterie complète** (niveau 3 exigé) | voir le message de livraison |
