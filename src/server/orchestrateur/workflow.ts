import type { Ctx } from "../repositories/context";
import { getOutil } from "../ai/tools/registre";
import { analyserDemandeTexte } from "./analyse-demande";
import { construirePropositionDevis, type CorrespondanceTarif, type ResultatChiffragePourDevis } from "./proposition-builder";
import type { EtapeWorkflow, ResultatWorkflow } from "./types";

// Enchaîne, dans un ordre fixe et explicable, les outils déjà existants des
// lots IA-01 à IA-07. N'exécute JAMAIS d'outil hors de ce registre, ne
// réimplémente aucune logique de rapprochement/calcul/proposition — chaque
// étape appelle exactement le même code que l'assistant conversationnel.
// Aucune écriture : le résultat final reste une proposition, soumise au
// mécanisme de confirmation existant (IA-03).
export async function executerWorkflowDemande(ctx: Ctx, chantierId: string, demande: string): Promise<ResultatWorkflow> {
  const etapes: EtapeWorkflow[] = [];
  const contexte = { ctx, chantierId };

  // --- 1. Analyse ---
  const analyse = analyserDemandeTexte(demande);
  etapes.push({
    nom: "Analyse de la demande",
    statut: "reussie",
    resultat: analyse,
    sources: [],
    avertissements: analyse.ambiguites.map((a) => `Ambiguïté à vérifier : « ${a} ».`),
    donneesManquantes: [],
  });

  // --- 2. Recherche documentaire ---
  const outilDocuments = getOutil("RechercherDocuments")!;
  const resultatDocuments = (await outilDocuments.executer(contexte, { motCle: demande })) as {
    resultats?: { document: string; typeDocument: string; passage: string }[];
  };
  etapes.push({
    nom: "Recherche documentaire",
    statut: "reussie",
    resultat: resultatDocuments,
    sources: ["RechercherDocuments"],
    avertissements: !resultatDocuments.resultats?.length ? ["Aucun document pertinent trouvé pour cette demande."] : [],
    donneesManquantes: [],
  });

  // --- 3. Recherche catalogue ---
  const outilPrestation = getOutil("RechercherPrestation")!;
  const resultatCatalogue = (await outilPrestation.executer(contexte, { motCle: demande })) as {
    correspondances?: { prestationId: string; nomCanonique: string }[];
  };
  const prestationTrouvee = resultatCatalogue.correspondances?.[0] ?? null;
  etapes.push({
    nom: "Recherche catalogue",
    statut: "reussie",
    resultat: resultatCatalogue,
    sources: ["RechercherPrestation"],
    avertissements: !prestationTrouvee ? ["Aucune prestation du catalogue ne correspond à cette demande."] : [],
    donneesManquantes: [],
  });

  // --- 4. Recherche historique (uniquement si une prestation catalogue a été identifiée) ---
  let chiffrageHistorique: { dernierPrix: string; nombreDevis: number; moyenne: string } | null = null;
  if (prestationTrouvee) {
    const outilHistorique = getOutil("RechercherHistoriquePrix")!;
    const resultatHistorique = (await outilHistorique.executer(contexte, { prestationId: prestationTrouvee.prestationId })) as {
      historique?: { prix: string; date: string; origine: string }[];
      dernierPrix?: string | null;
    };
    etapes.push({
      nom: "Recherche historique",
      statut: "reussie",
      resultat: resultatHistorique,
      sources: ["RechercherHistoriquePrix"],
      avertissements: !resultatHistorique.historique?.length ? ["Aucun historique de prix pour cette prestation."] : [],
      donneesManquantes: [],
    });
    if (resultatHistorique.historique && resultatHistorique.historique.length > 0) {
      const prix = resultatHistorique.historique.map((h) => Number(h.prix));
      chiffrageHistorique = {
        dernierPrix: resultatHistorique.historique[0].prix,
        nombreDevis: resultatHistorique.historique.length,
        moyenne: (prix.reduce((a, b) => a + b, 0) / prix.length).toFixed(2),
      };
    }
  } else {
    etapes.push({
      nom: "Recherche historique",
      statut: "ignoree",
      sources: [],
      avertissements: [],
      donneesManquantes: ["Aucune prestation catalogue identifiée : l'historique n'a pas pu être consulté."],
    });
  }

  // --- 5. Recherche tarifs (uniquement si un nom canonique a été identifié) ---
  let correspondancesTarifs: CorrespondanceTarif[] | null = null;
  if (prestationTrouvee) {
    const outilTarifs = getOutil("RechercherTarifsCompatibles")!;
    const resultatTarifs = (await outilTarifs.executer(contexte, { motCle: prestationTrouvee.nomCanonique })) as {
      correspondances: CorrespondanceTarif[];
    };
    correspondancesTarifs = resultatTarifs.correspondances;
    etapes.push({
      nom: "Recherche tarifs",
      statut: "reussie",
      resultat: resultatTarifs,
      sources: ["RechercherTarifsCompatibles"],
      avertissements: correspondancesTarifs.length === 0 ? ["Aucun tarif existant ne correspond."] : [],
      donneesManquantes: [],
    });
  } else {
    etapes.push({
      nom: "Recherche tarifs",
      statut: "ignoree",
      sources: [],
      avertissements: [],
      donneesManquantes: ["Aucune prestation catalogue identifiée : aucune recherche de tarif possible."],
    });
  }

  // --- 6. Calcul du chiffrage ---
  const outilChiffrage = getOutil("CalculerChiffrage")!;
  const resultatChiffrage = (await outilChiffrage.executer(contexte, { motCleCatalogue: demande })) as ResultatChiffragePourDevis & {
    variantes?: { standard: { avertissements?: string[] } };
    erreur?: string;
  };

  // Remédiation (bug 10) : une erreur technique renvoyée par un outil (ex.
  // chantier introuvable) ne doit JAMAIS être présentée comme une donnée
  // métier manquante ("durée inconnue") — ce serait une explication fausse.
  if (estErreurOutil(resultatChiffrage)) {
    etapes.push({
      nom: "Calcul du chiffrage",
      statut: "echouee",
      resultat: resultatChiffrage,
      sources: ["CalculerChiffrage"],
      avertissements: [],
      donneesManquantes: [],
    });
    return {
      etapes,
      statut: "arrete",
      raisonArret: `Une erreur technique a interrompu le traitement : ${resultatChiffrage.erreur}`,
      prochaineAction: "Vérifiez que le chantier existe toujours, puis réessayez.",
    };
  }

  const coutMainOeuvre = resultatChiffrage.variantes?.standard?.coutMainOeuvre ?? "0.00";
  const chiffrageInconnu = coutMainOeuvre === "0.00";
  const aucunTarif = !correspondancesTarifs || correspondancesTarifs.length === 0;

  etapes.push({
    nom: "Calcul du chiffrage",
    statut: chiffrageInconnu ? "echouee" : "reussie",
    resultat: resultatChiffrage,
    sources: ["CalculerChiffrage"],
    avertissements: chiffrageInconnu ? ["Durée ou taille d'équipe du chantier inconnue : coût de main-d'œuvre non calculable."] : [],
    donneesManquantes: chiffrageInconnu ? ["Durée du chantier", "Taille de l'équipe"] : [],
  });

  // --- Arrêt explicite si aucune donnée fiable ne permet de proposer un prix ---
  if (aucunTarif && chiffrageInconnu) {
    return {
      etapes,
      statut: "arrete",
      raisonArret:
        "La durée ou la taille de l'équipe du chantier est inconnue, et aucun tarif existant ne correspond à cette " +
        "demande : le chiffrage est impossible sans inventer une donnée.",
      prochaineAction: "Complétez la durée et la taille d'équipe du chantier (écran Informations), ou renseignez un tarif adapté.",
    };
  }

  // --- 7 & 8. Préparation du devis + proposition finale (fonction partagée, jamais dupliquée) ---
  const outilDevis = getOutil("LireDevis")!;
  const resultatDevis = await outilDevis.executer(contexte, {});

  if (estErreurOutil(resultatDevis)) {
    etapes.push({
      nom: "Préparation du devis et proposition finale",
      statut: "echouee",
      resultat: resultatDevis,
      sources: ["LireDevis"],
      avertissements: [],
      donneesManquantes: [],
    });
    return {
      etapes,
      statut: "arrete",
      raisonArret: `Une erreur technique a interrompu la préparation du devis : ${resultatDevis.erreur}`,
      prochaineAction: "Vérifiez que le chantier existe toujours, puis réessayez.",
    };
  }

  const proposition = construirePropositionDevis(
    demande,
    resultatDevis,
    aucunTarif ? null : correspondancesTarifs,
    aucunTarif ? { ...resultatChiffrage, historique: chiffrageHistorique } : undefined
  );

  etapes.push({
    nom: "Préparation du devis et proposition finale",
    statut: "reussie",
    resultat: { ...proposition.parametres, sourcePrix: proposition.sourcePrix },
    sources: ["LireDevis"],
    avertissements: [],
    donneesManquantes: [],
  });

  return {
    etapes,
    statut: "termine",
    propositionFinale: proposition.parametres,
  };
}

function estErreurOutil(resultat: unknown): resultat is { erreur: string } {
  return (
    typeof resultat === "object" &&
    resultat !== null &&
    "erreur" in resultat &&
    typeof (resultat as { erreur: unknown }).erreur === "string"
  );
}
