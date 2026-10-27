# Campagne de sécurité du 27 octobre 2026 : la frontière entre entreprises

*Menée dans l'environnement cloud de l'agent — pas sur l'espace réel du patron, qui n'existait pas
accessible depuis cette session. Base PostgreSQL 16 et Redis montés localement sans Docker
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

**Verdict sur la frontière entre entreprises — la demande prioritaire** : **tient**. Aucun chemin de
lecture, d'écriture, de création ou d'accès par fichier n'a permis à l'entreprise A d'atteindre les
données marquées `REDTEAM_*` de l'entreprise B, ni dans les 512 suites existantes rejouées pour de
vrai, ni dans ma propre relecture adversariale de code (paiements, fichiers, sessions). Une seule
protection avait un trou réel et concret : la purge planifiée, ouverte par un secret public — réparé
cette session (RT-1).

**L'état de l'isolation** : robuste et activement maintenu. Le dépôt porte la trace de plusieurs
vraies fuites inter-entreprises trouvées et corrigées avant cette session (fuite du logo par
`/api/fichiers`, 29 août ; contournement de « déconnecter partout » par réémission du JWT,
25 août ; cookie de déconnexion qui revenait, 23 octobre) — ce qui inspire confiance dans la
méthode, pas dans l'absence totale de défaut futur.

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
| Fuite du logo d'une entreprise par `/api/fichiers` (29 août) | code relu, filtre présent — **sans régression permanente, comblé cette session (RT-5)** |
| « Déconnecter partout » contournable par réémission du JWT (25 août) | code relu, régression `test-coupure-sessions-e2e.ts` existe |
| Cookie de déconnexion qui revenait (23 octobre) | code relu, correctif présent dans `session-ctx.ts` |

## C. Résultats détaillés et tableau récapitulatif

