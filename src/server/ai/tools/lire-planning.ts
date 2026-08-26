import { z } from "zod";
import type { Outil } from "./types";
import { listerChantiersPourPlanning } from "../../repositories/chantiers";

/**
 * Ce qui est posé au planning, et ce qui attend un jour.
 *
 * **Les deux, et pas seulement le posé.** La question qu'il pose vraiment n'est
 * pas « qu'y a-t-il lundi ? » mais « qu'est-ce qui n'est pas encore calé ? ».
 * Un outil qui ne rendrait que les chantiers datés laisserait l'agent muet sur
 * la seule chose qui demande un geste.
 */
export const lirePlanning: Outil = {
  nom: "LirePlanning",
  description:
    "Lit le planning : les chantiers posés avec leur jour, et ceux qui attendent encore un jour. " +
    "À utiliser avant de proposer de planifier, de déplacer ou de retirer un chantier du planning.",
  schema: z.object({}),
  async executer({ ctx }) {
    const chantiers = await listerChantiersPourPlanning(ctx);
    const poses = chantiers.filter((c) => c.datePlanifiee);
    const sansDate = chantiers.filter((c) => !c.datePlanifiee);
    return {
      poses: poses.map((c) => ({
        chantierId: c.id,
        nom: c.nom,
        client: c.clientNom ?? null,
        jour: c.datePlanifiee,
        demiJournees: c.dureeDemiJournees ?? null,
      })),
      sansDate: sansDate.map((c) => ({ chantierId: c.id, nom: c.nom, client: c.clientNom ?? null })),
    };
  },
};
