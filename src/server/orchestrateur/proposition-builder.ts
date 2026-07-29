import { NOM_OUTIL_PROPOSITION } from "../ai/propositions";
import { analyserDemandeTexte } from "./analyse-demande";

export type CorrespondanceTarif = { tarifId: string; intitule: string; prix: string; unite: string | null; source: string };

export type ResultatChiffragePourDevis = {
  variantes?: {
    standard: { prixConseille: string; sousTotal: string; margePourcent: string; coutMainOeuvre: string };
  };
  historique?: { dernierPrix: string; nombreDevis: number; moyenne: string } | null;
};

export type SourcePrix = "tarif" | "tarifs_ambigus" | "chiffrage" | "aucun";

export type PropositionDevisConstruite = {
  succes: true;
  type: "appel_outil";
  outil: string;
  parametres: { texteIntroduction: string; propositions: Record<string, unknown>[] };
  // Remédiation (véracité des explications) : mémorise EXPLICITEMENT quelle
  // branche de décision a réellement produit (ou non) un prix, pour qu'une
  // explication ultérieure ne puisse jamais citer un calcul écarté ou
  // inexistant comme s'il était la source du prix proposé.
  sourcePrix: SourcePrix;
};

// Fonction pure : reçoit des données déjà obtenues (par un outil, peu importe
// le fournisseur LLM ou l'orchestrateur qui les a récupérées) et construit la
// proposition structurée correspondante. Ne fait jamais d'accès base ni
// d'appel réseau. Jamais de prix inventé, jamais de choix arbitraire entre
// plusieurs tarifs.
export function construirePropositionDevis(
  texteSource: string,
  resultatDevis: unknown,
  correspondancesTarifs: CorrespondanceTarif[] | null,
  chiffrage?: ResultatChiffragePourDevis
): PropositionDevisConstruite {
  const { prestations, materiel, ambiguites, dureeTexte, equipeTexte } = analyserDemandeTexte(texteSource);

  const propositions: Record<string, unknown>[] = [];
  for (const p of prestations) {
    propositions.push({ type: "ajouter_prestation", description: `Ajouter prestation : ${p}`, donnees: { libelle: p } });
  }
  for (const m of materiel) {
    propositions.push({ type: "ajouter_materiel", description: `Ajouter matériel : ${m}`, donnees: { libelle: m } });
  }
  if (dureeTexte) {
    propositions.push({
      type: "modifier_duree",
      description: `Modifier la durée : ${dureeTexte}`,
      donnees: { nouvelleDuree: dureeTexte },
    });
  }
  if (equipeTexte) {
    propositions.push({
      type: "modifier_equipe",
      description: `Modifier l'équipe : ${equipeTexte}`,
      donnees: { nouvelleEquipe: equipeTexte },
    });
  }

  const notesIntroduction: string[] = [];
  const devisInfo = resultatDevis as { existe?: boolean; statut?: string; numeroCommercial?: string } | undefined;
  if (devisInfo?.existe) {
    notesIntroduction.push(
      devisInfo.statut === "envoye"
        ? `Le devis ${devisInfo.numeroCommercial} a déjà été envoyé : une nouvelle version sera préparée.`
        : `Complète le devis brouillon existant (${devisInfo.numeroCommercial}).`
    );
  } else {
    notesIntroduction.push("Aucun devis n'existe encore pour ce chantier : il sera créé lors de l'application.");
  }

  // Rapprochement tarifaire — jamais de prix inventé, jamais de choix arbitraire.
  let sourcePrix: SourcePrix = "aucun";
  if (correspondancesTarifs === null && !chiffrage) {
    notesIntroduction.push("Prix à renseigner — aucune recherche de tarif n'a été nécessaire ou possible.");
  } else if (correspondancesTarifs === null && chiffrage) {
    const standard = chiffrage.variantes?.standard;
    if (standard && standard.coutMainOeuvre !== "0.00") {
      sourcePrix = "chiffrage";
      propositions.push({
        type: "ajouter_ligne_prix",
        description: `Ajouter une ligne de prix calculée : ${standard.prixConseille} € (marge ${standard.margePourcent} % sur ${standard.sousTotal} € de coût estimé — pas un tarif existant)`,
        donnees: { libelle: "Prestation (prix calculé)", montant: standard.prixConseille },
      });
      notesIntroduction.push(
        "Aucun tarif existant trouvé : un prix a été calculé par le moteur de chiffrage à partir de la durée, de " +
          "l'équipe et des paramètres de l'entreprise — à vérifier avant application."
      );
      if (chiffrage.historique) {
        notesIntroduction.push(
          `Historique : dernier prix pratiqué ${chiffrage.historique.dernierPrix} € sur ${chiffrage.historique.nombreDevis} devis.`
        );
      }
    } else {
      notesIntroduction.push(
        "Aucun tarif existant et aucun calcul possible (durée ou équipe non connue) — Prix à renseigner manuellement."
      );
    }
  } else if (correspondancesTarifs!.length === 1) {
    sourcePrix = "tarif";
    const t = correspondancesTarifs![0];
    propositions.push({
      type: "ajouter_ligne_prix",
      description: `Ajouter une ligne de prix : ${t.intitule} (${t.prix} €, ${t.source})`,
      donnees: { libelle: t.intitule, montant: t.prix, tarifId: t.tarifId },
    });
  } else if (correspondancesTarifs!.length > 1) {
    sourcePrix = "tarifs_ambigus";
    notesIntroduction.push(
      `Plusieurs tarifs correspondent (${correspondancesTarifs!.map((t) => `${t.intitule} : ${t.prix} €`).join(", ")}) — ` +
        "choisissez lequel utiliser plutôt que de laisser l'assistant décider."
    );
  } else {
    notesIntroduction.push("Aucun tarif correspondant trouvé — Prix à renseigner manuellement.");
  }

  for (const a of ambiguites) {
    notesIntroduction.push(`Ambiguïté à vérifier : « ${a} ».`);
  }
  if (!dureeTexte) notesIntroduction.push("Durée non détectée dans la demande.");
  if (!equipeTexte) notesIntroduction.push("Taille d'équipe non détectée dans la demande.");

  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: {
      texteIntroduction: notesIntroduction.join("\n"),
      propositions,
    },
    sourcePrix,
  };
}
