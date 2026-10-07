import { and, desc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { acceptationsDefaites, envoisDevis } from "../db/schema";
import { deplanifierDansLaTransaction, DeplanificationImpossibleError } from "./chantiers";
import type { Ctx } from "./context";

/**
 * DÉFAIRE UNE ACCEPTATION — son choix 3 du 7 octobre 2026
 * (`appli/devis-accepte-par-erreur.html`).
 *
 * *« Si jamais un client valide un devis sans faire exprès [...] il nous appelle
 * pour nous dire : je me suis trompé. »* Deux suites, au choix du patron :
 *
 * | `vers` | l'envoi | son lien |
 * |---|---|---|
 * | `attente` | sans réponse, comme avant le clic | le même, de nouveau répondable |
 * | `refusee` | refusé | fermé ; la page dit « Devis retourné » |
 *
 * Dans les deux cas le chantier quitte le planning.
 *
 * **Une seule transaction, et trois écritures qui ne vont pas l'une sans
 * l'autre** : la trace, l'envoi, le planning. Une réponse effacée sur un
 * chantier resté posé occuperait des jours que le client n'a plus acceptés ;
 * un chantier retiré sur une acceptation restée vraie se reposerait au premier
 * regard sur le devis.
 *
 * **La trace d'abord** (`acceptations_defaites`) : remettre en attente efface
 * la date, l'adresse et l'appareil du clic, la seule preuve qu'un accord a
 * existé. Elle se recopie avant, et `atlas_app` ne peut ni la réécrire ni
 * l'effacer (migration 0123).
 *
 * **Refusé dès qu'une facture existe**, par le retrait du planning lui-même
 * (`deplanifierDansLaTransaction`) : un chantier facturé ne se défait pas d'un
 * geste, il se corrige par un avoir.
 */
export class AcceptationNonDefaite extends Error {
  constructor(readonly motif: "pas_accepte" | "facture_preparee") {
    super(motif);
    this.name = "AcceptationNonDefaite";
  }
}

export async function defaireLAcceptation(
  ctx: Ctx,
  chantierId: string,
  vers: "attente" | "refusee"
): Promise<void> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Le dernier envoi, et lui seul** : c'est lui que sert le lien du client.
    // Lu `FOR UPDATE` — le client peut encore toucher sa page pendant le geste.
    const [envoi] = await tx
      .select()
      .from(envoisDevis)
      .where(eq(envoisDevis.chantierId, chantierId))
      .orderBy(desc(envoisDevis.envoyeAt))
      .limit(1)
      .for("update");
    if (!envoi || envoi.reponse !== "acceptee" || !envoi.responduAt) {
      throw new AcceptationNonDefaite("pas_accepte");
    }

    try {
      await deplanifierDansLaTransaction(tx, ctx, chantierId);
    } catch (e) {
      if (e instanceof DeplanificationImpossibleError) throw new AcceptationNonDefaite("facture_preparee");
      throw e;
    }

    await tx.insert(acceptationsDefaites).values({
      entrepriseId: ctx.entrepriseId,
      envoiId: envoi.id,
      chantierId,
      vers,
      responduAt: envoi.responduAt,
      dateRetenue: envoi.dateRetenue,
      joursRetenus: envoi.joursRetenus,
      demarrageAnticipe: envoi.demarrageAnticipe,
      accordSurPapier: envoi.accordSurPapier,
      adresseIp: envoi.adresseIp,
      agentUtilisateur: envoi.agentUtilisateur,
      defaitePar: ctx.utilisateurId,
    });

    // **Ce que le clic avait écrit s'efface, dans les deux cas** : la date
    // retenue, les jours, la demande de démarrer avant 14 jours, l'accord
    // papier. Les garder sur un envoi qui n'est plus accepté les ferait relire
    // comme vrais par le planning ou par la page du client.
    const effaces = {
      dateRetenue: null,
      joursRetenus: null,
      dateContreProposee: false,
      precisionClient: null,
      joursSouhaites: null,
      demarrageAnticipe: false,
      accordSurPapier: false,
      accordPapierPar: null,
      adresseIp: null,
      agentUtilisateur: null,
    };
    await tx
      .update(envoisDevis)
      .set(
        vers === "attente"
          ? // `reponse` et `repondu_at` vides ENSEMBLE : la contrainte
            // `envois_devis_reponse_datee` l'exige, et c'est ce que lit le
            // garde `deja_repondu` de la page du client.
            { ...effaces, reponse: null, responduAt: null, vuParPatronAt: null }
          : // **Vu par le patron, puisque c'est lui qui l'écrit** : sans cela,
            // l'accueil lui annoncerait comme une nouvelle le refus qu'il vient
            // de noter lui-même.
            { ...effaces, reponse: "refusee", responduAt: new Date(), vuParPatronAt: new Date() }
      )
      .where(and(eq(envoisDevis.id, envoi.id), eq(envoisDevis.reponse, "acceptee")));
  });
}
