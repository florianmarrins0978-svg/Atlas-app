import { z } from "zod";
import type { Outil } from "./types";
import { listerHistoriquePrix } from "../../repositories/historique-prix";

export const rechercherHistoriquePrix: Outil = {
  nom: "RechercherHistoriquePrix",
  description:
    "Lit l'historique des prix réellement pratiqués par l'entreprise pour une prestation du catalogue " +
    "(jamais un prix inventé, jamais celui d'une autre société).",
  schema: z.object({ prestationId: z.string() }),
  async executer({ ctx }, parametres) {
    const { prestationId } = parametres as { prestationId: string };
    const historique = await listerHistoriquePrix(ctx, prestationId);
    return {
      historique: historique.map((h) => ({
        prix: h.prix,
        date: h.constateLe,
        origine: h.origine,
        devisIdOrigine: h.devisIdOrigine,
      })),
      dernierPrix: historique[0]?.prix ?? null,
    };
  },
};
