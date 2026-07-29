import { and, desc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { historiquePrix } from "../db/schema";
import type { Ctx } from "./context";

export async function enregistrerPrixHistorique(
  ctx: Ctx,
  data: { prestationId: string; prix: string; origine?: "devis" | "manuel" | "import"; devisIdOrigine?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(historiquePrix)
      .values({
        entrepriseId: ctx.entrepriseId,
        prestationId: data.prestationId,
        prix: data.prix,
        origine: data.origine ?? "manuel",
        devisIdOrigine: data.devisIdOrigine,
      })
      .returning();
    return row;
  });
}

export async function listerHistoriquePrix(ctx: Ctx, prestationId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(historiquePrix)
      .where(and(eq(historiquePrix.entrepriseId, ctx.entrepriseId), eq(historiquePrix.prestationId, prestationId)))
      .orderBy(desc(historiquePrix.constateLe))
  );
}

export async function getDernierPrixHistorique(ctx: Ctx, prestationId: string) {
  const liste = await listerHistoriquePrix(ctx, prestationId);
  return liste[0] ?? null;
}
