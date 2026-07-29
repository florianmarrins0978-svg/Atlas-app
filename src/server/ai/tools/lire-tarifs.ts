import { z } from "zod";
import type { Outil } from "./types";
import { listerTarifs } from "../../repositories/tarifs";

export const lireTarifs: Outil = {
  nom: "LireTarifs",
  description: "Lit la liste des tarifs définis par l'entreprise (utilisés pour calculer le prix d'un chantier).",
  schema: z.object({}),
  async executer({ ctx }) {
    const tarifs = await listerTarifs(ctx);
    return { tarifs: tarifs.map((t) => ({ intitule: t.intitule, prix: t.prix, unite: t.unite })) };
  },
};
