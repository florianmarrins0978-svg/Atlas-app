import { attendLeClient, etatEnvoi } from "./etat-envoi";

// Statut d'un chantier et libellés associés — définis ici (pas dans
// mock-data.ts) car utilisés par les écrans réels ; réexportés depuis
// mock-data.ts pour ne pas casser les maquettes /design/* qui les référencent.
export type ChantierStatut =
  | "brouillon"
  | "a_verifier"
  | "verifie"
  | "devis_envoye"
  | "en_attente_client"
  | "a_relancer"
  | "devis_retourne"
  | "devis_a_corriger"
  | "devis_caduc"
  | "planifie"
  | "termine"
  | "facture";

export const statutLabel: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Devis envoyé",
  en_attente_client: "En attente de réponse",
  a_relancer: "À relancer",
  devis_retourne: "Devis retourné",
  devis_a_corriger: "Correction demandée",
  devis_caduc: "Devis caduc",
  planifie: "Planifié",
  termine: "À facturer",
  facture: "Facturé",
};

// Détermine l'unique action principale à proposer sur la fiche chantier.
// Règle absolue : cet état est calculé uniquement à partir des champs réellement
// enregistrés sur le chantier (photos, note vocale, informations vérifiées, prix,
// devis, planification). Aucune étape n'est jamais supposée terminée par défaut —
// tout commence à `null` / `0` tant que le patron ne l'a pas explicitement validée.

export type NextActionKey =
  | "photos"
  | "note-vocale"
  | "informations"
  | "prix"
  | "devis-preparer"
  | "devis-consulter"
  | "planifier";

export type NextAction = {
  key: NextActionKey;
  label: string;
};

// Forme réelle (issue de la base) consommée par getNextAction / getSecondarySteps.
// Un seul arbre de décision pour toute l'application — voir aussi getStatutAffiche,
// qui applique la même règle pour dériver le statut affiché sur la liste.
export type EtatChantierPourAction = {
  photosCount: number;
  aUneNoteVocale: boolean;
  informationsVerifieesAt: Date | string | null;
  prixValideAt: Date | string | null;
  devisGenereAt: Date | string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
};

export function getNextAction(c: EtatChantierPourAction): NextAction | null {
  // La progression métier prime sur la présence des pièces d'entrée. Une fois
  // les informations vérifiées, supprimer la note vocale ne doit jamais
  // ramener le chantier à « Enregistrer une note vocale » : le travail de
  // saisie est fait, et redemander une dictée donnerait l'impression d'avoir
  // tout perdu. Les étapes amont restent accessibles via getSecondarySteps.
  if (!c.informationsVerifieesAt) {
    if (c.photosCount === 0 && !c.aUneNoteVocale) {
      return { key: "photos", label: "Ajouter des photos" };
    }
    if (!c.aUneNoteVocale) {
      return { key: "note-vocale", label: "Enregistrer une note vocale" };
    }
    return { key: "informations", label: "Vérifier les informations" };
  }
  if (!c.prixValideAt) {
    return { key: "prix", label: "Calculer le prix" };
  }
  if (!c.devisGenereAt) {
    return { key: "devis-preparer", label: "Préparer le devis" };
  }
  if (!c.devisEnvoyeAt) {
    return { key: "devis-consulter", label: "Consulter le devis" };
  }
  if (!c.datePlanifiee) {
    return { key: "planifier", label: "Planifier le chantier" };
  }
  return null; // Rien à faire — le chantier est planifié, aucune action immédiate requise.
}

// Construit l'URL associée à l'action principale pour un chantier donné.
export function getNextActionHref(id: string, action: NextAction): string {
  switch (action.key) {
    // **Les photos n'ont plus d'écran à elles** (11 août 2026) : elles vivent
    // dans la pellicule du tiroir, sur la fiche. Pointer vers un
    // `/photos` disparu enverrait sur une page introuvable.
    case "photos":
      return `/chantiers/${id}`;
    case "note-vocale":
      return `/chantiers/${id}/note-vocale`;
    case "informations":
      return `/chantiers/${id}/informations`;
    case "prix":
      return `/chantiers/${id}/prix`;
    case "devis-preparer":
    case "devis-consulter":
      return `/chantiers/${id}/export`;
    case "planifier":
      return `/planning`;
  }
}

export type SecondaryStep = {
  key: "photos" | "note-vocale" | "informations" | "prix" | "devis";
  label: string;
  meta: string;
  done: boolean;
  href: string;
};

