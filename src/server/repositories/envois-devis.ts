import { randomBytes, createHash } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, devis, envoisDevis, lignesDevis } from "../db/schema";
import type { Ctx } from "./context";
import {
  dateRetenable,
  fenetreProposition,
  motifRefusDate,
  versJourIso,
  type JourIso,
  type MotifRefusDate,
} from "../disponibilites";

// Envoi d'un devis au client et recueil de sa réponse — docs/AGENT.md §2.1
// à §2.2 ter.

/** Durée de vie d'un lien. Au-delà, la page ne répond plus. */
export const VALIDITE_LIEN_JOURS = 45;

/**
 * Jeton du lien public : 256 bits d'aléa cryptographique, encodés sans
 * caractère ambigu pour l'URL.
 *
 * Jamais dérivé d'un identifiant existant — sinon un seul lien reçu rendrait
 * les autres devinables.
 */
export function genererJeton(): string {
  return randomBytes(32).toString("base64url");
}

/** Empreinte du devis exact envoyé — ce que le client accepte réellement. */
export function empreinteDevis(contenu: string): string {
  return createHash("sha256").update(contenu, "utf8").digest("hex");
}

export type CanalCommunication = "sms" | "email";

/**
 * Jours déjà occupés par un chantier planifié, sur une fenêtre bornée.
 *
 * Ne renvoie que des dates. Volontairement : c'est cette liste qui est
 * transmise à la page publique.
 */
export async function joursOccupes(
  ctx: Ctx,
  debut: JourIso,
  fin: JourIso
): Promise<JourIso[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ jour: chantiers.datePlanifiee })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          gte(chantiers.datePlanifiee, debut),
          lte(chantiers.datePlanifiee, fin)
        )
      );
    return lignes.map((l) => l.jour).filter((j): j is string => j !== null);
  });
}

export type CreationEnvoi = {
  chantierId: string;
  devisId: string;
  canal: CanalCommunication;
  /** Une ou deux dates — la forme est tranchée par le patron à la validation. */
  datesProposees: JourIso[];
  contenuDevis: string;
};

export class DatesProposeesInvalidesError extends Error {
  constructor(public readonly motifs: { date: JourIso; motif: MotifRefusDate }[]) {
    super(`Dates proposées invalides : ${motifs.map((m) => `${m.date} (${m.motif})`).join(", ")}`);
    this.name = "DatesProposeesInvalidesError";
  }
}

/**
 * Crée l'envoi et son jeton.
 *
 * Les dates proposées sont validées ici, contre les mêmes règles que celles
 * appliquées à la contre-proposition du client : proposer un jour déjà occupé
 * relancerait précisément l'aller-retour que tout ce parcours supprime.
 */
export async function creerEnvoi(
  ctx: Ctx,
  creation: CreationEnvoi,
  maintenant: Date = new Date()
) {
  if (creation.datesProposees.length < 1 || creation.datesProposees.length > 2) {
    throw new Error("Il faut proposer une ou deux dates.");
  }

  const fenetre = fenetreProposition(maintenant);
  const occupes = await joursOccupes(ctx, fenetre.debut, fenetre.fin);

  const motifs = creation.datesProposees
    .map((date) => ({ date, motif: motifRefusDate(date, occupes, fenetre) }))
    .filter((m): m is { date: JourIso; motif: MotifRefusDate } => m.motif !== null);
  if (motifs.length > 0) throw new DatesProposeesInvalidesError(motifs);

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const expireAt = new Date(maintenant.getTime() + VALIDITE_LIEN_JOURS * 86400_000);
    const [envoi] = await tx
      .insert(envoisDevis)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId: creation.chantierId,
        devisId: creation.devisId,
        jeton: genererJeton(),
        expireAt,
        canal: creation.canal,
        datesProposees: creation.datesProposees,
        empreinteDevis: empreinteDevis(creation.contenuDevis),
      })
      .returning();

    // Le chantier passe « en attente de réponse » : ni planifié, ni facturable.
    await tx
      .update(chantiers)
      .set({ devisEnvoyeAt: maintenant, updatedAt: maintenant })
      .where(and(eq(chantiers.id, creation.chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)));

    return envoi;
  });
}

