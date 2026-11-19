// L'OFFRE PRISE — un plan d'arrosage et un diagnostic offerts, une fois par
// entreprise, essai compris (ses réponses du 19 novembre 2026, migration 0187).
//
// **Ce dépôt ne décide rien.** Ouverte, offerte ou fermée : la règle est pure et
// vit dans `src/lib/abonnements.ts` (`accesALaFonction`,
// `retoucheDuPlanOfferte`). Il lit, prend et rend, sous `withEntreprise`.

import { and, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { offresPrises } from "../db/schema";
import type { OutilOffert } from "@/lib/abonnements";
import type { Ctx } from "./context";

export type OffrePrise = { jeton: string; utiliseeLe: Date };

/** L'offre de cet outil, si elle est prise ; `null` sinon. */
export async function offreDeLOutil(ctx: Ctx, outil: OutilOffert): Promise<OffrePrise | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ jeton: offresPrises.jeton, utiliseeLe: offresPrises.priseLe })
      .from(offresPrises)
      .where(and(eq(offresPrises.entrepriseId, ctx.entrepriseId), eq(offresPrises.outil, outil)))
      .limit(1);
    return ligne ?? null;
  });
}

/** Les outils dont l'offre est prise, en une lecture : la page Paysage les montre tous. */
export async function offresDejaPrises(ctx: Ctx): Promise<Set<OutilOffert>> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ outil: offresPrises.outil })
      .from(offresPrises)
      .where(eq(offresPrises.entrepriseId, ctx.entrepriseId));
    return new Set(lignes.map((l) => l.outil));
  });
}

/**
 * PRENDRE L'OFFRE — d'un seul geste, ou pas du tout.
 *
 * **La clé primaire fait le travail** : deux envois simultanés tentent la même
 * ligne, un seul l'écrit, l'autre reçoit `null` et se refuse. Lire puis écrire
 * aurait laissé passer les deux, et offert deux plans.
 */
export async function prendreLOffre(ctx: Ctx, outil: OutilOffert): Promise<OffrePrise | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [prise] = await tx
      .insert(offresPrises)
      .values({ entrepriseId: ctx.entrepriseId, outil })
      .onConflictDoNothing()
      .returning({ jeton: offresPrises.jeton, utiliseeLe: offresPrises.priseLe });
    return prise ?? null;
  });
}

/**
 * RENDRE L'OFFRE — quand l'analyse a échoué après la prise : il n'a rien eu,
 * il n'a rien dépensé. **Par son jeton**, pour ne jamais rendre une offre prise
 * par un autre envoi que celui qui a échoué.
 */
export async function rendreLOffre(ctx: Ctx, outil: OutilOffert, jeton: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .delete(offresPrises)
      .where(
        and(eq(offresPrises.entrepriseId, ctx.entrepriseId), eq(offresPrises.outil, outil), eq(offresPrises.jeton, jeton))
      )
  );
}
