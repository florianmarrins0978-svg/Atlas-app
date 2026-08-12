# Règles permanentes du dépôt

Ce fichier est lu au début de **chaque** conversation. Ce qui n'y figure pas —
ou dans les documents qu'il désigne — n'existe pas : aucune décision ne doit
reposer sur le souvenir d'un échange précédent.

@AGENTS.md

---

## 1. Reprendre le travail : la première chose à faire

Avant d'écrire une ligne de code dans une nouvelle conversation, dans cet ordre :

1. **Lire** `HANDOVER.md`, `PROJECT_STATE.md`, `TODO.md`, `ARCHITECTURE.md`.
2. **Lire** `docs/AGENT.md` (le produit), `docs/A-FAIRE.md` (ce qui bloque) et
   `docs/QUESTIONS.md` (ce qui a déjà été tranché, et pourquoi).
3. **Regarder le dépôt lui-même** : `git log --oneline -20`, `git status`,
   `ls drizzle/` pour la dernière migration appliquée.
4. **Confronter les deux.** Si la documentation et le code divergent, le **code
   fait foi** — et la documentation se corrige immédiatement, avant toute autre
   chose. Une documentation périmée est pire qu'absente : on s'y fie encore.

Ne jamais demander au patron de rappeler ce qui a été fait. C'est le rôle de ces
fichiers, et leur défaillance est une défaillance du dépôt, pas de sa mémoire.

## 1 bis. « Ça ne marche pas » : REGARDER sa machine avant de lui parler

**Règle née de la nuit du 11 au 12 août 2026, et elle vaut pour toutes les
sessions.** Le patron écrit *« ça ne marche pas »*. Quatre allers-retours ont
suivi, à formuler des hypothèses sur une machine qu'on ne voyait pas — un
service de transcription absent, une mauvaise branche, un mot de passe : **toutes
fausses**. Pendant ce temps, sa machine savait tout, et c'est lui qui recopiait
des terminaux depuis un téléphone.

Son espace **publie désormais son état** sur une fiche GitHub au titre fixe —
`TITRE_FICHE` dans `scripts/rapporter-espace.mjs` —, réécrite à l'allumage puis
tous les quarts d'heure par le veilleur. Elle porte le commit récupéré, le
commit réellement **servi** (ce n'est pas le même, et ce malentendu a coûté deux
heures), l'état des services et la fin du journal de démarrage.

**Devant une plainte de ce genre, dans cet ordre :**

1. **lire la fiche** — sa date d'abord : périmée, elle ment comme une
   documentation périmée ;
2. n'avancer une hypothèse qu'ensuite, et la dire comme telle ;
3. si un geste sur sa machine est nécessaire, lui faire lancer **`claude`** dans
   son espace plutôt que de lui dicter dix commandes. L'agent y a accès, pas
   nous.

**Ce qui est refusé, et ne doit pas être rouvert :** donner à une session le
pouvoir d'exécuter des commandes chez lui. Une boucle qui lirait des ordres dans
le dépôt serait une porte dérobée sur une machine qui porte ses identifiants
GitHub et ses clés d'IA. Le canal est à sens unique — il publie, on lit.

## 2. Tenir la mémoire à jour, sans qu'on le demande

Après **chaque lot de travail important** — une fonctionnalité, une migration,
une décision d'architecture, un défaut corrigé qui apprend quelque chose — mettre
à jour les fichiers concernés **dans le même commit que le code**. Séparer les
deux, c'est produire une documentation qui décrit une version qui n'existe plus.

| Fichier | Ce qu'il porte | Quand le toucher |
|---|---|---|
| `CLAUDE.md` | Règles permanentes, conventions, contraintes | Quand une règle de travail change |
| `PROJECT_STATE.md` | Ce qui est fait, en cours, restant | Après chaque lot |
| `ARCHITECTURE.md` | Décisions structurantes **et leur pourquoi** | Quand une décision est prise ou révisée |
| `HANDOVER.md` | De quoi reprendre le travail à froid | Après chaque lot |
| `CHANGELOG.md` | Historique des changements qui comptent | Après chaque lot |
| `TODO.md` | Prochaines tâches, par priorité | Dès qu'une tâche naît ou meurt |

