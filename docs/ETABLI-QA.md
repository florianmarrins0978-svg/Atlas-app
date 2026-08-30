# L'établi de qualification

Comment monter un environnement de tests **totalement séparé** de l'Atlas de
tous les jours, pour y mener une campagne — parcours complets, rôles, devis et
factures, multi-entreprises, volumétrie, Playwright, puis charge — sans qu'aucun
geste ne puisse atteindre l'environnement de travail habituel.

**Ce document se parcourt du premier geste au dernier.** Il a été joué en
entier, et deux défauts en sont sortis (§« Ce qui a été trouvé en le
parcourant »).

---

## Ce que le dépôt possédait déjà

L'établi ne réinvente rien : il **dédouble** ce qui existe. C'est délibéré — une
seconde infrastructure divergerait de la première, et l'on qualifierait alors un
produit qui n'est pas celui qui part.

| Brique | Déjà là |
|---|---|
| PostgreSQL 16 + Redis 7 en conteneurs | `docker-compose.yml` |
| Rôles `atlas_owner` / `atlas_app`, sans DDL pour l'applicatif | `docker/init/` |
| Migrations, jeu de données fictif | `db:migrate`, `db:seed` |
| Garde qui refuse d'effacer une vraie base | `src/lib/garde-seed.ts` |
| Playwright, et 115 suites navigateur | `scripts/test-*-e2e.ts` |
| Fournisseurs d'IA déterministes, sans réseau | `LLM_PROVIDER=dev` |

Ce que l'établi ajoute : un **second jeu de conteneurs, sur d'autres ports**, un
**worktree**, et un **contrôle qui prouve l'isolation**.

---

## L'isolation, et d'où elle vient réellement

Elle ne vient **pas** du nom de la base : elle vient du dossier, des conteneurs
et des ports. Un nom se recopie d'un terminal à l'autre ; un port, non.

| | Atlas habituel | Établi QA |
|---|---|---|
| dossier | `Atlas-app/` | `Atlas-qa/` (worktree) |
| branche | la tienne | une branche `qa/…` dédiée |
| conteneurs | `atlas-postgres` · `atlas-redis` | `atlas-qa-postgres` · `atlas-qa-redis` |
| **ports** | **5432 · 6379** | **55432 · 56379** |
| base | `atlas_dev` | `atlas_qa` |
| volume | `atlas-pgdata` | `atlas-qa-pgdata` |
| fichiers déposés | `.storage/` du dossier | `.storage/` du worktree |

Les trois renommages — **conteneur, port, volume** — sont nécessaires *tous les
trois*. `docker-compose.yml` fixe `container_name` et le port 5432 : un simple
nom de projet Docker (`-p qa`) ne les dédouble pas, et la seconde base se
servirait du port de la première. On croirait travailler en QA en écrivant dans
l'environnement de tous les jours.

Le stockage des fichiers, lui, s'isole **gratuitement** : l'adaptateur local
range dans `.storage` du dossier courant (`process.cwd()`), et le worktree est
un autre dossier.

---

## Les étapes

### 1. Le worktree — un dossier à part, sur une branche à part

Un worktree est un **second dossier de travail** du même dépôt, sur une autre
branche. Le dossier habituel n'est pas touché : ni sa branche, ni ses fichiers,
ni son `.env`, ni son `node_modules`.

Depuis le dossier Atlas habituel :

```bash
git fetch origin
git worktree add ../Atlas-qa -b qa/campagne origin/claude/load-testing-model-selection-wtkrgh
```

Puis, dans VS Code : **Fichier → Ouvrir le dossier → `Atlas-qa`**. Deux fenêtres
VS Code, deux dossiers, deux terminaux — et plus aucune confusion possible sur
« lequel regarde quoi ».

> **`node_modules` ne se partage pas entre worktrees.** Il faut donc y installer
> les dépendances une fois : `npm install` dans `Atlas-qa`.

### 2. Les conteneurs de qualification

```bash
npm run qa:up
```

Postgres sur **55432**, Redis sur **56379**, avec leurs propres conteneurs et
leur propre volume. Les conteneurs habituels, s'ils tournent, ne sont pas
touchés.

### 3. La configuration

```bash
cp .env.qa.example .env
```

