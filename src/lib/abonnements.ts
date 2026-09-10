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
 * **CE QUE CE FICHIER NE FAIT PAS, ET C'EST DÉLIBÉRÉ.**
 *
 * Il ne ferme aucune fonction de l'application. La planche annonce « les
 * absences » et « les retours d'intervention » comme un plus d'« Entreprise » :
 * cette distinction-là n'est PAS appliquée, et il faut qu'il la tranche avant
 * qu'elle le soit — la poser en silence retirerait à un artisan des écrans
 * dont il se sert déjà aujourd'hui. Écrit dans `TODO.md`.
 *
 * La seule règle qui mord est le plafond de fabricants, parce qu'il l'a
 * demandée mot pour mot.
 */
import type { Role } from "./acces-roles";

export type FormuleCode = "artisan" | "entreprise" | "illimite";

/** Mensuel ou annuel. L'annuel offre deux mois — 290 au lieu de 348. */
export type Periodicite = "mensuelle" | "annuelle";

/**
 * Où en est l'abonnement d'une entreprise.
 *
 * **Il n'y a pas d'état « essai », et ce n'est pas un oubli.** La durée de
 * l'essai gratuit est l'une des seize cases `[À COMPLÉTER]` des conditions
 * générales : elle n'est pas arrêtée. Poser ici « 14 jours » en aurait fait un
 * engagement contractuel décidé par le code — ce que `docs/AGENT.md` §3
 * interdit pour un prix, et à plus forte raison pour une durée qui figure dans
 * un contrat. L'état viendra le jour où il donnera le chiffre.
 */
export type StatutAbonnement = "actif" | "impaye" | "resilie";

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
    compris: COMMUN,
  },
  {
    code: "entreprise",
    nom: "Entreprise",
    accroche: "Vos gars au planning, et jusqu’à cinq qui facturent.",
    prixMensuel: 59,
    prixAnnuel: 590,
    plafondFabricants: 5,
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
