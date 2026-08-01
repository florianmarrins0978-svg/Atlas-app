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

Rien n'est terminé sans, dans cet ordre :

```bash
npx tsc --noEmit && npm run lint
npm test          # suites base de données
npm run test:e2e  # suites navigateur (démarre son propre serveur)
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

**Et surtout : regarder l'écran.** Trois défauts réels de ce projet — une barre
de navigation sur la page publique du client, l'ordre des totaux d'une facture,
une pile de notifications qui repoussait tout le contenu hors de l'écran — ont
été trouvés en regardant une capture, jamais par un test vert. Prendre une
capture des écrans touchés fait partie du travail, pas de la finition.

## 6. Git

- Branche de développement : `claude/migrate-app-atlas-zz31ac`.
- Messages de commit **en français**, à l'impératif, expliquant **pourquoi** le
  changement existe et ce qu'il évite. Le diff dit déjà quoi.
- Ne jamais pousser sur une autre branche sans accord explicite.
- Ne jamais ouvrir de *pull request* sans demande explicite.
