import { z } from "zod";
import type { Outil } from "./types";
import { rechercherCartes } from "../../repositories/mots-catalogue";

export const rechercheSynonymes: Outil = {
  nom: "RechercheSynonymes",
  description:
    "Donne tous les mots connus pour un mot-clé — ceux d'Atlas et ceux de l'entreprise (ex. « sapin » -> " +
    "« conifère », « abattage », « démontage », rattachés à la prestation canonique « Élagage »).",
  schema: z.object({ motCle: z.string() }),
  async executer(contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const cartes = await rechercherCartes(contexte.ctx, "prestation", motCle);
    return {
      resultats: cartes.map((c) => ({
        nomCanonique: c.nom,
        // Un seul champ désormais : « variantes » et « synonymes » disaient la
        // même chose, et personne n'a jamais su ce qui allait dans lequel.
        mots: [...c.motsCommuns, ...c.mesMots.map((m) => m.mot)],
        aMoi: c.aMoi,
      })),
    };
  },
};
