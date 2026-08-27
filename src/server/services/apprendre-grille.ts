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
import { prixAttribuable, prixAttribuableDes } from "../../lib/prix-attribuable";
import { prestationsDeLaLigne } from "../repositories/lignes-prix";
import { logger } from "../logger";

// **Le vocabulaire vit dans le référentiel** (`natures-prestation.ts`) depuis le
// 27 août 2026. Il était recopié ici, et il ne connaissait pas la tonte : c'est
// exactement ce trou-là qui a fait ranger 1 500 € — tonte comprise — dans la
// case d'abattage du patron.
//
// **Et les natures se lisent d'abord dans les COLONNES** des prestations que la
// ligne vend (migration 0069), pas dans son texte. Le libellé ne sert plus que
// pour les lignes d'avant, qui n'ont aucun lien.

/** Les natures pour lesquelles une grille existe (`grille-prix.ts`). */
const NATURES_DE_GRILLE = ["fendage", "haie", "dessouchage", "grumes", "abattage"] as const;
type NatureDeGrille = (typeof NATURES_DE_GRILLE)[number];

function natureDeGrille(cle: string | null): NatureDeGrille | null {
  return (NATURES_DE_GRILLE as readonly string[]).includes(cle ?? "") ? (cle as NatureDeGrille) : null;
}

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
  ligne: {
    libelle: string;
    montant: string;
    /**
     * L'identifiant de la ligne de devis, quand l'appelant l'a.
     *
     * **Il change tout** : avec lui, on sait quelles prestations cette ligne
     * vend, donc leurs natures et leurs mesures — en colonnes, pas en relisant
     * le texte. Sans lui, on retombe sur le libellé, comme avant.
     */
    id?: string;
  }
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
  //
  // Ce que la ligne vend réellement — vide sur une ligne d'avant la 0069.
  const vendues = ligne.id ? await prestationsDeLaLigne(ctx, ligne.id).catch(() => []) : [];

  const attribution =
    vendues.length > 0 ? prixAttribuableDes(vendues) : prixAttribuable(ligne.libelle);
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

  // **La nature vient de l'attribution elle-même**, qui l'a déjà établie — en
  // colonne quand la ligne connaît ses prestations, par son libellé sinon.
  // Deux lectures du même mot rangeaient un prix dans une case que le chiffrage
  // n'allait pas chercher (`CLAUDE.md` §3).
  //
  // **Une nature identifiée sans grille ne range rien, et c'est normal** : une
  // tonte est parfaitement reconnue, aucune grille ne la chiffre. C'est la
  // mémoire de prix (`lecons_prix`) qui s'en souvient, pas celle-ci.
  const nature = natureDeGrille(attribution.nature);
  if (!nature) return;

  const montant = Number(ligne.montant);
  // Un zéro n'est pas une décision : c'est une ligne pas encore remplie. La
  // retenir ferait proposer « 0 € » avec l'autorité de sa grille.
  if (!Number.isFinite(montant) || montant <= 0) return;

  const [precisions, toutesLesPrestations, brouillon] = await Promise.all([
    listerPrecisions(ctx, chantierId),
    listerPrestations(ctx, chantierId),
    getBrouillon(ctx, chantierId),
  ]);
  // **Les mesures de CETTE ligne d'abord.** Sur un chantier à deux arbres, lire
  // tout le chantier faisait hériter une haie du diamètre de l'érable.
  const prestations = vendues.length > 0 ? vendues : toutesLesPrestations;

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
    // **Les prestations entières, plus leurs seules caractéristiques.** C'est ce
    // qui fait entrer la quantité dictée dans le calcul — 800 « ml » de haie
    // SONT sa longueur — et ce qui laisse une correction de l'artisan trancher
    // au lieu de bloquer.
    prestations,
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
