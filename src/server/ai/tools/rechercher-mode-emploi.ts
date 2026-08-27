import { z } from "zod";
import type { Outil } from "./types";
import { chercherFiches } from "@/lib/mode-emploi";

/**
 * « Comment je fais pour… » — le seul outil qui ne lit pas la base.
 *
 * Il ne consulte aucune donnée d'entreprise : le mode d'emploi est le même pour
 * tout le monde. Il ne prend donc pas de `ctx`, et il n'y a rien à isoler.
 *
 * **Il rend un refus, pas une approximation.** Quand la recherche ne trouve
 * rien, `trouve: false` — et le service impose à l'assistant de le dire plutôt
 * que d'inventer un geste. Un geste faux se cherche cinq minutes à l'écran
 * avant qu'on ne conclue que l'application est cassée.
 */
export const rechercherModeEmploi: Outil = {
  nom: "RechercherModeEmploi",
  description:
    "Explique COMMENT on fait quelque chose dans Atlas : le geste exact, écran par écran. " +
    "À utiliser pour toute question du type « comment je fais pour… », « où est… », « à quoi sert… », " +
    "« comment supprimer/modifier/envoyer… ». Ne lit aucune donnée de chantier : c'est le mode d'emploi " +
    "de l'application, pas son contenu.",
  schema: z
    .object({
      question: z.string().optional().describe("La question de l'utilisateur, dans ses mots, telle qu'il l'a posée."),
      motCle: z.string().optional(),
    })
    .refine((v) => Boolean((v.question ?? v.motCle ?? "").trim()), { message: "Donne la question dans « question »." }),
  async executer(_contexte, parametres) {
    const p = parametres as { question?: string; motCle?: string };
    const question = p.question ?? p.motCle ?? "";
    const fiches = chercherFiches(question);
    if (fiches.length === 0) {
      return {
        trouve: false,
        consigne:
          "Aucun geste connu ne correspond. Dis-le franchement — n'invente jamais un geste, " +
          "un nom de bouton ou un écran.",
      };
    }
    return {
      trouve: true,
      fiches: fiches.map((f) => ({
        ecran: f.ecran,
        ou: f.ou,
        intitule: f.intitule,
        geste: f.geste,
        reserve: f.reserve ?? null,
      })),
    };
  },
};
