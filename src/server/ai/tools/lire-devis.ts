import { z } from "zod";
import type { Outil } from "./types";
import { getDevisPourChantier, getLignesDevis } from "../../repositories/devis";

export const lireDevis: Outil = {
  nom: "LireDevis",
  description: "Lit le dernier devis (brouillon ou envoyé) du chantier courant, avec ses lignes et son total.",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const devis = await getDevisPourChantier(ctx, chantierId);
    if (!devis) return { existe: false };
    const lignes = await getLignesDevis(ctx, devis.id);
    return {
      existe: true,
      numeroCommercial: devis.numeroCommercial,
      numeroVersion: devis.numeroVersion,
      statut: devis.statut,
      totalHt: devis.totalHt,
      totalTva: devis.totalTva,
      totalTtc: devis.totalTtc,
      lignes: lignes.map((l) => ({ libelle: l.libelle, montant: l.montant })),
    };
  },
};
