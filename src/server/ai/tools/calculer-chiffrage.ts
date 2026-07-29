import { z } from "zod";
import type { Outil } from "./types";
import { chiffrerChantier } from "../../chiffrage/service";

export const calculerChiffrage: Outil = {
  nom: "CalculerChiffrage",
  description:
    "Calcule un chiffrage (coût estimé, marge, prix conseillé HT/TTC, avec variantes prudent/standard/premium) " +
    "pour le chantier courant, à partir de sa durée, de son équipe, des paramètres de l'entreprise et de " +
    "l'historique de prix. Ne modifie jamais le devis — un résultat à présenter, jamais à appliquer seul.",
  schema: z.object({ motCleCatalogue: z.string().optional() }),
  async executer({ ctx, chantierId }, parametres) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const { motCleCatalogue } = parametres as { motCleCatalogue?: string };
    const resultat = await chiffrerChantier(ctx, chantierId, motCleCatalogue);
    if (!resultat) return { erreur: "Chantier introuvable." };
    return resultat;
  },
};
