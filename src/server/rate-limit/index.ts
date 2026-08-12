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
  let resultat;
  try {
    resultat = await getMagasin().verifierEtIncrementer(cle, limite.max, limite.fenetreMs);
  } catch (erreur) {
    // ─────────────────────────────────────────────────────────────────────────
    // **Un limiteur en panne ne doit JAMAIS mettre le patron dehors.**
    //
    // Le 12 août 2026 : *« ça ne marche pas, je n'arrive pas à me connecter »*.
    // Redis était tombé sur son espace. Cet appel levait alors
    // `MaxRetriesPerRequestError`, l'action de connexion mourait avec — et
    // l'écran restait sur la page de connexion, **sans un mot**. Rien ne
    // pouvait lui dire que ce n'était ni son mot de passe ni son compte, mais
    // un service annexe couché.
    //
    // Le raisonnement, et il vaut d'être écrit : la limitation protège d'un
    // ABUS. Refuser tout le monde quand son magasin tombe, ce n'est pas
    // protéger — c'est infliger soi-même la panne dont on se protégeait, et la
    // première victime est celui qui a le droit d'entrer.
    //
    // **Ce que cela coûte, dit franchement :** pendant la panne du magasin, la
    // protection contre les essais de mots de passe en rafale n'existe plus.
    // C'est un risque accepté et BORNÉ — il ne dure que la panne — contre une
    // certitude : sans cela, l'artisan est enfermé dehors, et il n'a aucun
    // moyen de le comprendre.
    //
    // Le journal, lui, est bruyant : c'est la seule trace qui reste, et c'est
    // elle qui doit permettre de nommer la cause du premier coup.
    // ─────────────────────────────────────────────────────────────────────────
    console.error(
      "[limite] le magasin de limitation n'a pas répondu — la demande est LAISSÉE PASSER " +
        "pour ne pas enfermer l'utilisateur dehors. La protection contre les rafales est " +
        "suspendue jusqu'au retour du service.",
      { cle, erreur }
    );
    return { autorise: true };
  }
  if (resultat.autorise) return { autorise: true };
  return {
    autorise: false,
    message: "Trop de tentatives. Réessayez dans quelques instants.",
    retryAfterSecondes: Math.ceil(resultat.retryAfterMs / 1000),
  };
}

/**
 * Ferme la connexion du limiteur, s'il en a ouvert une.
 *
 * **Le défaut du 8 août 2026, et il ne se voyait nulle part.** Avec `REDIS_URL`
 * posé — ce que `CLAUDE.md` §5 demande, et ce que fait la CI —, une suite qui
 * déclenche une action limitée laissait une connexion ioredis ouverte. Le
 * processus ne rendait alors jamais la main : `test-ia-03-propositions.ts`
 * affichait « 8 test(s) réussi(s) » puis restait là, et **`npm test` s'arrêtait
 * de progresser pour toujours**.
 *
 * Aucun test n'échouait : c'est le pire des états. La batterie ne disait pas
 * « rouge », elle ne disait plus rien — et une batterie qui ne finit pas ne
 * prouve rien de ce qu'elle n'a pas atteint.
 *
 * À appeler en fin de suite, comme `pool.end()`.
 */
export async function fermerLimiteur(): Promise<void> {
  const actuel = magasin;
  magasin = null;
  await actuel?.fermer?.();
}

// Réservé aux tests utilisant l'adaptateur mémoire directement.
export function _forcerMagasinPourTests(m: MagasinLimite): void {
  magasin = m;
}
export function _reinitialiserMagasinPourTests(): void {
  magasin = null;
}
