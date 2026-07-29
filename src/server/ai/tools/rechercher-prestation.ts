import { z } from "zod";
import type { Outil } from "./types";
import { rechercherPrestationCatalogue } from "../../repositories/catalogue-prestations";

export const rechercherPrestation: Outil = {
  nom: "RechercherPrestation",
  description:
    "Recherche dans le catalogue partagé les prestations correspondant à un mot-clé, en tenant compte des " +
    "variantes et synonymes connus (ex. « sapin » peut correspondre à « Élagage »).",
  schema: z.object({ motCle: z.string() }),
  async executer(_contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const resultats = await rechercherPrestationCatalogue(motCle);
    return {
      correspondances: resultats.map((p) => ({
        prestationId: p.id,
        nomCanonique: p.nomCanonique,
        variantes: p.variantes,
        synonymes: p.synonymes,
        unite: p.unite,
      })),
    };
  },
};
