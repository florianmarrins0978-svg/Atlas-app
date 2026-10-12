# Campagne QA : rapport du 12 octobre 2026 (batterie complète)

À coller dans une nouvelle session pour reprendre la campagne QA à froid. Fait suite à `docs/qa-rapport-2026-10-12.md`.

## Où on en est

- Dossier : `C:\Users\Flori\Desktop\atlas-real-app\Atlas-qa` (worktree), branche `qa/campagne`
- Base de code éprouvée : fusion de `origin/main` `815dc157`, commit `d042d9b7`
- **Rien n'est poussé.** Pousser ou fusionner : uniquement avec l'accord du patron.
- Interdits : ne pas toucher au dossier `atlas-app`, ne pas toucher au port 5432.

## Batterie navigateur complète

**180/183 suites réussies. 1 rouge. 2 non mesurables ici.**

| Suite | Verdict | Ligne d'erreur |
|---|---|---|
| `test-devis-client-e2e.ts` | rouge (16/17) | `❌ un jeton inconnu ne révèle rien au visiteur` : `le message générique n'est pas affiché` |
| `test-bandeau-banc-e2e.ts` | non mesurable | `« npx » est absent de cette machine` |
| `test-connexion-service-en-panne-e2e.ts` | non mesurable | `« bash » est absent de cette machine` |

Les deux constats du 31 août (`test-tva-au-paiement-e2e.ts`, `test-pages-publiques-sans-navigation-e2e.ts`) sont verts : classés **résolus par main** dans `QA_FINDINGS.md`.

## Le rouge, en bref (`QA_FINDINGS.md` §3)

- Rejoué seul : rouge encore, 2 échecs (le même, plus `le client voit son devis sans être connecté` : `émetteur absent`).
- La page est juste : HTML 200 avec « Ce lien n'est plus valable », et la capture le montre.
- Mais sur un serveur froid, la première ouverture de `/devis/<jeton>` reste sur « Chargement… » (`src/app/loading.tsx`) jusqu'à environ 2,4 s, après `networkidle` (environ 0,56 s). Les ouvertures suivantes sont visibles dès 0,57 s.
- Le test lit `isVisible()`, qui ne patiente pas. Classé **P3, fragilité de test et lenteur au premier rendu**, pas un défaut fonctionnel.

## Comment la batterie a été lancée

```powershell
docker ps -a                     # atlas-qa-postgres et atlas-qa-redis Up, sinon npm run qa:up (jamais qa:reset)
npm run qa:preuve                # 15/15
$env:DATABASE_URL="postgresql://postgres:postgres_qa_pw@localhost:55432/atlas_qa"
npx tsx --env-file=.env scripts/run-e2e-tests.ts *> "$env:TEMP\claude\qa-e2e\batterie.log"
```

Le superutilisateur QA est obligatoire : sous `atlas_app` (le `.env`), le lanceur s'arrête sur `permission denied for table lignes_facture` avant toute suite. Il est posé dans le processus de la commande seulement, `.env` inchangé, et ce processus est fermé ensuite.

## Prochaines étapes

1. Rejouer `test-devis-client-e2e.ts` sur la base de `main` (`npx tsx scripts/verifier-rouge-prealable.ts`) pour dire si ce rouge préexiste.
2. Si le patron le demande : corriger le test (attendre le texte avec `waitFor({ state: "visible" })` au lieu de `isVisible()`), selon l'ordre rouge, correction, vert.
3. Jouer les deux suites non mesurables sur une machine Linux (CI ou son espace).
4. Limite toujours ouverte : dans `run-e2e-tests.ts`, le contrôle « port occupé » passe avant `ATLAS_E2E_EXTERNAL_SERVER=1`.
5. Pousser : uniquement avec son accord.

## Fichiers utiles

| | |
|---|---|
| Journal et constats | `QA_EXECUTION_LOG.md`, `QA_FINDINGS.md` (mis à jour) |
| Rapport précédent | `docs/qa-rapport-2026-10-12.md` |
| Sorties (hors dépôt) | `%TEMP%\claude\qa-e2e\batterie.log`, `devis-client.log`, `devis-jeton-inconnu.png` |