Le gabarit est versionné (il ne porte aucune clé) ; le `.env` qu'on en tire ne
l'est jamais. Il coupe, explicitement :

| | Comment |
|---|---|
| **l'IA** | `LLM_PROVIDER=dev` et `TRANSCRIPTION_PROVIDER=dev` |
| **la Base Adresse Nationale** | `ADRESSE_BASE_URL` vers une adresse morte |
| **les itinéraires IGN** | `ITINERAIRE_BASE_URL` vers une adresse morte |
| **Sentry** | aucun DSN |
| **le stockage distant** | `STORAGE_PROVIDER=local` |

**Le point qui coûte le plus cher si on l'oublie :** ne pas poser de clé d'IA ne
suffit pas à couper l'IA. Next.js charge de lui-même `.env.local` — le fichier
où les clés Anthropic et OpenAI sont justement invitées à vivre. Sans les deux
lignes `dev`, une campagne de mille utilisateurs virtuels enverrait mille
dictées chez les fournisseurs, **et les ferait payer**.

**Et aucun envoi réel n'est possible, par construction :** le dépôt ne contient
aucun expéditeur de courriel ni de SMS côté serveur — vérifié, ni `nodemailer`,
ni `twilio`, ni `sendgrid`, ni `brevo`. Atlas ouvre la messagerie du patron par
un lien `sms:` ou `mailto:`, c'est-à-dire un geste humain que rien
d'automatique ne déclenche. `ATLAS_URL_PUBLIQUE` est laissée absente : Atlas
refuse alors de composer un message vers un client.

### 4. La base

```bash
npm run qa:setup
```

Migrations sous le rôle **propriétaire**, puis le jeu de données fictif
(entreprise « Atelier Démo », clients, chantiers, devis, factures). Aucune
donnée réelle n'entre jamais ici.

### 5. La preuve

```bash
npm run qa:preuve
```

Neuf vérifications, et c'est **le geste à refaire** chaque fois qu'on rouvre
l'établi : où l'on est, sur quelle branche, quelle base, sur quel port, ce qui
est muet, et si l'Atlas habituel est hors de portée. Il **échoue** quand quelque
chose ne va pas, en nommant le remède.

### 6. L'application

```bash
npm run dev
```

Sur `http://localhost:3000`. Le compte de démonstration : `demo@atlas.local` /
`demo1234`.

---

## Les deux pièges à connaître avant la campagne

### `verifier:avant-livraison` ignore le `.env` de l'établi

`scripts/verifier-avant-livraison.ts` **code en dur** (lignes 55-57) :

    postgresql://…@localhost:5432/atlas_test

Lancée depuis l'établi QA, cette commande travaille donc sur le port **5432** —
celui de l'environnement de tous les jours — et non sur 55432. **Ne pas la
jouer depuis l'établi.** La batterie de livraison reste ce qu'elle est : le
contrôle du dossier habituel, avant de pousser du code.

`npm test` et `npm run test:e2e`, eux, lisent bien `DATABASE_URL` et travaillent
sur la base QA.

### Redis n'est pas optionnel pour la campagne — et Docker non plus

**Établi le 30 août 2026, sur un PC Windows sans Docker Desktop.** La tentation
est grande d'installer PostgreSQL nativement et de se passer de Redis, puisque
l'application démarre sans lui (un magasin en mémoire prend le relais hors
production). **Elle mène dans un mur, et le dépôt le dit déjà lui-même** —
`scripts/run-e2e-tests.ts`, verbatim :

> *« Suppose `REDIS_URL` : avec l'adaptateur mémoire, le compteur vit dans le
> processus serveur et reste hors d'atteinte. »*

Le mécanisme : la connexion est limitée à 5 tentatives par compte et par fenêtre
de 15 minutes. Chaque suite navigateur ouvre sa propre session avec le compte de
démonstration. Le lanceur remet donc le compteur à zéro entre deux suites — mais
il ne sait le faire **qu'à travers Redis** :

```ts
async function reinitialiserSeuilRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return;          // ← rien n'est remis à zéro
```

**Sans Redis, la sixième suite et toutes les suivantes échouent** — et l'échec ne
dit pas « trop de tentatives » : il se présente comme un banal dépassement de
délai sur la redirection d'après connexion. Cent-dix suites rouges qui accusent
le produit.

