import { z } from "zod";
import type { Outil } from "./types";
import { listerMateriel } from "../../repositories/materiel";

export const lireMateriels: Outil = {
  nom: "LireMateriels",
  description: "Lit la liste du matériel enregistré pour le chantier courant.",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const materiel = await listerMateriel(ctx, chantierId);
    return { materiel: materiel.map((m) => ({ id: m.id, libelle: m.libelle })) };
  },
};
