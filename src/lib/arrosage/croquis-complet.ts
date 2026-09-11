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
 * lisent la même réponse. Le piquage vient du déroulant de l'écran, jamais du
 * croquis — le croquis le PORTE (c'est l'avertissement au-dessus de la photo),
 * mais c'est le choix « compteur / robinet » qui commande le calcul.
 */

export type Manque = "metres" | "nourrice";

export type EtatDuCroquis = {
  complet: boolean;
  manque: Manque[];
  /** Ce qui a été lu, pour le dire à l'écran — coché ou barré, un par un. */
  lu: { zonesMesurees: number; nourrice: boolean; piquage: "compteur" | "ailleurs" };
};

export function etatDuCroquis(croquis: {
  zonesMesurees: number;
  nourrice: boolean;
  piquage: string;
}): EtatDuCroquis {
  const manque: Manque[] = [];
  if (croquis.zonesMesurees === 0) manque.push("metres");
  if (!croquis.nourrice) manque.push("nourrice");
  return {
    complet: manque.length === 0,
    manque,
    lu: {
      zonesMesurees: croquis.zonesMesurees,
      nourrice: croquis.nourrice,
      piquage: croquis.piquage === "compteur" ? "compteur" : "ailleurs",
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
};
