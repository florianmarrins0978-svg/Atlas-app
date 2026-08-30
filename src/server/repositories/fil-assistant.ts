import { and, desc, eq, notInArray } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { messagesAssistant } from "../db/schema";
import type { Ctx } from "./context";
import type { MessageAssistant } from "../ai/services/assistant-service";

/**
 * Le fil de l'assistant, gardé entre deux ouvertures de l'application.
 *
 * **Sa demande du 27 août 2026 : « qu'il se souvienne ».** Le fil vivait dans
 * l'état d'un composant et mourait au premier rechargement — or son onglet
 * reste ouvert des heures, et son banc redémarre plusieurs fois par soirée
 * (`HANDOVER.md`, piège 0). « Et celui d'avant ? » ne trouvait plus rien.
 */

/**
 * Combien de messages on garde.
 *
 * **Trente, et c'est un arbitrage, pas un chiffre rond.** Un fil qui grossit
 * sans fin coûte à chaque question — il repart en entier au modèle, et se paie
 * au jeton. Trente messages, c'est une quinzaine d'échanges : de quoi tenir une
 * soirée de chantier, pas de quoi porter le mois.
 */
export const MESSAGES_GARDES = 30;

export async function lireFilAssistant(ctx: Ctx): Promise<MessageAssistant[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ role: messagesAssistant.role, contenu: messagesAssistant.contenu })
      .from(messagesAssistant)
      .where(
        and(
          eq(messagesAssistant.entrepriseId, ctx.entrepriseId),
          // **Le filtre par personne est ICI, pas dans la RLS.** `withEntreprise`
          // ne pose que `app.entreprise_id` : la politique isole les entreprises,
          // et deux associés d'une même entreprise passeraient au travers sans
          // cette ligne. Elle n'est pas un confort d'affichage — c'est elle qui
          // sépare leurs conversations.
          eq(messagesAssistant.utilisateurId, ctx.utilisateurId)
        )
      )
      // **Par `rang`, jamais par la date.** `now()` est l'instant de début de
      // transaction : la question et sa réponse, écrites ensemble, la partagent
      // — et le classement retombait sur un UUID, donc au hasard. Vu rouge.
      //
      // Le plus récent d'abord pour que la coupe garde la FIN du fil, pas son
      // début : c'est la suite de la conversation qui compte, pas son ouverture.
      .orderBy(desc(messagesAssistant.rang))
      .limit(MESSAGES_GARDES);

    return lignes.reverse();
  });
}

/**
 * Ajoute la question et la réponse, puis coupe ce qui dépasse.
 *
 * **Les deux dans la même transaction**, et pas au fil de l'eau : une question
 * enregistrée sans sa réponse rouvrirait le fil sur une phrase sans suite, et
 * l'assistant relirait sa propre question comme si elle venait d'arriver.
 */
export async function ajouterAuFilAssistant(
  ctx: Ctx,
  chantierId: string | null,
  messages: MessageAssistant[]
): Promise<void> {
  if (messages.length === 0) return;
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.insert(messagesAssistant).values(
      messages.map((m) => ({
        entrepriseId: ctx.entrepriseId,
        utilisateurId: ctx.utilisateurId,
        chantierId,
        role: m.role,
        contenu: m.contenu,
      }))
    );

    // **La coupe désigne ce qu'on GARDE, jamais ce qu'on jette.** Écrite en
    // « supprimer au-delà du trentième », elle dépend d'un décalage exact et
    // efface le fil entier dès qu'il est faux. Écrite ainsi, le pire des cas
    // est de garder trop.
    const aGarder = await tx
      .select({ id: messagesAssistant.id })
      .from(messagesAssistant)
      .where(
        and(
          eq(messagesAssistant.entrepriseId, ctx.entrepriseId),
          eq(messagesAssistant.utilisateurId, ctx.utilisateurId)
        )
      )
      .orderBy(desc(messagesAssistant.rang))
      .limit(MESSAGES_GARDES);

    if (aGarder.length < MESSAGES_GARDES) return;

    await tx.delete(messagesAssistant).where(
      and(
        eq(messagesAssistant.entrepriseId, ctx.entrepriseId),
        eq(messagesAssistant.utilisateurId, ctx.utilisateurId),
        notInArray(
          messagesAssistant.id,
          aGarder.map((l) => l.id)
        )
      )
    );
  });
}

/** Repartir de zéro, à son geste. */
export async function viderFilAssistant(ctx: Ctx): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .delete(messagesAssistant)
      .where(
        and(
          eq(messagesAssistant.entrepriseId, ctx.entrepriseId),
          eq(messagesAssistant.utilisateurId, ctx.utilisateurId)
        )
      );
  });
}
