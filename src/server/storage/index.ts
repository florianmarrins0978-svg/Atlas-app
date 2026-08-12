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

  // **`bancDEssai` n'est pas un détail : c'est le correctif du 12 août 2026,
  // et il a coûté au patron son premier envoi de devis.**
  //
  // Il a lu, sur la feuille d'envoi, à la place de son devis :
  //
  //     Stockage local sélectionné en production — configuration refusée
  //
  // Sa configuration était pourtant juste. Cette barrière ne regardait que
  // `nodeEnv === "production"`, alors que le banc d'essai SERT UNE VERSION
  // BÂTIE : `next start` impose `NODE_ENV=production` sans que rien ne soit
  // déployé. `src/server/env.ts` connaît cette distinction depuis le 10 août —
  // `exigencesDeDeploiement = exigencesDeProduction && !bancDEssai`, « les deux
  // seules choses qu'un banc ne peut pas avoir : une clé d'IA facturée et un
  // compartiment S3 ». Ici, on l'ignorait.
  //
  // **Le commentaire qui vivait à cette place affirmait le contraire de la
  // réalité** — « le module d'environnement refuse déjà de démarrer en
  // production » — ce qui est faux sur le banc, et c'est précisément pour cela
  // que personne n'a vu la divergence : la seconde barrière se croyait
  // redondante alors qu'elle était devenue plus stricte que la première.
  //
  // C'est le défaut que `CLAUDE.md` §3 nomme : « Jamais de règle dupliquée…
  // deux implémentations finissent toujours par diverger. » On ne recopie donc
  // plus la règle, on reprend **la même notion** que la configuration.
  //
  // Ce qui n'est PAS relâché : un déploiement réel, lui, exige toujours S3. Le
  // stockage local ne persiste pas entre instances, et un devis envoyé dont le
  // PDF a disparu est pire qu'un envoi refusé.
  const deploiementReel = env.nodeEnv === "production" && !env.bancDEssai;
  if (deploiementReel && env.stockageProvider !== "s3") {
    throw new Error("Stockage local sélectionné en production — configuration refusée (voir src/server/env.ts).");
  }
  return env.stockageProvider === "s3" ? s3 : local;
}

export const enregistrerObjet: typeof local.enregistrerObjet = (...args) => choisi().enregistrerObjet(...args);
export const lireObjet: typeof local.lireObjet = (...args) => choisi().lireObjet(...args);
export const supprimerObjet: typeof local.supprimerObjet = (...args) => choisi().supprimerObjet(...args);
