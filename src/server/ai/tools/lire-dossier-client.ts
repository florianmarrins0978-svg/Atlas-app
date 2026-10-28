import { z } from "zod";
import type { Outil } from "./types";
import { chargerFicheClient } from "../../repositories/fiche-client";
import { dernierContratDuClient } from "../../repositories/contrats-entretien";
import { jourIso } from "@/lib/jour";
import { pieceDuContrat, pieceDuDossier } from "@/lib/pieces-de-l-assistant";

/**
 * Le dossier d'un client, tel que sa fiche le range : devis (importés compris),
 * factures, avoirs, rapports d'entretien, et son contrat d'entretien.
 *
 * **Sa demande du 28 octobre 2026 :** *« il faut qu'il puisse nous donner tous
 * les documents »*. Lu par `chargerFicheClient`, la lecture même de sa fiche :
 * l'assistant et l'écran montrent les mêmes pièces, ouvertes par la même règle.
 */
export const lireDossierClient: Outil = {
  nom: "LireDossierClient",
  description:
    "Rend tous les documents d'un client : ses devis, ses factures, ses avoirs, ses rapports d'entretien et " +
    "son contrat d'entretien, chacun avec sa pièce à ouvrir. Prend le clientId rendu par LireClients. " +
    "À utiliser pour « les factures de Bernard », « le contrat de Mme Lucie », « tous les documents de… ».",
  schema: z.object({ clientId: z.string().uuid().describe("L'identifiant rendu par LireClients.") }),
  async executer({ ctx }, parametres) {
    const { clientId } = parametres as { clientId: string };
    const fiche = await chargerFicheClient(ctx, clientId);
    if (!fiche) return { trouve: false, raison: "Ce client est introuvable." };
    const client = fiche.client.nom;
    const contrat = await dernierContratDuClient(ctx, clientId);
    return {
      trouve: true,
      client,
      devis: fiche.pieces.devis.map((p) => ({ titre: p.titre, jour: p.jour, piece: pieceDuDossier("devis", p, client, clientId) })),
      factures: fiche.pieces.factures.map((p) => ({ titre: p.titre, jour: p.jour, piece: pieceDuDossier("facture", p, client, clientId) })),
      avoirs: fiche.pieces.avoirs.map((p) => ({ titre: p.titre, jour: p.jour, piece: pieceDuDossier("avoir", p, client, clientId) })),
      rapportsEntretien: fiche.pieces.fiches.map((p) => ({ jour: p.jour, piece: pieceDuDossier("rapport", p, client, clientId) })),
      contrat: contrat
        ? {
            statut: contrat.statut,
            piece: pieceDuContrat({
              contratId: contrat.id,
              client,
              date: contrat.envoyeLe ? jourIso(contrat.envoyeLe) : null,
            }),
          }
        : null,
    };
  },
};
