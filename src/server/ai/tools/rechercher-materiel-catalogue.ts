import { z } from "zod";
import type { Outil } from "./types";
import { rechercherMaterielCatalogue } from "../../repositories/catalogue-materiels";

export const rechercherMaterielCatalogueOutil: Outil = {
  nom: "RechercherMateriel",
  description: "Recherche dans le catalogue partagé les matériels correspondant à un mot-clé, en tenant compte des variantes connues.",
  schema: z.object({ motCle: z.string() }),
  async executer(_contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const resultats = await rechercherMaterielCatalogue(motCle);
    return {
      correspondances: resultats.map((m) => ({
        materielId: m.id,
        nomCanonique: m.nomCanonique,
        variantes: m.variantes,
        unite: m.unite,
      })),
    };
  },
};
