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

**Un vrai trou trouvé en ATTAQUANT.** Un scénario e2e écrit pour cette campagne (navigateur réel,
vrai serveur) a vu l'entreprise A recevoir la photo d'un chantier de l'entreprise B. Ce n'était pas
un défaut de la RLS en production (vérifié : sous le rôle réel `atlas_app`, elle referme déjà
tout), mais l'absence d'un second rempart que ce même fichier portait déjà pour le logo depuis le
29 août. Corrigé et vérifié : A ne reçoit plus ni le logo ni la photo de B, sous aucun des deux
rôles qui servent l'application. Détail en §C (**RT-6**).

**Un recoupement imprévu.** Cette campagne avait identifié, en lecture de code, les mêmes points
ouverts qu'un audit mené en parallèle par une autre session du même dépôt (E10 : clés étrangères
composites entre tables d'entreprise ; E12 : expiration des liens de contrat/passage ; E15 :
chaîne logicielle ; `CRON_SECRET`). **Cette autre session les a traités, plus complètement**,
pendant que cette campagne-ci tournait : migration 0149 pour E10, refus argumenté pour E12 (voir
§C), actions GitHub épinglées par empreinte réelle pour E15, `CRON_SECRET` propre à l'espace. Les
correctifs redondants écrits ici (une seconde version de `CRON_SECRET`, un second resserrement de
`pages.yml`) ont été retirés à la fusion : **main n'en garde qu'une version de chacun**, et c'est
la sienne. Le seul apport réel et nouveau de cette campagne est RT-6.

**Verdict sur la frontière entre entreprises — la demande prioritaire** : **tient, après RT-6**.
Aucun autre chemin de lecture, d'écriture, de création ou d'accès par fichier n'a permis à A
d'atteindre les données marquées `REDTEAM_*` de B — ni dans les suites existantes rejouées pour de
vrai, ni dans ma relecture adversariale du code (paiements, sessions).

**L'état de l'isolation** : robuste et activement maintenu, avec un vrai historique de fuites
trouvées et corrigées (logo par `/api/fichiers`, 29 août ; contournement de « déconnecter partout »,
25 août ; cookie de déconnexion qui revenait, 23 octobre) — une méthode qui a déjà fait ses preuves,
pas une garantie d'absence de défaut futur.

**Limites de cette campagne** : voir §F. La plus importante — cette session tourne dans un
conteneur cloud isolé, pas sur l'espace public réel du patron ; l'exposition réseau réelle (port
public, mandataire, limiteur de connexion) n'a pas pu être rejouée ici.

## B. Ce qui existait déjà, repris plutôt que refait — et ce qui s'est fait en parallèle

Le dépôt porte une campagne d'audit du 25-26 octobre 2026 (`docs/audit-2026-10-etape-2.md`,
`docs/audit-2026-10-etape-3-inventaire.md`, `docs/audit-securite-prompt-renforce.md`). Elle n'a pas
été rejouée depuis zéro : lue, ses correctifs vérifiés sur `main`, ses suites de régression
rejouées pour de vrai, et reprise exactement où elle s'était arrêtée (sa « vague 3 » : E10, E12,
E14, E15, `CRON_SECRET`).

**Pendant cette campagne, une autre session a traité cette même vague 3** — sans concertation
possible, les deux ayant démarré sur le même état de `main`. À la fusion :

| Point de la vague 3 | Traité par l'autre session, sur `main` | Ce que cette campagne en a fait |
|---|---|---|
| `CRON_SECRET` | clé propre à l'espace, `.atlas-secrets/cron-secret` | version équivalente écrite ici, **retirée à la fusion** (doublon) |
| E15 (chaîne logicielle) | actions GitHub épinglées par empreinte réelle (`git ls-remote`), permissions resserrées sur 4 flux | version partielle écrite ici (`pages.yml` seul), **retirée à la fusion** (doublon, moins complet) |
| E10 (liens sans clé composite) | migration 0149 : `UNIQUE(id, entreprise_id)` + clé composite `NOT VALID` sur 26 liens, `test-liens-dans-l-entreprise-db.ts` | confirmé par lecture de code ici, non codé — **désormais fait, par l'autre session** |
| E12 (liens sans expiration) | **refusé délibérément**, avec trois raisons écrites (reprise du lien par le patron, document que le client doit pouvoir relire, lien de 256 bits déjà protégé par la RLS) | même constat ici — **la question est tranchée, pas ouverte** |

