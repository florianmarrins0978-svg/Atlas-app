import { and, asc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { prestations } from "../db/schema";
import type { Ctx } from "./context";

export async function listerPrestations(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(prestations).where(eq(prestations.chantierId, chantierId)).orderBy(asc(prestations.ordre))
  );
}

export async function ajouterPrestation(ctx: Ctx, chantierId: string, libelle: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx.select().from(prestations).where(eq(prestations.chantierId, chantierId));
    const [row] = await tx
      .insert(prestations)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, libelle, ordre: existantes.length })
      .returning();
    return row;
  });
}

export async function modifierPrestation(ctx: Ctx, id: string, libelle: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(prestations)
      .set({ libelle, updatedAt: new Date() })
      .where(eq(prestations.id, id))
      .returning();
    return row;
  });
}

export async function supprimerPrestation(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(prestations).where(eq(prestations.id, id));
  });
}

// Réordonnancement — capacité disponible et testée au niveau repository ; aucun
// contrôle visuel de réorganisation n'existe encore sur cet écran (aucune
// maquette validée n'en prévoit un), voir compte rendu du lot.
export async function reordonnerPrestations(ctx: Ctx, chantierId: string, idsEnOrdre: string[]) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (let i = 0; i < idsEnOrdre.length; i++) {
      await tx
        .update(prestations)
        .set({ ordre: i, updatedAt: new Date() })
        .where(and(eq(prestations.id, idsEnOrdre[i]), eq(prestations.chantierId, chantierId)));
    }
  });
}
