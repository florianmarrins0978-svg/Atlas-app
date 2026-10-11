# ATLAS — QUALIFICATION FINALE AVANT MISE EN PRODUCTION

Tu vas agir comme **responsable QA senior d’Atlas**.

Atlas approche de sa mise en production. Je veux maintenant une campagne de qualification extrêmement approfondie permettant de déterminer objectivement si l’application est prête à recevoir de vrais clients.

Cette mission ne consiste PAS à parcourir quelques pages et dire « ça fonctionne ».

Je veux construire une véritable infrastructure de contrôle qualité durable :

- exploration réelle de l’application ;
- tests automatisés ;
- tests métier ;
- tests E2E ;
- tests API ;
- tests de permissions ;
- tests multi-entreprises ;
- tests documents/PDF ;
- tests de concurrence ;
- tests de volumétrie ;
- tests de résilience ;
- tests de performance et de charge ;
- rapport de qualification ;
- future batterie de non-régression.

L’objectif final est de savoir précisément :

**ce qui fonctionne, ce qui ne fonctionne pas, ce qui résiste à la charge, ce qui casse et si Atlas peut réellement être commercialisé.**


# 0 — RÈGLE ABSOLUE DE SÉCURITÉ : NE JAMAIS TESTER SUR L’APPLICATION RÉELLE
---
QA update (2026-08-31): full E2E battery executed after Windows-specific fixes. See [QA_EXECUTION_LOG.md](QA_EXECUTION_LOG.md) and [QA_FINDINGS.md](QA_FINDINGS.md) for results and next actions.

Cette règle passe avant toutes les autres.

## INTERDIT

Tu ne dois JAMAIS effectuer les tests destructifs, volumétriques, de concurrence ou de charge :

- sur la production ;
- sur la vraie base de données ;
- sur les vraies données ;
- directement sur la branche principale `main` ;
- sur un stockage contenant de vrais fichiers clients ;
- avec de vrais envois d’e-mails/SMS ;
- avec une véritable facturation externe ;
- avec des intégrations externes susceptibles d’avoir des conséquences réelles.

Tu ne dois jamais mettre en danger l’application fonctionnelle actuelle.

## ENVIRONNEMENT OBLIGATOIRE

Avant toute campagne importante :

1. identifie l’environnement actuel ;
2. identifie la branche Git actuelle ;
3. identifie la base de données utilisée ;
4. identifie les services externes ;
5. identifie les stockages utilisés.

Ensuite crée ou utilise un environnement totalement isolé dédié aux tests.

Utilise selon l’architecture existante :

- une branche Git dédiée, par exemple `qa/qualification-finale` ;
- idéalement un Git worktree ou une copie de travail séparée ;
- une base PostgreSQL exclusivement réservée aux tests ;
- des entreprises fictives ;
- des utilisateurs fictifs ;
- des clients fictifs ;
- des chantiers fictifs ;
- des devis/factures fictifs ;
- un stockage de test ;
- des mocks/sandbox pour les services externes.

Ne fusionne rien dans `main`.

Ne déploie rien en production.

Ne supprime aucune donnée réelle.

Si l’environnement disponible n’est pas suffisamment isolé pour une catégorie de tests, NE LANCE PAS cette catégorie de tests.

Indique simplement :

`TEST NON EXÉCUTÉ — ENVIRONNEMENT NON SÛR`

et continue toutes les autres investigations possibles.

En particulier :

**aucun test de charge massif avant d’avoir prouvé que la cible est un environnement de test.**

---

# 1 — NE CORRIGE PAS ATLAS PENDANT LA PREMIÈRE CAMPAGNE

Pendant la phase initiale de qualification :

**NE CORRIGE AUCUN BUG FONCTIONNEL D’ATLAS.**

Tu peux ajouter ou modifier uniquement ce qui est nécessaire à la campagne :

- tests ;
- fixtures ;
- helpers ;
- données synthétiques ;
- mocks ;
- scripts de seed QA ;
- configuration Playwright ;
- scripts k6 ;
- instrumentation QA ;
- rapports ;
- documentation de test.

Mais tu ne dois pas changer le comportement métier d’Atlas simplement pour obtenir du vert.

