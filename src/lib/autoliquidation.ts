/**
 * LA SOUS-TRAITANCE DU BÂTIMENT, SANS TVA — son bouton du 3 octobre 2026
 * (`appli/tva-entreprise-et-mairie.html`, `docs/QUESTIONS.md` §31).
 *
 * Un sous-traitant du bâtiment ne facture pas la TVA à l'entreprise qui lui
 * donne le chantier : c'est elle qui la déclare (CGI, art. 283-2 nonies). Sa
 * facture porte alors trois choses que la loi exige :
 *
 * | | |
 * |---|---|
 * | aucune TVA | 283-2 nonies |
 * | la mention « Autoliquidation » | CGI, ann. II, 242 nonies A, 13° |
 * | le numéro de TVA du donneur d'ordre | 242 nonies A, I-4° |
 *
 * **Basculer réécrit les TAUX de la pièce, en base**, et ne laisse aucun drapeau
 * à relire ailleurs. L'écran, le PDF, la page du client, les paiements, les
 * avoirs et le relevé lisent tous `totauxAvecReduction` sur les lignes : à
 * 0 %, ils rendent tous une facture sans TVA, et aucun ne peut l'oublier. Un
 * drapeau lu à chaque endroit en aurait oublié un, et c'est celui-là qui aurait
 * réclamé la TVA au client.
 *
 * Les taux d'avant sont gardés, pour que l'enlever rende la facture telle
 * qu'elle était : une ligne à 10 % redevient à 10 %.
 */

export const MENTION_AUTOLIQUIDATION = "Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI.";

export const TAUX_SANS_TVA = "0.00";

export type TauxAvantAutoliquidation = {
  facture: string;
  lignes: Record<string, string | null>;
};

type Piece = { tauxTva: string; lignes: readonly { id: string; tauxTva: string | null }[] };

/** Les taux à écrire quand il l'active, et ceux à garder pour l'enlever. */
export function tauxSousAutoliquidation(piece: Piece): {
  tauxTva: string;
  lignes: { id: string; tauxTva: string }[];
  avant: TauxAvantAutoliquidation;
} {
  return {
    tauxTva: TAUX_SANS_TVA,
    lignes: piece.lignes.map((l) => ({ id: l.id, tauxTva: TAUX_SANS_TVA })),
    avant: {
      facture: piece.tauxTva,
      lignes: Object.fromEntries(piece.lignes.map((l) => [l.id, l.tauxTva])),
    },
  };
}

/**
 * Les taux à rendre quand il l'enlève.
 *
 * Une ligne ajoutée PENDANT n'a pas de taux d'avant : elle retombe sur celui
 * de la facture (`null`), comme toute ligne neuve. Sans taux gardés (une
 * donnée abîmée), rien ne se devine : la facture reprend son taux réglé.
 */
export function tauxRendus(
  piece: Piece,
  avant: TauxAvantAutoliquidation | null,
  tauxRegle: string
): { tauxTva: string; lignes: { id: string; tauxTva: string | null }[] } {
  return {
    tauxTva: avant?.facture ?? tauxRegle,
    lignes: piece.lignes.map((l) => ({
      id: l.id,
      tauxTva: avant && Object.prototype.hasOwnProperty.call(avant.lignes, l.id) ? (avant.lignes[l.id] ?? null) : null,
    })),
  };
}

/**
 * Le numéro de TVA tel qu'il s'imprime, ou `null` s'il n'en est pas un.
 *
 * Espaces et points retirés, lettres en capitales : « fr 12 345678901 » se lit
 * « FR12345678901 ». La forme est celle de tous les numéros européens, deux
 * lettres puis deux à treize signes ; Atlas ne prétend pas vérifier la clé.
 */
export function numeroTvaLu(saisi: string | null | undefined): string | null {
  const brut = numeroTvaBrut(saisi);
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(brut) ? brut : null;
}

/**
 * Ce que la case du n° TVA porte d'office : sa demande du 7 octobre 2026,
 * *« met le FR d'office déjà écrit »*. Neuf clients sur dix sont français ;
 * pour un autre pays, on efface les deux lettres.
 */
export const DEBUT_NUMERO_TVA = "FR";

/**
 * La case n'a pas été remplie : rien, ou les deux lettres du pays seules.
 *
 * Sans cette lecture, le « FR » posé d'office se refuserait comme un numéro
 * mal tapé, et une fiche sans numéro ne s'enregistrerait plus.
 */
export function numeroTvaVide(saisi: string | null | undefined): boolean {
  return /^([A-Z]{2})?$/.test(numeroTvaBrut(saisi));
}

function numeroTvaBrut(saisi: string | null | undefined): string {
  return String(saisi ?? "").replace(/[\s.\-]/g, "").toUpperCase();
}
