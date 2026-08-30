# Atlas — L'établi de qualification, avant la campagne de tests

**30 août 2026.** Ce dossier décrit l'environnement de qualification monté pour
une campagne de tests approfondie : parcours complets, réglages, rôles,
devis/factures/PDF, multi-entreprises, volumétrie, Playwright, puis tests de
charge pouvant aller jusqu'à 1 000 utilisateurs virtuels.

**La campagne n'a PAS commencé.** Ce document ne porte que l'établi : le
dossier, la branche, la base, les services neutralisés, et les preuves.

Il est autonome — ChatGPT n'a pas le code sous les yeux. Les extraits sont
verbatim, les mesures ont été faites, et ce qui n'a **pas** pu être éprouvé est
dit comme tel.

---

## 1. La consigne de départ

> *« Je veux notamment : ne jamais travailler directement sur main ; conserver
> mon environnement Atlas actuel intact ; idéalement créer un worktree ou un
> dossier QA séparé ; une branche exclusivement dédiée à la qualification ; une
> base PostgreSQL locale exclusivement dédiée aux tests, par exemple atlas_qa ;
> uniquement des données fictives ; aucune vraie clé dans .env ; neutraliser les
> services externes susceptibles d'envoyer des mails, d'appeler des services
> payants ou de modifier des données réelles ; préparer Playwright et plus tard
> k6 ; pouvoir supprimer/réinitialiser l'environnement QA sans affecter Atlas
> normal. »*

Avec une instruction préalable explicite : **inspecter d'abord ce qui existe, et
ne pas créer une deuxième solution si le projet a déjà une infrastructure
propre.**

---

## 2. Ce que l'inspection a trouvé — le dépôt avait déjà presque tout

| Brique | État | Fichier |
|---|---|---|
| PostgreSQL 16 + Redis 7 en conteneurs | existe | `docker-compose.yml` |
| Rôles `atlas_owner` / `atlas_app`, **sans DDL pour l'applicatif** | existe | `docker/init/01-bootstrap-atlas.sql` |
| Migrations (84), jeu de données fictif complet | existe | `db:migrate`, `db:seed` |
| Garde refusant d'effacer une vraie base | existe | `src/lib/garde-seed.ts` |
| Playwright + **115 suites navigateur** | existe | `scripts/test-*-e2e.ts` |
| **401 suites au total** | existe | `scripts/test-*.ts` |
| Fournisseurs d'IA déterministes, sans réseau | existe | `LLM_PROVIDER=dev` |
| k6 | **absent** | — |
| `playwright.config.ts` | **absent** | les suites sont des scripts `tsx` autonomes |

**Conclusion retenue : ne rien réécrire, tout dédoubler.** Une seconde
infrastructure aurait divergé de la première, et l'on aurait qualifié un produit
qui n'est pas celui qui part en production.

---

## 3. Les trois pièges trouvés à l'inspection

Ce sont eux qui ont commandé le dessin. Sans eux, un « environnement QA » aurait
été une illusion.

### 3.1 `docker-compose.yml` fixe le nom du conteneur ET le port

```yaml
services:
  postgres:
    image: postgres:16
    container_name: atlas-postgres      # ← ressource UNIQUE sur la machine
    ports:
      - "5432:5432"                     # ← ressource UNIQUE sur la machine
    volumes:
      - atlas-pgdata:/var/lib/postgresql/data
```

Un simple nom de projet Docker (`docker compose -p qa up`) **ne dédouble pas**
`container_name` ni le port publié. Docker refuse le second conteneur — ou, pire,
la seconde base se sert du port de la première : **on croit travailler en QA en
écrivant dans l'environnement de tous les jours.**

D'où la règle retenue : **trois renommages, et il faut les trois** — conteneur,
port, volume.

### 3.2 `verifier:avant-livraison` code la base en dur

`scripts/verifier-avant-livraison.ts`, lignes 55-57, verbatim :

```ts
const APP   = "postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test";
const OWNER = "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test";
const SUPER = "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test";
```

