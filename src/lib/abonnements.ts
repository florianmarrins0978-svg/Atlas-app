/**
 * L'ABONNEMENT — les trois formules, et l'unique endroit où leurs règles vivent.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **D'OÙ VIENNENT CES CHIFFRES.** De sa planche du 9 septembre 2026,
 * `appli/choisir-son-abonnement.html`, qu'il a validée. Ils ne sont pas
 * inventés ici et ne se retouchent pas ici tout seuls : la planche et ce
 * fichier disent la même chose, et `scripts/test-abonnements.ts` refuse qu'ils
 * divergent. Un prix affiché qui ne serait pas le prix débité est le pire
 * défaut possible sur cet écran (`CLAUDE.md` §4).
 *
 * **SA CORRECTION COMMANDE TOUTE LA GRILLE.** Ma première version limitait
 * « les utilisateurs ». Il a repris : *« je pense pas qu'il faut de limite
 * d'utilisateur à 5, ou alors limiter à 5 commerciaux, et si on veut
 * commerciaux illimités faut payer genre 120 »*.
 *
 * Il a raison, et c'est structurant. Les quatre rôles d'Atlas ne se valent pas
 * (`acces-roles.ts`) : un salarié voit son planning et RIEN d'autre, il ne
 * fabrique aucun document et ne consomme aucune IA. Compter les salariés
 * reviendrait à facturer la taille de ses chantiers au lieu de l'usage de
 * l'outil — et à punir exactement le client qu'on veut garder. **Ce qui se
 * compte, c'est donc qui FABRIQUE** : le patron, les commerciaux, la
 * facturation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI MORD, ET DEPUIS QUAND.** Le plafond de fabricants, demandé mot pour
 * mot le 9 septembre 2026. Puis, tranché le 10 — *« oui bloqué pour
 * l'abonnement artisan »* — les absences et les retours d'intervention, qui
 * sont un plus d'« Entreprise » (`fonctionOuverte`). Et l'essai de quinze
 * jours, qui se referme en lecture seule (`enLectureSeule`).
 *
 * **Le 24 septembre 2026, la grille a bougé** (planche
 * `appli/abonnements-ce-qui-manque.html`) : Artisan passe à 39 €, Illimité à
 * 159 €, et Artisan perd les trois outils de paysage — le plan d'arrosage, le
 * diagnostic végétal, la fiche de chantier. Les fiches de sécurité restent
 * ouvertes à tous, sa réponse du même jour. Et chaque carte montre, barré, ce
 * que la formule n'ouvre pas : *« qu'il voie ce qu'il loupe »*.
 *
 * **Le 18 et le 19 novembre 2026, les outils de paysage deviennent un module**
 * (planches `appli/soignee/abonnement-module-paysage.html`, « A, trois lignes,
 * en doré », et `appli/soignee/paysage-plan-offert.html`) : 6 € HT par mois,
 * 60 € à l'année, **pour les trois formules** (*« ça doit être pour toutes les
 * formules, pas que pour la formule artisan »*) ; Entreprise et Illimité ne les
 * comprennent donc plus. Artisan devient **un seul accès**, salariés compris
 * (*« la première formule, c'est juste pour une seule personne »*). Et un plan
 * d'arrosage et un diagnostic sont **offerts une fois par entreprise, essai
 * compris**.
 *
 * **Une entreprise SANS ligne d'abonnement n'est touchée par aucune des
 * trois** : c'est son Atlas à lui, et celui de ceux qui s'en servaient avant
 * l'offre. Une fermeture est la conséquence d'une formule choisie.
 */

import { compteFerme, type Fermeture } from "./fermeture-compte";
import type { Role } from "./acces-roles";

export type FormuleCode = "artisan" | "entreprise" | "illimite";

/** Mensuel ou annuel. L'annuel offre deux mois — 290 au lieu de 348. */
export type Periodicite = "mensuelle" | "annuelle";

/**
 * Où en est l'abonnement d'une entreprise.
 *
 * **`essai` est arrivé le 10 septembre 2026**, quand il a donné le chiffre :
 * *« essai gratuit 15 jours »*. Jusque-là l'état n'existait pas, et c'était
 * délibéré — une durée qui figure dans un contrat ne se décide pas dans un
 * fichier.
 */
export type StatutAbonnement = "essai" | "actif" | "impaye" | "resilie";

/**
 * LA DURÉE DE L'ESSAI — sa décision du 10 septembre 2026.
 *
 * **Elle vit ici et nulle part ailleurs.** Les conditions générales publiées
 * (version 2, article 14.2) disent encore « [À COMPLÉTER — 14 ou 30 jours] »,
 * et **une version publiée ne se modifie jamais** (`documents-legaux/versions.ts`) :
 * le chiffre y entrera avec la version 3, qu'il publiera quand les quinze
 * autres cases seront remplies. `scripts/test-abonnements.ts` refusera alors
 * que les deux divergent — un contrat qui promet une durée et une application
 * qui en compte une autre, c'est l'écart qu'on découvre au premier litige.
 */
export const JOURS_ESSAI = 15;

/**
 * À partir de combien de jours restants le compteur passe au rouge.
 *
 * **Trois, pas dix.** Un avertissement qui parle trop tôt s'apprend à être
 * ignoré, et l'on perd le garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter).
 */
export const JOURS_AVANT_ALERTE = 3;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/** Quand l'essai commencé à `debut` se termine. Un jour plein, jamais « à peu près ». */
export function finDeLEssai(debut: Date): Date {
  return new Date(debut.getTime() + JOURS_ESSAI * UN_JOUR_MS);
}

