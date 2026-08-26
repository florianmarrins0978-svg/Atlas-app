import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { listerMateriel } from "../../repositories/materiel";

export const lireMateriels: Outil = {
  nom: "LireMateriels",
  description: "Lit la liste du matériel d'un chantier. Sans chantierId, celui qui est ouvert ; sinon, celui " +
    "que RechercherChantier a rendu.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const { ctx } = contexte;
    const chantierId = vise.chantierId;
    const materiel = await listerMateriel(ctx, chantierId);
    return { materiel: materiel.map((m) => ({ id: m.id, libelle: m.libelle })) };
  },
};
