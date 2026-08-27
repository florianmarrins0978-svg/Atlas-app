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
import { chiffrerMainOeuvre } from "../../lib/tarif-main-oeuvre";
import {
  lignesVendables,
  membresDuLibelle,
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
import { listerPrecisions } from "../repositories/precisions-chantier";

// Origine du prix — même taxonomie que l'orchestrateur (SourcePrix), volontairement
// réutilisée plutôt que redéfinie : les deux chemins doivent raconter la même
// chose au patron, qu'il passe par l'assistant ou par l'écran Prix.
export type OriginePrix = SourcePrix;

export type TarifCandidat = {
  tarifId: string;
  intitule: string;
  prix: string;
  unite: string | null;
};

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

// Rapproche un tarif d'une prestation par correspondance d'intitulé, dans les
// deux sens (le tarif « Élagage » couvre « élagage du sapin », et inversement).
// Même règle que l'outil RechercherTarifsCompatibles — jamais de rapprochement
// approximatif au-delà de l'inclusion littérale.
function tarifsCorrespondants(
  tarifs: { id: string; intitule: string; prix: string; unite: string | null }[],
  libelles: string[]
): TarifCandidat[] {
  const trouves = new Map<string, TarifCandidat>();
  for (const libelle of libelles) {
    const l = libelle.trim().toLowerCase();
    if (!l) continue;
    for (const t of tarifs) {
      const i = t.intitule.trim().toLowerCase();
      if (!i) continue;
      if (l.includes(i) || i.includes(l)) {
        trouves.set(t.id, { tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite });
      }
    }
  }
  return [...trouves.values()];
}

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
          libelle: `Quantité — ${ligne.libelle}`,
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

  // --- Rapprochement tarifaire --------------------------------------------
  const tarifs = await listerTarifs(ctx);
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
          detail: `${c.prix} €${c.unite ? ` / ${c.unite}` : ""} — tarif enregistré par l'entreprise.`,
        })),
        donneesManquantes,
        ambiguites,
      },
    };
  }

  if (candidats.length === 1) {
    const tarif = candidats[0];
    const calcul: LigneExplication[] = [
      {
        libelle: "Tarif appliqué",
        detail: `${tarif.intitule} : ${tarif.prix} €${tarif.unite ? ` / ${tarif.unite}` : ""} (tarif enregistré par l'entreprise).`,
      },
    ];

    // Quantité × prix unitaire uniquement si la quantité a été explicitement
    // confirmée ET que le tarif porte une unité. Sans cela, le tarif est repris
    // tel quel : jamais de quantité supposée.
    let montant = new Decimal(tarif.prix);
    // La décomposition écrite sur la ligne : « 800 ml × 17,50 € », ou un forfait.
    let quantiteLigne = "1";
    let uniteLigne: string | null = null;
    const prixUnitaireLigne = tarif.prix;
    const correspondance = [...quantitesParLibelle.entries()].find(
      ([libelle]) => libelle.includes(tarif.intitule.trim().toLowerCase()) || tarif.intitule.trim().toLowerCase().includes(libelle)
    );
    const quantiteConfirmee = correspondance?.[1];

    if (quantiteConfirmee && tarif.unite) {
      const q = parseNombreFrancais(quantiteConfirmee.quantite);
      if (q !== null) {
        montant = new Decimal(tarif.prix).times(q);
        // **Sans cette décomposition, le client lisait « 1 × 14 000 € ».** Le
        // total était juste ; c'est sa décomposition qui mentait.
        quantiteLigne = String(q);
        uniteLigne = quantiteConfirmee.unite ?? tarif.unite;
        calcul.push({
          libelle: "Quantité",
          detail: `${q} × ${tarif.prix} € = ${montant.toFixed(2)} € (quantité confirmée depuis la dictée).`,
        });
      }
    } else if (tarif.unite) {
      donneesManquantes.push(
        `Aucune quantité confirmée pour « ${tarif.intitule} » : le tarif unitaire est repris tel quel, sans multiplication.`
      );
    }

    return {
      origine: "tarif",
      prixPropose: montant.toFixed(2),
      libelle: tarif.intitule,
      // Un tarif nommé décrit UNE prestation : il n'y a rien à découper.
      lignes: [
        {
          libelle: tarif.intitule,
          montant: montant.toFixed(2),
          quantite: quantiteLigne,
          unite: uniteLigne,
          prixUnitaire: quantiteLigne === "1" ? montant.toFixed(2) : prixUnitaireLigne,
          // Un tarif nommé ne dit pas quelles prestations il couvre : le lien
          // se fait ailleurs, par le libellé, comme avant.
          prestationIds: [],
        },
      ],
      tarifId: tarif.tarifId,
      tarifsCandidats: [],
      explication: {
        origine: "Ce prix provient d'un tarif que vous avez déjà enregistré — il n'a pas été calculé.",
        elementsPrisEnCompte,
        calcul,
        donneesManquantes,
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
          "Ce prix vient de VOTRE grille de tarifs, appliquée à la durée et à l'équipe que vous avez dictées — il n'a pas été reconstitué depuis vos coûts.",
        elementsPrisEnCompte,
        calcul: [
          { libelle: "Main d'œuvre", detail: mainOeuvre.detail },
          ...(arrondi !== mainOeuvre.montant
            ? [{ libelle: "Arrondi", detail: `${mainOeuvre.montant} € arrondi à ${arrondi} € — « en HT on fait des prix ronds ».` }]
            : []),
          ...decoupe.calcul,
        ],
        donneesManquantes: [
          ...donneesManquantes,
          ...decoupe.donneesManquantes,
          "Le matériel n'est pas chiffré : à ajouter en ligne si le chantier en demande.",
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
                detail: `${standard.prixConseille} € arrondi à ${arrondiCalcule} € — « en HT on fait des prix ronds ».`,
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
type PrixLigne = {
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
  totalHt: string
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
      detail: `${absorbes.join(", ")} — pas de ligne séparée : le billonnage fait partie du geste d'abattre.`,
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
    // n'ont pas de prix (`peutPreparerDevis`), et l'écran dit lesquelles.
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
  if (principaleIndex >= 0 && chiffrees[principaleIndex].prix) {
    const lignes = vendables.map((l, i) => ecrire(l, chiffrees[i]));
    const total = totalDe(lignes);
    calcul.push({
      libelle: "Chiffré poste par poste",
      detail:
        `${total} € — la somme de vos prix de grille, et non le tarif à la journée. ` +
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
async function prixDeLaLigne(
  ctx: Ctx,
  chantierId: string,
  textesChantier: string[],
  ligne: LigneVendable
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
    reserveDeContradiction("la hauteur de l'arbre", mesures.hauteurM),
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
  const hauteurM = mesures.hauteurM.valeur;

  if (ligne.cle === "dessouchage") {
    return avecReserves(
      await prixDepuisCase(ctx, "dessouchage", celluleDessouchage(diametreCm, axes), ligne, {
        manquant: diametreCm === null ? ["le diamètre de la souche"] : [],
      })
    );
  }

  if (ligne.cle === "fendage") {
    return avecReserves(
      await prixDepuisCase(ctx, "fendage", celluleFendage(hauteurM, diametreCm, axes), ligne, {
        manquant: [
          hauteurM === null ? "la hauteur de l'arbre" : null,
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
        detail: `${tonnage} t × ${aLaTonne} € = ${montant.toFixed(2)} € — votre prix à la tonne.`,
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
        detail: `${longueur} ml × ${auMetre} € = ${montant.toFixed(2)} € — votre prix au mètre linéaire.`,
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
      : ["la hauteur de l'arbre ou le diamètre du tronc"];
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
        detail: `${trouve.prix} € — votre grille, case « ${cellule.libelle} ».`,
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
