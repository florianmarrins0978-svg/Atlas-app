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

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { abonnements, entreprises, evenementsPaiement, membresEntreprise } from "../db/schema";
import { abonnementRouvreLeCompte } from "@/lib/fermeture-compte";
import { estModule, roleFabrique, type EquipeComptee, type FormuleCode, type ModuleCode, type Periodicite, type StatutAbonnement } from "@/lib/abonnements";
import { lesComptesQuiPartent, memesModules, type Choix } from "@/lib/changement-de-formule";
import { ROLES, type Role } from "@/lib/acces-roles";
import type { Ctx } from "./context";

export type Abonnement = {
  formule: FormuleCode;
  periodicite: Periodicite;
  statut: StatutAbonnement;
  /** Les modules souscrits ; un code inconnu de `MODULES` n'est jamais rendu. */
  modules: ModuleCode[];
  periodeFin: Date | null;
  annulationDemandee: boolean;
  clientPrestataire: string | null;
  abonnementPrestataire: string | null;
  /** Ce qui commence à l'échéance (`changementAVenir`). */
  formulePrevue: FormuleCode | null;
  periodicitePrevue: Periodicite | null;
  modulesPrevus: ModuleCode[] | null;
};

/**
 * L'abonnement de l'entreprise, ou `null` — jamais un abonnement inventé.
 *
 * Une ligne `essai` en est un : celle que la porte pose à la création du
 * compte, sans carte, avec sa date de fin (`creation-compte.ts`).
 */
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
        modules: abonnements.modules,
        formulePrevue: abonnements.formulePrevue,
        periodicitePrevue: abonnements.periodicitePrevue,
        modulesPrevus: abonnements.modulesPrevus,
      })
      .from(abonnements)
      .where(eq(abonnements.entrepriseId, ctx.entrepriseId))
      .limit(1);
    // La base refuse déjà un module inconnu (0198) ; le filtre garde le type
    // honnête plutôt que d'affirmer ce que la colonne ne promet pas.
    return ligne
      ? { ...ligne, modules: ligne.modules.filter(estModule), modulesPrevus: ligne.modulesPrevus?.filter(estModule) ?? null }
      : null;
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
/**
 * L'ÉQUIPE COMPTÉE, le patron compris : tous les accès, ceux qui fabriquent,
 * les salariés. **Un seul comptage pour les trois**, d'une seule requête :
 * trois requêtes pourraient lire trois équipes différentes à une invitation
 * près, et la phrase de refus dirait un nombre faux.
 */
export async function compterLEquipe(ctx: Ctx): Promise<EquipeComptee> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        comptes: sql<number>`count(*)::int`,
        fabricants: sql<number>`(count(*) FILTER (WHERE ${inArray(membresEntreprise.role, ROLES_QUI_FABRIQUENT)}))::int`,
        salaries: sql<number>`(count(*) FILTER (WHERE ${eq(membresEntreprise.role, "salarie")}))::int`,
      })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId));
    return { comptes: ligne?.comptes ?? 0, fabricants: ligne?.fabricants ?? 0, salaries: ligne?.salaries ?? 0 };
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
  /** Relus sur l'abonnement du prestataire, comme la formule (`lireUnAbonnement`). */
  modules: ModuleCode[];
  periodicite: Periodicite;
  statut: StatutAbonnement;
  periodeFin: Date | null;
  annulationDemandee: boolean;
  clientPrestataire: string;
  abonnementPrestataire: string;
  /**
   * Le prestataire tient un calendrier pour cet abonnement : un changement
   * attend l'échéance. Sans calendrier, plus rien n'est prévu, et la ligne
   * l'oublie ; avec, elle garde ce que l'action y a noté
   * (`noterLeChangementPrevu`), que le prestataire ne redit pas.
   */
  changementPrevu: boolean;
};

function versLaLigne(etat: EtatVenuDuPrestataire) {
  return {
    formule: etat.formule,
    modules: etat.modules,
    periodicite: etat.periodicite,
    statut: etat.statut,
    periodeFin: etat.periodeFin,
    annulationDemandee: etat.annulationDemandee,
    clientPrestataire: etat.clientPrestataire,
    abonnementPrestataire: etat.abonnementPrestataire,
    ...(etat.changementPrevu ? {} : { formulePrevue: null, periodicitePrevue: null, modulesPrevus: null }),
    updatedAt: new Date(),
  };
}

/**
 * NOTER CE QUI COMMENCE À L'ÉCHÉANCE — après qu'il a confirmé une descente,
 * ou `null` quand il la retire (« Garder Entreprise »). C'est ce que l'état
 * affiche, et ce que le crochet reconnaîtra le jour où elle prend effet.
 */
export async function noterLeChangementPrevu(ctx: Ctx, prevu: Choix | null): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(abonnements)
      .set({
        formulePrevue: prevu?.formule ?? null,
        periodicitePrevue: prevu?.periodicite ?? null,
        modulesPrevus: prevu ? [...prevu.modules] : null,
        updatedAt: new Date(),
      })
      .where(eq(abonnements.entrepriseId, ctx.entrepriseId));
  });
}

/**
 * Les adhésions de l'entreprise, avec ce qu'il faut pour savoir lesquelles
 * partiraient avec une descente (`lesComptesQuiPartent`).
 */