| Déjà trouvé et corrigé avant cette session | Vérifié vrai aujourd'hui |
|---|---|
| E1-E9, E11, E16 | sur `main`, suites rejouées vertes |
| Fuite du logo d'une entreprise par `/api/fichiers` (29 août) | code relu, filtre présent — mais sans régression permanente ; et sans second rempart équivalent pour les deux autres branches de la même route (RT-6) |
| « Déconnecter partout » contournable par réémission du JWT (25 août) | code relu, régression `test-coupure-sessions-e2e.ts` existe |
| Cookie de déconnexion qui revenait (23 octobre) | code relu, correctif présent dans `session-ctx.ts` |

## C. Résultats détaillés et tableau récapitulatif

| ID | Vulnérabilité | Gravité | Statut | Impact | Emplacement | Correction | Test de non-régression |
|---|---|---|---|---|---|---|---|
| **RT-6** | `/api/fichiers/[...key]` ne protégeait `photos` et `notes_vocales` que par la RLS, sans second rempart — alors que la branche voisine, `entreprises`, en a un depuis le 29 août (cette table n'a AUCUNE RLS). Un scénario e2e écrit pour cette campagne a vu A recevoir la photo d'un chantier marqué `REDTEAM_CHANTIER_B` (200, les octets) | **CONFIRMÉE ET EXPLOITÉE — sous le rôle qui traverse la RLS (celui des suites e2e, par construction, `CLAUDE.md` §5)** ; **NON REPRODUITE sous le rôle réel `atlas_app`** (vérifié en isolant la fonction dans une suite base dédiée) | la protection réelle d'aujourd'hui ne tenait qu'à UNE chose (la RLS) pour deux tables sur trois de cette route ; un rôle qui la contourne un jour — mauvais réglage d'hébergement, erreur humaine — aurait livré les photos et notes vocales de n'importe quelle entreprise | `src/app/api/fichiers/[...key]/route.ts` | filtre explicite `eq(photos.entrepriseId, ctx.entrepriseId)` / `eq(notesVocales.entrepriseId, ctx.entrepriseId)` ajouté, à l'identique de ce qui protège déjà le logo ; logique extraite dans `autoriseLectureDuFichier`, exportée pour être rejouable sous le vrai rôle | `scripts/test-fichiers-autorisation-db.ts` (nouveau, sous `atlas_app`) + `scripts/test-fichiers-cross-entreprise-e2e.ts` (nouveau, sous le rôle e2e) |
| E10 | Liens entre tables d'entreprise sans contrainte composite | moyenne (défense en profondeur) | **CONFIRMÉE PAR ANALYSE ICI — déjà CORRIGÉE sur `main` par une autre session** (migration 0149) | — | `src/server/db/schema.ts` | migration 0149 (déjà sur `main`) | `test-liens-dans-l-entreprise-db.ts` (déjà sur `main`) |
| E12 | Liens de contrat/passage d'entretien sans expiration | moyenne | **CONFIRMÉE PAR ANALYSE ICI — déjà TRANCHÉE (refusée) sur `main`**, avec trois raisons écrites (`ARCHITECTURE.md` §510) | — | `src/server/repositories/contrats-entretien.ts`, `passages-entretien.ts` | aucune (décision : rester tel quel) | — |
| `CRON_SECRET` | Secret public dans `docker-compose.yml` | élevée sur un espace exposé | **CONFIRMÉE PAR ANALYSE ICI — déjà CORRIGÉE sur `main` par une autre session** | — | `.devcontainer/docker-compose.yml`, `scripts/banc.mjs` | clé propre à l'espace (déjà sur `main`) | assertion dans `test-secret-de-l-espace-db.ts` (déjà sur `main`) |
| E15 | `pages.yml` donnait `pages: write`/`id-token: write` aux jobs qui installent des paquets tiers ; actions épinglées par étiquette | moyenne | **CONFIRMÉE PAR ANALYSE ICI — déjà CORRIGÉE, et plus complètement, sur `main` par une autre session** (actions épinglées par empreinte réelle + 4 flux resserrés) | — | `.github/workflows/*.yml` | déjà sur `main` | — |
| E14 | Sans `ATLAS_PROXY_SAUTS`, les seuils de cadence par source deviennent communs à tous | moyenne, dépend de l'hébergement | confirmée, inchangée — le code choisit déjà le côté sûr (ce seuil se désactive plutôt que de bloquer tout le monde) | — | `src/server/env.ts`, `src/server/rate-limit/` | à poser au déploiement de production | déjà couvert par `scripts/test-env.ts` |
| test | `test-dossiers-comptables-e2e.ts` : « Télécharger » rend un nom de fichier `'download'` au lieu de se terminer par `.pdf` | — (outillage de test, pas de sécurité) | **NON LIÉ À CE LOT** — reproduit 3 fois à l'identique ici, et déjà rouge sur `main` par ailleurs (confirmé par l'autre session, `CHANGELOG.md` du 26 octobre) | aucun — défaut du contrôle ou de l'environnement headless, pas du produit | `scripts/test-dossiers-comptables-e2e.ts` | non traité — hors périmètre de cette campagne | — |

