import { z } from "zod";
import type { Outil } from "./types";
import { listerChantiersPourAffichage } from "../../repositories/chantiers";

/**
 * Retrouver un chantier — **le chaînon qui manquait à l'agent**.
 *
 * Jusqu'au 26 août 2026, l'assistant ne connaissait que le chantier OUVERT :
 * tout ce qu'il savait faire s'y arrêtait. Sa demande — *« un vrai agent avec
 * toutes les capacités possibles sur l'appli »* — suppose d'abord de pouvoir
 * DÉSIGNER un autre chantier que celui qu'on regarde, par le nom qu'il emploie :
 * celui du client, ou celui du chantier.
 *
 * **Il rend l'identifiant**, et c'est lui qui compte : les gestes qui suivent
 * (planifier, noter, facturer) ciblent par identifiant, jamais par nom — deux
 * clients peuvent s'appeler Martin.
 */
export const rechercherChantier: Outil = {
  nom: "RechercherChantier",
  description:
    "Retrouve un chantier de l'entreprise par le nom du client ou le nom du chantier. Rend son identifiant, " +
    "son état, sa date posée au planning et son adresse. À utiliser avant tout geste qui vise un chantier " +
    "autre que celui ouvert à l'écran.",
  schema: z.object({
    motCle: z.string().nullish().describe("Un bout du nom du client ou du chantier : « Bernard », « terrasse »."),
  }),
  async executer({ ctx }, parametres) {
    const { motCle } = parametres as { motCle?: string | null };
    const tous = await listerChantiersPourAffichage(ctx);
    const cherche = (motCle ?? "").trim().toLowerCase();

    const retenus = cherche
      ? tous.filter(
          (c) =>
            c.nom.toLowerCase().includes(cherche) ||
            (c.clientNom ?? "").toLowerCase().includes(cherche) ||
            (c.adresseChantier ?? "").toLowerCase().includes(cherche)
        )
      : tous;

    if (retenus.length === 0) return { trouve: false, raison: "Aucun chantier ne correspond." };

    return {
      trouve: true,
      chantiers: retenus.slice(0, 15).map((c) => ({
        chantierId: c.id,
        nom: c.nom,
        client: c.clientNom ?? null,
        adresse: c.adresseChantier ?? null,
        datePlanifiee: c.datePlanifiee ?? null,
      })),
      // Dit ce qui n'a pas été montré, plutôt que de laisser croire à une liste
      // complète : un plafond silencieux se lit comme « il n'y en a que quinze ».
      autresNonMontres: Math.max(0, retenus.length - 15),
    };
  },
};
