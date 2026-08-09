import { getEnv } from "../env";
import * as local from "./local-storage";
import * as s3 from "./s3-storage";

export type { ObjetStocke } from "./local-storage";

/**
 * Le stockage choisi, résolu **au premier usage** et pas à l'import.
 *
 * **Ce que l'ancienne version cassait, trouvé le 9 août 2026 en tentant de
 * bâtir l'application.** La configuration s'appelait ici au niveau du module :
 * `const env = getEnv()`. Or `next build` importe chaque module pour collecter
 * les données de page, avec `NODE_ENV=production` — donc tous les refus de
 * `src/server/env.ts` s'appliquaient **à la construction** :
 *
 *     ErreurConfiguration: LLM_PROVIDER vaut « dev » en production…
 *     Failed to collect page data for /api/agenda/google/retour
 *
 * Autrement dit : **impossible de bâtir l'application sans détenir les secrets
 * de production** — une clé d'IA facturée, un compartiment S3, un secret de
 * tâche planifiée. Ni la CI, ni le banc d'essai, ni personne cherchant
 * simplement à mesurer la vitesse ne pouvaient produire une version optimisée.
 * Bâtir n'est pas déployer : les deux ne doivent pas exiger la même chose.
 *
 * `getEnv()` était pourtant déjà conçu pour cela — « Lazy + mémoïsé : validé au
 * premier accès » dit son propre commentaire. Ce module était le seul à le
 * contredire, et c'est ce qui a fait tomber la construction entière.
 *
 * La seconde barrière contre le stockage local en production, elle, reste
 * entière : elle se contente d'attendre qu'on stocke vraiment quelque chose.
 */
function choisi() {
  const env = getEnv();
  // Le module d'environnement (src/server/env.ts) refuse déjà de démarrer en
  // production si STORAGE_PROVIDER n'est pas "s3" — répété ici comme seconde
  // barrière, au point d'usage réel du stockage.
  if (env.nodeEnv === "production" && env.stockageProvider !== "s3") {
    throw new Error("Stockage local sélectionné en production — configuration refusée (voir src/server/env.ts).");
  }
  return env.stockageProvider === "s3" ? s3 : local;
}

export const enregistrerObjet: typeof local.enregistrerObjet = (...args) => choisi().enregistrerObjet(...args);
export const lireObjet: typeof local.lireObjet = (...args) => choisi().lireObjet(...args);
export const supprimerObjet: typeof local.supprimerObjet = (...args) => choisi().supprimerObjet(...args);