## D. L'attaque prioritaire, en détail : A contre B

**Méthode.** Sous le rôle applicatif réel (`atlas_app`, jamais un rôle qui traverse la RLS pour les
suites base ; le rôle e2e documenté, qui la traverse, pour les suites navigateur), avec deux
entreprises synthétiques et des marqueurs `REDTEAM_*`.

1. Rejoué les **513 suites base** pour de vrai — zéro échec, dont des vérifications d'isolation
   explicites : *« Isolation : B ne voit aucun achat de A »*, *« Isolation : B ne peut pas retirer
   un achat de A »*, *« Isolation : B ne peut pas déclencher/lire l'état de transcription du
   chantier de A »*, *« le patron de B ne voit rien des accès de A »*, *« Isolation : B ne voit
   aucun chantier de A »*, et une bonne cinquantaine d'autres du même genre à travers les suites
   `-repo.ts` qui montent systématiquement deux entreprises.
2. Tracé à la main, dans le code, le chemin exact d'un règlement de facture (le scénario « l'argent »
   explicitement demandé) : un `factureId`/`reglementId` fourni par l'appelant est **toujours** relu
   via une requête soumise à la RLS avant d'être utilisé pour écrire.
3. Écrit et joué un scénario e2e (navigateur réel, vrai serveur, vraie connexion) : entreprise A et
   entreprise B créées par le vrai dépôt (`creerEntreprise`), logo et photo de chantier de B posés
   par les vraies fonctions (`enregistrerObjet`, `ajouterPhoto`), connexion réelle de chacun des deux
   patrons par le formulaire de connexion, puis requête des deux fichiers de B depuis la session de
   A. **C'est ce scénario qui a trouvé RT-6** : le logo refusait déjà (404), la photo, elle, est
   arrivée (200). Après correctif : les deux refusent pour A, les deux répondent pour B (contrôle
   positif, sans quoi un refus générique ne prouverait rien).
4. Relu le périmètre de l'assistant IA (`assistant-service.ts`, les outils de `tools/registre`) :
   type `Ctx` partout, aucune écriture directe, isolation déjà couverte par les suites `test-ia-0X-*`
   (« Isolation : … ») — vertes.
5. Relu le mécanisme de session (JWT, Auth.js) : stratégie JWT sans table de session dédiée,
   `entrepriseId`/rôle jamais pris du jeton mais toujours résolus depuis la base à chaque requête
   (`session-ctx.ts`), deux vraies failles de contournement de révocation déjà trouvées et corrigées
   (25 août et 23 octobre), avec leurs régressions en place.

**Preuve reproductible la plus directe** : `scripts/test-fichiers-cross-entreprise-e2e.ts` (sous
`npm run test:e2e`) et `scripts/test-fichiers-autorisation-db.ts` (sous `npm test`) — l'un prouve que
le refus tient MÊME sous le rôle qui traverse la RLS, l'autre qu'il tient sous le rôle réel.

## E. Pourquoi ce lot ne porte plus que RT-6

