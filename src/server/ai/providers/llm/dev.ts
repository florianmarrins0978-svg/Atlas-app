import type { FournisseurLLM, ResultatLLM, ResultatLLMAvecOutils, MessageConversation, DefinitionOutil } from "./interface";
import { erreurIA } from "../../errors";
import { NOM_OUTIL_PROPOSITION } from "../../propositions";
import { lireLitteralement } from "../../lecture-litterale";
import {
  construirePropositionDevis,
  type CorrespondanceTarif,
  type ResultatChiffragePourDevis,
} from "../../../orchestrateur/proposition-builder";
import type { ResultatWorkflow } from "../../../orchestrateur/types";

// Fournisseur de développement/test — aucun appel réseau, résultat déterministe.
// Ne connaît pas de "vrai" modèle de langage : il expose, à travers l'interface
// LLM générique, la **lecture littérale** de la dictée (`lecture-litterale.ts`),
// exactement comme le ferait un vrai fournisseur (le texte retourné est un
// JSON, à valider par l'appelant).
//
// Le découpage lui-même a quitté ce fichier : il sert aussi de filet quand un
// fournisseur réel répond à côté (voir `extraction-service.ts`). Deux copies
// auraient fini par diverger — et c'est justement le chemin de secours qui
// serait resté en arrière.

