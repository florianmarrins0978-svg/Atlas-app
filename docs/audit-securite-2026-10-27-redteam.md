# Campagne de sécurité du 27 octobre 2026 : la frontière entre entreprises

*Menée dans l'environnement cloud de l'agent — pas sur l'espace réel du patron, inaccessible depuis
cette session. Base PostgreSQL 16 et Redis montés localement sans Docker
(`scripts/monter-base-locale.sh`) ; toute vérification en base jouée sous le rôle applicatif réel
`atlas_app`, jamais sous un superutilisateur qui traverserait la RLS sans le dire.*

## A. Résumé exécutif

**Périmètre réellement testé** : l'isolation entre deux entreprises synthétiques (lecture,
écriture, création, accès par fichier), rejouée pour de vrai contre une base PostgreSQL réelle avec
RLS forcée, sous le rôle applicatif ; les mécanismes de session et de révocation (JWT, cookies,
« déconnecter partout ») ; le périmètre de l'assistant IA ; la chaîne logicielle et la configuration
CI ; deux secrets d'espace (`AUTH_SECRET`, `CRON_SECRET`).

**Non testé, et dit comme tel** : la production réelle (elle n'existe pas encore) ; les en-têtes
HTTP et la protection réseau d'un hébergeur réel ; un scan dynamique (ZAP) ; un test de charge ; un
appel réel à un fournisseur d'IA (aucune clé sur ce poste).

**Verdict sur la frontière entre entreprises — la demande prioritaire** : **tient, après un
correctif**. Un scénario e2e écrit pour cette campagne a réellement vu l'entreprise A recevoir la
photo d'un chantier de l'entreprise B (RT-6, détail en §C et §D) — pas un défaut de la RLS en
production, mais l'absence d'un second rempart que ce même fichier portait déjà pour le logo depuis
le 29 août. Corrigé et vérifié dans cette session : A ne reçoit plus ni le logo ni la photo de B,
sous aucun des deux rôles qui servent l'application (production et suites e2e).

**Trois correctifs livrés** (RT-1, RT-2, RT-6), **deux décisions qui attendent le patron** (RT-3/E10,
RT-4/E12) — aucune des deux n'ouvre d'accès entre entreprises, voir §E.

**L'état de l'isolation** : robuste et activement maintenu, avec un vrai historique de fuites
trouvées et corrigées (logo par `/api/fichiers`, 29 août ; contournement de « déconnecter partout »,
25 août ; cookie de déconnexion qui revenait, 23 octobre) — une méthode qui a déjà fait ses preuves,
pas une garantie d'absence de défaut futur.

**Limites de cette campagne** : voir §F. La plus importante — cette session tourne dans un
conteneur cloud isolé, pas sur l'espace public réel du patron ; l'exposition réseau réelle (port
public, mandataire, limiteur de connexion) n'a pas pu être rejouée ici.

## B. Ce qui existait déjà avant cette session, repris plutôt que refait

Le dépôt porte une campagne d'audit du 25-26 octobre 2026 (`docs/audit-2026-10-etape-2.md`,
`docs/audit-2026-10-etape-3-inventaire.md`, `docs/audit-securite-prompt-renforce.md`) qui couvre
une bonne partie de la même liste que la demande de cette session. **Elle n'a pas été rejouée depuis
zéro** — je l'ai lue, j'ai vérifié que ses correctifs sont bien sur `main` (ils le sont), j'ai rejoué
ses suites de régression pour de vrai plutôt que de croire ses verdicts sur parole, et j'ai repris
exactement où elle s'était arrêtée (sa « vague 3 »).

| Déjà trouvé et corrigé avant cette session | Vérifié vrai aujourd'hui |
|---|---|
| E1-E9, E11, E16 | sur `main`, suites rejouées vertes |
| Fuite du logo d'une entreprise par `/api/fichiers` (29 août) | code relu, filtre présent — mais sans régression permanente ; et sans second rempart équivalent pour les deux autres branches de la même route (voir RT-6) |
| « Déconnecter partout » contournable par réémission du JWT (25 août) | code relu, régression `test-coupure-sessions-e2e.ts` existe |
| Cookie de déconnexion qui revenait (23 octobre) | code relu, correctif présent dans `session-ctx.ts` |