/**
 * CE QUE LA FORMULE DE L'ESSAI VAUT — « Illimité », et c'est délibéré.
 *
 * L'essai n'est pas un abonnement : rien n'est payé, Stripe ne le connaît pas
 * (il réclame une carte d'avance, et l'article 14.2 promet « sans saisie de
 * moyen de paiement »). Mais la ligne en base porte une formule, et ce doit
 * être celle qui **n'enlève rien** : un essai qui fermerait les absences ou
 * plafonnerait l'équipe ferait essayer « Artisan » à quelqu'un qui hésite
 * entre les trois. On essaie tout ; on choisit après.
 */
export const FORMULE_DE_LESSAI: FormuleCode = "illimite";

export type EtatEssai =
  | { statut: "en-cours"; joursRestants: number; alerte: boolean; fin: Date }
  | { statut: "termine"; fin: Date; dejaPris?: boolean };

type AbonnementLu = { statut: StatutAbonnement; periodeFin: Date | null; essaiDejaPris?: boolean } | null | undefined;

/**
 * OÙ EN EST L'ESSAI — `null` quand il n'y en a pas.
 *
 * Une entreprise sans ligne d'abonnement n'est pas « en essai » : c'est son
 * Atlas à lui, et celui de tous ceux qui s'en servaient avant l'offre. L'essai
 * ne vaut que pour les comptes créés depuis (`creation-compte.ts`).
 *
 * **Les jours restants se comptent en jours ENTAMÉS**, jamais arrondis vers le
 * bas : à 14 h le dernier jour, il reste « 1 jour », pas « 0 ». Le compteur
 * dit ce qu'il peut encore faire aujourd'hui.
 */
export function etatDeLEssai(abonnement: AbonnementLu, maintenant: Date): EtatEssai | null {
  if (!abonnement || abonnement.statut !== "essai" || !abonnement.periodeFin) return null;
  const fin = abonnement.periodeFin;
  if (maintenant.getTime() >= fin.getTime()) {
    // Fini dès la création : son entreprise avait déjà eu son essai (0195).
    return abonnement.essaiDejaPris ? { statut: "termine", fin, dejaPris: true } : { statut: "termine", fin };
  }
  const joursRestants = Math.ceil((fin.getTime() - maintenant.getTime()) / UN_JOUR_MS);
  return { statut: "en-cours", joursRestants, alerte: joursRestants <= JOURS_AVANT_ALERTE, fin };
}

/**
 * CE QUE L'ACCÈS VAUT AUJOURD'HUI : l'essai, ou un abonnement résilié.
 *
 * **Le résilié s'ajoute le 18 octobre 2026** (`docs/A-FAIRE.md` §17). Avant,
 * un abonnement passé à « résilié » à son échéance gardait tout ouvert, en
 * écriture : résilier rendait Atlas gratuit. Il est traité comme l'essai
 * terminé, par la même porte. Une résiliation seulement DEMANDÉE ne compte
 * pas : Stripe garde l'abonnement « actif » jusqu'à la date payée, et il garde
 * tout jusque-là.
 */
export type EtatAcces = EtatEssai | { statut: "resilie" } | { statut: "ferme" };

/**
 * **Le compte fermé passe avant tout le reste** (5 novembre 2026, question 33
 * de `docs/QUESTIONS.md`) : fermé, il l'est quel que soit son abonnement, et
 * c'est ce que le ruban et le bouton éteint doivent dire. La lecture seule
 * elle-même est posée par `withEntreprise`, depuis la même règle.
 */
export function etatDeLAcces(
  abonnement: AbonnementLu,
  maintenant: Date,
  fermeture: Fermeture | null = null
): EtatAcces | null {
  if (compteFerme(fermeture, maintenant)) return { statut: "ferme" };
  if (abonnement?.statut === "resilie") return { statut: "resilie" };
  return etatDeLEssai(abonnement, maintenant);
}

/**
 * LA LECTURE SEULE — son choix du 10 septembre 2026, au 16ᵉ jour : *« la B,
 * mais il ne doit plus rien pouvoir faire à part enregistrer ses documents,
 * ses clients »*. Tout se lit, rien ne s'écrit ; il emporte une copie.
 *
 * Une seule question, posée à un seul endroit (`withEntreprise`), pour les
 * 176 gestes qui écrivent : les fermer un par un finirait par en oublier un.
 */
export function enLectureSeule(abonnement: AbonnementLu, maintenant: Date): boolean {
  const acces = etatDeLAcces(abonnement, maintenant);
  return acces?.statut === "termine" || acces?.statut === "resilie";
}

/** Ce que dit l'écran quand il appuie quand même sur un bouton qui écrit ; `null` quand tout est ouvert. */
export function phraseLectureSeule(acces: EtatAcces | null): string | null {
  if (acces?.statut === "termine" && acces.dejaPris) return "Votre entreprise a déjà eu son essai. Choisissez une formule pour créer.";
  if (acces?.statut === "termine") return "Votre essai est terminé. Choisissez une formule pour créer de nouveau.";
  if (acces?.statut === "resilie") return "Votre abonnement est terminé. Choisissez une formule pour créer de nouveau.";
  if (acces?.statut === "ferme") return "Votre compte est fermé. Rouvrez-le dans Mes données pour créer de nouveau.";
  return null;
}

/** Le ruban en tête de l'accueil — le seul écran qu'il ouvre tous les matins. */
export function texteDuRuban(etat: EtatAcces): string {
  if (etat.statut === "ferme") return "Compte fermé, lecture seule";
  if (etat.statut === "resilie") return "Abonnement terminé, lecture seule";
  if (etat.statut === "termine" && etat.dejaPris) return "Essai déjà utilisé par votre entreprise";
  if (etat.statut === "termine") return "Essai terminé, lecture seule";
  return etat.joursRestants > 1
    ? `Essai gratuit, ${etat.joursRestants} jours restants`
    : "Essai gratuit, dernier jour";
}

