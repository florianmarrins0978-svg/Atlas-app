import { z } from "zod";
import type { Outil } from "./types";
import { listerDossiers } from "../../repositories/dossiers-comptables";
import { pieceDuBilan } from "@/lib/pieces-de-l-assistant";

/**
 * Les bilans que le comptable a rendus, rangés avec leur dossier.
 *
 * **Sa demande du 27 octobre 2026** : *« le bilan comptable »*, joint dans la
 * discussion. Un bilan n'a pas d'année à lui : il prend la période du dossier
 * qu'il accompagne.
 */
export const lireBilans: Outil = {
  nom: "LireBilans",
  description:
    "Lit les bilans comptables déposés, avec la période de leur dossier (du, au), le plus récent d'abord. " +
    "À utiliser pour « mon bilan », « le bilan de 2025 ».",
  schema: z.object({}),
  async executer({ ctx }) {
    const dossiers = await listerDossiers(ctx);
    const bilans = dossiers.flatMap((d) =>
      d.bilans.map((b) => ({
        du: d.du,
        au: d.au,
        nom: b.fichierNom,
        piece: pieceDuBilan({ bilanId: b.id, nom: b.fichierNom ?? "Bilan", nature: b.nature, du: d.du, au: d.au }),
      }))
    );
    if (bilans.length === 0) return { trouve: false, raison: "Aucun bilan n'a été déposé." };
    return { trouve: true, bilans };
  },
};