| ID | Vulnérabilité | Gravité | Statut | Impact | Emplacement | Correction | Test de non-régression |
|---|---|---|---|---|---|---|---|
| **RT-1** | `CRON_SECRET` public dans un dépôt public ouvrait la purge planifiée (`/api/cron/purge-fichiers`) à qui le lit sur GitHub, sur le port public d'un espace exposé | **élevée** sur un espace exposé publiquement | **CONFIRMÉE PAR ANALYSE — CORRIGÉE** | déclenchement à volonté de la purge des audios transcrits, photos de diagnostic et fichiers en attente, par un tiers qui n'a jamais ouvert de session | `.devcontainer/docker-compose.yml`, `src/app/api/cron/purge-fichiers/route.ts` | jeton aléatoire 256 bits, propre à l'espace, hors dépôt (`scripts/secret-de-l-espace.ts`), posé par `banc.mjs` avant le lancement du serveur | `scripts/test-secret-de-l-espace-db.ts` (3 cas ajoutés) |
| **RT-2** | `pages.yml` donnait `pages: write` + `id-token: write`, au niveau du workflow, aux jobs `tests` et `verification` qui installent des paquets npm tiers | **moyenne** (chaîne logicielle, le ver « Shai-Hulud » cité par l'audit du 25 octobre en est l'exemple concret) | **CONFIRMÉE PAR ANALYSE — CORRIGÉE** | un paquet compromis exécuté pendant `npm ci`/`playwright install` aurait pu publier n'importe quoi sur GitHub Pages et forger un jeton OIDC, sans toucher à `appli/` | `.github/workflows/pages.yml` | permissions déplacées au niveau JOB : `contents: read` seul sur `tests`/`verification`, `pages: write`+`id-token: write` seulement sur `deploy` | revue de configuration (YAML, pas de code à régresser) |
| **RT-3 / E10** | `paiements_facture.facture_id` (et les colonnes analogues) n'ont **aucune** contrainte de clé étrangère en base — rien n'empêcherait, au niveau schéma, de rattacher un règlement à la facture d'une autre entreprise | moyenne (défense en profondeur) | **CONFIRMÉE PAR ANALYSE, NON REPRODUITE EN EXPLOITATION** — tracé le chemin réel (`noterPaiementDans`, `poserReglementRecu`, `majReglementRecu`, `retirerReglementRecu`, `remettrePaiement`) : chacun relit la ligne parente via une `SELECT` **soumise à la RLS** avant d'écrire, donc un `factureId`/`reglementId` de B rend `undefined` et le refus sort avant toute écriture | `src/server/db/schema.ts` (table `paiements_facture` et consorts), `src/server/repositories/paiements-facture.ts` | non corrigée cette session — une contrainte composite demande `UNIQUE(id, entreprise_id)` sur chaque table parente, donc une migration par table sur une base qui peut être habitée ; ouvrir ce chantier sans preuve d'exploitation a semblé disproportionné | à faire si la correction est décidée : `scripts/test-migration-XXXX-base-habitee.ts` sur le modèle de 0087 |
| **RT-4 / E12** | Liens de contrat d'entretien et de passage d'entretien (jeton en clair en base, `contrats_entretien.jeton`, `passages_entretien.jeton`) **sans aucune expiration** — un lien intercepté une fois reste valable pour toujours | moyenne | **CONFIRMÉE PAR ANALYSE — décision produit requise, non corrigée** | un lien de contrat ou de rapport d'entretien qui fuit une fois (boîte mail partagée, historique de navigateur) expose la ligne tant que le jeton existe, sans aucun moyen de le révoquer | `src/server/repositories/contrats-entretien.ts`, `passages-entretien.ts` | poser une expiration demande de trancher une vraie question d'usage (le client doit-il pouvoir revoir son contrat accepté un an après ?) — **à demander au patron**, pas à décider seul | à écrire une fois la durée choisie |
| **RT-5** | La fuite du logo d'une entreprise par l'autre (`/api/fichiers/[...key]`, corrigée le 29 août 2026) n'avait **aucune régression permanente** : rien dans la batterie n'aurait rougi si le filtre avait été retiré | **trouvé en cherchant la régression manquante, pas une nouvelle fuite — le code était déjà sûr** | **CONFIRMÉE, COMBLÉE** | aucun impact aujourd'hui (le correctif de code tient) ; le risque était que ce correctif se perde au prochain remaniement sans qu'aucun test ne le voie | `src/app/api/fichiers/[...key]/route.ts` | aucune ligne de `src/` changée, seulement un test ajouté | `scripts/test-fichiers-cross-entreprise-e2e.ts`, nouveau : rejoue A contre B sur le logo ET sur une photo de chantier, avec contrôle négatif (B lit bien son propre fichier) |
| E14 | Sans `ATLAS_PROXY_SAUTS` posé, les seuils de cadence par source (connexion, mot de passe oublié) deviennent communs à tous les visiteurs | moyenne, **dépend de l'hébergement, pas du code** | confirmée, inchangée | un inconnu pourrait saturer le seuil partagé et gêner tout le monde — mais le code choisit déjà le côté sûr : ce seuil-là se désactive plutôt que de bloquer tout le monde (conception déjà en place) | `src/server/env.ts`, `src/server/rate-limit/` | à poser au déploiement de production, pas dans ce lot | déjà couvert par `scripts/test-env.ts` |
| E15 (3 items restants) | Actions GitHub épinglées par étiquette (`@v4`) plutôt que par empreinte ; aucun `min-release-age` ; `demarrer.sh` retombe sur `npm install` si `npm ci` échoue | moyenne | confirmées, **délibérément non corrigées cette session** — voir §E | exposition théorique à un paquet ou une action compromis entre la publication d'une étiquette et sa lecture | `.github/workflows/*.yml`, `.devcontainer/demarrer.sh` | report volontaire — voir §E pour pourquoi | — |

## D. L'attaque prioritaire, en détail : A contre B

**Méthode.** Sous le rôle applicatif réel (`atlas_app`, jamais un rôle qui traverse la RLS), avec
deux entreprises synthétiques et des marqueurs `REDTEAM_*` :

1. Rejoué les **512 suites base existantes** pour de vrai (pas sur la foi des documents d'audit) —
   zéro échec, dont des vérifications d'isolation explicites : *« Isolation : B ne voit aucun achat
   de A »*, *« Isolation : B ne peut pas retirer un achat de A »*, *« Isolation : B ne peut pas
   déclencher/lire l'état de transcription du chantier de A »*, *« le patron de B ne voit rien des
   accès de A »*, et une bonne cinquantaine d'autres du même genre à travers les suites `-repo.ts`
   qui montent systématiquement deux entreprises.
2. Tracé à la main, dans le code, le chemin exact d'un règlement de facture (le scénario « l'argent »
   explicitement demandé) : un `factureId` ou un `reglementId` fourni par l'appelant est **toujours**
   relu via une requête soumise à la RLS avant d'être utilisé pour écrire — un identifiant de B sous
   un contexte A ne rend aucune ligne, et la fonction refuse avant d'écrire quoi que ce soit. Aucune
   contrainte de clé étrangère ne le garantit au niveau du schéma (RT-3/E10), mais aucun chemin trouvé
   ne l'exploite.