Cette commande **ignore le `.env`**. Lancée depuis l'établi QA, elle travaille
sur le port **5432**, c'est-à-dire l'environnement de tous les jours. C'est le
seul chemin par lequel l'établi peut encore atteindre le dossier habituel — il
est signalé à chaque passage du contrôle d'isolation (§6).

`npm test` et `npm run test:e2e`, eux, lisent bien `DATABASE_URL`.

### 3.3 Les 115 suites navigateur codent le port 3000 en dur

Extrait de `scripts/test-nouveau-compte-e2e.ts` :

```ts
const BASE = "http://localhost:3000";
```

Conséquence pour la campagne : l'application QA doit occuper le port 3000 au
moment où l'on joue les suites — donc l'Atlas habituel éteint, ou démarré
ailleurs.

---

## 4. Le dessin retenu

**L'isolation ne vient pas du nom de la base, elle vient des ports.** Un nom se
recopie d'un terminal à l'autre ; un port, non.

| | Atlas habituel | Établi QA |
|---|---|---|
| dossier | `Atlas-app/` | `Atlas-qa/` — **git worktree** |
| branche | la sienne | `qa/campagne` |
| conteneurs | `atlas-postgres` · `atlas-redis` | `atlas-qa-postgres` · `atlas-qa-redis` |
| **ports** | **5432 · 6379** | **55432 · 56379** |
| base | `atlas_dev` | `atlas_qa` |
| volume | `atlas-pgdata` | `atlas-qa-pgdata` |
| fichiers déposés | `.storage/` du dossier | `.storage/` du worktree |

Le stockage s'isole **gratuitement** : l'adaptateur local range dans le dossier
courant.

```ts
// src/server/storage/local-storage.ts
export const RACINE_STOCKAGE = path.join(process.cwd(), ".storage");
```

Un worktree étant un autre dossier, il a son propre stockage sans qu'on ait rien
à régler.

---

## 5. Un arbitrage à connaître : `atlas_qa` a été ajouté à une liste blanche

Le jeu de données commence par un `TRUNCATE` de toutes les tables. Une garde
l'encadre :

```ts
// src/lib/garde-seed.ts — AVANT
export const BASES_AUTORISEES = ["atlas_test", "atlas_dev"] as const;
```

`atlas_qa` était donc **refusé**. Trois issues étaient possibles :

| Option | Verdict |
|---|---|
| ajouter `atlas_qa` à la liste blanche | **retenue** |
| forcer par `ATLAS_SEED_FORCER=oui-j-efface-tout` | refusée |
| nommer la base QA `atlas_test` | refusée |

**Pourquoi le forçage a été refusé, et c'est le raisonnement qui compte :** une
campagne refait son jeu de données des dizaines de fois par jour. Une phrase de
forçage tapée vingt fois par jour cesse d'être une décision et devient un
réflexe — **le garde-fou serait mort de son propre usage**, et il aurait été
disponible, en réflexe, le jour où quelqu'un a une vraie adresse dans son
environnement.

**Ce que l'ajout ne relâche pas** — les autres refus sont intacts :

- l'hôte doit être cette machine (`localhost`, `127.0.0.1`, `::1`, `postgres`,
  `db`) — *« une base d'essai qui porte le bon nom ailleurs reste la base de
  quelqu'un »* ;
- `NODE_ENV=production` refuse toujours, sans discussion.

Les 11 contrôles de `scripts/test-garde-seed.ts` passent sans modification : ils
itèrent sur `BASES_AUTORISEES` au lieu d'énumérer les noms.

---

## 6. La neutralisation des services extérieurs

### 6.1 Ce qui aurait pu sortir

Sept fichiers appellent `fetch` côté serveur :

| Fichier | Neutralisé par |
|---|---|
| `ai/providers/llm/anthropic.ts` | `LLM_PROVIDER=dev` |
| `ai/providers/llm/openai.ts` | idem |
| `ai/providers/transcription/openai.ts` | `TRANSCRIPTION_PROVIDER=dev` |
| `adresses/base-adresse-nationale.ts` | `ADRESSE_BASE_URL=http://127.0.0.1:9` |
| `itineraire/geoplateforme.ts` | `ITINERAIRE_BASE_URL=http://127.0.0.1:9` |
| `agenda/google.ts` | aucun agenda relié en base — rien à appeler |
| `agenda/apple.ts` | idem |