## C. Résultats détaillés et tableau récapitulatif

| ID | Vulnérabilité | Gravité | Statut | Impact | Emplacement | Correction | Test de non-régression |
|---|---|---|---|---|---|---|---|
| **RT-6** | `/api/fichiers/[...key]` ne protégeait `photos` et `notes_vocales` que par la RLS, sans second rempart — alors que la branche voisine, `entreprises`, en a un depuis le 29 août (cette table n'a AUCUNE RLS). Un scénario e2e écrit pour cette campagne a vu A recevoir la photo d'un chantier marqué `REDTEAM_CHANTIER_B` (200, les octets) | **CONFIRMÉE ET EXPLOITÉE — sous le rôle qui traverse la RLS (celui des suites e2e, par construction, `CLAUDE.md` §5)** ; **NON REPRODUITE sous le rôle réel `atlas_app`** (la RLS seule y referme déjà tout, vérifié en isolant la fonction dans une suite base dédiée) | la protection réelle d'aujourd'hui ne tenait qu'à UNE chose (la RLS) pour deux tables sur trois de cette route ; un rôle qui la contourne un jour — mauvais réglage d'hébergement, erreur humaine, ou simplement toute suite e2e lancée en diagnostic contre une base réelle par erreur — aurait livré les photos et notes vocales de n'importe quelle entreprise | `src/app/api/fichiers/[...key]/route.ts` | filtre explicite `eq(photos.entrepriseId, ctx.entrepriseId)` / `eq(notesVocales.entrepriseId, ctx.entrepriseId)` ajouté, à l'identique de ce qui protège déjà le logo ; logique extraite dans `autoriseLectureDuFichier`, exportée pour être rejouable sous le vrai rôle | `scripts/test-fichiers-autorisation-db.ts` (nouveau, sous `atlas_app`) + `scripts/test-fichiers-cross-entreprise-e2e.ts` (nouveau, sous le rôle e2e — c'est lui qui aurait dû exister depuis le 29 août et qui referme la porte des deux côtés) |
| **RT-1** | `CRON_SECRET` public dans un dépôt public ouvrait la purge planifiée (`/api/cron/purge-fichiers`) à qui le lit sur GitHub, sur le port public d'un espace exposé | **élevée** sur un espace exposé publiquement | **CONFIRMÉE PAR ANALYSE — CORRIGÉE** | déclenchement à volonté de la purge des audios transcrits, photos de diagnostic et fichiers en attente, par un tiers qui n'a jamais ouvert de session | `.devcontainer/docker-compose.yml`, `src/app/api/cron/purge-fichiers/route.ts` | jeton aléatoire 256 bits, propre à l'espace, hors dépôt (`scripts/secret-de-l-espace.ts`), posé par `banc.mjs` avant le lancement du serveur | `scripts/test-secret-de-l-espace-db.ts` (3 cas ajoutés) |
| **RT-2** | `pages.yml` donnait `pages: write` + `id-token: write`, au niveau du workflow, aux jobs `tests` et `verification` qui installent des paquets npm tiers | **moyenne** (chaîne logicielle, le ver « Shai-Hulud » cité par l'audit du 25 octobre en est l'exemple concret) | **CONFIRMÉE PAR ANALYSE — CORRIGÉE** | un paquet compromis exécuté pendant `npm ci`/`playwright install` aurait pu publier n'importe quoi sur GitHub Pages et forger un jeton OIDC, sans toucher à `appli/` | `.github/workflows/pages.yml` | permissions déplacées au niveau JOB : `contents: read` seul sur `tests`/`verification`, `pages: write`+`id-token: write` seulement sur `deploy` | revue de configuration (YAML, pas de code à régresser) |
| **RT-3 / E10** | `paiements_facture.facture_id` (et les colonnes analogues) n'ont **aucune** contrainte de clé étrangère en base — rien n'empêcherait, au niveau schéma, de rattacher un règlement à la facture d'une autre entreprise | moyenne (défense en profondeur) | **CONFIRMÉE PAR ANALYSE, NON REPRODUITE EN EXPLOITATION** — tracé le chemin réel (`noterPaiementDans`, `poserReglementRecu`, `majReglementRecu`, `retirerReglementRecu`, `remettrePaiement`) : chacun relit la ligne parente via une `SELECT` **soumise à la RLS** avant d'écrire, donc un `factureId`/`reglementId` de B rend `undefined` et le refus sort avant toute écriture | `src/server/db/schema.ts` (table `paiements_facture` et consorts), `src/server/repositories/paiements-facture.ts` | non corrigée cette session — une contrainte composite demande `UNIQUE(id, entreprise_id)` sur chaque table parente, donc une migration par table sur une base qui peut être habitée ; ouvrir ce chantier sans preuve d'exploitation a semblé disproportionné | à faire si la correction est décidée : `scripts/test-migration-XXXX-base-habitee.ts` sur le modèle de 0087 |
| **RT-4 / E12** | Liens de contrat d'entretien et de passage d'entretien (jeton en clair en base, `contrats_entretien.jeton`, `passages_entretien.jeton`) **sans aucune expiration** — un lien intercepté une fois reste valable pour toujours | moyenne | **CONFIRMÉE PAR ANALYSE — décision produit requise, non corrigée** | un lien de contrat ou de rapport d'entretien qui fuit une fois (boîte mail partagée, historique de navigateur) expose la ligne tant que le jeton existe, sans aucun moyen de le révoquer | `src/server/repositories/contrats-entretien.ts`, `passages-entretien.ts` | poser une expiration demande de trancher une vraie question d'usage (le client doit-il pouvoir revoir son contrat accepté un an après ?) — **à demander au patron**, pas à décider seul | à écrire une fois la durée choisie |
| E14 | Sans `ATLAS_PROXY_SAUTS` posé, les seuils de cadence par source (connexion, mot de passe oublié) deviennent communs à tous les visiteurs | moyenne, **dépend de l'hébergement, pas du code** | confirmée, inchangée | un inconnu pourrait saturer le seuil partagé et gêner tout le monde — mais le code choisit déjà le côté sûr : ce seuil-là se désactive plutôt que de bloquer tout le monde (conception déjà en place) | `src/server/env.ts`, `src/server/rate-limit/` | à poser au déploiement de production, pas dans ce lot | déjà couvert par `scripts/test-env.ts` |
| E15 (3 items restants) | Actions GitHub épinglées par étiquette (`@v4`) plutôt que par empreinte ; aucun `min-release-age` ; `demarrer.sh` retombe sur `npm install` si `npm ci` échoue | moyenne | confirmées, **délibérément non corrigées cette session** — voir §E | exposition théorique à un paquet ou une action compromis entre la publication d'une étiquette et sa lecture | `.github/workflows/*.yml`, `.devcontainer/demarrer.sh` | report volontaire — voir §E pour pourquoi | — |
| test | `test-dossiers-comptables-e2e.ts` : « Télécharger » rend un nom de fichier `'download'` au lieu de se terminer par `.pdf` | — (défaut d'outillage de test, pas de sécurité) | **NON LIÉ À CE LOT** — reproduit 3 fois à l'identique, dans une zone (téléchargement de dossier comptable) que ce lot ne touche pas | aucun — défaut du contrôle (ou de l'environnement headless), pas du produit | `scripts/test-dossiers-comptables-e2e.ts` | non traité — hors périmètre de cette campagne | — |

## D. L'attaque prioritaire, en détail : A contre B

**Méthode.** Sous le rôle applicatif réel (`atlas_app`, jamais un rôle qui traverse la RLS pour les
suites base ; le rôle e2e documenté, qui la traverse, pour les suites navigateur), avec deux
entreprises synthétiques et des marqueurs `REDTEAM_*`.

1. Rejoué les **513 suites base** pour de vrai (pas sur la foi des documents d'audit) — zéro échec,
   dont des vérifications d'isolation explicites : *« Isolation : B ne voit aucun achat de A »*,
   *« Isolation : B ne peut pas retirer un achat de A »*, *« Isolation : B ne peut pas
   déclencher/lire l'état de transcription du chantier de A »*, *« le patron de B ne voit rien des
   accès de A »*, *« Isolation : B ne voit aucun chantier de A »*, et une bonne cinquantaine
   d'autres du même genre à travers les suites `-repo.ts` qui montent systématiquement deux
   entreprises.
2. Tracé à la main, dans le code, le chemin exact d'un règlement de facture (le scénario « l'argent »
   explicitement demandé) : un `factureId` ou un `reglementId` fourni par l'appelant est **toujours**
   relu via une requête soumise à la RLS avant d'être utilisé pour écrire. Aucune contrainte de clé
   étrangère ne le garantit au niveau du schéma (RT-3/E10), mais aucun chemin trouvé ne l'exploite.
3. Écrit et joué un scénario e2e (navigateur réel, vrai serveur, vraie connexion) : entreprise A et
   entreprise B créées par le vrai dépôt (`creerEntreprise`), logo et photo de chantier de B posés
   par les vraies fonctions (`enregistrerObjet`, `ajouterPhoto`), connexion réelle de chacun des deux
   patrons par le formulaire de connexion, puis requête des deux fichiers de B depuis la session de
   A. **C'est ce scénario qui a trouvé RT-6** : le logo refusait déjà (404), la photo, elle, est
   arrivée (200) — la preuve que le refus du logo n'était pas un hasard de configuration, et que la
   photo avait un vrai trou. Après correctif : les deux refusent pour A, les deux répondent pour B
   (contrôle positif, sans quoi un refus générique ne prouverait rien).
4. Relu le périmètre de l'assistant IA (`assistant-service.ts`, les outils de `tools/registre`) :
   type `Ctx` partout, aucune écriture directe (toute proposition demande une confirmation explicite
   de l'utilisateur), isolation déjà couverte par les suites `test-ia-0X-*` (« Isolation : … ») — vertes.
5. Relu le mécanisme de session (JWT, Auth.js) : stratégie JWT sans table de session dédiée,
   `entrepriseId`/rôle jamais pris du jeton mais toujours résolus depuis la base à chaque requête
   (`session-ctx.ts`), deux vraies failles de contournement de révocation déjà trouvées et corrigées
   par une session précédente (25 août et 23 octobre), avec leurs régressions en place.

**Preuve reproductible la plus directe** : `scripts/test-fichiers-cross-entreprise-e2e.ts` (sous
`npm run test:e2e`) et `scripts/test-fichiers-autorisation-db.ts` (sous `npm test`) — l'un prouve que
le refus tient MÊME sous le rôle qui traverse la RLS, l'autre qu'il tient sous le rôle réel.

## E. Pourquoi certains points restent ouverts plutôt que corrigés dans ce lot

- **RT-3/E10 (pas de FK composite)** : poser une vraie contrainte demande une colonne
  `UNIQUE(id, entreprise_id)` sur chaque table parente touchée, donc une migration par table sur une
  base qui peut être habitée (`.claude/rules/migrations.md`). Le gain est réel mais purement
  défensif — aucun chemin d'exploitation trouvé aujourd'hui — et ouvrir ce chantier sans preuve
  d'exploitation a semblé disproportionné pour ce qu'il répare. Reste une recommandation, pas un bug.
- **RT-4/E12 (liens sans expiration)** : raccourcir une durée de validité est un arbitrage produit
  (un client peut vouloir revoir son contrat accepté un an après), pas une correction technique
  neutre. Je ne tranche pas un usage réel sans le patron (`CLAUDE.md` §2 bis : *« plus sûr contre ça
  marche encore ne se tranche pas seul »*).
- **E15, les trois items restants** : épingler onze actions GitHub par empreinte demande de lire
  leur dépôt GitHub réel pour obtenir la bonne empreinte — le mandataire réseau de cet environnement
  le refuse pour des dépôts tiers non explicitement attachés, et deviner une empreinte serait pire
  que ne pas épingler. Le repli `npm install` de `demarrer.sh` quand `npm ci` échoue est un choix de
  robustesse délibéré pour l'espace RÉEL du patron (un `npm ci` qui échoue ne doit pas le laisser
  sans application) : le retirer est un arbitrage entre deux risques, pas un défaut à corriger seul.
  `ATLAS_PROXY_SAUTS` (E14) dépend d'un hébergeur de production qui n'existe pas encore.
- **`test-dossiers-comptables-e2e.ts`** : sans rapport avec le sujet de ce lot (téléchargement d'un
  PDF comptable), non traité ici — voir §C.

## F. Couverture et limites

**Surfaces examinées** : isolation entre entreprises (lecture/écriture/fichiers), sessions et JWT,
assistant IA, chaîne logicielle et CI, deux secrets d'espace, dépendances (`npm audit`).

**Batterie complète jouée une seule fois, à la fin, sur l'ensemble des correctifs groupés** (niveau
3, exigé par `npm run niveau` — une route d'API touchée) :

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | propre |
| lint (fichiers touchés) | propre |
| `npm run verifier:memoire` | cohérent (8 fichiers vérifiés) |
| `npm test` — 513 suites base, sous `atlas_app` | **513/513 — 0 échec** |
| `npm run test:e2e` — 197 suites navigateur | **196/197** — le seul échec, `test-dossiers-comptables-e2e.ts`, est sans rapport (voir §C), reproduit 3 fois à l'identique |
| `npm run verifier:connexion` (origine étrangère, comme chez le patron) | réussie |
| `npm audit --omit=dev` | une seule alerte connue et déjà filée (`@simplewebauthn/server`, faible, non exploitée) |

**Lu et tracé dans le code, sans pouvoir l'exécuter ici** : contexte IA sans clé réelle, exposition
réseau réelle de l'espace du patron (elle n'existe que chez lui), production (elle n'existe pas).

**Non testé, et NON VÉRIFIÉ reste la bonne formule** : scan dynamique (ZAP), test de charge,
en-têtes HTTP d'un hébergeur réel, restauration réelle d'une sauvegarde.

## G. Priorités

1. **RT-6 : fait, à fusionner en priorité** — c'est la seule vulnérabilité confirmée ET exploitée de
   cette campagne, même si l'exploitation ne s'est produite que sous un rôle qui ne sert jamais la
   production réelle aujourd'hui.
2. RT-1 et RT-2 : faits, à fusionner avec RT-6 (même branche, même vague).
3. RT-4/E12 : décision du patron sur la durée de validité des liens de contrat/passage — question à
   lui poser, pas une correction en attente.
4. RT-3/E10 : à planifier comme son propre lot si la décision est de durcir le schéma — pas urgent.

## Conclusion

**Aucun accès inter-entreprises exploitable en production n'a été démontré** — mais la campagne a
trouvé et corrigé un vrai trou (RT-6) : une protection qui ne tenait qu'à un seul rempart (la RLS)
pour deux ressources (photos, notes vocales), là où une fuite déjà vécue sur une troisième ressource
de la même route (le logo) avait appris, le 29 août, la leçon inverse — et ne l'avait pas étendue.
Ce trou n'était pas exploitable sous le rôle qui sert l'application en production (`atlas_app`,
vérifié), mais il l'était sous le rôle qui sert les suites e2e — un rôle que personne n'a prévu de
donner un jour à la production, mais qu'un mauvais réglage d'hébergement pourrait donner par erreur.
C'est exactement le genre de défaut qu'une relecture de code seule ne montre pas : il a fallu
l'attaquer pour de vrai, avec un vrai navigateur et un vrai serveur, pour le voir.

Ce que cette campagne n'a pas pu couvrir est précisément ce qui n'existe pas encore à tester (la
production, l'exposition réseau réelle de l'espace du patron) ou ce qui demande une clé qu'elle n'a
pas (l'IA réelle). Ce n'est jamais un verdict d'invulnérabilité — seulement ce qui a été attaqué, ce
qui a tenu, ce qui a été corrigé, et ce qui reste incertain.

---

*Rédigé par l'agent dans la session cloud `af42c0cb-7594-59ed-bd96-11aed5c2797e`, branche
`claude/audit-securite-redteam-2026-10-27`.*
