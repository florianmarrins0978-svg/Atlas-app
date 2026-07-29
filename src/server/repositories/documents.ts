import { and, eq, ilike } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { documents, fragmentsDocuments } from "../db/schema";
import type { Ctx } from "./context";

export type TypeDocument = "devis" | "transcription" | "photo" | "note" | "autre";

export async function creerDocument(
  ctx: Ctx,
  data: { chantierId?: string; typeDocument: TypeDocument; titre: string; sourceReferenceId?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(documents)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId: data.chantierId,
        typeDocument: data.typeDocument,
        titre: data.titre,
        sourceReferenceId: data.sourceReferenceId,
      })
      .returning();
    return row;
  });
}

export async function ajouterFragments(ctx: Ctx, documentId: string, fragments: { position: number; contenu: string }[]) {
  if (fragments.length === 0) return [];
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .insert(fragmentsDocuments)
      .values(
        fragments.map((f) => ({
          entrepriseId: ctx.entrepriseId,
          documentId,
          position: f.position,
          contenu: f.contenu,
        }))
      )
      .returning();
  });
}

// Recherche simple par sous-chaîne (ILIKE) — pas de moteur de similarité,
// conforme à « ne pas créer de pipeline complexe ». Chaque résultat porte
// systématiquement sa provenance (document titre/type), jamais un texte nu.
export async function rechercherFragments(ctx: Ctx, motCle: string, chantierId?: string) {
  const mot = motCle.trim();
  if (!mot) return [];
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const conditions = [eq(fragmentsDocuments.entrepriseId, ctx.entrepriseId), ilike(fragmentsDocuments.contenu, `%${mot}%`)];
    const lignes = await tx
      .select({
        fragmentId: fragmentsDocuments.id,
        contenu: fragmentsDocuments.contenu,
        position: fragmentsDocuments.position,
        documentId: documents.id,
        titre: documents.titre,
        typeDocument: documents.typeDocument,
        chantierId: documents.chantierId,
        createdAt: documents.createdAt,
      })
      .from(fragmentsDocuments)
      .innerJoin(documents, eq(fragmentsDocuments.documentId, documents.id))
      .where(chantierId ? and(...conditions, eq(documents.chantierId, chantierId)) : and(...conditions))
      .limit(20);
    return lignes;
  });
}

export async function listerDocuments(ctx: Ctx, chantierId?: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(documents)
      .where(
        chantierId
          ? and(eq(documents.entrepriseId, ctx.entrepriseId), eq(documents.chantierId, chantierId))
          : eq(documents.entrepriseId, ctx.entrepriseId)
      )
  );
}
