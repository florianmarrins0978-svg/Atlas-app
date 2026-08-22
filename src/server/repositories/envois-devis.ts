import { randomBytes, createHash } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { fusionnerOccupationExterne, type PeriodeOccupee } from "../../lib/agenda-externe";
import { fusionnerAbsences } from "../../lib/absences-equipe";
import {
  periodesOccupeesExterieures,
  periodesOccupeesPourEntreprise,
} from "./agendas-externes";
import { configurationGoogle } from "../agenda/google";
import { absencesEquipe, chantiers, devis, entreprises, envoisDevis, lignesDevis } from "../db/schema";
import type { Ctx } from "./context";
import { encoreEnCoursDepuis, equipesParChantier } from "./occupation-chantiers";
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
  exclureChantierId?: string,
  /**
   * Les rendez-vous de l'agenda extérieur, s'il y en a un.
   *
   * Passés de l'extérieur, jamais lus ici : cette fonction tourne DANS une
   * transaction, et un appel HTTP à Google en tiendrait une ouverte pendant
   * toute la durée d'un service qu'on ne maîtrise pas. L'appelant les lit
   * avant d'ouvrir la sienne.
   */
  periodesExterieures: readonly PeriodeOccupee[] = []
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
        // **La borne qui garde le planning.** C'est cette occupation-ci qui
        // revérifie la réponse du client : bornée sur la date de départ, elle
        // laissait passer un chantier commencé avant la fenêtre et encore en
        // cours dedans — donc deux chantiers le même jour, sans que rien ne
        // s'en aperçoive avant le terrain (`encoreEnCoursDepuis`).
        encoreEnCoursDepuis(fenetre.debut),
        lte(chantiers.datePlanifiee, fenetre.fin)
      )
    );

  // Les équipes cochées comptent dans la place prise : sans elles, un jour où
  // ses deux équipes travaillent déjà partirait chez un client (22 août 2026).
  const equipes = await equipesParChantier(tx, entrepriseId);
  const planifies: ChantierPlanifie[] = lignes
    .filter((l) => l.jour !== null && l.id !== exclureChantierId)
    .map((l) => ({
      jour: l.jour as JourIso,
      moment: l.moment === "matin" || l.moment === "apres_midi" ? l.moment : null,
      dureeDemiJournees: l.duree,
      equipesParDemi: equipes.get(l.id) ?? null,
    }));

  const [entreprise] = await tx
    .select({ nombreEquipes: entreprises.nombreEquipes })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);

  const nombreEquipes = entreprise?.nombreEquipes ?? 1;

  // **Les équipes qui ne sont pas là, retirées de la capacité.**
  //
  // *Le patron, le 14 août 2026 : « une équipe qui doit partir en déplacement
  // pour cinq jours ».* Une absence s'exprime comme une occupation — elle prend
  // la place qu'un chantier aurait prise — ce qui la fait entrer ici, dans la
  // carte que les trois chemins partagent déjà, **sans changer une seule
  // signature** (`src/lib/absences-equipe.ts`).
  //
  // Lues dans la même transaction que les chantiers : deux lectures séparées
  // pourraient tomber de part et d'autre d'une écriture, et la date proposée au
  // client ne serait alors plus celle que la revérification accepterait.
  const absences = await tx
    .select({
      equipeId: absencesEquipe.equipeId,
      premierJour: absencesEquipe.premierJour,
      dernierJour: absencesEquipe.dernierJour,
    })
    .from(absencesEquipe)
    .where(
      and(
        eq(absencesEquipe.entrepriseId, entrepriseId),
        isNull(absencesEquipe.deletedAt),
        // Ce qui croise la fenêtre, et rien d'autre : une absence de l'an
        // dernier n'a rien à faire dans ce calcul.
        lte(absencesEquipe.premierJour, fenetre.fin),
        gte(absencesEquipe.dernierJour, fenetre.debut)
      )
    );

  // **Une seule carte d'occupation, jamais deux.** Les trois chemins qui
  // passent ici — l'écran d'envoi, la création de l'envoi, la revérification
  // de la réponse du client — voient donc exactement la même chose, agenda
  // extérieur et absences compris. Sans agenda relié ni absence notée, les deux
  // listes sont vides et la carte est exactement celle d'avant.
  //
  // **L'ordre compte.** Les absences d'abord — elles AJOUTENT une unité par
  // équipe partie —, l'agenda ensuite, qui pose `Math.max(…, nombreEquipes)`
  // parce qu'il ne sait pas qui part et bloque donc tout le monde. Dans l'autre
  // sens, l'addition dépasserait un plafond que l'agenda venait de poser.
  return {
    occupation: fusionnerOccupationExterne(
      fusionnerAbsences(compterOccupation(planifies), absences, nombreEquipes),
      periodesExterieures,
      nombreEquipes
    ),
    nombreEquipes,
  };
}

