"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterPhoto, supprimerPhoto } from "@/server/repositories/photos";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier } from "@/server/upload-limits";

function extensionPour(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

export async function ajouterPhotoAction(chantierId: string, formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    throw new Error("Aucun fichier reçu.");
  }
  if (!fichier.type.startsWith("image/")) {
    throw new Error("Le fichier doit être une image.");
  }
  // Vérifié via fichier.size, sans jamais lire le contenu au préalable —
  // aucun risque de saturation mémoire par un fichier surdimensionné.
  const validationTaille = verifierTailleFichier(fichier);
  if (!validationTaille.ok) {
    throw new Error(validationTaille.message);
  }

  const ctx = await getCurrentCtx();

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) {
    throw new Error(limite.message);
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const objet = await enregistrerObjet(`chantiers/${chantierId}/photos`, octets, extensionPour(fichier.type));

  const photo = await ajouterPhoto(ctx, chantierId, {
    storageKey: objet.storageKey,
    mimeType: fichier.type,
    tailleOctets: objet.tailleOctets,
    nomOriginal: fichier.name || undefined,
    checksum: objet.checksum,
  });

  return { id: photo.id, storageKey: photo.storageKey };
}

export async function supprimerPhotoAction(photoId: string) {
  const ctx = await getCurrentCtx();
  await supprimerPhoto(ctx, photoId);
}
