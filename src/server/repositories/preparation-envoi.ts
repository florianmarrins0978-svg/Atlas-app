import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, devis, entreprises } from "../db/schema";
import type { Ctx } from "./context";
import {
  fenetreProposition,
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
  /** Coordonnée qui servira à l'envoi, pour que le patron la vérifie d'un coup d'œil. */
  destinataire: string | null;
  /** Premiers jours libres, dans l'ordre — la liste où le patron pioche. */
  joursLibres: JourIso[];
  joursOccupes: JourIso[];
  fenetre: { debut: JourIso; fin: JourIso };
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
          gte(chantiers.datePlanifiee, fenetre.debut),
          lte(chantiers.datePlanifiee, fenetre.fin)
        )
      );
    const planifies: ChantierPlanifie[] = occupesRows
      .filter((r) => r.jour !== null && r.id !== chantierId)
      .map((r) => ({
        jour: r.jour as JourIso,
        moment: r.moment === "matin" || r.moment === "apres_midi" ? r.moment : null,
        dureeDemiJournees: r.duree,
      }));
    const occupation = compterOccupation(planifies);

    const [entreprise] = await tx
      .select({ nombreEquipes: entreprises.nombreEquipes })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const nombreEquipes = entreprise?.nombreEquipes ?? 1;

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
      destinataire,
      joursLibres: premiersJoursLibres(
        maintenant,
        { occupation, nombreEquipes, dureeDemiJournees },
        CRENEAUX_SUGGERES
      ),
      // Les jours de la fenêtre où ce chantier ne tient pas. C'est cette liste
      // que la page du client reçoit : des DATES, jamais un créneau — consigne
      // du patron, « mon client ne doit pas être informé de la demi-journée ».
      joursOccupes: joursSansPlace(maintenant, { occupation, nombreEquipes, dureeDemiJournees }),
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
export function joursSansPlace(maintenant: Date, contrainte: ContrainteOccupation): JourIso[] {
  const fenetre = fenetreProposition(maintenant);
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
