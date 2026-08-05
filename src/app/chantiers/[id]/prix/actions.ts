"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterLignePrix, listerLignesPrix, modifierLignePrix, supprimerLignePrix } from "@/server/repositories/lignes-prix";
import { marquerPrixValide } from "@/server/repositories/chantiers";
import { preparerPropositionPrix, appliquerProposition } from "@/server/chiffrage/proposition-prix";
import { peutPreparerDevis, PrixNonPreparableError } from "@/lib/preparation-devis";

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

  // L'écran grise déjà le bouton, mais un écran ne protège rien : une page
  // restée ouverte pendant qu'on supprime la dernière ligne ailleurs, ou un
  // second appui, suffiraient à valider un prix inexistant. On relit les
  // lignes en base et on applique **la même fonction** que l'écran
  // (`CLAUDE.md` §3) — jamais une seconde version de la règle.
  const lignes = await listerLignesPrix(ctx, chantierId);
  const verdict = peutPreparerDevis(lignes);
  if (!verdict.possible) {
    throw new PrixNonPreparableError(`${verdict.probleme} ${verdict.marcheASuivre}`);
  }

  return marquerPrixValide(ctx, chantierId);
}

// --- Proposition de prix -------------------------------------------------

// Recalcule la proposition côté serveur, à la demande. N'écrit rien : afficher
// un prix n'est pas le retenir.
export async function calculerPropositionPrixAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return preparerPropositionPrix(ctx, chantierId);
}

// Ajoute la proposition au détail du chantier, sur action explicite.
//
// Le montant n'est JAMAIS repris de ce que le navigateur affiche : la
// proposition est recalculée ici, à partir des données en base, et c'est ce
// résultat-là qui est écrit. Un détail falsifié côté client n'a donc aucun effet.
export async function appliquerPropositionPrixAction(
  chantierId: string,
  tarifIdChoisi?: string
): Promise<{ succes: true; ligne: { id: string; libelle: string; montant: string } } | { succes: false; erreur: string }> {
  const ctx = await getCurrentCtx();
  const resultat = await appliquerProposition(ctx, chantierId, tarifIdChoisi);
  // `ambigu` sert au tapis roulant pour savoir qu'il doit s'arrêter et
  // demander ; l'écran, lui, n'a besoin que du message.
  if (!resultat.succes) return { succes: false, erreur: resultat.erreur };
  return resultat;
}