// Construit la liste des étapes secondaires (toutes toujours accessibles, jamais
// verrouillées), en excluant celle qui correspond déjà à l'action principale
// pour éviter toute redondance.
export function getSecondarySteps(
  id: string,
  c: EtatChantierPourAction,
  currentActionKey: NextActionKey | undefined
): SecondaryStep[] {
  const all: SecondaryStep[] = [
    {
      key: "photos",
      label: "Photos",
      meta:
        c.photosCount > 0 ? `${c.photosCount} photo${c.photosCount > 1 ? "s" : ""}` : "Aucune photo pour l'instant",
      done: c.photosCount > 0,
      // Même raison que ci-dessus : la pellicule de la fiche a remplacé
      // l'écran Photos. Cette ligne reste construite — les maquettes /design
      // s'en servent — mais la fiche l'écarte : la pellicule est juste
      // au-dessus, et deux fois la même chose sur un écran, c'est une de trop.
      href: `/chantiers/${id}`,
    },
    {
      key: "note-vocale",
      label: "Note vocale",
      meta: c.aUneNoteVocale ? "Enregistrée" : "Aucune note pour l'instant",
      done: c.aUneNoteVocale,
      href: `/chantiers/${id}/note-vocale`,
    },
    {
      key: "informations",
      label: "Informations",
      // « En attente de la note vocale » se lisait comme un verrou : le patron
      // en a conclu qu'il ne pouvait pas rédiger son devis à la main. Rien n'est
      // verrouillé — ces écrans ont toujours été ouverts. Le libellé dit
      // désormais ce qui MANQUE, pas ce qu'il faudrait attendre.
      meta: c.informationsVerifieesAt
        ? "Vérifiées"
        : c.aUneNoteVocale
          ? "À vérifier"
          : "À remplir, ou à dicter",
      done: !!c.informationsVerifieesAt,
      href: `/chantiers/${id}/informations`,
    },
    {
      key: "prix",
      label: "Prix",
      meta: c.prixValideAt ? "Calculé" : c.informationsVerifieesAt ? "À calculer" : "À calculer, ou à écrire à la main",
      done: !!c.prixValideAt,
      href: `/chantiers/${id}/prix`,
    },
    {
      key: "devis",
      label: "Devis",
      meta: c.devisEnvoyeAt
        ? "Envoyé"
        : c.devisGenereAt
          ? "Généré, non envoyé"
          : c.prixValideAt
            ? "À préparer"
            : "À préparer une fois le prix posé",
      done: !!c.devisEnvoyeAt,
      href: `/chantiers/${id}/export`,
    },
  ];

  // La ligne "devis" correspond aux deux clés d'action "devis-preparer" / "devis-consulter"
  const currentAsSecondaryKey =
    currentActionKey === "devis-preparer" || currentActionKey === "devis-consulter"
      ? "devis"
      : currentActionKey;

  return all.filter((s) => s.key !== currentAsSecondaryKey);
}

// --- État de planification --------------------------------------------------
// Source unique de vérité pour savoir si un chantier doit apparaître dans
// "À planifier" ou "Planifié" sur l'écran Planning. L'écran Planning ne doit
// jamais lire directement chantier.devisEnvoye ou tout autre champ métier — il
// se contente d'afficher le résultat de cette fonction. Si la règle métier
// change demain (acceptation client, acompte reçu...), seule cette fonction
// est à modifier — pas l'écran Planning.

export type PlanificationEtat = "a_planifier" | "planifie" | "attente_client" | "non_concerne";

export type EtatPourPlanification = {
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  envoiEnvoyeAt?: Date | string | null;
  envoiExpireAt?: Date | string | null;
  envoiReponse?: "acceptee" | "refusee" | "correction" | null;
};

export function getPlanificationEtat(
  c: EtatPourPlanification,
  maintenant: Date = new Date()
): PlanificationEtat {
  if (c.datePlanifiee) return "planifie";

  // Un chantier dont le client est en train de choisir sa date n'est PAS « à
  // planifier » : le patron qui le planifierait lui-même poserait une date que
  // le client s'apprête peut-être à contredire, et se retrouverait avec deux
  // engagements sur le même jour. Il attend, et l'écran le dit.
  const etat = etatEnvoi(
    c.envoiEnvoyeAt === undefined
      ? null
      : { envoyeAt: c.envoiEnvoyeAt, expireAt: c.envoiExpireAt ?? null, reponse: c.envoiReponse ?? null },
    maintenant
  );
  if (attendLeClient(etat)) return "attente_client";

  if (c.devisEnvoyeAt) return "a_planifier";
  return "non_concerne";
}