Et il n'existe **aucun Redis officiel pour Windows**. D'où : Docker Desktop, qui
apporte les deux services, dans les versions de la CI.

### Les suites navigateur exigent le port 3000

Les 115 suites codent en dur `http://localhost:3000`. L'application QA doit donc
occuper ce port au moment où on les joue — **l'Atlas habituel éteint**, ou
démarré sur un autre port. Deux serveurs sur 3000, c'est l'un des deux qui
répond, et rien ne dit lequel.

---

## Les services extérieurs, un par un

Inventaire complet, établi en cherchant tous les appels réseau sortants du code
serveur — pas en se fiant à ce qu'on croit savoir du produit.

| Service | Statut en QA | Comment |
|---|---|---|
| **Anthropic** (rédaction) | **désactivé** | `LLM_PROVIDER=dev` — fournisseur déterministe, aucun appel |
| **OpenAI** (rédaction + transcription) | **désactivé** | `LLM_PROVIDER=dev`, `TRANSCRIPTION_PROVIDER=dev` |
| **Gemini · Deepgram · Google (IA)** | **désactivé** | jamais atteints ; ce sont d'ailleurs des coquilles non implémentées |
| **Vision** (diagnostic, croquis, ticket) | **désactivé** | `VISION_PROVIDER=dev` |
| **Base Adresse Nationale** | **détourné** | `ADRESSE_BASE_URL=http://127.0.0.1:9` |
| **Géoplateforme IGN** (itinéraires) | **détourné** | `ITINERAIRE_BASE_URL=http://127.0.0.1:9` |
| **Sentry** | **désactivé** | aucun `SENTRY_DSN` — la bibliothèque ne fait rien sans lui |
| **Stockage S3** | **désactivé** | `STORAGE_PROVIDER=local` — tout va dans `.storage/` du worktree |
| **Agenda Google** | **inatteignable** | aucun agenda relié dans la base QA : il n'y a rien à synchroniser |
| **Agenda Apple / iCloud** | **inatteignable** | idem |
| **Courriel** | **inexistant** | aucun expéditeur côté serveur dans tout le dépôt |
| **SMS** | **inexistant** | idem — Atlas ouvre la messagerie du patron par un lien `sms:` |
| **Facturation électronique** (Chorus, Factur-X, Peppol) | **inexistant** | aucune trace dans le dépôt |

**Ce que « inexistant » veut dire, et c'est plus fort que « désactivé » :**
recherche faite sur `nodemailer`, `twilio`, `sendgrid`, `mailgun`, `brevo`,
`postmark`, `chorus`, `factur-x`, `peppol` — **aucun résultat**. Il n'y a rien à
neutraliser, parce qu'il n'y a rien. Un envoi ne peut partir que d'un geste
humain dans l'application de messagerie du téléphone.

**Aucune vraie clé n'entre dans l'établi.** `.env.qa.example` laisse les cinq
variables de clés vides, et les deux `LLM_PROVIDER=dev` /
`TRANSCRIPTION_PROVIDER=dev` l'emportent même si une clé traînait dans un
`.env.local`. `qa:preuve` le signale si une clé apparaît malgré tout.

---

## Playwright et k6 — état réel

### Playwright : installé, et déjà employé massivement

| | |
|---|---|
| paquet | `playwright@^1.62.0`, en dépendance de développement |
| `playwright.config.ts` | **absent, et c'est délibéré** |
| suites navigateur existantes | **115** (`scripts/test-*-e2e.ts`) |
| suites au total | **401** (`scripts/test-*.ts`) |
| lanceur | `npm run test:e2e` — démarre son propre serveur |
| socle partagé | `scripts/e2e-browser.ts` |

**Il n'y a pas de `playwright.config.ts` parce que les suites ne sont pas des
tests Playwright au sens du *runner* :** ce sont des scripts `tsx` qui pilotent
Playwright directement. Le socle commun leur donne déjà, sans qu'aucune ait à y
penser :

- un **délai par défaut de 45 s** — trois faux échecs le 7 août 2026 venaient
  d'un serveur qui compilait une route pour la première fois ;
- **l'écran du patron** — `devices["iPhone 13"]`, 390 × 664, la hauteur
  réellement disponible barre d'adresse comprise ;
