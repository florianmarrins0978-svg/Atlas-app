// CHANGER DE FORMULE : CE QUI EST DÉBITÉ, ET QUAND.
//
// Ses décisions du 23 novembre 2026, après avoir payé pour de vrai avec une
// clé de test et vu qu'un appui changeait la formule sans rien débiter (la
// différence attendait l'échéance : monter puis résilier offrait la formule
// du dessus). Planche `appli/soignee/changer-de-formule.html`.
//
// | Ce qu'il fait | Ce qui est débité aujourd'hui | L'échéance |
// |---|---|---|
// | monter, au mois | le prix ENTIER du mois de la nouvelle formule ; les jours restants de l'ancienne ne sont pas remboursés | aujourd'hui + un mois |
// | monter, à l'année | la DIFFÉRENCE ENTIÈRE des deux prix de l'année, jamais au prorata, même au huitième mois | inchangée |
// | passer du mois à l'année, même formule ou au-dessus | l'année ENTIÈRE de la formule choisie | aujourd'hui + un an |
// | descendre, ou passer de l'année au mois | rien : la nouvelle formule commence à l'échéance | l'échéance en cours |
//
// **Déduit, et non dit par lui** (`TODO.md`, « CHANGER DE FORMULE ») : passer
// de l'année au mois attend l'échéance, parce qu'il a payé l'année ; et passer
// du mois à l'année vers une formule MOINS chère est une descente : elle
// attend l'échéance, où l'année de la nouvelle formule sera débitée. Ainsi
// rien de ce qui part tout de suite ne baisse la formule, et seule une
// descente qu'il a confirmée retire des comptes.
//
// **Une seule règle**, pour l'écran qui l'annonce dans la feuille et pour
// l'action qui la fait exécuter au prestataire (`CLAUDE.md` §3) : la feuille
// ne peut pas annoncer un montant que le prestataire ne débitera pas.
import {
  FORMULES,
  TVA_ABONNEMENT_POURCENT,
  formule,
  montantDu,
  roleFabrique,
  type FormuleCode,
  type Periodicite,
} from "./abonnements";
import type { Role } from "./acces-roles";

export type Choix = { formule: FormuleCode; periodicite: Periodicite };

export type Changement =
  | { genre: "aucun" }
  | {
      genre: "tout-de-suite";
      facon: "monter-au-mois" | "monter-a-l-annee" | "passer-a-l-annee";
      /** En euros HT, ce qui part aujourd'hui. */
      debitHT: number;
      /** Le jour du changement devient l'échéance, ou elle ne bouge pas. */
      echeanceRemise: boolean;
    }
  | { genre: "a-l-echeance" };

/** Du moins cher au plus cher : l'ordre de `FORMULES`, qui est celui des cartes. */
function rang(code: FormuleCode): number {
  return FORMULES.findIndex((f) => f.code === code);
}

export function changementDeFormule(actuel: Choix, voulu: Choix): Changement {
  const a = formule(actuel.formule);
  const v = formule(voulu.formule);
  if (!a || !v) return { genre: "aucun" };
  if (actuel.formule === voulu.formule && actuel.periodicite === voulu.periodicite) return { genre: "aucun" };

  if (rang(voulu.formule) < rang(actuel.formule)) return { genre: "a-l-echeance" };
  if (actuel.periodicite === "mensuelle" && voulu.periodicite === "annuelle") {
    return { genre: "tout-de-suite", facon: "passer-a-l-annee", debitHT: montantDu(v, "annuelle"), echeanceRemise: true };
  }
  if (actuel.periodicite === "annuelle" && voulu.periodicite === "mensuelle") return { genre: "a-l-echeance" };
  if (voulu.periodicite === "annuelle") {
    return {
      genre: "tout-de-suite",
      facon: "monter-a-l-annee",
      debitHT: montantDu(v, "annuelle") - montantDu(a, "annuelle"),
      echeanceRemise: false,
    };
  }
  return { genre: "tout-de-suite", facon: "monter-au-mois", debitHT: montantDu(v, "mensuelle"), echeanceRemise: true };
}

/**
 * Le TTC d'un montant HT en euros entiers, en CENTIMES : 59 € HT font 7 080.
 * Exact sans arrondi tant que les prix sont des euros entiers (`centimes`,
 * `abonnements.ts`, tient la même promesse).
 */
export function ttcEnCentimes(htEuros: number): number {
  return htEuros * (100 + TVA_ABONNEMENT_POURCENT);
}

/**
 * Un jour plus un mois ou un an, comme un abonnement compte : le 31 janvier
 * plus un mois tombe le dernier jour de février, jamais le 3 mars.
 */
