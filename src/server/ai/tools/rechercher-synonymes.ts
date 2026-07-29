import { z } from "zod";
import type { Outil } from "./types";
import { rechercherPrestationCatalogue } from "../../repositories/catalogue-prestations";

export const rechercheSynonymes: Outil = {
  nom: "RechercheSynonymes",
  description:
    "Donne les synonymes et variantes connus pour un mot-clé, via le catalogue partagé (ex. « sapin » -> " +
    "« conifère », « abattage », « démontage », rattachés à la prestation canonique « Élagage »).",
  schema: z.object({ motCle: z.string() }),
  async executer(_contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const resultats = await rechercherPrestationCatalogue(motCle);
    return {
      resultats: resultats.map((p) => ({
        nomCanonique: p.nomCanonique,
        synonymes: p.synonymes,
        variantes: p.variantes,
      })),
    };
  },
};
