import { attendLeClient, etatEnvoi } from "./etat-envoi";
import { jourLisible } from "./jour";

// Statut d'un chantier et libellés associés — définis ici (pas dans
// mock-data.ts) car utilisés par les écrans réels ; réexportés depuis
// mock-data.ts pour ne pas casser les maquettes /design/* qui les référencent.
export type ChantierStatut =
  | "brouillon"
  | "a_verifier"
  | "verifie"
  /**
   * Le devis est écrit, il n'attend plus que d'être envoyé.
   *
   * **Il manquait, et son absence mentait (13 août 2026).** Un devis rédigé à
   * la main — donc sans passer par l'écran « Informations » — laissait le
   * chantier affiché « Brouillon », c'est-à-dire « rien n'a été fait ». Le
   * patron, revenu sur sa fiche après un retour malencontreux, y a lu qu'il
   * était au point de départ alors qu'il n'avait plus qu'un geste à faire.
   */
  | "devis_pret"
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
  devis_pret: "Devis prêt à envoyer",
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

/**
 * Ce qui s'écrit SOUS le nom d'un chantier, dans la liste.
 *
 * **Le patron, le 13 août 2026, capture à l'appui :** *« le devis a été envoyé
 * et il n'a toujours pas eu de réponse […] il faut le notifier sous le nom »*,
 * puis, devant les cinq propositions : *« j'aime bien le D, mais en dessous de
 * "devis envoyé" je veux qu'il y ait marqué la date à laquelle on l'a
 * envoyé »* (`docs/maquettes/41-la-ligne-sous-le-nom.html`, `TODO.md` §9).
 *
 * Sa ligne disait « En attente de réponse » : vrai, mais elle ne disait pas
 * **ce qui** attend — un devis parti, ou un client qu'on n'a pas rappelé.
 *
 * ─── Trois décisions portées ici, et pas dans l'écran ────────────────────
 *
 * 1. **La mention des photos disparaît une fois le devis parti.** Elle sert à
 *    savoir s'il reste de quoi chiffrer ; après l'envoi, elle occupe la place
 *    de ce qui compte. C'est la forme qu'il a retenue sur la planche.
 *
 * 2. **La date d'envoi n'est jamais devinée.** Sans envoi enregistré, la
 *    seconde ligne n'existe pas — plutôt qu'une date approchée tirée de la
 *    dernière modification du chantier, qui n'est PAS la date d'envoi et le
 *    tromperait le jour où il compte ses jours d'attente (`CLAUDE.md` §4).
 *
 * 3. **L'or.** Il était réservé à ce qui attend un geste DE LUI ; un devis
 *    parti sans réponse n'en attend aucun. Il a retenu la variante dorée en
 *    connaissance de cause — c'était écrit sur la planche. Si la liste devient
 *    trop dorée à l'usage, c'est ici que cela se défait, sur une seule ligne.
 *
 * La règle vit dans une fonction pure pour être éprouvée sans base ni
 * navigateur, et pour que l'écran n'ait qu'à afficher (`CLAUDE.md` §3).
 */
export type LigneEtatChantier = {
  /** La ligne en petites capitales : l'état. */
  etat: string;
  /** La ligne en clair sous elle, ou rien du tout. */
  precision: string | null;
  /** Vrai quand la ligne se met en or. */
  enOr: boolean;
};

/** Un devis est parti, et le client n'a pas encore répondu. */
const DEVIS_PARTI_SANS_REPONSE: ChantierStatut[] = ["devis_envoye", "en_attente_client", "a_relancer"];

/**
 * Ce qui appelle un geste de lui — et se met donc en or.
 *
 * `a_relancer` y figure aussi via `DEVIS_PARTI_SANS_REPONSE` : les deux listes
 * se recoupent volontairement, chacune répond à une question différente.
 */
const APPELLE_UN_GESTE: ChantierStatut[] = [
  "devis_envoye",
  "en_attente_client",
  "a_relancer",
  "devis_retourne",
  "devis_a_corriger",
  "devis_caduc",
];