**Règle du transfert.** Si une information est apparue dans la conversation et
n'existe nulle part dans le dépôt, elle est écrite **avant** de poursuivre. Le
critère n'est pas « est-ce intéressant » mais : *une nouvelle conversation
prendrait-elle une mauvaise décision faute de le savoir ?*

Deux documents échappent à cette automaticité, et c'est délibéré :
`docs/QUESTIONS.md` et `docs/A-FAIRE.md` sont **tenus pour le patron**, dans son
langage. Rien n'y entre sans son accord explicite (voir `AGENTS.md`).

## 3. Comment on écrit le code ici

- **Le français partout** : noms de fonctions, de variables, de tables,
  commentaires, messages d'erreur, libellés. Un `withEntreprise`, pas un
  `withCompany`. C'est cohérent de bout en bout, y compris en base.
- **Les commentaires disent pourquoi, jamais quoi.** Un commentaire qui
  paraphrase la ligne suivante est du bruit. Un commentaire qui explique le
  piège évité, ou la solution écartée, vaut une heure de relecture.
- **Aucune fonction de dépôt n'appelle `db` directement.** Tout passe par
  `withEntreprise(utilisateurId, entrepriseId, fn)` — c'est ce qui pose le
  contexte d'isolation. Une requête hors de ce cadre ne renvoie rien,
  *silencieusement*.
- **Les règles métier vivent dans des fonctions pures**, dans `src/lib/`,
  testables sans base. Un écran ne décide de rien : il affiche le résultat.
- **Jamais de règle dupliquée entre l'affichage et la vérification.** La même
  fonction sert à construire un écran et à revalider ce qu'il renvoie — deux
  implémentations finissent toujours par diverger.

## 3 bis. La maquette d'abord, le code ensuite

**Règle posée par le patron le 11 août 2026**, après qu'une demande de geste
— « une pastille qui tourne » — a été portée d'un coup dans la maquette **et**
dans l'application : *« crée-moi une maquette avant de changer quoi que ce
soit »*.

Une demande d'apparence ou de geste se dessine, se montre, et **ne touche à
`src/` qu'une fois choisie**. Ce n'est pas une précaution de style : le code
écrit avant l'accord doit être défait si l'accord ne vient pas, et il encombre
la relecture de tout ce qui n'a pas été retenu. La maquette, elle, reste — même
écartée, elle raconte le chemin.

Ce qui ne compte PAS comme une exception : « c'est tout petit », « ça se
défait facilement », « il pourra ainsi l'essayer en vrai ». S'il veut l'essayer
en vrai, il le dira.

## 4. Ce qu'on ne fait jamais

- **Affaiblir la RLS pour se simplifier la vie.** Une opération de maintenance
  qui n'a pas de contexte d'entreprise passe par une file de travail portant
  l'entreprise concernée (voir `audios_a_purger`), jamais par un contournement.
- **Inventer un prix, une donnée client, une prestation.** Voir `docs/AGENT.md`
  §3 : un champ sans source fiable reste vide et signalé.
- **Envoyer, valider ou facturer sans un geste du patron.** Les arrêts du
  parcours sont décidés, pas optionnels.
- **Marquer une tâche terminée sans l'avoir vérifiée.** Voir §5.

## 5. Vérifier : ce qui compte comme « fait »

Rien n'est terminé sans **la batterie complète**, en une commande :

```bash
npm run verifier:avant-livraison
```

Elle enchaîne, dans cet ordre — les contrôles rapides d'abord :

| Étape | Ce qu'elle attrape |
|---|---|
| `typecheck`, `lint` | un appel qui ne correspond plus à sa signature |
| `verifier:memoire` | une documentation qui décrit une version disparue |
| `npm test` | isolation entre entreprises, règles métier, RLS |
| `npm run test:e2e` | le parcours complet, du devis à la facture |
| `verifier:connexion` | **« Invalid Server Actions request. »** |

