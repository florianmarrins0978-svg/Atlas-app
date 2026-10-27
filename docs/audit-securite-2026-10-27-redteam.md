# Audit de sécurité du 27 octobre 2026 — rapport technique

*Document destiné à un développeur qui reprend ce dépôt. Langage technique, précis, avec les
fichiers et les lignes qui comptent. La version en langage courant est
`docs/audit-securite-2026-10-27-resume-simple.md`.*

*Branche : `claude/audit-securite-redteam-2026-10-27`. Session cloud
`af42c0cb-7594-59ed-bd96-11aed5c2797e`.*

---

## 1. Objectif et méthode

Campagne d'intrusion volontaire contre Atlas : un compte légitime d'une entreprise A tente de lire,
modifier, créer ou atteindre par un fichier les données d'une entreprise B, sans y avoir droit.
Menée contre une base PostgreSQL réelle, sous le rôle applicatif réel (`atlas_app`, sans
`BYPASSRLS`) — jamais contre une base vide, jamais sous un rôle qui contourne la sécurité qu'on
prétend éprouver.

Deux entreprises synthétiques (`REDTEAM_ENTREPRISE_A`, `REDTEAM_ENTREPRISE_B`) et des ressources
marquées (`REDTEAM_CLIENT_B`, `REDTEAM_CHANTIER_B`) ont servi de cibles identifiables.

**Ce qui a été attaqué, pour de vrai, pas seulement relu** :
- les 86 tables cloisonnées par entreprise (politiques RLS), pour une cinquantaine de scénarios
  d'isolation déjà couverts par les suites existantes (achats, chantiers, planning, transcription,
  accès, rôles…), rejoués un par un ;
- le chemin complet d'un règlement de facture (le scénario « argent »), tracé ligne à ligne dans le
  code ;
- la route qui sert les fichiers (logos, photos, notes vocales), par un vrai navigateur, une vraie
  connexion, deux vrais comptes — c'est ce scénario qui a trouvé la faille (§3) ;
- l'assistant IA (type de contexte, écriture directe interdite) ;
- les mécanismes de session et de révocation (JWT, cookies, « déconnecter partout ») ;
- la chaîne logicielle et la configuration CI/CD ;
- deux secrets d'espace (`AUTH_SECRET`, `CRON_SECRET`).

**Pendant cette campagne, une autre session du même compte a mené, sans concertation possible, un
audit qui recoupe largement les mêmes points** (parties de l'audit du 25-26 octobre 2026, repris en
« vague 3 »). Les deux travaux ont été fusionnés ; ce document ne recompte pas ce que l'autre
session a déjà réglé (§4), et se concentre sur l'apport propre de cette campagne.

## 2. Verdict en une phrase

**L'isolation entre entreprises tient.** Une faille réelle a été trouvée et corrigée (§3) ; elle
n'était pas exploitable sous le rôle qui sert réellement l'application aujourd'hui, mais elle
l'aurait été sous un mauvais réglage d'hébergement. Aucun autre chemin de lecture, d'écriture ou de
création n'a permis à A d'atteindre les données de B.

## 3. La faille trouvée et corrigée (RT-6)

### Le constat

`src/app/api/fichiers/[...key]/route.ts` sert trois natures de fichiers par la même route : le logo
de l'entreprise, les photos de chantier, les notes vocales. Une fuite déjà connue (29 août 2026)
avait montré que `entreprises` — qui **n'a aucune politique RLS** — avait besoin d'un filtre
explicite sur `ctx.entrepriseId`, posé depuis. Les deux autres branches (`photos`, `notes_vocales`),
qui SONT sous `FORCE ROW LEVEL SECURITY`, n'avaient pas reçu le même filtre : leur seule protection
restait la RLS, sans second rempart.

### Comment elle a été trouvée

Un scénario e2e écrit pour cette campagne (`scripts/test-fichiers-cross-entreprise-e2e.ts`) crée A
et B, pose un logo et une photo marqués côté B, se connecte réellement comme A et comme B, et
compare les réponses. Le logo refusait déjà (404) ; **la photo, elle, est arrivée (200, les
octets)**.

### Pourquoi ce n'était pas (encore) exploitable en production