/**
 * Ce que la page publique reçoit — et rien de plus.
 *
 * Le devis, ses lignes, l'entreprise qui l'émet et le client concerné : autant
 * d'informations que ce client détient déjà, ou qui lui sont destinées. En
 * revanche, aucun autre chantier, aucun autre client, aucun historique de prix,
 * et des jours occupés réduits à des DATES.
 */
export type EnvoiPourClient = {
  id: string;
  jeton: string;
  devisId: string;
  chantierId: string;
  datesProposees: JourIso[];
  /** Jours indisponibles dans la fenêtre — des dates, rien d'autre. */
  joursOccupes: JourIso[];
  fenetre: { debut: JourIso; fin: JourIso };
  reponse: "acceptee" | "refusee" | null;
  dateRetenue: JourIso | null;
  expire: boolean;
  devis: {
    numeroCommercial: string;
    dateEmission: string;
    totalHt: string;
    totalTva: string;
    totalTtc: string;
    tauxTva: string;
    entrepriseNom: string;
    clientNom: string | null;
    adresseChantier: string | null;
    lignes: { libelle: string; quantite: string; prixUnitaire: string; montant: string }[];
  };
};

/**
 * Lecture par jeton, pour la page publique.
 *
 * Contourne withEntreprise() — le client n'a pas de session, donc pas
 * d'entrepriseId. L'accès est borné par la politique RLS dédiée au jeton
 * (migration 0015) : sans jeton exact, aucune ligne. Aucune énumération
 * n'est possible.
 */
export async function lireParJeton(
  jeton: string,
  maintenant: Date = new Date()
): Promise<EnvoiPourClient | null> {
  if (!jeton) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);

    const [envoi] = await tx
      .select()
      .from(envoisDevis)
      .where(eq(envoisDevis.jeton, jeton))
      .limit(1);
    if (!envoi) return null;

    const expire = envoi.expireAt.getTime() <= maintenant.getTime();
    const fenetre = fenetreProposition(maintenant);

    // Les jours occupés sont lus ici, dans le contexte de l'entreprise
    // propriétaire de l'envoi — jamais depuis une entrée du client.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
    const lignes = await tx
      .select({ jour: chantiers.datePlanifiee })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, envoi.entrepriseId),
          isNull(chantiers.deletedAt),
          gte(chantiers.datePlanifiee, fenetre.debut),
          lte(chantiers.datePlanifiee, fenetre.fin)
        )
      );

    const [d] = await tx.select().from(devis).where(eq(devis.id, envoi.devisId)).limit(1);
    if (!d) return null;

    const lignesDevisRows = await tx
      .select({
        libelle: lignesDevis.libelle,
        quantite: lignesDevis.quantite,
        prixUnitaire: lignesDevis.prixUnitaire,
        montant: lignesDevis.montant,
        ordre: lignesDevis.ordre,
      })
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, envoi.devisId))
      .orderBy(asc(lignesDevis.ordre));

    return {
      id: envoi.id,
      jeton: envoi.jeton,
      devisId: envoi.devisId,
      chantierId: envoi.chantierId,
      datesProposees: envoi.datesProposees,
      joursOccupes: lignes.map((l) => l.jour).filter((j): j is string => j !== null),
      fenetre,
      reponse: envoi.reponse,
      dateRetenue: envoi.dateRetenue,
      expire,
      devis: {
        numeroCommercial: d.numeroCommercial,
        dateEmission: d.dateEmission,
        totalHt: d.totalHt,
        totalTva: d.totalTva,
        totalTtc: d.totalTtc,
        tauxTva: d.tauxTva,
        entrepriseNom: d.entrepriseNom,
        clientNom: d.clientNom,
        adresseChantier: d.adresseChantier,
        lignes: lignesDevisRows.map(({ libelle, quantite, prixUnitaire, montant }) => ({
          libelle,
          quantite,
          prixUnitaire,
          montant,
        })),
      },
    };
  });
}

