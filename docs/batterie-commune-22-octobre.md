# La batterie commune du 22 octobre 2026

Sept lots qui attendaient leur batterie, réunis dans un seul dossier
(`atlas-app-commune-22`) et passés sur `main` le 23 octobre 2026
(`4c0b55cb..6ccd832e`), à la demande du patron : *« fusionne les six ensemble et
ne joue qu'une seule batterie pour vous toutes »*.

## 1. Les sept lots

| Lot | Venu de | Migration | Architecture |
|---|---|---|---|
| Prix dicté et main d'œuvre | session 3f | 0135 | §480 |
| Ma banque, l'essai | session 8a | aucune | §481 |
| Importer devis et factures | session du cloud | 0136 | §482 |
| Tout télécharger d'un client | session du cloud | aucune | §483 |
| Lignes de goutte-à-goutte, « Dessiner le plan » revu | session du cloud | aucune | §484, §485 |
| Facturer une mairie | cette session | 0137 | §486 |
| Le Filtre des listes de clients | cette session | aucune | §487 |

**Renumérotés à la réunion** : trois lots portaient une migration 0135 et cinq un
§480. Chacun a pris le numéro suivant, dans l'ordre d'entrée, avec ses renvois,
fichier par fichier du seul lot concerné. Le §233 du prix dicté (déjà pris par la
note vocale) est devenu §480.

## 2. Ce que la batterie a trouvé entre les lots, et ce qui a été fait

| Rouge | Venu de | Correction |
|---|---|---|
| Deux tuiles et une carte aux coins carrés | Import, Lignes | ce sont une carte et des tuiles, pas des boutons : exemptées ligne par ligne, comme les cases du calendrier |
| Cinq routes sans garde de chemin | Banque, Import | gardées par le patron seul, plus strict : inscrites aux exemptions, comme « mes-donnees » |
| La route de dépôt de l'import prise pour une route qui sert un PDF | Import | le contrôle reconnaît désormais une route qui SERT : elle construit une réponse |
| Colonne de fichier non déclarée | Import | `pieces_importees.fichier_cle` ajoutée aux objets stockés |
| Trois actions sans garde reconnue | Import | `patronQuiImporte` entre dans la liste des gardes reconnues |
| « Annuler » illisible en mode nuit (2,49) | Import | `orSurEncre`, le jeton fait pour l'or posé sur l'encre |
| La technique et le diamètre ne se demandaient plus | Prix dicté | corrigé par la session 3f : la carte main d'œuvre s'ajoute aux questions |
| Le second appui sur la dictée n'allait plus au devis | Prix dicté | corrigé par la session 3f, défaut ancien qu'il démasquait |
| Cinq questions au lieu de quatre au plus | Prix dicté | la carte main d'œuvre porte sa sorte ; la limite ne compte que la grille |
| Le zip relu sous Windows (« Devis\ ») | Tout télécharger | le test ramène les chemins à « / » |
| Pages publiques : Node planté après « 0 échec » | outillage | la suite pose son code de sortie au lieu de couper Node |
| La session survit à la déconnexion | voir §3 | la suite suit la séquence du patron ; le défaut est noté |

## 3. Le défaut de sécurité trouvé en chemin

**Une requête partie avant la déconnexion, revenue après, peut ressusciter la
session.** Chaque réponse prolonge la session en reposant son cookie. Ouvrir la
feuille « Se déconnecter » fait précharger quatre pages des Réglages ; si l'une
revient après la réponse de la déconnexion, elle repose le cookie que la sortie
venait d'effacer.

- **Hors de portée d'un doigt** : il faut confirmer moins de deux secondes après
  avoir ouvert la feuille. Le patron ouvre, lit, confirme.
- **Pas propre aux lots** : le mécanisme existe sur `main`. La charge des sept lots
  ne faisait que rapprocher les temps de réponse.
- **Inscrit dans `TODO.md`**, à corriger dans un lot d'authentification (niveau 3) :
  une session fermée doit être révoquée côté serveur, pas seulement son cookie
  effacé. Le jeton porte déjà une identité de session stable (`sessionId`).

## 4. Les chiffres

| | Première batterie | Seconde batterie | Après corrections |
|---|---|---|---|
| Suites base | rouges | 480 / 491 | 3 rouges, les mêmes sur `main` |
| Suites navigateur | 182 / 191 | 187 / 191 | rencontre 13 / 13 |
| Connexion derrière un proxy | verte | verte | |

**Les trois rouges qui restent existent sur `main`, à l'identique**
(`verifier-rouge-prealable.ts`) : `test-banc-lent-se-dit`, `test-garde-fusion-main`
et `test-rappel-arrosage`. Ils tiennent à Windows (fins de ligne, ports d'essai)
et ne viennent d'aucun lot.

Chaque correction de suite a été rejouée au moins deux fois seule. La
déconnexion a été rejouée huit fois, et cherchée par dichotomie sur les états
intermédiaires de la réunion.

## 5. Ce qui reste ouvert

| | Qui |
|---|---|
| Révoquer côté serveur une session fermée | un lot d'authentification à part |
| Confirmer la phrase des retards d'un client public (BCE + 8 points, 40 €) | son comptable |
| Mettre à jour la question 31 de `docs/QUESTIONS.md` (la mairie est désormais distinguée) | avec l'accord du patron |
