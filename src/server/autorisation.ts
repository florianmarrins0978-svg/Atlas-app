import { and, eq } from "drizzle-orm";
import { withEntreprise } from "./db/with-entreprise";
import { membresEntreprise } from "./db/schema";
import type { Ctx } from "./repositories/context";

export class AccesRoleRefuseError extends Error {
  constructor(action: string) {
    super(`Action réservée au propriétaire de l'entreprise : ${action}.`);
    this.name = "AccesRoleRefuseError";
  }
}

// Relit le rôle actuel depuis la base à chaque appel (jamais mis en cache,
// jamais fait confiance depuis une donnée transmise par le client) — le rôle
// est scopé par entreprise : un même utilisateur peut être propriétaire d'une
// société et simple membre d'une autre. Passe par withEntreprise() pour fixer
// correctement le contexte RLS (app.entreprise_id) avant la lecture.
export async function getRole(ctx: Ctx): Promise<"proprietaire" | "membre" | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [membre] = await tx
      .select({ role: membresEntreprise.role })
      .from(membresEntreprise)
      .where(and(eq(membresEntreprise.utilisateurId, ctx.utilisateurId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    return membre?.role ?? null;
  });
}

export async function estProprietaire(ctx: Ctx): Promise<boolean> {
  return (await getRole(ctx)) === "proprietaire";
}

// À appeler en tout début des Server Actions réservées au propriétaire
// (gestion des tarifs, suppression de données financières/catalogue,
// gestion des membres et paramètres de l'entreprise). Lève une erreur
// explicite plutôt que de laisser l'action se dérouler silencieusement.
export async function exigerProprietaire(ctx: Ctx, action: string): Promise<void> {
  if (!(await estProprietaire(ctx))) {
    throw new AccesRoleRefuseError(action);
  }
}