export const fournisseurLLMDev: FournisseurLLM = {
  nom: "dev",
  async genererTexte(_systeme: string, message: string): Promise<ResultatLLM> {
    if (!message || message.trim().length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Message vide — rien à traiter.") };
    }

    return { succes: true, texte: JSON.stringify(lireLitteralement(message)) };
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

    // --- « Comment je fais pour… » : le mode d'emploi (25 août 2026) --------
    //
    // **En TÊTE de la chaîne, et c'est le tout.** « Comment je fais pour
    // supprimer un client ? » tombait dans la branche des suppressions plus
    // bas : le fournisseur allait lire les prestations du chantier et proposait
    // d'en retirer une. Il demandait un geste, on lui modifiait ses données.
    const estQuestionModeEmploi =
      /\bcomment\b|\bo[uù] (est|se trouve|je (trouve|vois|clique))\b|[aà] quoi sert/i.test(texte) &&
      outils.some((o) => o.nom === "RechercherModeEmploi");
    if (estQuestionModeEmploi) {
      if (dernier && dernier.role === "outil" && dernier.outil === "RechercherModeEmploi") {
        return { succes: true, type: "texte", texte: expliquerModeEmploi(dernier.resultat) };
      }
      if (!dernier || dernier.role !== "outil") {
        return { succes: true, type: "appel_outil", outil: "RechercherModeEmploi", parametres: { question: texte } };
      }
    }

    // --- Les gestes de l'agent (26 août 2026) -------------------------------
    //
    // **Une intention, un outil de lecture, puis une proposition.** Le vrai
    // modèle fait de même : il CHERCHE la cible avant de la viser, parce que
    // deux clients peuvent s'appeler Martin. Ce fournisseur le reproduit en
    // surface, pour que la chaîne entière soit éprouvable sans clé.
    const geste = intentionDeGeste(texteMinuscule);
    if (geste && proposeDisponible) {
      const suite = traiterGeste(geste, texte, dernier, outils);
      if (suite) return suite;
    }

    // --- Reprendre une ligne du devis d'un autre client (25 août 2026) ------
    //
    // Avant la branche des suppressions/modifications, elle aussi : « reprends
    // la ligne d'élagage du devis de Bernard » porte « ligne » et « devis », et
    // se serait fait lire comme une demande de préparation de devis.
    const estRepriseDeLigne =
      /\b(reprends?|reprendre|recup[eè]re|r[ée]cup[eè]re|copie|copier|remets?|remettre|reporte)\b/i.test(texte) &&
      /\b(ligne|prestation|poste)\b/i.test(texteMinuscule) &&
      outils.some((o) => o.nom === "RechercherLignesDevis");
    if (estRepriseDeLigne && proposeDisponible) {
      if (dernier && dernier.role === "outil" && dernier.outil === "RechercherLignesDevis") {
        return propositionCopieDeLigne(dernier.resultat);
      }
      if (!dernier || dernier.role !== "outil") {
        return {
          succes: true,
          type: "appel_outil",
          outil: "RechercherLignesDevis",
          parametres: { motCle: motCleDeLaLigne(texte), client: clientDeLaLigne(texte) },
        };
      }
    }

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

// --- Mode d'emploi et reprise de ligne (25 août 2026) ---------------------

/**
 * Met en forme ce que `RechercherModeEmploi` a rendu.
 *
 * **Il récite, il ne reformule pas.** Le geste sort tel qu'il est écrit dans la
 * fiche — c'est le seul texte du dépôt qui ait été confronté au code
 * (`scripts/test-mode-emploi.ts`). Un fournisseur qui le récrirait de son côté
 * serait une seconde version du mode d'emploi, et les deux divergeraient.
 */
function expliquerModeEmploi(resultat: unknown): string {
  const r = resultat as {
    trouve?: boolean;
    fiches?: { ecran: string; ou: string; intitule: string; geste: string; reserve: string | null }[];
  };
  if (!r.trouve || !r.fiches || r.fiches.length === 0) {
    return "Je ne connais pas ce geste — je préfère le dire plutôt que d'en inventer un.";
  }
  // **UNE fiche, pas trois.** Vu à l'image le 25 août 2026 : la réponse à
  // « comment je supprime un client ? » enchaînait le retrait, la création d'un
  // chantier et la saisie du client — trois gestes pour une question. Sa règle
  // du 25 août : *« mets le moins de mots possible sinon on se perd dans toutes
  // ces lignes »*. Les suivantes servent au modèle à choisir, pas à l'écran.
  const f = r.fiches[0];
  const lignes = [`**${f.intitule}** — ${f.ecran}`, f.geste];
  if (f.reserve) lignes.push(f.reserve);
  return lignes.join("\n");
}

/** Le mot du libellé cherché : « la ligne d'élagage » → « élagage ». */
function motCleDeLaLigne(texte: string): string | null {
  const apres = texte.match(/\b(?:ligne|prestation|poste)\s+(?:d[eu']\s*|des\s+|la\s+|le\s+)?([A-Za-zÀ-ÿ'-]{3,})/i);
  return apres ? apres[1] : null;
}

/** Le client du devis d'origine : « du devis de Bernard » → « Bernard ». */
function clientDeLaLigne(texte: string): string | null {
  const apres = texte.match(/\bdevis\s+(?:de|d'|du|chez)\s*([A-Za-zÀ-ÿ'-]{2,})/i);
  return apres ? apres[1] : null;
}

/**
 * Propose la copie — et ne choisit JAMAIS entre deux lignes.
 *
 * Deux libellés voisins chez deux clients différents, c'est deux prix
 * différents sur un document qui part. Quand la recherche en rend plusieurs, on
 * les montre et on demande, exactement comme pour deux tarifs plausibles.
 *
 * **`donnees` ne porte que l'identifiant.** Ni libellé ni montant : ils sont
 * relus en base à l'application (`getLigneDevisPourCopie`).
 */
function propositionCopieDeLigne(resultat: unknown): ResultatLLMAvecOutils {
  const r = resultat as {
    trouve?: boolean;
    raison?: string;
    lignes?: { ligneId: string; libelle: string; montant: string; client: string | null; numeroDevis: string }[];
  };
  if (!r.trouve || !r.lignes || r.lignes.length === 0) {
    return { succes: true, type: "texte", texte: r.raison ?? "Aucune ligne de devis ne correspond." };
  }
  if (r.lignes.length > 1) {
    const choix = r.lignes
      .map((l) => `- ${l.libelle} — ${l.montant} € (${l.client ?? "client non renseigné"}, devis ${l.numeroDevis})`)
      .join("\n");
    return { succes: true, type: "texte", texte: `Plusieurs lignes correspondent. Laquelle ?\n${choix}` };
  }
  const ligne = r.lignes[0];
  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: {
      texteIntroduction: "Voici la ligne à reprendre :",
      propositions: [
        {
          type: "copier_ligne_devis",
          description: `Reprendre « ${ligne.libelle} » du devis ${ligne.numeroDevis}${ligne.client ? ` (${ligne.client})` : ""}`,
          donnees: { ligneOrigineId: ligne.ligneId },
        },
      ],
    },
  };
}

