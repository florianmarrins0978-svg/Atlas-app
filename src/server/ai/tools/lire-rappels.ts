import { z } from "zod";
import type { Outil } from "./types";
import { rappelsEnCours } from "../../repositories/rappels";

/**
 * Ce qui attend un geste : chantier sans devis, devis sans réponse, chantier
 * non facturé, facture impayée.
 *
 * **Les mêmes que l'écran**, avec ses réglages : un rappel qu'il a éteint ne
 * revient pas par l'assistant (`rappelsEnCours` ne coûte même pas de requête
 * quand tout est éteint).
 *
 * **Le reste dû part en centimes, tel que le dépôt le compte** ; le modèle ne
 * fait que le lire en euros.
 */
export const lireRappels: Outil = {
  nom: "LireRappels",
  description:
    "Lit ce qui attend un geste du patron : chantiers sans devis, devis sans réponse, chantiers terminés non " +
    "facturés, factures impayées (avec le reste dû en centimes). À utiliser pour « qu'est-ce que j'ai à " +
    "faire », « qu'est-ce que j'oublie », « qui relancer ».",
  schema: z.object({}),
  async executer({ ctx }) {
    const rappels = await rappelsEnCours(ctx, new Date());
    if (rappels.length === 0) return { trouve: false, raison: "Rien n'attend de geste, ou les rappels sont éteints." };
    return {
      trouve: true,
      rappels: rappels.map((r) => ({
        genre: r.genre,
        chantierId: r.chantierId,
        chantier: r.chantierNom,
        depuis: r.depuis.toISOString().slice(0, 10),
        facture: r.facture
          ? { numero: r.facture.numero, resteDuCentimes: r.facture.resteDuCts, totalCentimes: r.facture.totalCts }
          : null,
      })),
    };
  },
};
