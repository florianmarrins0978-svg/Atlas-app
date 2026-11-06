"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { changerLaTeinte, corrigerLeMois } from "@/server/repositories/jours-travailles";
import { moisValide } from "@/lib/jours-travailles";

/**
 * Les gestes de Jours travaillés : changer le chiffre, dire pourquoi, corriger
 * une zone, remettre le calcul.
 *
 * **Le même contrôle que le reste de Pour mon comptable** : le patron et la
 * facturation. Un refus revient en valeur, jamais en exception : son message
 * n'arriverait pas jusqu'à l'écran (`AGENTS.md`).
 */

type Retour = { ok: true } | { ok: false; raison: string };
const REFUS: Retour = { ok: false, raison: "Ce chiffre n’a pas pu s’enregistrer. Réessayez." };

async function corriger(entree: Parameters<typeof corrigerLeMois>[1]): Promise<Retour> {
  if (!moisValide(entree.mois)) return REFUS;
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "corriger les jours travaillés");
  const fait = await corrigerLeMois(ctx, entree);
  if (!fait) return REFUS;
  revalidatePath("/termines/comptable/jours-travailles");
  return { ok: true };
}

/** Le chiffre du mois, et son motif. `jours` à `null` : le calcul reprend. */
export async function corrigerLesJoursAction(rang: number, mois: string, jours: number | null, motif: string | null): Promise<Retour> {
  return corriger({ rang, mois, jours, motif });
}

/** Les cases de zone corrigées à la main. */
export async function corrigerLesZonesAction(rang: number, mois: string, zones: Record<string, number>): Promise<Retour> {
  return corriger({ rang, mois, zones });
}

/**
 * La teinte du dégradé des zones : un appui, et toutes les zones la prennent,
 * chez tous les salariés et dans le PDF (sa demande du 6 novembre 2026).
 */
export async function choisirLaTeinteAction(teinte: string): Promise<Retour> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "choisir la couleur des zones");
  const fait = await changerLaTeinte(ctx, teinte);
  if (!fait) return REFUS;
  revalidatePath("/termines/comptable/jours-travailles");
  return { ok: true };
}
