"use server";

import { enEuros } from "@/lib/euros";
import { enCentimes, facturesProposees, montantANoter, proposerFacture } from "@/lib/rapprochement-bancaire";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { confirmerVirement, defaireReponse, ecarterVirement, virementsDepuis } from "@/server/repositories/banque";
import { debutDesQuestions, facturesARapprocher } from "@/server/banque/questions";

/**
 * LES TROIS RÉPONSES À UN VIREMENT REÇU — partagées par l'accueil et Ma TVA.
 *
 * Ses choix du 23 octobre 2026 : la même question aux deux endroits, et une
 * réponse donnée à l'un vaut pour l'autre. Les droits sont ceux de « J'ai reçu
 * le paiement » (`exigerFacturation`) : un « oui » note un règlement, c'est le
 * même geste.
 *
 * **Aucun refus ne lève** : il revient en valeur, avec sa phrase. Une
 * exception en action serveur arrive chez lui en identifiant opaque
 * (`AGENTS.md`).
 */

export type ReponseVirement = { ok: true; fait: string } | { ok: false; raison: string };

// **Pas de `revalidatePath` ici, et c'est voulu.** Il relirait l'écran dans la
// foulée de l'appui : la carte de l'accueil disparaîtrait avant qu'il ait lu
// « la facture est payée », et avec elle le bouton Annuler. C'est l'écran qui
// décide quand se relire (`ReponseVirement`, prop `relire`).

/**
 * « Oui » : ce virement paie cette facture.
 *
 * **La proposition est RECALCULÉE ici**, contre les factures du moment, avec
 * la même règle que l'écran (`proposerFacture`, `CLAUDE.md` §3). Entre
 * l'affichage et l'appui, la facture a pu être soldée à la main : on refuse
 * alors plutôt que de noter un second paiement.
 */
export async function confirmerVirementAction(virementId: string, factureId: string): Promise<ReponseVirement> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "noter un paiement reçu par virement");

  const [virements, factures] = await Promise.all([
    virementsDepuis(ctx, debutDesQuestions(new Date())),
    facturesARapprocher(ctx),
  ]);
  const v = virements.find((x) => x.id === virementId);
  if (!v) return { ok: false, raison: "Ce virement est introuvable." };
  const proposition = proposerFacture(v, factures);
  const facture = facturesProposees(proposition).find((f) => f.id === factureId);
  if (!facture) return { ok: false, raison: "Cette facture n'est plus proposée pour ce virement. L'écran va se relire." };

  const centimes = montantANoter(v, facture);
  const reste = enCentimes(facture.reste);
  const recu = enCentimes(v.montant);
  if (centimes === null || reste === null || recu === null) return { ok: false, raison: "Ce montant est illisible." };

  const r = await confirmerVirement(ctx, virementId, factureId, (centimes / 100).toFixed(2));
  if (!r.ok) return r;

  if (centimes < reste) {
    return {
      ok: true,
      fait: `${enEuros(centimes / 100)} notés sur la facture ${facture.numero}. Il reste ${enEuros((reste - centimes) / 100)} à recevoir.`,
    };
  }
  if (recu > reste) {
    const client = facture.clientNom ? ` avec ${facture.clientNom}` : "";
    return {
      ok: true,
      fait: `La facture ${facture.numero} est payée. Les ${enEuros((recu - reste) / 100)} en trop restent à régler${client}.`,
    };
  }
  return { ok: true, fait: `La facture ${facture.numero} est payée. Elle entre au relevé de TVA.` };
}

/** « Non » : ce virement ne paie aucune facture. Rien n'entre au relevé. */
export async function ecarterVirementAction(virementId: string): Promise<ReponseVirement> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "écarter un virement reçu");
  const r = await ecarterVirement(ctx, virementId);
  if (!r.ok) return r;
  return { ok: true, fait: "Noté comme sans facture. Rien n'entre au relevé." };
}

/** « Annuler » : la réponse se défait, le paiement noté par un oui est retiré. */
export async function defaireVirementAction(virementId: string): Promise<ReponseVirement> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "annuler une réponse à un virement");
  const r = await defaireReponse(ctx, virementId);
  if (!r.ok) return r;
  return { ok: true, fait: "" };
}