Le reste de cette campagne (E10, E12, E15, `CRON_SECRET`) a été, de façon fortuite, traité en
parallèle par une autre session — voir §B. Garder une seconde implémentation de `CRON_SECRET` ou
une seconde version de `pages.yml` aurait été du code mort ou un doublon de règle (`CLAUDE.md` §3,
§4 quinquies) : retirés à la fusion, sans perte, puisque `main` porte déjà l'équivalent — en
l'occurrence plus complet pour E15 (empreintes réelles vs. permissions seules) et E10 (migration
réelle vs. constat).

## F. Couverture et limites

**Surfaces examinées** : isolation entre entreprises (lecture/écriture/fichiers), sessions et JWT,
assistant IA, chaîne logicielle et CI, secrets d'espace, dépendances (`npm audit`).

**Batterie complète jouée deux fois (avant et après la fusion avec `main`), la seconde comptant** —
niveau 3, exigé par `npm run niveau` (une route d'API touchée) :

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | propre |
| lint (fichiers touchés) | propre |
| `npm run verifier:memoire` | cohérent |
| `npm test` — suites base, sous `atlas_app` | **524/524 — 0 échec** (après fusion) |
| `npm run test:e2e` — suites navigateur | **197/198** — le seul échec, `test-dossiers-comptables-e2e.ts`, est sans rapport (voir §C), déjà rouge sur `main` par ailleurs |
| `npm run verifier:connexion` (origine étrangère, comme chez le patron) | réussie |
| `npm audit --omit=dev` | une seule alerte connue et déjà filée (`@simplewebauthn/server`, faible, non exploitée) |

**Lu et tracé dans le code, sans pouvoir l'exécuter ici** : contexte IA sans clé réelle, exposition
réseau réelle de l'espace du patron, production (elle n'existe pas).

**Non testé, et NON VÉRIFIÉ reste la bonne formule** : scan dynamique (ZAP), test de charge,
en-têtes HTTP d'un hébergeur réel, restauration réelle d'une sauvegarde.

## G. Priorités

1. **RT-6 : seul point restant de cette campagne, fait et vérifié** — à fusionner.
2. Tout le reste de la vague 3 (E10, E12, E14, E15, `CRON_SECRET`) est déjà réglé sur `main` par une
   autre session ; rien n'y reste de cette campagne.
3. **E10, un point ouvert hérité de l'autre session, pas de celle-ci** : valider les 26 clés
   composites `NOT VALID` sur une base habitée (`ARCHITECTURE.md` §510, `TODO.md`).

## Conclusion

**Aucun accès inter-entreprises exploitable en production n'a été démontré** — mais la campagne a
trouvé et corrigé un vrai trou (RT-6) : une protection qui ne tenait qu'à un seul rempart (la RLS)
pour deux ressources (photos, notes vocales), là où une fuite déjà vécue sur une troisième ressource
de la même route (le logo) avait appris, le 29 août, la leçon inverse — et ne l'avait pas étendue.
Ce trou n'était pas exploitable sous le rôle qui sert l'application en production (`atlas_app`,
vérifié), mais il l'était sous le rôle qui sert les suites e2e — un rôle qu'un mauvais réglage
d'hébergement pourrait donner par erreur. C'est le genre de défaut qu'une relecture de code seule
ne montre pas : il a fallu l'attaquer pour de vrai pour le voir.

Le reste de cette campagne converge, mot pour mot ou presque, avec une seconde campagne menée en
parallèle sur ce même dépôt, qui l'a traité plus complètement — un signal que la méthode (deux
entreprises synthétiques, attaque réelle plutôt que relecture) trouve les mêmes failles de façon
reproductible, pas un hasard d'une seule lecture.

Ce que cette campagne n'a pas pu couvrir est précisément ce qui n'existe pas encore à tester (la
production, l'exposition réseau réelle de l'espace du patron) ou ce qui demande une clé qu'elle n'a
pas (l'IA réelle). Ce n'est jamais un verdict d'invulnérabilité — seulement ce qui a été attaqué, ce
qui a tenu, ce qui a été corrigé, et ce qui reste incertain.

---

*Rédigé par l'agent dans la session cloud `af42c0cb-7594-59ed-bd96-11aed5c2797e`, branche
`claude/audit-securite-redteam-2026-10-27`.*
