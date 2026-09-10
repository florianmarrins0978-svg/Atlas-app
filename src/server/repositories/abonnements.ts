// L'ABONNEMENT DE L'ENTREPRISE — lecture, écriture, et le compte de ceux qui
// fabriquent des documents.
//
// **Ce dépôt ne décide rien.** Ni le prix, ni le plafond, ni ce que l'écran
// affiche : ces règles sont pures et vivent dans `src/lib/abonnements.ts`,
// parce que l'écran s'en sert aussi pour éteindre un bouton. Deux
// implémentations d'une même règle finissent toujours par diverger
// (`CLAUDE.md` §3).
//
// **Tout passe par `withEntreprise`** — sauf le chemin du crochet, qui n'a pas
// de session et emploie la serrure par identifiant de prestataire posée par la
// migration 0084. Voir `appliquerDepuisLeCrochet`, et le long paragraphe de la
// migration sur la raison pour laquelle ce n'est pas un affaiblissement.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { abonnements, evenementsPaiement, membresEntreprise } from "../db/schema";
import { roleFabrique, type FormuleCode, type Periodicite, type StatutAbonnement } from "@/lib/abonnements";
import { ROLES } from "@/lib/acces-roles";
import type { Ctx } from "./context";

export type Abonnement = {
  formule: FormuleCode;
  periodicite: Periodicite;
  statut: StatutAbonnement;
  periodeFin: Date | null;
  annulationDemandee: boolean;
  clientPrestataire: string | null;
  abonnementPrestataire: string | null;
};

/** L'abonnement de l'entreprise, ou `null` — jamais un abonnement inventé. */
export async function abonnementDeLEntreprise(ctx: Ctx): Promise<Abonnement | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        formule: abonnements.formule,
        periodicite: abonnements.periodicite,
        statut: abonnements.statut,
        periodeFin: abonnements.periodeFin,
        annulationDemandee: abonnements.annulationDemandee,
        clientPrestataire: abonnements.clientPrestataire,
        abonnementPrestataire: abonnements.abonnementPrestataire,
      })
      .from(abonnements)
      .where(eq(abonnements.entrepriseId, ctx.entrepriseId))
      .limit(1);
    return ligne ?? null;
  });
}

/**
 * **LES RÔLES QUI COMPTENT, DÉDUITS DE LA RÈGLE — jamais réécrits ici.**
 *
 * La tentation était d'écrire `["proprietaire", "facturation", "commercial"]`
 * dans la requête. C'eût été une seconde liste : le jour où un rôle s'ajoute,
 * la facture et le plafond diraient deux choses différentes, et personne ne le
 * verrait avant qu'un client paie trop peu. La liste se déduit donc de
 * `roleFabrique`, qui est la règle.
 */
const ROLES_QUI_FABRIQUENT = ROLES.filter(roleFabrique);

/**
 * Combien de personnes fabriquent des devis ou des factures, le patron compris.
 *
 * C'est le nombre que le plafond de la formule borne — sa correction du
 * 9 septembre 2026 : on compte qui FABRIQUE, jamais les salariés au planning.
 */
export async function compterLesFabricants(ctx: Ctx): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ combien: sql<number>`count(*)::int` })
      .from(membresEntreprise)
      .where(
        and(
          eq(membresEntreprise.entrepriseId, ctx.entrepriseId),
          inArray(membresEntreprise.role, ROLES_QUI_FABRIQUENT)
        )
      );
    return ligne?.combien ?? 0;
  });
}

/**
 * CE QUE LE PRESTATAIRE VIENT DE NOUS APPRENDRE.
 *
 * Un seul type pour les deux chemins — le retour de paiement et le crochet —
 * parce qu'ils écrivent exactement la même chose. Deux formes auraient donné
 * deux façons d'enregistrer un abonnement, et la divergence se serait vue le
 * jour d'un renouvellement, pas avant.
 */
export type EtatVenuDuPrestataire = {
  formule: FormuleCode;
  periodicite: Periodicite;
  statut: StatutAbonnement;
  periodeFin: Date | null;
  annulationDemandee: boolean;
  clientPrestataire: string;
  abonnementPrestataire: string;
};

