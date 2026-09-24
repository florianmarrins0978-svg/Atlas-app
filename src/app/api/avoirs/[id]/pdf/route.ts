import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { pdfDeLAvoir } from "@/server/repositories/avoirs";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";
import { logger } from "@/server/logger";

/**
 * Le PDF d'un avoir, tel qu'il a été composé à sa naissance et jamais depuis.
 *
 * Même porte que celle de la facture (`/api/factures/[id]/pdf`) : fermée au
 * commercial par `FACTURE_DU_CHANTIER` (`src/lib/acces-roles.ts`), et la RLS ne
 * laisse lire que ceux de l'entreprise.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  let avoir: Awaited<ReturnType<typeof pdfDeLAvoir>>;
  try {
    avoir = await pdfDeLAvoir(ctx, id);
  } catch (err) {
    // Le fichier manque au stockage : on le dit au journal, et l'écran reçoit
    // un « introuvable » plutôt qu'un identifiant opaque.
    logger.error("PDF d'avoir illisible", { avoirId: id, erreur: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
  if (!avoir) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 });

  return new NextResponse(new Uint8Array(avoir.pdf), {
    headers: enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: `${avoir.numero}.pdf`, type: "application/pdf" }),
  });
}
