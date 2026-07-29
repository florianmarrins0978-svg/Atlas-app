import { getEnv } from "../env";
import { MagasinLimiteMemoire } from "./memoire";
import { MagasinLimiteRedis } from "./redis";
import type { MagasinLimite } from "./types";
export { LIMITES } from "./types";

let magasin: MagasinLimite | null = null;

function getMagasin(): MagasinLimite {
  if (magasin) return magasin;
  const env = getEnv();

  if (env.nodeEnv === "production") {
    if (!env.redisUrl) {
      throw new Error(
        "REDIS_URL manquant en production : la limitation de débit en mémoire n'est jamais autorisée en production (non partagée entre instances)."
      );
    }
    magasin = new MagasinLimiteRedis(env.redisUrl);
  } else {
    magasin = env.redisUrl ? new MagasinLimiteRedis(env.redisUrl) : new MagasinLimiteMemoire();
  }
  return magasin;
}

export type ResultatVerificationLimite =
  | { autorise: true }
  | { autorise: false; message: string; retryAfterSecondes: number };

// Point d'appel unique pour toute action à protéger. `cle` doit déjà
// combiner l'identité pertinente (utilisateur, entreprise, IP) — voir les
// points d'appel pour la construction de clé propre à chaque usage.
export async function verifierLimite(
  cle: string,
  limite: { max: number; fenetreMs: number }
): Promise<ResultatVerificationLimite> {
  const resultat = await getMagasin().verifierEtIncrementer(cle, limite.max, limite.fenetreMs);
  if (resultat.autorise) return { autorise: true };
  return {
    autorise: false,
    message: "Trop de tentatives. Réessayez dans quelques instants.",
    retryAfterSecondes: Math.ceil(resultat.retryAfterMs / 1000),
  };
}

// Réservé aux tests utilisant l'adaptateur mémoire directement.
export function _forcerMagasinPourTests(m: MagasinLimite): void {
  magasin = m;
}
export function _reinitialiserMagasinPourTests(): void {
  magasin = null;
}
