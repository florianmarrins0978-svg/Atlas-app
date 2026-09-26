"use server";

import { revalidatePath } from "next/cache";
import { exigerGestionDevis } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { enregistrerContrat, envoyerContrat } from "@/server/repositories/contrats-entretien";
import type { ContratSaisi } from "@/lib/contrats-entretien";

// Les gestes de l'écran du contrat d'entretien.
//
// **La garde des devis, et pas une autre** : un contrat porte des prix et part
// chez le client pour accord, exactement comme un devis. Qui ne peut pas
// rédiger un devis ne rédige pas un contrat (`peutGererDevis`).
//
// Les refus attendus se RENDENT : le message d'une exception d'action serveur
// n'arrive jamais jusqu'au patron (`AGENTS.md`). Une panne imprévue se
// journalise avant de rendre sa phrase.

export async function enregistrerContratAction(
  clientId: string,
  id: string | null,
  saisi: ContratSaisi
): Promise<{ ok: true; id: string } | { ok: false; refus: string }> {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "rédiger un contrat d'entretien");
  try {
    const r = await enregistrerContrat(ctx, { id, clientId, saisi });
    if (!r.ok) return { ok: false, refus: r.refus };
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, id: r.contrat.id };
  } catch (err) {
    console.error("[enregistrerContratAction] échec", { clientId, id, err });
    return { ok: false, refus: "Le contrat n'a pas pu être enregistré. Réessayez." };
  }
}

export async function envoyerContratAction(
  clientId: string,
  id: string,
  saisi: ContratSaisi
): Promise<{ ok: true; jeton: string } | { ok: false; refus: string }> {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "envoyer un contrat d'entretien");
  try {
    // Ce que l'écran montre est ce qui part : on l'enregistre d'abord. Déjà
    // parti (second appui, réseau lent), l'envoi rend le MÊME lien.
    const r = await enregistrerContrat(ctx, { id, clientId, saisi });
    if (!r.ok && !r.fige) return { ok: false, refus: r.refus };
    const e = await envoyerContrat(ctx, id);
    if (!e.ok) return { ok: false, refus: e.refus };
    revalidatePath(`/clients/${clientId}`);
    return e;
  } catch (err) {
    console.error("[envoyerContratAction] échec", { clientId, id, err });
    return { ok: false, refus: "Le contrat n'a pas pu partir. Rien n'a été envoyé. Réessayez." };
  }
}