export function plusUnePeriode(jour: Date, periodicite: Periodicite): Date {
  const mois = jour.getUTCMonth() + (periodicite === "annuelle" ? 12 : 1);
  const annee = jour.getUTCFullYear() + Math.floor(mois / 12);
  const moisDansLAnnee = mois % 12;
  const dernier = new Date(Date.UTC(annee, moisDansLAnnee + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      annee,
      moisDansLAnnee,
      Math.min(jour.getUTCDate(), dernier),
      jour.getUTCHours(),
      jour.getUTCMinutes(),
      jour.getUTCSeconds()
    )
  );
}

/**
 * LE PROCHAIN PAIEMENT après le changement : remis au jour du changement,
 * gardé, ou, pour ce qui attend l'échéance, le jour où la nouvelle formule
 * commence. `null` quand l'échéance en cours n'est pas connue : une date ne se
 * devine pas (`finDePeriode`, `stripe.ts`).
 */
export function prochaineEcheance(
  changement: Changement,
  voulu: Choix,
  echeanceEnCours: Date | null,
  maintenant: Date
): Date | null {
  if (changement.genre === "tout-de-suite" && changement.echeanceRemise) return plusUnePeriode(maintenant, voulu.periodicite);
  return echeanceEnCours;
}

/**
 * LES JOURS PERDUS quand le changement part tout de suite et remet
 * l'échéance (monter au mois, passer à l'année) : ceux qui restaient à la
 * période payée. Sa demande du 24 novembre 2026 : *« l'application doit
 * prévenir qu'il reste 15 jours et que ces 15 jours-là seront perdus »*.
 *
 * Comptés en jours du calendrier, au jour près, comme `jourEnLettres` les
 * écrit (UTC) : un mois payé jusqu'au 3 janvier, changé le 15 décembre,
 * en perd 19. `null` quand rien ne se perd par ce changement, ou quand
 * l'échéance n'est pas connue : un nombre ne se devine pas.
 */
export function joursPerdus(changement: Changement, echeanceEnCours: Date | null, maintenant: Date): number | null {
  if (changement.genre !== "tout-de-suite" || !changement.echeanceRemise || !echeanceEnCours) return null;
  const jour = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.round((jour(echeanceEnCours) - jour(maintenant)) / 86_400_000));
}

/**
 * LES COMPTES QUI PARTENT avec la descente — sa décision du 23 novembre :
 * *« faut lui dire que tous ses autres comptes vont être supprimés »*. Ceux
 * qui fabriquent des devis ou des factures au-delà du plafond de la formule
 * voulue (`roleFabrique`, les mêmes que compte `placePourUnFabricant`).
 *
 * **Le patron ne part jamais**, même à deux patrons sur Artisan : un compte
 * sans patron ne se gère plus. Puis les plus anciens gardent leur place, les
 * derniers arrivés partent. Déduit, pas dit par lui : il n'a tranché que
 * vers Artisan, où tous les autres partent.
 *
 * **Une seule règle pour la feuille et pour le crochet** : la feuille annonce
 * le nombre que le crochet retirera, compté sur la même liste.
 *
 * Ce qui part, c'est l'ACCÈS (l'adhésion) : le compte, ses devis et ses
 * factures restent (`retirerUnAcces`), et une facture se garde dix ans.
 */
export function lesComptesQuiPartent(
  membres: readonly { id: string; role: Role; depuis: Date }[],
  voulue: FormuleCode
): string[] {
  const f = formule(voulue);
  if (!f || f.plafondFabricants === null) return [];
  const fabricants = membres.filter((m) => roleFabrique(m.role));
  const patrons = fabricants.filter((m) => m.role === "proprietaire").length;
  const autres = fabricants
    .filter((m) => m.role !== "proprietaire")
    .sort((a, b) => a.depuis.getTime() - b.depuis.getTime());
  return autres.slice(Math.max(0, f.plafondFabricants - patrons)).map((m) => m.id);
}

/**
 * LE CHANGEMENT QUI ATTEND L'ÉCHÉANCE, ou `null`. Une fois l'échéance passée,
 * la formule en cours EST la formule prévue : il n'y a plus rien à venir,
 * même si la ligne garde encore la trace de ce qui était prévu.
 */
export function changementAVenir(abonnement: {
  formule: FormuleCode;
  periodicite: Periodicite;
  formulePrevue: FormuleCode | null;
  periodicitePrevue: Periodicite | null;
}): Choix | null {
  if (!abonnement.formulePrevue || !abonnement.periodicitePrevue) return null;
  if (abonnement.formulePrevue === abonnement.formule && abonnement.periodicitePrevue === abonnement.periodicite) return null;
  return { formule: abonnement.formulePrevue, periodicite: abonnement.periodicitePrevue };
}
