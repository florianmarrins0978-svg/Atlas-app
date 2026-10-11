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
 *
 * **Et une facture DIRECTE non plus** (migration 0086). Elle n'a jamais eu de
 * devis : le seul cas où elle en croiserait un est celui d'un devis écrit APRÈS
 * coup sur le même chantier — et « reprendre » voudrait alors dire remplacer
 * les lignes qu'il vient de saisir par celles d'un document qu'il a écrit
 * ensuite. C'est un effacement, pas une mise à jour. La porte reste fermée, et
 * `creerFactureSansDevis` refuse d'ailleurs déjà un chantier qui porte un devis.
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
  facture: { devisId: string | null; statut: "brouillon" | "emise" },
  devisQuiFaitFoi: DevisQuiFaitFoi
): EtatDeReprise {
  if (facture.statut === "emise") return { aJour: true };
  // Une facture directe n'a rien à suivre : elle n'est en retard sur aucun devis.
  if (facture.devisId === null) return { aJour: true };
  if (!devisQuiFaitFoi) return { aJour: true };
  if (devisQuiFaitFoi.id === facture.devisId) return { aJour: true };
  return {
    aJour: false,
    numeroCommercial: devisQuiFaitFoi.numeroCommercial,
    numeroVersion: devisQuiFaitFoi.numeroVersion,
  };
}
