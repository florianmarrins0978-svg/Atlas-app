"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterPhoto, supprimerPhoto } from "@/server/repositories/photos";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";

export async function ajouterPhotoAction(chantierId: string, formData: FormData) {
  const ctx = await getCurrentCtx();

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) {
    throw new Error(limite.message);
  }

  /**
   * **TOUT passe par `preparerPhotoEntrante`, et rien ne se refait ici.**
   *
   * Elle vérifie la taille, le format, retire les métadonnées — et **refuse si
   * elle n'a pas pu les retirer**. L'original ne descend jamais jusqu'au
   * rangement (`src/server/photo-entrante.ts`).
   *
   * La version d'avant faisait ces trois gestes à la main, dans cet écran, et
   * concluait par « on range quand même ». C'est ce « quand même » qui rangeait
   * les coordonnées GPS du domicile d'un client.
   */
  const prete = await preparerPhotoEntrante(formData.get("fichier"), "photo de chantier");
  if (!prete.ok) throw new Error(prete.raison);

  const objet = await enregistrerObjet(
    `chantiers/${chantierId}/photos`,
    prete.photo.octets,
    prete.photo.extension
  );

  const photo = await ajouterPhoto(ctx, chantierId, {
    storageKey: objet.storageKey,
    // Le type RETENU par la préparation, jamais celui que le navigateur
    // annonçait : les deux ne coïncident que si le contenu correspondait.
    mimeType: prete.photo.mimeType,
    tailleOctets: objet.tailleOctets,
    nomOriginal: prete.photo.nomOriginal,
    checksum: objet.checksum,
  });

  return { id: photo.id, storageKey: photo.storageKey };
}

export async function supprimerPhotoAction(photoId: string) {
  const ctx = await getCurrentCtx();
  await supprimerPhoto(ctx, photoId);
}