// --- Les gestes de l'agent (26 août 2026) ---------------------------------

type Geste =
  | "creer_chantier"
  | "modifier_client"
  | "noter_chantier"
  | "planifier_chantier"
  | "retirer_du_planning"
  | "creer_tarif"
  | "preparer_facture";

/**
 * Ce que la phrase demande — reconnu par ses verbes, jamais par un mot isolé.
 *
 * L'ordre compte : « planifie le chantier de Bernard » porte « chantier », et
 * serait lu comme une création si l'on regardait ce mot d'abord.
 */
function intentionDeGeste(texteBrut: string): Geste | null {
  // **Sans accents, sinon « crée » ne vaut pas « cree ».** Trouvé à l'essai le
  // 26 août 2026 : « Crée un chantier pour Madame Lucie » ne déclenchait rien,
  // parce que la minuscule ne retire pas l'accent. Il tape comme il parle.
  const texte = texteBrut.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(planifie|planifier|pose|poser|cale|caler)\b/.test(texte) && /chantier|lundi|mardi|mercredi|jeudi|vendredi|\d{4}-\d{2}-\d{2}/.test(texte))
    return "planifier_chantier";
  if (/\b(depose|deplanifie|retire du planning|enleve du planning)\b/.test(texte)) return "retirer_du_planning";
  if (/\b(facture|facturer)\b/.test(texte) && /\b(prepare|preparer|cree|creer|fais|faire)\b/.test(texte)) return "preparer_facture";
  if (/\b(cree|creer|ajoute|ajouter|nouveau|nouvelle)\b/.test(texte) && /\btarif\b/.test(texte)) return "creer_tarif";
  if (/\b(cree|creer|ajoute|ajouter|nouveau|nouvelle)\b/.test(texte) && /\bchantier\b/.test(texte)) return "creer_chantier";
  if (/\b(note|noter|marque|ecris)\b/.test(texte) && /\bchantier\b/.test(texte)) return "noter_chantier";
  if (/\b(corrige|change|modifie|mets? a jour)\b/.test(texte) && /\b(client|telephone|numero|mail|e mail)\b/.test(texte))
    return "modifier_client";
  return null;
}

/** L'outil de lecture qui donne la cible de ce geste. */
const LECTURE_AVANT_GESTE: Record<Geste, string | null> = {
  creer_chantier: null,
  creer_tarif: null,
  modifier_client: "LireClients",
  noter_chantier: "RechercherChantier",
  planifier_chantier: "RechercherChantier",
  retirer_du_planning: "RechercherChantier",
  preparer_facture: "RechercherChantier",
};