Si un test révèle un bug :

1. reproduis le problème ;
2. écris si possible un test qui le reproduit ;
3. laisse ce test rouge ;
4. documente le problème.

Je veux d’abord une photographie honnête de l’état d’Atlas.

Les corrections auront lieu APRÈS le premier rapport de qualification.

---

# 2 — CRÉE UNE MÉMOIRE PERSISTANTE DE LA CAMPAGNE

Cette mission peut être longue.

Ne compte donc pas uniquement sur le contexte de conversation.

Crée dès le début dans la branche QA :

`QA_MASTER_PLAN.md`

`QA_TEST_MATRIX.md`

`QA_FINDINGS.md`

`QA_EXECUTION_LOG.md`

`QA_REPORT.md`

Utilise-les pendant toute la campagne.

Avant chaque nouvelle grande phase, relis les règles importantes du `QA_MASTER_PLAN.md`.

Mets régulièrement à jour :

- ce qui a été découvert ;
- ce qui a été testé ;
- ce qui reste à tester ;
- les bugs ;
- les tests rouges ;
- les tests impossibles à exécuter ;
- les raisons.

Ne perds jamais une anomalie simplement parce qu’un sous-agent ou une ancienne session l’a découverte.

---

# 3 — COMMENCE PAR CARTOGRAPHIER L’APPLICATION

Ne commence pas par écrire au hasard des tests Playwright.

Inspecte d’abord entièrement le dépôt.

Le code est la source de vérité.

Identifie notamment :

- pages ;
- routes ;
- API ;
- Server Actions si présentes ;
- formulaires ;
- boutons ;
- menus ;
- modales ;
- boutons ON/OFF ;
- paramètres ;
- feature flags ;
- états métier ;
- rôles ;
- permissions ;
- modèle de données ;
- tables ;
- relations ;
- documents ;
- automatisations ;
- tâches différées ;
- stockage ;
- photos/fichiers ;
- fonctions IA ;
- intégrations externes.

Cartographie toutes les grandes zones fonctionnelles réellement présentes, notamment si elles existent :

- accueil ;
- clients ;
- chantiers ;
- devis ;
- factures ;
- avoirs ;
- acomptes ;
- règlements ;
- planning ;
- équipe ;
- utilisateurs ;
- réglages ;
- Mon entreprise ;
- Paysage ;
- outils spécialisés ;
- génération de documents ;
- recherche ;
- archivage ;
- exports ;
- notifications.

Ne te limite PAS à cette liste.

Si le dépôt contient une fonctionnalité que je n’ai pas mentionnée, ajoute-la à la campagne.

---

# 4 — INVENTORIE LES TESTS EXISTANTS

Avant d’ajouter des tests, inspecte tous ceux déjà présents.

Pour chacun détermine :

- ce qu’il vérifie ;
- son niveau : unitaire/API/intégration/E2E/sécurité ;
- s’il passe ;
- s’il échoue ;
- s’il est skippé ;
- s’il semble fragile ;
- s’il couvre encore une fonctionnalité existante ;
- s’il existe des doublons.

Ne supprime jamais un test simplement parce qu’il est rouge.

Rejoue les batteries importantes existantes, particulièrement celles liées à :

- authentification ;
- autorisation ;
- rôles ;
- sessions ;
- multi-entreprises ;
- devis/factures ;
- sécurité ;
- base de données.

---

# 5 — CONSTRUIS LA MATRICE DE QUALIFICATION

Pour chaque fonctionnalité identifiée, renseigne dans `QA_TEST_MATRIX.md` :

`Fonctionnalité | scénario | préconditions | rôle | données | résultat attendu | niveau de criticité | automatisable | test existant | test créé | résultat`

Pour chaque fonctionnalité importante prévoir au minimum :

- happy path ;
- valeurs limites ;
- mauvaise entrée ;
- champ absent ;
- erreur réseau ;
- erreur serveur lorsque pertinente ;
- permissions ;
- persistance ;
- actualisation ;
- navigation arrière ;
- double clic ;
- concurrence lorsque pertinente ;
- multi-entreprise lorsque pertinente.

---

# 6 — PARCOURS COMPLET D’UN ARTISAN

