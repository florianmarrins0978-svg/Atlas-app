import { and, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { clients } from "../db/schema";
import type { Ctx } from "./context";

export async function listerClients(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(clients).where(isNull(clients.deletedAt))
  );
}

export async function getClient(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function creerClient(ctx: Ctx, data: { nom: string; telephone?: string; adresse?: string }) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ entrepriseId: ctx.entrepriseId, ...data, createdBy: ctx.utilisateurId })
      .returning();
    return row;
  });
}
