import Decimal from "decimal.js";
import type { Ctx } from "../repositories/context";
import { getChantier } from "../repositories/chantiers";
import { listerPrestations } from "../repositories/prestations";
import { listerMateriel } from "../repositories/materiel";
import { listerTarifs } from "../repositories/tarifs";
import { getBrouillon } from "../repositories/brouillons-informations";
import { chiffrerChantier } from "./service";
import { parseNombreFrancais } from "./parse";
import type { SourcePrix } from "../orchestrateur/proposition-builder";
import type { LigneExplication } from "./types";
import { arrondirALaDizaine } from "../../lib/arrondi-prix";
import { chiffrerMainOeuvre, tarifJourHomme } from "../../lib/tarif-main-oeuvre";
import {
  FOIS_POUR_RETENIR,
  SUJET_MAIN_OEUVRE,
  choixParDefaut,
  journeesFacturees,
  libelleMainOeuvre,
  lireChoix,
  modeRetenu,
  partsDeDepart,
  repartirMainOeuvre,
  tarifAvecSonHomme,
} from "../../lib/main-oeuvre-dictee";
import {
  lignesVendables,
  membresDuLibelle,
  prixDicteDeLaLigne,
  repartir,
  type LigneVendable,
  type PrestationAGrouper,
} from "../../lib/lignes-vendables";
import { quantiteCommerciale, prevenirQuantiteNonMultipliee } from "../../lib/quantite-commerciale";
import {
  CELLULE_GRUMES,
  CELLULE_HAIE,
  celluleAbattage,
  celluleDessouchage,
  celluleFendage,
  prixDuFendage,
  type Cellule,
  type NatureGrille,
} from "../../lib/grille-prix";
import { mesuresResolues, reserveDeContradiction, type MesuresResolues } from "../../lib/mesures-prestation";
import { prixConnusDe } from "../repositories/grille-prix";
import { lireGrilles } from "../repositories/grilles-reglables";
import { tarifsCorrespondants, type TarifCandidat } from "../../lib/tarifs-correspondants";
import { dernieresReponses, listerPrecisions } from "../repositories/precisions-chantier";
import type { QuestionChiffrage } from "../../lib/questions-chiffrage";
import { lireMarges, prixAchatCandidats } from "../repositories/fournisseurs-partenaires";
import { prixDUneLigneDictee, quantiteDictee, type TarifDeVente } from "../../lib/prix-achat";

// Origine du prix — même taxonomie que l'orchestrateur (SourcePrix), volontairement
// réutilisée plutôt que redéfinie : les deux chemins doivent raconter la même
// chose au patron, qu'il passe par l'assistant ou par l'écran Prix.
//
// **Une seule origine en plus, et elle ne vit qu'ici : « achat »** (19 octobre
// 2026). L'orchestrateur ne lit pas ses prix d'achat ; l'écran Prix et le devis
// dicté, si : aucun de ses tarifs ne répond, et le montant vient de ses prix
// d'achat × sa marge. Le dire « calculé depuis vos paramètres » serait faux.
//
// **Et « dictee »** (21 octobre 2026) : le prix est celui qu'il a prononcé dans
// sa note. Ni tarif, ni calcul : sa parole, et c'est ce que l'écran doit dire.
export type OriginePrix = SourcePrix | "achat" | "dictee";

/** Une ligne telle qu'elle sera écrite au détail — et lue par le client. */
export type LigneProposee = {
  libelle: string;
  /**
   * `null` = **à chiffrer**. Jamais « 0 » en guise de « je ne sais pas ».
   *
   * Sur un devis, un zéro se lit « gratuit » : c'est un montant, donc une
   * décision, là où il n'y a qu'une ignorance. Le patron pouvait envoyer ce
   * document (26 août 2026).
   */
  montant: string | null;
  /** La quantité COMMERCIALE de la ligne — 800 ml, ou 1 forfait (`quantite-commerciale.ts`). */
  quantite: string;
  unite: string | null;
  prixUnitaire: string;
  /**
   * Les prestations que cette ligne vend, par identifiant.
   *
   * **Un identifiant, plus un rapprochement par texte.** C'est ce qui permet à
   * l'apprentissage de savoir ce qu'il apprend, au lieu de relire le libellé de
   * la ligne à coups d'expressions régulières.
   */
  prestationIds: string[];
};

export type PropositionPrix = {
  origine: OriginePrix;
  // Montant HT proposé. null dès que l'origine ne permet pas d'en proposer un
  // — jamais 0 en guise de « pas de prix ».
  //
  // **C'est le TOTAL** quand la proposition compte plusieurs lignes : c'est ce
  // que l'écran Prix annonce, et ce que le patron compare à ce qu'il aurait dit
  // de tête.
  prixPropose: string | null;
  libelle: string | null;
  /**
   * Le devis proposé, ligne par ligne.
   *
   * **Plusieurs, parce qu'un chantier se vend en morceaux détachables.** Le
   * patron, trois fois en deux jours : *« l'agent ne comprend toujours pas
   * qu'il faut séparer les tâches. Tout ce que je dicte arrive sur la même
   * ligne. »* La règle de découpage vit dans `src/lib/lignes-vendables.ts`,
   * pure et éprouvée sur ses propres dictées.
   *
   * Vide quand aucun prix n'est proposable — jamais une ligne à zéro en guise
   * de « je ne sais pas ».
   */
  lignes: LigneProposee[];
  tarifId: string | null;
  // Tarifs en concurrence : renseigné uniquement quand l'origine est
  // "tarifs_ambigus". Le choix appartient au patron, jamais au système.
  tarifsCandidats: TarifCandidat[];
  explication: {
    origine: string;
    elementsPrisEnCompte: LigneExplication[];
    calcul: LigneExplication[];
    donneesManquantes: string[];
    ambiguites: string[];
  };
};

// Construit la proposition de prix d'un chantier à partir des seules données
// réellement enregistrées et confirmées. Ne décide jamais à la place du patron :
// elle expose une origine, un montant éventuel et de quoi le comprendre.
//
// Arbre de décision — identique à celui de l'orchestrateur :
//   1 tarif correspondant           -> "tarif"
//   plusieurs tarifs correspondants -> "tarifs_ambigus" (aucun choix arbitraire)
//   aucun tarif + calcul possible   -> "chiffrage"
//   aucun tarif + calcul impossible -> "aucun"
export async function preparerPropositionPrix(ctx: Ctx, chantierId: string): Promise<PropositionPrix | null> {
  const vente = await propositionDeVente(ctx, chantierId);
  if (!vente || vente.origine === "tarifs_ambigus") return vente;
  return completerParSesAchats(ctx, chantierId, vente);
}

