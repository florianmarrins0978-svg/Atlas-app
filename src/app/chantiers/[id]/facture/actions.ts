"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import {
  emettreFacture,
  terminerChantier,
  FactureDejaEmiseError,
  FinChantierImpossibleError,
} from "@/server/repositories/factures";

// Arrêt 3 du parcours (docs/AGENT.md §2.3) : le patron confirme le départ de
// la facture. Décidé, pas optionnel — un chantier finit rarement exactement
// comme il a été devisé, et une facture fausse se corrige par un avoir.

const MOTIFS: Record<FinChantierImpossibleError["motif"], string> = {
  devis_absent: "Ce chantier n'a pas de devis : il n'y a rien à facturer.",
  devis_non_envoye:
    "Le devis de ce chantier n'a jamais été envoyé. Facturer un prix que le client n'a pas vu n'a pas de sens.",
  deja_facture: "La facture de ce chantier est déjà émise.",
};

export type ResultatFinChantier =
  | { succes: true; factureId: string }
  | { succes: false; erreur: string };

export async function terminerChantierAction(chantierId: string): Promise<ResultatFinChantier> {
  const ctx = await getCurrentCtx();
  try {
    const facture = await terminerChantier(ctx, chantierId);
    return { succes: true, factureId: facture.id };
  } catch (err) {
    if (err instanceof FinChantierImpossibleError) {
      return { succes: false, erreur: MOTIFS[err.motif] };
    }
    throw err;
  }
}

export type ResultatEmission = { succes: true; numero: string } | { succes: false; erreur: string };

/**
 * Fige la facture et la porte au relevé de TVA.
 *
 * Le relevé n'est pas écrit ici : il se calcule à partir des factures émises
 * (voir `releveTvaCollectee`). Émettre, c'est donc l'y inscrire — sans qu'une
 * seconde écriture puisse un jour diverger de la première.
 */
export async function emettreFactureAction(factureId: string): Promise<ResultatEmission> {
  const ctx = await getCurrentCtx();
  try {
    const facture = await emettreFacture(ctx, factureId);
    return { succes: true, numero: facture.numeroCommercial };
  } catch (err) {
    if (err instanceof FactureDejaEmiseError) {
      return { succes: false, erreur: err.message };
    }
    throw err;
  }
}
