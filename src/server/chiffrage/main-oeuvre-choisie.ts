import type { Ctx } from "../repositories/context";
import { lireMarges, prixAchatCandidats } from "../repositories/fournisseurs-partenaires";
import { listerTarifs } from "../repositories/tarifs";
import { parseNombreFrancais } from "./parse";
import { tarifJourHomme } from "@/lib/tarif-main-oeuvre";
import {
  ligneDeSonEquipe,
  ligneDeSonPartenaire,
  prixDesPartenaires,
  type ChoixDeMainOeuvre,
  type DonneesMainOeuvre,
  type LigneDeMainOeuvre,
} from "@/lib/feuille-main-oeuvre";

/**
 * ─── LA FEUILLE « MAIN D'ŒUVRE », CÔTÉ SERVEUR — le devis ET la facture ──────
 *
 * Née sur le devis le 1er novembre 2026, montée sur la facture le 4 novembre
 * (*« le bouton ma TVA, main d'œuvre, est le même qu'à l'ancienne »*). Ce qui
 * ouvre la feuille et ce qui relit son choix vivaient dans l'écran et dans
 * les actions du devis : deux pièces les emploient désormais, et une seconde
 * rédaction aurait chiffré autrement au premier ajustement (`CLAUDE.md` §3).
 */

/** Ce que la feuille montre en s'ouvrant : repris de sa dictée, de ses tarifs, de ses partenaires. */
export async function donneesDeLaMainOeuvre(
  ctx: Ctx,
  chantier: { tailleEquipe: string | null; dureePrevue: string | null }
): Promise<DonneesMainOeuvre> {
  const [tarifs, candidats, marges] = await Promise.all([listerTarifs(ctx), prixAchatCandidats(ctx), lireMarges(ctx)]);
  return {
    // Repris de sa dictée quand elle les a dits (`chantiers.taille_equipe`,
    // `duree_prevue`), comme « Avant de chiffrer » les lit.
    hommes: parseNombreFrancais(chantier.tailleEquipe),
    jours: parseNombreFrancais(chantier.dureePrevue),
    tarifJour: tarifJourHomme(tarifs)?.prix ?? null,
    partenaires: prixDesPartenaires(candidats, marges),
  };
}

/** La ligne qu'un choix produit, recalculée sur ses prix ; un refus en mots sinon. */
export async function ligneDuChoix(ctx: Ctx, choix: ChoixDeMainOeuvre): Promise<LigneDeMainOeuvre | { raison: string }> {
  if (choix.qui === "equipe") {
    const hommes = Number(choix.hommes);
    const jours = Number(choix.jours);
    if (!(hommes > 0 && hommes <= 99 && jours > 0 && jours <= 365)) {
      return { raison: "Le nombre d'hommes ou la durée ne se lit pas. Rechargez l'écran." };
    }
    // Le tarif est celui que la feuille portait au moment de l'appui : le sien
    // repris, corrigé, ou effacé exprès (la ligne arrive alors à chiffrer).
    // Le reprendre ici d'office contredirait ce qu'elle lui a montré.
    return ligneDeSonEquipe(hommes, jours, choix.tarif);
  }
  const quantite = Number(choix.quantite);
  if (!(quantite > 0 && quantite <= 99999)) return { raison: "Écrivez une quantité au-dessus de zéro." };
  const [candidats, marges] = await Promise.all([prixAchatCandidats(ctx), lireMarges(ctx)]);
  const prix = prixDesPartenaires(candidats, marges).find((p) => p.id === choix.prixId);
  if (!prix) return { raison: "Ce prix de partenaire n'existe plus. Rechargez l'écran." };
  return ligneDeSonPartenaire(prix, quantite);
}
