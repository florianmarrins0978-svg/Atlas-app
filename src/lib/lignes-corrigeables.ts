/**
 * QUELLES LIGNES D'UNE FACTURE LE PATRON A-T-IL LE DROIT DE CORRIGER ?
 *
 * ─── LA QUESTION, ET SA VRAIE RÉPONSE ──────────────────────────────────────
 *
 * Sa règle du 9 septembre 2026 : *« le devis ne se réécrit pas, seulement la
 * case travaux supplémentaires ; le reste, impossible de les modifier »*. Elle
 * était codée telle quelle — `supplement = true` —, et c'était juste tant que
 * toute facture naissait d'un devis.
 *
 * **Sa demande du 10 septembre l'a rendue fausse d'un coup.** Une facture faite
 * sans devis n'a pas de « reste » : aucune de ses lignes n'a été acceptée par
 * le client avant, puisqu'il n'a rien reçu à accepter. Lui interdire de les
 * saisir au motif qu'elles ne sont pas des « travaux supplémentaires » aurait
 * donné une facture qu'on ne peut pas remplir.
 *
 * Ce que `supplement` disait vraiment n'était donc pas « c'est un supplément »,
 * mais **« cette ligne ne vient pas d'un devis »** — et sur une facture sans
 * devis, cela vaut pour toutes.
 *
 * ─── POURQUOI CETTE RÈGLE VIT ICI, ET NON DANS L'ÉCRAN ─────────────────────
 *
 * Elle sert deux fois, et `CLAUDE.md` §3 refuse qu'elle soit écrite deux fois :
 * l'écran s'en sert pour dessiner un champ plutôt qu'un texte, et le dépôt s'en
 * sert dans le WHERE de ses écritures. Deux rédactions auraient divergé, et
 * c'est celle de l'écriture qu'on aurait oublié de corriger — celle qui, seule,
 * empêche vraiment de réécrire un prix que le client a accepté.
 *
 * Fonction pure, sans base et sans écran : elle s'éprouve à la main.
 */

/** Ce que la règle a besoin de savoir d'une facture. Rien de plus. */
export type FacturePourCorrection = {
  /** `null` : elle est née sans devis (migration 0086). */
  devisId: string | null;
};

/** Ce que la règle a besoin de savoir d'une ligne. Rien de plus. */
export type LignePourCorrection = {
  /** Ajoutée après coup, hors du devis (migration 0082). */
  supplement: boolean | null;
};

/**
 * Une facture née SANS devis — toutes ses lignes se saisissent.
 *
 * C'est aussi ce qui décide du bloc dans lequel une ligne neuve est rangée :
 * sur une facture directe elle est une ligne ordinaire (`supplement = false`),
 * sinon un travail supplémentaire. Marquer « supplément » les lignes d'une
 * facture qui n'a jamais eu de devis ferait imprimer au client le titre
 * « TRAVAUX SUPPLÉMENTAIRES » au-dessus de la seule chose qu'on lui facture —
 * supplémentaire à quoi ?
 */
export function factureNeeSansDevis(facture: FacturePourCorrection): boolean {
  return facture.devisId === null;
}

/**
 * Cette ligne-ci se corrige-t-elle ?
 *
 * Vrai quand la facture n'a pas de devis (rien n'a été accepté d'avance), ou
 * quand la ligne a été ajoutée après lui. Faux pour ce qui vient du devis, et
 * ce refus-là ne se négocie pas : c'est le prix que le client a sous les yeux.
 */
export function ligneSeCorrige(
  facture: FacturePourCorrection,
  ligne: LignePourCorrection
): boolean {
  return factureNeeSansDevis(facture) || ligne.supplement === true;
}
