import Decimal from "decimal.js";

// « En HT on fait des prix ronds : 350, 400, 420, 560, etc. »
//   — le patron, le 5 août 2026 (`docs/EXEMPLE-DICTEE.md` §9b)
//
// **Pourquoi c'est une règle et pas une coquetterie.** Un devis à « 1 002,53 €
// HT » signale un prix calculé par une machine ; un devis à « 1 000 € HT » se
// lit comme un prix décidé par un artisan. Le client voit la différence, même
// s'il ne saurait pas la nommer.
//
// **Toujours à la dizaine, quel que soit le montant** (confirmé le même jour) :
// 350 €, 420 €, 1 000 €, 14 980 €. Une seule règle, aucun palier à retenir —
// un barème par tranche serait une règle de plus à tenir à jour, et il
// vieillirait sans que personne ne le voie.
//
// **Sur le montant HT de la ligne, jamais sur le total TTC**, qui doit rester
// la somme exacte de ses lignes : arrondir un total le ferait diverger de son
// détail, et un écart pareil ne se rattrape que par un avoir.

/**
 * Arrondit à la dizaine d'euros la plus proche.
 *
 * Rend `null` sur une entrée qui n'est pas un nombre — jamais `0`, qui se
 * lirait comme un prix décidé. Un montant illisible doit rester visible comme
 * tel : c'est ce qui empêche une saisie ratée de partir au client en valant
 * « gratuit ».
 */
export function arrondirALaDizaine(montant: string | number): string | null {
  let valeur: Decimal;
  try {
    valeur = new Decimal(typeof montant === "string" ? montant.trim().replace(",", ".") : montant);
  } catch {
    return null;
  }
  if (!valeur.isFinite()) return null;

  // `toNearest` arrondit au multiple demandé ; le mode par défaut de decimal.js
  // (ROUND_HALF_UP) place 355 sur 360, ce qui est le sens courant de « au plus
  // proche » pour un artisan qui préfère ne pas se sous-facturer.
  return valeur.toNearest(10).toFixed(0);
}