/**
 * La formule qu'il a CHOISIE — `null` pendant l'essai et après résiliation.
 *
 * L'écran d'abonnement en dépend : avec une formule « actuelle », il propose
 * de CHANGER (au prorata, sur un abonnement Stripe qui n'existe pas) ; sans,
 * il propose de S'ABONNER, et c'est le bon chemin pour sortir de l'essai.
 */
export function formuleChoisie(
  abonnement: { formule: FormuleCode; statut: StatutAbonnement } | null
): FormuleCode | null {
  if (!abonnement || abonnement.statut === "essai" || abonnement.statut === "resilie") return null;
  return abonnement.formule;
}

/**
 * Les modules qu'il a CHOISIS — vides pendant l'essai et après résiliation,
 * pour la même raison que `formuleChoisie` : sans formule actuelle, l'écran
 * propose de s'abonner, pas de changer.
 */
export function modulesChoisis(
  abonnement: { formule: FormuleCode; statut: StatutAbonnement; modules: readonly ModuleCode[] } | null
): ModuleCode[] {
  return formuleChoisie(abonnement) ? [...(abonnement?.modules ?? [])] : [];
}

/**
 * CE QUI SE FERME — sa décision du 10 septembre 2026 : *« oui bloqué pour
 * l'abonnement artisan »*. Les absences d'équipe et les retours d'intervention
 * sont un plus d'« Entreprise ». Le 24 septembre, les trois outils de paysage
 * les ont rejoints ; le 18 novembre, ils en sortent pour former leur module.
 *
 * La liste est FERMÉE, et chaque formule ou module dit ce qu'il ouvre
 * (`fonctions` ci-dessous) : une fonction réservée qui n'y figurerait pas
 * ferait rougir la compilation, pas un client.
 */
export type FonctionReservee = "arrosage" | "diagnostic" | "fiche-chantier" | "absences" | "retours";

/** Ce qu'Entreprise et Illimité ouvrent de plus qu'Artisan. */
const FONCTIONS_DE_L_EQUIPE: readonly FonctionReservee[] = ["absences", "retours"];

/** Les modules qui s'ajoutent à une formule. Un seul aujourd'hui ; la liste attend les suivants. */
export type ModuleCode = "paysage";

export type OutilDuModule = {
  fonction: FonctionReservee;
  /** Ce que lit le bloc des outils, et la phrase qui dit ce qu'il fait. */
  titre: string;
  phrase: string;
};

export type Module = {
  code: ModuleCode;
  /** Comme il se lit dans une phrase : « ajoutez les outils de paysage ». */
  nom: string;
  /** En euros HT. Le même pour les trois formules, sa réponse du 19 novembre. */
  prixMensuel: number;
  prixAnnuel: number;
  fonctions: readonly FonctionReservee[];
  /** Dans l'ordre de la page Paysage et de sa planche. */
  outils: readonly OutilDuModule[];
};

/**
 * **Les phrases sont celles de l'appli** (les écrans fermés les disaient
 * déjà) : la planche du 19 novembre les a reprises telles quelles, et le
 * bloc des outils comme l'écran fermé les lisent ici, à un seul endroit.
 */
export const MODULES: readonly Module[] = [
  {
    code: "paysage",
    nom: "les outils de paysage",
    prixMensuel: 6,
    prixAnnuel: 60,
    fonctions: ["arrosage", "diagnostic", "fiche-chantier"],
    outils: [
      {
        fonction: "arrosage",
        titre: "Le plan d’arrosage",
        phrase: "Photographiez le croquis du jardin, et le plan sort avec sa liste de pièces.",
      },
      {
        fonction: "diagnostic",
        titre: "Le diagnostic végétal",
        phrase: "Photographiez une plante malade, et sachez quoi faire.",
      },
      {
        fonction: "fiche-chantier",
        titre: "Les fiches de chantier",
        phrase: "Cochez ce qui a été fait pendant l’entretien, puis envoyez la fiche au client.",
      },
    ],
  },
] as const;

export function estModule(valeur: string | null | undefined): valeur is ModuleCode {
  return typeof valeur === "string" && MODULES.some((m) => m.code === valeur);
}

/** Le module, ou `null` si le code ne dit rien. */
export function moduleDe(code: string | null | undefined): Module | null {
  return MODULES.find((m) => m.code === code) ?? null;
}

/**
 * Ce qui s'ouvre pendant l'essai sans rien compter : les fiches de chantier ne
 * coûtent aucune IA. L'arrosage et le diagnostic, eux, sont l'offre.
 */
const OUVERTES_PENDANT_L_ESSAI: readonly FonctionReservee[] = ["fiche-chantier"];

/**
 * LES OUTILS OFFERTS UNE FOIS — sa demande du 19 novembre 2026 : *« un seul
 * essai pour le plan d'arrosage de gratuit et ensuite ils doivent payer »*, et
 * un diagnostic aussi. Une fois par entreprise, essai compris.
 */
export type OutilOffert = "arrosage" | "diagnostic";
export const OUTILS_OFFERTS: readonly OutilOffert[] = ["arrosage", "diagnostic"];

export function estOutilOffert(fonction: FonctionReservee): fonction is OutilOffert {
  return (OUTILS_OFFERTS as readonly string[]).includes(fonction);
}

/** Ce qu'il faut savoir d'un abonnement pour dire si une fonction s'ouvre. */
export type AbonnementPourAcces =
  | { formule: string; statut: StatutAbonnement; modules: readonly string[] }
  | null
  | undefined;