export type CreationEnvoi = {
  chantierId: string;
  devisId: string;
  canal: CanalCommunication;
  /** Une ou deux dates — la forme est tranchée par le patron à la validation. */
  datesProposees: JourIso[];
  /**
   * Le client peut-il proposer une AUTRE date ? Sa demande du 17 août 2026.
   *
   * Absent : `true`, c'est-à-dire ce que faisait l'application depuis toujours.
   * Un défaut à `false` changerait sans un mot ce que le patron croit envoyer.
   */
  autreDateAutorisee?: boolean;
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

  // L'occupation se lit sur l'union des deux : une date à six mois doit être
  // vérifiable, et les jours occupés montrés au client doivent l'être aussi.
  const fenetreOccupation = {
    debut: horizon.debut < fenetreClient.debut ? horizon.debut : fenetreClient.debut,
    fin: horizon.fin > fenetreClient.fin ? horizon.fin : fenetreClient.fin,
  };
  const periodesExterieures = await periodesOccupeesExterieures(
    ctx,
    new Date(`${fenetreOccupation.debut}T00:00:00Z`),
    new Date(`${fenetreOccupation.fin}T23:59:59Z`)
  );

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const { occupation, nombreEquipes } = await contrainteDuPlanning(
      tx,
      ctx.entrepriseId,
      fenetreOccupation,
      creation.chantierId,
      periodesExterieures
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
        autreDateAutorisee: creation.autreDateAutorisee ?? true,
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
  /** Le calendrier « une autre date » n'est offert que si le patron l'a permis. */
  autreDateAutorisee: boolean;
  /**
   * Jours indisponibles dans la fenêtre — **des dates, rien d'autre**.
   *
   * La durée de réservation a été ajoutée ici le 16 août 2026, puis retirée le
   * jour même : la batterie l'a refusée (*« la durée du chantier a fuité vers
   * la page du client »*), et elle avait raison — c'est une consigne du patron,
   * pas une préférence de style. La page du client dit donc « ne peuvent pas
   * accueillir votre chantier », sans jamais chiffrer (`src/lib/jours-barres.ts`).
   */
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
    /** Recopiée sur le devis à son établissement (migration 0038). */
    clientCivilite: "mr" | "mme" | null;
    adresseChantier: string | null;
    lignes: { libelle: string; quantite: string; prixUnitaire: string; montant: string }[];
  };
};


/**
 * De quoi consulter l'agenda extérieur AVANT d'ouvrir la transaction du client.
 *
 * **Pourquoi un aller-retour de plus.** Les deux chemins publics — lire le lien,
 * enregistrer la réponse — dérivent l'entreprise du jeton, et cette dérivation
 * se fait forcément en base. Mais l'appel à Google ne doit pas se faire dans la
 * transaction qui suit : elle immobiliserait une connexion du pool pendant la
 * durée d'un service extérieur, et une lenteur de Google deviendrait une panne
 * d'Atlas.
 *
 * On paie donc une requête minuscule pour libérer la connexion pendant l'appel.
 *
 * **L'entreprise vient du jeton, jamais d'une donnée envoyée par le client** —
 * c'est la même règle qu'ailleurs sur ces chemins, et elle est ce qui empêche
 * quelqu'un de faire consulter l'agenda d'une autre entreprise en changeant un
 * paramètre.
 */
