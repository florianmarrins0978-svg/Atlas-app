"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { noterLEnvoi } from "@/server/repositories/attestations-fiscales";
import { anneeDesAttestations } from "@/lib/attestation-fiscale";
import { jourIso } from "@/lib/jour";

/**
 * LES ATTESTATIONS FISCALES, UNE PAR UNE : noter qu'une attestation est
 * partie, une fois la feuille de partage du téléphone passée (sa demande du
 * 8 novembre 2026, *« le mieux, c'est une par une »*).
 *
 * **Atlas n'envoie rien lui-même** : le PDF part par la feuille de partage,
 * comme la fiche de sécurité et les jours travaillés
 * (`transmettre-le-pdf.ts`). Cette action ne fait que garder la trace, et le
 * dépôt recompose l'attestation avant de l'écrire : une attestation à
 * compléter se refuse ici aussi.
 *
 * **La garde est celle de la facturation** : une attestation porte ce que le
 * client a payé, et un rôle qui ne voit pas les factures ne la voit pas.
 * Le refus se rend en valeur (`AGENTS.md`).
 */
export async function noterLEnvoiAction(
  annee: number,
  clientId: string
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "envoyer une attestation fiscale");
  if (typeof annee !== "number" || typeof clientId !== "string") return { ok: false, raison: "Cette attestation ne se lit pas." };
  // Hors de sa saison, plus rien ne s'envoie d'ici : la page aurait survécu
  // au 31 mars, ouverte la veille.
  if (anneeDesAttestations(jourIso(new Date())) !== annee) {
    return { ok: false, raison: "Les attestations de cette année ne s'envoient plus d'ici." };
  }
  const r = await noterLEnvoi(ctx, annee, clientId);
  if (!r.ok) return r;
  revalidatePath("/termines");
  revalidatePath("/termines/attestations-fiscales");
  return { ok: true };
}
