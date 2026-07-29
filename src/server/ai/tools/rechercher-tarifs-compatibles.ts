import { z } from "zod";
import type { Outil } from "./types";
import { listerTarifs } from "../../repositories/tarifs";

export const rechercherTarifsCompatibles: Outil = {
  nom: "RechercherTarifsCompatibles",
  description:
    "Recherche, parmi les tarifs déjà définis par l'entreprise, ceux dont l'intitulé correspond à un mot-clé " +
    "(ex. « élagage », « carrelage »). Ne renvoie jamais un prix inventé : uniquement des tarifs réellement " +
    "enregistrés, avec leur source.",
  schema: z.object({ motCle: z.string() }),
  async executer({ ctx }, parametres) {
    const { motCle } = parametres as { motCle: string };
    const tous = await listerTarifs(ctx);
    const motCleMinuscule = motCle.trim().toLowerCase();
    if (!motCleMinuscule) return { correspondances: [] };

    const correspondances = tous
      .filter((t) => t.intitule.toLowerCase().includes(motCleMinuscule) || motCleMinuscule.includes(t.intitule.toLowerCase()))
      .map((t) => ({ tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite, source: "tarif de l'entreprise" }));

    return { correspondances };
  },
};
