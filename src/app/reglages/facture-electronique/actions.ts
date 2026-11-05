"use server";

import { redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { delierPlateforme, relierPlateforme } from "@/server/repositories/plateforme-facture";

/**
 * Relie le compte de la plateforme agréée (son choix 2 A du 5 novembre 2026) :
 * l'identifiant et le secret qu'elle lui a donnés, vérifiés chez elle AVANT
 * d'être gardés (`relierPlateforme`).
 *
 * **Le refus revient par l'adresse, avec sa phrase** : une exception levée
 * ici lui arriverait en identifiant opaque (`AGENTS.md`). Le secret, lui, ne
 * repasse jamais par l'adresse.
 */
export async function relierPlateformeAction(formulaire: FormData): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "relier une plateforme de facture électronique");
  const r = await relierPlateforme(ctx, {
    plateforme: String(formulaire.get("plateforme") ?? ""),
    identifiant: String(formulaire.get("identifiant") ?? ""),
    secret: String(formulaire.get("secret") ?? ""),
  });
  if (!r.ok) redirect(`/reglages/facture-electronique?issue=refus&raison=${encodeURIComponent(r.raison)}`);
  redirect("/reglages/facture-electronique?issue=relie");
}

/** Oublie la liaison. Les factures déjà transmises gardent leur trace. */
export async function delierPlateformeAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "délier une plateforme de facture électronique");
  await delierPlateforme(ctx);
  redirect("/reglages/facture-electronique");
}
