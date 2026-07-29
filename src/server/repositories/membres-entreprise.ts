import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { membresEntreprise } from "../db/schema";
import type { Ctx } from "./context";

export async function listerMembres(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(membresEntreprise).where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId))
  );
}

export async function ajouterMembre(ctx: Ctx, utilisateurId: string, role: "proprietaire" | "membre" = "membre") {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(membresEntreprise)
      .values({ entrepriseId: ctx.entrepriseId, utilisateurId, role })
      .returning();
    return row;
  });
}

export async function retirerMembre(ctx: Ctx, utilisateurId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .delete(membresEntreprise)
      .where(eq(membresEntreprise.utilisateurId, utilisateurId));
  });
}