- **le blocage des sauts `sms:` / `mailto:`**, que Chromium laisse en suspens et
  qui ferait échouer les vingt et une suites suivantes en accusant le mauvais
  coupable.

**Conséquence pour la campagne : ne pas monter d'infrastructure Playwright
parallèle.** Une nouvelle suite s'écrit sur ce socle, ou elle réinvente trois
pièges déjà payés.

### k6 : absent

Rien dans le dépôt, aucune dépendance, aucun script. À installer le jour venu —
et le point ouvert n'est pas l'installation mais **le patron
d'authentification** : Atlas repose sur des sessions Auth.js et des actions
serveur. Une charge qui n'ouvre pas de vraie session ne mesure que des
redirections vers l'écran de connexion.

Trois contraintes déjà connues, qui commanderont le scénario de charge :

1. **la connexion est limitée** à 5 tentatives par compte et par quart d'heure —
   1 000 utilisateurs virtuels ne peuvent pas se connecter avec le même compte ;
2. **le premier appel d'une route est lent** en mode développement : la feuille
   de chantier en PDF a été mesurée à **45-50 s** à froid, ramenée à **476 ms**
   après préchauffage. Une charge lancée sur un serveur non préchauffé mesure la
   compilation, pas le produit ;
3. **`DATABASE_POOL_MAX` vaut 10 par instance** — c'est probablement le premier
   plafond qu'une montée en charge rencontrera.

---

## Tout défaire

```bash
npm run qa:down                 # arrête, garde les données
docker compose -f docker-compose.qa.yml down -v   # efface la base pour de bon
```

Et pour retirer l'établi entièrement :

```bash
git worktree remove ../Atlas-qa
```

Rien de tout cela ne touche l'environnement habituel : ni ses conteneurs, ni son
volume, ni son dossier.

---

## Ce qui a été trouvé en le parcourant

Deux défauts, sortis du fait d'avoir joué la séquence au lieu de l'écrire.

**1. `qa:setup` mourait sur « permission denied for schema public ».** La
première version enchaînait `db:migrate:local && db:seed:local`, qui lisent tous
deux `DATABASE_URL` — c'est-à-dire le rôle **applicatif**, celui qui n'a aucun
droit de DDL, ici comme en production. Les migrations exigent le rôle
propriétaire. `scripts/qa-setup.mjs` le pose, et explique pourquoi l'inverse
— migrer sous un superutilisateur — est *pire*, parce qu'il réussit et ne se
paie qu'à la suite suivante, ailleurs.

**Le même défaut dort dans `dev:setup`**, pour l'environnement de tous les
jours : sur un volume Docker neuf, il échoue à l'identique. Noté dans `TODO.md`,
pas corrigé ici.

**2. `.env.qa.example` était écarté par `.gitignore`.** La règle `.env*`
n'exceptait que `.env.example`. Le gabarit dont tout l'intérêt est de survivre à
un `down -v` aurait disparu en silence, et l'on aurait recomposé de mémoire un
fichier fait pour ne pas dépendre de la mémoire.

---

## Ce qui n'a PAS pu être éprouvé ici, et où le faire

Cet environnement n'a **pas de démon Docker** (`AGENTS.md`). Ce qui a été joué,
et ce qui ne l'a pas été :

| | |
|---|---|
| `docker/init-qa/01-bootstrap-atlas-qa.sql` | **joué** — sur un cluster PostgreSQL 16 réel monté sur le port 55432, rôles et propriétaire vérifiés |
| les 84 migrations sur `atlas_qa` | **jouées** — 0 échec |
| le jeu de données fictif | **joué** — « Base d'essai reconnue : atlas_qa » |
| `npm run qa:preuve`, chemin vert | **joué** — 13 contrôles au vert |
| `npm run qa:preuve`, chemin **rouge** | **joué** — confronté à une configuration de développement, il rougit sur 6 points, chacun avec son remède |
| `docker-compose.qa.yml` lui-même | **NON joué ici** — aucun démon Docker. Sa topologie (ports, noms, volume) est celle du fichier habituel, à trois renommages près ; le SQL d'init qu'il monte, lui, est éprouvé |

C'est donc `npm run qa:up` qui reste à confirmer sur ta machine — et
`npm run qa:preuve` le dira sans ambiguïté : sans conteneur debout, il rougit
sur « Base joignable ».
