import { z } from "zod";
import type { Outil } from "./types";
import { rechercherCartes } from "../../repositories/mots-catalogue";

export const rechercherMaterielCatalogueOutil: Outil = {
  nom: "RechercherMateriel",
  description:
    "Recherche les matériels correspondant à un mot-clé dans le vocabulaire partagé d'Atlas ET dans les mots " +
    "ajoutés par l'entreprise.",
  schema: z.object({ motCle: z.string() }),
  async executer(contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const cartes = await rechercherCartes(contexte.ctx, "materiel", motCle);
    return {
      correspondances: cartes.map((c) => ({
        materielId: c.id,
        nomCanonique: c.nom,
        variantes: c.motsCommuns,
        mesMots: c.mesMots.map((m) => m.mot),
        aMoi: c.aMoi,
      })),
    };
  },
};