3. Écrit et joué un nouveau scénario e2e (navigateur réel, vrai serveur, vraie connexion) : entreprise
   A et entreprise B créées par le vrai dépôt (`creerEntreprise`), logo et photo de chantier de B
   posés par les vraies fonctions (`enregistrerObjet`, `ajouterPhoto`), connexion réelle de chacun des
   deux patrons par le formulaire de connexion, puis requête du fichier de B depuis la session de A —
   **404**, jamais les octets ; requête du même fichier depuis la session de B — **200**, preuve que
   le refus n'est pas un 404 générique qui tomberait pour tout le monde.
4. Relu le périmètre de l'assistant IA (`assistant-service.ts`, les outils de `tools/registre`) :
   type `Ctx` partout, aucune écriture directe (toute proposition demande une confirmation explicite
   de l'utilisateur), isolation déjà couverte par les suites `test-ia-0X-*` (« Isolation : … ») — vertes.
5. Relu le mécanisme de session (JWT, Auth.js) : stratégie JWT sans table de session dédiée,
   `entrepriseId`/rôle jamais pris du jeton mais toujours résolus depuis la base à chaque requête
   (`session-ctx.ts`), deux vraies failles de contournement de révocation déjà trouvées et corrigées
   par une session précédente (25 août et 23 octobre), avec leurs régressions en place.

**Preuve reproductible la plus directe** : `scripts/test-fichiers-cross-entreprise-e2e.ts`, lancé
sous `npm run test:e2e` — crée `REDTEAM_ENTREPRISE_A` et `REDTEAM_ENTREPRISE_B`, pose un logo et une
photo marqués côté B, se connecte réellement comme A et comme B, compare les deux réponses.

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

## F. Couverture et limites

**Surfaces examinées** : isolation entre entreprises (lecture/écriture/fichiers), sessions et JWT,
assistant IA, chaîne logicielle et CI, deux secrets d'espace, dépendances (`npm audit`).

**Testé pour de vrai, pas seulement lu** : 512 suites base (0 échec), batterie navigateur en cours
au moment de la rédaction (voir mise à jour ci-dessous), un nouveau scénario e2e A-contre-B,
`npm run verifier:memoire`, `npx tsc --noEmit`, lint, `npm audit --omit=dev`.

**Lu et tracé dans le code, sans pouvoir l'exécuter ici** : contexte IA sans clé réelle, exposition
réseau réelle de l'espace du patron (elle n'existe que chez lui), production (elle n'existe pas).

**Non testé, et NON VÉRIFIÉ reste la bonne formule** : scan dynamique (ZAP), test de charge,
en-têtes HTTP d'un hébergeur réel, restauration réelle d'une sauvegarde.

## G. Priorités

1. Aucune action immédiate requise sur la frontière entre entreprises — elle tient, sous réserve des
   limites de §F.
2. RT-1 et RT-2 : faits, à fusionner.
3. RT-4/E12 : décision du patron sur la durée de validité des liens de contrat/passage — question à
   lui poser, pas une correction en attente.
4. RT-3/E10 : à planifier comme son propre lot si la décision est de durcir le schéma — pas urgent.

## Conclusion

**Aucun accès inter-entreprises n'a été démontré.** La frontière entre A et B a été attaquée sur la
lecture, l'écriture, la création et l'accès par fichier, sous le rôle applicatif réel contre une
base réelle, et elle a tenu — pas seulement sur la foi du code relu, mais sur des suites rejouées et
un nouveau scénario e2e exécuté. Ce que cette campagne N'A PAS pu couvrir est précisément ce qui
n'existe pas encore à tester (la production, l'exposition réseau réelle de l'espace du patron) ou ce
qui demande une clé qu'elle n'a pas (l'IA réelle). Ce n'est jamais un verdict d'invulnérabilité —
seulement ce qui a été attaqué, ce qui a tenu, ce qui a été corrigé, et ce qui reste incertain.

---

*Rédigé par l'agent dans la session cloud `af42c0cb-7594-59ed-bd96-11aed5c2797e`, branche
`claude/audit-securite-redteam-2026-10-27`, commit `345e114`. Document mis à jour une fois la
batterie navigateur (`npm run test:e2e`) terminée.*