async function propositionDeVente(ctx: Ctx, chantierId: string): Promise<PropositionPrix | null> {
  const chantier = await getChantier(ctx, chantierId);
  if (!chantier) return null;

  const [prestations, materiel, brouillon] = await Promise.all([
    listerPrestations(ctx, chantierId),
    listerMateriel(ctx, chantierId),
    getBrouillon(ctx, chantierId),
  ]);

  const elementsPrisEnCompte: LigneExplication[] = [];
  const donneesManquantes: string[] = [];
  const ambiguites: string[] = [];

  // --- Éléments d'entrée réellement disponibles ---------------------------
  if (prestations.length > 0) {
    elementsPrisEnCompte.push({
      libelle: "Prestations",
      detail: prestations.map((p) => p.libelle).filter(Boolean).join(", ") || "aucune",
    });
  } else {
    donneesManquantes.push("Aucune prestation enregistrée sur ce chantier.");
  }

  if (materiel.length > 0) {
    elementsPrisEnCompte.push({
      libelle: "Matériel",
      detail: materiel.map((m) => m.libelle).filter(Boolean).join(", "),
    });
  }

  if (chantier.dureePrevue) {
    elementsPrisEnCompte.push({ libelle: "Durée prévue", detail: chantier.dureePrevue });
  } else {
    donneesManquantes.push("Durée prévue non renseignée.");
  }

  if (chantier.tailleEquipe) {
    elementsPrisEnCompte.push({ libelle: "Taille d'équipe", detail: chantier.tailleEquipe });
  } else {
    donneesManquantes.push("Taille d'équipe non renseignée.");
  }

  // Le brouillon confirmé porte les informations que les tables métier ne
  // stockent pas encore (quantités, unités, déchets, accès). Un brouillon non
  // confirmé n'est jamais lu ici : ce sont des propositions, pas des données.
  const contenuConfirme = brouillon?.statut === "confirme" ? brouillon.contenu : null;
  const quantitesParLibelle = new Map<string, { quantite: string; unite: string | null }>();

  // Les lignes de la dictée telles qu'elles ont été lues — descriptions
  // comprises. La table `prestations` ne garde qu'un libellé : « vingt mètres
  // de haut » y disparaît, alors que c'est lui qui désigne la case de la grille
  // de fendage. Voir `decouperEnLignes`.
  const textesDictee = (contenuConfirme?.prestations ?? []).map((l) =>
    [l.libelle, l.description ?? "", l.quantite ?? "", l.unite ?? ""].join(" ")
  );

  if (contenuConfirme) {
    for (const ligne of contenuConfirme.prestations) {
      if (ligne.quantite) {
        quantitesParLibelle.set(ligne.libelle.trim().toLowerCase(), {
          quantite: ligne.quantite,
          unite: ligne.unite,
        });
        elementsPrisEnCompte.push({
          libelle: `Quantité : ${ligne.libelle}`,
          detail: `${ligne.quantite}${ligne.unite ? ` ${ligne.unite}` : ""} (confirmé)`,
        });
      }
      if (ligne.aConfirmer) {
        ambiguites.push(`« ${ligne.libelle} » était signalé à confirmer dans la dictée.`);
      }
    }
    if (contenuConfirme.gestionDechets) {
      elementsPrisEnCompte.push({ libelle: "Déchets", detail: contenuConfirme.gestionDechets });
    } else {
      donneesManquantes.push("Gestion des déchets non précisée.");
    }
    if (contenuConfirme.contraintesAcces) {
      elementsPrisEnCompte.push({ libelle: "Accès", detail: contenuConfirme.contraintesAcces });
    }
    ambiguites.push(...contenuConfirme.ambiguites);
  } else {
    donneesManquantes.push(
      "Aucune information confirmée depuis la dictée : quantités, déchets et contraintes d'accès inconnus."
    );
  }

  const tarifs = await listerTarifs(ctx);

  // --- La main d'œuvre qu'il dicte décide, quand il la dicte --------------
  //
  // **Sa règle du 21 octobre 2026** : des jours ET des hommes dictés, c'est de
  // la main d'œuvre, chiffrée à SON tarif et répartie comme il l'a dit à
  // l'arrêt ; sans eux, ses grilles et ses tarifs l'emportent. Avant, un seul
  // tarif reconnu (« Évacuation ») construisait le devis entier et jetait le
  // reste, et une grille qui connaissait le travail principal faisait
  // disparaître la main d'œuvre.
  const mo = mainOeuvreDictee(chantier, tarifs);
  if (mo && prestations.length > 0) {
    return propositionAvecMainOeuvre(ctx, chantierId, mo, {
      prestations,
      materiel: materiel.map((m) => m.libelle),
      tarifs: tarifs.map((x) => ({
        tarifId: x.id,
        intitule: x.intitule,
        prix: x.prix,
        unite: x.unite,
      })),
      textesDictee,
      explication: { elementsPrisEnCompte, donneesManquantes, ambiguites },
    });
  }

  // --- Le prix qu'il a DICTÉ, avant tout le reste --------------------------
  //
  // **Son signalement du 21 octobre 2026** : « j'estime le prix à 500 € », et
  // le devis lui demandait de remplir le prix. Ce qu'il prononce pour CE
  // chantier passe avant ses tarifs, sa grille et le calcul au temps : ce sont
  // des prix d'habitude, celui-là est sa décision. Le devis se fait alors poste
  // par poste ; une ligne dont il n'a pas dit le prix prend sa grille, ou reste
  // à chiffrer.
  if (prestations.some((p) => p.prixDicte !== null)) {
    const decoupe = await decouperEnLignes(ctx, chantierId, prestations, textesDictee, "0");
    return {
      origine: "dictee",
      prixPropose: decoupe.total,
      libelle: decoupe.libelle,
      lignes: decoupe.lignes,
      tarifId: null,
      tarifsCandidats: [],
      explication: {
        origine: "Ce prix est celui que vous avez dicté. Il n'a pas été calculé.",
        elementsPrisEnCompte,
        calcul: decoupe.calcul,
        donneesManquantes: [...donneesManquantes, ...decoupe.donneesManquantes, MATERIEL_NON_CHIFFRE],
        ambiguites,
      },
    };
  }

  // --- Rapprochement tarifaire --------------------------------------------
  const candidats = tarifsCorrespondants(
    tarifs,
    prestations.map((p) => p.libelle)
  );

  if (candidats.length > 1) {
    return {
      origine: "tarifs_ambigus",
      prixPropose: null,
      libelle: null,
      // Aucune ligne : choisir un tarif à sa place serait choisir son prix.
      lignes: [],
      tarifId: null,
      tarifsCandidats: candidats,
      explication: {
        origine:
          "Plusieurs tarifs de l'entreprise correspondent à ces prestations. Le choix vous revient : aucun n'est retenu automatiquement.",
        elementsPrisEnCompte,
        calcul: candidats.map((c) => ({
          libelle: c.intitule,
          detail: `${c.prix} €${c.unite ? ` / ${c.unite}` : ""}, tarif enregistré par l'entreprise.`,
        })),
        donneesManquantes,
        ambiguites,
      },
    };
  }

  // **Un tarif reconnu chiffre SA ligne, et seulement elle** (21 octobre
  // 2026). Ce bloc construisait le devis entier avec ce seul tarif : son devis
  // du soir n'avait plus ni l'abattage, ni le démontage, parce que « Évacuation »
  // répondait. Chaque travail prend désormais son prix ligne par ligne
  // (`prixDeLaLigne` : sa grille, puis son tarif nommé), et ce qui n'en a pas
  // reste à chiffrer.
  if (candidats.length === 1) {
    // Les quantités de la dictée CONFIRMÉE complètent les prestations qui n'en
    // portent pas en colonne (celles d'avant le 26 août 2026) : « 12 m² » de
    // carrelage se multiplient par son tarif au m², jamais une quantité supposée.
    const avecSesQuantites = prestations.map((p) => {
      const q = p.quantite == null ? quantitesParLibelle.get(p.libelle.trim().toLowerCase()) : undefined;
      return q ? { ...p, quantite: q.quantite, unite: q.unite } : p;
    });
    const decoupe = await decouperEnLignes(ctx, chantierId, avecSesQuantites, textesDictee, "0", true);
    return {
      origine: "tarif",
      prixPropose: decoupe.lignes.some((l) => l.montant !== null) ? new Decimal(decoupe.total).toFixed(2) : null,
      libelle: decoupe.libelle,
      lignes: decoupe.lignes,
      tarifId: candidats[0].tarifId,
      tarifsCandidats: [],
      explication: {
        origine: "Ces prix viennent de vos tarifs et de votre grille. Ils n'ont pas été calculés.",
        elementsPrisEnCompte,
        calcul: decoupe.calcul,
        donneesManquantes: [...donneesManquantes, ...decoupe.donneesManquantes],
        ambiguites,
      },
    };
  }

  // --- La main d'œuvre, prise dans la GRILLE avant tout calcul --------------
  //
  // **Le défaut du 7 août 2026.** Le patron dicte « deux hommes, une journée »,
  // lit 858,00 € et demande : « à quoi correspond ce prix ? Il n'est pas allé
  // chercher dans la grille de prix. » Il avait raison.
  //
  // Le rapprochement ci-dessus se fait par le TEXTE : « Main d'œuvre
  // (jour/homme) » ne se retrouve dans aucun libellé de prestation, donc aucun
  // tarif n'était retenu, et l'application basculait sur les paramètres de
  // chiffrage — un coût interne majoré d'une marge. Deux chiffres sans rapport :
  // l'un est ce que le travail COÛTE, l'autre ce qu'il se VEND.
  //
  // Un tarif au jour ne décrit aucune prestation en particulier : il se
  // reconnaît à son UNITÉ, et s'applique dès qu'une durée et une équipe sont
  // connues. C'est exactement ce que le patron dicte à chaque fois.
  const mainOeuvre = chiffrerMainOeuvre(
    tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite })),
    parseNombreFrancais(chantier.dureePrevue),
    parseNombreFrancais(chantier.tailleEquipe)
  );

  if (mainOeuvre) {
    const arrondi = arrondirALaDizaine(mainOeuvre.montant) ?? mainOeuvre.montant;
    const decoupe = await decouperEnLignes(ctx, chantierId, prestations, textesDictee, arrondi);

    return {
      origine: "tarif",
      prixPropose: decoupe.total,
      libelle: decoupe.libelle || mainOeuvre.intitule,
      lignes: decoupe.lignes,
      tarifId: mainOeuvre.tarifId,
      tarifsCandidats: [],
      explication: {
        origine:
          "Ce prix vient de VOTRE grille de tarifs, appliquée à la durée et à l'équipe que vous avez dictées. Il n'a pas été reconstitué depuis vos coûts.",
        elementsPrisEnCompte,
        calcul: [
          { libelle: "Main d'œuvre", detail: mainOeuvre.detail },
          ...(arrondi !== mainOeuvre.montant
            ? [{ libelle: "Arrondi", detail: `${mainOeuvre.montant} € arrondi à ${arrondi} €, « en HT on fait des prix ronds ».` }]
            : []),
          ...decoupe.calcul,
        ],
        donneesManquantes: [
          ...donneesManquantes,
          ...decoupe.donneesManquantes,
          MATERIEL_NON_CHIFFRE,
        ],
        ambiguites,
      },
    };
  }

  // --- Aucun tarif : calcul depuis les paramètres de l'entreprise ----------
  const chiffrage = await chiffrerChantier(ctx, chantierId);
  const standard = chiffrage?.variantes.standard;

  // Sans durée ET équipe, le moteur ne produit aucun coût de main-d'œuvre :
  // il n'y a alors pas de prix défendable, et on le dit plutôt que de proposer
  // un montant qui ne reposerait que sur le forfait de déplacement.
  const calculPossible =
    !!standard &&
    parseNombreFrancais(chantier.dureePrevue) !== null &&
    parseNombreFrancais(chantier.tailleEquipe) !== null;

  if (!calculPossible) {
    // **Sans total, ses grilles chiffrent quand même ce qu'elles connaissent**
    // (21 octobre 2026). « Taille de haie, 20 ml » sortait à chiffrer à côté
    // de sa case à 15 € le mètre : la grille n'était lue que pour répartir un
    // total. Sa règle du soir : sans jours ni hommes dictés, ce sont ses
    // grilles qui l'emportent.
    const decoupe = await decouperEnLignes(ctx, chantierId, prestations, textesDictee, "0", true);
    if (decoupe.lignes.some((l) => l.montant !== null)) {
      return {
        origine: "tarif",
        prixPropose: decoupe.total,
        libelle: decoupe.libelle,
        lignes: decoupe.lignes,
        tarifId: null,
        tarifsCandidats: [],
        explication: {
          origine: "Ces prix viennent de votre grille et de vos tarifs. Ils n'ont pas été calculés.",
          elementsPrisEnCompte,
          calcul: decoupe.calcul,
          donneesManquantes: [...donneesManquantes, ...decoupe.donneesManquantes],
          ambiguites,
        },
      };
    }
    return {
      origine: "aucun",
      prixPropose: null,
      libelle: null,
      lignes: [],
      tarifId: null,
      tarifsCandidats: [],
      explication: {
        origine:
          "Aucun prix ne peut être proposé : aucun tarif ne correspond, et les données nécessaires au calcul manquent.",
        elementsPrisEnCompte,
        calcul: [],
        donneesManquantes: [
          ...donneesManquantes,
          "Le calcul depuis les paramètres de l'entreprise exige une durée et une taille d'équipe.",
        ],
        ambiguites,
      },
    };
  }

  // **L'arrondi à la dizaine, enfin appliqué là où le prix se décide.**
  //
  // La règle existait, écrite avec la phrase du patron (« en HT on fait des
  // prix ronds : 350, 400, 420, 560 »), et elle n'était appelée nulle part dans
  // le chiffrage — seulement pour les rappels de prix. D'où le 858,00 € qu'il a
  // lu le 7 août 2026 : un montant de machine sur un document d'artisan.
  const arrondiCalcule = arrondirALaDizaine(standard.prixConseille) ?? standard.prixConseille;

  // **Le libellé nomme ce qui a été dicté, et chaque chose vendable a sa ligne.**
  //
  // « Prestation (prix calculé) » était juste et inutilisable : c'est la ligne
  // que le CLIENT lit sur son devis, et elle ne lui disait rien du travail. La
  // version suivante nommait bien les travaux — mais tous sur une seule ligne,
  // séparés par des points-virgules, et c'est le défaut que le patron a signalé
  // trois fois.
  const decoupe = await decouperEnLignes(ctx, chantierId, prestations, textesDictee, arrondiCalcule);

  return {
    origine: "chiffrage",
    prixPropose: decoupe.total,
    libelle: decoupe.libelle || "Prestation (prix calculé)",
    lignes: decoupe.lignes,
    tarifId: null,
    tarifsCandidats: [],
    explication: {
      origine:
        "Aucun tarif enregistré ne correspond : ce montant a été calculé à partir de vos paramètres de chiffrage. Il reste à vérifier.",
      elementsPrisEnCompte,
      calcul: [
        ...standard.explications,
        ...(arrondiCalcule !== standard.prixConseille
          ? [
              {
                libelle: "Arrondi",
                detail: `${standard.prixConseille} € arrondi à ${arrondiCalcule} €, « en HT on fait des prix ronds ».`,
              },
            ]
          : []),
        ...decoupe.calcul,
      ],
      donneesManquantes: [...donneesManquantes, ...decoupe.donneesManquantes, ...standard.avertissements],
      ambiguites,
    },
  };
}

