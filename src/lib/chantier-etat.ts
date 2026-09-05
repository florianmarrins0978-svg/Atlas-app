import { attendLeClient, etatEnvoi } from "./etat-envoi";
import { jourLisible } from "./jour";
import { lienVersLeChantierAuPlanning } from "./lien-planning";

// Statut d'un chantier et libellés associés — définis ici, et employés par les
// écrans réels.
//
// **CE COMMENTAIRE ÉTAIT FAUX, corrigé le 5 septembre 2026 (audit de santé).**
// Il disait que ces statuts étaient « réexportés depuis mock-data.ts pour ne
// pas casser les maquettes /design/* ». Ce lien N'EXISTE PLUS : `mock-data.ts`
// tient depuis sa propre liste, gelée, et explique pourquoi — un outil de
// conception ne doit pas peser sur les états du produit. Les deux fichiers
// portent donc un `ChantierStatut` et un `statutLabel` chacun, **délibérément
// séparés**, et non l'un dérivé de l'autre.
//
// Le laisser aurait envoyé chercher une réexportation inexistante, et fait
// craindre de casser les maquettes en ajoutant un état ici — soit exactement
// la peur que la coupure du 1er août 2026 avait supprimée.
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
 * 3. **L'or, sur TOUTES les lignes depuis le 16 août 2026.** Il était réservé
 *    à ce qui attend un geste DE LUI, puis étendu le 13 août aux devis partis
 *    sans réponse. Le patron l'a voulu partout : *« pour tous les messages je
 *    veux que cette partie-là apparaisse en doré »*. La nuance qu'il portait se
 *    lit désormais dans les mots, plus dans la teinte — voir `enOr` plus bas,
 *    où la règle tient en une ligne et se défait de même.
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

export function ligneEtatChantier(params: {
  statut: ChantierStatut;
  photosCount: number;
  /** Le jour où le devis est RÉELLEMENT parti, « AAAA-MM-JJ ». `null` si aucun envoi. */
  envoyeLe?: string | null;
  aujourdHui?: Date;
}): LigneEtatChantier {
  const { statut, photosCount, envoyeLe, aujourdHui } = params;

  /**
   * **En or, TOUJOURS — sa consigne du 16 août 2026**, capture de l'accueil à
   * l'appui : *« mets le "devis prêt à envoyer sans photo" en doré ; pour tous
   * les messages je veux que cette partie-là apparaisse en doré »*.
   *
   * **Ce que l'or ne dit plus, et il faut le savoir avant de vouloir le
   * rétablir.** Il distinguait ce qui appelle un geste DE LUI — un devis à
   * corriger, un devis caduc — de ce qui attend ailleurs. La liste
   * `APPELLE_UN_GESTE` portait cette nuance ; elle est retirée, parce qu'un
   * drapeau qui vaut toujours vrai n'est plus un drapeau, et qu'une liste
   * conservée « au cas où » se serait mise à mentir en silence.
   *
   * L'or est désormais **la couleur de la ligne d'état**, un point c'est tout.
   * Ce qui appelle un geste se lit dans les MOTS — « Devis prêt à envoyer »,
   * « Correction demandée » —, plus dans la teinte.
   *
   * **Le champ survit à la règle, et c'est délibéré :** l'écran n'a jamais
   * décidé de sa couleur, et ce n'est pas le jour où la règle se simplifie
   * qu'il faut lui rendre ce pouvoir (`CLAUDE.md` §3). Si la nuance revient,
   * elle revient ici, sur une ligne.
   */
  const enOr = true;

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

// Forme réelle (issue de la base) consommée par getNextAction et lienDeReprise.
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
  // leur adresse — sauter n'est pas interdit, c'est même la voie normale depuis
  // que la chaîne va de la dictée au devis d'un seul geste.
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
  // **Une dictée mène AU DEVIS, plus à l'écran « Informations » — 21 août 2026.**
  //
  // Sa panne, dans ses mots : *« j'ai dicté la prestation, j'ai rappuyé, ça a
  // enregistré, j'ai quitté l'application, je suis revenu, j'ai cliqué sur
  // Madame Lucie — or je ne suis PAS arrivé directement sur la page du devis
  // comme demandé, avec mes informations déjà remplies. »*
  //
  // Il a raison, et il l'avait déjà dit le 5 août : *« je ne veux pas tous les
  // autres trucs intermédiaires »*. « Informations » était l'un d'eux : un
  // écran de contrôle qui n'existe plus dans son parcours, puisque la chaîne
  // va de la dictée au devis d'un seul tenant (`devis-depuis-dictee.ts`).
  //
  // **Ce qui rend ce renvoi possible sans mentir :** le devis se prépare
  // lui-même en arrivant, si la dictée n'a pas encore été traitée
  // (`src/lib/devis-a-preparer.ts`). Sans cela, on l'enverrait sur une feuille
  // vide — c'est-à-dire sur ce qu'il appelle, à juste titre, un gros bug.
  //
  // **Et cette ligne passe AVANT « informations vérifiées », ce qui n'est pas
  // un détail d'ordre.** La chaîne pose ce jalon dès qu'elle a rangé les
  // prestations, c'est-à-dire AVANT l'arrêt d'avant-chiffrage
  // (`devis-depuis-dictee.ts`, étape 2). S'il ferme l'application pendant cet
  // arrêt — ce qu'il fait, il est chez sa cliente —, l'ordre inverse le
  // renverrait sur l'écran « Prix » : un écran de plus entre lui et son devis,
  // et la panne de Madame Lucie recommencerait sous un autre nom.
  if (c.aUneNoteVocale) return { key: "devis-preparer", label: "Préparer le devis" };
  if (c.informationsVerifieesAt) return { key: "prix", label: "Calculer le prix" };
  if (c.photosCount > 0) return { key: "note-vocale", label: "Enregistrer une note vocale" };
  return { key: "photos", label: "Ajouter des photos" };
}

