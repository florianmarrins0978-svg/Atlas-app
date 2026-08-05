import Decimal from "decimal.js";
import type { Ctx } from "../repositories/context";
import { getChantier } from "../repositories/chantiers";
import { listerPrestations } from "../repositories/prestations";
import { listerMateriel } from "../repositories/materiel";
import { listerTarifs, getTarif } from "../repositories/tarifs";
import { ajouterLignePrix } from "../repositories/lignes-prix";
import { getBrouillon } from "../repositories/brouillons-informations";
import { chiffrerChantier } from "./service";
import { parseNombreFrancais } from "./parse";
import type { SourcePrix } from "../orchestrateur/proposition-builder";
import type { LigneExplication } from "./types";

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

export type PropositionPrix = {
  origine: OriginePrix;
  // Montant HT proposé. null dès que l'origine ne permet pas d'en proposer un
  // — jamais 0 en guise de « pas de prix ».
  prixPropose: string | null;
  libelle: string | null;
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

  return {
    origine: "chiffrage",
    prixPropose: standard.prixConseille,
    libelle: "Prestation (prix calculé)",
    tarifId: null,
    tarifsCandidats: [],
    explication: {
      origine:
        "Aucun tarif enregistré ne correspond : ce montant a été calculé à partir de vos paramètres de chiffrage. Il reste à vérifier.",
      elementsPrisEnCompte,
      calcul: standard.explications,
      donneesManquantes: [...donneesManquantes, ...standard.avertissements],
      ambiguites,
    },
  };
}

// Écrit la proposition dans le détail du chantier.
//
// **Vit ici, et non dans un fichier d'actions, parce que deux appelants en ont
// besoin** : l'écran Prix, quand le patron applique lui-même, et le tapis
// roulant, qui enchaîne la dictée jusqu'au devis sans lui.
//
// Le montant n'est JAMAIS repris de ce qu'affiche un navigateur : la
// proposition est recalculée ici, depuis la base, et c'est ce résultat-là qui
// est écrit. Un détail falsifié côté client n'a donc aucun effet.
export async function appliquerProposition(
  ctx: Ctx,
  chantierId: string,
  tarifIdChoisi?: string
): Promise<
  | { succes: true; ligne: { id: string; libelle: string; montant: string } }
  | { succes: false; erreur: string; ambigu?: boolean }
> {
  const proposition = await preparerPropositionPrix(ctx, chantierId);
  if (!proposition) return { succes: false, erreur: "Chantier introuvable." };

  // Deux tarifs plausibles : l'agent n'en choisit jamais un lui-même
  // (docs/AGENT.md §3). Il les présente, et c'est le patron qui tranche.
  if (proposition.origine === "tarifs_ambigus") {
    if (!tarifIdChoisi) {
      return { succes: false, erreur: "Plusieurs tarifs correspondent : choisissez celui à appliquer.", ambigu: true };
    }
    const candidat = proposition.tarifsCandidats.find((c) => c.tarifId === tarifIdChoisi);
    if (!candidat) {
      return { succes: false, erreur: "Ce tarif ne fait pas partie des tarifs proposés pour ce chantier." };
    }
    const tarifActuel = await getTarif(ctx, candidat.tarifId);
    if (!tarifActuel) {
      return { succes: false, erreur: "Ce tarif n'existe plus." };
    }
    const ligne = await ajouterLignePrix(ctx, chantierId, tarifActuel.intitule, tarifActuel.prix);
    return { succes: true, ligne: { id: ligne.id, libelle: ligne.libelle, montant: ligne.montant } };
  }

  if (proposition.prixPropose === null || !proposition.libelle) {
    return { succes: false, erreur: "Aucun prix ne peut être proposé en l'état." };
  }

  const ligne = await ajouterLignePrix(ctx, chantierId, proposition.libelle, proposition.prixPropose);
  return { succes: true, ligne: { id: ligne.id, libelle: ligne.libelle, montant: ligne.montant } };
}