// =========================================================================
// La main d'œuvre dictée : sa planche du 21 octobre 2026
// =========================================================================

/**
 * **Sa règle du 21 octobre 2026, et elle décide de tout le reste :** *« à partir
 * du moment où l'utilisateur dicte deux jours à trois, il compte de la main
 * d'œuvre : il faut lui demander comment il veut la répartir. S'il ne parle
 * pas de jours et d'hommes, ce sont les prix des grilles qui l'emportent. »*
 *
 * Il faut donc les deux, ET un tarif au jour par homme pour les chiffrer.
 */
type MainOeuvreDictee = {
  tarif: { id: string; intitule: string; prix: string };
  jours: number;
  hommes: number;
};

function mainOeuvreDictee(
  chantier: { dureePrevue: string | null; tailleEquipe: string | null },
  tarifs: readonly {
    id: string;
    intitule: string;
    prix: string;
    unite: string | null;
  }[],
): MainOeuvreDictee | null {
  const jours = parseNombreFrancais(chantier.dureePrevue);
  const hommes = parseNombreFrancais(chantier.tailleEquipe);
  const tarif = tarifJourHomme(
    tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite })),
  );
  if (!tarif || jours === null || jours <= 0 || hommes === null || hommes <= 0) return null;
  return { tarif, jours, hommes };
}

type TravauxDeLaMainOeuvre = {
  /** Ce qui a SON prix, hors main d'œuvre : un prix dicté, un tarif nommé. */
  horsMO: {
    rang: number;
    vendable: LigneVendable;
    montant: string;
    calcul: LigneExplication;
  }[];
  /** Ce que la main d'œuvre peut couvrir, avec le prix que sa grille en donnerait. */
  couverts: { rang: number; vendable: LigneVendable; grille: PrixLigne }[];
  /** Les engins dictés qui partent avec leur conducteur. */
  engins: { libelle: string }[];
  absorbes: string[];
};

async function travauxDeLaMainOeuvre(
  ctx: Ctx,
  chantierId: string,
  prestations: readonly PrestationAGrouper[],
  materiel: readonly string[],
  tarifs: readonly TarifDeVente[],
  tarifMOId: string,
  textesDictee: string[],
): Promise<TravauxDeLaMainOeuvre> {
  const vente = {
    tarifs: tarifs.filter((t) => t.tarifId !== tarifMOId),
    achats: [],
    marges: { materiel: null, mainOeuvre: null },
  };
  const engins: TravauxDeLaMainOeuvre["engins"] = [];
  for (const libelle of materiel) {
    const p = prixDUneLigneDictee(libelle, quantiteDictee(libelle), vente, null, true);
    if (p.tarif && tarifAvecSonHomme(p.tarif.intitule)) engins.push({ libelle: p.tarif.intitule });
  }

  const { lignes: vendables, absorbes } = lignesVendables(prestations);
  const textesChantier = [...prestations.map((p) => p.libelle), ...textesDictee];
  const horsMO: TravauxDeLaMainOeuvre["horsMO"] = [];
  const couverts: TravauxDeLaMainOeuvre["couverts"] = [];
  for (const [rang, l] of vendables.entries()) {
    const dicte = prixDicteDeLaLigne(l.prestations);
    if (dicte !== null) {
      horsMO.push({
        rang,
        vendable: l,
        montant: dicte,
        calcul: {
          libelle: "Prix dicté",
          detail: `${membresDuLibelle(l.libelle)[0]} : ${dicte} €, le prix que vous avez dicté.`,
        },
      });
      continue;
    }
    const nomme = prixDUneLigneDictee(membresDuLibelle(l.libelle)[0] ?? l.libelle, 1, vente);
    if (nomme.origine === "vente" && nomme.montant !== null) {
      horsMO.push({
        rang,
        vendable: l,
        montant: nomme.montant,
        calcul: { libelle: "Tarif appliqué", detail: nomme.detail },
      });
      continue;
    }
    couverts.push({
      rang,
      vendable: l,
      grille: await prixDeSaGrille(ctx, chantierId, textesChantier, l),
    });
  }
  return { horsMO, couverts, engins, absorbes };
}

