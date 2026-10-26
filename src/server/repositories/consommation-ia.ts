// LE COMPTEUR DES CRÉDITS IA — ce qu'une entreprise a dépensé ce mois-ci.
//
// **Ce dépôt ne décide rien** : le plafond, le pourcentage et l'état sont dans
// `src/lib/credits-ia.ts`, que la coupure et l'écran lisent tous les deux. Ici,
// on lit et on ajoute, sous `withEntreprise` comme partout.

import { and, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { consommationIa } from "../db/schema";
import { entreprisesSansPlafond, etatDesCreditsIA, moisDu, plafondIA, type EtatCreditsIA } from "@/lib/credits-ia";
import { abonnementDeLEntreprise } from "./abonnements";
import type { Ctx } from "./context";

export async function depenseDuMois(ctx: Ctx, maintenant: Date): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ microeuros: consommationIa.microeuros })
      .from(consommationIa)
      .where(and(eq(consommationIa.entrepriseId, ctx.entrepriseId), eq(consommationIa.mois, moisDu(maintenant))))
      .limit(1);
    return ligne?.microeuros ?? 0;
  });
}

/**
 * Ajoute une dépense au mois en cours. En lecture seule le plafond vaut zéro :
 * aucun appel ne part, donc rien à écrire (`plafondIA`).
 */
export async function ajouterDepense(ctx: Ctx, microeuros: number, maintenant: Date): Promise<void> {
  if (!(microeuros > 0)) return;
  const montant = Math.ceil(microeuros);
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .insert(consommationIa)
      .values({ entrepriseId: ctx.entrepriseId, mois: moisDu(maintenant), microeuros: montant })
      .onConflictDoUpdate({
        target: [consommationIa.entrepriseId, consommationIa.mois],
        set: { microeuros: sql`${consommationIa.microeuros} + ${montant}`, misAJourLe: sql`now()` },
      })
  );
}

/** Où en est l'entreprise : ce que la coupure vérifie et ce que la barre affiche. */
export async function creditsIADeLEntreprise(ctx: Ctx, maintenant: Date): Promise<EtatCreditsIA> {
  const exemptee = entreprisesSansPlafond(process.env.ATLAS_IA_SANS_PLAFOND).has(ctx.entrepriseId.toLowerCase());
  const abonnement = await abonnementDeLEntreprise(ctx);
  const plafond = plafondIA(abonnement, exemptee, maintenant);
  if (plafond === null) return { plafonne: false };
  return etatDesCreditsIA(await depenseDuMois(ctx, maintenant), plafond, maintenant);
}
