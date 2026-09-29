import { quantiteLisible } from "./lignes-du-papier";
import { uniteDeLaLigne } from "./unite-de-ligne";

/**
 * Ce qu'il y a à faire sur un chantier, lu sur les lignes de son devis, sans un
 * prix : la liste « Travaux à faire » de la fiche d'intervention, et les cases
 * du retour du jour qui en partent.
 */

/**
 * Une ligne sans texte n'est pas une tâche.
 *
 * **Sa capture du 29 septembre 2026** : une case ronde, vide, au-dessus de
 * « Coupe de cheveux homme ». Le devis garde les lignes que « + Ajouter une
 * ligne » écrit en base avant le premier mot, et `peutPreparerLaPiece` laisse
 * délibérément partir une ligne sans libellé. Le devis a donc le droit de la
 * porter ; la fiche, elle, n'a rien à en faire cocher.
 */
export function ligneSansTexte(libelle: string): boolean {
  return libelle.trim() === "";
}

export function tachesDuDevis(
  lignes: readonly { libelle: string; quantite: string; unite: string | null }[]
): string[] {
  return lignes
    .filter((l) => !ligneSansTexte(l.libelle))
    .map((l) => {
      // **La quantité s'écrit quand elle apprend quelque chose.** « 1 » ne dit
      // rien de plus que le libellé ; « 18 ml » dit combien de mètres de haie.
      // Elle s'écrit comme sur le papier du devis, unité comprise : *« le 45
      // c'est la quantité, il faut que ça s'affiche comme une quantité »* (29
      // septembre 2026), devant « — 45 » qui se lisait comme un prix.
      const q = Number(l.quantite);
      return Number.isFinite(q) && q !== 1
        ? `${l.libelle}, ${quantiteLisible(l.quantite)} ${uniteDeLaLigne(l.unite)}`
        : l.libelle;
    });
}
