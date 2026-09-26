import { z } from "zod";
import type { Outil } from "./types";
import { listerDiagnostics } from "../../repositories/diagnostics";
import type { ResultatFige } from "@/lib/diagnostic-vegetal";

/**
 * Les diagnostics végétaux déjà faits, avec ce qu'ils ont conclu.
 *
 * **Sa demande du 26 septembre 2026 :** *« nourris-le de tout »*. Un
 * diagnostic rendu la semaine dernière sur un chantier était invisible pour
 * l'assistant.
 *
 * **La méthode de confirmation part avec le résultat**, et c'est délibéré : sa
 * règle est qu'Atlas ne dit jamais « confirmé » quand la source exige une
 * analyse (`ResultatFige.methodeConfirmation`). L'assistant qui résumerait un
 * diagnostic sans elle dirait exactement ce que l'écran s'interdit.
 *
 * Il lit le résultat FIGÉ, jamais une fiche d'aujourd'hui : c'est ce qui a été
 * dit ce jour-là.
 */
export const lireDiagnostics: Outil = {
  nom: "LireDiagnostics",
  description:
    "Lit les derniers diagnostics végétaux faits sur photo : date, chantier, statut, et pour ceux qui ont " +
    "conclu, le problème reconnu, la confiance (elevee, probable, incertaine), la gravité, la conduite à " +
    "tenir et ce qu'il faut pour CONFIRMER. Ne présente jamais un diagnostic comme confirmé quand une " +
    "méthode de confirmation est indiquée.",
  schema: z.object({
    chantierId: z.string().nullish().describe("Seulement les diagnostics rattachés à ce chantier."),
  }),
  async executer({ ctx }, parametres) {
    const p = parametres as { chantierId?: string | null };
    const tous = await listerDiagnostics(ctx, 20);
    const retenus = p.chantierId ? tous.filter((d) => d.chantierId === p.chantierId) : tous;
    if (retenus.length === 0) return { trouve: false, raison: "Aucun diagnostic." };
    return {
      trouve: true,
      diagnostics: retenus.map((d) => {
        const r = d.statut === "rendu" ? (d.resultat as ResultatFige | null) : null;
        return {
          date: d.createdAt.toISOString().slice(0, 10),
          chantierId: d.chantierId,
          statut: d.statut,
          conclusion: r
            ? {
                probleme: r.nom,
                nomScientifique: r.nomScientifique,
                confiance: r.confiance,
                gravite: r.graviteLibelle,
                conduite: r.conduite,
                pourConfirmer: r.methodeConfirmation,
              }
            : null,
        };
      }),
    };
  },
};
