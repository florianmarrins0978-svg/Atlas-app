import { z } from "zod";
import type { Outil } from "./types";
import { executerWorkflowDemande } from "../../orchestrateur/workflow";

export const executerWorkflow: Outil = {
  nom: "ExecuterWorkflowDemande",
  description:
    "Exécute le workflow complet de traitement d'une demande client (analyse, recherche documentaire, " +
    "catalogue, historique, chiffrage, préparation du devis) en enchaînant les outils déjà existants. " +
    "N'écrit jamais rien : produit une trace complète, étape par étape, et une proposition finale à " +
    "confirmer — ou s'arrête explicitement si une donnée indispensable manque.",
  schema: z.object({ demande: z.string() }),
  async executer({ ctx, chantierId }, parametres) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const { demande } = parametres as { demande: string };
    return executerWorkflowDemande(ctx, chantierId, demande);
  },
};
