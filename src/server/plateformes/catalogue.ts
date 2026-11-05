import { getEnv } from "../env";
import type { AdressesPlateforme } from "./api-commune";

/**
 * LES PLATEFORMES AGRÉÉES QU'ATLAS SAIT JOINDRE.
 *
 * **Une plateforme n'est offerte que si son adresse est connue** : l'API
 * commune (XP Z12-013) a une adresse par plateforme, et la deviner enverrait
 * les identifiants de l'artisan ailleurs. Sans adresse, la rubrique
 * « Facture électronique » ne s'affiche pas, comme Ma banque sans banque
 * reliable (`rubriques-reglages.ts`).
 *
 * Pennylane d'abord, sa décision du 26 septembre ; une suivante s'ajoute ici,
 * avec sa clé dans la contrainte de la migration 0165.
 */
export const PLATEFORMES = {
  pennylane: { nom: "Pennylane" },
} as const;

export type ClePlateforme = keyof typeof PLATEFORMES;

export function adressesDe(cle: ClePlateforme): AdressesPlateforme | null {
  const env = getEnv();
  if (cle === "pennylane") {
    return env.pennylaneFluxUrl ? { flux: env.pennylaneFluxUrl, jeton: env.pennylaneJetonUrl ?? null } : null;
  }
  return null;
}

/** Celles qu'un artisan peut relier aujourd'hui, dans l'ordre du catalogue. */
export function plateformesOffertes(): ClePlateforme[] {
  return (Object.keys(PLATEFORMES) as ClePlateforme[]).filter((c) => adressesDe(c) !== null);
}

export function estUnePlateforme(cle: string): cle is ClePlateforme {
  return Object.prototype.hasOwnProperty.call(PLATEFORMES, cle);
}
