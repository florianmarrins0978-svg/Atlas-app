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

export type CanalClient = "sms" | "email";

export async function creerClient(
  ctx: Ctx,
  data: {
    nom: string;
    telephone?: string;
    adresse?: string;
    email?: string;
    // Canal convenu avec le client pour l'envoi du devis (docs/AGENT.md §2.1).
    // C'est un choix du client, pas un réglage de l'application : un artisan
    // sait que certains des siens ne lisent jamais leurs e-mails.
    canalCommunication?: CanalClient;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ entrepriseId: ctx.entrepriseId, ...data, createdBy: ctx.utilisateurId })
      .returning();
    return row;
  });
}

/**
 * Met à jour les coordonnées et le canal d'un client.
 *
 * Les champs absents de `data` ne sont pas touchés : un écran qui ne présente
 * que le canal ne doit pas effacer un téléphone au passage.
 */
export async function mettreAJourClient(
  ctx: Ctx,
  id: string,
  data: {
    nom?: string;
    telephone?: string | null;
    adresse?: string | null;
    email?: string | null;
    canalCommunication?: CanalClient | null;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, id),
          eq(clients.entrepriseId, ctx.entrepriseId),
          isNull(clients.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  });
}
