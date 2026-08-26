import { and, asc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { prestations } from "../db/schema";
import type { Ctx } from "./context";

export async function listerPrestations(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(prestations).where(eq(prestations.chantierId, chantierId)).orderBy(asc(prestations.ordre))
  );
}

/**
 * Ce qu'une prestation peut porter en plus de son nom, depuis le 26 août 2026.
 *
 * **Facultatif partout, et c'est la clé de la compatibilité.** Une prestation
 * créée à la main sur l'écran Informations n'en fournit aucun, et doit
 * continuer à s'enregistrer exactement comme avant. Ce qui n'est pas donné
 * reste `NULL` en base — « on ne sait pas », jamais une valeur par défaut.
 */
export type StructurePrestation = {
  quantite?: string | null;
  unite?: string | null;
  nature?: string | null;
  espece?: string | null;
  methode?: string | null;
  caracteristiques?: Record<string, number | string> | null;
  aConfirmer?: boolean | null;
};

export async function ajouterPrestation(
  ctx: Ctx,
  chantierId: string,
  libelle: string,
  structure: StructurePrestation = {}
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx.select().from(prestations).where(eq(prestations.chantierId, chantierId));
    const [row] = await tx
      .insert(prestations)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, libelle, ordre: existantes.length, ...structure })
      .returning();
    return row;
  });
}

/**
 * Complète les champs structurés d'une prestation déjà écrite.
 *
 * **Elle n'écrase jamais par du vide.** Seules les clés réellement fournies
 * sont posées : un appelant qui ne connaît que la méthode ne doit pas effacer
 * la quantité au passage. C'est ce qui permet à deux sources d'alimenter la
 * même ligne — la dictée pour la mesure, ses réponses à l'arrêt pour la
 * technique — sans se marcher dessus.
 */
export async function completerPrestation(ctx: Ctx, id: string, structure: StructurePrestation) {
  const aPoser = Object.fromEntries(Object.entries(structure).filter(([, v]) => v !== undefined));
  if (Object.keys(aPoser).length === 0) return null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(prestations)
      .set({ ...aPoser, updatedAt: new Date() })
      .where(eq(prestations.id, id))
      .returning();
    return row ?? null;
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
