import { z } from "zod";
import type { Outil } from "./types";
import { listerAchatsTva } from "../../repositories/achats-tva";
import { NATURES_ACHAT, LIBELLE_NATURE } from "@/lib/achat-tva";
import { jourIso } from "@/lib/jour";
import { pieceDuTicket } from "@/lib/pieces-de-l-assistant";

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE = 15;

/**
 * Les tickets de caisse photographiés : carburant, restaurant, matériel…
 *
 * **Sa demande du 27 octobre 2026** : *« un ticket de carburant, un ticket
 * resto »*, joint dans la discussion. Chaque ticket rend sa pièce ; un ticket
 * saisi à la main, sans photo, n'en a pas, et le dit.
 *
 * Sans période, l'année qui finit aujourd'hui : un ticket se cherche rarement
 * plus loin, et parcourir tous les achats depuis toujours ne sert personne.
 */
export const rechercherTickets: Outil = {
  nom: "RechercherTickets",
  description:
    "Cherche les tickets de caisse et achats enregistrés (carburant, repas, matériel, hôtel, transport) : " +
    "commerçant, date, montant, et la photo du ticket. Filtre par nature, par un mot du nom du commerçant, " +
    "par période (AAAA-MM-JJ). Sans période, les douze derniers mois. À utiliser pour « mon ticket de " +
    "carburant du 12 », « le ticket du restaurant », « combien d'essence ce mois-ci ».",
  schema: z.object({
    nature: z.enum(NATURES_ACHAT).nullish().describe("carburant, repas (restaurant), materiel, hotel, transport, autre."),
    commercant: z.string().nullish().describe("Tout ou partie du nom du commerçant : « Total », « Leclerc »."),
    du: z.string().regex(JOUR).nullish().describe("Premier jour, compris, AAAA-MM-JJ."),
    au: z.string().regex(JOUR).nullish().describe("Dernier jour, compris, AAAA-MM-JJ."),
  }),
  async executer({ ctx }, parametres) {
    const p = parametres as { nature?: string | null; commercant?: string | null; du?: string | null; au?: string | null };
    const au = p.au ?? jourIso(new Date());
    // Par le calendrier, pas par le texte : « 2028-02-29 » moins un an
    // n'existe pas, et la base refuserait la date.
    const ilYAUnAn = new Date(`${au}T12:00:00Z`);
    ilYAUnAn.setUTCFullYear(ilYAUnAn.getUTCFullYear() - 1);
    const du = p.du ?? ilYAUnAn.toISOString().slice(0, 10);
    const mot = (p.commercant ?? "").trim().toLowerCase();

    const achats = (await listerAchatsTva(ctx, du, au)).filter(
      (a) => (!p.nature || a.nature === p.nature) && (!mot || a.fournisseur.toLowerCase().includes(mot))
    );
    if (achats.length === 0) return { trouve: false, raison: `Aucun ticket du ${du} au ${au} ne correspond.` };

    return {
      trouve: true,
      periode: { du, au },
      nombre: achats.length,
      tickets: achats.slice(0, LIMITE).map((a) => ({
        commercant: a.fournisseur,
        date: a.dateAchat,
        totalTtc: a.totalTtc,
        nature: a.nature ? LIBELLE_NATURE[a.nature] : null,
        // Un achat saisi à la main n'a pas de photo : rien à joindre.
        piece: a.photoCle
          ? pieceDuTicket({
              achatId: a.id,
              fournisseur: a.fournisseur,
              date: a.dateAchat,
              montant: a.totalTtc,
              nature: a.nature ? LIBELLE_NATURE[a.nature] : null,
            })
          : null,
      })),
      autresNonMontres: Math.max(0, achats.length - LIMITE),
    };
  },
};
