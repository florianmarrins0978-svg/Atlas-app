import type { Ctx } from "../repositories/context";
import { ajouterLignePrix, listerLignesPrix } from "../repositories/lignes-prix";
import { getTarif } from "../repositories/tarifs";
import { preparerPropositionPrix } from "./proposition-prix";
import { ligneDejaAuDetail } from "../../lib/proposition-au-detail";

export type ResultatApplicationPrix =
  | { succes: true; ligne: { id: string; libelle: string; montant: string } }
  | { succes: false; erreur: string };

/**
 * Porte la proposition de prix au détail du chantier.
 *
 * **Le montant n'est jamais repris de ce que le navigateur affiche** : la
 * proposition est recalculée ici, à partir des données en base, et c'est ce
 * résultat-là qui est écrit. Un détail falsifié côté client n'a donc aucun effet.
 *
 * Vit dans un service, et non dans l'action de l'écran Prix, parce que deux
 * chemins l'appellent : le bouton « Ajouter au détail », et l'enchaînement
 * complet depuis la dictée. Une seconde implémentation aurait rouvert le défaut
 * du 3 août — un devis doublé — sur le chemin le moins souvent relu.
 */
export async function appliquerPropositionPrix(
  ctx: Ctx,
  chantierId: string,
  tarifIdChoisi?: string
): Promise<ResultatApplicationPrix> {
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
