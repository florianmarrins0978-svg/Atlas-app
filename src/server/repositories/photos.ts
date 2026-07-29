import { and, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { photos, fichiersAPurger } from "../db/schema";
import type { Ctx } from "./context";

type FichierPhoto = {
  storageKey: string;
  mimeType: string;
  tailleOctets: number;
  nomOriginal?: string;
  checksum: string;
};

export async function listerPhotos(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(photos)
      .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt)))
  );
}

export async function ajouterPhoto(ctx: Ctx, chantierId: string, fichier: FichierPhoto) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx
      .select()
      .from(photos)
      .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt)));

    const [row] = await tx
      .insert(photos)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        ...fichier,
        ordre: existantes.length,
        createdBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

// Suppression douce : marquée deleted_at, le fichier physique n'est jamais
// détruit immédiatement — mis en file pour purge différée (voir fichiers.ts).
export async function supprimerPhoto(ctx: Ctx, photoId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [photo] = await tx.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo) return null;
    await tx.update(photos).set({ deletedAt: new Date() }).where(eq(photos.id, photoId));
    await tx.insert(fichiersAPurger).values({ storageKey: photo.storageKey });
    return photo;
  });
}