Utilise un vrai navigateur automatisé, de préférence Playwright si cohérent avec le dépôt.

Je veux plusieurs parcours de bout en bout.

Au minimum, reproduis le véritable cycle métier découvert dans Atlas.

Par exemple, si cela correspond au workflow réel :

connexion  
→ entreprise  
→ client  
→ chantier  
→ informations chantier  
→ prestations  
→ devis  
→ génération du document  
→ validation/acceptation  
→ facture  
→ paiement éventuel  
→ planning  
→ changement d’état  
→ chantier terminé.

Mais ne force pas ce workflow si le code montre un fonctionnement différent.

Teste le fonctionnement réel d’Atlas.

Un parcours n’est PAS validé simplement parce qu’aucune exception n’est apparue.

À chaque étape, fais des assertions explicites.

---

# 7 — CLIENTS

Tester notamment :

- création ;
- modification ;
- consultation ;
- recherche ;
- filtrage ;
- suppression/archivage si disponible ;
- doublons ;
- particulier/professionnel si disponible ;
- données obligatoires ;
- données facultatives ;
- accents ;
- apostrophes ;
- caractères spéciaux ;
- noms très longs ;
- adresses longues ;
- téléphone ;
- e-mail ;
- navigation client → chantier ;
- chantier → client ;
- persistance après refresh.

Tester les volumes :

1  
10  
100  
1 000 clients.

Puis 10 000 si cela reste raisonnable et sûr dans l’environnement QA.

---

# 8 — CHANTIERS

Découvre tous les états de chantier dans le code.

Teste chaque transition valide.

Teste également les transitions interdites.

Créer plusieurs catégories de chantiers :

- minimal ;
- standard ;
- complexe ;
- très fourni ;
- avec photos ;
- sans photos ;
- avec notes ;
- avec données manquantes ;
- avec nombreuses prestations.

Tester :

- création ;
- modification ;
- sauvegarde ;
- refresh ;
- navigation arrière ;
- fermeture/réouverture ;
- changement d’état ;
- terminaison ;
- double clic ;
- deux onglets ;
- deux utilisateurs simultanés.

Aucune donnée ne doit disparaître silencieusement.

---

# 9 — DEVIS

Cette partie est CRITIQUE.

Tester :

- devis minimal ;
- une ligne ;
- plusieurs lignes ;
- beaucoup de lignes ;
- quantités variées ;
- unités variées ;
- décimales ;
- TVA ;
- plusieurs taux si disponibles ;
- remises si disponibles ;
- valeurs limites ;
- arrondis ;
- modification ;
- sauvegarde ;
- changement d’état ;
- génération du PDF ;
- transformation vers l’étape suivante.

Pour chaque scénario important, recouper :

**interface → API → base de données → document généré.**

Ne valide jamais un montant uniquement parce qu’il est correct visuellement.

Vérifie indépendamment les calculs lorsque raisonnablement possible :

- quantité ;
- prix unitaire ;
- HT ;
- TVA ;
- TTC ;
- remises ;
- totaux.

Chercher notamment :

- quantité perdue ;
- unité perdue ;
- ligne fusionnée incorrectement ;
- ligne manquante ;
- prix incorrect ;
- TVA incorrecte ;
- total faux ;
- mauvaise entreprise ;
- mauvais client ;
- texte tronqué ;
- caractères cassés ;
- ancien réglage qui réapparaît.

---

# 10 — FACTURES ET DOCUMENTS FINANCIERS

Même niveau d’exigence.

Tester notamment :

- création depuis devis ;
- création directe si disponible ;
- numérotation ;
- unicité ;
- dates ;
- client ;
- entreprise ;
- lignes ;
- quantités ;
- TVA ;
- totaux ;
- statuts ;
- PDF ;
- transitions autorisées ;
- transitions interdites.

TEST CRITIQUE :

Deux utilisateurs tentent de créer une facture quasiment simultanément.

Vérifier qu’il est impossible d’obtenir :

- numéro dupliqué ;
- facture partielle ;
- deux documents représentant la même opération involontairement ;
- incohérence DB/PDF ;
- montant différent suivant la page consultée.

Effectue des tests similaires pour les avoirs, acomptes ou autres documents si Atlas les possède.

