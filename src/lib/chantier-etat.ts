// Statut d'un chantier et libellés associés — définis ici (pas dans
// mock-data.ts) car utilisés par les écrans réels ; réexportés depuis
// mock-data.ts pour ne pas casser les maquettes /design/* qui les référencent.
export type ChantierStatut = "brouillon" | "a_verifier" | "verifie" | "devis_envoye" | "planifie";

export const statutLabel: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Devis envoyé",
  planifie: "Planifié",
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
    case "photos":
      return `/chantiers/${id}/photos`;
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
      href: `/chantiers/${id}/photos`,
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
      meta: c.informationsVerifieesAt
        ? "Vérifiées"
        : c.aUneNoteVocale
          ? "À vérifier"
          : "En attente de la note vocale",
      done: !!c.informationsVerifieesAt,
      href: `/chantiers/${id}/informations`,
    },
    {
      key: "prix",
      label: "Prix",
      meta: c.prixValideAt ? "Calculé" : c.informationsVerifieesAt ? "À calculer" : "En attente des informations",
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
            : "En attente du prix",
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

export type PlanificationEtat = "a_planifier" | "planifie" | "non_concerne";

export type EtatPourPlanification = {
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
};

export function getPlanificationEtat(c: EtatPourPlanification): PlanificationEtat {
  if (c.datePlanifiee) return "planifie";
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
};

export function getStatutAffiche(c: EtatPourStatutAffiche): ChantierStatut {
  if (c.datePlanifiee) return "planifie";
  if (c.devisEnvoyeAt) return "devis_envoye";
  if (c.informationsVerifieesAt) return "verifie";
  if (c.aUneNoteVocale || c.photosCount > 0) return "a_verifier";
  return "brouillon";
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
