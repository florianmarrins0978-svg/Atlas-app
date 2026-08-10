/**
 * « Vous lancez l'atelier » — l'avertissement, écrit UNE fois et testable.
 *
 * **Pourquoi il existe.** Le 10 août 2026, le patron a tapé `npm run essai` dans
 * son espace GitHub et regardé « toujours en compilation » pendant plus de trois
 * minutes — sur `/api/health/live`, la plus petite route du dépôt. Rien n'était
 * cassé : `next dev` compile chaque écran au moment où on l'ouvre, et le disque
 * d'un espace distant est lent (le journal l'écrit lui-même : « Slow filesystem
 * detected »). Chaque écran suivant lui aurait coûté la même attente.
 *
 * C'est la troisième fois que la lenteur du mode développement lui coûte une
 * soirée, et les deux premières ont produit `npm run banc` (`ARCHITECTURE.md`
 * §45). Le dépôt savait, et ne le disait pas.
 *
 * **Dans un module plutôt qu'enfoui dans `essai.mjs`** : un message enfoui n'est
 * jamais vu échouer. Celui-ci est éprouvé par `scripts/test-annonce-atelier.ts`.
 */

/**
 * Rend le texte à afficher, ou `null` quand il n'y a rien à dire.
 *
 * L'avertissement ne vaut que sur un espace distant : en local, `next dev`
 * compile en quelques centaines de millisecondes, le rechargement à chaud est
 * précisément ce qu'on veut, et détourner vers le banc serait un mauvais
 * conseil.
 *
 * Le type est réduit à ce qui est réellement lu : hériter de `ProcessEnv`
 * obligerait chaque appel d'essai à fabriquer un environnement complet, pour
 * n'en regarder qu'une variable.
 *
 * @param {{ CODESPACE_NAME?: string }} [env]
 * @returns {string | null}
 */
export function avertissementAtelier(env = process.env) {
  if (!env.CODESPACE_NAME) return null;
  return (
    "\n  ─────────────────────────────────────────────────────────────\n" +
    "   Vous lancez l'ATELIER : chaque écran se compile à l'ouverture,\n" +
    "   et sur un espace distant cela prend des minutes — à chaque écran.\n\n" +
    "   Pour vous SERVIR d'Atlas, arrêtez ceci (Ctrl+C) et lancez :\n\n" +
    "     npm run banc\n\n" +
    "   Il bâtit une fois, puis chaque écran s'ouvre du premier coup.\n" +
    "   (Et l'espace le lance déjà tout seul à chaque allumage : si vous\n" +
    "    avez dû taper quelque chose, le journal /tmp/essai.log dit pourquoi.)\n" +
    "  ─────────────────────────────────────────────────────────────\n"
  );
}
