import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { parametresChiffrage } from "../db/schema";
import type { Ctx } from "./context";

// Un seul jeu de paramètres par entreprise. Créé avec les valeurs par défaut
// dès la première consultation si l'entreprise ne les a pas encore ajustées.
export async function getOuCreerParametresChiffrage(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existant] = await tx
      .select()
      .from(parametresChiffrage)
      .where(eq(parametresChiffrage.entrepriseId, ctx.entrepriseId))
      .limit(1);
    if (existant) return existant;

    const [cree] = await tx
      .insert(parametresChiffrage)
      .values({ entrepriseId: ctx.entrepriseId })
      .onConflictDoNothing({ target: parametresChiffrage.entrepriseId })
      .returning();
    if (cree) return cree;

    // Conflit de concurrence (rare) : une autre requête l'a créé entre-temps.
    const [relu] = await tx
      .select()
      .from(parametresChiffrage)
      .where(eq(parametresChiffrage.entrepriseId, ctx.entrepriseId))
      .limit(1);
    return relu;
  });
}

export async function mettreAJourParametresChiffrage(
  ctx: Ctx,
  data: Partial<{
    coutJournalierOuvrier: string;
    coutJournalierChefEquipe: string;
    coutDeplacement: string;
    margeCiblePourcent: string;
    tauxTvaDefaut: string;
  }>
) {
  await getOuCreerParametresChiffrage(ctx); // garantit l'existence de la ligne
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(parametresChiffrage)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(parametresChiffrage.entrepriseId, ctx.entrepriseId))
      .returning();
    return row;
  });
}