/**
 * La main d'œuvre à l'arrêt d'avant-chiffrage.
 *
 * `dictee` : il a dicté des jours et des hommes, donc c'est elle qui fait le
 * prix, et les questions de grille (technique, diamètre) n'ont plus rien à
 * chiffrer. Son « Comment s'abat-il ? » du 21 octobre 2026 venait de là.
 *
 * `question` : la carte de répartition, ou `null` quand il n'y a rien à
 * demander (déjà répondue ici, ou retenue de ses trois derniers devis).
 */
export async function questionMainOeuvre(
  ctx: Ctx,
  chantierId: string,
): Promise<{ dictee: boolean; question: QuestionChiffrage | null }> {
  const rien = { dictee: false, question: null };
  const chantier = await getChantier(ctx, chantierId);
  if (!chantier) return rien;
  const [prestations, materiel, tarifs, precisions] = await Promise.all([
    listerPrestations(ctx, chantierId),
    listerMateriel(ctx, chantierId),
    listerTarifs(ctx),
    listerPrecisions(ctx, chantierId),
  ]);
  const mo = mainOeuvreDictee(chantier, tarifs);
  if (!mo || prestations.length === 0) return rien;
  if (precisions.some((p) => p.sujet === SUJET_MAIN_OEUVRE)) return { dictee: true, question: null };
  const derniers = await dernieresReponses(ctx, SUJET_MAIN_OEUVRE, FOIS_POUR_RETENIR);
  const { engins, couverts } = await travauxDeLaMainOeuvre(
    ctx,
    chantierId,
    prestations,
    materiel.map((m) => m.libelle),
    tarifs.map((t) => ({
      tarifId: t.id,
      intitule: t.intitule,
      prix: t.prix,
      unite: t.unite,
    })),
    mo.tarif.id,
    [],
  );
  // Retenu de ses trois derniers devis : la question ne se pose plus.
  if (modeRetenu(derniers.map((v) => lireChoix(v)?.mode ?? null))) return { dictee: true, question: null };

  // Le total que la carte annonce est celui du devis : le conducteur de chaque
  // engin, déjà payé avec lui, n'y figure pas.
  const hommesFactures = Math.max(0, mo.hommes - engins.length);
  const total = new Decimal(mo.tarif.prix).times(journeesFacturees(mo.jours, mo.hommes, engins.length * mo.jours)).toFixed(2);
  const parts = partsDeDepart(
    total,
    couverts.map((c) => ({ cle: c.vendable.libelle, grille: c.grille.prix, principal: c.vendable.principal })),
  );
  return {
    dictee: true,
    question: {
      id: SUJET_MAIN_OEUVRE,
      libellePrestation: "Main d'œuvre",
      question: `Où mettre les ${new Decimal(total).toNumber().toLocaleString("fr-FR")} € de main d'œuvre ?`,
      options: null,
      unite: null,
      mainOeuvre: {
        total,
        detail:
          `${hommesFactures} homme${hommesFactures > 1 ? "s" : ""} pendant ${mo.jours} jour${mo.jours > 1 ? "s" : ""}, ` +
          `${new Decimal(mo.tarif.prix).toNumber().toLocaleString("fr-FR")} € le jour par homme` +
          (engins.length > 0 ? `, et ${engins.map((e) => e.libelle).join(", ")}` : ""),
        prixJourHomme: new Decimal(mo.tarif.prix).toFixed(2),
        travaux: couverts.map((c) => ({
          cle: c.vendable.libelle,
          libelle: membresDuLibelle(c.vendable.libelle)[0] ?? c.vendable.libelle,
          part: parts[c.vendable.libelle] ?? 0,
          grille: c.grille.prix,
        })),
        engins: engins.map((e) => e.libelle),
        hommes: mo.hommes,
      },
    },
  };
}

/**
 * Le devis quand il a dicté des jours et des hommes
 * (`appli/main-d-oeuvre-repartie.html`). Chaque travail prend, dans l'ordre :
 * le prix qu'il a dicté ; son tarif nommé ; s'il l'a sorti par la croix, sa
 * grille, sinon « à chiffrer » ; sinon sa part de la main d'œuvre, sur une
 * ligne qui le nomme ou selon ses curseurs.
 *
 * Les jours couvrent tout le chantier : sa grille ne s'ajoute pas, elle donne
 * seulement la position de départ des curseurs.
 */
async function propositionAvecMainOeuvre(
  ctx: Ctx,
  chantierId: string,
  mo: MainOeuvreDictee,
  d: {
    prestations: Awaited<ReturnType<typeof listerPrestations>>;
    materiel: string[];
    tarifs: TarifDeVente[];
    textesDictee: string[];
    explication: {
      elementsPrisEnCompte: LigneExplication[];
      donneesManquantes: string[];
      ambiguites: string[];
    };
  },
): Promise<PropositionPrix> {
  const calcul: LigneExplication[] = [];
  const donneesManquantes = [...d.explication.donneesManquantes];
  const t = await travauxDeLaMainOeuvre(
    ctx,
    chantierId,
    d.prestations,
    d.materiel,
    d.tarifs,
    mo.tarif.id,
    d.textesDictee,
  );
  if (t.absorbes.length > 0) {
    calcul.push({
      libelle: "Compris dans l'abattage",
      detail: `${t.absorbes.join(", ")}, pas de ligne séparée : le billonnage fait partie du geste d'abattre.`,
    });
  }

  // Son choix sur ce chantier ; sinon celui de ses trois derniers devis ; sinon réparti.
  const precisions = await listerPrecisions(ctx, chantierId);
  const choix =
    lireChoix(precisions.find((p) => p.sujet === SUJET_MAIN_OEUVRE)?.valeur) ??
    choixParDefaut(
      modeRetenu(
        (await dernieresReponses(ctx, SUJET_MAIN_OEUVRE, FOIS_POUR_RETENIR)).map((v) => lireChoix(v)?.mode ?? null),
      ) ?? "reparti",
    );

  // Chaque engin avec son homme emmène l'un des hommes dictés, tous les jours.
  const journeesDeConducteur = t.engins.length * mo.jours;
  const journees = journeesFacturees(mo.jours, mo.hommes, journeesDeConducteur);
  const totalMO = new Decimal(mo.tarif.prix).times(journees);
  calcul.push({
    libelle: "Main d'œuvre",
    detail:
      `${mo.jours} jour(s) × ${mo.hommes} homme(s)` +
      (journeesDeConducteur > 0
        ? `, moins ${journeesDeConducteur} journée(s) de conducteur déjà payée(s) avec l'engin,`
        : "") +
      ` × ${mo.tarif.prix} € = ${totalMO.toFixed(2)} € (votre tarif « ${mo.tarif.intitule} »).`,
  });

  const ids = (l: LigneVendable) => l.prestations.map((p) => p.id).filter((id): id is string => !!id);
  // **La quantité physique survit même sans prix** : la mesure que sa grille a
  // su lire d'abord (« 800 ml » dans un libellé d'avant le lot B), la quantité
  // commerciale ensuite, comme dans le découpage (`decouperEnLignes`).
  const auForfait = (l: LigneVendable, montant: string | null, mesure?: PrixLigne): LigneProposee => {
    if (montant === null) {
      const q = quantiteCommerciale(l.prestations);
      const lue = mesure?.quantite !== undefined;
      return {
        libelle: l.libelle,
        montant: null,
        quantite: lue ? mesure!.quantite! : q.quantite,
        unite: lue ? (mesure!.unite ?? null) : q.unite,
        prixUnitaire: "0",
        prestationIds: ids(l),
      };
    }
    // **Sa mesure reste sur la ligne quand elle divise le montant au centime
    // près** : « 800 ml × 1,05 € » se relit, « 1 × 840 € » efface ce qu'il a
    // dicté. Sinon, un forfait juste vaut mieux qu'un prix unitaire arrondi
    // dont le total ne tomberait plus sur sa main d'œuvre.
    const q = mesure?.quantite !== undefined ? { quantite: mesure.quantite, unite: mesure.unite ?? null } : quantiteCommerciale(l.prestations);
    const nombre = Number(q.quantite);
    if (nombre > 1) {
      const pu = new Decimal(montant).div(nombre);
      if (pu.toDecimalPlaces(2).times(nombre).equals(new Decimal(montant))) {
        return { libelle: l.libelle, montant, quantite: q.quantite, unite: q.unite, prixUnitaire: pu.toFixed(2), prestationIds: ids(l) };
      }
    }
    return { libelle: l.libelle, montant, quantite: "1", unite: null, prixUnitaire: montant, prestationIds: ids(l) };
  };

  const placees: { rang: number; ligne: LigneProposee }[] = [];
  for (const h of t.horsMO) {
    calcul.push(h.calcul);
    placees.push({ rang: h.rang, ligne: auForfait(h.vendable, h.montant) });
  }
  const dedans: TravauxDeLaMainOeuvre["couverts"] = [];
  for (const c of t.couverts) {
    if (!choix.retires.includes(c.vendable.libelle)) {
      dedans.push(c);
      continue;
    }
    // Sorti par la croix : sa grille, sinon à chiffrer, et la phrase le dit.
    calcul.push(...c.grille.calcul);
    if (c.grille.prix === null) {
      donneesManquantes.push(
        `« ${membresDuLibelle(c.vendable.libelle)[0]} » : pas de prix dans votre grille, cette ligne est à chiffrer.`,
      );
    }
    const g = c.grille;
    placees.push({
      rang: c.rang,
      ligne:
        g.prix !== null && g.quantite !== undefined && g.prixUnitaire !== undefined
          ? {
              libelle: c.vendable.libelle,
              montant: g.prix,
              quantite: g.quantite,
              unite: g.unite ?? null,
              prixUnitaire: g.prixUnitaire,
              prestationIds: ids(c.vendable),
            }
          : auForfait(c.vendable, g.prix, g),
    });
  }

  // Sans journée à facturer (tout est conducteur), rien à répartir : jamais un
  // zéro, qui se lirait « gratuit ».
  const montantMO = journees > 0 ? totalMO.toFixed(2) : null;
  if (choix.mode === "ligne" || dedans.length === 0) {
    placees.push({
      rang: dedans[0]?.rang ?? Number.MAX_SAFE_INTEGER,
      ligne: {
        libelle: libelleMainOeuvre(dedans.map((x) => membresDuLibelle(x.vendable.libelle)[0] ?? x.vendable.libelle)),
        montant: montantMO,
        quantite: String(journees),
        unite: "jour/homme",
        prixUnitaire: new Decimal(mo.tarif.prix).toFixed(2),
        prestationIds: dedans.flatMap((x) => ids(x.vendable)),
      },
    });
  } else {
    const cles = dedans.map((x) => x.vendable.libelle);
    const parts =
      Object.keys(choix.parts).length > 0
        ? choix.parts
        : partsDeDepart(
            totalMO.toFixed(2),
            dedans.map((x) => ({ cle: x.vendable.libelle, grille: x.grille.prix, principal: x.vendable.principal }))
          );
    const montants = repartirMainOeuvre(totalMO.toFixed(2), cles, parts);
    for (const x of dedans) {
      // **Une part à zéro n'est pas un prix** : c'est un travail que ni sa
      // grille ni ses curseurs n'ont chiffré. Il sort « à chiffrer », et sa
      // grille dit quelle case manque (sa règle du 27 août 2026).
      const part = montantMO === null ? null : montants[x.vendable.libelle];
      const aChiffrer = part === null || Number(part) === 0;
      // Ce que dit sa grille s'écrit toujours : d'où vient un 250 €, ou
      // quelle case manque.
      calcul.push(...x.grille.calcul);
      if (aChiffrer) donneesManquantes.push(...x.grille.donneesManquantes);
      placees.push({ rang: x.rang, ligne: auForfait(x.vendable, aChiffrer ? null : part, x.grille) });
    }
    calcul.push({ libelle: "Répartition", detail: "La main d'œuvre est répartie sur les travaux, selon vos curseurs." });
  }

  const lignes = placees.sort((a, b) => a.rang - b.rang).map((x) => x.ligne);
  const chiffrees = lignes.filter((l) => l.montant !== null);
  return {
    origine: "tarif",
    // Le total s'écrit comme celui du découpage (« 1100 ») : l'écran Prix et
    // le rapport le relisent tel quel.
    prixPropose: chiffrees.length > 0 ? chiffrees.reduce((s, l) => s.plus(l.montant!), new Decimal(0)).toFixed() : null,
    libelle: lignes.map((l) => l.libelle).join("\n"),
    lignes,
    tarifId: mo.tarif.id,
    tarifsCandidats: [],
    explication: {
      origine: "La main d'œuvre vient de VOTRE tarif, appliqué aux jours et aux hommes que vous avez dictés.",
      elementsPrisEnCompte: d.explication.elementsPrisEnCompte,
      calcul,
      donneesManquantes: [...donneesManquantes, MATERIEL_NON_CHIFFRE],
      ambiguites: d.explication.ambiguites,
    },
  };
}

