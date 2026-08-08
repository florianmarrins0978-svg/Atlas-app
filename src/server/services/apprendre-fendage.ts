import type { Ctx } from "../repositories/context";
import { listerPrecisions } from "../repositories/precisions-chantier";
import { listerPrestations } from "../repositories/prestations";
import { getBrouillon } from "../repositories/brouillons-informations";
import { poserPrixFendage } from "../repositories/grille-fendage";
import { celluleFendage } from "../../lib/grille-fendage";
import { mesuresArbre } from "../../lib/mesures-arbre";

/** Ce qu'on fend — même vocabulaire que le découpage des lignes. */
const FENDAGE = /\b(fend|fente)/i;

/**
 * La grille de fendage se remplit toute seule, à partir des devis réels.
 *
 * **Pourquoi ça compte plus que la saisie à la main.** Une grille de 48 cases
 * que le patron devrait remplir avant de s'en servir ne serait jamais remplie —
 * il a un métier, et ce n'est pas celui-là. Elle se remplit donc par l'usage :
 * il pose un prix de fente sur un devis, et la case correspondante retient sa
 * décision pour les chantiers suivants. Sa phrase du 7 août : *« le mieux, c'est
 * que je fasse plein de devis et que tu enregistres toutes mes modifications, et
 * dans un mois tu sauras les remplir tout seul. »*
 *
 * **Ce qu'elle ne fait jamais :** écraser un prix qu'il a posé lui-même dans
 * les réglages. Une décision explicite l'emporte sur une observation — la
 * garde vit dans `poserPrixFendage`.
 *
 * Silencieuse et non bloquante par construction : l'appelant l'enveloppe dans
 * un `try`. Ne pas savoir tirer une leçon d'une ligne ne doit jamais empêcher
 * d'écrire cette ligne.
 */
export async function apprendrePrixFendage(
  ctx: Ctx,
  chantierId: string,
  ligne: { libelle: string; montant: string }
): Promise<void> {
  if (!FENDAGE.test(ligne.libelle)) return;

  const montant = Number(ligne.montant);
  // Un zéro n'est pas une décision : c'est une ligne pas encore remplie. La
  // retenir ferait proposer « 0 € » avec l'autorité de sa grille.
  if (!Number.isFinite(montant) || montant <= 0) return;

  const [precisions, prestations, brouillon] = await Promise.all([
    listerPrecisions(ctx, chantierId),
    listerPrestations(ctx, chantierId),
    getBrouillon(ctx, chantierId),
  ]);

  // Les mesures peuvent être partout : dans ses réponses à l'arrêt, dans le
  // libellé de la ligne qu'il vient d'écrire, dans une prestation, ou dans la
  // description de la dictée — la seule à porter « vingt mètres de haut », et
  // la seule que la table `prestations` ne conserve pas. **Les mêmes sources
  // que le chiffrage** : ranger un prix dans une case que le chiffrage ne sait
  // pas retrouver reviendrait à ne rien ranger du tout.
  const mesures = mesuresArbre(
    [...precisions.map((p) => p.lisible), ligne.libelle],
    [
      ...prestations.map((p) => p.libelle),
      ...(brouillon?.contenu?.prestations ?? []).map((l) =>
        [l.libelle, l.description ?? "", l.quantite ?? "", l.unite ?? ""].join(" ")
      ),
    ]
  );

  const cellule = celluleFendage(mesures.hauteurM, mesures.diametreCm);
  // Sans les deux mesures, on ne sait pas dans quelle case ranger ce prix. On
  // ne le range nulle part — un prix dans la mauvaise case reviendrait plus
  // tard avec l'autorité de l'expérience.
  if (!cellule) return;

  await poserPrixFendage(ctx, cellule.cle, montant.toFixed(2), "devis");
}
