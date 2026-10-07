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

/**
 * Les mêmes lignes, sans celles qui n'ont pas de texte. Vaut pour le devis
 * comme pour un retour déjà parti : *« je ne veux plus avoir de bulle vide »*
 * (29 septembre 2026), et un retour envoyé avant cette règle en porte encore.
 */
export function sansLigneVide<T extends { libelle: string }>(lignes: readonly T[]): T[] {
  return lignes.filter((l) => !ligneSansTexte(l.libelle));
}

export function tachesDuDevis(
  lignes: readonly { libelle: string; quantite: string; unite: string | null }[]
): string[] {
  return sansLigneVide(lignes).map((l) => {
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

// ─── Les travaux écrits à la main ─────────────────────────────────────────

/**
 * D'où vient la liste « Travaux à faire » : du devis, ou de la main du patron.
 *
 * **Sa réponse du 7 octobre 2026** (`appli/travaux-sans-devis.html`) : un
 * client posé au planning sans devis doit pouvoir porter ses travaux, écrits
 * à la main sur la fiche ; et quand le devis part ensuite, *ses lignes
 * remplacent* ces travaux (son choix 1). Une seule liste à l'écran, celle que
 * le client a reçue.
 *
 * | ce que le chantier porte | ce qui s'affiche |
 * |---|---|
 * | un devis ENVOYÉ | ses lignes, toujours |
 * | des travaux écrits à la main | eux, même si un brouillon existe |
 * | un brouillon seul, avec des lignes | ses lignes, comme avant |
 * | rien | une liste vide, qu'on peut remplir à la main |
 *
 * **Un brouillon ne remplace rien** : il n'est pas parti, il peut être à moitié
 * écrit, et son choix porte sur le devis qui PART.
 */
export type TravauxAffiches = { taches: string[]; aLaMain: boolean };

export function travauxAffiches(source: {
  envoye: string[] | null;
  brouillon: string[] | null;
  aLaMain: readonly string[];
}): TravauxAffiches {
  if (source.envoye !== null) return { taches: source.envoye, aLaMain: false };
  if (source.aLaMain.length === 0 && source.brouillon !== null && source.brouillon.length > 0) {
    return { taches: source.brouillon, aLaMain: false };
  }
  return { taches: [...source.aLaMain], aLaMain: true };
}

/** Un travail tient sur une ligne de fiche ; la colonne en porte cent au plus (migration 0123). */
export const TRAVAIL_MAX = 200;
export const TRAVAUX_MAX = 100;

/** Le refus d'un travail à ajouter, dans ses mots, ou `null` s'il passe. */
export function refusDuTravail(libelle: string, dejaLa: number): string | null {
  if (ligneSansTexte(libelle)) return "Écrivez le travail avant de l’ajouter.";
  if (libelle.trim().length > TRAVAIL_MAX) return `Un travail tient en ${TRAVAIL_MAX} caractères.`;
  if (dejaLa >= TRAVAUX_MAX) return `Cette fiche porte déjà ${TRAVAUX_MAX} travaux.`;
  return null;
}
