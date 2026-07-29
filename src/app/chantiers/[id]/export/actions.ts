"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { getOuCreerDevisBrouillon, envoyerDevis } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { ingererDevis } from "@/server/documents/ingestion";

export async function chargerDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  const prestations = await listerPrestations(ctx, chantierId);
  return { devis, prestations: prestations.map((p) => p.libelle) };
}

export async function envoyerDevisAction(devisId: string) {
  const ctx = await getCurrentCtx();
  const resultat = await envoyerDevis(ctx, devisId);
  try {
    // Base documentaire (lot IA-07) : rend le devis envoyé recherchable par
    // l'assistant. Un échec d'ingestion ne doit jamais faire échouer l'envoi.
    if (resultat.chantierId) await ingererDevis(ctx, resultat.chantierId);
  } catch {
    // Volontairement silencieux : voir commentaire ci-dessus.
  }
  return resultat;
}