### 6.2 Le point qui coûte le plus cher si on l'oublie

**Ne pas poser de clé d'IA ne suffit pas à couper l'IA.** Next.js charge de
lui-même `.env.local` — le fichier où les clés Anthropic et OpenAI du patron
sont justement invitées à vivre. Le dépôt le savait déjà, et le dit dans sa
propre batterie :

```ts
// scripts/verifier-avant-livraison.ts, verbatim
// Retirer les clés de l'environnement ne suffit PAS : Next.js charge de
// lui-même `.env.local`, où le patron est justement invité à coller les
// siennes. Une variable réelle l'emporte sur ce fichier — d'où ce réglage
// explicite, qui garantit le mode déterministe quoi qu'il y ait sur le disque.
const IA_COUPEE = { LLM_PROVIDER: "dev", TRANSCRIPTION_PROVIDER: "dev" };
```

Sans ces deux lignes, **une campagne de 1 000 utilisateurs virtuels enverrait
1 000 dictées chez les fournisseurs, et les ferait payer.** L'établi les pose.

### 6.3 Aucun envoi réel n'est possible, par construction

Vérifié : le dépôt ne contient **aucun** expéditeur de courriel ni de SMS côté
serveur — ni `nodemailer`, ni `twilio`, ni `sendgrid`, ni `mailgun`, ni `brevo`,
ni `postmark`. Atlas ouvre la messagerie du patron par un lien `sms:` ou
`mailto:` : un geste humain, que rien d'automatique ne déclenche.

`ATLAS_URL_PUBLIQUE` est laissée **absente** délibérément : Atlas refuse alors de
composer un message vers un client (`ouvrableParLeClient` rejette une adresse
locale).

### 6.4 Le choix du port 9 pour les services publics détournés

Ni la Base Adresse Nationale ni la Géoplateforme IGN ne sont payantes et aucune
ne modifie de donnée. Elles sont tout de même coupées, pour deux raisons :

1. une campagne de charge leur enverrait des milliers de requêtes depuis une
   seule adresse IP — c'est un abus de service public ;
2. elles répondraient **429 au milieu d'une mesure**, qu'on croirait alors
   fausse.

Le port 9 (« discard ») refuse la connexion immédiatement, au lieu d'attendre le
délai de 4 s. Et le chemin dégradé est **déjà éprouvé** par les suites — ce n'est
pas un état inconnu :

```ts
// src/server/adresses/base-adresse-nationale.ts, verbatim
} catch {
  // Réseau coupé, délai dépassé, réponse illisible : dans tous les cas le
  // champ redevient un champ ordinaire. L'aide s'efface, la saisie continue.
  return { ok: false, raison: "injoignable" };
}
```

---

## 7. Le contrôle qui PROUVE l'isolation

`npm run qa:preuve` (`scripts/prouver-etabli-qa.ts`) répond en une commande aux
neuf questions à trancher avant toute campagne.

**Pourquoi un script plutôt qu'une liste de commandes à taper :** une liste se
déroule à la main le premier jour, puis on la saute. Or le seul moment où elle
compte est le vingtième — quand on a rouvert trois terminaux, changé de branche
deux fois, et qu'on ne sait plus lequel regarde quoi.

Il ne corrige rien et ne démarre rien : *un outil qui répare ce qu'il mesure
finit par cacher ce qu'il devait montrer.*

### 7.1 Sortie réelle, chemin vert