// --- Statut d'affichage (liste des chantiers) ---------------------------
// Utilisé pour l'écran réel connecté à la base : dérive le même statut visuel
// (StatusIcon, libellés) que celui utilisé jusqu'ici, mais à partir des jalons
// datés réels plutôt que des booléens des données simulées. Ne duplique pas
// la logique — un chantier "à vérifier" ici correspond exactement à la même
// définition que dans les données de démonstration.
export type EtatPourStatutAffiche = {
  photosCount: number;
  aUneNoteVocale: boolean;
  informationsVerifieesAt: Date | string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  // Le dernier envoi, quand il existe. Absent des anciens appels : le statut
  // reste alors celui d'avant, sans jamais mentir sur ce qu'il ignore.
  envoiEnvoyeAt?: Date | string | null;
  envoiExpireAt?: Date | string | null;
  envoiReponse?: "acceptee" | "refusee" | "correction" | null;
  // Jalons de fin. Absents des anciens appels, comme ceux de l'envoi.
  termineAt?: Date | string | null;
  factureEnvoyeeAt?: Date | string | null;
};

export function getStatutAffiche(c: EtatPourStatutAffiche, maintenant: Date = new Date()): ChantierStatut {
  // La fin l'emporte sur tout le reste. Un chantier réalisé et facturé restait
  // affiché « planifié » — un état qu'il a quitté depuis longtemps, et qui le
  // faisait compter parmi les chantiers en cours.
  if (c.factureEnvoyeeAt) return "facture";
  if (c.termineAt) return "termine";

  if (c.datePlanifiee) return "planifie";

  // Ce que devient un devis parti dépend du client, pas de nous. « Devis
  // envoyé » ne le disait pas : le patron voyait la même chose qu'il attende
  // une réponse depuis une heure ou qu'on lui ait dit non trois semaines plus
  // tôt.
  const etat = etatEnvoi(
    c.envoiEnvoyeAt === undefined
      ? null
      : { envoyeAt: c.envoiEnvoyeAt, expireAt: c.envoiExpireAt ?? null, reponse: c.envoiReponse ?? null },
    maintenant
  );
  // Un refus et un lien périmé n'ont rien à voir : dans un cas le client a dit
  // non, dans l'autre il n'a rien dit du tout. Les confondre ferait croire à un
  // refus qui n'a jamais eu lieu, et découragerait de relancer.
  if (etat === "retourne") return "devis_retourne";
  // Une correction demandée n'est pas un refus : le chantier est presque
  // acquis, il ne tient qu'à une reprise. Les confondre découragerait le patron
  // pour une faute de frappe.
  if (etat === "a_corriger") return "devis_a_corriger";
  if (etat === "caduc") return "devis_caduc";
  if (etat === "a_relancer") return "a_relancer";
  if (etat === "en_attente") return "en_attente_client";

  if (c.devisEnvoyeAt) return "devis_envoye";
  if (c.informationsVerifieesAt) return "verifie";
  if (c.aUneNoteVocale || c.photosCount > 0) return "a_verifier";
  return "brouillon";
}

/**
 * Le chantier compte-t-il parmi ceux « en cours » ?
 *
 * Un chantier facturé est fini : le compter encore gonfle un chiffre que le
 * patron lit en premier, et qui perd alors tout sens. Ceux qui restent à
 * facturer, eux, comptent — le travail sur eux n'est pas terminé.
 */
export function chantierEnCours(statut: ChantierStatut): boolean {
  return statut !== "facture";
}

// Tri chronologique des chantiers planifiés — fonction pure, testable
// indépendamment des données de démonstration partagées (voir
// scripts/test-tri-planning.mjs). Les chantiers sans date connue passent en
// dernier plutôt que de fausser l'ordre.
export function trierParDatePlanifiee<T extends { datePlanifiee?: string | null }>(chantiers: T[]): T[] {
  return [...chantiers].sort((a, b) => {
    if (!a.datePlanifiee) return 1;
    if (!b.datePlanifiee) return -1;
    return a.datePlanifiee < b.datePlanifiee ? -1 : a.datePlanifiee > b.datePlanifiee ? 1 : 0;
  });
}