async function agendaDuJeton(jeton: string): Promise<PeriodeOccupee[]> {
  // **Sortir AVANT la requête quand il n'y a rien à consulter.**
  //
  // Sans cette ligne, chaque ouverture de lien client payait un aller-retour en
  // base pour finir par constater qu'aucun agenda n'est configuré. Sur une
  // installation qui n'en a pas — c'est-à-dire toutes, aujourd'hui — c'est une
  // transaction gratuite sur le chemin le plus public de l'application.
  //
  // Trouvé parce qu'une suite navigateur a expiré sur un serveur de
  // développement chargé : le coût était réel, pas théorique.
  if (!configurationGoogle()) return [];

  const repere = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    const [e] = await tx
      .select({
        entrepriseId: envoisDevis.entrepriseId,
        envoyeAt: envoisDevis.envoyeAt,
        datesProposees: envoisDevis.datesProposees,
      })
      .from(envoisDevis)
      .where(eq(envoisDevis.jeton, jeton))
      .limit(1);
    return e ?? null;
  });
  if (!repere) return [];

  // La même fenêtre que celle du calcul qui suit — ancrée au jour de l'envoi,
  // pas à aujourd'hui. Interroger Google sur une autre fenêtre rendrait des
  // rendez-vous hors sujet, ou en oublierait.
  const fenetre = fenetrePourDates(repere.envoyeAt, repere.datesProposees);
  return periodesOccupeesPourEntreprise(
    repere.entrepriseId,
    new Date(`${fenetre.debut}T00:00:00Z`),
    new Date(`${fenetre.fin}T23:59:59Z`)
  );
}

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

  const periodesExterieures = await agendaDuJeton(jeton);

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
      envoi.chantierId,
      periodesExterieures
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
      autreDateAutorisee: envoi.autreDateAutorisee,
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
        clientCivilite: d.clientCivilite,
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

    // **Le contexte d'entreprise, déduit du jeton** — sans lui, la lecture de
    // `devis` ne rend rien sous le rôle applicatif : `envois_devis` porte une
    // politique par jeton, `devis` n'en porte pas.
    //
    // Le défaut, trouvé le 8 août 2026 : la PAGE du devis s'affichait (elle
    // pose ce contexte, plus bas dans `lireParJeton`) mais **le téléchargement
    // du PDF échouait en silence**, renvoyant le client vers « ce lien n'est
    // plus valable ». Or le PDF est ce que `docs/A-FAIRE.md` §5 lui promet :
    // « il voit son devis, télécharge le PDF s'il le veut ».
    //
    // Invisible partout : les suites navigateur tournent sous un rôle qui
    // traverse la RLS. Voir `scripts/test-facture-jeton-rls.ts`.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);

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
        | "message_manquant"
        /** Le patron n'a pas autorisé d'autre date sur CET envoi (17 août 2026). */
        | "autre_date_refusee";
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

  // Lu avant la transaction, comme à la lecture du lien : c'est la
  // revérification qui fait foi, et elle doit voir le même agenda que l'écran
  // qui a montré les jours au client. Deux vues différentes rendraient
  // « indisponible » un jour affiché libre trente secondes plus tôt.
  const periodesExterieures = await agendaDuJeton(jeton);

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

    // **Le refus se fait ICI, pas seulement à l'écran** (17 août 2026). La page
    // du client est publique : elle s'ouvre sans compte, et son formulaire se
    // rejoue. Cacher le calendrier suffit à l'usage, jamais à la règle — un
    // envoi où le patron n'a pas autorisé d'autre date ne doit pas pouvoir en
    // recevoir une, quoi qu'on lui poste. C'est la règle du dépôt : jamais de
    // règle dupliquée entre l'affichage et la vérification (`CLAUDE.md` §3).
    if (contreProposee && !envoi.autreDateAutorisee) {
      return { succes: false, motif: "autre_date_refusee" as const };
    }

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
      envoi.chantierId,
      periodesExterieures
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
