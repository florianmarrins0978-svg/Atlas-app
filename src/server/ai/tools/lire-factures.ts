import { z } from "zod";
import type { Outil } from "./types";
import { facturesAvecPaiements } from "../../repositories/paiements-facture";
import { listerFacturesNonPayees } from "../../repositories/factures-non-payees";
import { totalRecu } from "@/lib/acomptes-facture";
import { bilanDeLaPeriode } from "@/lib/bilan-periode";

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

const LIMITE = 30;

/**
 * Les factures émises, ce qui a été payé, et ce qui reste dû.
 *
 * **Sa demande du 26 septembre 2026 :** *« nourris-le de tout ce qu'il est
 * possible de le nourrir »*. L'assistant ne voyait aucune facture : à « qui me
 * doit de l'argent ? », il n'avait rien à lire, et répondait qu'il ne savait
 * pas, sur une application qui le sait.
 *
 * **Les montants sortent du dépôt, jamais d'un calcul du modèle.** Le reste dû
 * et l'état sont ceux de l'écran « En attente » (`facturesAvecPaiements`), et
 * le total est la même addition au centime (`totalRecu`, qui ne fait que
 * sommer des montants). Un modèle qui additionne trente montants de tête se
 * trompe, et c'est ce chiffre-là qu'on répète au client.
 *
 * **Il lit, il n'écrit rien** : noter un paiement reste le geste du patron.
 */
export const lireFactures: Outil = {
  nom: "LireFactures",
  description:
    "Lit les factures ÉMISES de l'entreprise : numéro, date, client, montants, paiements reçus, reste dû et " +
    "état (en_attente, partielle, soldee), et si elle a été déclarée non payée. Rend aussi le total restant dû " +
    "des factures retenues. À utiliser pour « qui me doit de l'argent », « est-ce que X a payé », « combien il " +
    "reste à encaisser », « la facture n° … ». Les brouillons pas encore émis n'y sont pas. " +
    "Avec « du » et « au » (AAAA-MM-JJ), rend aussi le bilan de la période : ce qui a été facturé (avoirs " +
    "retirés) et encaissé. À utiliser pour « combien j'ai facturé en septembre », « combien j'ai encaissé cette " +
    "année », « mon chiffre d'affaires ». Donne ces chiffres tels quels, ne les additionne jamais toi-même.",
  schema: z.object({
    client: z.string().nullish().describe("Tout ou partie du nom du client. Vide : tous les clients."),
    numero: z.string().nullish().describe("Tout ou partie du numéro de facture."),
    etat: z
      .enum(["toutes", "a_encaisser", "soldees", "non_payees"])
      .nullish()
      .describe(
        "a_encaisser : pas encore soldées. soldees : entièrement payées. non_payees : déclarées non payées " +
          "par le patron. Vide : toutes."
      ),
    du: z.string().regex(JOUR).nullish().describe("Premier jour de la période, compris, AAAA-MM-JJ."),
    au: z.string().regex(JOUR).nullish().describe("Dernier jour de la période, compris, AAAA-MM-JJ."),
  })
    // Une période a deux bornes. Une seule, et le modèle aurait laissé
    // l'outil deviner l'autre : « depuis septembre » jusqu'à quand ?
    .refine((v) => Boolean(v.du) === Boolean(v.au), { message: "Donne « du » ET « au », ou aucun des deux." }),
  async executer({ ctx }, parametres) {
    const p = parametres as {
      client?: string | null;
      numero?: string | null;
      etat?: string | null;
      du?: string | null;
      au?: string | null;
    };
    const [toutes, declarees] = await Promise.all([facturesAvecPaiements(ctx), listerFacturesNonPayees(ctx)]);
    const nonPayees = new Set(declarees.map((f) => f.factureId));

    const client = (p.client ?? "").trim().toLowerCase();
    const numero = (p.numero ?? "").trim().toLowerCase();
    const duClient = toutes.filter((f) => {
      if (client && !(f.clientNom ?? "").toLowerCase().includes(client)) return false;
      if (numero && !f.numeroCommercial.toLowerCase().includes(numero)) return false;
      return true;
    });
    // **Le bilan se compte sur les factures du client, pas sur celles de la
    // période** : un règlement d'octobre sur une facture de septembre est de
    // l'argent d'octobre (`bilanDeLaPeriode`).
    const bilan = p.du && p.au ? bilanDeLaPeriode(duClient, p.du, p.au) : null;
    const retenues = duClient.filter((f) => {
      if (bilan && (f.dateEmission < bilan.du || f.dateEmission > bilan.au)) return false;
      if (p.etat === "a_encaisser") return f.etat !== "soldee";
      if (p.etat === "soldees") return f.etat === "soldee";
      if (p.etat === "non_payees") return nonPayees.has(f.id);
      return true;
    });

    if (retenues.length === 0 && !bilan) return { trouve: false, raison: "Aucune facture émise ne correspond." };
    return {
      trouve: retenues.length > 0,
      bilan,
      nombre: retenues.length,
      totalResteDu: totalRecu(retenues.map((f) => ({ montant: f.reste }))),
      factures: retenues.slice(0, LIMITE).map((f) => ({
        numero: f.numeroCommercial,
        dateEmission: f.dateEmission,
        client: f.clientNom,
        chantierId: f.chantierId,
        totalHt: f.totalHt,
        totalTtc: f.totalTtc,
        resteDu: f.reste,
        etat: f.etat,
        declareeNonPayee: nonPayees.has(f.id),
        paiements: f.paiements.map((r) => ({ date: r.date, montant: r.montant, moyen: r.moyen })),
      })),
      autresNonMontrees: Math.max(0, retenues.length - LIMITE),
    };
  },
};
