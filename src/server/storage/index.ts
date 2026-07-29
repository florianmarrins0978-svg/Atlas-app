import { getEnv } from "../env";
import * as local from "./local-storage";
import * as s3 from "./s3-storage";

export type { ObjetStocke } from "./local-storage";

// Le module d'environnement (src/server/env.ts) refuse déjà de démarrer en
// production si STORAGE_PROVIDER n'est pas "s3" — répété ici comme seconde
// barrière, au point d'usage réel du stockage.
const env = getEnv();
if (env.nodeEnv === "production" && env.stockageProvider !== "s3") {
  throw new Error("Stockage local sélectionné en production — configuration refusée (voir src/server/env.ts).");
}

const implementation = env.stockageProvider === "s3" ? s3 : local;

export const enregistrerObjet = implementation.enregistrerObjet;
export const lireObjet = implementation.lireObjet;
export const supprimerObjet = implementation.supprimerObjet;
