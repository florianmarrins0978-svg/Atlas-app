import { z } from "zod";
import type { Outil } from "./types";
import { listerEquipes } from "../../repositories/equipes";
import { listerAbsencesEquipe } from "../../repositories/absences-equipe";
import { jourIso } from "@/lib/jour";

/**
 * Les équipes, et leurs absences à venir ou en cours.
 *
 * **Sa demande du 26 septembre 2026 :** *« nourris-le de tout »*. À « qui est
 * absent la semaine prochaine ? », l'assistant n'avait rien à lire, alors que
 * c'est ce qui décide de déplacer un chantier.
 *
 * **Les absences passées ne sont pas rendues** : elles ne décident plus de
 * rien, et trente lignes d'historique noieraient les deux qui comptent.
 */
export const lireEquipes: Outil = {
  nom: "LireEquipes",
  description:
    "Lit les équipes de l'entreprise (rang et nom) et leurs absences en cours ou à venir : premier et dernier " +
    "jour, demi-journée, motif. À utiliser pour « qui est absent », « l'équipe 2 travaille jeudi ? », ou avant " +
    "de proposer de planifier un chantier.",
  schema: z.object({}),
  async executer({ ctx }) {
    const [equipes, absences] = await Promise.all([
      listerEquipes(ctx),
      listerAbsencesEquipe(ctx, jourIso(new Date())),
    ]);
    return {
      equipes: equipes.map((e) => ({ equipeId: e.id, rang: e.rang, nom: e.nom })),
      absencesAVenir: absences.map((a) => ({
        equipeRang: a.rang,
        equipeNom: a.nom,
        premierJour: a.premierJour,
        premierDemi: a.premierDemi,
        dernierJour: a.dernierJour,
        dernierDemi: a.dernierDemi,
        motif: a.motif,
      })),
    };
  },
};