// =========================================================================
// Le découpage en lignes vendables, et la répartition du montant
// =========================================================================

type Decoupe = {
  lignes: LigneProposee[];
  /** Le total effectivement proposé — somme des lignes CHIFFRÉES, arrondis compris. */
  total: string;
  /** Tous les libellés, empilés : ce que l'écran Prix annonce en un coup d'œil. */
  libelle: string;
  calcul: LigneExplication[];
  donneesManquantes: string[];
};

/** Le prix d'une ligne, et la façon dont son montant se décompose. */
export type PrixLigne = {
  /** `null` quand aucun prix n'a pu être déterminé — jamais « 0 » en guise de « je ne sais pas ». */
  prix: string | null;
  /** Renseignés quand le prix vient d'un TAUX unitaire : 800 ml × 17,50 €. */
  quantite?: string;
  unite?: string | null;
  prixUnitaire?: string;
  calcul: LigneExplication[];
  donneesManquantes: string[];
};

/**
 * Transforme un montant global en lignes de devis réellement vendables.
 *
 * **Ce que le patron répète depuis trois jours :** *« l'abattage, le broyage et
 * l'évacuation, c'est sur une ligne, et la fente, ça doit être séparé. »* Le
 * découpage lui-même est une fonction pure (`lignes-vendables.ts`) ; ce qu'on
 * fait ici, c'est aller chercher en base de quoi chiffrer chaque ligne.
 *
 * **Le prix vient de SA grille, jamais d'un pourcentage.** Sa demande du
 * 8 août : *« on crée une liste de prix en fonction de la hauteur et du
 * diamètre, comme ça il n'invente rien. »* Une case vide n'est donc pas comblée
 * — et depuis le 27 août 2026 elle n'est plus comblée par **zéro** non plus :
 * la ligne sort « à chiffrer », visible, jamais gratuite.
 */
