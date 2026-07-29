"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterLignePrix, modifierLignePrix, supprimerLignePrix } from "@/server/repositories/lignes-prix";
import { marquerPrixValide } from "@/server/repositories/chantiers";

export async function ajouterLignePrixAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return ajouterLignePrix(ctx, chantierId, "", "0.00");
}

// Utilisée uniquement par le flux IA (confirmation de proposition) : insère
// le libellé et le montant définitifs en un seul appel, donc une seule
// transaction — jamais de ligne vide intermédiaire (remédiation bug 4).
// Le flux manuel de l'écran Prix continue d'utiliser ajouterLignePrixAction
// ci-dessus (ligne vide puis édition inline), UX inchangée.
export async function ajouterLignePrixDirectAction(chantierId: string, libelle: string, montant: string) {
  const ctx = await getCurrentCtx();
  return ajouterLignePrix(ctx, chantierId, libelle, montant);
}

export async function modifierLignePrixAction(id: string, data: { libelle?: string; montant?: string }) {
  const ctx = await getCurrentCtx();
  return modifierLignePrix(ctx, id, data);
}

export async function supprimerLignePrixAction(id: string) {
  const ctx = await getCurrentCtx();
  return supprimerLignePrix(ctx, id);
}

// Réutilise le jalon prixValideAt déjà établi par l'architecture (même motif que
// la validation des Informations) — ne crée aucun devis, ne modifie aucun autre
// champ du chantier.
export async function validerPrixAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return marquerPrixValide(ctx, chantierId);
}
