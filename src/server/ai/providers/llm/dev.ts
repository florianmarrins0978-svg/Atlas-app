import type { FournisseurLLM, ResultatLLM, ResultatLLMAvecOutils, MessageConversation, DefinitionOutil } from "./interface";
import { erreurIA } from "../../errors";
import { NOM_OUTIL_PROPOSITION } from "../../propositions";
import { analyserDemandeTexte, REGEX_DUREE, REGEX_EQUIPE } from "../../../orchestrateur/analyse-demande";
import {
  construirePropositionDevis,
  type CorrespondanceTarif,
  type ResultatChiffragePourDevis,
} from "../../../orchestrateur/proposition-builder";
import type { ResultatWorkflow } from "../../../orchestrateur/types";

// Fournisseur de développement/test — aucun appel réseau, résultat déterministe.
// Ne connaît pas de "vrai" modèle de langage : reproduit par heuristique le
// comportement attendu pour le seul usage actuel (extraction structurée),
// exposé via l'interface LLM générique comme le ferait un vrai fournisseur
// (le texte retourné est un JSON, à valider par l'appelant). À réévaluer le
// jour où un second cas d'usage LLM apparaîtra (voir Lot IA-01.5).
// L'analyse de texte elle-même (analyserDemandeTexte) est partagée avec
// l'orchestrateur (lot IA-08) — jamais dupliquée.
export const fournisseurLLMDev: FournisseurLLM = {
  nom: "dev",
  async genererTexte(_systeme: string, message: string): Promise<ResultatLLM> {
    if (!message || message.trim().length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Message vide — rien à traiter.") };
    }

    const { prestations, materiel, ambiguites, dureeTexte, equipeTexte } = analyserDemandeTexte(message);

    const informationsManquantes: string[] = [];
    if (!dureeTexte) informationsManquantes.push("Durée prévue non détectée");
    if (!equipeTexte) informationsManquantes.push("Taille d'équipe non détectée");

    const proposition = {
      prestations,
      dureePrevue: dureeTexte,
      tailleEquipe: equipeTexte,
      materiel,
      remarques: null,
      ambiguites,
      informationsManquantes,
    };

    return { succes: true, texte: JSON.stringify(proposition) };
  },

  // Simulation déterministe de l'usage d'outils : sélectionne un outil par
  // mots-clés simples dans le dernier message utilisateur, puis produit une
  // réponse finale à partir du résultat obtenu. Aucun réseau, entièrement
  // testable. Comportement d'un vrai LLM reproduit en surface uniquement.
  async genererAvecOutils(
    _systeme: string,
    historique: MessageConversation[],
    outils: DefinitionOutil[]
  ): Promise<ResultatLLMAvecOutils> {
    const dernier = historique[historique.length - 1];
    const dernierMessageUtilisateur = [...historique].reverse().find((m) => m.role === "user");
    const texte = dernierMessageUtilisateur && "contenu" in dernierMessageUtilisateur ? dernierMessageUtilisateur.contenu : "";
    const texteMinuscule = texte.toLowerCase();
    const proposeDisponible = outils.some((o) => o.nom === NOM_OUTIL_PROPOSITION);
    const estSuppression = /supprime|retire|enl[eè]ve/.test(texteMinuscule);
    const estModification = /modifie|change|remplace/.test(texteMinuscule);

    // --- Orchestrateur (lot IA-08) : workflow complet, ou questions de suivi.
    // Aucune mémoire persistante : une question de suivi (autre échange)
    // retrouve la demande d'origine dans l'historique de conversation déjà
    // disponible, puis relit le résultat en ré-exécutant le même workflow en
    // lecture seule (déterministe, sans écriture) — jamais un nouveau stockage.
    const estDemandeWorkflow = /bout en bout|workflow complet|orchestrateur|traite (cette|la) demande/.test(texteMinuscule);
    const REGEX_TRIGGER_WORKFLOW = /bout en bout|workflow complet|orchestrateur|traite (cette|la) demande\s*:?\s*/i;
    const estQuestionSuiviWorkflow =
      /o[uù] en est|pourquoi t'es-tu arr[êe]t|quelles informations manquent|quelles sources|pourquoi propos/.test(texteMinuscule);

    if (dernier && dernier.role === "outil" && dernier.outil === "ExecuterWorkflowDemande") {
      if (estQuestionSuiviWorkflow) {
        return { succes: true, type: "texte", texte: expliquerSuiviWorkflow(dernier.resultat, texteMinuscule) };
      }
      if (estDemandeWorkflow) {
        return construireReponseWorkflow(dernier.resultat);
      }
    }

    if (estQuestionSuiviWorkflow) {
      const demandeAnterieure = [...historique]
        .reverse()
        .find(
          (m): m is { role: "user" | "assistant"; contenu: string } =>
            "contenu" in m && m.role === "user" && REGEX_TRIGGER_WORKFLOW.test(m.contenu)
        );
      if (demandeAnterieure && outils.some((o) => o.nom === "ExecuterWorkflowDemande")) {
        return {
          succes: true,
          type: "appel_outil",
          outil: "ExecuterWorkflowDemande",
          parametres: { demande: demandeAnterieure.contenu.replace(REGEX_TRIGGER_WORKFLOW, "") },
        };
      }
      return { succes: true, type: "texte", texte: "Aucun workflow n'a encore été exécuté dans cette conversation." };
    }

    if (estDemandeWorkflow && outils.some((o) => o.nom === "ExecuterWorkflowDemande")) {
      if (!dernier || dernier.role !== "outil") {
        return {
          succes: true,
          type: "appel_outil",
          outil: "ExecuterWorkflowDemande",
          parametres: { demande: texte.replace(REGEX_TRIGGER_WORKFLOW, "") },
        };
      }
    }

    // --- Questions de compréhension (lot IA-07) : recherche dans les documents ---
    const estQuestionDocumentaire =
      /retrouve|recherche|consigne|intervention|document|devis dit|disait|historique de/.test(texteMinuscule) &&
      outils.some((o) => o.nom === "RechercherDocuments");
    if (estQuestionDocumentaire) {
      if (!dernier || dernier.role !== "outil") {
        return { succes: true, type: "appel_outil", outil: "RechercherDocuments", parametres: { motCle: extraireMotCleDocument(texte) } };
      }
      if (dernier.outil === "RechercherDocuments") {
        return { succes: true, type: "texte", texte: expliquerRechercheDocuments(dernier.resultat) };
      }
    }

    // --- Questions de chiffrage (lot IA-06) : prix conseillé, coût, marge ---
    const estQuestionChiffrage =
      /prix|co[uû]t|marge/.test(texteMinuscule) &&
      /conseill|propos|estimation|estimer|combien|pourquoi|calcul/.test(texteMinuscule);
    if (estQuestionChiffrage && outils.some((o) => o.nom === "CalculerChiffrage")) {
      if (!dernier || dernier.role !== "outil") {
        return { succes: true, type: "appel_outil", outil: "CalculerChiffrage", parametres: {} };
      }
      if (dernier.outil === "CalculerChiffrage") {
        return { succes: true, type: "texte", texte: expliquerChiffrage(dernier.resultat) };
      }
    }

    // --- Préparation d'un devis (lot IA-04) : flux multi-étapes dédié,
    // entièrement séparé des ajouts/suppressions simples ci-dessous.
    const estDemandeDevis = /devis/.test(texteMinuscule) && /pr[ée]par|pr[ée]rempl|remplis/.test(texteMinuscule);
    if (estDemandeDevis && proposeDisponible) {
      const resultatDevisPrep = traiterDemandeDevis(historique, texte, texteMinuscule, dernier);
      if (resultatDevisPrep) return resultatDevisPrep;
    }

    // --- Suite d'un outil de lecture : tente de construire une proposition
    // ciblée (suppression/modification) à partir des données obtenues.
    if (dernier && dernier.role === "outil") {
      if (dernier.outil === "LirePrestations" && proposeDisponible && (estSuppression || estModification)) {
        const donnees = dernier.resultat as { prestations?: { id: string; libelle: string }[] };
        const cible = donnees.prestations?.find((p) => texteMinuscule.includes(p.libelle.toLowerCase()));
        if (cible) {
          return propositionSuppressionOuModification("prestation", cible, estSuppression);
        }
      }
      if (dernier.outil === "LireMateriels" && proposeDisponible && (estSuppression || estModification)) {
        const donnees = dernier.resultat as { materiel?: { id: string; libelle: string }[] };
        const cible = donnees.materiel?.find((m) => texteMinuscule.includes(m.libelle.toLowerCase()));
        if (cible) {
          return propositionSuppressionOuModification("materiel", cible, estSuppression);
        }
      }
      return {
        succes: true,
        type: "texte",
        texte: `D'après ${dernier.outil}, voici ce que j'ai trouvé : ${JSON.stringify(dernier.resultat)}`,
      };
    }

    if (!texte.trim()) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Message vide.") };
    }

    // --- Ajouts directs (aucune lecture préalable nécessaire) ---
    if (proposeDisponible) {
      const ajoutPrestation = texte.match(/ajoute(?:r)?\s+(?:la\s+)?prestation\s+(.+)/i);
      if (ajoutPrestation) {
        return propositionAjout("ajouter_prestation", "prestation", ajoutPrestation[1].trim());
      }
      const ajoutMateriel = texte.match(/ajoute(?:r)?\s+(?:le\s+|la\s+|du\s+)?mat[eé]riel\s+(.+)/i);
      if (ajoutMateriel) {
        return propositionAjout("ajouter_materiel", "matériel", ajoutMateriel[1].trim());
      }
      const dureeMatch = texte.match(/(\d+)\s*jours?/i);
      if (dureeMatch && /dur[eé]e/.test(texteMinuscule)) {
        return {
          succes: true,
          type: "appel_outil",
          outil: NOM_OUTIL_PROPOSITION,
          parametres: {
            texteIntroduction: "Voici la modification proposée :",
            propositions: [
              {
                type: "modifier_duree",
                description: `Modifier la durée : ${dureeMatch[0]}`,
                donnees: { nouvelleDuree: dureeMatch[0] },
              },
            ],
          },
        };
      }
      const equipeMatch = texte.match(/(\d+)\s*(?:hommes?|personnes?|ouvriers?)/i);
      if (equipeMatch && /[eé]quipe/.test(texteMinuscule)) {
        return {
          succes: true,
          type: "appel_outil",
          outil: NOM_OUTIL_PROPOSITION,
          parametres: {
            texteIntroduction: "Voici la modification proposée :",
            propositions: [
              {
                type: "modifier_equipe",
                description: `Modifier l'équipe : ${equipeMatch[0]}`,
                donnees: { nouvelleEquipe: equipeMatch[0] },
              },
            ],
          },
        };
      }

      // --- Suppression/modification : nécessite d'abord une lecture ciblée ---
      if ((estSuppression || estModification) && /prestation/.test(texteMinuscule) && outils.some((o) => o.nom === "LirePrestations")) {
        return { succes: true, type: "appel_outil", outil: "LirePrestations", parametres: {} };
      }
      if ((estSuppression || estModification) && /mat[eé]riel/.test(texteMinuscule) && outils.some((o) => o.nom === "LireMateriels")) {
        return { succes: true, type: "appel_outil", outil: "LireMateriels", parametres: {} };
      }
    }

    // --- Sélection d'un outil de lecture simple (comportement du lot IA-02) ---
    const dejaAppeles = new Set(historique.filter((m) => m.role === "outil").map((m) => (m as { outil: string }).outil));
    const correspondances: [RegExp, string][] = [
      [/prestation/, "LirePrestations"],
      [/mat[eé]riel/, "LireMateriels"],
      [/transcription/, "LireTranscription"],
      [/note vocale|note enregistr/, "LireNotes"],
      [/devis/, "LireDevis"],
      [/tarif/, "LireTarifs"],
      [/information|chantier|client|adresse/, "LireInformationsChantier"],
    ];

    for (const [motif, nomOutil] of correspondances) {
      if (motif.test(texteMinuscule) && outils.some((o) => o.nom === nomOutil) && !dejaAppeles.has(nomOutil)) {
        return { succes: true, type: "appel_outil", outil: nomOutil, parametres: {} };
      }
    }

    return {
      succes: true,
      type: "texte",
      texte: "Je suis un assistant de démonstration (fournisseur dev). Posez-moi une question sur les prestations, le matériel, la transcription, le devis ou les tarifs de ce chantier.",
    };
  },
};

