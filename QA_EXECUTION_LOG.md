QA execution log
=================

Date: 2026-08-31

Command: `npx tsx --env-file=.env scripts/run-e2e-tests.ts`

Summary:
- Most E2E suites passed under the adjusted Windows-compatible harness.
- Two suites failed or crashed during the run:
  - `test-pages-publiques-sans-navigation-e2e.ts` — process crashed with native assertion (UV handle closing), exit code 3221226505. Likely runtime/Node/Playwright interop or server instability on Windows.
  - `test-tva-au-paiement-e2e.ts` — one assertion timed out (`page.waitForFunction` timeout) while exercising marking an invoice as paid.

Artifacts:
- Full terminal output (large):
  c:\Users\Flori\AppData\Roaming\Code\User\workspaceStorage\708f56566d7cb39d7073238487ef2aa8\GitHub.copilot-chat\chat-session-resources\f1694749-ecd5-42ca-bb6c-1d4a64fd6918\call_HW5TOwKt3LhKZwThkqXuI183__vscode-1788124938642\content.txt
- Copied terminal output (backup):
  c:\Users\Flori\AppData\Roaming\Code\copilot-terminal-output\copilot-terminal-output-69dec3cd-4e3a-47fb-9c3d-e2e8e3488479.txt
- Server journal (rotating tmp file used by harness):
  (tmpdir)/atlas-serveur-e2e.log  — check local temp during reproduce run

Notes:
- Before the battery the port 3000 was occupied by an orphan dev server; the harness refused to run until it was cleared. This prevented false results.

Next actions (short):
1. Investigate and reproduce the native crash in `test-pages-publiques-sans-navigation-e2e.ts` (capture Node stack, run with `--trace-warnings`, try `node --inspect` or run under WSL/CI to compare). Owner: infra.
2. Re-run `test-tva-au-paiement-e2e.ts` in isolation with Playwright tracing, screenshots and increased timeouts to capture UI timing. Owner: test author.
3. Once fixes or mitigations are applied, re-run the full battery and merge results into this log.

Forensic correlation (2026-08-31):
- Action: parsed Playwright `trace.network` (C:\Users\Flori\AppData\Local\Temp\trace-tva-e2e\trace.network) for POST/PUT requests and UUIDs, inspected server journal `(tmpdir)/atlas-serveur-e2e.log`, and queried `atlas_qa` via admin connection for traced UUIDs.
- Findings: trace shows repeated POSTs to `/chantiers/<uuid>/prix` and `/chantiers/<uuid>/devis-complet` between `2026-08-31T10:08:36Z` and `2026-08-31T10:09:23Z` for seven UUIDs. The server journal contains only startup lines and a single `GET /api/health/live` entry (the journal is ~590 bytes). Admin DB queries for the seven UUIDs returned no matching `chantiers`, `factures` or `paiements` rows.
- Interim conclusion: no server-side evidence of request handling or DB writes was found for the trace slice. Two likely explanations remain: (A) the browser trace belongs to a run that did not reach the same server process whose stdout was captured in the journal (mismatch of runs/instances), or (B) the server processed requests but did not persist writes (transaction rollbacks or silent failures) and did not emit log lines for them. Current evidence favours (A) because the server journal lacks any request lines matching the trace timestamps.
- Recommended immediate steps: re-run the isolated `test-tva-au-paiement-e2e.ts` with the harness in `--only-start-server` mode, enable verbose server/application logging (so each request and DB commit/rollback is logged), keep the journal file (do not rotate), and collect the Playwright trace in the same run for deterministic correlation. Owner: test author + infra.

Run 2026-10-12 (après fusion de main dans qa/campagne, commit d042d9b7)
-----------------------------------------------------------------------

Préalables : `atlas-qa-postgres` et `atlas-qa-redis` Up, `npm run qa:preuve` 15/15 vert.

Command (DATABASE_URL superutilisateur QA posé pour cette seule commande, `.env` inchangé) :

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres_qa_pw@localhost:55432/atlas_qa"
npx tsx --env-file=.env scripts/run-e2e-tests.ts *> "$env:TEMP\claude\qa-e2e\batterie.log"
```

Pourquoi ce rôle : sous `atlas_app` (le `.env`), le lanceur s'arrête avant toute suite, sur l'amorçage de la base : `permission denied for table lignes_facture`, puis `❌ Impossible de lancer le seed de la base de développement (code: 1)`.

Résultat : **180/183 suites réussies. 2 non mesurables ici. 1 rouge.**

| Suite | Verdict | Ligne d'erreur |
|---|---|---|
| `test-devis-client-e2e.ts` | rouge (16 réussis, 1 échoué) | `❌ un jeton inconnu ne révèle rien au visiteur` : `le message générique n'est pas affiché` |
| `test-bandeau-banc-e2e.ts` | non mesurable | `« npx » est absent de cette machine` (Windows) |
| `test-connexion-service-en-panne-e2e.ts` | non mesurable | `« bash » est absent de cette machine` (Windows) |

Les deux constats du 31 août sont verts dans la batterie complète : `test-tva-au-paiement-e2e.ts` 9/9, `test-pages-publiques-sans-navigation-e2e.ts` 0 échec, aucun plantage natif. Ils avaient aussi été verts rejoués seuls plus tôt le même jour.

Rejeu seul de `test-devis-client-e2e.ts` : rouge encore, 15 réussis et 2 échoués (le même, plus `le client voit son devis sans être connecté` : `émetteur absent`). Analyse dans `QA_FINDINGS.md` §3.

Artifacts (hors dépôt, peuvent disparaître) : `%TEMP%\claude\qa-e2e\batterie.log`, `devis-client.log`, `devis-jeton-inconnu.png`.
