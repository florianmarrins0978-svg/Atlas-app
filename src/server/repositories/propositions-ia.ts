import { and, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { propositionsIa } from "../db/schema";
import type { Ctx } from "./context";
import type { ActionProposee } from "../ai/propositions";

// Persiste chaque proposition générée par l'assistant, avec une identité
// serveur stable. Le client ne reverra jamais ces données modifiables — à la
// confirmation, il ne renvoie que l'id, jamais le contenu (montant compris).
export async function enregistrerPropositions(
  ctx: Ctx,
  // `null` quand le geste ne concerne aucun chantier — créer un chantier,
  // régler un tarif, corriger un client (migration 0067).
  chantierId: string | null,
  propositions: ActionProposee[]
) {
  if (propositions.length === 0) return [];
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .insert(propositionsIa)
      .values(
        propositions.map((p) => ({
          entrepriseId: ctx.entrepriseId,
          chantierId,
          type: p.type,
          description: p.description,
          donnees: p.donnees,
        }))
      )
      .returning();
  });
}

export type PropositionIaStockee = {
  id: string;
  chantierId: string | null;
  type: string;
  description: string;
  donnees: Record<string, unknown>;
  statut: "proposee" | "appliquee" | "expiree";
};

// Réclamation atomique : ne passe 'proposee' -> 'appliquee' que si c'est
// encore l'état actuel. Une seule requête peut réussir cette transition pour
// un id donné, quel que soit le nombre de tentatives concurrentes ou
// répétées (rejeu séquentiel ou concurrent) — c'est le verrou d'idempotence.
export async function reclamerProposition(
  ctx: Ctx,
  chantierId: string | null,
  propositionId: string
): Promise<{ statut: "reclamee"; proposition: PropositionIaStockee } | { statut: "introuvable" } | { statut: "deja_appliquee" }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx
      .select()
      .from(propositionsIa)
      .where(
        and(
          eq(propositionsIa.id, propositionId),
          eq(propositionsIa.entrepriseId, ctx.entrepriseId),
          // **`IS NOT DISTINCT FROM`, jamais `=`.** Une proposition sans
          // chantier porte NULL, et `NULL = NULL` est faux en SQL : écrit avec
          // `eq`, la réclamation ne l'aurait JAMAIS retrouvée, et le geste
          // aurait été « introuvable » sans que rien ne dise pourquoi.
          sql`${propositionsIa.chantierId} IS NOT DISTINCT FROM ${chantierId}`
        )
      )
      .limit(1);

    if (!existante) return { statut: "introuvable" };

    const [reclamee] = await tx
      .update(propositionsIa)
      .set({ statut: "appliquee", appliqueeAt: new Date() })
      .where(and(eq(propositionsIa.id, propositionId), eq(propositionsIa.statut, "proposee")))
      .returning();

    if (!reclamee) return { statut: "deja_appliquee" };

    return {
      statut: "reclamee",
      proposition: {
        id: reclamee.id,
        chantierId: reclamee.chantierId,
        type: reclamee.type,
        description: reclamee.description,
        donnees: reclamee.donnees as Record<string, unknown>,
        statut: reclamee.statut,
      },
    };
  });
}