---

# 11 — TEST D’HISTORISATION DES DOCUMENTS

Cette campagne est CRITIQUE.

Le but est de vérifier qu’une modification ultérieure des réglages ne réécrit pas l’histoire.

Scénario type :

1. configurer l’entreprise avec une identité/configuration A ;
2. créer un client ;
3. créer un devis ;
4. finaliser/émettre le document selon le fonctionnement Atlas ;
5. enregistrer son contenu exact ;
6. enregistrer les données DB pertinentes ;
7. conserver le PDF ;
8. modifier ensuite `Mon entreprise` vers configuration B ;
9. modifier éventuellement certaines informations du client ;
10. revenir sur le document historique ;
11. vérifier son contenu ;
12. vérifier le PDF ;
13. vérifier la DB ;
14. créer ensuite un nouveau document.

Résultat attendu à déterminer selon les règles réelles d’Atlas :

- ancien document historiquement figé lorsque cela doit être le cas ;
- nouveau document utilisant les nouvelles données.

Teste notamment les modifications :

- dénomination ;
- nom ;
- adresse ;
- forme juridique ;
- capital ;
- SIREN/SIRET ;
- TVA ;
- coordonnées ;
- coordonnées bancaires ;
- logo ;
- mentions ;
- client.

Si un document qui doit être historiquement figé se transforme rétroactivement :

classe le problème au minimum **P1**, voire **P0** selon l’impact.

Ne décide pas seul d’une règle juridique inconnue.

Si une règle métier ou légale est ambiguë :

`À ARBITRER PAR LE PATRON`

et continue les autres tests.

---

# 12 — RÉGLAGES → MON ENTREPRISE

Inspecte tous les champs réellement présents.

Pour CHAQUE champ :

1. lire la valeur ;
2. la modifier ;
3. enregistrer ;
4. actualiser ;
5. quitter ;
6. revenir ;
7. se déconnecter/reconnecter si pertinent ;
8. vérifier la persistance ;
9. créer un nouveau devis ;
10. créer une nouvelle facture ;
11. vérifier l’interface ;
12. vérifier les données ;
13. vérifier le PDF.

Chercher les données périmées qui subsistent après modification.

---

# 13 — FORMES JURIDIQUES

Découvre dans le code toutes les formes juridiques réellement supportées.

NE LES INVENTE PAS.

Pour chacune :

- sélectionner ;
- renseigner les champs correspondants ;
- sauvegarder ;
- refresh ;
- reconnexion ;
- vérifier l’affichage ;
- créer un devis ;
- créer une facture ;
- vérifier les documents ;
- contrôler les champs conditionnels.

Puis effectuer des transitions entre formes :

A → B  
B → C  
C → A

Chercher les reliquats :

- champ ancien restant en DB ;
- ancienne mention ;
- ancien capital ;
- anciennes informations visibles ;
- PDF mélangeant deux formes juridiques.

Les règles juridiques externes ne doivent jamais être inventées.

Lorsque tu contrôles une obligation légale, base-toi uniquement sur une source officielle ou sur une règle explicitement fournie dans le projet.

Signale séparément :

`CONTRÔLE JURIDIQUE À VALIDER HUMAINEMENT`

lorsque nécessaire.

---

# 14 — TOUS LES BOUTONS ON/OFF ET FEATURE FLAGS

Découvre automatiquement toutes les options booléennes ou mécanismes équivalents.

Pour chacune :

## OFF

Vérifier :

- interface ;
- menu ;
- pages ;
- URL directe ;
- API ;
- données ;
- documents ;
- permissions ;
- persistance.

## ON

Refaire les mêmes contrôles.

Puis :

- refresh ;
- navigation ;
- reconnexion ;
- changement de rôle ;
- autre entreprise.

TEST MULTI-ENTREPRISE :

Entreprise A : ON  
Entreprise B : OFF

Modifier A ne doit jamais changer B.

Tester également :

- entreprise nouvellement créée ;
- entreprise datant d’avant l’apparition du réglage si la migration permet de reproduire ce cas.

Pour les interactions entre plusieurs options, utiliser une stratégie de couverture intelligente/pairwise lorsque toutes les combinaisons seraient inutilement gigantesques.

