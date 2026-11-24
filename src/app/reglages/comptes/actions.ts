"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { poserNumeroDeCompte, rendreLesNumerosProposes } from "@/server/repositories/entreprises";
import { estCleCompta } from "@/lib/categories-comptables";

export type Resultat = { ok: true; numero?: string } | { ok: false; raison: string };

const ECRAN = "/reglages/comptes";

/** Change le numéro d'une catégorie ; `null` le rend à celui de Cause. Le patron seul. */
export async function poserNumeroAction(cle: string, saisie: string | null): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "changer un numéro de compte");
  } catch {
    return { ok: false, raison: "Seul le patron change les numéros de compte." };
  }
  if (!estCleCompta(cle)) return { ok: false, raison: "Cette catégorie n'existe pas." };
  try {
    const r = await poserNumeroDeCompte(ctx, cle, saisie);
    if (r.ok) revalidatePath(ECRAN);
    return r;
  } catch (erreur) {
    // Journalisé AVANT de rendre : un défaut muet se répare à l'aveugle.
    console.error("[reglages/comptes] numéro refusé", erreur);
    return { ok: false, raison: "Le numéro n'a pas pu être enregistré. Réessayez." };
  }
}

/** Tous les numéros rendus à ceux de Cause. Le patron seul. */
export async function rendreLesNumerosAction(): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "rendre les numéros de compte");
  } catch {
    return { ok: false, raison: "Seul le patron change les numéros de compte." };
  }
  try {
    await rendreLesNumerosProposes(ctx);
    revalidatePath(ECRAN);
    return { ok: true };
  } catch (erreur) {
    console.error("[reglages/comptes] retour aux numéros proposés refusé", erreur);
    return { ok: false, raison: "Les numéros n'ont pas pu être rendus. Réessayez." };
  }
}
