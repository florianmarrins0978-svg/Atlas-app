# Campagne QA : rapport du 12 octobre 2026

À coller dans une nouvelle session pour reprendre la campagne QA à froid.

## Où on en est

- Dossier : `C:\Users\Flori\Desktop\atlas-real-app\Atlas-qa` (worktree), branche `qa/campagne`
- Dernière fusion : `origin/main` (`815dc157`) fusionné dans `qa/campagne`, commit `d042d9b7`. Merge, pas de rebase, rien de jeté.
- **Rien n'est poussé.** Pousser ou fusionner vers `main` : uniquement avec l'accord du patron.
- Interdits de la campagne : ne pas toucher au dossier `atlas-app`, ne pas toucher au port 5432 (base de tous les jours).

## Ce qui a été fait

| Étape | Résultat |
|---|---|
| `git fetch origin` + `git merge origin/main` | 18 commits arrivés, 1 conflit |
| Conflit `CHANGELOG.md` (section 2026-10-11) | Les deux gardés : les puces de main d'abord, puis la section « L'établi de qualification remis sur l'application d'aujourd'hui » de la campagne |
| `npm install` | OK (avertissements `allow-scripts` seulement) |
| `npm run qa:setup` | 1er essai rouge : conteneurs QA arrêtés (ECONNREFUSED 55432). `npm run qa:up` les a rallumés (rien effacé), 2e essai vert |
| `npm run qa:preuve` | **15/15 VERT** |
| `test-tva-au-paiement-e2e.ts` seul | **VERT**, 9 tests réussis, 0 échoué |
| `test-pages-publiques-sans-navigation-e2e.ts` seul | **VERT**, 0 échec, pas de plantage natif Node |

## Les deux constats du 31 août

| Constat | Après la fusion de main |
|---|---|
| `test-tva-au-paiement-e2e.ts` (P2) : délai dépassé en marquant la facture payée | Ne se reproduit plus |
| `test-pages-publiques-sans-navigation-e2e.ts` : `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` | Ne se reproduit plus |

Probable explication (non prouvée) : main sert désormais les suites par `next start` sur la version bâtie, et non plus `next dev`. Les deux restent à confirmer dans la batterie complète.

## Piège trouvé : lancer une suite navigateur sur l'établi

Le lanceur `scripts/run-e2e-tests.ts` amorce la base avec `src/server/db/seed.ts` sous `DATABASE_URL`. Dans `.env`, c'est le rôle applicatif `atlas_app`, qui n'a pas le droit de vider les tables :

```
permission denied for table lignes_facture
❌ Impossible de lancer le seed de la base de développement (code: 1).
```

La suite ne joue alors aucun test. Il faut le superutilisateur du conteneur QA (`docker-compose.qa.yml`), passé **dans la commande**, sans modifier `.env` :

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres_qa_pw@localhost:55432/atlas_qa"
npx tsx --env-file=.env scripts/run-e2e-tests.ts --seulement <suite>.ts *> "$env:TEMP\claude\qa-e2e\<suite>.log"
```

`--env-file` n'écrase pas une variable déjà posée : le `DATABASE_URL` ci-dessus l'emporte, le reste (Redis 56379, etc.) vient du `.env`.

## Avant de lancer quoi que ce soit

1. `docker ps -a` : `atlas-qa-postgres` et `atlas-qa-redis` doivent être `Up`. Sinon `npm run qa:up` (rallume, n'efface rien). **Jamais `qa:reset`** sans accord : il supprime les volumes.
2. `npm run qa:preuve` doit rendre 15/15.
3. Sorties toujours redirigées vers un fichier, jamais tronquées par `tail`.

## Prochaines étapes

1. Relancer la batterie navigateur complète avec le `DATABASE_URL` superutilisateur ci-dessus, sortie dans un fichier :
   `npx tsx --env-file=.env scripts/run-e2e-tests.ts *> "$env:TEMP\claude\qa-e2e\batterie.log"`
2. Mettre à jour `QA_EXECUTION_LOG.md` et `QA_FINDINGS.md` : les deux constats du 31 août classés « résolus par main », si la batterie le confirme.
3. Limite connue toujours ouverte (voir `docs/qa-fusion-main-retour.md`) : dans `run-e2e-tests.ts`, le contrôle « port déjà occupé » passe avant `ATLAS_E2E_EXTERNAL_SERVER=1`, ce qui rend l'option inutilisable.
4. Pousser : uniquement avec l'accord du patron.

## Fichiers utiles

| | |
|---|---|
| Rapport précédent | `docs/qa-fusion-main-retour.md` |
| Journal de la campagne | `QA_EXECUTION_LOG.md`, `QA_FINDINGS.md` |
| Établi QA | `docs/ETABLI-QA.md`, `docker-compose.qa.yml`, `scripts/qa-setup.mjs` |
| Sorties du 12 octobre | `%TEMP%\claude\qa-e2e\tva-au-paiement.log`, `pages-publiques.log`, trace `%TEMP%\trace-tva-e2e.zip` (hors dépôt, peuvent disparaître) |
