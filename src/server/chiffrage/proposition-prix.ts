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
import { lignesVendables, repartir, type LigneVendable } from "../../lib/lignes-vendables";
import {
  CELLULE_GRUMES,
  CELLULE_HAIE,
  celluleAbattage,
  celluleDessouchage,
  celluleFendage,
  prixDuFendage,
  type NatureGrille,
} from "../../lib/grille-prix";
import { longueurHaieLue, mesuresArbre, tonnageLu } from "../../lib/mesures-arbre";
import { prixConnusDe } from "../repositories/grille-prix";
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
export type LigneProposee = { libelle: string; montant: string };

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
    const correspondance = [...quantitesParLibelle.entries()].find(
      ([libelle]) => libelle.includes(tarif.intitule.trim().toLowerCase()) || tarif.intitule.trim().toLowerCase().includes(libelle)
    );
    const quantiteConfirmee = correspondance?.[1];

    if (quantiteConfirmee && tarif.unite) {
      const q = parseNombreFrancais(quantiteConfirmee.quantite);
      if (q !== null) {
        montant = new Decimal(tarif.prix).times(q);
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
      lignes: [{ libelle: tarif.intitule, montant: montant.toFixed(2) }],
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
  /** Le total effectivement proposé — somme des lignes, arrondis compris. */
  total: string;
  /** Tous les libellés, empilés : ce que l'écran Prix annonce en un coup d'œil. */
  libelle: string;
  calcul: LigneExplication[];
  donneesManquantes: string[];
};

/**
 * Transforme un montant global en lignes de devis réellement vendables.
 *
 * **Ce que le patron répète depuis trois jours :** *« l'abattage, le broyage et
 * l'évacuation, c'est sur une ligne, et la fente, ça doit être séparé. »* Le
 * découpage lui-même est une fonction pure (`lignes-vendables.ts`) ; ce qu'on
 * fait ici, c'est aller chercher en base de quoi chiffrer la ligne détachable.
 *
 * **Le prix de la fente vient de SA grille, jamais d'un pourcentage.** Sa
 * demande du 8 août : *« on crée une liste de prix en fonction de la hauteur et
 * du diamètre, comme ça il n'invente rien. »* Une case vide n'est donc pas
 * comblée par une estimation — la ligne s'écrit à 0 €, visible comme un prix à
 * poser, et la raison est dite.
 */
async function decouperEnLignes(
  ctx: Ctx,
  chantierId: string,
  prestations: { libelle: string }[],
  /**
   * Les lignes de la dictée, descriptions comprises.
   *
   * **Sans elles, les grilles ne serviraient presque jamais.** La table
   * `prestations` ne garde qu'un libellé : « vingt mètres de haut », dicté dans
   * la description, y disparaît. Or c'est ce même texte qui décide de poser ou
   * non la question de la hauteur (`questions-chiffrage.ts`). Lire moins ici que
   * là-bas ferait taire la question ET manquer la case — la ligne resterait
   * sans prix, sans qu'aucune erreur ne l'explique.
   */
  textesDictee: string[],
  totalHt: string
): Promise<Decoupe> {
  const { lignes: vendables, absorbes } = lignesVendables(prestations.map((p) => p.libelle));
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
  const textes = [...prestations.map((p) => p.libelle), ...textesDictee];
  const chiffrees = await Promise.all(vendables.map((l) => prixDeLaLigne(ctx, chantierId, textes, l)));
  for (const c of chiffrees) {
    calcul.push(...c.calcul);
    donneesManquantes.push(...c.donneesManquantes);
  }

  const libelle = vendables.map((l) => l.libelle).join("\n");
  const principaleIndex = vendables.findIndex((l) => !l.detachable);

  // --- Modèle « au poste » : chaque ligne porte son propre prix -------------
  //
  // **C'est le devis du 5 août, celui qu'il a écrit lui-même** : haie 350 €,
  // abattage 600 €, fendage 300 €. Dès que la ligne PRINCIPALE a un prix dans sa
  // grille — parce qu'il a posé ses prix d'abattage —, le tarif au temps ne sert
  // plus : le total est la somme des postes, et on le dit.
  if (principaleIndex >= 0 && chiffrees[principaleIndex].prix) {
    const lignes = vendables.map((l, i) => ({ libelle: l.libelle, montant: chiffrees[i].prix ?? "0" }));
    const total = lignes.reduce((somme, l) => somme.plus(l.montant), new Decimal(0)).toFixed();
    calcul.push({
      libelle: "Chiffré poste par poste",
      detail:
        `${total} € — la somme de vos prix de grille, et non le tarif à la journée. ` +
        "C'est votre grille qui décide dès qu'elle connaît le travail principal.",
    });
    return { lignes, total, libelle, calcul, donneesManquantes };
  }

  // --- Modèle « au temps » : un total global, réparti ------------------------
  //
  // Le tarif au jour/homme donne le total du chantier. Chaque ligne détachable
  // qui a un prix de grille le prend ; la principale garde le reste, de façon
  // qu'aucune ne se vende à perte (sa règle du 7 août : 850 + 250, pas
  // 1 000 + 100).
  if (principaleIndex < 0) {
    // Que des lignes détachables — en pratique une seule, marquée non
    // détachable par `lignesVendables`. On n'arrive ici que si la règle change.
    return {
      lignes: vendables.map((l, i) => ({ libelle: l.libelle, montant: chiffrees[i].prix ?? totalHt })),
      total: totalHt,
      libelle,
      calcul,
      donneesManquantes,
    };
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
    // **Sans répartition tenable, on sépare quand même les lignes.** C'est la
    // moitié de ce qu'il demande, et elle ne dépend d'aucune grille : le client
    // doit voir la fente à part pour pouvoir la refuser. Le montant reste sur
    // la ligne principale — le déplacer sans savoir combien vaut la fente
    // reviendrait à l'inventer.
    const trop = chiffrees.findIndex((c, i) => i !== principaleIndex && c.prix && Number(c.prix) >= Number(totalHt));
    if (trop >= 0) {
      donneesManquantes.push(
        `« ${vendables[trop].libelle} » vaut ${chiffrees[trop].prix} € dans votre grille, soit autant que le ` +
          "chantier entier : le prix n'a pas été réparti. Vérifiez la durée, ou ce prix."
      );
    }
    const lignesBrutes = vendables.map((l, i) => ({
      libelle: l.libelle,
      montant: i === principaleIndex ? totalHt : "0",
    }));
    return { lignes: lignesBrutes, total: totalHt, libelle, calcul, donneesManquantes };
  }

  const montants = repartition.montants;
  if (montants.some((m, i) => i !== principaleIndex && Number(m) > 0)) {
    calcul.push({ libelle: "Répartition", detail: repartition.detail });
  }

  const lignes = vendables.map((l, i) => ({ libelle: l.libelle, montant: montants[i] }));
  const total = lignes.reduce((somme, l) => somme.plus(l.montant), new Decimal(0)).toFixed();
  return { lignes, total, libelle, calcul, donneesManquantes };
}

/**
 * Le prix d'une ligne, pris dans la grille de SA nature — ou son absence,
 * expliquée.
 *
 * Trois natures, trois façons de désigner une case (`src/lib/grille-prix.ts`) :
 * le fendage à la hauteur × diamètre, l'abattage à la technique × diamètre, la
 * haie au mètre linéaire. Une case vide n'est jamais comblée : la ligne s'écrit
 * à 0 €, visible comme un prix à poser, et l'écran nomme ce qui manque.
 */
async function prixDeLaLigne(
  ctx: Ctx,
  chantierId: string,
  textes: string[],
  ligne: LigneVendable
): Promise<{ prix: string | null; calcul: LigneExplication[]; donneesManquantes: string[] }> {
  // Ses réponses d'abord, la dictée ensuite : il a pu corriger à l'arrêt ce que
  // la transcription avait mal entendu.
  const precisions = await listerPrecisions(ctx, chantierId);
  const reponses = precisions.map((p) => p.lisible);

  if (ligne.cle === "haie") return prixDeLaHaie(ctx, reponses, textes, ligne);

  // **Les grumes : un prix à la tonne**, multiplié par le tonnage — sa réponse
  // du 9 août 2026.
  if (ligne.cle === "grumes") return prixDesGrumes(ctx, reponses, textes, ligne);

  // **Le dessouchage : le diamètre, et rien d'autre.** La hauteur de l'arbre ne
  // dit plus rien une fois qu'il est à terre.
  if (ligne.cle === "dessouchage") {
    const { diametreCm } = mesuresArbre(reponses, textes);
    return prixDepuisCase(ctx, "dessouchage", celluleDessouchage(diametreCm), ligne, {
      manquant: diametreCm === null ? ["le diamètre de la souche"] : [],
    });
  }

  if (ligne.cle === "fendage") {
    const mesures = mesuresArbre(reponses, textes);
    return prixDepuisCase(ctx, "fendage", celluleFendage(mesures.hauteurM, mesures.diametreCm), ligne, {
      manquant: [
        mesures.hauteurM === null ? "la hauteur de l'arbre" : null,
        mesures.diametreCm === null ? "le diamètre du tronc" : null,
      ].filter((x): x is string => x !== null),
    });
  }

  // La ligne principale : elle n'a de prix de grille que si elle porte un
  // abattage, et seulement quand la technique ET le diamètre sont connus.
  if (!/\b(abattage|abattre|abatt|d[ée]mont)/i.test(ligne.libelle)) {
    return { prix: null, calcul: [], donneesManquantes: [] };
  }
  const technique = precisions.find((p) => p.sujet.startsWith("abattage.technique"))?.valeur ?? null;
  const { diametreCm } = mesuresArbre(reponses, textes);
  return prixDepuisCase(ctx, "abattage", celluleAbattage(technique, diametreCm), ligne, {
    manquant: [
      technique === null ? "la technique d'abattage" : null,
      diametreCm === null ? "le diamètre du tronc" : null,
    ].filter((x): x is string => x !== null),
    // Sans grille d'abattage remplie, le chiffrage au temps reprend la main :
    // ce n'est pas un manque à signaler, c'est le fonctionnement d'hier.
    silencieuxSiVide: true,
  });
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
  reponses: string[],
  textes: string[],
  ligne: LigneVendable
): Promise<{ prix: string | null; calcul: LigneExplication[]; donneesManquantes: string[] }> {
  const aLaTonne = (await prixConnusDe(ctx, "grumes")).get(CELLULE_GRUMES);
  const tonnage = [...reponses, ligne.libelle, ...textes].map(tonnageLu).find((t) => t !== null) ?? null;

  if (!aLaTonne) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : posez votre prix à la tonne ` +
          "dans Réglages → Mes prix, et il servira à tous les devis suivants.",
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
  reponses: string[],
  textes: string[],
  ligne: LigneVendable
): Promise<{ prix: string | null; calcul: LigneExplication[]; donneesManquantes: string[] }> {
  const auMetre = (await prixConnusDe(ctx, "haie")).get(CELLULE_HAIE);
  const longueur = [...reponses, ...textes].map(longueurHaieLue).find((l) => l !== null) ?? null;

  if (!auMetre) {
    return {
      prix: null,
      calcul: [],
      donneesManquantes: [
        `« ${ligne.libelle} » est sur sa propre ligne, sans prix : posez votre prix au mètre linéaire ` +
          "dans Réglages → Mes prix, et il servira à tous les devis suivants.",
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
  cellule: ReturnType<typeof celluleFendage>,
  ligne: LigneVendable,
  options: { manquant?: string[]; silencieuxSiVide?: boolean } = {}
): Promise<{ prix: string | null; calcul: LigneExplication[]; donneesManquantes: string[] }> {
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
