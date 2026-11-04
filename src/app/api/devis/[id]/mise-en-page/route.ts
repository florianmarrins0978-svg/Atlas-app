import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { getRole } from "@/server/autorisation";
import { withEntreprise } from "@/server/db/with-entreprise";
import { devis } from "@/server/db/schema";
import { getOuCreerDevisBrouillon, miseEnPageDuDevis } from "@/server/repositories/devis";
import { peutGererDevis } from "@/lib/acces-roles";

/**
 * Où chaque ligne du devis est tombée dans son aperçu : sa planche du
 * 3 novembre 2026, « Touchez une ligne pour commencer une nouvelle page à cet
 * endroit ».
 *
 * **La même composition que la route du PDF**, brouillon resynchronisé
 * d'abord : l'aperçu peint un PDF et touche des lignes qui doivent être
 * exactement les siennes. Une mise en page lue sur un autre état du devis
 * ferait couper une ligne voisine de celle qu'il a touchée.
 *
 * `modifiable` porte aussi son rôle : un rôle qui ouvre le devis sans pouvoir
 * le gérer le voit, sans rien à toucher (l'action le refuserait).
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const d = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .select({ chantierId: devis.chantierId, statut: devis.statut })
      .from(devis)
      .where(eq(devis.id, id))
      .limit(1);
    return row ?? null;
  });
  if (!d) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  if (d.statut === "brouillon") await getOuCreerDevisBrouillon(ctx, d.chantierId);
  const mise = await miseEnPageDuDevis(ctx, id);
  const role = await getRole(ctx);
  const modifiable = mise.modifiable && !!role && peutGererDevis(role);
  return NextResponse.json(
    { ...mise, modifiable, elements: modifiable ? mise.elements : [], espaces: modifiable ? mise.espaces : [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
