import { z } from "zod";
import type { Outil } from "./types";
import { listerVehicules, documentsDuVehicule, COLONNES_DU_DOCUMENT } from "../../repositories/vehicules";
import { typeDuDocument } from "@/lib/vehicules";
import { jourIso } from "@/lib/jour";
import { pieceDuVehicule } from "@/lib/pieces-de-l-assistant";

/**
 * Les papiers des véhicules : carte grise, assurance, contrôle technique.
 *
 * **Sa demande du 28 octobre 2026** : tous les documents. Un papier dont la
 * clé n'a pas un format connu ne se joint pas : la route le refuserait.
 */
export const lirePapiersVehicules: Outil = {
  nom: "LirePapiersVehicules",
  description:
    "Rend les papiers déposés sur les véhicules (carte grise, assurance, contrôle technique), avec leur pièce " +
    "à ouvrir. À utiliser pour « la carte grise du camion », « l'assurance du Master ».",
  schema: z.object({}),
  async executer({ ctx }) {
    const vehicules = await listerVehicules(ctx);
    const papiers = vehicules.flatMap((v) =>
      documentsDuVehicule(v).flatMap(({ nature, le }) => {
        const type = typeDuDocument(v[COLONNES_DU_DOCUMENT[nature].cle] as string);
        if (!type) return [];
        const vehicule = v.plaque ? `${v.nom} (${v.plaque})` : v.nom;
        return [
          {
            vehicule,
            nature,
            piece: pieceDuVehicule({
              vehiculeId: v.id,
              vehicule,
              nature,
              format: type === "application/pdf" ? "pdf" : "photo",
              date: jourIso(le),
            }),
          },
        ];
      })
    );
    if (papiers.length === 0) return { trouve: false, raison: "Aucun papier de véhicule n'a été déposé." };
    return { trouve: true, papiers };
  },
};