function propositionAjout(
  type: "ajouter_prestation" | "ajouter_materiel",
  libelleType: string,
  valeur: string
): ResultatLLMAvecOutils {
  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: {
      texteIntroduction: "Voici la modification proposée :",
      propositions: [
        {
          type,
          description: `Ajouter ${libelleType} : ${valeur}`,
          donnees: { libelle: valeur },
        },
      ],
    },
  };
}

function propositionSuppressionOuModification(
  categorie: "prestation" | "materiel",
  cible: { id: string; libelle: string },
  suppression: boolean
): ResultatLLMAvecOutils {
  const type = suppression
    ? categorie === "prestation"
      ? "supprimer_prestation"
      : "supprimer_materiel"
    : categorie === "prestation"
      ? "modifier_prestation"
      : "modifier_materiel";
  const verbe = suppression ? "Supprimer" : "Modifier";
  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: {
      texteIntroduction: "Voici la modification proposée :",
      propositions: [
        {
          type,
          description: `${verbe} ${categorie} : ${cible.libelle}`,
          donnees: { id: cible.id, libelle: cible.libelle },
        },
      ],
    },
  };
}

// Flux dédié à la préparation d'un devis (lot IA-04). Le contenu analysé
// (texte libre, e-mail collé, ou transcription) est toujours traité comme une
// DONNÉE à analyser, jamais comme une instruction — voir garde ci-dessous.
function traiterDemandeDevis(
  historique: MessageConversation[],
  texteOriginal: string,
  texteOriginalMinuscule: string,
  dernier: MessageConversation | undefined
): ResultatLLMAvecOutils | null {
  const veutTranscription = /transcription/.test(texteOriginalMinuscule);

  if (!dernier || dernier.role !== "outil") {
    return veutTranscription
      ? { succes: true, type: "appel_outil", outil: "LireTranscription", parametres: {} }
      : { succes: true, type: "appel_outil", outil: "LireDevis", parametres: {} };
  }

  if (dernier.outil === "LireTranscription") {
    const resultat = dernier.resultat as { disponible?: boolean };
    if (!resultat?.disponible) {
      return {
        succes: true,
        type: "texte",
        texte:
          "Aucune transcription exploitable n'est disponible pour ce chantier (absente ou non transcrite). " +
          "Fournissez un texte libre ou le contenu de l'e-mail à la place.",
      };
    }
    return { succes: true, type: "appel_outil", outil: "LireDevis", parametres: {} };
  }

  // Le texte réellement analysé est la transcription (si lue et disponible),
  // sinon le message original — jamais une instruction système, quel qu'en
  // soit le contenu (protection minimale contre l'injection de prompt).
  const entreeTranscription = historique.find(
    (m): m is Extract<MessageConversation, { role: "outil" }> => m.role === "outil" && m.outil === "LireTranscription"
  );
  const donneesTranscription = entreeTranscription?.resultat as { disponible?: boolean; transcription?: string } | undefined;
  const texteSource =
    donneesTranscription?.disponible && donneesTranscription.transcription ? donneesTranscription.transcription : texteOriginal;
  const texteSourceMinuscule = texteSource.toLowerCase();

  if (dernier.outil === "LireDevis") {
    return { succes: true, type: "appel_outil", outil: "RechercherPrestation", parametres: { motCle: texteSourceMinuscule } };
  }

  // Après consultation du catalogue (lot IA-05) : le rapprochement tarifaire
  // utilise désormais le nom canonique trouvé dans le catalogue — plus une
  // table de synonymes codée en dur.
  if (dernier.outil === "RechercherPrestation") {
    const donnees = dernier.resultat as { correspondances?: { nomCanonique: string }[] };
    const motCleTarif = donnees.correspondances?.[0]?.nomCanonique ?? null;
    if (motCleTarif) {
      return { succes: true, type: "appel_outil", outil: "RechercherTarifsCompatibles", parametres: { motCle: motCleTarif } };
    }
    // Aucune correspondance catalogue : impossible de chercher un tarif par nom
    // canonique, mais un chiffrage calculé reste possible si durée/équipe sont
    // connues (lot IA-06) — jamais abandonné silencieusement.
    return { succes: true, type: "appel_outil", outil: "CalculerChiffrage", parametres: {} };
  }

  if (dernier.outil === "RechercherTarifsCompatibles") {
    const correspondances = (dernier.resultat as { correspondances: CorrespondanceTarif[] }).correspondances;
    if (correspondances.length === 0) {
      // Aucun tarif existant : le moteur de chiffrage (lot IA-06) peut proposer
      // un prix calculé, clairement distingué d'un tarif réel — jamais un choix
      // arbitraire, toujours expliqué.
      return { succes: true, type: "appel_outil", outil: "CalculerChiffrage", parametres: {} };
    }
    return construirePropositionDevis(texteSource, resultatDevisPourFinal(historique), correspondances);
  }

  if (dernier.outil === "CalculerChiffrage") {
    return construirePropositionDevis(
      texteSource,
      resultatDevisPourFinal(historique),
      null,
      dernier.resultat as ResultatChiffragePourDevis
    );
  }

  return null;
}