---

# 15 — RÔLES ET PERMISSIONS

Découvre les rôles réellement implémentés.

Teste CHAQUE rôle.

Pour chaque fonctionnalité :

- visible ou non ;
- lecture ;
- création ;
- modification ;
- suppression ;
- téléchargement ;
- accès aux montants ;
- réglages ;
- Mon entreprise ;
- clients ;
- chantiers ;
- devis ;
- factures ;
- planning ;
- fonctions Paysage ;
- outils spécialisés.

IMPORTANT :

Une fonctionnalité cachée dans l’interface n’est PAS considérée protégée.

Teste également :

- URL directe ;
- API ;
- modification d’identifiant ;
- appel serveur direct.

Une autorisation frontend sans protection serveur est un bug sérieux.

---

# 16 — ISOLATION MULTI-ENTREPRISE

Créer au minimum :

ENTREPRISE A  
ENTREPRISE B.

Plusieurs comptes avec des rôles différents.

Créer des données distinctes dans A et B.

Vérifier que A ne peut jamais lire/modifier/télécharger/supprimer une donnée de B.

Tester :

- client ;
- chantier ;
- devis ;
- facture ;
- document ;
- photo ;
- fichier ;
- planning ;
- utilisateur ;
- réglage ;
- recherche ;
- URL ;
- API ;
- ID manipulé ;
- jeton public éventuel.

Puis effectuer les tests inverses B → A.

Tout accès inter-entreprises non prévu est **P0**.

---

# 17 — CONCURRENCE

Créer des scénarios où plusieurs utilisateurs travaillent simultanément.

Exemples :

- deux modifications du même client ;
- deux modifications du même chantier ;
- deux modifications du même devis ;
- deux créations de facture ;
- modification de Mon entreprise pendant génération d’un document ;
- changement de réglage pendant utilisation de la fonction.

Chercher :

- lost update ;
- écrasement silencieux ;
- doublon ;
- état impossible ;
- numéro dupliqué ;
- corruption partielle.

---

# 18 — TESTS NÉGATIFS ET RÉSILIENCE

Tester lorsque raisonnablement possible :

- champ vide ;
- quantité zéro ;
- quantité négative ;
- valeur énorme ;
- texte énorme ;
- fichier trop volumineux ;
- mauvais format ;
- double clic ;
- clic répété ;
- refresh pendant sauvegarde ;
- retour navigateur ;
- session expirée ;
- déconnexion pendant une action ;
- timeout ;
- erreur API ;
- erreur stockage ;
- réponse lente ;
- erreur DB ;
- erreur fournisseur IA ;
- réponse IA vide/invalide/tronquée.

Lorsque possible, utilise l’interception réseau pour provoquer volontairement :

- HTTP 500 ;
- timeout ;
- lenteur ;
- réponse invalide.

Atlas ne doit jamais transformer silencieusement une panne technique en donnée métier incohérente.

---

# 19 — FONCTIONS IA

Découvre toutes les fonctionnalités utilisant une IA.

Pour chacune tester :

- résultat normal ;
- réponse vide ;
- JSON invalide ;
- réponse partielle ;
- timeout ;
- erreur fournisseur ;
- fichier inexploitable ;
- ambiguïté métier.

Vérifier qu’aucune réponse IA erronée ne peut silencieusement :

- modifier un montant ;
- supprimer une donnée ;
- inventer une information critique ;
- contourner une validation humaine attendue ;
- corrompre une donnée existante.

---

# 20 — DOCUMENTS PDF : CONTENU + RENDU

Ne teste pas uniquement la présence du PDF.

Pour les documents critiques :

## Assertions métier

Vérifier :

- données entreprise ;
- données client ;
- lignes ;
- quantités ;
- unités ;
- montants ;
- TVA ;
- totaux ;
- numéro ;
- date ;
- mentions conditionnelles.

## Régression visuelle

Lorsque techniquement stable, ajouter des snapshots/références visuelles pour les principaux modèles.

Exemples :

- devis standard ;
- devis très long ;
- facture standard ;
- facture multi-pages ;
- différentes configurations d’entreprise.

