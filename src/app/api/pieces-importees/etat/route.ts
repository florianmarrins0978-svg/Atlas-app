import { NextResponse, after } from "next/server";
import { patronQuiImporte } from "@/server/import/garde";
import { envoiEnCours } from "@/server/repositories/pieces-importees";
import { traiterPiecesEnAttente } from "@/server/import/traiter-pieces";
import { logger } from "@/server/logger";

// Où en est l'envoi : la bande de « Vos clients » et l'écran de lecture la
// relisent toutes les deux secondes.
//
// **Chaque coup d'œil relance la lecture** : un serveur redémarré au milieu
// d'un envoi reprend ses pièces à la prochaine ouverture de l'appli, sans
// planificateur (`traiter-pieces.ts`).

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await patronQuiImporte();
  if (!ctx) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const etat = await envoiEnCours(ctx);
  if (etat && etat.recues > etat.lues) {
    after(async () => {
      try {
        await traiterPiecesEnAttente(ctx);
      } catch (err) {
        logger.error("Reprise de la lecture des pièces importées impossible", { erreur: err instanceof Error ? err.message : String(err) });
      }
    });
  }
  return NextResponse.json({ etat }, { headers: { "Cache-Control": "no-store" } });
}