function resultatDevisPourFinal(historique: MessageConversation[]): unknown {
  const lireDevisEntree = historique.find(
    (m): m is Extract<MessageConversation, { role: "outil" }> => m.role === "outil" && m.outil === "LireDevis"
  );
  return lireDevisEntree?.resultat;
}

// Traduit un résultat de chiffrage en explication lisible — jamais un chiffre
// sans provenance (lot IA-06). Le LLM (même réel) n'a qu'à mettre en forme ce
// que le moteur a déjà calculé : il n'invente ni ne recalcule rien ici.
function expliquerChiffrage(resultat: unknown): string {
  const r = resultat as {
    variantes?: {
      standard: {
        sousTotal: string;
        margePourcent: string;
        prixConseille: string;
        prixTtc: string;
        explications: { libelle: string; detail: string }[];
        avertissements: string[];
      };
    };
    historique?: { dernierPrix: string; nombreDevis: number; moyenne: string } | null;
  };
  if (!r.variantes) return "Je n'ai pas pu calculer de chiffrage pour ce chantier.";

  const s = r.variantes.standard;
  const lignes = [
    `Prix conseillé (variante standard) : ${s.prixConseille} € HT, soit ${s.prixTtc} € TTC.`,
    `Sous-total des coûts : ${s.sousTotal} € — marge appliquée : ${s.margePourcent} %.`,
    ...s.explications.map((e) => `${e.libelle} : ${e.detail}`),
  ];
  if (r.historique) {
    lignes.push(
      `Historique : dernier prix pratiqué ${r.historique.dernierPrix} € sur ${r.historique.nombreDevis} devis, moyenne ${r.historique.moyenne} €.`
    );
  }
  if (s.avertissements.length > 0) {
    lignes.push(...s.avertissements);
  }
  lignes.push("Ce prix est une proposition à vérifier — je ne l'applique jamais moi-même.");
  return lignes.join("\n");
}