/**
 * Cette fonction est-elle OUVERTE — sans compter l'offre ?
 *
 * Sans abonnement, **tout est ouvert**, pour la même raison que le plafond
 * (`placePourUnAcces`) : une fermeture est la conséquence d'une formule
 * choisie, jamais un état par défaut. Son Atlas à lui n'a pas de ligne
 * d'abonnement. Une formule inconnue en base n'invente pas de fermeture non
 * plus.
 */
export function fonctionOuverte(abonnement: AbonnementPourAcces, fonction: FonctionReservee): boolean {
  if (!abonnement) return true;
  const f = formule(abonnement.formule);
  if (!f) return true;
  if (f.fonctions.includes(fonction)) return true;
  if (abonnement.modules.some((m) => moduleDe(m)?.fonctions.includes(fonction))) return true;
  return abonnement.statut === "essai" && OUVERTES_PENDANT_L_ESSAI.includes(fonction);
}

/** Ouverte, offerte une fois, ou fermée : ce que l'écran montre et ce que la garde laisse passer. */
export type AccesALaFonction = "ouverte" | "offerte" | "fermee";

export function accesALaFonction(
  abonnement: AbonnementPourAcces,
  fonction: FonctionReservee,
  offreDejaPrise: boolean
): AccesALaFonction {
  if (fonctionOuverte(abonnement, fonction)) return "ouverte";
  if (estOutilOffert(fonction) && !offreDejaPrise) return "offerte";
  return "fermee";
}

/** Ce que la page Paysage écrit au bout de la ligne de l'outil. */
export function etiquetteDeLOutil(acces: AccesALaFonction): string | null {
  if (acces === "offerte") return "1 offert";
  if (acces === "fermee") return "En option";
  return null;
}

/**
 * LES RETOUCHES DU PLAN OFFERT — 24 heures, avec le jeton que le plan a reçu.
 *
 * Le plan n'est pas rangé : chaque retouche (une cote corrigée, une demande à
 * la discussion) le refait. Sans jeton, la retouche du plan offert serait
 * refusée comme un second plan, et il aurait payé son essai d'un plan qu'il
 * ne peut pas corriger. Le jeton seul ne suffit pas : gardé, il ouvrirait
 * l'outil pour toujours. D'où la journée.
 */
export const RETOUCHES_DU_PLAN_OFFERT_MS = 24 * 60 * 60 * 1000;

export function retoucheDuPlanOfferte(
  offre: { jeton: string; utiliseeLe: Date } | null,
  jetonPresente: string | null | undefined,
  maintenant: Date
): boolean {
  if (!offre || !jetonPresente || jetonPresente !== offre.jeton) return false;
  return maintenant.getTime() - offre.utiliseeLe.getTime() < RETOUCHES_DU_PLAN_OFFERT_MS;
}

/**
 * Ce que lit l'écran à la place d'une fonction fermée — même dessin, même
 * bouton. Pour un outil de paysage, le bouton ajoute les outils (l'écran
 * Abonnement s'ouvre, les outils déjà ajoutés) ; pour les absences et les
 * retours, il renvoie à Entreprise.
 *
 * **Une fermeture de l'arrosage ou du diagnostic veut dire que l'offre est
 * prise** : sans elle, l'outil serait « offert », donc ouvert.
 */
export function phraseDeLaFermeture(fonction: FonctionReservee): {
  titre: string;
  detail: string;
  bouton: string;
  adresse: string;
} {
  const outils = MODULES[0];
  const ajouter = {
    bouton: "Ajouter les outils",
    adresse: `/reglages/abonnement?outils=${outils.code}`,
  };
  // L'espace insécable avant le deux-points et dans le prix : ni « : » ni
  // « € » ne partent seuls à la ligne (vu sur la planche du 19 novembre).
  const suivants = `Pour les suivants, ajoutez ${outils.nom}\u00a0: ${outils.prixMensuel}\u00a0€ HT par mois.`;
  const entreprise = { bouton: "Voir la formule Entreprise", adresse: "/reglages/abonnement" };
  switch (fonction) {
    case "arrosage":
      return { titre: "Votre plan offert est fait", detail: suivants, ...ajouter };
    case "diagnostic":
      return { titre: "Votre diagnostic offert est fait", detail: suivants, ...ajouter };
    case "fiche-chantier":
      return {
        titre: "Les fiches de chantier sont en option",
        detail: outils.outils.find((o) => o.fonction === "fiche-chantier")!.phrase,
        ...ajouter,
      };
    case "absences":
      return {
        titre: "Les absences sont dans « Entreprise »",
        detail: "Noter qui n’est pas là, et voir vos équipes se réorganiser toutes seules.",
        ...entreprise,
      };
    case "retours":
      return {
        titre: "Les retours sont dans « Entreprise »",
        detail: "Ce que vos salariés ont constaté en fin de chantier : ce qui est fait, ce qui ne l’est pas, et leurs photos.",
        ...entreprise,
      };
  }
}

/**
 * UNE LIGNE DE CARTE — la même liste pour les trois formules.
 *
 * **Une seule liste, et chaque formule la lit.** Avant le 24 septembre 2026,
 * chaque formule portait sa propre liste de ce qu'elle comprend : trois listes
 * recopiées qu'un contrôle devait tenir d'accord avec `fonctions`. Désormais
 * une ligne DIT ce qui l'ouvre — une fonction réservée, ou un plafond — et
 * `lignesDeLaFormule` en déduit ce qui s'affiche barré. Ce que la carte promet
 * et ce que le code ouvre ne peuvent plus diverger : c'est la même donnée.
 */