Les suites de ce type servent leur serveur sous un rôle qui **traverse la RLS** par construction
documentée (`CLAUDE.md` §5 : « elles inspectent la base pour vérifier ce qu'elles affirment »). Sous
le rôle réel (`atlas_app`, sans `BYPASSRLS`), la même vérification — isolée dans une suite base
dédiée, `scripts/test-fichiers-autorisation-db.ts` — montre que la RLS seule referme déjà tout.

**Le risque réel** : toute situation où le serveur ne tourne pas sous `atlas_app` — mauvais réglage
d'hébergement, erreur humaine, ou simplement le fait qu'une suite de diagnostic ait été lancée
contre une base de production par erreur — aurait livré les photos et notes vocales de n'importe
quelle entreprise, sans qu'aucune deuxième vérification ne le rattrape.

### La correction

Fichier : `src/app/api/fichiers/[...key]/route.ts`.

- La logique d'autorisation est extraite dans une fonction nommée et exportée,
  `autoriseLectureDuFichier(ctx, storageKey)`, qui ne dépend plus de l'en-tête
  `x-atlas-pathname` posé par le middleware — ce qui la rend testable directement dans une suite
  base, sans navigateur.
- Le filtre `eq(photos.entrepriseId, ctx.entrepriseId)` et `eq(notesVocales.entrepriseId,
  ctx.entrepriseId)` est ajouté aux deux requêtes, à l'identique de ce qui protège déjà le logo.

### Ce qui la garde pour toujours

- `scripts/test-fichiers-autorisation-db.ts` — sous le rôle réel `atlas_app`, prouve que A ne peut
  pas lire la photo de B, et que B peut lire la sienne (le contrôle positif qui rend le refus
  significatif).
- `scripts/test-fichiers-cross-entreprise-e2e.ts` — sous le rôle e2e, le même scénario, sur le logo
  ET la photo.

Détail dans `ARCHITECTURE.md` §520.

## 4. Ce qui a été traité par ailleurs, pendant cette campagne

Une autre session a réglé, en parallèle et de façon indépendante, exactement les points que cette
campagne avait identifiés en lecture de code dans le reste de la « vague 3 ». Pour éviter tout
doublon de code ou de règle, les versions écrites par cette campagne pour ces points ont été
**retirées** à la fusion : `main` n'en garde qu'une version.

| Point | Qui l'a réglé, et comment | État |
|---|---|---|
| `CRON_SECRET` public dans `docker-compose.yml` | clé aléatoire propre à l'espace, hors dépôt (`.atlas-secrets/cron-secret`), posée par `banc.mjs` avant le lancement du serveur | **fait**, sur `main` |
| Permissions GitHub de `pages.yml` trop larges | permissions déplacées au niveau job (`contents: read` sur les jobs qui installent des paquets, `pages: write`/`id-token: write` seulement sur le job de publication) ; actions épinglées par empreinte réelle (`git ls-remote`) sur quatre flux | **fait**, sur `main`, plus complet que ce que cette campagne avait écrit |
| Liens entre tables d'entreprise sans contrainte composite (paiement/facture, acompte/devis…) | migration 0149 : `UNIQUE(id, entreprise_id)` + clé composite `NOT VALID` sur vingt-six liens, `test-liens-dans-l-entreprise-db.ts` | **fait**, sur `main` |
| Liens de contrat/passage d'entretien sans expiration | **refusé délibérément**, trois raisons écrites (reprise du lien par le patron depuis l'écran, document que le client doit pouvoir relire comme un PDF, lien de 256 bits déjà protégé par la RLS) | **tranché**, pas un bug |
| Nom de fichier accentué perdu au téléchargement (`test-dossiers-comptables-e2e.ts`) | `scripts/e2e-browser.ts` pose `LC_ALL=C.UTF-8` si la machine ne l'est pas déjà | **fait**, sur `main`, pendant cette campagne |

Détail : `ARCHITECTURE.md` §509 à §512, `§514` à `§519`.

## 5. Ce qui est SOLIDE, avec la preuve

