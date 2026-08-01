import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, devis } from "../db/schema";
import type { Ctx } from "./context";
import {
  fenetreProposition,
  versJourIso,
  ajouterJours,
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
  maintenant: Date = new Date()
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

    const occupesRows = await tx
      .select({ jour: chantiers.datePlanifiee })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          gte(chantiers.datePlanifiee, fenetre.debut),
          lte(chantiers.datePlanifiee, fenetre.fin)
        )
      );
    const joursOccupes = occupesRows.map((r) => r.jour).filter((j): j is string => j !== null);

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
      joursLibres: premiersJoursLibres(maintenant, joursOccupes, CRENEAUX_SUGGERES),
      joursOccupes,
      fenetre,
      blocage,
    };
  });
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
  joursOccupes: readonly JourIso[],
  combien: number
): JourIso[] {
  const fenetre = fenetreProposition(maintenant);
  const libres: JourIso[] = [];
  const occupes = new Set(joursOccupes);

  for (let decalage = 0; libres.length < combien; decalage++) {
    const jour = versJourIso(ajouterJours(maintenant, decalage));
    if (jour < fenetre.debut) continue;
    if (jour > fenetre.fin) break;
    if (occupes.has(jour)) continue;

    const jourSemaine = new Date(`${jour}T00:00:00Z`).getUTCDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;

    libres.push(jour);
  }
  return libres;
}
