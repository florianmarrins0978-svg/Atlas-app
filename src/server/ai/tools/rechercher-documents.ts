import { z } from "zod";
import type { Outil } from "./types";
import { rechercherFragments } from "../../repositories/documents";

export const rechercherDocuments: Outil = {
  nom: "RechercherDocuments",
  description:
    "Recherche un passage dans les documents de l'entreprise (devis, transcriptions, notes, métadonnées de " +
    "photos) pour le chantier courant. Renvoie toujours la provenance (document, type, passage exact) — " +
    "jamais un texte sans source. Ne renvoie rien s'il n'y a aucune correspondance fiable.",
  schema: z.object({ motCle: z.string() }),
  async executer({ ctx, chantierId }, parametres) {
    const { motCle } = parametres as { motCle: string };
    const resultats = await rechercherFragments(ctx, motCle, chantierId ?? undefined);
    return {
      resultats: resultats.map((r) => ({
        document: r.titre,
        typeDocument: r.typeDocument,
        passage: r.contenu,
        position: r.position,
      })),
    };
  },
};