type Ligne = {
  texte: string;
  /** La fonction qui l'ouvre ; sans elle, la ligne vaut pour toutes. */
  fonction?: FonctionReservee;
  /** Le plafond de fabricants qu'il faut au moins ; `null` = sans limite. */
  plafond?: number | null;
  /** Vrai quand la ligne demande d'autres accès que le sien : Artisan ne l'ouvre pas. */
  equipe?: true;
};

/**
 * **L'ordre est celui de la planche du 19 novembre**, pour les trois cartes.
 * Les outils de paysage n'y sont plus : ils se règlent au-dessus, une fois
 * (`MODULES`).
 */
const LIGNES: readonly Ligne[] = [
  { texte: "Devis et factures illimités" },
  { texte: "Vos dictées transcrites et chiffrées" },
  { texte: "Le planning de vos chantiers" },
  { texte: "Votre relevé de TVA, tenu tout seul" },
  { texte: "Vos salariés ont accès au planning", equipe: true },
  { texte: "Les absences de vos équipes", fonction: "absences" },
  { texte: "Les retours d’intervention de vos salariés", fonction: "retours" },
  { texte: "Jusqu’à 5 personnes aux devis et aux factures", plafond: 5 },
  { texte: "Autant de personnes que vous voulez aux devis et aux factures", plafond: null },
];

export type LigneDeCarte = {
  texte: string;
  /** Vrai quand la formule ne l'ouvre pas : la ligne s'affiche barrée. */
  manque: boolean;
};

export type Formule = {
  code: FormuleCode;
  nom: string;
  accroche: string;
  /** En euros HT, par mois. */
  prixMensuel: number;
  /** En euros HT, pour douze mois payés d'avance. */
  prixAnnuel: number;
  /**
   * Combien de personnes peuvent fabriquer des devis ou des factures.
   * `null` = autant qu'on veut.
   */
  plafondFabricants: number | null;
  /**
   * Combien d'accès en tout, salariés compris. `null` = on ne compte que
   * ceux qui fabriquent. Artisan : 1, le sien (18 novembre 2026).
   */
  plafondComptes: number | null;
  /** Les fonctions réservées que cette formule ouvre (`fonctionOuverte`). */
  fonctions: readonly FonctionReservee[];
};

/**
 * **L'ordre est celui de la planche** : du moins cher au plus cher. Il se lit
 * de haut en bas, et c'est celui dans lequel il compare.
 */
export const FORMULES: readonly Formule[] = [
  {
    code: "artisan",
    nom: "Artisan",
    accroche: "Pour vous seul. Du devis dicté à la facture, sans rien retaper.",
    prixMensuel: 39,
    prixAnnuel: 390,
    plafondFabricants: 1,
    plafondComptes: 1,
    fonctions: [],
  },
  {
    code: "entreprise",
    nom: "Entreprise",
    accroche: "Jusqu’à cinq personnes qui facturent, et tous vos salariés.",
    prixMensuel: 59,
    prixAnnuel: 590,
    plafondFabricants: 5,
    plafondComptes: null,
    fonctions: FONCTIONS_DE_L_EQUIPE,
  },
  {
    code: "illimite",
    nom: "Illimité",
    accroche: "Toute votre équipe sur Cause.",
    prixMensuel: 159,
    prixAnnuel: 1590,
    plafondFabricants: null,
    plafondComptes: null,
    fonctions: FONCTIONS_DE_L_EQUIPE,
  },
] as const;

/** Un plafond en couvre-t-il un autre ? `null` couvre tout, et n'est couvert que par lui-même. */
function plafondCouvre(detenu: number | null, exige: number | null): boolean {
  if (detenu === null) return true;
  return exige !== null && detenu >= exige;
}

/**
 * CE QUE LA CARTE D'UNE FORMULE AFFICHE — ce qu'elle ouvre, et ce qu'elle
 * n'ouvre pas, barré.
 *
 * **Un plafond ne se dit qu'une fois** : le plus haut qu'elle tient, coché, et
 * le premier qu'elle ne tient pas, barré. « Illimité » n'affiche pas « jusqu'à
 * 5 personnes », ce serait lui reprocher d'avoir plus ; « Artisan » ne barre
 * pas aussi « autant que vous voulez », deux plafonds barrés pour dire la même
 * chose (sa remarque du 19 novembre 2026 sur les lignes barrées).
 */
export function lignesDeLaFormule(f: Formule): LigneDeCarte[] {
  const plafonds = LIGNES.filter((l) => l.plafond !== undefined);
  const tenus = plafonds.filter((l) => plafondCouvre(f.plafondFabricants, l.plafond ?? null));
  const manques = plafonds.filter((l) => !plafondCouvre(f.plafondFabricants, l.plafond ?? null));
  const garde = new Set([tenus[tenus.length - 1], manques[0]].filter(Boolean));
  return LIGNES.filter((l) => l.plafond === undefined || garde.has(l)).map((l) => ({
    texte: l.texte,
    manque:
      (l.fonction !== undefined && !f.fonctions.includes(l.fonction)) ||
      (l.equipe === true && f.plafondComptes !== null) ||
      (l.plafond !== undefined && !plafondCouvre(f.plafondFabricants, l.plafond)),
  }));
}

export type CarteDeFormule = {
  /** « Tout ce qu'offre Artisan, et : » ; `null` pour la première carte. */
  introduction: string | null;
  lignes: LigneDeCarte[];
};

/**
 * LA CARTE QUI SE LIT — sa remarque du 19 novembre 2026 : ce que les trois
 * formules partagent se lisait au-dessus, et Artisan ne montrait plus que des
 * lignes barrées. La première carte porte donc tout ce qu'elle a ; chacune des
 * suivantes dit « tout ce qu'offre la précédente, et : » puis ce qu'elle
 * ajoute, et ce qui lui manque encore, barré.
 *
 * **Calculé sur les formules, jamais recopié** : une ligne qui changerait de
 * formule demain changerait de carte toute seule.
 */