export type ReponseClient = {
  accepte: boolean;
  /** Requise si accepte : l'une des dates proposées, ou une contre-proposition. */
  dateRetenue?: JourIso;
  precision?: string | null;
  demarrageAnticipe?: boolean;
  adresseIp?: string | null;
  agentUtilisateur?: string | null;
};

export type ResultatReponse =
  | { succes: true; dateRetenue: JourIso | null; contreProposee: boolean }
  | { succes: false; motif: "introuvable" | "expire" | "deja_repondu" | "date_indisponible" | "date_manquante" };

/**
 * Enregistre la réponse du client.
 *
 * La disponibilité est REVÉRIFIÉE ici, jamais tenue pour acquise depuis
 * l'affichage : des heures peuvent séparer l'ouverture de la page du clic, et
 * deux clients pourraient viser le même jour. Sans cette revérification,
 * l'aller-retour supprimé reviendrait en pire — après coup, quand le patron
 * croit son planning fait.
 *
 * Si la date vient d'être prise, l'acceptation du devis n'est PAS perdue pour
 * autant côté produit : l'appelant doit redemander une date, le prix ne
 * dépendant pas du calendrier (docs/AGENT.md §2.2 bis).
 */
export async function enregistrerReponse(
  jeton: string,
  reponse: ReponseClient,
  maintenant: Date = new Date()
): Promise<ResultatReponse> {
  if (!jeton) return { succes: false, motif: "introuvable" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);

    const [envoi] = await tx
      .select()
      .from(envoisDevis)
      .where(eq(envoisDevis.jeton, jeton))
      .limit(1);
    if (!envoi) return { succes: false, motif: "introuvable" as const };
    if (envoi.reponse !== null) return { succes: false, motif: "deja_repondu" as const };
    if (envoi.expireAt.getTime() <= maintenant.getTime()) {
      return { succes: false, motif: "expire" as const };
    }

    if (!reponse.accepte) {
      await tx
        .update(envoisDevis)
        .set({
          reponse: "refusee",
          responduAt: maintenant,
          precisionClient: reponse.precision ?? null,
          adresseIp: reponse.adresseIp ?? null,
          agentUtilisateur: reponse.agentUtilisateur ?? null,
        })
        .where(eq(envoisDevis.jeton, jeton));
      return { succes: true as const, dateRetenue: null, contreProposee: false };
    }

    const date = reponse.dateRetenue;
    if (!date) return { succes: false, motif: "date_manquante" as const };

    const contreProposee = !envoi.datesProposees.includes(date);

    // Revérification côté serveur — la seule qui fasse foi.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
    const fenetre = fenetreProposition(maintenant);
    const lignes = await tx
      .select({ jour: chantiers.datePlanifiee })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, envoi.entrepriseId),
          isNull(chantiers.deletedAt),
          gte(chantiers.datePlanifiee, fenetre.debut),
          lte(chantiers.datePlanifiee, fenetre.fin)
        )
      );
    const occupes = lignes.map((l) => l.jour).filter((j): j is string => j !== null);

    if (!dateRetenable(date, occupes, fenetre)) {
      return { succes: false, motif: "date_indisponible" as const };
    }

    await tx
      .update(envoisDevis)
      .set({
        reponse: "acceptee",
        responduAt: maintenant,
        dateRetenue: date,
        dateContreProposee: contreProposee,
        precisionClient: reponse.precision ?? null,
        demarrageAnticipe: reponse.demarrageAnticipe ?? false,
        adresseIp: reponse.adresseIp ?? null,
        agentUtilisateur: reponse.agentUtilisateur ?? null,
      })
      .where(eq(envoisDevis.jeton, jeton));

    // Le chantier est débloqué et planifié à la date retenue.
    await tx
      .update(chantiers)
      .set({ datePlanifiee: date, updatedAt: maintenant })
      .where(
        and(eq(chantiers.id, envoi.chantierId), eq(chantiers.entrepriseId, envoi.entrepriseId))
      );

    return { succes: true as const, dateRetenue: date, contreProposee };
  });
}

/** Envois sans réponse — la liste « en attente », du plus ancien au plus récent. */
export async function envoisEnAttente(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select()
      .from(envoisDevis)
      .where(and(eq(envoisDevis.entrepriseId, ctx.entrepriseId), isNull(envoisDevis.reponse)))
      .orderBy(asc(envoisDevis.envoyeAt))
  );
}

