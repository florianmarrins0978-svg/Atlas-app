import { z } from "zod";
import type { Outil } from "./types";
import { listerPrestations } from "../../repositories/prestations-entretien";

/**
 * Les lignes de sa fiche d'entretien, avec leur identifiant.
 *
 * **Sa demande du 27 août 2026.** Sans cet outil, l'assistant ne peut pas viser
 * une ligne à retirer : il faudrait la désigner par son libellé, et deux
 * familles peuvent porter le même mot. On vise par identifiant, comme partout
 * ailleurs.
 */
export const lirePrestationsEntretien: Outil = {
  nom: "LirePrestationsEntretien",
  description:
    "Les lignes de la fiche d'entretien (le modèle réutilisé à chaque passage), par famille, " +
    "avec leur identifiant. À employer avant de proposer d'en retirer une.",
  schema: z.object({}),
  async executer({ ctx }) {
    const lignes = await listerPrestations(ctx);
    if (lignes.length === 0) {
      // On rend le vide en le DISANT : une liste vide laisserait le modèle
      // conclure que l'outil a échoué.
      return { lignes: [], phrase: "La fiche d'entretien ne porte encore aucune ligne." };
    }
    return { lignes: lignes.map((p) => ({ prestationId: p.id, famille: p.famille, libelle: p.libelle })) };
  },
};
