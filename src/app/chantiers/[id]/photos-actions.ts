"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterPhoto, supprimerPhoto } from "@/server/repositories/photos";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier } from "@/server/upload-limits";
import { extensionPhoto, MESSAGE_PHOTO_REFUSEE, photoAcceptee, retirerMetadonnees } from "@/lib/exif";
import { logger } from "@/server/logger";

export async function ajouterPhotoAction(chantierId: string, formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    throw new Error("Aucun fichier reçu.");
  }
  /**
   * **UNE LISTE BLANCHE, plus `startsWith("image/")`** — audit du 23 août 2026,
   * constat M2. L'ancienne ligne acceptait `image/svg+xml`, et un SVG est un
   * document, pas une image : servi depuis notre domaine, son script s'exécute
   * avec la session de l'artisan.
   *
   * La liste tolère le HEIC de l'iPhone (`src/lib/exif.ts`) : le refuser
   * n'aurait protégé de rien et aurait coûté une photo sur un chantier.
   */
  if (!photoAcceptee(fichier.type)) {
    throw new Error(MESSAGE_PHOTO_REFUSEE);
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

  const brut = Buffer.from(await fichier.arrayBuffer());

  /**
   * **LES COORDONNÉES GPS PARTENT AVANT LE RANGEMENT** — constat M3.
   *
   * Une photo de jardin prise au téléphone porte l'adresse du domicile de son
   * client, l'horodatage, le modèle d'appareil. Rien de cela ne sert à une
   * photo de chantier, et ce qui n'est pas conservé ne peut pas fuir
   * (`docs/RGPD.md` §4). Le diagnostic végétal le fait depuis toujours ; il n'y
   * avait qu'à reprendre.
   *
   * **UN ÉCHEC DE NETTOYAGE NE REFUSE JAMAIS LA PHOTO.** `retirerMetadonnees`
   * rend `{ nettoye: false }` sur un format qu'il ne sait pas lire — un HEIC,
   * un fichier abîmé — et l'on range alors les octets d'origine. C'est un choix,
   * et il se dit : perdre le cliché d'un artisan qui vient de le prendre coûte
   * plus cher que garder des métadonnées sur une photo de haie.
   */
  const nettoye = retirerMetadonnees(brut, fichier.type);
  if (!nettoye.nettoye) {
    // Journalisé, jamais montré : c'est une information pour nous, pas un
    // reproche pour lui.
    logger.info("Photo de chantier rangée sans nettoyage des métadonnées", { type: fichier.type });
  }
  const octets = Buffer.from(nettoye.octets);
  const objet = await enregistrerObjet(`chantiers/${chantierId}/photos`, octets, extensionPhoto(fichier.type));

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
