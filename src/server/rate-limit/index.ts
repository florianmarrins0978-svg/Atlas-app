import { getEnv } from "../env";
import { MagasinLimiteMemoire } from "./memoire";
import { MagasinLimiteRedis } from "./redis";
import type { MagasinLimite } from "./types";
export { LIMITES } from "./types";

let magasin: MagasinLimite | null = null;

/**
 * Le magasin de SECOURS, en mémoire, pour les jours où le principal ne répond
 * pas. Créé seulement s'il sert — une installation dont Redis tient n'en a
 * jamais l'usage. Voir `verifierLimite` pour ce qu'il répare.
 */
let secours: MagasinLimiteMemoire | null = null;

function getSecours(): MagasinLimiteMemoire {
  if (!secours) secours = new MagasinLimiteMemoire();
  return secours;
}

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
    // **Un limiteur en panne ne doit JAMAIS mettre le patron dehors — et il ne
    // doit pas non plus ouvrir la porte en grand.**
    //
    // Le 12 août 2026 : *« ça ne marche pas, je n'arrive pas à me connecter »*.
    // Redis était tombé sur son espace. Cet appel levait alors
    // `MaxRetriesPerRequestError`, l'action de connexion mourait avec — et
    // l'écran restait sur la page de connexion, **sans un mot**.
    //
    // La première réparation laissait passer TOUT LE MONDE. Le raisonnement
    // était juste — refuser tout le monde quand son magasin tombe, c'est
    // s'infliger la panne dont on se protégeait — mais la conclusion allait
    // trop loin : l'audit du 23 août 2026 (constat C1) l'a relevée comme la
    // quatrième pièce du bourrage d'identifiants. Il suffisait d'attendre une
    // panne de Redis pour n'avoir plus aucune limite du tout.
    //
    // **Il existait pourtant un troisième terme, et il était déjà dans le
    // dépôt :** le magasin en mémoire. Il ne vaut pas Redis — chaque instance a
    // le sien, donc le compte se divise par le nombre d'instances — mais une
    // protection divisée par trois n'est pas une protection absente. On bascule
    // donc dessus, le temps de la panne. Personne n'est enfermé dehors, et
    // personne n'entre en rafale.
    //
    // **Ce que cela ne suffit PAS à protéger, et qui compte :** la connexion.
    // Elle ne dépend plus de ce magasin — son compteur d'échecs vit en base
    // (`repositories/tentatives-connexion.ts`, migration 0062), précisément
    // pour survivre à ce genre de soirée.
    //
    // Le journal reste bruyant : c'est la seule trace qui dise pourquoi les
    // seuils se comportent autrement ce jour-là.
    // ─────────────────────────────────────────────────────────────────────────
    console.error(
      "[limite] le magasin de limitation n'a pas répondu — bascule sur le compteur EN MÉMOIRE, " +
        "propre à cette instance. La protection reste, dégradée, jusqu'au retour du service.",
      { cle, erreur }
    );
    try {
      resultat = await getSecours().verifierEtIncrementer(cle, limite.max, limite.fenetreMs);
    } catch {
      // Le magasin mémoire ne peut pas échouer ; si l'impossible arrive, on
      // laisse passer plutôt que d'enfermer dehors — c'est la décision du
      // 12 août, et elle reste la bonne en dernier recours.
      return { autorise: true };
    }
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
  secours = null;
  await actuel?.fermer?.();
}

// Réservé aux tests utilisant l'adaptateur mémoire directement.
export function _forcerMagasinPourTests(m: MagasinLimite): void {
  magasin = m;
}
export function _reinitialiserMagasinPourTests(): void {
  magasin = null;
  // Le secours aussi : sans cela, un cas de test qui a fait tomber le magasin
  // principal laisserait ses compteurs au cas suivant, qui rougirait sans que
  // rien ne dise pourquoi.
  secours = null;
}
