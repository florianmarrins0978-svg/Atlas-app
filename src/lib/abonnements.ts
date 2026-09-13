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
 * **Une entreprise SANS ligne d'abonnement n'est touchée par aucune des
 * trois** : c'est son Atlas à lui, et celui de ceux qui s'en servaient avant
 * l'offre. Une fermeture est la conséquence d'une formule choisie.
 */
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
  | { statut: "termine"; fin: Date };

type AbonnementLu = { statut: StatutAbonnement; periodeFin: Date | null } | null | undefined;

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
  if (maintenant.getTime() >= fin.getTime()) return { statut: "termine", fin };
  const joursRestants = Math.ceil((fin.getTime() - maintenant.getTime()) / UN_JOUR_MS);
  return { statut: "en-cours", joursRestants, alerte: joursRestants <= JOURS_AVANT_ALERTE, fin };
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
  return etatDeLEssai(abonnement, maintenant)?.statut === "termine";
}

/** Ce que dit l'écran quand il appuie quand même sur un bouton qui écrit. */
export const PHRASE_LECTURE_SEULE = "Votre essai est terminé. Choisissez une formule pour créer de nouveau.";

/** Le ruban en tête de l'accueil — le seul écran qu'il ouvre tous les matins. */
export function texteDuRuban(etat: EtatEssai): string {
  if (etat.statut === "termine") return "Essai terminé — lecture seule";
  return etat.joursRestants > 1
    ? `Essai gratuit — ${etat.joursRestants} jours restants`
    : "Essai gratuit — dernier jour";
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
 * CE QUI SE FERME À « ARTISAN » — sa décision du 10 septembre 2026 : *« oui
 * bloqué pour l'abonnement artisan »*. Les absences d'équipe et les retours
 * d'intervention sont un plus d'« Entreprise ».
 *
 * La liste est FERMÉE, et chaque formule dit ce qu'elle ouvre (`fonctions`
 * ci-dessous) : une fonction réservée qui n'y figurerait pas ferait rougir la
 * compilation, pas un client.
 */
export type FonctionReservee = "absences" | "retours";

/**
 * Cette formule ouvre-t-elle cette fonction ?
 *
 * `code` vaut `null` sans abonnement — et **tout est ouvert**, pour la même
 * raison que le plafond (`placePourUnFabricant`) : une fermeture est la
 * conséquence d'une formule choisie, jamais un état par défaut. Son Atlas à
 * lui n'a pas de ligne d'abonnement, et il se sert des absences.
 */
export function fonctionOuverte(code: string | null | undefined, fonction: FonctionReservee): boolean {
  const f = formule(code);
  return !f || f.fonctions.includes(fonction);
}

/** Ce que lit un abonné « Artisan » à la place de la fonction — même dessin, même bouton. */
export function phraseDeLaFermeture(fonction: FonctionReservee): { titre: string; detail: string } {
  switch (fonction) {
    case "absences":
      return {
        titre: "Les absences sont dans « Entreprise »",
        detail: "Noter qui n’est pas là, et voir vos équipes se réorganiser toutes seules.",
      };
    case "retours":
      return {
        titre: "Les retours sont dans « Entreprise »",
        detail: "Ce que vos gars ont constaté en fin de chantier : ce qui est fait, ce qui ne l’est pas, et leurs photos.",
      };
  }
}

export type LigneComprise = {
  texte: string;
  /** Vrai quand la ligne est un PLUS par rapport à la formule du dessous. */
  neuf?: boolean;
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
  /** Les fonctions réservées que cette formule ouvre (`fonctionOuverte`). */
  fonctions: readonly FonctionReservee[];
  compris: LigneComprise[];
};

const COMMUN: LigneComprise[] = [
  { texte: "Devis et factures illimités" },
  { texte: "Vos dictées transcrites et chiffrées" },
  { texte: "Le planning de vos chantiers" },
  { texte: "Votre relevé de TVA, tenu tout seul" },
  { texte: "Le plan d’arrosage" },
  { texte: "Vos salariés au planning, sans supplément" },
];

/**
 * **L'ordre est celui de la planche** : du moins cher au plus cher. Il se lit
 * de haut en bas, et c'est celui dans lequel il compare.
 */
export const FORMULES: readonly Formule[] = [
  {
    code: "artisan",
    nom: "Artisan",
    accroche: "Du devis dicté à la facture, sans rien retaper.",
    prixMensuel: 29,
    prixAnnuel: 290,
    plafondFabricants: 1,
    fonctions: [],
    compris: COMMUN,
  },
  {
    code: "entreprise",
    nom: "Entreprise",
    accroche: "Vos gars au planning, et jusqu’à cinq qui facturent.",
    prixMensuel: 59,
    prixAnnuel: 590,
    plafondFabricants: 5,
    fonctions: ["absences", "retours"],
    compris: [
      ...COMMUN,
      { texte: "Jusqu’à 5 personnes qui font des devis ou des factures", neuf: true },
      { texte: "Les absences de vos équipes", neuf: true },
      { texte: "Les retours d’intervention de vos gars", neuf: true },
    ],
  },
  {
    code: "illimite",
    nom: "Illimité",
    accroche: "Toute votre équipe sur Atlas.",
    prixMensuel: 120,
    prixAnnuel: 1200,
    plafondFabricants: null,
    fonctions: ["absences", "retours"],
    compris: [
      ...COMMUN,
      { texte: "Les absences de vos équipes" },
      { texte: "Les retours d’intervention de vos gars" },
      { texte: "Autant de personnes que vous voulez aux devis et aux factures", neuf: true },
    ],
  },
] as const;

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