```
  ✓ Branche
     qa/campagne  (ce n'est ni main ni master)
  ✓ Base PostgreSQL
     atlas_qa · localhost:55432  — locale, et hors du port habituel (5432)
  ✓ Base joignable
     atlas_qa · 69 tables · connecté en « atlas_app »
     jetable : docker compose -f docker-compose.qa.yml down -v  efface le volume
  ✓ Redis
     localhost:56379  — local, hors du port habituel (6379)
  ✓ IA coupée
     LLM_PROVIDER=dev · TRANSCRIPTION_PROVIDER=dev · aucune clé posée
  ✓ Adresses (BAN)
     détourné vers http://127.0.0.1:9 — le service public n'est jamais appelé
  ✓ Itinéraires (IGN)
     détourné vers http://127.0.0.1:9 — le service public n'est jamais appelé
  ✓ Sentry            sans DSN — muet, aucune requête
  ✓ Stockage          local — propre à ce worktree
  ✓ Atlas habituel hors de portée
     aucune variable ne nomme les ports 5432 / 6379
     ⚠ SAUF si tu lances `npm run verifier:avant-livraison` : cette commande code
       en dur localhost:5432/atlas_test et ignore ce .env.

═══ L'établi est isolé. La campagne peut commencer. ═══
```

### 7.2 Il a été vu ROUGE avant d'être vu vert

Confronté à une configuration de développement, il rougit sur **6 points**,
chacun avec son remède. Extrait réel :

```
  ✗ Base PostgreSQL
     « atlas_test » — ce n'est pas la base de qualification
  ✗ Redis
     port 6379 — c'est le Redis de ton Atlas habituel
  ✗ IA coupée
     LLM_PROVIDER=« (vide) » · TRANSCRIPTION_PROVIDER=« (vide) »
     → Une variable VIDE ne coupe rien : une clé trouvée dans .env.local
       suffirait à brancher un vrai fournisseur — et à faire payer la campagne.
  ✗ Atlas habituel hors de portée
     une variable de ce .env nomme le port 5432 ou 6379

═══ 6 point(s) à régler AVANT de lancer quoi que ce soit. ═══
```

**Un contrôle jamais vu rouge ne prouve rien.** Deux cas méritent d'être
signalés, parce qu'ils viennent d'une règle du dépôt (*« un contrôle qui mesure
zéro ne mesure rien »*) :

- une base qui répond avec **zéro table** est déclarée **rouge**, pas « propre » :
  zéro table n'est pas un état sain, c'est « pas encore migrée » ;
- une base joignable dont `current_database()` ne correspond pas à l'adresse est
  rouge : cela signalerait un conteneur d'un autre environnement sur ce port.

---

## 8. Deux défauts trouvés en JOUANT la séquence, pas en l'écrivant

### 8.1 `qa:setup` mourait sur « permission denied for schema public »

La première version enchaînait simplement les scripts existants :

```json
"qa:setup": "npm run db:migrate:local && npm run db:seed:local"
```

Et elle est morte :

```
error: permission denied for schema public
  code: '42501'
```

**Cause.** `db:migrate:local` lit `DATABASE_URL`, c'est-à-dire le rôle
**applicatif** — celui qui n'a aucun droit de DDL, ici comme en production. C'est
délibéré dans ce dépôt : c'est ce qui fait que l'isolation entre entreprises est
réellement éprouvée pendant les essais, au lieu d'être contournée par un
superutilisateur qui traverse la RLS sans le dire.

Les migrations doivent tourner sous le rôle **propriétaire**. `scripts/qa-setup.mjs`
le pose.

**Et l'inverse est PIRE, parce qu'il réussit.** Migrer sous `postgres` crée des
tables qui appartiennent au superutilisateur ; le défaut n'apparaît qu'à la suite
suivante, ailleurs, en « permission denied for table … » sur une table qu'on n'a
pas touchée. Le dépôt a déjà payé cela : *cinquante suites rouges d'un coup.*

**Le même défaut dort dans `dev:setup`**, pour l'environnement de développement
ordinaire : sur un volume Docker neuf, il échoue à l'identique. Il n'a jamais été
vu parce qu'un poste où `db:up` a déjà tourné porte des tables déjà créées.
**Noté dans `TODO.md`, délibérément pas corrigé** — l'établi QA ne doit pas
devenir le prétexte à remanier le chemin de développement d'un lot qui ne le
demandait pas.

### 8.2 `.env.qa.example` était écarté par `.gitignore`

```
.env*
!.env.example
```

