import { NextResponse } from "next/server";
import { pool } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { idRequeteValideOuGenere, executerAvecContexte } from "@/server/request-context";

export const dynamic = "force-dynamic";

// Readiness : vérifie les dépendances nécessaires pour servir du trafic.
// Timeout court pour ne jamais bloquer un contrôle de santé indéfiniment.
// Aucune valeur de configuration, secret, URL ou trace technique n'est
// jamais renvoyée — uniquement un statut par dépendance.
export async function GET(request: Request) {
  const requestId = idRequeteValideOuGenere(request.headers.get("x-request-id"));
  return executerAvecContexte({ requestId }, async () => {
    const resultats: Record<string, "ok" | "echec"> = {};
    let pret = true;

    try {
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      resultats.base_de_donnees = "ok";
    } catch (err) {
      resultats.base_de_donnees = "echec";
      pret = false;
      logger.error("Readiness : PostgreSQL indisponible", { erreur: err });
    }

    try {
      const env = getEnv();
      resultats.stockage_configure = env.stockageProvider === "s3" && env.s3 ? "ok" : env.stockageProvider === "local" ? "ok" : "echec";
    } catch (err) {
      resultats.stockage_configure = "echec";
      pret = false;
      logger.error("Readiness : configuration invalide", { erreur: err });
    }

    return NextResponse.json(
      { statut: pret ? "pret" : "indisponible", dependances: resultats },
      { status: pret ? 200 : 503, headers: { "x-request-id": requestId } }
    );
  });
}