/** Ce qui sera débité, en euros HT, pour une formule et une périodicité. */
export function montantDu(f: Formule, periodicite: Periodicite): number {
  return periodicite === "annuelle" ? f.prixAnnuel : f.prixMensuel;
}

/**
 * **En centimes, parce que c'est ce que le prestataire attend.**
 *
 * Aucun `Math.round` sur un flottant qui viendrait d'ailleurs : les montants
 * sont des entiers d'euros, écrits juste au-dessus. La multiplication est donc
 * exacte, et le jour où un prix porterait des centimes, c'est le type qui
 * changera — pas un arrondi qu'on aurait glissé ici.
 */
export function centimes(f: Formule, periodicite: Periodicite): number {
  return montantDu(f, periodicite) * 100;
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

export type RefusDePlace = { plafond: number; nom: string };

/**
 * Reste-t-il une place pour une personne de plus qui fabrique ?
 *
 * `code` vaut `null` quand l'entreprise n'a pas d'abonnement — et **le plafond
 * ne s'applique alors PAS**. Ce n'est pas un trou : un plafond est la
 * conséquence d'une formule choisie, pas un état par défaut. L'appliquer sans
 * abonnement fermerait aujourd'hui l'équipe des artisans qui se servent
 * d'Atlas avant que la moindre offre existe.
 *
 * @param fabricants combien de personnes fabriquent DÉJÀ, le patron compris.
 */
export function placePourUnFabricant(
  code: string | null | undefined,
  fabricants: number
): { ok: true } | { ok: false; refus: RefusDePlace } {
  const f = formule(code);
  if (!f || f.plafondFabricants === null) return { ok: true };
  if (fabricants < f.plafondFabricants) return { ok: true };
  return { ok: false, refus: { plafond: f.plafondFabricants, nom: f.nom } };
}

// **Aucune phrase de refus ici, et c'est délibéré.** Elle vit avec les autres,
// dans `phraseDuRefus` (`src/lib/donner-un-acces.ts`) : deux endroits où se
// rédigent les refus d'un même écran donneraient deux voix, et le patron lirait
// deux applications. Ce fichier décide s'il y a la place ; l'autre le dit.

export type EtatAffiche = {
  titre: string;
  detail: string | null;
  /** `attention` quand quelque chose demande un geste de sa part. */
  ton: "calme" | "attention";
};

/**
 * CE QUE L'ÉCRAN DIT DE L'ABONNEMENT EN COURS.
 *
 * Fonction pure et datée depuis l'extérieur : sans `maintenant` en paramètre,
 * elle serait inéprouvable — c'est la règle de `echeance-facture.ts`.
 */
export function etatAffiche(
  abonnement:
    | { formule: FormuleCode; periodicite: Periodicite; statut: StatutAbonnement; periodeFin: Date | null; annulationDemandee: boolean }
    | null,
  maintenant: Date
): EtatAffiche {
  if (!abonnement) {
    return { titre: "Aucun abonnement", detail: "Atlas ne vous facture rien aujourd’hui.", ton: "calme" };
  }

  const f = formule(abonnement.formule);
  const nom = f ? f.nom : abonnement.formule;
  const rythme = abonnement.periodicite === "annuelle" ? "par an" : "par mois";
  const prix = f ? `${montantDu(f, abonnement.periodicite)} € HT ${rythme}` : null;

  switch (abonnement.statut) {
    case "essai": {
      const essai = etatDeLEssai(abonnement, maintenant);
      if (!essai || essai.statut === "termine") {
        return {
          titre: "Essai terminé",
          detail: "Tout se relit, rien ne se crée. Choisissez une formule pour continuer.",
          ton: "attention",
        };
      }
      return {
        titre: texteDuRuban(essai).replace(" — ", " · "),
        detail: `Jusqu’au ${jourEnLettres(essai.fin)}. Aucune carte n’a été demandée.`,
        ton: essai.alerte ? "attention" : "calme",
      };
    }
    case "impaye":
      return {
        titre: "Paiement en attente",
        // **On ne dit pas POURQUOI la banque a refusé** : Atlas ne le sait pas,
        // et une raison devinée enverrait appeler la mauvaise personne.
        detail: "Votre dernier paiement n’est pas passé. Mettez votre carte à jour.",
        ton: "attention",
      };
    case "resilie":
      return { titre: `${nom} — résilié`, detail: "Vous pouvez reprendre un abonnement quand vous voulez.", ton: "calme" };
    case "actif":
      if (abonnement.annulationDemandee && abonnement.periodeFin) {
        return {
          titre: `${nom} — s’arrête le ${jourEnLettres(abonnement.periodeFin)}`,
          detail: "Vous gardez tout jusqu’à cette date.",
          ton: "attention",
        };
      }
      return {
        titre: nom,
        detail: [prix, abonnement.periodeFin ? `Prochain paiement le ${jourEnLettres(abonnement.periodeFin)}` : null]
          .filter(Boolean)
          .join(" · ") || null,
        ton: maintenant > (abonnement.periodeFin ?? maintenant) ? "attention" : "calme",
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

/**
 * « 9 octobre 2026 ». Pas de `toLocaleDateString` : le fuseau et la langue du
 * serveur décideraient à la place du patron, et une date de prélèvement qui
 * change de jour selon la machine est exactement ce qu'on ne veut pas voir sur
 * un écran qui parle d'argent.
 */
export function jourEnLettres(d: Date): string {
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
