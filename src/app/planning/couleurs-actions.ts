"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { getEntreprise, mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { lireCharte } from "@/server/repositories/charte-personne";
import { charte } from "@/lib/chartes";
import { choixAEcrire, couleursDepuisColonnes, ETATS_DU_PLANNING, type CouleursPlanning } from "@/lib/couleurs-planning";
import type { EtatDemi } from "@/lib/planning-jour";
import { logger } from "@/server/logger";

/**
 * Pose la couleur d'un état du planning, pour toute l'entreprise.
 *
 * **Le propriétaire seul**, comme l'allure des documents : sa réponse du
 * 29 septembre 2026, « tout l'entreprise », en fait un réglage commun, que ses
 * salariés voient sans pouvoir le changer.
 *
 * **Elle rend les couleurs RELUES en base**, comme `majAllureAction` : une
 * valeur mal formée n'y est pas entrée, et l'écran doit montrer ce qui est
 * réellement enregistré. Un refus attendu se rend en valeur de retour : le
 * message d'une exception n'arriverait jamais jusqu'à lui (`AGENTS.md`).
 */
export async function majCouleurPlanningAction(
  etat: EtatDemi,
  couleur: string | null
): Promise<{ ok: true; couleurs: CouleursPlanning } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    if (!ETATS_DU_PLANNING.includes(etat)) throw new Error(`État inconnu : ${String(etat)}`);
    await exigerProprietaire(ctx, "modifier les couleurs du planning");
    // La couleur de l'apparence s'écrit vide : elle suivra l'apparence.
    const aEcrire = choixAEcrire(etat, couleur, charte(await lireCharte()));
    await mettreAJourEntreprise(ctx, { couleursPlanning: { [etat]: aEcrire } });
    return { ok: true, couleurs: couleursDepuisColonnes(await getEntreprise(ctx)) };
  } catch (err) {
    logger.error("Enregistrement d'une couleur du planning impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Cette couleur n'a pas pu être enregistrée. Réessayez dans un instant." };
  }
}