// Construit l'URL associée à l'action principale pour un chantier donné.
export function getNextActionHref(id: string, action: NextAction): string {
  switch (action.key) {
    // **LES DEUX MÈNENT À LA FICHE CLIENT, ET C'EST LE MÊME ÉCRAN.**
    //
    // Les photos n'ont plus d'écran à elles depuis le 11 août 2026 ; elles
    // vivaient dans la pellicule du tiroir, sur la fiche du chantier. Cette
    // fiche a disparu le 4 septembre (`ARCHITECTURE.md` §254), et sa raison
    // était qu'elle montrait une seconde fois ce que la fiche client porte
    // déjà : la pellicule, l'anneau de dictée et les coordonnées.
    //
    // C'est donc là que les deux reprises se font — le même `/coordonnees`,
    // qui rend `FormulaireNouveauChantier` prérempli.
    //
    // **La clé garde son nom parce qu'elle nomme l'ÉTAPE, pas l'écran** :
    // « enregistrer une note vocale » reste ce qui manque, même si le geste a
    // changé de page. L'écran `/note-vocale` n'est pas supprimé pour autant —
    // il reste joignable par son adresse, comme les quatre autres.
    case "photos":
    case "note-vocale":
      return `/chantiers/${id}/coordonnees`;
    case "informations":
      return `/chantiers/${id}/informations`;
    case "prix":
      return `/chantiers/${id}/prix`;
    // **Les deux mènent au DEVIS lui-même depuis le 20 août 2026.**
    //
    // *« On supprime la page qui est entre les deux. On va raccourcir les
    // étapes. »* L'écran `/export` n'existe plus avant l'envoi : le choix des
    // dates se fait sur le devis, par « Choisir la date ». L'y envoyer quand
    // même le ferait rebondir — la page renvoie désormais ici d'elle-même, et
    // deux redirections en cascade se voient à l'œil.
    case "devis-preparer":
    case "devis-consulter":
      return `/chantiers/${id}/devis-complet`;
    case "planifier":
      return `/planning`;
  }
}


/**
 * ─── LA LISTE DES ÉTAPES A DISPARU AVEC L'ÉCRAN QUI LA PORTAIT ───────────
 *
 * `getSecondarySteps` et son type `SecondaryStep` construisaient le tiroir de
 * la fiche du chantier, et rien d'autre : cette fonction n'avait qu'un seul
 * appelant. La fiche est retirée le 4 septembre 2026 (`ARCHITECTURE.md` §254)
 * — *« toutes ces infos sont déjà sur cette page »* —, et une liste conservée
 * au cas où se met à mentir en silence.
 *
 * **Ce qu'elle décidait n'est pas perdu**, et n'est pas recopié non plus :
 *
 * | Sa règle | Où elle vit désormais |
 * |---|---|
 * | où mène le devis — `/export` une fois parti, `/devis-complet` avant (20 août 2026) | `portes-du-planning.ts` |
 * | où se reprennent les photos et la dictée | `getNextActionHref`, juste au-dessus |
 *
 * Les cinq écrans d'étape, eux, existent tous : la fiche n'en était que la
 * liste.
 */


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
 * ───────────────────────────────────────────────────────────────────────────
 * **ELLE NE RENVOIE PLUS JAMAIS SUR LA FICHE DU CHANTIER — 4 septembre 2026.**
 *
 * Cette fonction rendait `/chantiers/[id]` dans **quatre** cas : les photos, la
 * dictée, un devis parti pas encore posé, et — par son repli — un chantier
 * planifié. La fiche disparaissant (`ARCHITECTURE.md` §254), les quatre
 * seraient devenus une **boucle de redirection**, puisque la route qui la
 * remplace se règle sur cette fonction-ci. Sur un chantier planifié,
 * c'est-à-dire précisément le cas du patron.
 *
 * Les quatre ont donc une destination à eux, et aucune n'est inventée :
 *
 * | Ce qui reste à faire | Où l'on reprend | Pourquoi celui-là |
 * |---|---|---|
 * | des photos, une dictée | `/chantiers/[id]/coordonnees` | la pellicule et l'anneau y sont depuis le 31 août — c'était le doublon qu'il refusait |
 * | poser une date | `/planning` | ce que `getNextActionHref` rendait déjà : le chantier est dans « À planifier », et sa ligne y porte ses portes |
 * | rien : la date est posée | `/planning?chantier=[id]` | **sa journée**, portes levées — sa réponse du 4 septembre |
 *
 * **Le chantier posé ne retombe pas sur le planning général**, et c'est le seul
 * point qu'il a tranché lui-même ce jour-là : le mois courant, à lui de
 * retrouver sa ligne, c'est l'errance du 8 août 2026 — *« comment moi je fais
 * pour avoir accès au devis ? »*.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function lienDeReprise(id: string, c: EtatChantierPourAction): string {
  const action = getNextAction(c);
  // La date est posée : il n'y a plus d'étape, il y a une JOURNÉE.
  if (!action) return lienVersLeChantierAuPlanning(id);
  return getNextActionHref(id, action);
}
