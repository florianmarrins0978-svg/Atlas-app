import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { listerPrestations } from "../../repositories/prestations";

export const lirePrestations: Outil = {
  nom: "LirePrestations",
  description: "Lit la liste des prestations d'un chantier. Sans chantierId, celui qui est ouvert ; sinon, " +
    "celui que RechercherChantier a rendu.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const { ctx } = contexte;
    const chantierId = vise.chantierId;
    const prestations = await listerPrestations(ctx, chantierId);
    return { prestations: prestations.map((p) => ({ id: p.id, libelle: p.libelle })) };
  },
};
