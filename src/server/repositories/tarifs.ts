import { and, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { tarifs } from "../db/schema";
import type { Ctx } from "./context";

export async function listerTarifs(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(tarifs).where(isNull(tarifs.deletedAt))
  );
}

// Relit le prix ACTUEL du tarif — jamais celui mémorisé dans une proposition
// potentiellement ancienne (remédiation : ne jamais persister un montant sans
// le revérifier côté serveur au moment de la confirmation).
export async function getTarif(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(tarifs)
      .where(and(eq(tarifs.id, id), isNull(tarifs.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function creerTarif(ctx: Ctx, data: { intitule: string; prix: string; unite?: string }) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(tarifs)
      .values({ entrepriseId: ctx.entrepriseId, ...data })
      .returning();
    return row;
  });
}

export async function modifierTarif(ctx: Ctx, id: string, data: { intitule?: string; prix?: string; unite?: string }) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(tarifs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tarifs.id, id), isNull(tarifs.deletedAt)))
      .returning();
    return row;
  });
}

export async function supprimerTarif(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(tarifs)
      .set({ deletedAt: new Date() })
      .where(and(eq(tarifs.id, id), isNull(tarifs.deletedAt)));
  });
}
