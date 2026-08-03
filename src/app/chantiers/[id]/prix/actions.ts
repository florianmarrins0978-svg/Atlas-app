"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ajouterLignePrix, listerLignesPrix, modifierLignePrix, supprimerLignePrix } from "@/server/repositories/lignes-prix";
import { marquerPrixValide } from "@/server/repositories/chantiers";
import { getTarif } from "@/server/repositories/tarifs";
import { preparerPropositionPrix } from "@/server/chiffrage/proposition-prix";
import { peutPreparerDevis, PrixNonPreparableError } from "@/lib/preparation-devis";
import { ligneDejaAuDetail } from "@/lib/proposition-au-detail";

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
  const proposition = await preparerPropositionPrix(ctx, chantierId);
  if (!proposition) return { succes: false, erreur: "Chantier introuvable." };

  // Le détail réel, relu en base : c'est lui qui dit si cette proposition y est
  // déjà, et non un drapeau du navigateur — celui-ci mourait au premier retour
  // arrière, et un seul appui de plus doublait le devis. L'écran grise
  // désormais le bouton, mais un écran ne protège rien : deux appuis rapides,
  // ou une page laissée ouverte pendant qu'on ajoute la ligne ailleurs,
  // arriveraient quand même ici. **La même fonction** que l'écran (`CLAUDE.md`
  // §3) — jamais une seconde version de la règle.
  const detailActuel = await listerLignesPrix(ctx, chantierId);
  function refuserSiDoublon(libelle: string | null) {
    const deja = ligneDejaAuDetail(libelle, detailActuel);
    return deja
      ? {
          succes: false as const,
          erreur: `« ${deja.libelle} » figure déjà au détail (${deja.montant} €). Modifiez cette ligne plutôt que d'en ajouter une seconde.`,
        }
      : null;
  }

  // Cas ambigu : le patron a tranché en désignant un tarif. On relit le prix
  // ACTUEL de ce tarif en base, et on vérifie qu'il faisait bien partie des
  // candidats — un id transmis au hasard ne doit rien pouvoir appliquer.
  if (proposition.origine === "tarifs_ambigus") {
    if (!tarifIdChoisi) {
      return { succes: false, erreur: "Plusieurs tarifs correspondent : choisissez celui à appliquer." };
    }
    const candidat = proposition.tarifsCandidats.find((c) => c.tarifId === tarifIdChoisi);
    if (!candidat) {
      return { succes: false, erreur: "Ce tarif ne fait pas partie des tarifs proposés pour ce chantier." };
    }
    const tarifActuel = await getTarif(ctx, candidat.tarifId);
    if (!tarifActuel) {
      return { succes: false, erreur: "Ce tarif n'existe plus." };
    }
    const doublon = refuserSiDoublon(tarifActuel.intitule);
    if (doublon) return doublon;
    const ligne = await ajouterLignePrix(ctx, chantierId, tarifActuel.intitule, tarifActuel.prix);
    return { succes: true, ligne: { id: ligne.id, libelle: ligne.libelle, montant: ligne.montant } };
  }

  if (proposition.prixPropose === null || !proposition.libelle) {
    return { succes: false, erreur: "Aucun prix ne peut être proposé en l'état." };
  }

  const doublon = refuserSiDoublon(proposition.libelle);
  if (doublon) return doublon;

  const ligne = await ajouterLignePrix(ctx, chantierId, proposition.libelle, proposition.prixPropose);
  return { succes: true, ligne: { id: ligne.id, libelle: ligne.libelle, montant: ligne.montant } };
}
