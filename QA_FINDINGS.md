QA findings
===========

1) test-pages-publiques-sans-navigation-e2e.ts — native crash
-----------------------------------------------------------------
Symptom classification: NON CLASSÉ — CAUSE À DÉTERMINER / INFRASTRUCTURE WINDOWS-NODE SUSPECTÉE

Symptoms:
- During the suite the Node process crashed with an assertion in libuv: "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 94" and exit code 3221226505.

Reproduction steps (current):
- Run the full battery: `npx tsx --env-file=.env scripts/run-e2e-tests.ts` (the harness will refuse if port 3000 is occupied).
- On 2026-08-31 the failure reproduced during a full run; further isolation is in progress and logs/traces are being collected (see artifacts listed in `QA_EXECUTION_LOG.md`).

Probable causes to investigate:
- Native libuv/Win32 race when destroying handles under heavy load or when the process is killed; could be Playwright/Chromium interaction or a sign of server process shutdown while handles are closing.
- Turbopack/Next dev instability on Windows under the current memory/launch configuration.
- Windows-specific Node runtime issue or test harness race.

Immediate next steps (in progress):
- Reproduce the crash in isolation using `--seulement` for the failing suite while launching the harness with `NODE_OPTIONS="--trace-warnings"` to capture warnings and stack traces.
- Capture the server journal `(tmpdir)/atlas-serveur-e2e.log` and the full terminal output for the isolated run.
- If reproduced, try against a built `next start` server or under WSL/CI to distinguish Windows vs app issue.

Severity: NON CLASSÉ (investigation in progress)

Owner: infra / devops (investigation ongoing)

2) test-tva-au-paiement-e2e.ts — timeout on marking invoice paid
-----------------------------------------------------------------
Symptoms:
- The test times out waiting for a function (Playwright `page.waitForFunction`) after exercising marking an invoice as paid. Single assertion failure recorded.

Reproduction steps:
- Run the single suite: `npx tsx --env-file=.env scripts/run-e2e-tests.ts --seulement test-tva-au-paiement-e2e.ts` or run the file directly.
- Re-run with Playwright tracing and screenshots enabled to capture DOM/console at the moment of failure.

Probable causes:
- Timing/synchronisation issue in the UI (race between state update and client-side rendering) under the dev server compilation or slower test environment.
- Could be a genuine product bug where marking as paid doesn't update the DOM in a deterministic way.

Suggested mitigations:
- Re-run in isolation with increased timeout and Playwright trace to capture the failing condition.
- If timeout is due to slow compilation, ensure prewarm for affected routes or increase test timeout locally.
- If the DOM update is genuinely missing, file a product bug with reproduction steps and failing trace.

Severity: P2

Owner: feature/test author

Forensic correlation notes (2026-08-31):
- Playwright network trace `trace.network` parsed: multiple POSTs to `http://localhost:3000/chantiers/.../prix` and `.../devis-complet` for seven UUIDs between `2026-08-31T10:08:36Z` and `2026-08-31T10:09:23Z`.
- Server journal `(tmpdir)/atlas-serveur-e2e.log` (found at `C:\Users\Flori\AppData\Local\Temp\atlas-serveur-e2e.log`) contains Next.js startup messages and a single `GET /api/health/live` line; file size ~590 bytes and no request lines matching POSTs above.
- Admin DB (`atlas_qa`) queried via admin connection for the seven traced UUIDs returned no `chantiers`, `factures` or `paiements` rows.

Interpretation:
- The absence of matching server log lines for traced POSTs suggests a run-mismatch (the trace was captured from a browser instance that did not talk to the instrumented server process whose stdout was saved) OR the server processed the requests without emitting logs and then did not persist writes (rollbacks or immediate test reset). Given the server journal contents, a run-mismatch is the most probable explanation.

Actionable recommendations:
- Reproduce the failing suite with strict capture:
	- Start the harness with `--only-start-server` and enable verbose application logging (log each incoming request, response status, DB commit/rollback). Ensure `ATLAS_E2E_EXTERNAL_SERVER` is unset so the harness spawns the server and writes to `atlas-serveur-e2e.log`.
	- Run the test with Playwright tracing into the same temporary directory and keep both artifacts.
	- After the run, correlate trace timestamps with server log lines (search by timestamp ±2s and request path) and then query the admin DB for any UUIDs that appear in both the trace and the server logs.
- If logs show request handling but no DB commits, add logging around DB transactions to capture commit/rollback reasons and surface errors.
- If run-mismatch repeats, ensure the test runner and browser use the exact same `ATLAS_URL_PUBLIQUE`/host/port and that no external server overrides the harness spawn.
