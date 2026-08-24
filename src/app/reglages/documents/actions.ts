"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise, getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise, type ConditionsLues } from "@/lib/conditions-documents";
import { refusDuMessage, MESSAGE_PAR_DEFAUT } from "@/lib/message-client";
import { logger } from "@/server/logger";

/**
 * Enregistre les conditions imprimées sur le devis.
 *
 * **Le refus se rend en VALEUR DE RETOUR, jamais en exception.** Le message
 * d'une exception levée par une action serveur n'arrive jamais jusqu'au patron
 * — Next.js le remplace en production par un identifiant opaque, et son banc
 * sert une version bâtie (`AGENTS.md`). Il lirait « une erreur est survenue »
 * sans aucun moyen de comprendre.
 *
 * **Elle rend les conditions RELUES en base**, jamais celles qu'on lui a
 * demandé d'écrire : c'est ce qui permet à l'écran d'afficher une valeur bornée
 * plutôt que la saisie aberrante qu'il vient de taper.
 */
export async function majConditionsAction(
  saisie: ConditionsLues,
  /**
   * Son message au client, s'il l'a touché (sa demande du 23 août 2026).
   *
   * **Il passe par la MÊME action, et donc par le même bouton.** Deux
   * enregistrements sur un seul écran, c'est un réglage sur deux qui se perd :
   * il en touche un, appuie sur l'autre bouton, et croit avoir tout posé.
   */
  messageClient?: string
): Promise<
  | { ok: true; conditions: ConditionsLues; messageClient: string | null }
  | { ok: false; raison: string }
> {
  const ctx = await getCurrentCtx();
  try {
    // Ces conditions engagent l'entreprise sur un document que le client garde :
    // elles appartiennent au patron (`docs/QUESTIONS.md` §10).
    await exigerProprietaire(ctx, "modifier les conditions des documents");
    // **Le refus du message est rendu ICI, en clair.** `mettreAJourEntreprise`
    // ignore en silence un message sans lien — c'est ce qu'il faut au plus près
    // de la base —, mais un silence à cet endroit lui laisserait croire que
    // c'est enregistré. On le dit avec ses mots, et sans lever (`AGENTS.md`).
    if (messageClient !== undefined) {
      const refus = refusDuMessage(messageClient.trim() || MESSAGE_PAR_DEFAUT);
      if (refus) return { ok: false, raison: refus };
    }
    await mettreAJourEntreprise(ctx, { conditions: saisie, messageClient });
    const e = await getEntreprise(ctx);
    const c = conditionsDepuisEntreprise(e);
    return {
      ok: true,
      conditions: {
        validiteJours: c.validiteJours,
        acomptePourcent: c.acomptePourcent,
        delaiPaiementJours: c.delaiPaiementJours,
        moyensPaiement: c.moyensPaiement,
        rappelerPenalites: c.rappelerPenalites,
        textePied: c.textePied,
      },
      messageClient: e.messageClient ?? null,
    };
  } catch (err) {
    // **Une panne imprévue se journalise AVANT d'être rendue.** Sans cela, le
    // patron lit « ça n'a pas été enregistré » et personne ne peut savoir
    // pourquoi — c'est le défaut muet du 11 août (`AGENTS.md`).
    logger.error("Enregistrement des conditions impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      raison: "Ces conditions n'ont pas pu être enregistrées. Réessayez dans un instant.",
    };
  }
}
