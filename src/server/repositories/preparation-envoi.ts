import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { fusionnerOccupationExterne } from "../../lib/agenda-externe";
import { fusionnerAbsences } from "../../lib/absences-equipe";
import { periodesOccupeesExterieures } from "./agendas-externes";
import { encoreEnCoursDepuis, equipesParChantier } from "./occupation-chantiers";
import { absencesEquipe, chantiers, clients, devis, entreprises } from "../db/schema";
import type { Ctx } from "./context";
import {
  fenetreProposition,
  fenetrePatron,
  HORIZON_OCCUPATION_PATRON_JOURS,
  libelleDuree,
  type FenetreProposition,
  versJourIso,
  ajouterJours,
  compterOccupation,
  jourRetenable,
  dureeEnDemiJournees,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type ChantierPlanifie,
  type JourIso,
} from "../disponibilites";
import type { CanalCommunication } from "./envois-devis";

// Ce que l'écran d'envoi doit savoir avant de poser au patron son unique
// question : « une date, ou deux ? » (docs/AGENT.md §2.2).
//
// Tout est calculé ici, côté serveur, pour que l'écran n'ait rien à décider.

/** Nombre de créneaux proposés au patron parmi lesquels il choisira. */
const CRENEAUX_SUGGERES = 6;

export type PreparationEnvoi = {
  /** Canal convenu avec le client. Sans lui, l'envoi est impossible. */
  canal: CanalCommunication | null;
  clientNom: string | null;
  /**
   * L'identifiant du client, pour que l'écran d'envoi puisse RÉPARER un envoi
   * bloqué au lieu de s'y arrêter.
   *
   * **Le 11 août 2026, cet écran était un cul-de-sac.** Faute de canal, il
   * affichait « Indiquez d'abord comment joindre ce client — sur sa fiche » et
   * grisait le bouton. Or l'écran « Informations » a quitté le tiroir de la
   * fiche le soir même, à la demande du patron : la fiche en question n'offrait
   * plus rien à indiquer. Un chantier né d'une dictée, dont le client reste
   * « non renseigné », ne pouvait donc plus jamais partir.
   *
   * Le dépôt avait déjà tranché ce point le 4 août, pour l'écran d'après :
   * *« si la coordonnée manque, elle se saisit sur place — il n'existe aucun
   * autre écran pour la renseigner, et renvoyer le patron sur la fiche du
   * client l'enverrait vers une porte qui n'existe pas »*
   * (`TransmettreAuClient.tsx`). La règle valait ici aussi ; elle y est.
   */
  clientId: string | null;
  /** Coordonnée qui servira à l'envoi, pour que le patron la vérifie d'un coup d'œil. */
  destinataire: string | null;
  /** Premiers jours libres, dans l'ordre — la liste où le patron pioche. */
  joursLibres: JourIso[];
  joursOccupes: JourIso[];
  fenetre: { debut: JourIso; fin: JourIso };
  /**
   * Jusqu'où LE PATRON peut aller chercher une date — dix-huit mois.
   *
   * Distinct de `fenetre`, qui est ce que le CLIENT verra. Les confondre
   * reviendrait soit à lui interdire de proposer l'automne prochain, soit à
   * livrer un an et demi de planning à quelqu'un qui n'a rien signé.
   */
  horizon: { debut: JourIso; fin: JourIso };
  /** Nombre d'équipes de l'entreprise — combien de chantiers tiennent le même jour. */
  nombreEquipes: number;
  /**
   * Durée que ce chantier va réserver, en demi-journées. Elle commande les
   * jours proposables : une demi-journée tient là où une journée entière ne
   * tient plus. Le patron peut la corriger avant d'envoyer.
   */
  dureeDemiJournees: number;
  /** La durée a-t-elle été déduite de la dictée, ou faute de mieux ? */
  dureeDeduiteDeLaDictee: boolean;
  /** Motif rendant l'envoi impossible, à afficher tel quel au patron. */
  blocage: "canal_absent" | "coordonnee_absente" | "devis_absent" | null;
};

