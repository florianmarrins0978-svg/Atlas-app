# L'assistant connaît toute l'application

**Lot du 24 septembre 2026.** Tes deux demandes :

- *« s'il cherche une touche ou l'endroit où on range les devis, facture,
  avoir, fiche de sécurité, fiche d'intervention, n'importe quoi, il DOIT
  pouvoir lui répondre ! »*
- *« je veux que ce soit un vrai assistant, donc nourris-le avec toutes les
  fonctions de l'appli, qu'il soit capable de les expliquer ! »*

## En chiffres

| | Avant | Maintenant |
|---|---|---|
| Fiches du mode d'emploi | 64 | **324** |
| Anciennes fiches fausses ou floues | 36 sur 64, sans que rien ne le signale | récrites, et le contrôle les attrape désormais |
| Questions d'essai | 16 | **322**, au moins une par fiche |

## Ce qu'il sait expliquer maintenant, écran par écran

| Zone | Fiches | Exemples |
|---|---|---|
| Où se trouve quoi | 8 | les 5 onglets, où dorment devis, factures, fiches envoyées |
| Chantiers et fiche client | 57 | créer, dicter, photos, cartes « correction demandée », « devis accepté », Informations, Prix |
| Devis | 49 | lignes, unités, TVA, remise, acompte, dates, envoi, relance, devis refusé, ce que voit le client |
| Facture, Terminés, Ma TVA | 45 | facture sans devis, acompte, chèque, facture acquittée, paiement reçu, ticket de caisse, ancien IBAN |
| Planning | 39 | poser, déplacer, retirer, absences, équipes, fiche d'intervention, fiche de sécurité de bout en bout |
| Paysage, clients, catalogue | 51 | arrosage, fiche de chantier, diagnostic, fiches de sécurité, dossier client, supprimer un client |
| Réglages, compte, assistant | 75 | chaque rubrique, créer un compte, Face ID, agenda, équipe, IBAN, abonnement, l'assistant lui même |

## Comment il répond

1. Il cherche les 5 fiches les plus proches de ta question.
2. Il récite celle qui répond : le chemin depuis la barre du bas, puis le geste,
   avec le nom exact du bouton.
3. Si aucune ne répond, il lit la liste de toutes les fiches et prend la bonne.
4. S'il n'y en a vraiment aucune, il le dit. Il n'invente jamais un bouton.

## Trouvé en chemin : 36 des 64 anciennes réponses étaient fausses ou floues

Quelques exemples : l'écran « Fiche du chantier » n'existe plus (le micro est
sur la fiche client) ; « Déplacer » et « Retirer » du planning ont changé ; la
rubrique « Connexion » s'appelle « Mot de passe » et « Apparence » s'appelle
« Couleurs » ; il n'y a pas de bouton « Enregistrer » sur la fiche client.
Toutes sont corrigées, et le contrôle ne se laisse plus tromper par un
commentaire du code qui citait l'ancien nom.

## Ce qui reste ouvert

| | Qui |
|---|---|
| **L'avoir n'existe pas dans l'appli.** La facture écrit pourtant « Une correction passerait par un avoir ». L'assistant le dit franchement | toi : faire coder la planche « il ne paie pas » |
| **Aucun « mot de passe oublié »** à l'écran de connexion. L'assistant ne peut rien répondre | toi : à décider |
| Trois gestes introuvables : retirer une seule ligne de travaux supplémentaires, supprimer un achat dans Ma TVA, retrouver un ancien diagnostic végétal | à vérifier sur ton espace |
| **Pas essayé avec la vraie IA** (aucune clé ici). Tout est éprouvé avec le fournisseur d'essai | toi : « où sont mes factures », « je cherche la touche pour envoyer le devis », « comment je note un acompte » |
| La plupart des fiches sont prouvées contre le code, pas regardées à l'écran une par une | à regarder au fil de l'usage : une fiche fausse se corrige en une ligne |
| **Batterie complète pas jouée** (tu l'as demandé). Elle est obligatoire avant `main` | toi : me dire quand la lancer |

## Les contrôles joués

| Contrôle | Résultat |
|---|---|
| `test-mode-emploi` | 26 / 26 ; chaque fiche prouvée contre le code, 322 questions |
| `test-assistant-explique-l-appli` | 14 / 14 |
| `test-assistant-se-corrige`, `test-ia-02-assistant`, `test-agent-gestes` | verts |
| types, tirets, flèches, couches, code mort, pansements | verts |
