import { randomBytes, createHash } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, devis, entreprises, envoisDevis, lignesDevis } from "../db/schema";
import type { Ctx } from "./context";
import { lireObjet } from "../storage";
import {
  compterOccupation,
  departPossible,
  dureeEnDemiJournees,
  fenetrePatron,
  fenetrePourDates,
  bandesVisibles,
  jourRetenable,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  versJourIso,
  type ChantierPlanifie,
  type FenetreProposition,
  type JourIso,
  type Moment,
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

/**
 * Ce que les chantiers déjà posés occupent, à la demi-journée près, et de
 * combien d'équipes dispose l'entreprise.
 *
 * Une seule requête pour les trois chemins qui doivent dire la même chose :
 * l'écran d'envoi, la création de l'envoi, et la revérification de la réponse
 * du client. `exclureChantierId` évite qu'un chantier se refuse sa propre date
 * lors d'un renvoi.
 *
 * `tx` est passé de l'extérieur parce que deux de ces chemins n'ont pas de
 * session : la page du client pose son contexte par jeton (voir `lireParJeton`).
 */
async function contrainteDuPlanning(
  tx: DbOrTx,
  entrepriseId: string,
  fenetre: FenetreProposition,
  exclureChantierId?: string
): Promise<{ occupation: Map<string, number>; nombreEquipes: number }> {
  const lignes = await tx
    .select({
      id: chantiers.id,
      jour: chantiers.datePlanifiee,
      moment: chantiers.creneauDebut,
      duree: chantiers.dureeDemiJournees,
    })
    .from(chantiers)
    .where(
      and(
        eq(chantiers.entrepriseId, entrepriseId),
        isNull(chantiers.deletedAt),
        gte(chantiers.datePlanifiee, fenetre.debut),
        lte(chantiers.datePlanifiee, fenetre.fin)
      )
    );

  const planifies: ChantierPlanifie[] = lignes
    .filter((l) => l.jour !== null && l.id !== exclureChantierId)
    .map((l) => ({
      jour: l.jour as JourIso,
      moment: l.moment === "matin" || l.moment === "apres_midi" ? l.moment : null,
      dureeDemiJournees: l.duree,
    }));

  const [entreprise] = await tx
    .select({ nombreEquipes: entreprises.nombreEquipes })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);

  return { occupation: compterOccupation(planifies), nombreEquipes: entreprise?.nombreEquipes ?? 1 };
}

