import type { Ctx } from "../repositories/context";
import { listerPrecisions } from "../repositories/precisions-chantier";
import { listerPrestations } from "../repositories/prestations";
import { getBrouillon } from "../repositories/brouillons-informations";
import { poserPrixGrille } from "../repositories/grille-prix";
import {
  CELLULE_GRUMES,
  CELLULE_HAIE,
  celluleAbattage,
  celluleDessouchage,
  celluleFendage,
} from "../../lib/grille-prix";
import { longueurHaieLue, mesuresArbre } from "../../lib/mesures-arbre";

// Même vocabulaire que le découpage des lignes : ce qui fait une ligne à part
// est ce qui a une grille, et inversement.
const FENDAGE = /\b(fend|fente)/i;
const HAIE = /\bhaie/i;
const DESSOUCHAGE = /\b(dessouch|d[ée]souch|souche|rognage)/i;
const GRUMES = /\bgrume/i;
const ABATTAGE = /\b(abattage|abattre|abatt|d[ée]mont)/i;

/**
 * Les grilles se remplissent toutes seules, à partir des devis réels.
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
export async function apprendrePrixGrille(
  ctx: Ctx,
  chantierId: string,
  ligne: { libelle: string; montant: string }
): Promise<void> {
  // **L'ordre est celui du découpage des lignes, et ce n'est pas un hasard :**
  // ranger un prix dans une autre case que celle où le chiffrage ira le
  // chercher revient à ne rien ranger. Les deux listes se corrigent ensemble.
  const nature = FENDAGE.test(ligne.libelle)
    ? ("fendage" as const)
    : HAIE.test(ligne.libelle)
      ? ("haie" as const)
      : DESSOUCHAGE.test(ligne.libelle)
        ? ("dessouchage" as const)
        : GRUMES.test(ligne.libelle)
          ? ("grumes" as const)
          : ABATTAGE.test(ligne.libelle)
            ? ("abattage" as const)
            : null;
  if (!nature) return;

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

  // **La haie se range au MÈTRE, pas au montant de la ligne.** Écrire 350 € dans
  // sa case ferait facturer 350 € la prochaine haie, quelle que soit sa
  // longueur. C'est le prix unitaire qu'on retient — et seulement si la longueur
  // est connue, faute de quoi on ne retient rien.
  if (nature === "haie") {
    const longueur = [...precisions.map((p) => p.lisible), ligne.libelle, ...prestations.map((p) => p.libelle)]
      .map(longueurHaieLue)
      .find((l) => l !== null);
    if (!longueur || longueur <= 0) return;
    await poserPrixGrille(ctx, "haie", CELLULE_HAIE, (montant / longueur).toFixed(2), "devis");
    return;
  }

  // **Les grumes se retiennent telles quelles**, au forfait : faute d'unité
  // donnée par le patron, il n'y a pas de division à faire — et en inventer une
  // (au mètre cube, à la tonne) rangerait son prix dans une case qui ne veut
  // rien dire. Voir `CELLULE_GRUMES` dans `grille-prix.ts`.
  if (nature === "grumes") {
    await poserPrixGrille(ctx, "grumes", CELLULE_GRUMES, montant.toFixed(2), "devis");
    return;
  }

  const cellule =
    nature === "dessouchage"
      ? celluleDessouchage(mesures.diametreCm)
      : nature === "abattage"
        ? celluleAbattage(
            precisions.find((p) => p.sujet.startsWith("abattage.technique"))?.valeur ?? null,
            mesures.diametreCm
          )
        : celluleFendage(mesures.hauteurM, mesures.diametreCm);

  // Sans les mesures qu'il faut, on ne sait pas dans quelle case ranger ce prix.
  // On ne le range nulle part — un prix dans la mauvaise case reviendrait plus
  // tard avec l'autorité de l'expérience.
  if (!cellule) return;

  await poserPrixGrille(ctx, nature, cellule.cle, montant.toFixed(2), "devis");
}