/**
 * Rassemble tout ce qu'il faut pour l'écran d'envoi.
 *
 * Les jours libres sont calculés ici plutôt que dans l'écran : c'est la même
 * règle que celle appliquée à la création de l'envoi et à la réponse du client.
 * Trois calculs distincts finiraient par diverger.
 */
export async function preparerEnvoi(
  ctx: Ctx,
  chantierId: string,
  maintenant: Date = new Date(),
  /**
   * Durée imposée par le patron, s'il l'a corrigée à l'écran. Sinon elle se
   * déduit de la dictée, et à défaut vaut une journée.
   */
  dureeImposee?: number
): Promise<PreparationEnvoi> {
  const fenetre = fenetreProposition(maintenant);

  // **Deux fenêtres, et les confondre ouvrirait le planning.** `fenetre` est
  // celle du client : elle borne ce qu'on lui montrera, et les jours suggérés.
  // `fenetreOccupationPatron` ne sert QU'À l'écran du patron, pour barrer ses
  // journées complètes sur douze mois — son chiffre, le 9 août 2026.
  const fenetreOccupationPatron: FenetreProposition = {
    debut: fenetre.debut,
    fin: versJourIso(ajouterJours(maintenant, HORIZON_OCCUPATION_PATRON_JOURS)),
  };

  // **L'agenda extérieur, s'il y en a un.** Lu AVANT d'ouvrir la transaction :
  // il part sur le réseau, et tenir une transaction PostgreSQL ouverte pendant
  // un appel HTTP immobilise une connexion du pool pour la durée d'un service
  // qu'on ne maîtrise pas.
  //
  // Rend une liste vide dans tous les cas ordinaires — pas d'identifiants
  // Google, rien de relié, raccordement coupé — et aussi quand Google tombe.
  // L'échec n'est pas avalé pour autant : il s'écrit et l'écran des réglages le
  // montre (`periodesOccupeesExterieures`).
  const periodesExterieures = await periodesOccupeesExterieures(
    ctx,
    new Date(`${fenetre.debut}T00:00:00Z`),
    new Date(`${fenetreOccupationPatron.fin}T23:59:59Z`)
  );

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);

    const client = chantier?.clientId
      ? (
          await tx
            .select()
            .from(clients)
            .where(eq(clients.id, chantier.clientId))
            .limit(1)
        )[0]
      : null;

    const [devisRow] = await tx
      .select({ id: devis.id })
      .from(devis)
      .where(and(eq(devis.chantierId, chantierId), eq(devis.entrepriseId, ctx.entrepriseId)))
      .limit(1);

    // Les chantiers déjà posés, avec leur créneau et leur durée : c'est ce qui
    // permet de savoir qu'un 6 août pris le matin reste libre l'après-midi.
    // Le chantier courant est exclu — sa propre date ne doit pas se refuser
    // elle-même lors d'un renvoi.
    const occupesRows = await tx
      .select({
        id: chantiers.id,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          // Bornée sur la fenêtre LA PLUS LARGE des deux : une occupation
          // absente ne se voit pas — le jour s'affiche simplement libre, et le
          // patron le propose. C'est exactement le défaut qu'on répare.
          //
          // **Et pas sur la date de DÉPART.** Un chantier commencé avant la
          // fenêtre peut encore l'occuper ; borner sur son premier jour le
          // rendait invisible (`encoreEnCoursDepuis`).
          encoreEnCoursDepuis(fenetre.debut),
          lte(chantiers.datePlanifiee, fenetreOccupationPatron.fin)
        )
      );
    const equipesPosees = await equipesParChantier(tx, ctx.entrepriseId);
    const planifies: ChantierPlanifie[] = occupesRows
      .filter((r) => r.jour !== null && r.id !== chantierId)
      .map((r) => ({
        jour: r.jour as JourIso,
        moment: r.moment === "matin" || r.moment === "apres_midi" ? r.moment : null,
        dureeDemiJournees: r.duree,
        equipesParDemi: equipesPosees.get(r.id) ?? null,
      }));
    const [entreprise] = await tx
      .select({ nombreEquipes: entreprises.nombreEquipes })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const nombreEquipes = entreprise?.nombreEquipes ?? 1;

    // **Une seule carte d'occupation, jamais deux.** Les rendez-vous de
    // l'agenda extérieur se fondent ICI, dans la même carte que les chantiers,
    // et tout ce qui suit — jours suggérés, jours barrés, revérification de la
    // réponse du client — la lit sans savoir d'où vient l'occupation.
    //
    // Un second calcul posé à côté finirait par diverger : c'est ce
    // dédoublement qui avait rangé un chantier dans deux onglets à la fois
    // (`ARCHITECTURE.md` §33). Sans agenda relié, la liste est vide et la carte
    // est exactement celle d'avant.
    //
    // **Les équipes absentes entrent ici aussi, et il le fallait.** Cet écran
    // construit sa propre carte : ne poser les absences que dans
    // `envois-devis.ts` aurait fait proposer au patron une date que la
    // revérification aurait ensuite refusée au client. Deux implémentations
    // d'une même règle finissent toujours par diverger (`CLAUDE.md` §3).
    const absences = await tx
      .select({
        equipeId: absencesEquipe.equipeId,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
      })
      .from(absencesEquipe)
      .where(
        and(
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          isNull(absencesEquipe.deletedAt),
          lte(absencesEquipe.premierJour, fenetreOccupationPatron.fin),
          gte(absencesEquipe.dernierJour, fenetre.debut)
        )
      );

    const occupation = fusionnerOccupationExterne(
      fusionnerAbsences(compterOccupation(planifies), absences, nombreEquipes),
      periodesExterieures,
      nombreEquipes
    );

    // La durée retenue, dans l'ordre : ce que le patron a corrigé, sinon ce que
    // sa dictée disait, sinon une journée. Jamais un chiffre inventé sans le
    // dire — `dureeDeduiteDeLaDictee` porte l'aveu jusqu'à l'écran.
    const deduite = dureeEnDemiJournees(chantier?.dureePrevue ?? null);
    const dureeDemiJournees = dureeImposee ?? deduite ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    const canal = client?.canalCommunication ?? null;
    const destinataire = canal === "sms" ? client?.telephone ?? null : client?.email ?? null;

    // L'ordre des blocages suit celui que le patron doit corriger : à quoi bon
    // signaler une coordonnée manquante si le canal n'est pas encore choisi ?
    const blocage: PreparationEnvoi["blocage"] = !devisRow
      ? "devis_absent"
      : !canal
        ? "canal_absent"
        : !destinataire
          ? "coordonnee_absente"
          : null;

    return {
      canal,
      clientNom: client?.nom ?? null,
      clientId: client?.id ?? null,
      destinataire,
      nombreEquipes,
      horizon: fenetrePatron(maintenant),
      joursLibres: premiersJoursLibres(
        maintenant,
        { occupation, nombreEquipes, dureeDemiJournees },
        CRENEAUX_SUGGERES
      ),
      // Les jours où ce chantier ne tient pas, sur DOUZE MOIS — son chiffre du
      // 9 août 2026. Cette liste ne sert qu'à SON calendrier.
      //
      // **Elle ne part jamais chez le client**, et le commentaire qui prétendait
      // le contraire ici a été corrigé le même jour : la page du client reçoit
      // sa propre liste, recalculée sur sa fenêtre à lui au moment où il ouvre
      // le lien (`lireParJeton`, dans `envois-devis.ts`). Les deux ne se
      // rejoignent nulle part, et c'est ce qui permet d'élargir celle-ci sans
      // ouvrir le carnet de commandes (`docs/AGENT.md` §2.2 bis).
      joursOccupes: joursSansPlace(
        maintenant,
        { occupation, nombreEquipes, dureeDemiJournees },
        fenetreOccupationPatron
      ),
      fenetre,
      dureeDemiJournees,
      dureeDeduiteDeLaDictee: dureeImposee === undefined && deduite !== null,
      blocage,
    };
  });
}