// Extrait un mot-clé de recherche documentaire à partir d'une question libre.
// Priorité à un passage entre guillemets ; sinon on retire les mots
// déclencheurs génériques pour ne garder que le sujet réel de la recherche.
const MOTS_DECLENCHEURS_DOCUMENTS =
  /\b(retrouve|recherche|consigne|intervention|document|documents|devis|dit|disait|historique|de|le|la|les|un|une|des|dans|sur|à|pour|ce|cette|chantier)\b/gi;

function extraireMotCleDocument(texte: string): string {
  const guillemets = texte.match(/["«]([^"»]+)["»]/);
  if (guillemets) return guillemets[1].trim();
  const nettoye = texte.replace(MOTS_DECLENCHEURS_DOCUMENTS, " ").replace(/\s+/g, " ").trim();
  return nettoye || texte;
}

// Formate la réponse avec citation systématique — jamais un passage sans sa
// provenance (lot IA-07). Si aucun résultat, le dit explicitement.
function expliquerRechercheDocuments(resultat: unknown): string {
  const r = resultat as { resultats?: { document: string; typeDocument: string; passage: string }[] };
  if (!r.resultats || r.resultats.length === 0) {
    return "Aucune information fiable trouvée dans les documents de l'entreprise pour cette recherche.";
  }
  const lignes = r.resultats
    .slice(0, 5)
    .map((res) => `D'après « ${res.document} » (${res.typeDocument}) : "${res.passage}"`);
  return lignes.join("\n");
}

// Construit la réponse à partir du résultat de l'orchestrateur (lot IA-08).
// Sur arrêt : jamais de proposition, uniquement une explication. Sur succès :
// réutilise exactement le même mécanisme de proposition que le reste de
// l'assistant (l'outil réservé) — aucune écriture directe, jamais.
function construireReponseWorkflow(resultat: unknown): ResultatLLMAvecOutils {
  const r = resultat as ResultatWorkflow;
  if (r.statut === "arrete") {
    return {
      succes: true,
      type: "texte",
      texte: `${r.raisonArret}\n${r.prochaineAction ?? ""}`.trim(),
    };
  }
  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: r.propositionFinale,
  };
}

