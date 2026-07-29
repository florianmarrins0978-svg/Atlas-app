import { NextResponse } from "next/server";
import { purgerFichiersEnAttente } from "@/server/repositories/fichiers";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { idRequeteValideOuGenere, executerAvecContexte } from "@/server/request-context";

export const dynamic = "force-dynamic";

// Point d'entrée destiné à être appelé par un planificateur externe (cron du
// fournisseur d'hébergement, GitHub Actions schedule, etc.) — jamais exposé
// publiquement sans secret. Comparaison en longueur constante pour éviter une
// attaque par mesure de temps.
function secretValide(requeteSecret: string | null, attendu: string): boolean {
  if (!requeteSecret || requeteSecret.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) {
    diff |= requeteSecret.charCodeAt(i) ^ attendu.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const requestId = idRequeteValideOuGenere(request.headers.get("x-request-id"));
  return executerAvecContexte({ requestId }, async () => {
    const env = getEnv();
    if (!env.cronSecret) {
      logger.error("Tentative d'appel de la purge planifiée sans CRON_SECRET configuré");
      return NextResponse.json({ erreur: "Non configuré." }, { status: 503 });
    }

    const secretRecu = request.headers.get("x-cron-secret");
    if (!secretValide(secretRecu, env.cronSecret)) {
      logger.warn("Tentative d'appel de la purge planifiée avec un secret invalide ou absent");
      return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
    }

    try {
      const nombrePurges = await purgerFichiersEnAttente();
      logger.info("Purge planifiée des fichiers exécutée", { nombrePurges });
      return NextResponse.json({ statut: "ok", nombrePurges });
    } catch (err) {
      logger.error("Échec de la purge planifiée des fichiers", { erreur: err });
      return NextResponse.json({ erreur: "Échec de la purge." }, { status: 500 });
    }
  });
}