function traiterGeste(
  geste: Geste,
  texte: string,
  dernier: MessageConversation | undefined,
  outils: DefinitionOutil[]
): ResultatLLMAvecOutils | null {
  const lecture = LECTURE_AVANT_GESTE[geste];

  // 1. Il faut d'abord CHERCHER la cible.
  if (lecture && (!dernier || dernier.role !== "outil" || dernier.outil !== lecture)) {
    if (!outils.some((o) => o.nom === lecture)) return null;
    // **Chaque outil a SON paramètre.** `RechercherChantier` (la version de
    // l'écran) attend `nom` ; `LireClients` attend `motCle`. Se tromper rend
    // `undefined`, et l'outil tombe au lieu de chercher.
    const cherche = nomCite(texte) ?? "";
    return {
      succes: true,
      type: "appel_outil",
      outil: lecture,
      parametres: lecture === "RechercherChantier" ? { nom: cherche } : { motCle: cherche },
    };
  }

  // 2. La cible est connue (ou le geste n'en demande pas) : on propose.
  const cible = lecture ? premiereCible(dernier) : null;
  if (lecture && !cible) {
    return { succes: true, type: "texte", texte: "Je n'ai trouvé personne ni aucun chantier à ce nom." };
  }

  switch (geste) {
    case "creer_chantier": {
      const nom = apres(texte, /\bchantier\s+(?:pour\s+|chez\s+|de\s+)?/i) ?? "Nouveau chantier";
      return proposer("creer_chantier", `Créer le chantier : ${nom}`, { nom });
    }
    case "creer_tarif": {
      const prix = texte.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i)?.[1]?.replace(",", ".");
      const intitule = apres(texte, /\btarif\s+(?:pour\s+|de\s+|d'\s*)?/i) ?? "";
      // **Sans prix, pas de tarif.** Un prix ne s'invente pas (`CLAUDE.md` §4) :
      // on demande plutôt que d'en poser un plausible.
      if (!prix || !intitule) {
        return { succes: true, type: "texte", texte: "Il me faut l'intitulé ET le prix — je n'invente pas un prix." };
      }
      return proposer("creer_tarif", `Créer le tarif : ${intitule} — ${prix} €`, { intitule, prix });
    }
    case "modifier_client": {
      const telephone = texte.match(/\b((?:0|\+33)[\d\s.]{8,})/)?.[1]?.replace(/[\s.]/g, "");
      const email = texte.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
      if (!telephone && !email) {
        return { succes: true, type: "texte", texte: "Dites-moi le nouveau numéro ou la nouvelle adresse e-mail." };
      }
      const quoi = telephone ? `téléphone ${telephone}` : `e-mail ${email}`;
      return proposer("modifier_client", `Corriger ${cible!.nom} : ${quoi}`, {
        clientId: cible!.id,
        ...(telephone ? { telephone } : {}),
        ...(email ? { email } : {}),
      });
    }
    case "noter_chantier": {
      const note = apres(texte, /\b(?:note|noter|marque|ecris)\b\s*(?:que\s+|:\s*)?/i);
      if (!note) return { succes: true, type: "texte", texte: "Que faut-il noter sur ce chantier ?" };
      return proposer("noter_chantier", `Noter sur ${cible!.nom} : ${note}`, { chantierId: cible!.id, note });
    }
    case "planifier_chantier": {
      const jour = texte.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!jour) return { succes: true, type: "texte", texte: "Quel jour, exactement ? Donnez-moi une date." };
      const quand = /matin/i.test(texte) ? "matin" : /apr[eè]s[- ]midi/i.test(texte) ? "apres" : "journee";
      return proposer("planifier_chantier", `Poser ${cible!.nom} au ${jour}`, { chantierId: cible!.id, jour, quand });
    }
    case "retirer_du_planning":
      return proposer("retirer_du_planning", `Retirer ${cible!.nom} du planning`, { chantierId: cible!.id });
    case "preparer_facture":
      return proposer("preparer_facture", `Préparer la facture de ${cible!.nom}`, { chantierId: cible!.id });
  }
}

/** Une proposition, jamais une écriture — c'est tout le contrat de l'assistant. */
function proposer(type: string, description: string, donnees: Record<string, unknown>): ResultatLLMAvecOutils {
  return {
    succes: true,
    type: "appel_outil",
    outil: NOM_OUTIL_PROPOSITION,
    parametres: { texteIntroduction: "Voici ce que je propose :", propositions: [{ type, description, donnees }] },
  };
}

/** La première cible rendue par la lecture — nom et identifiant. */
function premiereCible(dernier: MessageConversation | undefined): { id: string; nom: string } | null {
  if (!dernier || dernier.role !== "outil") return null;
  const r = dernier.resultat as {
    // `RechercherChantier` (la version de l'écran) rend `trouves`.
    trouves?: { chantierId: string; chantierNom: string }[];
    clients?: { clientId: string; nom: string }[];
  };
  if (r.trouves?.[0]) return { id: r.trouves[0].chantierId, nom: r.trouves[0].chantierNom };
  if (r.clients?.[0]) return { id: r.clients[0].clientId, nom: r.clients[0].nom };
  return null;
}

/** Le nom cité dans la phrase : « le chantier de Bernard » -> « Bernard ». */
function nomCite(texte: string): string | null {
  return texte.match(/\b(?:de|chez|pour|du client)\s+([A-ZÉÈÀ][\wÀ-ÿ'-]+)/)?.[1] ?? null;
}

/** Ce qui suit un motif, nettoyé — sert aux libellés libres. */
function apres(texte: string, motif: RegExp): string | null {
  const m = texte.match(motif);
  if (!m || m.index === undefined) return null;
  const reste = texte.slice(m.index + m[0].length).trim();
  return reste ? reste.replace(/\s+/g, " ").slice(0, 120) : null;
}