async function decouperEnLignes(
  ctx: Ctx,
  chantierId: string,
  prestations: readonly PrestationAGrouper[],
  /**
   * Les lignes de la dictée, descriptions comprises.
   *
   * **Sans elles, les grilles ne serviraient presque jamais.** La table
   * `prestations` ne gardait qu'un libellé : « vingt mètres de haut », dicté
   * dans la description, y disparaît. Or c'est ce même texte qui décide de
   * poser ou non la question de la hauteur (`questions-chiffrage.ts`). Lire
   * moins ici que là-bas ferait taire la question ET manquer la case.
   */
  textesDictee: string[],
  totalHt: string,
  /** Chaque ligne porte son propre prix, aucun total au temps ne se répartit. */
  forcerAuPoste = false
): Promise<Decoupe> {
  const { lignes: vendables, absorbes } = lignesVendables(prestations);
  const donneesManquantes: string[] = [];
  const calcul: LigneExplication[] = [];

  if (absorbes.length > 0) {
    // Une prestation qui disparaît sans un mot, c'est exactement ce qui lui a
    // fait perdre « on le coupe en 50 » sur le devis du 7 août. Elle disparaît
    // toujours — c'est la règle — mais elle le dit.
    calcul.push({
      libelle: "Compris dans l'abattage",
      detail: `${absorbes.join(", ")}, pas de ligne séparée : le billonnage fait partie du geste d'abattre.`,
    });
  }
  if (vendables.length === 0) {
    return { lignes: [], total: totalHt, libelle: "", calcul, donneesManquantes };
  }

  // Ce que ses grilles savent dire sur CE chantier, ligne par ligne.
  const textesChantier = [...prestations.map((p) => p.libelle), ...textesDictee];
  const chiffrees = await Promise.all(
    vendables.map((l) => prixDeLaLigne(ctx, chantierId, textesChantier, l))
  );
  for (const c of chiffrees) {
    calcul.push(...c.calcul);
    donneesManquantes.push(...c.donneesManquantes);
  }

  const libelle = vendables.map((l) => l.libelle).join("\n");
  const principaleIndex = vendables.findIndex((l) => l.principal);

  /**
   * Écrit une ligne à partir de son prix — ou de son absence.
   *
   * **Le seul endroit où « à chiffrer » se décide**, pour que les trois modèles
   * de chiffrage ci-dessous ne puissent pas en donner trois versions.
   */
  const ecrire = (l: LigneVendable, c: PrixLigne, montantImpose?: string | null): LigneProposee => {
    const montant = montantImpose === undefined ? c.prix : montantImpose;
    const prestationIds = l.prestations.map((p) => p.id).filter((id): id is string => !!id);
    if (montant === null) {
      // **La quantité PHYSIQUE survit même sans prix.** Une haie de 800 ml qu'on
      // ne sait pas chiffrer reste une haie de 800 ml : c'est ce qu'il devra
      // regarder pour poser son prix.
      //
      // La mesure que le chiffrage a su lire passe d'abord — elle vaut pour les
      // prestations d'avant le lot B, qui ne portent leur longueur que dans leur
      // libellé. La quantité commerciale prend le relais ensuite.
      const q = quantiteCommerciale(l.prestations);
      const quantite = c.quantite ?? q.quantite;
      const unite = c.quantite !== undefined ? (c.unite ?? null) : q.unite;
      return { libelle: l.libelle, montant: null, quantite, unite, prixUnitaire: "0", prestationIds };
    }
    // Le taux unitaire quand il existe (800 ml × 17,50 €), le forfait sinon.
    const auTaux = montantImpose === undefined && c.quantite !== undefined && c.prixUnitaire !== undefined;
    return {
      libelle: l.libelle,
      montant,
      quantite: auTaux ? c.quantite! : "1",
      unite: auTaux ? (c.unite ?? null) : null,
      prixUnitaire: auTaux ? c.prixUnitaire! : montant,
      prestationIds,
    };
  };

  const totalDe = (lignes: LigneProposee[]) =>
    lignes.reduce((somme, l) => somme.plus(l.montant ?? "0"), new Decimal(0)).toFixed();

  const direCeQuiResteAChiffrer = (lignes: LigneProposee[]) => {
    const aChiffrer = lignes.filter((l) => l.montant === null);
    if (aChiffrer.length === 0) return;
    // **Ni gratuit, ni oublié.** Le devis ne partira pas tant que ces lignes-là
    // n'ont pas de prix (`peutPreparerLaPiece`), et l'écran dit lesquelles.
    calcul.push({
      libelle: "À chiffrer",
      detail:
        `${aChiffrer.map((l) => `« ${membresDuLibelle(l.libelle)[0]} »`).join(", ")} — ` +
        "aucun prix n'a pu être déterminé. Ces lignes ne valent pas 0 € : elles attendent le vôtre.",
    });
  };

  // --- Modèle « au poste » : chaque ligne porte son propre prix -------------
  //
  // **C'est le devis du 5 août, celui qu'il a écrit lui-même** : haie 350 €,
  // abattage 600 €, fendage 300 €. Dès que la ligne PRINCIPALE a un prix dans sa
  // grille — parce qu'il a posé ses prix d'abattage —, le tarif au temps ne sert
  // plus : le total est la somme des postes, et on le dit.
  //
  // **Un prix qu'il a dicté fait aussi le devis poste par poste** : il a dit ce
  // que vaut ce travail-là, aucun total au temps ne vient le répartir.
  const unPrixDicte = vendables.some((l) => prixDicteDeLaLigne(l.prestations) !== null);
  if (forcerAuPoste || unPrixDicte || (principaleIndex >= 0 && chiffrees[principaleIndex].prix)) {
    const lignes = vendables.map((l, i) => ecrire(l, chiffrees[i]));
    const total = totalDe(lignes);
    calcul.push({
      libelle: "Chiffré poste par poste",
      detail: unPrixDicte
        ? `${total} €, la somme des prix que vous avez dictés et de vos prix de grille.`
        : `${total} €, la somme de vos prix de grille, et non le tarif à la journée. ` +
          "C'est votre grille qui décide dès qu'elle connaît le travail principal.",
    });
    direCeQuiResteAChiffrer(lignes);
    return { lignes, total, libelle, calcul, donneesManquantes };
  }

  // --- Modèle « au temps » : un total global, réparti ------------------------
  //
  // Le tarif au jour/homme donne le total du chantier. Chaque ligne détachable
  // qui a un prix de grille le prend ; la principale garde le reste, de façon
  // qu'aucune ne se vende à perte (sa règle du 7 août : 850 + 250, pas
  // 1 000 + 100).
  if (principaleIndex < 0) {
    // Que des lignes détachables — en pratique une seule, marquée principale
    // par `lignesVendables`. On n'arrive ici que si la règle change.
    const lignes = vendables.map((l, i) => ecrire(l, chiffrees[i], chiffrees[i].prix ?? totalHt));
    return { lignes, total: totalHt, libelle, calcul, donneesManquantes };
  }

  // La règle de répartition est PURE et éprouvée à part
  // (`src/lib/lignes-vendables.ts`) : c'est elle qui encode sa décision du
  // 7 août — 850 + 250, jamais 1 000 + 100.
  const repartition = repartir(
    totalHt,
    chiffrees.map((c) => c.prix),
    principaleIndex
  );

  if (!repartition) {
    // **Sans répartition tenable, on sépare quand même les lignes**, et l'on ne
    // met surtout pas les détachables à zéro : un zéro se lit « gratuit » sur un
    // devis, et c'est le défaut du 26 août 2026. Elles sortent « à chiffrer ».
    const trop = chiffrees.findIndex((c, i) => i !== principaleIndex && c.prix && Number(c.prix) >= Number(totalHt));
    if (trop >= 0) {
      donneesManquantes.push(
        `« ${vendables[trop].libelle} » vaut ${chiffrees[trop].prix} € dans votre grille, soit autant que le ` +
          "chantier entier : le prix n'a pas été réparti. Vérifiez la durée, ou ce prix."
      );
    }
    const lignes = vendables.map((l, i) => ecrire(l, chiffrees[i], i === principaleIndex ? totalHt : null));
    direCeQuiResteAChiffrer(lignes);
    return { lignes, total: totalHt, libelle, calcul, donneesManquantes };
  }

  const montants = repartition.montants;
  if (montants.some((m, i) => i !== principaleIndex && Number(m) > 0)) {
    calcul.push({ libelle: "Répartition", detail: repartition.detail });
  }

  // **Un « 0 » rendu par la répartition n'est pas un prix**, c'est une case de
  // grille vide. `repartir` le documente ainsi depuis le 8 août — « la ligne
  // s'écrit à 0 €, visible comme un prix à poser » —, et « à poser » veut dire
  // « à chiffrer », pas « offert au client ».
  const lignes = vendables.map((l, i) =>
    ecrire(l, chiffrees[i], i !== principaleIndex && Number(montants[i]) === 0 ? null : montants[i])
  );
  direCeQuiResteAChiffrer(lignes);
  return { lignes, total: totalDe(lignes), libelle, calcul, donneesManquantes };
}

/**
 * Le prix d'une ligne, pris dans la grille de SA nature — ou son absence,
 * expliquée.
 *
 * Trois natures, trois façons de désigner une case (`src/lib/grille-prix.ts`) :
 * le fendage à la hauteur × diamètre, l'abattage à la technique × diamètre, la
 * haie au mètre linéaire. Une case vide n'est jamais comblée.
 *
 * **Les mesures viennent d'abord des prestations DE CETTE LIGNE.** Elles
 * partaient de tout le chantier : sur un chantier à deux arbres, la haie
 * pouvait hériter du diamètre de l'érable. Depuis que la ligne connaît les
 * prestations qu'elle vend (migration 0069), elle lit d'abord les siennes.
 */
export async function prixDeLaLigne(
  ctx: Ctx,
  chantierId: string,
  textesChantier: string[],
  ligne: LigneVendable
): Promise<PrixLigne> {
  // **Le prix qu'il a dicté pour ce travail passe avant sa grille.** Une case
  // de grille est son prix d'habitude ; celui-là est sa décision pour ce
  // chantier (21 octobre 2026).
  const dicte = prixDicteDeLaLigne(ligne.prestations);
  if (dicte !== null) {
    return {
      prix: dicte,
      calcul: [{ libelle: "Prix dicté", detail: `${membresDuLibelle(ligne.libelle)[0]} : ${dicte} €, le prix que vous avez dicté.` }],
      donneesManquantes: [],
    };
  }

  // **Sa grille ensuite, et son tarif nommé quand elle se tait** (21 octobre
  // 2026). Un tarif reconnu dans la dictée (« Évacuation ») construisait le
  // devis ENTIER avec lui et jetait les autres travaux ; il chiffre désormais
  // la seule ligne qu'il nomme, et les autres suivent leur propre chemin.
  const grille = await prixDeSaGrille(ctx, chantierId, textesChantier, ligne);
  if (grille.prix !== null) return grille;
  // Sa quantité et son unité partent avec : « 800 ml » × un tarif au ml, mais
  // jamais des tonnes × un forfait.
  const saMesure = quantiteCommerciale(ligne.prestations);
  const nomme = prixDUneLigneDictee(
    membresDuLibelle(ligne.libelle)[0] ?? ligne.libelle,
    parseNombreFrancaisDecimal(saMesure.quantite),
    {
      tarifs: (await listerTarifs(ctx))
        .filter((t) => !tarifJourHomme([{ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }]))
        .map((t) => ({
          tarifId: t.id,
          intitule: t.intitule,
          prix: t.prix,
          unite: t.unite,
        })),
      achats: [],
      marges: { materiel: null, mainOeuvre: null },
    },
    saMesure.unite,
  );
  if (nomme.origine === "vente" && nomme.montant !== null) {
    const multiplie = nomme.quantite !== "1";
    return {
      prix: nomme.montant,
      ...(multiplie ? { quantite: nomme.quantite, unite: nomme.unite, prixUnitaire: nomme.prixUnitaire } : {}),
      calcul: [
        { libelle: "Tarif appliqué", detail: nomme.detail },
        ...(multiplie
          ? [{ libelle: "Quantité", detail: `${nomme.quantite} × ${nomme.prixUnitaire} € = ${nomme.montant} € (quantité confirmée depuis la dictée).` }]
          : []),
      ],
      donneesManquantes: [],
    };
  }
  return grille;
}