export function ligneEtatChantier(params: {
  statut: ChantierStatut;
  photosCount: number;
  /** Le jour où le devis est RÉELLEMENT parti, « AAAA-MM-JJ ». `null` si aucun envoi. */
  envoyeLe?: string | null;
  aujourdHui?: Date;
}): LigneEtatChantier {
  const { statut, photosCount, envoyeLe, aujourdHui } = params;
  const enOr = APPELLE_UN_GESTE.includes(statut);

  if (DEVIS_PARTI_SANS_REPONSE.includes(statut)) {
    return {
      etat: statut === "a_relancer" ? "Devis envoyé · à relancer" : "Devis envoyé · sans réponse",
      precision: envoyeLe ? `Envoyé le ${jourLisible(envoyeLe, aujourdHui)}.` : null,
      enOr,
    };
  }

  const photos = photosCount > 0 ? `${photosCount} photo${photosCount > 1 ? "s" : ""}` : "sans photo";
  return { etat: `${statutLabel[statut]} · ${photos}`, precision: null, enOr };
}

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
  // **On repart du point le plus AVANCÉ, jamais du premier maillon manquant.**
  //
  // ─────────────────────────────────────────────────────────────────────────
  // Le défaut, dans ses mots, le 13 août 2026 : *« il n'y a pas de mémoire dans
  // les actions. J'étais en train de rédiger le devis, [...] j'ai fait retour
  // sans faire exprès. Si maintenant je reclique sur mon chantier, je suis
  // obligé de refaire toutes les étapes une à une, alors que j'étais déjà
  // arrivé à la toute fin, il ne me manquait plus qu'à envoyer le devis. »*
  //
  // Cette fonction lisait la chaîne DEPUIS LE DÉBUT et s'arrêtait au premier
  // trou. Or il avait écrit son devis à la main, sans passer par l'écran
  // « Informations » : `informationsVerifieesAt` était donc resté vide, et la
  // fiche d'un chantier **dont le devis n'attendait plus que son envoi**
  // proposait « Ajouter des photos ». Reproduit et vu à l'écran avant d'être
  // corrigé — le devis était bien là, rangé dans le tiroir sous « généré, non
  // envoyé », pendant que l'écran invitait à dicter un chantier déjà chiffré.
  //
  // **Ce qui était perdu n'était pas son travail, c'était sa place.** Le pire
  // des deux : rien ne le lui disait, et l'écran ressemblait trait pour trait à
  // celui d'un chantier neuf.
  //
  // La chaîne est donc parcourue **à l'envers**, du plus avancé au plus
  // ancien : le premier jalon franchi commande, et ce qui manque en amont ne
  // ramène plus personne au départ. Les étapes sautées restent joignables par
  // `getSecondarySteps` — sauter n'est pas interdit, c'est même la voie normale
  // depuis que la chaîne va de la dictée au devis d'un seul geste.
  //
  // La règle qui existait déjà — « une fois les informations vérifiées,
  // supprimer la note vocale ne doit pas ramener à la dictée » — n'est pas
  // supprimée : elle devient un cas particulier de celle-ci, qui la généralise
  // à tous les jalons.
  // ─────────────────────────────────────────────────────────────────────────

  if (c.datePlanifiee) return null; // Planifié : plus rien à faire ici.
  if (c.devisEnvoyeAt) return { key: "planifier", label: "Planifier le chantier" };
  // **Le libellé dit ce qui reste à faire, pas où l'on va.** « Consulter le
  // devis » décrivait une lecture ; ce qui l'attend est un envoi, et c'est le
  // seul geste qui manquait quand il a perdu sa place.
  if (c.devisGenereAt) return { key: "devis-consulter", label: "Envoyer le devis au client" };
  if (c.prixValideAt) return { key: "devis-preparer", label: "Préparer le devis" };
  if (c.informationsVerifieesAt) return { key: "prix", label: "Calculer le prix" };
  if (c.aUneNoteVocale) return { key: "informations", label: "Vérifier les informations" };
  if (c.photosCount > 0) return { key: "note-vocale", label: "Enregistrer une note vocale" };
  return { key: "photos", label: "Ajouter des photos" };
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
  /**
   * **Obligatoire, et non « facultatif comme les autres ajouts ».** Un appelant
   * qui l'oublierait retomberait sur « Brouillon » pour un devis prêt à partir
   * — c'est-à-dire exactement le défaut du 13 août 2026. Le compilateur doit
   * donc désigner chaque écran, plutôt que de laisser un silence le rejouer.
   */
  devisGenereAt: Date | string | null;
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
  // **Du plus avancé au plus ancien, comme `getNextAction`.** Sans cette
  // ligne, un devis rédigé et généré retombait sur « Brouillon » dès que les
  // informations n'avaient pas été validées — et la liste des chantiers
  // annonçait « rien n'a été fait » sur un devis prêt à partir.
  if (c.devisGenereAt) return "devis_pret";
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