/** Ce qu'il faut savoir pour dire si un jour peut accueillir ce chantier. */
export type ContrainteOccupation = {
  occupation: ReadonlyMap<string, number>;
  nombreEquipes: number;
  dureeDemiJournees: number;
};

/**
 * Les jours de la fenêtre qui ne peuvent PAS accueillir ce chantier.
 *
 * Remplace l'ancienne liste « jours où un chantier est posé ». La nuance
 * compte : un 6 août dont seul le matin est pris n'est plus occupé pour une
 * demi-journée, et l'est encore pour deux jours pleins. La réponse dépend donc
 * du chantier qu'on cherche à caler, ce qui n'était pas le cas avant.
 */
export function joursSansPlace(
  maintenant: Date,
  contrainte: ContrainteOccupation,
  /**
   * Jusqu'où regarder. Par défaut la fenêtre du CLIENT — c'est l'usage
   * d'origine, et l'oublier livrerait douze mois de planning à un inconnu.
   * L'écran du patron passe la sienne, plus large (9 août 2026).
   */
  fenetre: FenetreProposition = fenetreProposition(maintenant)
): JourIso[] {
  const sansPlace: JourIso[] = [];
  for (let decalage = 0; ; decalage++) {
    const jour = versJourIso(ajouterJours(maintenant, decalage));
    if (jour > fenetre.fin) break;
    if (jour < fenetre.debut) continue;
    if (
      !jourRetenable(jour, contrainte.dureeDemiJournees, contrainte.occupation, contrainte.nombreEquipes, fenetre)
    ) {
      sansPlace.push(jour);
    }
  }
  return sansPlace;
}