Les snapshots visuels ne remplacent JAMAIS les assertions métier.

Ils servent à détecter :

- texte coupé ;
- total masqué ;
- débordement ;
- logo mal positionné ;
- pied de page cassé ;
- mauvaise pagination.

---

# 21 — NAVIGATEURS ET MOBILE

Exécuter les parcours critiques au minimum :

- Chromium ;
- WebKit ;
- Firefox si raisonnable.

Tester également un viewport mobile pertinent correspondant à l’usage réel d’Atlas.

Chercher :

- élément inaccessible ;
- superposition ;
- modal hors écran ;
- texte tronqué ;
- scroll impossible ;
- menu inutilisable ;
- problème de clavier mobile ;
- bouton masqué.

Un test mobile doit être fonctionnel, pas uniquement visuel.

---

# 22 — ACCESSIBILITÉ

Sur les pages principales, effectuer une campagne automatique d’accessibilité lorsque l’outillage s’intègre raisonnablement au projet.

Utiliser par exemple Playwright + axe ou équivalent.

Classe séparément ces anomalies.

Ne laisse pas cette campagne retarder la découverte des bugs métier critiques.

---

# 23 — VOLUMÉTRIE DES DONNÉES

Cette partie est différente de la charge simultanée.

Créer progressivement des volumes synthétiques.

Par exemple :

CLIENTS :
1  
10  
100  
1 000  
10 000 si raisonnable.

CHANTIERS :
1  
10  
100  
1 000.

DEVIS/FACTURES :
volume suffisant pour faire apparaître les problèmes de pagination, recherche et requêtes.

Mesurer notamment :

- dashboard ;
- listes ;
- recherche ;
- filtres ;
- pagination ;
- statistiques ;
- chargement client ;
- chargement chantier ;
- historique ;
- génération document.

Chercher :

- requêtes N+1 ;
- manque d’index ;
- pagination côté client excessive ;
- transfert inutile de milliers de lignes ;
- consommation mémoire anormale.

---

# 24 — PERFORMANCE : ÉTABLIR D’ABORD UNE BASELINE

Avant toute charge importante :

mesure Atlas avec une charge très faible.

Construis une baseline :

- temps de réponse ;
- p50 ;
- p95 ;
- p99 lorsque pertinent ;
- erreurs ;
- consommation CPU/mémoire si observable ;
- DB ;
- nombre de connexions ;
- requêtes lentes.

Ne choisis pas arbitrairement des objectifs irréalistes avant de connaître le comportement actuel.

Documente cette baseline.

---

# 25 — TESTS DE CHARGE

Ne jamais lancer cette partie sans environnement QA confirmé.

Utilise un outil spécialisé comme k6 si cohérent.

N’utilise PAS 1 000 navigateurs complets.

Utilise :

- quelques véritables navigateurs pour l’expérience frontend ;
- beaucoup d’utilisateurs virtuels HTTP/API pour générer la charge.

Construis des comportements réalistes.

Par exemple :

login  
→ dashboard  
→ liste clients  
→ client  
→ chantier  
→ lecture/modification  
→ devis  
→ sauvegarde.

Faire monter progressivement :

1  
10  
20  
50  
100  
250  
500  
1 000 utilisateurs virtuels simultanés.

N’invente jamais le résultat d’un palier non exécuté.

Pour chaque palier enregistrer :

- succès ;
- erreurs ;
- p50 ;
- p95 ;
- p99 ;
- requêtes/seconde ;
- timeout ;
- saturation DB ;
- saturation pool ;
- CPU/mémoire lorsque disponibles ;
- erreurs serveur.

Identifier :

**le premier palier auquel Atlas commence à se dégrader de façon significative.**

---

# 26 — TYPES DE TESTS PERFORMANCE

Si l’environnement le permet, séparer :

## Smoke test

Petite charge pour vérifier le scénario.

## Load test

Charge réaliste normale.

## Stress test

Au-delà de la charge prévue pour identifier les limites.

## Spike test

Hausse brutale de trafic.

## Endurance

Charge prolongée pour détecter :

- fuite mémoire ;
- accumulation ;
- connexions non libérées ;
- ralentissement progressif.