/** « 800 », « 12.5 » : la quantité commerciale en nombre, 1 quand elle ne se lit pas. */
function parseNombreFrancaisDecimal(q: string): number {
  const n = Number(q.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Le prix d'une ligne pris dans la grille de SA nature, ou son absence, expliquée. */
async function prixDeSaGrille(
  ctx: Ctx,
  chantierId: string,
  textesChantier: string[],
  ligne: LigneVendable,
): Promise<PrixLigne> {
  // Ses réponses d'abord, la dictée ensuite : il a pu corriger à l'arrêt ce que
  // la transcription avait mal entendu.
  const precisions = await listerPrecisions(ctx, chantierId);
  const reponses = precisions.map((p) => p.lisible);

  // **Ses tranches à lui, jamais celles d'origine.** Depuis le 14 août 2026 il
  // règle les siennes (`tranches_grille`) : chiffrer contre les tranches du
  // dépôt donnerait un prix pris dans la mauvaise case, et cela ne se verrait
  // que sur le devis du client.
  const { axes } = await lireGrilles(ctx);

  // Structure et texte confrontés, une fois pour toute la ligne. Une
  // contradiction ne se tranche pas : elle se dit, et la mesure reste inconnue
  // — sauf si c'est l'artisan lui-même qui a posé la valeur.
  const mesures = mesuresResolues(ligne.prestations, [...reponses, ...ligne.membres, ...textesChantier]);
  const reserves = [
    reserveDeContradiction("le diamètre du tronc", mesures.diametreCm),
    reserveDeContradiction("la hauteur de fût", mesures.futM),
    reserveDeContradiction("la longueur de haie", mesures.longueurMl),
    reserveDeContradiction("le tonnage des grumes", mesures.tonnageT),
    // Ce qu'on ne décide pas à sa place — « deux souches » à un prix de grille.
    prevenirQuantiteNonMultipliee(ligne.prestations),
  ].filter((r): r is string => r !== null);
  const avecReserves = (r: PrixLigne): PrixLigne => ({
    ...r,
    donneesManquantes: [...r.donneesManquantes, ...reserves],
  });

  if (ligne.cle === "haie") return avecReserves(await prixDeLaHaie(ctx, mesures, ligne));

  // **Les grumes : un prix à la tonne**, multiplié par le tonnage — sa réponse
  // du 9 août 2026.
  if (ligne.cle === "grumes") return avecReserves(await prixDesGrumes(ctx, mesures, reponses, ligne));

  // **Le dessouchage : le diamètre, et rien d'autre.** La hauteur de l'arbre ne
  // dit plus rien une fois qu'il est à terre.
  const diametreCm = mesures.diametreCm.valeur;
  // **Le fût, pas l'arbre** (sa règle du 29 septembre 2026) : la hauteur de
  // l'arbre ne décide plus d'aucune case.
  const futM = mesures.futM.valeur;

  if (ligne.cle === "dessouchage") {
    return avecReserves(
      await prixDepuisCase(ctx, "dessouchage", celluleDessouchage(diametreCm, axes), ligne, {
        manquant: diametreCm === null ? ["le diamètre de la souche"] : [],
      })
    );
  }

  if (ligne.cle === "fendage") {
    return avecReserves(
      await prixDepuisCase(ctx, "fendage", celluleFendage(futM, diametreCm, axes), ligne, {
        manquant: [
          futM === null ? "la hauteur de fût" : null,
          diametreCm === null ? "le diamètre du tronc" : null,
        ].filter((x): x is string => x !== null),
      })
    );
  }

  // **Une nature qu'aucune grille ne chiffre reste une ligne à part entière.**
  // Une tonte, une plantation, un travail que le produit ne sait même pas
  // nommer : identifié ne veut pas dire chiffrable, et l'inverse non plus. La
  // ligne sort sans prix, et l'écran dit ce qu'il attend.
  if (ligne.cle !== "abattage") {
    return avecReserves({
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : Atlas ne sait pas encore ` +
          "chiffrer ce travail tout seul. Posez son montant, il partira sur le devis.",
      ],
    });
  }

  // La ligne d'abattage : un prix de grille quand la technique ET le diamètre
  // sont connus.
  const technique = precisions.find((p) => p.sujet.startsWith("abattage.technique"))?.valeur ?? null;
  return avecReserves(
    await prixDepuisCase(ctx, "abattage", celluleAbattage(technique, diametreCm, axes), ligne, {
      manquant: [
        technique === null ? "la technique d'abattage" : null,
        diametreCm === null ? "le diamètre du tronc" : null,
      ].filter((x): x is string => x !== null),
      // Sans grille d'abattage remplie, le chiffrage au temps reprend la main :
      // ce n'est pas un manque à signaler, c'est le fonctionnement d'hier.
      silencieuxSiVide: true,
    })
  );
}

/**
 * Les grumes : un prix à la tonne, multiplié par le tonnage.
 *
 * **Même mécanique que la haie, et pour la même raison.** Retenir le montant de
 * la ligne ferait facturer le même prix au chantier suivant, qu'il y ait une
 * tonne ou dix. Sans tonnage connu, on ne chiffre rien et on dit ce qui manque
 * — plutôt qu'un chiffre qui aurait l'air d'un prix.
 */
async function prixDesGrumes(
  ctx: Ctx,
  mesures: MesuresResolues,
  reponses: string[],
  ligne: LigneVendable
): Promise<PrixLigne> {
  const aLaTonne = (await prixConnusDe(ctx, "grumes")).get(CELLULE_GRUMES);
  // Le tonnage vient du contrat de priorité — structure d'abord, libellé
  // ensuite, refus si les deux se contredisent. Le libellé de la ligne y est
  // ajouté : le patron peut avoir écrit « 6 tonnes » directement dessus.
  const tonnage =
    mesures.tonnageT.valeur ?? mesuresResolues([], [ligne.libelle, ...reponses]).tonnageT.valeur;

  if (!aLaTonne) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : posez votre prix à la tonne ` +
          "dans Réglages, Mes prix, et il servira à tous les devis suivants.",
      ],
    };
  }
  if (tonnage === null) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [`« ${ligne.libelle} » : il manque le tonnage pour appliquer votre prix à la tonne.`],
    };
  }

  const montant = new Decimal(aLaTonne).times(tonnage);
  return {
    prix: montant.toFixed(2),
    // **La décomposition part avec le prix.** Sans elle, le devis afficherait
    // « 1 × 900 € » pour six tonnes, et le client ne saurait pas ce qu'il paie.
    quantite: String(tonnage),
    unite: "tonne",
    prixUnitaire: aLaTonne,
    calcul: [
      {
        libelle: "Enlèvement des grumes",
        detail: `${tonnage} t × ${aLaTonne} € = ${montant.toFixed(2)} €, votre prix à la tonne.`,
      },
    ],
    donneesManquantes: [],
  };
}