/**
 * Les N premiers jours réellement libres à partir de la fenêtre.
 *
 * Les samedis et dimanches sont écartés : proposer d'intervenir un dimanche
 * chez un particulier n'est presque jamais ce que veut l'artisan, et il peut
 * toujours saisir la date lui-même s'il le souhaite.
 */
export function premiersJoursLibres(
  maintenant: Date,
  contrainte: ContrainteOccupation,
  combien: number
): JourIso[] {
  const fenetre = fenetreProposition(maintenant);
  const libres: JourIso[] = [];

  for (let decalage = 0; libres.length < combien; decalage++) {
    const jour = versJourIso(ajouterJours(maintenant, decalage));
    if (jour < fenetre.debut) continue;
    if (jour > fenetre.fin) break;
    if (!jourRetenable(jour, contrainte.dureeDemiJournees, contrainte.occupation, contrainte.nombreEquipes, fenetre)) {
      continue;
    }
    // Le week-end est écarté ICI seulement, et pas de `jourRetenable` : on ne
    // le *suggère* jamais, mais un client qui demande expressément un samedi
    // doit pouvoir l'obtenir. Le confondre avec un jour occupé lui refuserait
    // une date que le patron accepterait volontiers.
    const jourSemaine = new Date(`${jour}T12:00:00Z`).getUTCDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;

    libres.push(jour);
  }
  return libres;
}

// ---------------------------------------------------------------------------
// Une date que le patron choisit lui-même
// ---------------------------------------------------------------------------
//
// **Le manque, dans ses mots, le 8 août 2026 :** *« la proposition des dates au
// client, on a une visibilité que sur une semaine. Comment je fais si je dois
// lui proposer une date dans six mois ? »*
//
// Les six jours suggérés restent le cas ordinaire — un appui, et c'est parti.
// Ce qui manquait, c'est la sortie de secours : une date qu'il choisit
// lui-même, jusqu'à dix-huit mois. Elle doit répondre **tout de suite**, et
// dire pourquoi quand elle refuse : un jour grisé sans explication renvoie au
// téléphone, ce que ce parcours existe pour supprimer.

export type VerdictJour = {
  jour: JourIso;
  retenable: boolean;
  /** Pourquoi ce jour ne peut pas être proposé — en français, pour l'écran. */
  raison: string | null;
  /**
   * Le jour libre le plus proche, quand celui demandé ne l'est pas.
   *
   * Refuser sans rien proposer laisse le patron chercher à l'aveugle dans un
   * calendrier de dix-huit mois. Cherché des deux côtés, au plus près.
   */
  alternative: JourIso | null;
};

/**
 * Ce jour-là peut-il accueillir ce chantier ?
 *
 * Réutilise `preparerEnvoi` : la même occupation, la même durée, les mêmes
 * règles. Une seconde lecture du planning finirait par diverger de celle qui
 * décide vraiment (`CLAUDE.md` §3) — et le patron proposerait une date que
 * l'envoi refuserait ensuite.
 */