/**
 * Où l'on retombe en rouvrant un chantier depuis la liste.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande, le 13 août 2026, et il a fallu deux essais pour la
 * comprendre :** *« il faut absolument que si je me suis arrêté à l'étape
 * d'envoyer le devis, si je fais retour et que je retombe sur la catégorie
 * chantier puis que je reclique sur mon client en attente, que ça me renvoie à
 * l'étape où je me suis arrêté. Donc là, en l'occurrence, j'étais sur la page
 * où je devais ouvrir le SMS pour envoyer le devis. Ça doit m'envoyer là. Si je
 * me suis arrêté à mettre des photos et à rédiger la note vocale, il faut que
 * ça me remette à cette page-là. Et ainsi de suite. »*
 *
 * **Le premier essai avait corrigé autre chose** : la fiche annonçait
 * « Brouillon » et proposait « Ajouter des photos » sur un devis prêt à partir
 * (§98 d'`ARCHITECTURE.md`). C'était un vrai défaut, mais ce n'était pas
 * celui-là. Ce qu'il demande ici n'est pas que la fiche dise mieux : c'est de
 * **ne plus repasser par la fiche du tout**.
 *
 * La liste ne mène donc plus à la fiche, mais **à l'écran où le travail s'est
 * arrêté**. Rouvrir un chantier, c'est reprendre — pas recommencer.
 *
 * **Ce qui reste sur la fiche, et pourquoi ce n'est pas un oubli.** Deux états
 * n'ont aucun écran où reprendre : un devis parti dont on attend la réponse du
 * client, et un chantier déjà planifié. Le renvoyer vers le planning général
 * l'éloignerait de son chantier au lieu de l'y ramener. Dans ces deux cas, la
 * fiche EST l'endroit : elle porte l'état, le tiroir et la sortie vers la
 * facture.
 *
 * **Et la fiche reste à un doigt**, toujours : la flèche de retour de chaque
 * écran y mène. Reprendre au bon endroit ne ferme aucune porte.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function lienDeReprise(id: string, c: EtatChantierPourAction): string {
  const action = getNextAction(c);
  if (!action) return `/chantiers/${id}`;
  // **Trois étapes se reprennent SUR la fiche**, et ce n'est pas un repli :
  //
  //   · les photos et la dictée y vivent pour de bon — la pellicule et
  //     l'anneau sont au milieu de l'écran depuis sa demande du 11 août
  //     (« il est en plein milieu et dès qu'on arrive sur la page, il y est »).
  //     C'est bien « cette page-là » qu'il décrit ;
  //   · un chantier planifié n'a rien à reprendre : l'envoyer vers le planning
  //     général l'éloignerait de son chantier au lieu de l'y ramener.
  if (action.key === "photos" || action.key === "note-vocale" || action.key === "planifier") {
    return `/chantiers/${id}`;
  }
  return getNextActionHref(id, action);
}
