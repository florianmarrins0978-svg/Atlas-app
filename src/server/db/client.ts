import { Pool } from "pg";
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

function creerPool(): Pool {
  const pool = new Pool({
    connectionString: getEnv().databaseUrl,
    max: 10,
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
