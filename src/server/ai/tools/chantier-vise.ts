import { z } from "zod";
import type { ContexteOutil } from "./types";

/**
 * Sur QUEL chantier un outil travaille — celui qu'on nomme, sinon l'ouvert.
 *
 * **Sa demande du 25 août 2026 : « je veux pouvoir faire ça peu importe où je
 * l'ouvre ».** Le panneau de l'assistant est monté dans la mise en page
 * globale : il est déjà disponible sur tous les écrans. Ce qui ne l'était pas,
 * ce sont ses OUTILS — cinq d'entre eux portaient la même ligne :
 *
 *     if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
 *
 * Ouvert depuis la liste, le planning ou les réglages, ce chantier est nul et
 * chacun refusait à son tour. L'assistant n'était donc utile que là où il
 * l'ouvrait le moins.
 *
 * **Cinq copies d'une même règle, c'est cinq endroits à corriger** le jour où
 * elle change — et elle vient de changer (`CLAUDE.md` §3). Elle vit désormais
 * ici, et chaque outil s'y branche.
 *
 * **Le refus nomme la SUITE À DONNER, pas seulement le manque.** « Aucun
 * chantier dans le contexte courant » laissait le modèle renvoyer le patron
 * ouvrir une fiche à la main — ce qu'il a reproché deux fois le 25 août. Il
 * apprend maintenant qu'il existe un chemin, et lequel.
 */
export const CHAMP_CHANTIER_VISE = {
  chantierId: z
    .string()
    .optional()
    .describe(
      "Le chantier visé. À omettre quand un chantier est ouvert ; sinon, l'identifiant rendu par RechercherChantier."
    ),
};

export type VerdictChantier =
  | { ok: true; chantierId: string }
  | { ok: false; reponse: { erreur: string } };

export function chantierVise(contexte: ContexteOutil, parametres: unknown): VerdictChantier {
  const demande = (parametres as { chantierId?: string } | undefined)?.chantierId?.trim();
  const cible = demande || contexte.chantierId;
  if (!cible) {
    return {
      ok: false,
      reponse: {
        erreur:
          "Aucun chantier visé. Employez RechercherChantier avec le nom du client ou du chantier, " +
          "puis rappelez cet outil avec le chantierId qu'il rend. Ne demandez pas au patron " +
          "d'ouvrir une fiche lui-même.",
      },
    };
  }
  return { ok: true, chantierId: cible };
}