export function carteDeLaFormule(f: Formule): CarteDeFormule {
  const rang = FORMULES.findIndex((g) => g.code === f.code);
  const precedente = rang > 0 ? FORMULES[rang - 1] : null;
  if (!precedente) return { introduction: null, lignes: lignesDeLaFormule(f) };
  const dejaOffert = new Set(lignesDeLaFormule(precedente).filter((l) => !l.manque).map((l) => l.texte));
  return {
    introduction: `Tout ce qu’offre ${precedente.nom}, et :`,
    lignes: lignesDeLaFormule(f).filter((l) => l.manque || !dejaOffert.has(l.texte)),
  };
}

export function estFormule(valeur: string | null | undefined): valeur is FormuleCode {
  return typeof valeur === "string" && FORMULES.some((f) => f.code === valeur);
}

export function estPeriodicite(valeur: string | null | undefined): valeur is Periodicite {
  return valeur === "mensuelle" || valeur === "annuelle";
}

/** La formule, ou `null` si le code ne dit rien — jamais une formule par défaut. */
export function formule(code: string | null | undefined): Formule | null {
  return FORMULES.find((f) => f.code === code) ?? null;
}

/**
 * La TVA qu'Atlas ajoute à ses prix HT, en pour cent.
 *
 * Sa réponse du 5 novembre 2026 : Atlas est soumis à la TVA. Les CGU (article
 * 14) et l'écran annoncent des prix HT, « la TVA française au taux en vigueur
 * s'y ajoute » : c'est ce taux, et lui seul, qui part chez le prestataire.
 */
export const TVA_ABONNEMENT_POURCENT = 20;

/** Les modules connus, dans l'ordre de `MODULES` et sans doublon : un module inconnu ne se facture pas. */
export function modulesConnus(modules: readonly string[]): Module[] {
  return MODULES.filter((m) => modules.includes(m.code));
}

/**
 * LE NOM DE CE QU'IL PAIE — « Entreprise, avec les outils de paysage ». Un seul
 * endroit pour l'écran, le prix du prestataire et la facture de Cause : trois
 * façons de le dire finiraient par nommer trois choses.
 */
export function nomDeLAbonnement(code: string, modules: readonly string[]): string {
  const f = formule(code);
  return [f ? f.nom : code, ...modulesConnus(modules).map((m) => `avec ${m.nom}`)].join(", ");
}

/** Ce qui sera débité, en euros HT, pour une formule, ses modules et une périodicité. */
export function montantDu(f: Formule, periodicite: Periodicite, modules: readonly ModuleCode[] = []): number {
  const annuel = periodicite === "annuelle";
  return modulesConnus(modules).reduce(
    (total, m) => total + (annuel ? m.prixAnnuel : m.prixMensuel),
    annuel ? f.prixAnnuel : f.prixMensuel
  );
}

export type PrixALAnnee = {
  /** Douze mois payés au mois : le prix qui s'affiche barré. */
  douzeMois: number;
  /** Ce qui est débité pour l'année (`montantDu` à l'année). */
  annuel: number;
  /** Ce qu'on gagne, en euros. */
  gain: number;
};

/**
 * À L'ANNÉE, CE QU'ON GAGNE — sa demande du 26 octobre 2026 : le prix de
 * douze mois barré au-dessus du prix de dix, et le gain en euros.
 *
 * **Calculé, jamais écrit à côté du prix.** « Vous gagnez 78 € » recopié dans
 * l'écran resterait vrai jusqu'au premier prix qui bouge, puis mentirait sur
 * de l'argent, sans qu'aucun contrôle ne le voie.
 */
export function prixALAnnee(f: Formule, modules: readonly ModuleCode[] = []): PrixALAnnee {
  const douzeMois = montantDu(f, "mensuelle", modules) * 12;
  const annuel = montantDu(f, "annuelle", modules);
  return { douzeMois, annuel, gain: douzeMois - annuel };
}

/**
 * **En centimes, parce que c'est ce que le prestataire attend.**
 *
 * Aucun `Math.round` sur un flottant qui viendrait d'ailleurs : les montants
 * sont des entiers d'euros, écrits juste au-dessus. La multiplication est donc
 * exacte, et le jour où un prix porterait des centimes, c'est le type qui
 * changera — pas un arrondi qu'on aurait glissé ici.
 */
export function centimes(f: Formule, periodicite: Periodicite, modules: readonly ModuleCode[] = []): number {
  return montantDu(f, periodicite, modules) * 100;
}

/**
 * QUI COMPTE DANS LE PLAFOND.
 *
 * Le patron, la facturation, les commerciaux — ceux qui produisent des
 * documents. Le salarié, jamais : c'est toute la correction du 9 septembre.
 *
 * **Écrit en `switch` exhaustif, et non par une liste**, pour qu'un rôle
 * ajouté demain fasse rougir la compilation au lieu de tomber en silence du
 * bon côté du plafond.
 */
export function roleFabrique(role: Role): boolean {
  switch (role) {
    case "proprietaire":
    case "facturation":
    case "commercial":
      return true;
    case "salarie":
      return false;
  }
}

/** Ce qu'il y a déjà dans l'équipe, le patron compris. */
export type EquipeComptee = {
  /** Tous les accès. */
  comptes: number;
  /** Ceux qui fabriquent (`roleFabrique`). */
  fabricants: number;
  /** Les salariés. */
  salaries: number;
};

export type RefusDePlace = { genre: "seul"; nom: string } | { genre: "fabricants"; plafond: number; nom: string };

