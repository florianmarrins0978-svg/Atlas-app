import { z } from "zod";
import type { Outil } from "./types";
import { listerPrestations } from "../../repositories/prestations";

export const lirePrestations: Outil = {
  nom: "LirePrestations",
  description: "Lit la liste des prestations enregistrées pour le chantier courant.",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const prestations = await listerPrestations(ctx, chantierId);
    return { prestations: prestations.map((p) => ({ id: p.id, libelle: p.libelle })) };
  },
};
