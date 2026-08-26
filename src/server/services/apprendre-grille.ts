import type { Ctx } from "../repositories/context";
import { listerPrecisions } from "../repositories/precisions-chantier";
import { listerPrestations } from "../repositories/prestations";
import { getBrouillon } from "../repositories/brouillons-informations";
import { poserPrixGrille } from "../repositories/grille-prix";
import { lireGrilles } from "../repositories/grilles-reglables";
import {
  CELLULE_GRUMES,
  CELLULE_HAIE,
  celluleAbattage,
  celluleDessouchage,
  celluleFendage,
} from "../../lib/grille-prix";
import { mesuresResolues } from "../../lib/mesures-prestation";
import { prixAttribuable } from "../../lib/prix-attribuable";
import { logger } from "../logger";

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
  // **Le montant doit appartenir à UN seul travail — sinon on n'apprend rien.**
  //
  // Le 26 août 2026, une ligne portait « Tonte de la pelouse (1200 m²) » ET
  // « Érable — démontage en rétention ». Le classement ci-dessous se fait au
  // premier motif qui répond : la case d'abattage du patron est passée de 800 €
  // à 1 500 €, tonte comprise, et ce prix serait revenu seul sur chaque
  // démontage suivant. Mesuré, pas supposé
  // (`scripts/test-dictee-devis-identite-db.ts`).
  //
  // **Le garde-fou passe AVANT le classement, et il laisse passer sa règle du
  // 7 août** — « l'abattage, le broyage et l'évacuation, c'est sur une ligne ».
  // Refuser cette ligne-là aurait arrêté l'apprentissage sur son cas le plus
  // courant : la règle vit dans `src/lib/prix-attribuable.ts`, pure et éprouvée
  // dans les deux sens.
  const attribution = prixAttribuable(ligne.libelle);
  if (!attribution.attribuable) {
    // **Bavard, parce qu'un refus muet ne se diagnostique pas** (`AGENTS.md`).
    // Le patron ne voit rien — c'est voulu, l'apprentissage ne gêne jamais le
    // travail —, mais le journal dit pourquoi sa grille n'a pas bougé.
    logger.info("Grille : montant non attribuable, rien n'est appris", {
      chantierId,
      motif: attribution.motif,
    });
    return;
  }

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

  // Les mesures peuvent être partout : ses réponses à l'arrêt, le libellé de la
  // ligne, une prestation, ou la description de la dictée — la seule à porter
  // « vingt mètres de haut », et la seule que la table ne conserve pas.
  //
  // **Le même contrat de priorité que le chiffrage** (`mesures-prestation.ts`) :
  // la colonne structurée d'abord, le libellé ensuite, et **rien du tout** si
  // les deux se contredisent. Ranger un prix dans une case désignée par une
  // mesure douteuse serait pire que ne rien ranger : il reviendrait plus tard
  // avec l'autorité de sa grille.
  const mesures = mesuresResolues(
    prestations.map((p) => p.caracteristiques),
    [
      ...precisions.map((p) => p.lisible),
      ligne.libelle,
      ...prestations.map((p) => p.libelle),
      ...(brouillon?.contenu?.prestations ?? []).map((l) =>
        [l.libelle, l.description ?? "", l.quantite ?? "", l.unite ?? ""].join(" ")
      ),
    ]
  );
  const contradiction = Object.values(mesures).find((m) => m.origine === "contradiction");
  if (contradiction) {
    logger.info("Grille : mesures contradictoires, rien n'est appris", { chantierId });
    return;
  }

  // **La haie se range au MÈTRE, pas au montant de la ligne.** Écrire 350 € dans
  // sa case ferait facturer 350 € la prochaine haie, quelle que soit sa
  // longueur. C'est le prix unitaire qu'on retient — et seulement si la longueur
  // est connue, faute de quoi on ne retient rien.
  if (nature === "haie") {
    const longueur = mesures.longueurMl.valeur;
    if (!longueur || longueur <= 0) return;
    await poserPrixGrille(ctx, "haie", CELLULE_HAIE, (montant / longueur).toFixed(2), "devis");
    return;
  }

  // **Les grumes se rangent À LA TONNE, jamais au montant de la ligne.** Sa
  // réponse du 9 août 2026. Écrire 900 € dans la case ferait facturer 900 € LA
  // TONNE au chantier suivant — c'est mot pour mot le piège de la haie, et il
  // coûterait ici bien plus cher.
  //
  // Sans tonnage connu, on ne retient rien plutôt qu'un prix faux.
  if (nature === "grumes") {
    const tonnage = mesures.tonnageT.valeur;
    if (!tonnage || tonnage <= 0) return;
    await poserPrixGrille(ctx, "grumes", CELLULE_GRUMES, (montant / tonnage).toFixed(2), "devis");
    return;
  }

  // Ses tranches à lui : ranger un prix observé dans les tranches d'origine le
  // ferait revenir plus tard sur des arbres qui ne sont pas ceux-là.
  const { axes } = await lireGrilles(ctx);
  const cellule =
    nature === "dessouchage"
      ? celluleDessouchage(mesures.diametreCm.valeur, axes)
      : nature === "abattage"
        ? celluleAbattage(
            precisions.find((p) => p.sujet.startsWith("abattage.technique"))?.valeur ?? null,
            mesures.diametreCm.valeur,
            axes
          )
        : celluleFendage(mesures.hauteurM.valeur, mesures.diametreCm.valeur, axes);

  // Sans les mesures qu'il faut, on ne sait pas dans quelle case ranger ce prix.
  // On ne le range nulle part — un prix dans la mauvaise case reviendrait plus
  // tard avec l'autorité de l'expérience.
  if (!cellule) return;

  await poserPrixGrille(ctx, nature, cellule.cle, montant.toFixed(2), "devis");
}