Ne lance pas des tests inutilement coûteux si l’infrastructure ne permet pas de les faire proprement.

---

# 27 — INTÉGRITÉ DE LA BASE APRÈS LES TESTS

Après les campagnes :

inspecte la base QA.

Chercher :

- doublons ;
- références orphelines ;
- relations cassées ;
- valeurs nulles inattendues ;
- états impossibles ;
- factures dupliquées ;
- numéros dupliqués ;
- données associées à mauvaise entreprise ;
- lignes perdues ;
- incohérences totales/documents.

Ne corrige rien pendant cette première campagne.

Documente.

---

# 28 — CHAQUE BUG DOIT ÊTRE DOCUMENTÉ

Pour chaque anomalie :

- ID ;
- titre ;
- priorité ;
- zone ;
- rôle ;
- entreprise ;
- préconditions ;
- données ;
- étapes exactes ;
- attendu ;
- obtenu ;
- reproductibilité ;
- logs ;
- API concernée ;
- screenshot ;
- trace Playwright si disponible ;
- DB concernée ;
- fichiers probablement concernés ;
- impact ;
- risque données ;
- test automatisé reproduisant le problème lorsque possible.

---

# 29 — CLASSIFICATION

## P0 — BLOQUANT PRODUCTION

Exemples :

- fuite multi-entreprise ;
- perte/corruption majeure ;
- sécurité critique ;
- montant financier gravement incorrect ;
- factures dupliquées ;
- application inutilisable.

## P1 — CRITIQUE

Fonction essentielle cassée ou risque métier important.

## P2 — IMPORTANT

Bug réel avec contournement possible.

## P3 — MINEUR

Cas limite, cosmétique ou ergonomique peu grave.

Ne dramatise pas artificiellement les anomalies.

---

# 30 — SOUS-AGENTS

Tu peux utiliser plusieurs sous-agents spécialisés si cela augmente réellement la profondeur de la campagne.

Exemples :

`qa-cartography`

`qa-e2e`

`qa-documents`

`qa-settings`

`qa-security`

`qa-multitenant`

`qa-performance`

`qa-database`

Mais :

- chacun doit travailler dans le même environnement QA sécurisé ;
- les résultats doivent être centralisés ;
- un responsable final doit recouper les conclusions ;
- aucune anomalie ne doit se perdre.

Un sous-agent ne peut pas déclarer « validé » sur simple lecture du code lorsqu’un test réel est possible.

---

# 31 — PREMIÈRE LIVRAISON

Avant les tests massifs, produis dans les fichiers QA :

1. cartographie complète d’Atlas ;
2. inventaire des tests existants ;
3. zones non couvertes ;
4. matrice proposée ;
5. environnement QA utilisé ;
6. preuve que la DB est une DB de test ;
7. preuve que tu ne travailles pas sur `main` ;
8. services externes neutralisés ;
9. risques éventuels avant volumétrie/charge.

Puis continue automatiquement tout ce qui peut être exécuté en sécurité.

Ne me demande pas confirmation pour chaque petit test.

Ne prends cependant aucune décision métier inconnue à ma place.

Utilise :

`À ARBITRER PAR LE PATRON`

lorsqu’une véritable décision métier manque.

---

# 32 — RAPPORT FINAL

Produis :

`QA_REPORT.md`

Titre :

# ATLAS — RAPPORT DE QUALIFICATION AVANT PRODUCTION

Il doit contenir :

## Verdict exécutif

Choisir exactement :

**GO PRODUCTION**

ou

**GO SOUS CONDITIONS**

ou

**NO-GO PRODUCTION**

Justifier.

## Environnement

- branche QA ;
- environnement ;
- base utilisée ;
- date ;
- commit testé.

## Couverture

- fonctionnalités recensées ;
- tests existants ;
- nouveaux tests ;
- tests exécutés ;
- réussis ;
- échoués ;
- non exécutés ;
- P0 ;
- P1 ;
- P2 ;
- P3.

## Parcours utilisateur

Résultats.

## Clients

Résultats.

## Chantiers

Résultats.

## Devis

Résultats.

## Factures/documents

Résultats.

## Historisation

Résultats.

## Mon entreprise

Résultats.

## Formes juridiques

Résultats.

