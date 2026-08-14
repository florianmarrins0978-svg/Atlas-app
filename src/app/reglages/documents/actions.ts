"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise, getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise, type ConditionsLues } from "@/lib/conditions-documents";
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
  saisie: ConditionsLues
): Promise<{ ok: true; conditions: ConditionsLues } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    // Ces conditions engagent l'entreprise sur un document que le client garde :
    // elles appartiennent au patron (`docs/QUESTIONS.md` §10).
    await exigerProprietaire(ctx, "modifier les conditions des documents");
    await mettreAJourEntreprise(ctx, { conditions: saisie });
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