/**
 * Réponses que le patron n'a pas encore vues — refus comme dates
 * contre-proposées. C'est la source de la notification « devis retourné ».
 */
export async function reponsesNonVues(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select()
      .from(envoisDevis)
      .where(
        and(
          eq(envoisDevis.entrepriseId, ctx.entrepriseId),
          isNull(envoisDevis.vuParPatronAt),
          sql`${envoisDevis.reponse} IS NOT NULL`
        )
      )
      .orderBy(desc(envoisDevis.responduAt))
  );
}

/**
 * Le dernier envoi d'un chantier, ou `null` s'il n'en a jamais eu.
 *
 * Le dernier, et lui seul : un devis refusé puis corrigé et renvoyé laisse
 * plusieurs envois derrière lui. Les précédents racontent la négociation ; c'est
 * le dernier qui dit où en est le devis aujourd'hui.
 */
export async function dernierEnvoi(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .select()
      .from(envoisDevis)
      .where(
        and(eq(envoisDevis.chantierId, chantierId), eq(envoisDevis.entrepriseId, ctx.entrepriseId))
      )
      .orderBy(desc(envoisDevis.envoyeAt))
      .limit(1);
    return row ?? null;
  });
}

export type NotificationPatron = {
  envoiId: string;
  chantierId: string;
  chantierNom: string;
  reponse: "acceptee" | "refusee";
  responduAt: Date | null;
  dateRetenue: string | null;
  dateContreProposee: boolean;
};

/**
 * Ce que le patron doit apprendre, avec de quoi le lui dire.
 *
 * `reponsesNonVues` ne renvoie que des envois : un identifiant de chantier ne
 * fait pas une notification lisible. On y joint le nom, parce qu'une alerte qui
 * oblige à ouvrir une fiche pour savoir de quoi elle parle ne sera pas lue.
 *
 * Deux nouvelles y passent : un refus — le devis est retourné, il peut être
 * repris — et une acceptation sur une date que le client a proposée lui-même.
 * La seconde n'est pas un problème, mais elle change l'agenda du patron sans
 * qu'il ait rien décidé : il doit le savoir.
 */
export async function notificationsPatron(ctx: Ctx): Promise<NotificationPatron[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        envoiId: envoisDevis.id,
        chantierId: envoisDevis.chantierId,
        chantierNom: chantiers.nom,
        reponse: envoisDevis.reponse,
        responduAt: envoisDevis.responduAt,
        dateRetenue: envoisDevis.dateRetenue,
        dateContreProposee: envoisDevis.dateContreProposee,
      })
      .from(envoisDevis)
      .innerJoin(chantiers, eq(envoisDevis.chantierId, chantiers.id))
      .where(
        and(
          eq(envoisDevis.entrepriseId, ctx.entrepriseId),
          isNull(envoisDevis.vuParPatronAt),
          isNull(chantiers.deletedAt),
          sql`${envoisDevis.reponse} IS NOT NULL`,
          // Une acceptation sur l'une des dates proposées ne surprend personne :
          // c'est le déroulement attendu. La signaler noierait les deux nouvelles
          // qui, elles, appellent quelque chose.
          sql`(${envoisDevis.reponse} = 'refusee' OR ${envoisDevis.dateContreProposee})`
        )
      )
      .orderBy(desc(envoisDevis.responduAt));

    return rows.map((r) => ({ ...r, reponse: r.reponse as "acceptee" | "refusee" }));
  });
}

/** Marque une réponse comme lue par le patron. */
export async function marquerReponseVue(ctx: Ctx, envoiId: string, maintenant: Date = new Date()) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(envoisDevis)
      .set({ vuParPatronAt: maintenant })
      .where(and(eq(envoisDevis.id, envoiId), eq(envoisDevis.entrepriseId, ctx.entrepriseId)));
  });
}

/** Jour du jour, au format des dates de la base — utile aux appelants. */
export function aujourdHuiIso(maintenant: Date = new Date()): JourIso {
  return versJourIso(maintenant);
}
