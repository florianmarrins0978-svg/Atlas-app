"use server";

import { revalidatePath } from "next/cache";
import { estMotifVirement, periodeDuDossierEnCours } from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { lireLaBanque } from "@/server/banque/lecture";
import {
  appliquerCheckUp,
  delier,
  joindreFactureRecue,
  marquerTicketPerdu,
  poserMotif,
  relierTicket,
  type Fait,
} from "@/server/repositories/pour-mon-comptable";

/**
 * POUR MON COMPTABLE — les gestes du dossier (lot 2).
 *
 * **Chaque refus revient en valeur**, avec sa phrase : une exception d'action
 * serveur lui arriverait en identifiant opaque (`AGENTS.md`). Et le même
 * contrôle de rôle que Ma TVA : le dossier montre des montants, il est au
 * patron et à la facturation.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADRESSE_INVALIDE: Fait = { ok: false, raison: "Cette ligne n'existe pas." };

async function contexte(action: string) {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, action);
  return ctx;
}

function apres(r: Fait): Fait {
  if (r.ok) revalidatePath("/termines/comptable", "layout");
  return r;
}

export type BilanDuCheckUp = { ok: true; vues: number; relies: number; restent: number } | { ok: false; raison: string };

/**
 * Le Check up : relire la banque (au plus une fois par demi-heure, la règle
 * des banques ne change pas parce qu'il appuie), puis relier ce qui tombe
 * juste.
 */
export async function checkUpAction(): Promise<BilanDuCheckUp> {
  const ctx = await contexte("faire le Check up du dossier");
  const maintenant = new Date();
  const lecture = await lireLaBanque(ctx, { maintenant });
  if (!lecture.ok) return lecture;
  const { du, au } = periodeDuDossierEnCours(maintenant);
  const b = await appliquerCheckUp(ctx, du, au);
  revalidatePath("/termines/comptable", "layout");
  return { ok: true, vues: b.vues, relies: b.relies.length, restent: b.choix.size + b.aucun.length };
}

export async function relierTicketAction(mouvementId: string, achatId: string): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(achatId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("relier un ticket à une ligne du relevé");
  return apres(await relierTicket(ctx, mouvementId, achatId, "patron"));
}

export async function ticketPerduAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("valider une ligne sans ticket");
  return apres(await marquerTicketPerdu(ctx, mouvementId));
}

export async function motifAction(mouvementId: string, motif: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  if (!estMotifVirement(motif)) return { ok: false, raison: "Dites ce qu'est ce virement." };
  const ctx = await contexte("dire ce qu'est un virement");
  return apres(await poserMotif(ctx, mouvementId, motif));
}

export async function joindreFactureAction(mouvementId: string, factureRecueId: string): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(factureRecueId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("joindre une facture à un virement");
  return apres(await joindreFactureRecue(ctx, mouvementId, factureRecueId));
}

export async function delierAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("défaire la justification d'une ligne");
  return apres(await delier(ctx, mouvementId));
}