/**
 * Reste-t-il une place pour un accès de plus, de ce rôle ?
 *
 * `code` vaut `null` quand l'entreprise n'a pas d'abonnement — et **aucun
 * plafond ne s'applique alors**. Ce n'est pas un trou : un plafond est la
 * conséquence d'une formule choisie, pas un état par défaut. L'appliquer sans
 * abonnement fermerait aujourd'hui l'équipe des artisans qui se servent
 * d'Atlas avant que la moindre offre existe.
 *
 * **Artisan compte tous les accès** (sa règle du 18 novembre 2026) ; les
 * autres formules ne comptent que ceux qui fabriquent, et le salarié passe
 * toujours (sa correction du 9 septembre).
 */
export function placePourUnAcces(
  code: string | null | undefined,
  equipe: Pick<EquipeComptee, "comptes" | "fabricants">,
  role: Role
): { ok: true } | { ok: false; refus: RefusDePlace } {
  const f = formule(code);
  if (!f) return { ok: true };
  if (f.plafondComptes !== null && equipe.comptes >= f.plafondComptes) return { ok: false, refus: { genre: "seul", nom: f.nom } };
  if (!roleFabrique(role) || f.plafondFabricants === null) return { ok: true };
  if (equipe.fabricants < f.plafondFabricants) return { ok: true };
  return { ok: false, refus: { genre: "fabricants", plafond: f.plafondFabricants, nom: f.nom } };
}

/**
 * L'ÉQUIPE TIENT-ELLE DANS LA FORMULE VISÉE ? `null` si oui, sinon la phrase.
 *
 * C'est l'article 14.6 des conditions générales : *« un changement vers une
 * formule dont le nombre de comptes est insuffisant suppose d'avoir au
 * préalable ramené le nombre de comptes concernés sous ce seuil »*. Avant le
 * 18 novembre 2026, rien ne le tenait : on passait d'Entreprise à Artisan avec
 * trois personnes qui facturent.
 *
 * **La phrase vit ici, avec la règle** : elle dit un nombre que la règle
 * calcule, et un écran qui la referait finirait par dire un autre nombre.
 */
export function equipeTientDansLaFormule(code: string | null | undefined, equipe: EquipeComptee): string | null {
  const f = formule(code);
  if (!f) return null;
  if (f.plafondComptes !== null && equipe.comptes > f.plafondComptes) {
    const enTrop = equipe.comptes - f.plafondComptes;
    if (equipe.salaries === enTrop) {
      return enTrop === 1
        ? "Vous avez 1 salarié. Retirez-le d’abord dans Équipe."
        : `Vous avez ${enTrop} salariés. Retirez-les d’abord dans Équipe.`;
    }
    return enTrop === 1
      ? `${f.nom} est pour vous seul. Retirez d’abord l’autre accès dans Équipe.`
      : `${f.nom} est pour vous seul. Retirez d’abord les ${enTrop} autres accès dans Équipe.`;
  }
  if (f.plafondFabricants !== null && equipe.fabricants > f.plafondFabricants) {
    const enTrop = equipe.fabricants - f.plafondFabricants;
    return `${f.nom} comprend ${f.plafondFabricants} personnes aux devis et aux factures. Retirez-en d’abord ${enTrop} dans Équipe.`;
  }
  return null;
}

// **Aucune phrase de refus ici, et c'est délibéré.** Elle vit avec les autres,
// dans `phraseDuRefus` (`src/lib/donner-un-acces.ts`) : deux endroits où se
// rédigent les refus d'un même écran donneraient deux voix, et le patron lirait
// deux applications. Ce fichier décide s'il y a la place ; l'autre le dit.

/**
 * Ce qui se lit d'un coup d'œil à gauche du titre — sa planche du 26 octobre
 * 2026 : les jours d'essai dans un carré, la date d'un arrêt aussi, une
 * pastille sinon (un abonnement qui court, une carte à mettre à jour, un essai
 * fini, rien en cours).
 *
 * **Décidé ICI, et non par l'écran** : distinguer un arrêt demandé d'un
 * abonnement qui court est la règle de `etatAffiche`. L'écran qui la referait
 * de son côté finirait par montrer un carré d'échéance sur un abonnement qui
 * continue (`CLAUDE.md` §3).
 */
export type SigneAbonnement =
  | { genre: "jours"; nombre: number }
  | { genre: "echeance"; jour: number; mois: string }
  | { genre: "formule" | "paiement" | "ferme" | "aucun" };

export type EtatAffiche = {
  titre: string;
  detail: string | null;
  /** `attention` quand quelque chose demande un geste de sa part. */
  ton: "calme" | "attention";
  signe: SigneAbonnement;
};

/**
 * CE QUE L'ÉCRAN DIT DE L'ABONNEMENT EN COURS.
 *
 * Fonction pure et datée depuis l'extérieur : sans `maintenant` en paramètre,
 * elle serait inéprouvable — c'est la règle de `echeance-facture.ts`.
 */