Elle ne s'arrête pas à la première erreur : savoir que trois choses cassent, et
lesquelles, vaut mieux que de les découvrir une par une.

**La dernière étape mérite son existence.** Toutes les autres interrogent
`127.0.0.1`, où l'en-tête `Origin` et l'hôte coïncident. Le patron, lui, passe
par un proxy où ils diffèrent — et Next.js refuse alors toute action serveur, à
commencer par la connexion. Le défaut était donc invisible partout sauf chez
lui, et il a essayé vingt fois une application qui ne pouvait pas le laisser
entrer. `verifier-connexion.mjs` se connecte pour de bon, dans un navigateur, en
posant délibérément une origine étrangère.

**Ne rien demander au patron tant qu'elle n'est pas au vert.** C'est sa règle,
posée après ces vingt échanges : *« tu essayes, tu fais des batteries de tests
avant de me demander de le faire »*.

Les étapes séparées restent disponibles pour un diagnostic rapide :

```bash
npx tsc --noEmit && npm run lint
npm test              # suites base de données
npm run test:e2e      # suites navigateur (démarre son propre serveur)
npm run verifier:connexion  # connexion réelle derrière un proxy
```

Variables nécessaires en local (identiques à la CI, voir
`.github/workflows/ci.yml`) :

```
DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test
DATABASE_ADMIN_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test
AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000
# Pour test:e2e, un rôle qui traverse RLS (les suites inspectent la base) :
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test
CRON_SECRET=ci-placeholder-cron-secret-0000000000
REDIS_URL=redis://localhost:6379
```

**Les suites navigateur ne voient pas les défauts d'isolation.** Elles démarrent
leur serveur sous un rôle qui **traverse la RLS**, parce qu'elles inspectent la
base pour vérifier ce qu'elles affirment. Un chemin public par jeton — la page
du devis, celle de la facture, leurs PDF — éprouvé *uniquement* au navigateur
n'est donc pas éprouvé de ce point de vue : **il lui faut une suite base, sous
`atlas_app`**. Le 8 août 2026, le lien de facture et le téléchargement du devis
étaient morts en production pendant que la suite navigateur correspondante était
verte (`ARCHITECTURE.md` §34).

**Et surtout : regarder l'écran.** Trois défauts réels de ce projet — une barre
de navigation sur la page publique du client, l'ordre des totaux d'une facture,
une pile de notifications qui repoussait tout le contenu hors de l'écran — ont
été trouvés en regardant une capture, jamais par un test vert. Prendre une
capture des écrans touchés fait partie du travail, pas de la finition.

### Parcourir soi-même ce qu'on transmet

Un mode d'emploi, une commande, un environnement : **rien ne se donne au patron
sans avoir été parcouru en entier**, du premier geste au dernier. Compiler n'est
pas fonctionner ; « le script ne plante pas » ne dit rien de l'expérience de
celui qui le suit.

Trois échecs d'affilée l'ont montré, tous sur l'outillage et jamais sur le
produit : un mode d'emploi décrivant du code encore sur une branche, une adresse
ouverte avant que le serveur puisse servir, un port fermé qui rendait la page
blanche depuis un téléphone. À chaque fois, c'est **le patron** qui a fait le
test — et trois fois de suite, c'est trois fois de trop.

**Un contrôle doit savoir échouer.** Le vérifier en le confrontant à l'état
dégradé qu'il prétend détecter : une base vide, un fichier absent, un service
arrêté. Un contrôle jamais vu rouge ne prouve rien.

**Et son message doit désigner le bon coupable.** « relation "users" does not
exist » quand c'est la base entière qui n'est pas montée envoie chercher au
mauvais endroit — une erreur qui accuse à tort coûte plus cher que pas d'erreur
du tout.

### Monter la base ici : une commande

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

