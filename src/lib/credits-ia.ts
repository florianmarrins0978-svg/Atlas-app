import { enLectureSeule, type FormuleCode, type StatutAbonnement } from "./abonnements";

/**
 * LES CRÉDITS IA DU MOIS — combien une entreprise peut dépenser chez les
 * fournisseurs d'IA, et où elle en est.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa décision du 26 octobre 2026** (audit de sécurité, E13) : sans plafond,
 * un compte volé ou un abus fait monter SA facture chez le fournisseur, sans
 * limite. Essai 5 €, Artisan 10 €, Entreprise 20 €, Illimité 60 €, une
 * entreprise d'avant l'offre (sans abonnement) 10 €, et la sienne sans plafond.
 * Un artisan seul qui dicte un devis par jour dépense de l'ordre de 1 à 3 € :
 * le plafond ne gêne pas l'usage, il arrête l'abus.
 *
 * **Une seule règle, lue par deux endroits** : la coupure côté serveur
 * (`src/server/ai/compteur.ts`) et la barre de l'écran Abonnement. L'écran ne
 * compare aucun seuil lui-même (`CLAUDE.md` §3).
 *
 * **Le coût est ESTIMÉ, jamais facturé** : il se calcule sur la longueur de ce
 * qui part et revient, au prix public du modèle, un dollar compté pour un euro.
 * Chaque arrondi penche vers le haut : un plafond qui coupe un peu tôt coûte
 * une saisie à la main, un plafond qui coupe trop tard coûte de l'argent.
 */

/** Le montant d'un plafond, en euros, tel qu'il l'a donné. */
export const PLAFONDS_IA_EUROS = {
  essai: 5,
  sansAbonnement: 10,
  artisan: 10,
  entreprise: 20,
  illimite: 60,
} as const satisfies Record<FormuleCode | "essai" | "sansAbonnement", number>;

/** Un euro, en micro-euros : l'unité du compteur, pour additionner sans flottants. */
export const MICRO = 1_000_000;

/** « Presque épuisé » à partir de cette part, en pour cent. */
export const SEUIL_PRESQUE_POURCENT = 80;

type AbonnementPourPlafond = { statut: StatutAbonnement; formule: FormuleCode; periodeFin: Date | null } | null;

/**
 * Le plafond du mois, en micro-euros ; `null` quand il n'y en a pas.
 *
 * `exemptee` : l'entreprise est désignée par le réglage de son espace
 * (`ATLAS_IA_SANS_PLAFOND`), jamais par son nom dans le code. L'appli sert tous
 * les artisans ; la sienne est un cas parmi d'autres.
 *
 * **En lecture seule (essai fini, abonnement résilié), zéro** : rien de ce que
 * l'IA proposerait ne pourrait s'écrire, et un compte qui ne paie plus ne fait
 * plus payer personne.
 */
export function plafondIA(abonnement: AbonnementPourPlafond, exemptee: boolean, maintenant: Date): number | null {
  if (exemptee) return null;
  if (!abonnement) return PLAFONDS_IA_EUROS.sansAbonnement * MICRO;
  if (enLectureSeule(abonnement, maintenant)) return 0;
  if (abonnement.statut === "essai") return PLAFONDS_IA_EUROS.essai * MICRO;
  return PLAFONDS_IA_EUROS[abonnement.formule] * MICRO;
}

/** Les entreprises sans plafond, lues dans le réglage de l'espace : des identifiants séparés par des virgules. */
export function entreprisesSansPlafond(reglage: string | undefined): Set<string> {
  return new Set(
    (reglage ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[0-9a-f-]{36}$/.test(s))
  );
}

