import { z } from "zod";
import type { Outil } from "./types";
import { listerSocietes } from "../../repositories/fournisseurs-partenaires";
import { pieceDuFournisseur } from "@/lib/pieces-de-l-assistant";

const LIMITE = 15;

/**
 * Les factures et devis REÇUS des fournisseurs et des partenaires.
 *
 * **Sa demande du 28 octobre 2026** : tous les documents. Ceux-là sont rangés
 * dans Réglages, par société ; un tableur n'a pas de pièce à ouvrir, il se
 * télécharge depuis l'écran.
 */
export const rechercherPiecesFournisseurs: Outil = {
  nom: "RechercherPiecesFournisseurs",
  description:
    "Cherche les factures et devis REÇUS des fournisseurs et partenaires : société, nom, montant, date, et la " +
    "pièce à ouvrir. Filtre par un mot du nom de la société ou du document, et par genre (facture ou devis).",
  schema: z.object({
    mot: z.string().nullish().describe("Tout ou partie du nom de la société ou du document."),
    genre: z.enum(["facture", "devis"]).nullish(),
  }),
  async executer({ ctx }, parametres) {
    const p = parametres as { mot?: string | null; genre?: "facture" | "devis" | null };
    const mot = (p.mot ?? "").trim().toLowerCase();
    const societes = [...(await listerSocietes(ctx, "fournisseur")), ...(await listerSocietes(ctx, "partenaire"))];
    const recus = societes
      .flatMap((s) => s.devis.map((d) => ({ societe: s.nom, d })))
      .filter(({ societe, d }) => (!p.genre || d.genre === p.genre) && (!mot || `${societe} ${d.nom}`.toLowerCase().includes(mot)))
      .sort((a, b) => b.d.recuLe.localeCompare(a.d.recuLe));
    if (recus.length === 0) return { trouve: false, raison: "Aucune pièce reçue ne correspond." };
    return {
      trouve: true,
      nombre: recus.length,
      pieces: recus.slice(0, LIMITE).map(({ societe, d }) => ({
        societe,
        nom: d.nom,
        genre: d.genre,
        totalTtc: d.totalTtc,
        recuLe: d.recuLe,
        piece: pieceDuFournisseur({
          recuId: d.id,
          nom: d.nom,
          societe,
          genre: d.genre,
          nature: d.nature,
          montant: d.totalTtc,
          date: d.recuLe,
        }),
      })),
      autresNonMontres: Math.max(0, recus.length - LIMITE),
    };
  },
};
