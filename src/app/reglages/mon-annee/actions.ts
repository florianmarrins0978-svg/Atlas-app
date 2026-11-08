"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerEcran } from "@/server/garde-action";
import { ecrireObjectif, ecrireSurTermines } from "@/server/repositories/mon-annee";
import { objectifValide } from "@/lib/mon-annee";
import { jourIso } from "@/lib/jour";

/**
 * Les deux gestes de Mon année : poser l'objectif de l'année, et allumer la
 * ligne sur Terminés.
 *
 * **La garde est celle de l'écran** (`exigerEcran`) : une seule règle,
 * `cheminAutorise`, ouvre la page ET ses actions. Le patron seul aujourd'hui.
 *
 * **Le retour est une valeur, jamais une exception** : le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron
 * (`HANDOVER.md`, piège 0 ter).
 */
export type Resultat = { ok: true } | { ok: false; raison: string };

const ECRAN = "/reglages/mon-annee";

export async function ecrireObjectifAction(chiffreAffaires: string, benefice: string): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  try {
    await exigerEcran(ctx, ECRAN, "poser l'objectif de l'année");
  } catch {
    return { ok: false, raison: "Seul le patron pose l'objectif." };
  }
  // La même règle que l'écran, et que les CHECK de la migration 0176.
  const lu = objectifValide(chiffreAffaires, benefice);
  if (!lu.ok) return lu;
  try {
    await ecrireObjectif(ctx, Number(jourIso(new Date()).slice(0, 4)), lu.chiffreAffaires, lu.benefice);
  } catch (erreur) {
    // Journalisé AVANT de rendre : un défaut muet se répare à l'aveugle.
    console.error("[reglages/mon-annee] objectif refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
  revalidatePath(ECRAN);
  revalidatePath("/termines");
  return { ok: true };
}

export async function ecrireSurTerminesAction(oui: boolean): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  try {
    await exigerEcran(ctx, ECRAN, "montrer Mon année sur Terminés");
  } catch {
    return { ok: false, raison: "Seul le patron règle Mon année." };
  }
  try {
    await ecrireSurTermines(ctx, oui === true);
  } catch (erreur) {
    console.error("[reglages/mon-annee] interrupteur refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
  revalidatePath(ECRAN);
  revalidatePath("/termines");
  return { ok: true };
}
