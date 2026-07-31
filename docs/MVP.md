# Atlas MVP — Spécification

Ce document est la spécification détaillée officielle du projet. Toute évolution du périmètre doit être validée explicitement avant développement.

## 1. Objectif

Livrer une application mobile (PWA) réellement utilisable par un artisan en moins d'un mois, couvrant un seul parcours : dictée sur chantier → vérification humaine → calcul du prix → préparation du devis → planning simple.

Atlas MVP n'est pas un ERP. Il ne remplace ni la comptabilité, ni la gestion de stock, ni la paie. Ces briques existent déjà ailleurs et ne sont pas recréées.

> **Extension de périmètre actée (2026-07-31).** Le produit visé dépasse désormais ce seul parcours : un agent qui prépare aussi l'envoi du devis au client, la proposition de date depuis l'agenda, puis la facture et le relevé de TVA en fin de chantier. Le cadrage complet est dans [`AGENT.md`](AGENT.md), qui fait autorité sur la direction du produit ; le présent document reste la référence du parcours socle décrit ci-dessous.
>
> **Cette extension ne fait pas d'Atlas un logiciel de facturation.** L'agent *prépare* la facture et le relevé de TVA ; l'émission légale conforme — numérotation inviolable, archivage, Factur-X, obligations 2026/2027 — revient à un outil comptable existant auquel on se branche par interface. Voir `AGENT.md` §6.

## 2. Principe fondamental

Le patron reste l'unique expert du chantier. L'IA ne décide jamais : elle transcrit une dictée et propose une structuration modifiable. Aucune durée, aucun nombre d'hommes, aucun matériel, aucun prix n'est jamais affirmé par l'IA sans validation humaine explicite. Aucun devis n'est envoyé sans validation humaine.

## 3. Parcours utilisateur (parcours principal, ne pas dévier)

1. Le patron crée un chantier et enregistre les coordonnées du client en une seule étape (écran fusionné).
2. Il ajoute des photos du chantier (mémoire visuelle uniquement, aucune analyse automatique).
3. Il enregistre une note vocale.
4. L'application transcrit la note.
5. L'application affiche directement les informations structurées extraites (prestations, durée, équipe, matériel) — la transcription brute reste accessible via un bouton « Voir la transcription », ce n'est pas un écran séparé dans le flux.
6. Le patron vérifie et corrige chaque champ structuré.
7. L'application calcule le prix à partir des tarifs définis par l'entreprise (jamais un prix inventé par l'IA).
8. Les données validées sont formatées pour l'export vers le système de devis existant (pas de génération de devis interne).
9. Le chantier est placé dans un planning simple.

## 4. Écrans (V0 — squelette de navigation)

| # | Écran | Contenu |
|---|-------|---------|
| 1 | Liste des chantiers | Accueil, liste avec statut, accès à chaque chantier, bouton « Nouveau chantier » |
| 2 | Nouveau chantier + client (fusionné) | Nom du chantier, adresse, nom client, téléphone client, adresse client si différente |
| 3 | Fiche chantier | Hub : accès photos, note vocale, informations structurées, prix, export, statut |
| 4 | Photos | Galerie, ajout de photo, aucune analyse |
| 5 | Note vocale | Enregistrement, liste des notes existantes |
| 6 | Informations structurées | Prestations / durée / équipe / matériel proposés, tous éditables ; bouton « Voir la transcription » |
| 7 | Transcription complète | Texte brut de la dictée (accessible depuis l'écran 6, pas une étape du flux) |
| 8 | Récapitulatif prix | Calcul basé sur les tarifs de l'entreprise, éditable |
| 9 | Export devis | Aperçu des données formatées, bouton d'envoi vers le système existant avec confirmation explicite |
| 10 | Planning | Vue liste chronologique simple des chantiers |
| 11 | Réglages tarifs | Grille tarifaire de l'entreprise, éditable par le patron |

## 5. Hors périmètre (rappel)

Comptabilité, paiement en ligne, stocks, paie, RH, suivi GPS, WhatsApp, analyse vidéo, analyse automatique de photos, reconnaissance d'objets/arbres, optimisation de tournées, microservices, statistiques avancées, tableau de bord complexe.

**Émission légale des factures** : hors périmètre définitivement, quel que soit le stade. Atlas prépare les données, un outil comptable conforme émet le document. Ce n'est pas un « pas encore » : c'est un risque juridique qu'on ne prend pas.

**Facturation et TVA au sens de la préparation** : ces briques sortent du hors-périmètre depuis l'extension du 2026-07-31 (voir §1). Elles restent hors du parcours socle décrit en §3, et sont cadrées dans [`AGENT.md`](AGENT.md).

## 6. Stack technique

- **Frontend** : Next.js (App Router) en PWA — un seul codebase web installable mobile, itération rapide.
- **Backend** : API routes Next.js dans un premier temps ; extraction vers un service séparé si besoin plus tard (pas de microservices dès le départ).
- **Base de données** : à définir à l'étape de connexion des données réelles (SQLite/Postgres) ; V0 = données fictives en mémoire/JSON.
- **Transcription** : service externe (ex. Whisper API), branché via variable d'environnement, jamais de clé en dur.
- **Extraction structurée** : appel LLM avec sortie JSON contrainte, toujours présentée comme « à vérifier ».
- **Stockage photos/audio** : stockage objet externe, câblé plus tard ; V0 = fichiers locaux fictifs.

## 7. Méthode de travail

- Étapes petites et vérifiables.
- Après chaque écran important : lancement de l'app + capture d'écran mobile (Playwright), enregistrée dans `artifacts/screenshots/`.
- Présentation des captures avant toute nouvelle étape majeure.
- Données fictives avant connexion de services réels.
- Aucune fonctionnalité hors périmètre sans demande explicite.
- Aucune clé API en dur — variables d'environnement uniquement.
- Pas de suppression/réécriture de code existant sans justification.

## 8. Statut actuel

V0 en cours : squelette de navigation Next.js/PWA avec données fictives, aucune logique métier (pas de vraie transcription, pas de vrai calcul, pas de vrai export).