/** La haie : un prix au mètre linéaire, multiplié par la longueur. */
async function prixDeLaHaie(
  ctx: Ctx,
  mesures: MesuresResolues,
  ligne: LigneVendable
): Promise<PrixLigne> {
  const auMetre = (await prixConnusDe(ctx, "haie")).get(CELLULE_HAIE);
  // Même contrat que partout : la colonne d'abord, le libellé ensuite, et
  // aucun arbitrage quand les deux divergent — la mesure reste alors inconnue,
  // et la réserve posée plus haut dit au patron laquelle corriger.
  const longueur = mesures.longueurMl.valeur;

  if (!auMetre) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : posez votre prix au mètre linéaire ` +
          "dans Réglages, Mes prix, et il servira à tous les devis suivants.",
      ],
    };
  }
  if (longueur === null) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [`« ${ligne.libelle} » : il manque la longueur en mètres pour appliquer votre prix au ml.`],
    };
  }

  const montant = new Decimal(auMetre).times(longueur);
  return {
    prix: montant.toFixed(2),
    // **C'est le défaut du 26 août 2026, réparé ici.** Le devis portait
    // « Qté 1 — 14 000 € » là où l'artisan avait dit « 800 mètres à 17,50 ».
    // Le total était juste ; sa décomposition mentait.
    quantite: String(longueur),
    unite: "ml",
    prixUnitaire: auMetre,
    calcul: [
      {
        libelle: "Taille de haie",
        detail: `${longueur} ml × ${auMetre} € = ${montant.toFixed(2)} €, votre prix au mètre linéaire.`,
      },
    ],
    donneesManquantes: [],
  };
}

/** Le prix d'une case, quand elle existe et qu'elle est remplie. */
async function prixDepuisCase(
  ctx: Ctx,
  nature: NatureGrille,
  cellule: Cellule | null,
  ligne: LigneVendable,
  options: { manquant?: string[]; silencieuxSiVide?: boolean } = {}
): Promise<PrixLigne> {
  if (!cellule) {
    if (options.silencieuxSiVide) return { prix: null, calcul: [], donneesManquantes: [] };
    const manque = options.manquant?.length
      ? options.manquant
      : ["la hauteur de fût ou le diamètre du tronc"];
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : il manque ${manque.join(" et ")} ` +
          "pour aller chercher dans votre grille.",
      ],
    };
  }

  const trouve = prixDuFendage(cellule, await prixConnusDe(ctx, nature));
  if (!trouve) {
    if (options.silencieuxSiVide) return { prix: null, calcul: [], donneesManquantes: [] };
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `Votre grille de ${nature} n'a pas de prix pour ${cellule.libelle}. Posez-le sur la ligne : ` +
          "il se rangera dans la grille et servira aux chantiers suivants.",
      ],
    };
  }

  return {
    prix: trouve.prix,
    calcul: [
      {
        libelle: nature === "abattage" ? "Abattage" : "Fendage",
        detail: `${trouve.prix} €, votre grille, case « ${cellule.libelle} ».`,
      },
    ],
    donneesManquantes: [],
  };
}

// **`appliquerProposition` a été retirée le 8 août 2026.**
//
// C'était une SECONDE écriture de la proposition au détail, exportée et appelée
// par personne — `appliquerPropositionPrix` (dans `appliquer-proposition.ts`)
// fait le même travail, en refusant les doublons. Deux implémentations d'une
// même règle finissent toujours par diverger (`CLAUDE.md` §3), et celle-ci avait
// déjà commencé : elle ne connaissait pas le contrôle de doublon, et n'aurait
// pas su écrire les deux lignes d'un chantier avec fente.
//
// Elle a été supprimée en découpant les lignes du devis, plutôt que mise à jour
// une seconde fois pour rien.

// =========================================================================
// Ses prix d'ACHAT, après ses prix de vente — sa planche du 19 octobre 2026
// =========================================================================

/** La phrase que la proposition portait quand le matériel n'avait aucun prix. */
const MATERIEL_NON_CHIFFRE = "Le matériel n'est pas chiffré : à ajouter en ligne si le chantier en demande.";

/**
 * **Son ordre, « le A » (19 octobre 2026) : son prix de vente, puis prix
 * d'achat × marge, puis « à chiffrer ».** La proposition de vente ci-dessus
 * reste entière et passe la première ; ce complément ne touche qu'à ce
 * qu'elle laisse sans prix :
 *
 * - une ligne « à chiffrer » prend un prix d'achat × marge s'il en répond un ;
 * - le matériel dicté (« 3 sacs de ciment ») prend TOUJOURS sa ligne : son
 *   tarif de vente s'il en a un seul, sinon un prix d'achat × marge, sinon
 *   « à chiffrer », sans prix, comme le travail (sa réponse du 19 octobre
 *   2026 : *« il me met les 3 sacs de ciment dans le devis, pas de prix, et à
 *   côté il me marque à chiffrer comme il fait avec les autres »*).
 *
 * Sans matériel ni prix d'achat, rien ne change. La règle elle-même est pure
 * (`prixDUneLigneDictee`, `src/lib/prix-achat.ts`).
 */
async function completerParSesAchats(ctx: Ctx, chantierId: string, vente: PropositionPrix): Promise<PropositionPrix> {
  const [achats, materiel] = await Promise.all([prixAchatCandidats(ctx), listerMateriel(ctx, chantierId)]);
  if (achats.length === 0 && materiel.length === 0) return vente;
  const [marges, tarifs, prestations, chantier] = await Promise.all([
    lireMarges(ctx),
    listerTarifs(ctx),
    listerPrestations(ctx, chantierId),
    getChantier(ctx, chantierId),
  ]);
  // Des hommes dictés font partir l'engin avec son conducteur (« Mains d'œuvre
  // plus mini pelle ») ; sans hommes, il part seul (« Mini pelle »).
  const hommesDictes = (parseNombreFrancais(chantier?.tailleEquipe) ?? 0) > 0;
  const sources = { achats, marges };
  const deVente = tarifs.map((t) => ({ tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }));
  const calcul: LigneExplication[] = [];

  // Sans proposition de vente, le travail dicté sort quand même en lignes, du
  // même découpage que le reste (`lignesVendables`), pour que l'achat puisse
  // les chiffrer.
  const base: LigneProposee[] =
    vente.lignes.length > 0
      ? vente.lignes
      : lignesVendables(prestations).lignes.map((l) => {
          const q = quantiteCommerciale(l.prestations);
          return {
            libelle: l.libelle,
            montant: null,
            quantite: q.quantite,
            unite: q.unite,
            prixUnitaire: "0",
            prestationIds: l.prestations.map((p) => p.id).filter((id): id is string => !!id),
          };
        });

  const lignes = base.map((l) => {
    if (l.montant !== null) return l;
    const q = parseNombreFrancais(l.quantite) ?? quantiteDictee(l.libelle);
    // Son unité part avec sa quantité : 10 tonnes ne multiplient pas un forfait.
    const p = prixDUneLigneDictee(membresDuLibelle(l.libelle)[0] ?? l.libelle, q, { ...sources, tarifs: deVente }, l.unite, hommesDictes);
    if (p.montant === null) return l;
    calcul.push({ libelle: p.origine === "vente" ? "Tarif appliqué" : "Prix d'achat", detail: p.detail });
    return { ...l, montant: p.montant, quantite: p.quantite, unite: p.unite, prixUnitaire: p.prixUnitaire };
  });

  const dejaLa = new Set(lignes.map((l) => l.libelle.trim().toLowerCase()));
  for (const m of materiel) {
    const libelle = m.libelle.trim();
    if (!libelle || dejaLa.has(libelle.toLowerCase())) continue;
    const brut = prixDUneLigneDictee(libelle, quantiteDictee(libelle), { ...sources, tarifs: deVente }, null, hommesDictes);
    // **Un engin avec son homme se paie à la journée** (sa règle du 21 octobre
    // 2026, « 400 plus 500 par jour ») : autant de fois que de jours dictés.
    const jours = parseNombreFrancais(chantier?.dureePrevue) ?? 0;
    const p =
      hommesDictes && jours > 1 && brut.tarif && brut.montant !== null && tarifAvecSonHomme(brut.tarif.intitule)
        ? {
            ...brut,
            montant: new Decimal(brut.tarif.prix).times(jours).toFixed(2),
            quantite: String(jours),
            unite: "jour",
            prixUnitaire: new Decimal(brut.tarif.prix).toFixed(2),
          }
        : brut;
    calcul.push({ libelle: p.origine === "vente" ? "Tarif appliqué" : p.origine === "achat" ? "Prix d'achat" : "À chiffrer", detail: p.detail });
    lignes.push({
      libelle,
      montant: p.montant,
      quantite: p.quantite,
      unite: p.unite,
      prixUnitaire: p.prixUnitaire,
      prestationIds: [],
    });
  }

  if (lignes.length === base.length && lignes.every((l, i) => l === base[i])) return vente;
  const chiffrees = lignes.filter((l) => l.montant !== null);
  const total = chiffrees.length > 0 ? chiffrees.reduce((s, l) => s.plus(l.montant!), new Decimal(0)).toFixed(2) : null;
  return {
    ...vente,
    origine: vente.prixPropose === null && total !== null ? "achat" : vente.origine,
    // Rien de chiffré : aucun prix proposé, et surtout pas 0 €. Les lignes
    // partent quand même au devis, « à chiffrer » (`devis-depuis-dictee.ts`).
    prixPropose: total ?? vente.prixPropose,
    libelle: lignes.map((l) => l.libelle).join("\n"),
    lignes,
    explication: {
      ...vente.explication,
      origine:
        vente.prixPropose === null
          ? "Aucun de vos prix de vente ne répond : ces montants viennent de vos prix d'achat, multipliés par votre marge. Ils restent à vérifier."
          : vente.explication.origine,
      calcul: [...vente.explication.calcul, ...calcul],
      donneesManquantes: vente.explication.donneesManquantes.filter((d) => d !== MATERIEL_NON_CHIFFRE),
    },
  };
}
