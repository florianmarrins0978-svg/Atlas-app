import { and, asc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { materiel } from "../db/schema";
import type { Ctx } from "./context";

export async function listerMateriel(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(materiel).where(eq(materiel.chantierId, chantierId)).orderBy(asc(materiel.ordre))
  );
}

export async function ajouterMateriel(ctx: Ctx, chantierId: string, libelle: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existants = await tx.select().from(materiel).where(eq(materiel.chantierId, chantierId));
    const [row] = await tx
      .insert(materiel)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, libelle, ordre: existants.length })
      .returning();
    return row;
  });
}

export async function modifierMateriel(ctx: Ctx, id: string, libelle: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(materiel)
      .set({ libelle, updatedAt: new Date() })
      .where(eq(materiel.id, id))
      .returning();
    return row;
  });
}

export async function supprimerMateriel(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(materiel).where(eq(materiel.id, id));
  });
}

// Réordonnancement — capacité disponible et testée au niveau repository ; aucun
// contrôle visuel de réorganisation n'existe encore sur cet écran, voir compte
// rendu du lot.
export async function reordonnerMateriel(ctx: Ctx, chantierId: string, idsEnOrdre: string[]) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (let i = 0; i < idsEnOrdre.length; i++) {
      await tx
        .update(materiel)
        .set({ ordre: i, updatedAt: new Date() })
        .where(and(eq(materiel.id, idsEnOrdre[i]), eq(materiel.chantierId, chantierId)));
    }
  });
}
