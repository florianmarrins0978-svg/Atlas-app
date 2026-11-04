import { enEuros } from "./euros";
import {
  pourcentValide,
  tauxLisible,
  tauxTvaValide,
  totauxAvecReduction,
  type LigneRemisable,
} from "./reduction-devis";

/**
 * ─── CE QUE LES FEUILLES DE LA TVA ET DE LA REMISE ACCEPTENT, ET MONTRENT ───
 *
 * Nées sur le devis le 1er novembre 2026 (sa réponse *« TVA, acompte, remise,
 * je dois pouvoir écrire ce que je veux »*), reprises par la facture le
 * 4 novembre : *« le bouton ma TVA, main d'œuvre, est le même qu'à
 * l'ancienne »*. Deux écrans montent la même feuille ; ce qu'elle lit et ce
 * qu'elle annonce vit ici, une seule fois, sans quoi le premier ajustement
 * n'irait que sur l'un des deux (`CLAUDE.md` §3).
 *
 * **Les jugements sont ceux que le serveur oppose ensuite** (`tauxTvaValide`,
 * `pourcentValide`) et l'aperçu passe par `totauxAvecReduction`, la règle des
 * totaux : le chiffre montré avant d'appliquer est celui qui sera posé.
 */

/** Ce qu'une feuille lit dans sa case : un taux propre, ou ce qui ne va pas, en mots. */
export type LectureDuTaux = { taux: string } | { refus: string };

/** Ce que l'ajout produira, montré avant d'ajouter. */
export type ApercuDuTaux = {
  calcul: string;
  montant: string;
  dessous?: string;
};

/** La pièce où la TVA s'ajoute, telle que la phrase du refus la nomme. */
export type PieceDeLaTva = "ce devis" | "cette facture";

/**
 * Le taux d'une TVA à ajouter. **Un taux déjà ouvert se refuse** : deux
 * catégories au même taux couperaient une seule TVA en deux tableaux.
 * `dejaOuverts` porte les taux des catégories (`tauxDeLaLigne`, deux décimales).
 */
export function lireUneTva(saisie: string, dejaOuverts: readonly string[], piece: PieceDeLaTva): LectureDuTaux {
  const taux = tauxTvaValide(saisie);
  if (taux === null) return { refus: "Écrivez un taux, par exemple 10." };
  if (dejaOuverts.includes(taux)) return { refus: `Une TVA à ${tauxLisible(taux)} % est déjà sur ${piece}.` };
  return { taux };
}

/** Le pourcentage d'une remise. Zéro n'en est pas une (`pourcentValide`). */
export function lireUneRemise(saisie: string): LectureDuTaux {
  const taux = pourcentValide(saisie);
  return taux === null ? { refus: "Écrivez un pourcentage au-dessus de zéro, par exemple 5." } : { taux };
}

/**
 * Ce que la remise retire, avant d'être posée : les lignes de la pièce, la
 * remise en plus, par la règle de ses totaux. Ce qui ne la reçoit pas (un
 * travail en plus d'une facture) n'y entre pas, puisque la règle l'écarte.
 */
export function apercuDeLaRemise(
  lignes: readonly LigneRemisable[],
  tauxDuDocument: string,
  taux: string
): ApercuDuTaux {
  const avec = totauxAvecReduction(lignes, tauxDuDocument, taux);
  const retire = Number(avec.brutHt) - Number(avec.totalHt);
  return {
    calcul: `${tauxLisible(taux)} % de ${enEuros(avec.brutHt)} HT`,
    montant: `− ${enEuros(retire)}`,
    dessous: `Total HT après remise : ${enEuros(avec.totalHt)}`,
  };
}