**Corrigé le 2026-08-05, contre ce que le dépôt affirmait.** Docker manque bien,
mais les binaires PostgreSQL 16 (`/usr/lib/postgresql/16/bin`) et `redis-server`
sont installés. `initdb` refuse de tourner en `root` — le script emprunte le
compte `postgres` du système. Les migrations tournent sous le rôle
**propriétaire** : `atlas_app` n'a aucun droit de DDL, et l'oublier produit un
« permission denied for schema public » qui envoie chercher au mauvais endroit.

Croire l'inverse a coûté cher : « c'est la CI qui vérifiera » a été dit trois
fois alors que la CI n'avait jamais tourné.

### Ce qui ne peut pas être éprouvé ici doit l'être ailleurs

Cet environnement n'a **ni démon Docker, ni GitHub CLI**, et son mandataire
réseau refuse `github.io`, `api.github.com` et la documentation GitHub. Ne pas
contourner : déplacer la vérification là où elle est possible.

Deux précédents, à imiter plutôt qu'à réinventer :

- `.github/workflows/pages.yml` interroge le site **à son adresse publique**
  après déploiement, puisque l'agent ne peut pas la joindre.
- `.github/workflows/banc-essai.yml` monte l'espace de travail complet et s'en
  sert, puisque l'agent n'a pas Docker.

Quand ni l'un ni l'autre n'est possible, **le dire** plutôt que de laisser croire
à une vérification qui n'a pas eu lieu.

## 6. Git

- Branche de développement : celle que la conversation désigne. Elle change à
  chaque session — ne pas se fier à un nom écrit ici, qui serait faux le
  lendemain.
- Messages de commit **en français**, à l'impératif, expliquant **pourquoi** le
  changement existe et ce qu'il évite. Le diff dit déjà quoi.
- Ne jamais pousser sur une autre branche sans accord explicite.
- Ne jamais ouvrir de *pull request* sans demande explicite.

### Rien n'est livré tant que ce n'est pas sur `main`

**Payé deux fois, la seconde le 11 août 2026.** Un lot complet — code, suites,
documentation, batterie au vert — a été poussé sur sa branche de session, et le
patron a répondu : *« les modifications ne me sont pas parvenues »*. Elles
étaient bien poussées. Elles n'étaient nulle part où il regarde.

Son banc d'essai ne sait faire qu'une chose (`.devcontainer/mettre-a-jour.sh`) :
à chaque allumage, il avance **sa propre branche** en ligne droite
(`--ff-only`). Une branche qu'il ne suit pas ne lui arrivera **jamais**, quoi
qu'on y pousse — et il n'aura pas le moindre message pour le lui dire.

**Donc : un lot n'est terminé qu'une fois sur `main`.** Le pousser sur sa
branche est une étape, pas une livraison. Demander l'accord (§6 ci-dessus), puis
fusionner et pousser — sans quoi il éprouve une version d'avant en croyant
éprouver la nouvelle.

**Pour savoir ce que son banc exécute vraiment**, ne pas le lui faire deviner :
l'écran **Réglages** affiche la version servie (date · numéro de commit,
`src/server/version-executee.ts`). Une capture répond à la question sans qu'on
ait à la poser.

### Plusieurs sessions écrivent sur `main` en même temps

**Sa consigne du 11 août 2026 :** *« souvent j'ai deux ou trois sessions qui
tournent et qui modifient en même temps plusieurs choses sur l'appli, fais
attention à ça »*.

Trois règles qui en découlent, et qui ne se négocient pas :

1. **Jamais de poussée en force sur `main`.** Un refus pour « non
   *fast-forward* » n'est pas un obstacle à contourner : c'est le garde-fou qui
   vient d'empêcher d'effacer le travail d'une autre session.
2. **Refusionner et rejouer, plutôt qu'insister.** `git fetch origin main`,
   fusionner, **relancer la batterie** — le code arrivé entre-temps n'est pas le
   sien, et rien ne dit qu'il s'accorde au nôtre. C'est ainsi qu'a été trouvée
   la §59 publiée en double le 11 août.
3. **Fusionner juste avant de pousser, pas la veille.** Entre la vérification et
   la poussée, `main` a pu bouger encore. Vérifier une dernière fois.
