import { and, desc, eq } from "drizzle-orm";
import { envoisDevis } from "../db/schema";
import { withEntreprise } from "../db/with-entreprise";
import { attendLeClient, etatEnvoi } from "../../lib/etat-envoi";
import { dansDelaiRetractation, jourIso } from "../../lib/jour";
import { planifierDansLaTransaction } from "./chantiers";
import { devisEnSousTraitance, joursOuLeChantierEstPose } from "./envois-devis";
import type { Ctx } from "./context";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POSER UN CLIENT À SA PLACE — son choix B du 7 octobre 2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa question :** un client âgé reçoit le lien du devis et n'arrive pas à
 * choisir ses dates. Le planning le rangeait « en attente du client », sans
 * aucun geste ; « Un client » en aurait créé un second, sans devis.
 *
 * **Deux issues, et il choisit à chaque fois** (`appli/poser-a-sa-place.html`) :
 *
 * | | le devis | son lien |
 * |---|---|---|
 * | `lien` | toujours à signer | ne montre plus que ces jours, et l'accord |
 * | `papier` | accepté, trace « papier » | fermé |
 *
 * **Poser ne vaut JAMAIS accord.** Il l'a proposé le 7 octobre ; c'est refusé,
 * et il l'a accepté : pour un particulier, un accord que rien ne prouve ne
 * vaut rien le jour d'un litige, et hors établissement des travaux commencés
 * dans les 14 jours sans demande écrite ne lui sont pas dus. Seuls sa
 * signature en ligne ou un papier signé valent accord.
 *
 * **Une seule transaction.** La place et ce que dit le lien n'existent jamais
 * l'une sans l'autre : posé sans que le lien le sache, le client choisirait
 * encore d'autres dates, et sa réponse déplacerait le chantier.
 */
export type ManiereDeSigner =
  | { maniere: "lien" }
  /**
   * `demarrageAnticipe` : il a sous les yeux la demande ÉCRITE du client de
   * commencer dans ses 14 jours. Exigée quand la date y tombe, comme la case
   * l'est sur le lien (L221-25) : le papier ne dispense pas de la règle.
   */
  | { maniere: "papier"; demarrageAnticipe: boolean };

/** Ce que le chantier porte après le geste, pour que l'écran repeigne juste. */
type PoseEcrite = {
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
};

export type ResultatPoseALaPlace =
  | { succes: true; pose: PoseEcrite }
  | { succes: false; motif: "plus_en_attente" | "demarrage_non_demande" };

export async function poserALaPlaceDuClient(
  ctx: Ctx,
  chantierId: string,
  jour: string,
  signature: ManiereDeSigner,
  maintenant: Date = new Date()
): Promise<ResultatPoseALaPlace> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Le dernier envoi, verrouillé** : c'est lui que le client a dans les
    // mains, et sa réponse pourrait arriver pendant ce geste. Sans le verrou,
    // les deux écritures se croiseraient et le chantier aurait deux places.
    const [envoi] = await tx
      .select()
      .from(envoisDevis)
      .where(and(eq(envoisDevis.entrepriseId, ctx.entrepriseId), eq(envoisDevis.chantierId, chantierId)))
      .orderBy(desc(envoisDevis.envoyeAt))
      .limit(1)
      .for("update");
    if (!envoi || !attendLeClient(etatEnvoi(envoi, maintenant))) {
      return { succes: false as const, motif: "plus_en_attente" as const };
    }

    // **Le premier jour est celui qu'il touche** : `planifierDansLaTransaction`
    // y pose le début du chantier. La règle des 14 jours se juge donc AVANT
    // d'écrire quoi que ce soit, comme sur le lien.
    if (
      signature.maniere === "papier" &&
      dansDelaiRetractation(jour, jourIso(maintenant)) &&
      !signature.demarrageAnticipe &&
      !(await devisEnSousTraitance(tx, envoi.devisId))
    ) {
      return { succes: false as const, motif: "demarrage_non_demande" as const };
    }

    const row = await planifierDansLaTransaction(tx, ctx, chantierId, jour);
    const pose: PoseEcrite = {
      datePlanifiee: row?.datePlanifiee ?? null,
      creneauDebut: row?.creneauDebut ?? null,
      dureeDemiJournees: row?.dureeDemiJournees ?? null,
    };

    if (signature.maniere === "lien") {
      await tx
        .update(envoisDevis)
        .set({ datesFixeesParArtisan: true })
        .where(eq(envoisDevis.id, envoi.id));
      return { succes: true as const, pose };
    }

    const jours = await joursOuLeChantierEstPose(tx, chantierId);
    await tx
      .update(envoisDevis)
      .set({
        reponse: "acceptee",
        responduAt: maintenant,
        dateRetenue: jours[0] ?? jour,
        joursRetenus: jours,
        dateContreProposee: false,
        demarrageAnticipe: signature.demarrageAnticipe,
        accordSurPapier: true,
        accordPapierPar: ctx.utilisateurId,
        // **Il vient de le faire lui-même** : la carte « Devis accepté » lui
        // annoncerait son propre geste.
        vuParPatronAt: maintenant,
      })
      .where(eq(envoisDevis.id, envoi.id));
    return { succes: true as const, pose };
  });
}