Le gabarit — dont tout l'intérêt est de permettre de remonter l'établi à
l'identique après un `down -v` — aurait disparu **en silence**. On aurait
recomposé de mémoire un fichier fait précisément pour ne pas dépendre de la
mémoire. Une exception explicite a été ajoutée.

---

## 9. Ce qui a été éprouvé, et ce qui ne l'a pas été

Cet environnement d'agent **n'a pas de démon Docker**.

| | |
|---|---|
| `docker/init-qa/01-bootstrap-atlas-qa.sql` | **joué** — cluster PostgreSQL 16 réel monté sur 55432, rôles et propriétaire vérifiés |
| les 84 migrations sur `atlas_qa` | **jouées** — 0 échec |
| le jeu de données fictif | **joué** — sortie : « Base d'essai reconnue : atlas_qa » |
| `qa:preuve`, chemin vert | **joué** — 13 contrôles au vert |
| `qa:preuve`, chemin rouge | **joué** — 6 rouges contre une configuration de développement |
| `scripts/test-garde-seed.ts` | **joué** — 11/11 |
| `tsc --noEmit` | **joué** — 0 erreur |
| `npm run lint` | **joué** — 0 erreur (16 avertissements, tous préexistants) |
| `npm run verifier:memoire` | **joué** — cohérente |
| **`docker-compose.qa.yml` lui-même** | **NON joué** — aucun démon Docker |

Le fichier non éprouvé a la topologie du `docker-compose.yml` habituel, à trois
renommages près, et le SQL qu'il monte est éprouvé. `qa:preuve` le dira sans
ambiguïté : sans conteneur debout, il rougit sur « Base joignable ».

---

## 10. Ce sur quoi un avis extérieur serait utile

L'établi est monté. La campagne, elle, n'est pas encore dessinée. Quatre points
restent ouverts, et ils ne se tranchent pas seuls :

1. **L'outil de charge.** k6 est le candidat pressenti, rien n'est écrit. Le
   produit est un Next.js avec actions serveur et sessions Auth.js : une charge
   qui n'ouvre pas de vraie session ne mesure que des redirections. Quel est le
   bon patron pour 1 000 utilisateurs virtuels authentifiés ?

2. **Ce qu'on mesure.** Le produit a des chemins très inégaux : un PDF de devis
   met plusieurs dizaines de secondes à se compiler la première fois (mesuré :
   45-50 s, ramené à 476 ms après préchauffage), là où un écran de liste répond
   en quelques millisecondes. Une moyenne sur l'ensemble ne dirait rien.

3. **La volumétrie et la RLS.** L'isolation entre entreprises est tenue par
   PostgreSQL Row Level Security, forcée sur 42 tables. La question ouverte
   n'est pas « est-ce sûr » (c'est éprouvé par des suites qui attaquent) mais
   « à quel prix » : le comportement du planificateur avec des dizaines de
   milliers de lignes sous RLS n'a jamais été observé sur ce dépôt.

4. **La contrainte du port 3000.** Les 115 suites navigateur le codent en dur.
   Faut-il les rendre paramétrables avant la campagne — 115 fichiers touchés,
   avec le risque que cela introduit — ou vivre avec, et n'allumer qu'un serveur
   à la fois ?

**Réserve sur ce dernier point :** toucher 115 suites pour un confort d'établi
serait exactement le genre d'élargissement de périmètre que ce dépôt s'interdit.
La recommandation actuelle est de vivre avec.

---

## 11. Les commandes de l'établi

```bash
git worktree add ../Atlas-qa -b qa/campagne origin/<branche>
cd ../Atlas-qa && npm install

npm run qa:up        # conteneurs QA : postgres 55432, redis 56379
cp .env.qa.example .env
npm run qa:setup     # migrations (rôle propriétaire) + jeu fictif
npm run qa:preuve    # les neuf preuves d'isolation
npm run dev          # http://localhost:3000 — demo@atlas.local / demo1234
```

Tout défaire, sans toucher à l'environnement habituel :

```bash
docker compose -f docker-compose.qa.yml down -v
git worktree remove ../Atlas-qa
```