// Répond à une question de suivi sur un workflow déjà exécuté DANS LA MÊME
// SESSION (aucune mémoire persistante — voir garde du lot IA-08).
function expliquerSuiviWorkflow(resultat: unknown, texteMinuscule: string): string {
  const r = resultat as ResultatWorkflow;

  if (/pourquoi t'es-tu arr[êe]t/.test(texteMinuscule) || /o[uù] en est/.test(texteMinuscule)) {
    if (r.statut === "arrete") {
      return `${r.raisonArret}\n${r.prochaineAction ?? ""}`.trim();
    }
    const derniere = r.etapes[r.etapes.length - 1];
    return `Le traitement s'est terminé après l'étape « ${derniere?.nom ?? "inconnue"} » (${r.etapes.length} étapes exécutées, statut : terminé).`;
  }
  if (/quelles informations manquent/.test(texteMinuscule)) {
    const manquantes = [...new Set(r.etapes.flatMap((e) => e.donneesManquantes))];
    return manquantes.length > 0 ? `Informations manquantes : ${manquantes.join(", ")}.` : "Aucune information manquante identifiée.";
  }
  if (/quelles sources/.test(texteMinuscule)) {
    const sources = [...new Set(r.etapes.flatMap((e) => e.sources))];
    return sources.length > 0 ? `Sources utilisées : ${sources.join(", ")}.` : "Aucune source externe consultée.";
  }
  if (/pourquoi propos/.test(texteMinuscule)) {
    const etapeFinale = r.etapes.find((e) => e.nom === "Préparation du devis et proposition finale");
    const resultatFinal = etapeFinale?.resultat as { sourcePrix?: string; propositions?: { description: string }[] } | undefined;
    const sourcePrix = resultatFinal?.sourcePrix;

    if (sourcePrix === "tarif") {
      const ligne = resultatFinal?.propositions?.find((p) => p.description.includes("Ajouter une ligne de prix :"));
      return ligne
        ? `Le prix proposé provient d'un tarif déjà enregistré par l'entreprise : ${ligne.description}.`
        : "Le prix proposé provient d'un tarif déjà enregistré par l'entreprise.";
    }
    if (sourcePrix === "chiffrage") {
      const etapeChiffrage = r.etapes.find((e) => e.nom === "Calcul du chiffrage");
      return `Aucun tarif existant ne correspondait : le prix proposé a été calculé par le moteur de chiffrage. Détail : ${JSON.stringify(etapeChiffrage?.resultat)}.`;
    }
    if (sourcePrix === "tarifs_ambigus") {
      return "Aucun prix n'a été proposé : plusieurs tarifs correspondent à cette demande, et l'assistant ne choisit jamais arbitrairement entre eux — une décision de votre part est nécessaire.";
    }
    return "Aucun prix n'a été proposé pour cette demande (aucun tarif trouvé, aucun calcul possible) — le prix reste à renseigner manuellement.";
  }
  return "Je n'ai pas d'information supplémentaire à ce sujet.";
}