| Mécanisme | Preuve | Fichier |
|---|---|---|
| Isolation entre entreprises, lecture et écriture | 524 suites base rejouées sous `atlas_app`, zéro échec, dont une cinquantaine de scénarios « Isolation : B ne voit/ne peut pas … » | voir `npm test` |
| Chemin de l'argent (paiements de facture) | tracé à la main : `noterPaiementDans`, `poserReglementRecu`, `majReglementRecu`, `retirerReglementRecu`, `remettrePaiement` relisent systématiquement la ligne parente via une requête soumise à la RLS avant d'écrire | `src/server/repositories/paiements-facture.ts` |
| Fichiers servis à l'entreprise (logo, photo, note vocale) | désormais deux remparts, prouvés sous les deux rôles qui servent réellement l'application | `src/app/api/fichiers/[...key]/route.ts` |
| Assistant IA | type `Ctx` partout, aucune écriture directe (confirmation explicite requise), isolation couverte par `test-ia-0X-*` | `src/server/ai/services/assistant-service.ts` |
| Révocation de session (« déconnecter partout ») | JWT sans table dédiée, `entrepriseId`/rôle toujours résolus depuis la base, pas depuis le jeton ; deux contournements réels déjà trouvés et corrigés (25 août, 23 octobre), avec leurs régressions | `src/server/session-ctx.ts`, `src/auth.ts` |
| Chaîne logicielle | `npm audit` : une seule alerte connue, non exploitée (`@simplewebauthn/server`, faible) ; actions GitHub épinglées par empreinte réelle | `package.json`, `.github/workflows/*.yml` |

## 6. Ce qui reste à consolider ou à tester

**Hérité de l'autre session, pas de cette campagne :**
- **Valider les 26 clés composites `NOT VALID`** de la migration 0149 sur la base réelle (habitée) :
  mesurer qu'aucun lien ancien ne traverse déjà deux entreprises, puis
  `ALTER TABLE … VALIDATE CONSTRAINT` dans une migration à part. Tant que ce n'est pas fait, la
  contrainte protège les écritures neuves mais ne garantit rien sur les anciennes lignes.

**Propre à cette campagne, non testé ici, à faire ailleurs :**
- **Exposition réseau réelle** (port public, mandataire, limiteur de connexion) — n'existe que sur
  l'espace réel du patron, pas dans ce conteneur cloud isolé.
- **Contexte IA avec une vraie clé** — l'isolation du contexte a été vérifiée par le code et par les
  suites existantes, jamais par un vrai appel à un fournisseur.
- **Scan dynamique (OWASP ZAP), test de charge, restauration réelle d'une sauvegarde** — aucun des
  trois n'est jouable dans cet environnement ; à faire dans un atelier dédié ou chez l'hébergeur.
- **En-têtes HTTP et protection réseau d'un hébergeur réel** — la production n'existe pas encore.

**Signalé en passant, hors périmètre de cette campagne, non traité :**
- `scripts/test-planning-e2e.ts` a montré un comportement intermittent (« collision de version de
  devis », `devis_chantier_version_uk`) pendant cette campagne — confirmé **capricieux**, pas une
  régression : rejoué isolément, il est vert des deux côtés (sur `main` et sur ce lot) via
  `scripts/verifier-rouge-prealable.ts`. À surveiller si cela revient ; pas d'action immédiate.

## 7. Comment rejouer ou étendre cette vérification

```bash
# Monter la base locale (pas de Docker nécessaire ici)
source scripts/monter-base-locale.sh

# La régression de la faille trouvée
npx tsx scripts/test-fichiers-autorisation-db.ts        # sous le rôle réel
npm run test:e2e -- --seulement fichiers-cross-entreprise # sous le rôle e2e

# La batterie complète (niveau 3, exigée avant toute fusion vers main)
npm run verifier:avant-livraison
```

Un rouge inattendu, avant de conclure qu'il vient de ce lot :

```bash
npx tsx scripts/verifier-rouge-prealable.ts   # compare contre une copie propre de main
```

## 8. Chiffres finaux

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | propre |
| lint | propre |
| `npm run verifier:memoire` | cohérent |
| `npm test` (base de données, sous `atlas_app`) | 524/524 — 0 échec |
| `npm run test:e2e` (navigateur) | 198/198 une fois les deux cas sans rapport retombés (§4, §6) |
| `npm run verifier:connexion` | réussie |
| `npm audit --omit=dev` | une alerte connue, non exploitée |

---

*Pour toute question sur ce document : relire `docs/audit-securite-2026-10-27-resume-simple.md`
pour le résumé en langage courant, ou `ARCHITECTURE.md` §509-§520 pour le détail des décisions
d'architecture.*