/** Le premier jour du mois de `instant`, en UTC : la clé du compteur. */
export function moisDu(instant: Date): string {
  return `${instant.getUTCFullYear()}-${String(instant.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Le premier jour du mois suivant : la date où le compteur repart à zéro. */
export function repriseApres(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth() + 1, 1));
}

export type EtatCreditsIA =
  | { plafonne: false }
  | { plafonne: true; pourcent: number; etat: "normal" | "presque" | "epuise"; reprise: Date };

/**
 * Où en est l'entreprise ce mois-ci.
 *
 * Le pourcentage s'arrondit vers le HAUT et plafonne à 100 : à 99,2 % la barre
 * dit 100 et l'état « presque », jamais un « 99 » qui laisserait croire qu'il
 * reste de quoi dicter un devis.
 */
export function etatDesCreditsIA(depenseMicro: number, plafondMicro: number | null, maintenant: Date): EtatCreditsIA {
  if (plafondMicro === null) return { plafonne: false };
  const reprise = repriseApres(maintenant);
  if (plafondMicro <= 0 || depenseMicro >= plafondMicro) return { plafonne: true, pourcent: 100, etat: "epuise", reprise };
  const pourcent = Math.min(100, Math.ceil((Math.max(0, depenseMicro) / plafondMicro) * 100));
  return { plafonne: true, pourcent, etat: pourcent >= SEUIL_PRESQUE_POURCENT ? "presque" : "normal", reprise };
}

/**
 * Prix publics, en dollars par million de jetons (entrée, sortie). Un
 * fournisseur inconnu prend le plus cher de la liste : mieux vaut couper tôt.
 */
const PRIX_PAR_MILLION: Record<string, { entree: number; sortie: number }> = {
  anthropic: { entree: 3, sortie: 15 },
  openai: { entree: 2.5, sortie: 10 },
};
const PRIX_INCONNU = { entree: 3, sortie: 15 };

/** Un jeton pour trois caractères : un texte français en fait plutôt quatre, l'erreur penche vers le haut. */
const CARACTERES_PAR_JETON = 3;

/** Une image lue : ce qu'une photo de téléphone coûte au plus en jetons d'entrée. */
export const JETONS_PAR_IMAGE = 1600;

export function jetonsDe(caracteres: number): number {
  return Math.ceil(Math.max(0, caracteres) / CARACTERES_PAR_JETON);
}

/** Le coût d'un appel au modèle, en micro-euros. */
export function coutDUnAppel(fournisseur: string, jetonsEntree: number, jetonsSortie: number): number {
  const prix = PRIX_PAR_MILLION[fournisseur] ?? PRIX_INCONNU;
  return Math.ceil(jetonsEntree * prix.entree + jetonsSortie * prix.sortie);
}

/** Prix d'une minute écoutée, en dollars ; inconnu, le plus cher. */
const PRIX_MINUTE: Record<string, number> = { openai: 0.006, deepgram: 0.0043, google: 0.016 };

/**
 * La durée d'un enregistrement se déduit de son poids à 16 kbit/s : un
 * téléphone enregistre plus dense, donc la durée estimée est plus LONGUE que la
 * vraie, et le coût aussi.
 */
export function coutDUneEcoute(fournisseur: string, octets: number): number {
  const minutes = (Math.max(0, octets) * 8) / 16_000 / 60;
  return Math.ceil(minutes * (PRIX_MINUTE[fournisseur] ?? 0.016) * MICRO);
}

/**
 * Ce que dit un geste d'IA refusé au plafond : la dictée, l'assistant, la note
 * vocale relaient cette phrase telle quelle. Celle de sa planche, précédée de
 * ce qui s'est passé : en dictant, il ne vient pas de lire l'Abonnement.
 */
export function phraseCreditsEpuises(reprise: Date): string {
  return `Crédits IA épuisés. Atlas IA reprend le ${jourDeReprise(reprise)}. D'ici là, tout s'écrit à la main.`;
}

/** « 1er novembre » : la reprise tombe toujours un premier du mois. */
export function jourDeReprise(reprise: Date): string {
  return `1er ${reprise.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" })}`;
}
