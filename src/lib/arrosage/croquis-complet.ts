/**
 * SANS CROQUIS COMPLET, AUCUN PLAN — sa règle du 21 août 2026, `CLAUDE.md`
 * §4 bis : *« l'outil doit fonctionner avec un plan avec toutes les métrées,
 * l'emplacement du piquage et l'endroit définitif de la nourrice — sans ça il
 * ne doit rien proposer »*.
 *
 * **Cette règle vivait dans un commentaire, et le code faisait l'inverse.**
 * Jusqu'au 11 septembre 2026, un croquis sans nourrice rendait quand même la
 * liste des pièces, avec une réserve rouge sous vingt-trois lignes — le
 * commentaire de l'action affirmait « elle est refusée plus haut, à la
 * lecture », et rien ne la refusait. Un plan sans nourrice se photographie et
 * se commande : c'est exactement ce qu'il a refusé (*« il n'est pas valable
 * avec cette nouvelle règle »*).
 *
 * **Pure, et à un seul endroit** : l'écran du refus et la garde de l'action
 * lisent la même réponse. Les trois éléments se lisent sur le croquis ; le
 * déroulant « compteur / robinet » de l'écran, lui, ne commande que le débit.
 */

export type Manque = "metres" | "nourrice" | "piquage";

export type EtatDuCroquis = {
  complet: boolean;
  manque: Manque[];
  /** Ce qui a été lu, pour le dire à l'écran — coché ou barré, un par un. */
  lu: { zonesMesurees: number; nourrice: boolean; piquage: boolean; branchement: "compteur" | "ailleurs" };
};

/**
 * **Le piquage se lit sur le croquis, depuis le 11 septembre 2026.** Jusque-là
 * le déroulant de l'écran suffisait à le tenir pour acquis ; mais c'est sa
 * PLACE qui donne la longueur de l'amenée (*« elle doit être calculée, ni lue
 * ni supposée »*), et le déroulant ne dit que compteur ou robinet. Les deux
 * restent : le déroulant commande le débit, le croquis commande la longueur.
 */
export function etatDuCroquis(croquis: {
  zonesMesurees: number;
  nourrice: boolean;
  piquage: boolean;
  branchement: string;
}): EtatDuCroquis {
  const manque: Manque[] = [];
  if (croquis.zonesMesurees === 0) manque.push("metres");
  if (!croquis.piquage) manque.push("piquage");
  if (!croquis.nourrice) manque.push("nourrice");
  return {
    complet: manque.length === 0,
    manque,
    lu: {
      zonesMesurees: croquis.zonesMesurees,
      nourrice: croquis.nourrice,
      piquage: croquis.piquage,
      branchement: croquis.branchement === "compteur" ? "compteur" : "ailleurs",
    },
  };
}

/** Le refus, dans ses mots : ce qui manque, et le seul geste qui débloque. */
export const LIBELLES: Record<Manque, { titre: string; geste: string }> = {
  nourrice: {
    titre: "Pas de plan : il manque la nourrice.",
    geste: "Dessinez son emplacement définitif sur le croquis, puis reprenez la photo.",
  },
  metres: {
    titre: "Pas de plan : il manque les métrés.",
    geste: "Écrivez la longueur et la largeur de chaque partie du jardin, puis reprenez la photo.",
  },
  piquage: {
    titre: "Pas de plan : il manque le piquage.",
    geste: "Marquez sur le croquis l’endroit où l’arrosage se branche sur l’eau, puis reprenez la photo.",
  },
};
