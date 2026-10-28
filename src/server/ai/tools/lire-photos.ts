import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { listerPhotosHorsFicheDeSecurite } from "../../repositories/photos";
import { pieceDeLaPhoto } from "@/lib/pieces-de-l-assistant";
import { jourIso } from "@/lib/jour";

/**
 * Les photos d'un chantier, à joindre dans la discussion.
 *
 * **Sa demande du 27 octobre 2026** : *« tous les documents ou photos
 * demandés »*. Une photo n'a pas de légende : l'assistant ne sait d'elle que
 * son jour, et ne prétend pas savoir ce qu'elle montre.
 *
 * Celles de la fiche de sécurité restent hors de cette liste, comme sur la
 * pellicule du chantier (`listerPhotosHorsFicheDeSecurite`).
 */
export const lirePhotos: Outil = {
  nom: "LirePhotos",
  description:
    "Rend les photos d'un chantier, avec leur jour. Elles n'ont pas de légende : ne décris jamais ce " +
    "qu'elles montrent. Sans chantierId, celles du chantier courant.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const photos = await listerPhotosHorsFicheDeSecurite(contexte.ctx, vise.chantierId);
    if (photos.length === 0) return { trouve: false, raison: "Ce chantier n'a aucune photo." };
    return {
      trouve: true,
      photos: photos.map((p) => {
        // Le jour à Paris : une photo prise à 23 h n'est pas du lendemain.
        const jour = jourIso(p.createdAt);
        return { jour, piece: pieceDeLaPhoto({ storageKey: p.storageKey, nom: null, date: jour }) };
      }),
    };
  },
};