## ON/OFF

Résultats.

## Rôles

Résultats.

## Isolation multi-entreprise

Résultats.

## Mobile/navigateurs

Résultats.

## Résilience

Résultats.

## Volumétrie

Résultats.

## Performance

Tableau :

`Charge | durée | succès | erreurs | p50 | p95 | p99 | observations`

## Point de rupture

Si identifié.

## Intégrité DB

Résultats.

## Bugs

Liste complète par priorité.

## Tests impossibles

Expliquer pourquoi.

## Risques résiduels

Tout ce qui n’a pas pu être prouvé.

## Conditions éventuelles avant mise en production

Liste précise.

---

# 33 — APRÈS LE PREMIER RAPPORT UNIQUEMENT

Ne commence cette phase qu’après avoir produit la photographie initiale.

Pour chaque bug que nous décidons de corriger :

1. reproduire ;
2. créer un test rouge ;
3. confirmer qu’il échoue ;
4. corriger la cause racine ;
5. faire passer le test ;
6. rejouer les tests voisins ;
7. rejouer la suite pertinente ;
8. vérifier qu’aucune régression n’a été introduite.

Ne supprime jamais une assertion pour obtenir artificiellement du vert.

---

# 34 — OBJECTIF À LONG TERME

Les tests créés ne doivent pas être jetables.

La suite critique doit pouvoir être rejouée après chaque modification importante.

À terme, la CI doit pouvoir contrôler automatiquement au minimum :

- tests unitaires ;
- tests API ;
- permissions ;
- multi-entreprises ;
- parcours E2E principaux ;
- devis/factures ;
- documents ;
- tests de non-régression.

Les tests de charge lourds peuvent rester séparés et être exécutés périodiquement ou avant une grosse mise en production.

---

# 35 — UTILISATION INTELLIGENTE DES MODÈLES CLAUDE

Pendant cette campagne, n’utilise pas systématiquement le même modèle pour toutes les tâches.

Avant de commencer, inspecte les modèles réellement disponibles dans mon environnement Claude Code et établis une stratégie de routage adaptée.

Principe :

- utilise un modèle rapide/économique pour les tâches répétitives, déterministes ou à faible risque : inventaires simples, génération de fixtures, classification de logs évidents, synthèse de résultats déjà établis, petites modifications de fichiers de test ;
- utilise un modèle plus puissant pour la conception des tests, les scénarios métier, les permissions, la sécurité, le multi-tenant, les documents financiers, l’historisation, la concurrence et l’analyse des anomalies ;
- utilise le modèle le plus capable disponible lorsque le problème est complexe, ambigu ou critique : P0/P1, corruption de données, calcul financier incohérent, faille d’isolation, race condition, analyse de cause racine ou verdict final GO/NO-GO.

Ne gaspille pas un modèle puissant pour simplement exécuter ou surveiller des tests déterministes déjà écrits.

Playwright, les tests API, SQL et k6 doivent rester les arbitres objectifs du résultat vert/rouge. Le modèle sert à concevoir, analyser et expliquer ces tests.

Si des sous-agents peuvent utiliser des modèles différents, affecte leur modèle selon leur mission.

Ne choisis jamais un modèle uniquement pour économiser des ressources lorsqu’une erreur d’analyse pourrait masquer un problème critique.

Documente dans `QA_MASTER_PLAN.md` :

- les modèles disponibles ;
- le modèle choisi par catégorie de tâche ;
- pourquoi ;
- les éventuels changements de stratégie pendant la campagne.

Utilise les alias/modèles réellement disponibles dans mon installation plutôt que d’inventer un nom de modèle.

---

# RÈGLE FINALE

Ne cherche pas à prouver qu’Atlas fonctionne.

**Cherche à essayer de le casser.**

Une fonctionnalité n’est pas considérée fiable parce que le code semble correct.

Elle est fiable lorsqu’un test pertinent a démontré le comportement attendu.

Je veux que cette campagne remplace des mois de vérifications manuelles par une qualification méthodique, reproductible et honnête.

Et surtout :

**À AUCUN MOMENT cette campagne ne doit mettre en danger l’application Atlas réelle, sa branche principale, sa production ou ses données.**