export async function verifierJourPropose(
  ctx: Ctx,
  chantierId: string,
  jour: JourIso,
  dureeImposee?: number,
  maintenant: Date = new Date()
): Promise<VerdictJour> {
  const horizon = fenetrePatron(maintenant);
  const preparation = await preparerEnvoi(ctx, chantierId, maintenant, dureeImposee);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
    return { jour, retenable: false, raison: "Cette date n'est pas lisible.", alternative: null };
  }
  if (jour < horizon.debut) {
    return {
      jour,
      retenable: false,
      raison: "Trop tôt : proposez au moins après-demain, sinon vous vous mettez en défaut.",
      alternative: null,
    };
  }
  if (jour > horizon.fin) {
    return {
      jour,
      retenable: false,
      raison: "Au-delà de dix-huit mois, on ne sait plus ce qu'on promet.",
      alternative: null,
    };
  }

  // L'occupation est relue sur l'horizon entier : celle de `preparerEnvoi` ne
  // porte que sur trois mois, et un jour à six mois y serait vu libre à tort —
  // faute de savoir ce qui s'y trouve, pas parce qu'il l'est.
  const contrainte = await contrainteSurHorizon(ctx, chantierId, horizon);

  const libre = (j: JourIso) => jourRetenable(j, preparation.dureeDemiJournees, contrainte, preparation.nombreEquipes, horizon);
  if (libre(jour)) {
    const weekEnd = [0, 6].includes(new Date(`${jour}T12:00:00Z`).getUTCDay());
    return {
      jour,
      retenable: true,
      // Pas un refus : il connaît ses clients. Mais le dire évite l'appui
      // distrait sur un samedi, qui ne se rattrape qu'en rappelant le client.
      raison: weekEnd ? "C'est un week-end — vous pouvez le proposer, mais vérifiez que c'est voulu." : null,
      alternative: null,
    };
  }

  return {
    jour,
    retenable: false,
    raison: `${libelleDuree(preparation.dureeDemiJournees)} ne tient pas ce jour-là : votre planning est déjà pris.`,
    alternative: jourLibreLePlusProche(jour, horizon, libre),
  };
}

/** Le jour libre le plus proche, cherché des deux côtés en s'éloignant. */
function jourLibreLePlusProche(
  depuis: JourIso,
  horizon: FenetreProposition,
  libre: (j: JourIso) => boolean
): JourIso | null {
  const centre = new Date(`${depuis}T12:00:00Z`);
  for (let ecart = 1; ecart <= 60; ecart++) {
    for (const sens of [1, -1] as const) {
      const candidat = versJourIso(ajouterJours(centre, sens * ecart));
      if (candidat < horizon.debut || candidat > horizon.fin) continue;
      if ([0, 6].includes(new Date(`${candidat}T12:00:00Z`).getUTCDay())) continue;
      if (libre(candidat)) return candidat;
    }
  }
  return null;
}

/** L'occupation du planning sur tout l'horizon du patron, chantier courant exclu. */
async function contrainteSurHorizon(
  ctx: Ctx,
  chantierId: string,
  horizon: FenetreProposition
): Promise<ReadonlyMap<string, number>> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          // Même règle que l'écran d'envoi, et surtout la même fonction :
          // c'est ici qu'on valide la date que le patron choisit au
          // calendrier. Deux bornes différentes lui feraient accepter un jour
          // que l'écran refuse, ou l'inverse.
          encoreEnCoursDepuis(horizon.debut),
          lte(chantiers.datePlanifiee, horizon.fin)
        )
      );
    const equipesPosees = await equipesParChantier(tx, ctx.entrepriseId);
    return compterOccupation(
      rows
        .filter((r) => r.jour !== null && r.id !== chantierId)
        .map((r) => ({
          jour: r.jour as JourIso,
          moment: r.moment === "matin" || r.moment === "apres_midi" ? r.moment : null,
          dureeDemiJournees: r.duree,
          equipesParDemi: equipesPosees.get(r.id) ?? null,
        }))
    );
  });
}