export function etatAffiche(
  abonnement:
    | {
        formule: FormuleCode;
        periodicite: Periodicite;
        statut: StatutAbonnement;
        periodeFin: Date | null;
        annulationDemandee: boolean;
        modules?: readonly ModuleCode[];
        /** Ce qui commence à l'échéance (`changementAVenir`), ou rien. */
        prevu?: { formule: FormuleCode; periodicite: Periodicite; modules: readonly ModuleCode[] } | null;
        /** La carte reste à poser avant d'entrer (migration 0199). */
        carteRequise?: boolean;
        essaiDejaPris?: boolean;
      }
    | null,
  maintenant: Date
): EtatAffiche {
  if (!abonnement) {
    return { titre: "Aucun abonnement", detail: "Cause ne vous facture rien aujourd’hui.", ton: "calme", signe: { genre: "aucun" } };
  }

  const f = formule(abonnement.formule);
  // « Entreprise, avec les outils de paysage » : ce qu'il paie se lit en entier.
  const nom = nomDeLAbonnement(abonnement.formule, abonnement.modules ?? []);
  const rythme = abonnement.periodicite === "annuelle" ? "par an" : "par mois";
  const prix = f ? `${montantDu(f, abonnement.periodicite, abonnement.modules ?? [])} € HT ${rythme}` : null;

  switch (abonnement.statut) {
    case "essai": {
      // **Avec la carte à poser, l'essai n'a pas commencé** : le prestataire
      // le compte dès la carte enregistrée (le modèle A). Les mots de « Il
      // manque votre carte », sa planche du 24 novembre 2026.
      if (abonnement.carteRequise) {
        return {
          titre: "Il manque votre carte",
          detail: abonnement.essaiDejaPris
            ? "L’abonnement commence dès qu’elle est enregistrée."
            : "Votre essai démarre dès qu’elle est enregistrée.",
          ton: "attention",
          signe: { genre: "paiement" },
        };
      }
      const essai = etatDeLEssai(abonnement, maintenant);
      if (!essai || essai.statut === "termine") {
        return {
          titre: "Essai terminé",
          detail: "Tout se relit, rien ne se crée. Choisissez une formule pour continuer.",
          ton: "attention",
          signe: { genre: "ferme" },
        };
      }
      return {
        titre: texteDuRuban(essai),
        detail: `Jusqu’au ${jourEnLettres(essai.fin)}. Aucune carte n’a été demandée.`,
        ton: essai.alerte ? "attention" : "calme",
        signe: { genre: "jours", nombre: essai.joursRestants },
      };
    }
    case "impaye":
      return {
        titre: "Paiement en attente",
        // **On ne dit pas POURQUOI la banque a refusé** : Atlas ne le sait pas,
        // et une raison devinée enverrait appeler la mauvaise personne.
        detail: "Votre dernier paiement n’est pas passé. Mettez votre carte à jour.",
        ton: "attention",
        signe: { genre: "paiement" },
      };
    case "resilie":
      return {
        titre: `${nom}, résilié`,
        detail: "Vous pouvez reprendre un abonnement quand vous voulez.",
        ton: "calme",
        signe: { genre: "aucun" },
      };
    case "actif":
      if (abonnement.annulationDemandee && abonnement.periodeFin) {
        return {
          titre: `${nom}, s’arrête le ${jourEnLettres(abonnement.periodeFin)}`,
          detail: "Vous gardez tout jusqu’à cette date.",
          ton: "attention",
          signe: {
            genre: "echeance",
            jour: abonnement.periodeFin.getUTCDate(),
            mois: MOIS_ABREGES[abonnement.periodeFin.getUTCMonth()],
          },
        };
      }
      // **Une descente prévue se lit sur l'état** (planche du 23 novembre
      // 2026) : la formule payée jusqu'à l'échéance, puis celle qui commence,
      // dans le carré doré de la date. Doré et non ambre : rien n'attend un
      // geste de sa part.
      if (abonnement.prevu && abonnement.periodeFin) {
        const suivante = formule(abonnement.prevu.formule);
        if (suivante) {
          const rythmeSuivant = abonnement.prevu.periodicite === "annuelle" ? "par an" : "par mois";
          const nomSuivant = nomDeLAbonnement(suivante.code, abonnement.prevu.modules);
          const prixSuivant = montantDu(suivante, abonnement.prevu.periodicite, abonnement.prevu.modules);
          return {
            titre: nom,
            detail: `Jusqu’au ${jourEnLettres(abonnement.periodeFin)}, puis ${nomSuivant} à ${prixSuivant} € HT ${rythmeSuivant}.`,
            ton: "calme",
            signe: {
              genre: "echeance",
              jour: abonnement.periodeFin.getUTCDate(),
              mois: MOIS_ABREGES[abonnement.periodeFin.getUTCMonth()],
            },
          };
        }
      }
      return {
        titre: nom,
        // **Deux phrases, chacune son point** — et plus le « · » qui les
        // collait : ni point médian ni tiret entre deux mots à l'écran, sa
        // règle du 22 septembre 2026 (`CLAUDE.md` §3), relevée sur la planche
        // du 26 octobre.
        detail:
          [prix, abonnement.periodeFin ? `Prochain paiement le ${jourEnLettres(abonnement.periodeFin)}` : null]
            .filter(Boolean)
            .map((phrase) => `${phrase}.`)
            .join(" ") || null,
        ton: maintenant > (abonnement.periodeFin ?? maintenant) ? "attention" : "calme",
        signe: { genre: "formule" },
      };
  }
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Le mois d'un carré d'échéance, « 9 nov. » : trois lettres tiennent sous le chiffre, « novembre » non. */
const MOIS_ABREGES = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Le mois d'un carré de date, « déc. » : celui de l'état, et celui de la feuille du changement. */
export function moisAbrege(d: Date): string {
  return MOIS_ABREGES[d.getUTCMonth()];
}

/**
 * « 9 octobre 2026 ». Pas de `toLocaleDateString` : le fuseau et la langue du
 * serveur décideraient à la place du patron, et une date de prélèvement qui
 * change de jour selon la machine est exactement ce qu'on ne veut pas voir sur
 * un écran qui parle d'argent.
 */
export function jourEnLettres(d: Date): string {
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** « 15 décembre », quand l'année va de soi : celle d'aujourd'hui. */
export function jourEtMoisEnLettres(d: Date): string {
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
