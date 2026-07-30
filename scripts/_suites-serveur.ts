// Suites qui interrogent l'application par HTTP et exigent donc un serveur
// démarré : run-all-tests les écarte, run-e2e-tests les exécute une fois le
// serveur prêt. Liste unique — la dupliquer, c'est laisser une suite tomber
// dans l'intervalle et échouer sur un ECONNREFUSED.
export const SUITES_SERVEUR = ["test-health.ts", "test-cron-purge.ts", "test-security-headers.ts"];