export async function equipeDeLEntreprise(ctx: Ctx): Promise<{ id: string; role: Role; depuis: Date }[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ id: membresEntreprise.id, role: membresEntreprise.role, depuis: membresEntreprise.createdAt })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId))
  );
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
  await withEntreprise(
    ctx.utilisateurId,
    ctx.entrepriseId,
    async (tx) => {
      await tx
        .insert(abonnements)
        .values({ entrepriseId: ctx.entrepriseId, ...versLaLigne(etat) })
        .onConflictDoUpdate({ target: abonnements.entrepriseId, set: versLaLigne(etat) });
      await rouvrirSiRepris(tx, ctx.entrepriseId, etat);
    },
    // **La seule écriture permise en lecture seule.** C'est elle qui met fin à
    // l'essai terminé : sans cette porte, il paierait sans pouvoir rentrer.
    { pourSortirDeLEssai: true }
  );
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
 * **ET LA DESCENTE QU'IL A CONFIRMÉE PREND EFFET ICI**, le jour de l'échéance
 * (sa décision du 23 novembre 2026) : les accès en trop pour la formule qui
 * commence partent (`lesComptesQuiPartent`). Seulement quand la formule qui
 * arrive est celle qu'il avait notée en confirmant, sur la feuille qui le lui
 * annonçait : un premier abonnement, un retour de paiement ou une formule mal
 * lue ne retirent jamais personne.
 *
 * @returns `applique: false` quand l'abonnement est inconnu ou l'événement déjà
 *          traité : les deux valent un 200 pour le prestataire (rien à refaire).
 *          `photosOrphelines` : celles des accès retirés, à effacer du stockage
 *          une fois la transaction faite, comme `retirerUnAccesAction`.
 */
export async function appliquerDepuisLeCrochet(
  evenementId: string,
  typeEvenement: string,
  etat: EtatVenuDuPrestataire
): Promise<{ applique: boolean; comptesRetires: number; photosOrphelines: string[] }> {
  const rien = { applique: false, comptesRetires: 0, photosOrphelines: [] };
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.abonnement_prestataire', ${etat.abonnementPrestataire}, true)`);

    const [ligne] = await tx
      .select({
        entrepriseId: abonnements.entrepriseId,
        formule: abonnements.formule,
        periodicite: abonnements.periodicite,
        formulePrevue: abonnements.formulePrevue,
        periodicitePrevue: abonnements.periodicitePrevue,
        modulesPrevus: abonnements.modulesPrevus,
      })
      .from(abonnements)
      .where(eq(abonnements.abonnementPrestataire, etat.abonnementPrestataire))
      .limit(1);

    // **Un abonnement inconnu ne se CRÉE pas ici**, et c'est délibéré : la
    // seule chose que le crochet sait alors, c'est un identifiant que nous
    // n'avons jamais vu. Créer une entreprise ou en deviner une à partir de là
    // serait exactement l'inverse de l'isolation.
    if (!ligne) return rien;

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
    if (consigne.length === 0) return rien;

    await tx
      .update(abonnements)
      .set(versLaLigne(etat))
      .where(eq(abonnements.abonnementPrestataire, etat.abonnementPrestataire));
    // Les deux chemins, et pas seulement le retour du paiement : il peut payer
    // puis fermer l'onglet, et seul le crochet saura alors qu'il est revenu.
    await rouvrirSiRepris(tx, ligne.entrepriseId, etat);

    // La FORMULE change, et c'est celle qu'il a notée, avec son rythme et ses
    // modules : seul un changement de formule retire des accès, jamais le
    // rythme ni les outils.
    const descenteQuiPrendEffet =
      etat.statut === "actif" &&
      ligne.formulePrevue === etat.formule &&
      ligne.periodicitePrevue === etat.periodicite &&
      memesModules((ligne.modulesPrevus ?? []).filter(estModule), etat.modules) &&
      ligne.formule !== etat.formule;
    if (!descenteQuiPrendEffet) return { applique: true, comptesRetires: 0, photosOrphelines: [] };

    const equipe = await tx
      .select({ id: membresEntreprise.id, role: membresEntreprise.role, depuis: membresEntreprise.createdAt })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.entrepriseId, ligne.entrepriseId))
      .orderBy(asc(membresEntreprise.createdAt));
    const partent = lesComptesQuiPartent(equipe, etat.formule);
    if (partent.length === 0) return { applique: true, comptesRetires: 0, photosOrphelines: [] };

    // L'ADHÉSION seulement, comme `retirerUnAcces` : le compte, ses devis et
    // ses factures restent à l'entreprise.
    const retires = await tx
      .delete(membresEntreprise)
      .where(and(eq(membresEntreprise.entrepriseId, ligne.entrepriseId), inArray(membresEntreprise.id, partent)))
      .returning({ photo: membresEntreprise.photoStorageKey });
    return {
      applique: true,
      comptesRetires: retires.length,
      photosOrphelines: retires.map((r) => r.photo).filter((p): p is string => typeof p === "string"),
    };
  });
}

/**
 * Retire la fermeture d'un compte dont l'abonnement reprend
 * (`abonnementRouvreLeCompte`). Ce que la purge a effacé ne revient pas.
 */
async function rouvrirSiRepris(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  etat: EtatVenuDuPrestataire
): Promise<void> {
  if (!abonnementRouvreLeCompte(etat)) return;
  await tx
    .update(entreprises)
    .set({ fermetureDemandeeLe: null, fermetureLe: null, resteEffaceLe: null, prevenuLe: null })
    .where(and(eq(entreprises.id, entrepriseId), sql`${entreprises.fermetureLe} IS NOT NULL`));
}
