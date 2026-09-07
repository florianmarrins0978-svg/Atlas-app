/**
 * LA FACTURE REPREND-ELLE ENCORE LE DEVIS QUI FAIT FOI ?
 *
 * **Le défaut qu'elle referme, et il coûtait de l'argent.** Une facture naît en
 * brouillon du devis le plus récent (`terminerChantier`). Si un devis est
 * corrigé et renvoyé APRÈS — un supplément accepté, une ligne ajoutée au réel —,
 * la facture, elle, ne bouge plus : elle garde les lignes et les montants de la
 * version d'avant. Rien à l'écran ne le disait, et le second arrêt du parcours
 * — le seul qui engage son argent — se franchissait donc sur l'ancien prix.
 *
 * **Pourquoi une règle plutôt qu'une reprise automatique.** Réécrire sa facture
 * dans son dos serait pire que le défaut : les montants changeraient entre le
 * moment où il ouvre l'écran et celui où il appuie. La règle DIT, l'écran
 * montre, et c'est un geste de lui qui reprend — `CLAUDE.md` §4.
 *
 * **Une facture ARRÊTÉE ne se compare à rien.** Elle est partie chez le client
 * et inscrite au relevé : lui reprocher de ne pas suivre un devis postérieur
 * serait un avertissement qu'aucun geste ne peut lever, c'est-à-dire du bruit
 * qu'on apprend à ignorer (`CLAUDE.md` §4 ter).
 */

/** Le devis dont le client a vu le prix — la dernière version ENVOYÉE. */
export type DevisQuiFaitFoi = {
  id: string;
  numeroCommercial: string;
  numeroVersion: number;
} | null;

export type EtatDeReprise =
  | { aJour: true }
  | {
      aJour: false;
      /** Ce que l'écran nomme : le devis que la facture devrait reprendre. */
      numeroCommercial: string;
      numeroVersion: number;
    };

export function repriseDuDevis(
  facture: { devisId: string; statut: "brouillon" | "emise" },
  devisQuiFaitFoi: DevisQuiFaitFoi
): EtatDeReprise {
  if (facture.statut === "emise") return { aJour: true };
  if (!devisQuiFaitFoi) return { aJour: true };
  if (devisQuiFaitFoi.id === facture.devisId) return { aJour: true };
  return {
    aJour: false,
    numeroCommercial: devisQuiFaitFoi.numeroCommercial,
    numeroVersion: devisQuiFaitFoi.numeroVersion,
  };
}
