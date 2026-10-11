import { Pool, types } from "pg";
import type { TypeId } from "pg-types";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getEnv } from "../env";
import { logger } from "../logger";

// Singleton — une seule instance de pool sur tout le cycle de vie du process.
// En développement (rechargement à chaud de Next.js), on le rattache à globalThis
// pour éviter d'ouvrir un nouveau pool à chaque rechargement de module.

declare global {
  var __atlasPgPool: Pool | undefined;
}

// **Une colonne `date` est un JOUR, pas un instant — et le pilote l'oubliait.**
//
// `pg` rend une `date` en objet `Date` posé à minuit dans le fuseau du
// processus. Relue par `toISOString()`, elle recule d'un jour partout à l'est
// de Greenwich : minuit à Paris est 22 h la veille en UTC. Drizzle se protège
// déjà pour ses propres requêtes (il rend `date`, `timestamp` et `date[]` en
// texte) ; le `pool` exporté plus bas, lui, gardait le comportement du pilote,
// et quatre suites rougissaient d'un jour sur tout PC à l'heure de Paris —
// vertes en UTC, où tournent la CI et son espace (13 septembre 2026).
//
// La règle vit donc au pilote, une fois : `date` et `date[]` arrivent en
// « AAAA-MM-JJ », le format que `src/lib/jour.ts` attend et que la base rend.
// Les horodatages (`timestamptz`) ne sont pas touchés : eux sont des instants.
// Le tableau se lit avec l'analyseur de `text[]` — même syntaxe, et l'on
// n'ajoute aucune dépendance pour le découper. Les deux identifiants de
// tableau ne figurent pas dans `types.builtins`, d'où les nombres.
const OID_DATE_ARRAY = 1182 as TypeId;
const OID_TEXT_ARRAY = 1009 as TypeId;
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(OID_DATE_ARRAY, types.getTypeParser(OID_TEXT_ARRAY));

function creerPool(): Pool {
  const pool = new Pool({
    connectionString: getEnv().databaseUrl,
    // **Le nombre de connexions simultanées à la base, et c'est un plafond.**
    //
    // Écrit en dur à 10, il tenait tant qu'une seule machine servait un seul
    // artisan. À dix mille, ce chiffre se règle : trop bas, les requêtes font
    // la queue alors que la base s'ennuie ; trop haut, c'est PostgreSQL qui
    // s'écroule, chaque connexion lui coûtant de la mémoire.
    //
    // La règle habituelle : (nombre d'instances × max) doit rester sous la
    // limite de connexions de la base, et au-delà de quelques dizaines
    // d'instances, on met un répartiteur (PgBouncer) devant plutôt que
    // d'augmenter ce nombre.
    max: getEnv().poolMax,
  });

  // Remédiation (robustesse) : sans ce gestionnaire, une erreur sur un client
  // inactif du pool (connexion coupée par le réseau/la base) devient une
  // exception non interceptée qui peut faire planter tout le process Node —
  // comportement documenté de `pg`. Jamais de secret dans le message journalisé.
  pool.on("error", (err) => {
    logger.error("Erreur inattendue sur une connexion inactive du pool PostgreSQL", { erreur: err });
  });

  return pool;
}

export const pool = globalThis.__atlasPgPool ?? creerPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__atlasPgPool = pool;
}

// Arrêt contrôlé du pool. Le runtime cible (Next.js sur Node.js, déploiement
// conteneurisé classique) reçoit un SIGTERM géré par la plateforme
// d'orchestration ; Next.js lui-même ne garantit pas d'exécuter un hook de
// cycle de vie applicatif à l'arrêt de manière portable entre tous les modes
// de déploiement (serverless vs serveur long-lived). Cette fonction est donc
// exposée pour être appelée explicitement par un point d'entrée de processus
// long-lived (ex. un serveur custom, ou un script d'arrêt du déploiement) —
// elle n'est volontairement PAS câblée à process.on("SIGTERM") ici, pour ne
// pas interférer avec la gestion de cycle de vie déjà assurée par la
// plateforme d'hébergement dans les modes serverless.
export async function fermerPool(): Promise<void> {
  await pool.end();
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
// Type couvrant aussi bien `db` que le `tx` reçu dans db.transaction(async (tx) => ...)
// — nécessaire pour que les fonctions de repository acceptent indifféremment l'un ou l'autre.
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
