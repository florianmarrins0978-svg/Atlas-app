import { getEnv } from "../env";
import { chiffrerSous, dechiffrerSous, type DomaineSecret } from "@/lib/chiffre-au-repos";

/**
 * Chiffrer un secret avant de l'écrire en base, et le relire, sous la clé de
 * l'application (`AUTH_SECRET`). La règle et son pourquoi vivent dans
 * `src/lib/chiffre-au-repos.ts`.
 */
export function chiffrer(clair: string, domaine: DomaineSecret = "agenda"): string {
  return chiffrerSous(getEnv().authSecret, clair, domaine);
}

export function dechiffrer(chiffre: string, domaine: DomaineSecret = "agenda"): string | null {
  return dechiffrerSous(getEnv().authSecret, chiffre, domaine);
}