function versLaLigne(etat: EtatVenuDuPrestataire) {
  return {
    formule: etat.formule,
    periodicite: etat.periodicite,
    statut: etat.statut,
    periodeFin: etat.periodeFin,
    annulationDemandee: etat.annulationDemandee,
    clientPrestataire: etat.clientPrestataire,
    abonnementPrestataire: etat.abonnementPrestataire,
    updatedAt: new Date(),
  };
}

/**
 * Écrit l'état DEPUIS UNE SESSION DU PATRON — au retour du paiement.
 *
 * **Pourquoi ce chemin existe alors que le crochet fait déjà le travail.** Le
 * crochet peut n'être pas encore configuré, ou arriver quelques secondes plus
 * tard ; le patron, lui, revient tout de suite sur son écran. Sans cela il
 * lirait « Aucun abonnement » juste après avoir payé — et il rappuierait.
 *
 * Ce n'est pas une seconde règle : les deux chemins écrivent `versLaLigne`, et
 * le second appui est sans effet (le même abonnement écrase le même état).
 */
export async function enregistrerLAbonnement(ctx: Ctx, etat: EtatVenuDuPrestataire): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .insert(abonnements)
      .values({ entrepriseId: ctx.entrepriseId, ...versLaLigne(etat) })
      .onConflictDoUpdate({ target: abonnements.entrepriseId, set: versLaLigne(etat) });
  });
}

/**
 * L'ÉCRITURE DU CROCHET — sans session, et strictement bornée à un abonnement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI PROTÈGE CETTE FONCTION.** Trois choses, et il en faut trois :
 *
 *  1. la SIGNATURE de l'événement a déjà été vérifiée par l'appelant — sans
 *     elle, cette adresse publique laisserait n'importe qui s'offrir la
 *     formule Illimité ;
 *  2. la politique `abonnements_par_identifiant_prestataire` (migration 0084)
 *     n'ouvre QUE la ligne dont l'identifiant est posé juste avant. Aucune
 *     énumération n'est possible ;
 *  3. l'événement est consigné dans `evenements_paiement`, et **un événement
 *     déjà vu ne fait rien** : Stripe répète tant qu'il n'a pas reçu de 200.
 *
 * @returns `false` quand l'abonnement est inconnu ou l'événement déjà traité —
 *          les deux valent un 200 pour le prestataire (rien à refaire).
 */
export async function appliquerDepuisLeCrochet(
  evenementId: string,
  typeEvenement: string,
  etat: EtatVenuDuPrestataire
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.abonnement_prestataire', ${etat.abonnementPrestataire}, true)`);

    const [ligne] = await tx
      .select({ entrepriseId: abonnements.entrepriseId })
      .from(abonnements)
      .where(eq(abonnements.abonnementPrestataire, etat.abonnementPrestataire))
      .limit(1);

    // **Un abonnement inconnu ne se CRÉE pas ici**, et c'est délibéré : la
    // seule chose que le crochet sait alors, c'est un identifiant que nous
    // n'avons jamais vu. Créer une entreprise ou en deviner une à partir de là
    // serait exactement l'inverse de l'isolation.
    if (!ligne) return false;

    // Le contexte d'entreprise, DÉDUIT de la ligne — jamais d'une valeur
    // envoyée par le prestataire. Il ouvre l'écriture sur `evenements_paiement`,
    // qui n'a pas de serrure par identifiant d'abonnement (elle n'en a pas
    // besoin : on vient d'établir à qui appartient l'événement).
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${ligne.entrepriseId}, true)`);

    const consigne = await tx
      .insert(evenementsPaiement)
      .values({ id: evenementId, entrepriseId: ligne.entrepriseId, type: typeEvenement })
      .onConflictDoNothing({ target: evenementsPaiement.id })
      .returning({ id: evenementsPaiement.id });

    // Déjà vu : on ne rejoue rien. C'est ce qui empêche un même paiement de
    // prolonger trois fois la période.
    if (consigne.length === 0) return false;

    await tx
      .update(abonnements)
      .set(versLaLigne(etat))
      .where(eq(abonnements.abonnementPrestataire, etat.abonnementPrestataire));

    return true;
  });
}
