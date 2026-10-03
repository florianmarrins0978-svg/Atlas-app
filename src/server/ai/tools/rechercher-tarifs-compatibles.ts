import { z } from "zod";
import type { Outil } from "./types";
import { listerTarifs } from "../../repositories/tarifs";
import { tarifsCorrespondants } from "../../../lib/tarifs-correspondants";

export const rechercherTarifsCompatibles: Outil = {
  nom: "RechercherTarifsCompatibles",
  description:
    "Recherche, parmi les tarifs déjà définis par l'entreprise, ceux dont l'intitulé correspond à un mot-clé " +
    "(ex. « élagage », « carrelage »). Ne renvoie jamais un prix inventé : uniquement des tarifs réellement " +
    "enregistrés, avec leur source.",
  schema: z.object({ motCle: z.string() }),
  async executer({ ctx }, parametres) {
    const { motCle } = parametres as { motCle: string };
    const correspondances = tarifsCorrespondants(await listerTarifs(ctx), [motCle]).map((t) => ({
      ...t,
      source: "tarif de l'entreprise",
    }));

    return { correspondances };
  },
};