export type CreationEnvoi = {
  chantierId: string;
  devisId: string;
  canal: CanalCommunication;
  /** Une ou deux dates — la forme est tranchée par le patron à la validation. */
  datesProposees: JourIso[];
  contenuDevis: string;
  /**
   * Durée à réserver, en demi-journées. Absente : elle se déduit de la dictée,
   * et à défaut vaut une journée entière.
   */
  dureeDemiJournees?: number;
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

  // **Deux fenêtres, et les confondre était le défaut.** Celle du patron va à
  // dix-huit mois — c'est elle qui dit si sa date est recevable. Celle du
  // client, plus étroite, est ce qu'il verra : elle est calculée à partir des
  // dates retenues, puis FIGÉE (voir `fenetrePourDates` et migration 0027).
  const horizon = fenetrePatron(maintenant);
  const fenetreClient = fenetrePourDates(maintenant, creation.datesProposees);

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // L'occupation se lit sur l'union des deux : une date à six mois doit être
    // vérifiable, et les jours occupés montrés au client doivent l'être aussi.
    const fenetreOccupation = {
      debut: horizon.debut < fenetreClient.debut ? horizon.debut : fenetreClient.debut,
      fin: horizon.fin > fenetreClient.fin ? horizon.fin : fenetreClient.fin,
    };
    const { occupation, nombreEquipes } = await contrainteDuPlanning(
      tx,
      ctx.entrepriseId,
      fenetreOccupation,
      creation.chantierId
    );

    // La durée que ce chantier réservera. Le patron a pu la corriger à l'écran ;
    // sinon elle se déduit de sa dictée, et à défaut vaut une journée.
    const [chantier] = await tx
      .select({ dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(and(eq(chantiers.id, creation.chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    const duree =
      creation.dureeDemiJournees ??
      dureeEnDemiJournees(chantier?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    const motifs = creation.datesProposees
      .map((date) => ({
        date,
        motif: jourRetenable(date, duree, occupation, nombreEquipes, horizon)
          ? null
          : date < horizon.debut || date > horizon.fin
            ? ("hors_fenetre" as const)
            : ("jour_occupe" as const),
      }))
      .filter((m): m is { date: JourIso; motif: MotifRefusDate } => m.motif !== null);
    if (motifs.length > 0) throw new DatesProposeesInvalidesError(motifs);

    const expireAt = new Date(maintenant.getTime() + VALIDITE_LIEN_JOURS * 86400_000);
    const [envoi] = await tx
      .insert(envoisDevis)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId: creation.chantierId,
        devisId: creation.devisId,
        jeton: genererJeton(),
        expireAt,
        // **Posé explicitement, et pas laissé au `now()` de la base.** C'est
        // désormais l'ANCRE de la fenêtre montrée au client : la laisser
        // diverger de `maintenant` ferait calculer les bandes autour d'un autre
        // jour que celui où les dates ont été validées — et un envoi rejoué
        // dans le passé (une suite de tests, une reprise) verrait ses propres
        // dates tomber hors fenêtre.
        envoyeAt: maintenant,
        canal: creation.canal,
        datesProposees: creation.datesProposees,
        empreinteDevis: empreinteDevis(creation.contenuDevis),
      })
      .returning();

    // Le chantier passe « en attente de réponse » : ni planifié, ni facturable.
    // La durée réservée est écrite maintenant : c'est elle qui servira à poser
    // le créneau quand le client aura choisi sa date, et elle doit être celle
    // sur laquelle les dates proposées ont été calculées — pas celle qu'une
    // dictée modifiée entre-temps donnerait.
    await tx
      .update(chantiers)
      .set({ devisEnvoyeAt: maintenant, dureeDemiJournees: duree, updatedAt: maintenant })
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
  reponse: "acceptee" | "refusee" | "correction" | null;
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

    // **La fenêtre s'ancre au jour de l'ENVOI, jamais à aujourd'hui.**
    //
    // Recalculée depuis la date du jour, elle glissait sous les pieds du
    // client : un devis parti un lundi et ouvert trois semaines plus tard
    // n'offrait plus les mêmes jours. Le défaut ne se voyait pas tant qu'on ne
    // proposait qu'à quelques jours ; avec une date à six mois, elle serait
    // carrément sortie de la fenêtre — le client aurait lu « plus disponible »
    // pour un jour que personne n'avait pris.
    //
    // `envoyeAt` et `datesProposees` sont tous deux immuables : la fenêtre se
    // recalcule donc à l'identique à chaque ouverture, sans colonne de plus.
    // Réserve assumée : changer la règle des bandes déplacerait ce que voient
    // les liens déjà partis. C'est le prix d'une seule source de vérité, et il
    // est plus faible que celui de deux qui divergent (`CLAUDE.md` §3).
    const bandes = bandesVisibles(envoi.envoyeAt, envoi.datesProposees);
    const fenetre: FenetreProposition = {
      debut: bandes[0].debut,
      fin: bandes[bandes.length - 1].fin,
    };

    // Les jours occupés sont lus ici, dans le contexte de l'entreprise
    // propriétaire de l'envoi — jamais depuis une entrée du client.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
    const { occupation, nombreEquipes } = await contrainteDuPlanning(
      tx,
      envoi.entrepriseId,
      fenetre,
      envoi.chantierId
    );
    const [chantierRow] = await tx
      .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(eq(chantiers.id, envoi.chantierId))
      .limit(1);
    const dureeReservee =
      chantierRow?.duree ??
      dureeEnDemiJournees(chantierRow?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    // Les jours où CE chantier ne tient pas — des dates, et rien d'autre.
    // Le client ne saura jamais qu'un 6 août refusé l'est parce que le matin est
    // pris, ni qu'un autre l'est parce que les deux équipes sont sorties : c'est
    // la consigne du patron, et c'est aussi ce qu'il apprendrait au téléphone.
    // **Seulement les jours des BANDES, jamais tout l'intervalle.**
    //
    // « Soit jeudi, soit à la Toussaint » fait courir la fenêtre sur six mois —
    // il le faut, pour que les deux dates restent retenables. Énumérer les
    // jours occupés de bout en bout aurait alors livré un semestre de carnet de
    // commandes à quelqu'un qui n'a rien signé. Le client voit donc les trois
    // prochains mois ET les trois semaines autour de la Toussaint ; le milieu
    // ne le regarde pas.
    const joursSansPlace: JourIso[] = [];
    for (const bande of bandes) {
      for (let d = 0; ; d++) {
        const jour = versJourIso(new Date(new Date(`${bande.debut}T12:00:00Z`).getTime() + d * 86_400_000));
        if (jour > bande.fin) break;
        if (!jourRetenable(jour, dureeReservee, occupation, nombreEquipes, fenetre)) {
          joursSansPlace.push(jour);
        }
      }
    }

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
      joursOccupes: joursSansPlace,
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

/**
 * Le PDF du devis, servi au client par son jeton — sans compte.
 *
 * **Pourquoi cette fonction existe.** Le patron a demandé que sa page ne montre
 * que les trois totaux, « de toute façon le client aura le détail dans le PDF
 * joint au mail ». Or rien n'est joint : le partage n'envoie que du texte, et un
 * `mailto:` ne peut porter aucune pièce. Le client ne reçoit qu'un **lien**.
 *
 * Sans ce chemin, retirer le détail de la page l'aurait laissé accepter un
 * total sans pouvoir consulter ce qu'il paie nulle part — alors que son accord
 * porte sur le contenu exact, et qu'un devis de travaux doit détailler chaque
 * prestation (arrêté du 2 mars 1990).
 *
 * **Mêmes garanties que la page** : le jeton pose le contexte RLS, un lien
 * expiré ne rend rien, et seul le PDF **archivé à l'envoi** est servi — jamais
 * une reconstruction, qui pourrait ne plus être la pièce acceptée.
 */
export async function pdfDevisParJeton(
  jeton: string,
  maintenant: Date = new Date()
): Promise<{ octets: Buffer; nom: string } | null> {
  if (!jeton) return null;

  const cle = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    const [envoi] = await tx
      .select()
      .from(envoisDevis)
      .where(eq(envoisDevis.jeton, jeton))
      .limit(1);
    if (!envoi) return null;
    if (envoi.expireAt.getTime() <= maintenant.getTime()) return null;

    const [d] = await tx.select().from(devis).where(eq(devis.id, envoi.devisId)).limit(1);
    if (!d?.pdfStorageKey) return null;
    return { storageKey: d.pdfStorageKey, numero: d.numeroCommercial };
  });

  if (!cle) return null;
  try {
    return { octets: await lireObjet(cle.storageKey), nom: `devis-${cle.numero}.pdf` };
  } catch {
    // Le fichier a disparu du stockage : on le dit par un 404, sans reconstruire
    // un document qui ne serait plus celui que le client a reçu.
    return null;
  }
}

export type ReponseClient = {
  /**
   * Ce que le client a décidé.
   *
   * `correction` est la troisième issue, celle qui manquait : il veut le même
   * devis, corrigé. Sans elle, un client qui repère une coquille touche
   * « Je ne donne pas suite », et le patron lit un refus.
   */
  decision: "accepte" | "refuse" | "correction";
  /** Requise si accepte : l'une des dates proposées, ou une contre-proposition. */
  dateRetenue?: JourIso;
  precision?: string | null;
  demarrageAnticipe?: boolean;
  adresseIp?: string | null;
  agentUtilisateur?: string | null;
};

export type ResultatReponse =
  | { succes: true; dateRetenue: JourIso | null; contreProposee: boolean }
  | {
      succes: false;
      motif:
        | "introuvable"
        | "expire"
        | "deja_repondu"
        | "date_indisponible"
        | "date_manquante"
        | "message_manquant";
    };

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

    // Une correction demandée sans message ne dit rien au patron : il saurait
    // qu'il y a un problème sans savoir lequel, et devrait rappeler son client —
    // exactement l'aller-retour que ce parcours supprime. La base le refuse
    // aussi (contrainte 0020) ; ici on le dit avec des mots.
    const precision = reponse.precision?.trim() || null;
    if (reponse.decision === "correction" && !precision) {
      return { succes: false, motif: "message_manquant" as const };
    }

    if (reponse.decision !== "accepte") {
      await tx
        .update(envoisDevis)
        .set({
          reponse: reponse.decision === "correction" ? "correction" : "refusee",
          responduAt: maintenant,
          precisionClient: precision,
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
    //
    // **Contre la fenêtre de l'ENVOI, pas celle d'aujourd'hui.** C'est le même
    // ancrage que la lecture du lien, et il n'est pas facultatif : validée
    // contre une fenêtre glissante de trois mois, une date à six mois se serait
    // fait refuser « date indisponible » — au client qui accepte la date que le
    // patron vient de lui proposer. Le devis se serait perdu là, sans que
    // personne comprenne pourquoi.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
    const fenetre = fenetrePourDates(envoi.envoyeAt, envoi.datesProposees);
    const { occupation, nombreEquipes } = await contrainteDuPlanning(
      tx,
      envoi.entrepriseId,
      fenetre,
      envoi.chantierId
    );

    const [chantierRow] = await tx
      .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(eq(chantiers.id, envoi.chantierId))
      .limit(1);
    const duree =
      chantierRow?.duree ??
      dureeEnDemiJournees(chantierRow?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    if (!jourRetenable(date, duree, occupation, nombreEquipes, fenetre)) {
      return { succes: false, motif: "date_indisponible" as const };
    }

    // Le créneau est décidé ici, jamais par le client : il choisit un jour, le
    // planning choisit la demi-journée. C'est la consigne du patron — « mon
    // client ne doit pas être informé de la demi-journée ».
    const moment: Moment = departPossible(date, duree, occupation, nombreEquipes) ?? "matin";

    await tx
      .update(envoisDevis)
      .set({
        reponse: "acceptee",
        responduAt: maintenant,
        dateRetenue: date,
        dateContreProposee: contreProposee,
        precisionClient: precision,
        demarrageAnticipe: reponse.demarrageAnticipe ?? false,
        adresseIp: reponse.adresseIp ?? null,
        agentUtilisateur: reponse.agentUtilisateur ?? null,
      })
      .where(eq(envoisDevis.jeton, jeton));

    // Le chantier est débloqué et planifié à la date retenue, sur le créneau
    // que le planning vient de lui trouver.
    await tx
      .update(chantiers)
      .set({ datePlanifiee: date, creneauDebut: moment, dureeDemiJournees: duree, updatedAt: maintenant })
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
  reponse: "acceptee" | "refusee" | "correction";
  responduAt: Date | null;
  dateRetenue: string | null;
  dateContreProposee: boolean;
  /**
   * Ce que le client a écrit. Il était enregistré depuis le début et
   * **n'apparaissait sur aucun écran** : le patron voyait « le client n'a pas
   * donné suite » sans jamais lire pourquoi.
   */
  precisionClient: string | null;
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
        precisionClient: envoisDevis.precisionClient,
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
          sql`(${envoisDevis.reponse} IN ('refusee', 'correction') OR ${envoisDevis.dateContreProposee}
               OR ${envoisDevis.precisionClient} IS NOT NULL)`
        )
      )
      .orderBy(desc(envoisDevis.responduAt));

    return rows.map((r) => ({ ...r, reponse: r.reponse as "acceptee" | "refusee" | "correction" }));
  });
}

export type EnvoiCaduc = {
  envoiId: string;
  chantierId: string;
  chantierNom: string;
  envoyeAt: Date;
  expireAt: Date;
};

/**
 * Les devis dont le lien a expiré sans que le client dise quoi que ce soit.
 *
 * Ni oui, ni non : juste le temps qui a passé. Sans cette liste, le patron ne
 * l'apprend qu'en ouvrant la fiche du chantier — c'est-à-dire jamais, puisque
 * rien ne l'y ramène. Le devis dort, et le chantier avec lui.
 */
export async function envoisCaducs(
  ctx: Ctx,
  maintenant: Date = new Date()
): Promise<EnvoiCaduc[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        envoiId: envoisDevis.id,
        chantierId: envoisDevis.chantierId,
        chantierNom: chantiers.nom,
        envoyeAt: envoisDevis.envoyeAt,
        expireAt: envoisDevis.expireAt,
      })
      .from(envoisDevis)
      .innerJoin(chantiers, eq(envoisDevis.chantierId, chantiers.id))
      .where(
        and(
          eq(envoisDevis.entrepriseId, ctx.entrepriseId),
          isNull(envoisDevis.reponse),
          isNull(envoisDevis.vuParPatronAt),
          isNull(chantiers.deletedAt),
          lte(envoisDevis.expireAt, maintenant)
        )
      )
      .orderBy(asc(envoisDevis.expireAt))
  );
}

/**
 * Marque l'issue d'un envoi comme connue du patron.
 *
 * Sert aux réponses du client comme aux liens expirés : dans les deux cas, ce
 * qu'on note est que le patron a pris connaissance de ce qu'est devenu son
 * devis. Le nom de la colonne (`vu_par_patron_at`) dit exactement cela.
 */
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
