import { and, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { precisionsChantier } from "../db/schema";
import type { Ctx } from "./context";

// Les réponses données à l'arrêt d'avant-chiffrage (migration 0022).
//
// Volontairement minuscule : lire, écrire, oublier. Toute l'intelligence est
// dans `src/lib/questions-chiffrage.ts`, qui est pur et se joue sans base —
// c'est la règle du dépôt (`CLAUDE.md` §3), et c'est ce qui permet d'éprouver
// les règles du métier sur la dictée réelle du patron.

export type Precision = {
  sujet: string;
  libellePrestation: string;
  valeur: string;
  /** Ce qui s'écrit sur le devis : « démontage avec rétention », « ⌀ 70 cm ». */
  lisible: string;
};

export async function listerPrecisions(ctx: Ctx, chantierId: string): Promise<Precision[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        sujet: precisionsChantier.sujet,
        libellePrestation: precisionsChantier.libellePrestation,
        valeur: precisionsChantier.valeur,
        lisible: precisionsChantier.lisible,
      })
      .from(precisionsChantier)
      .where(
        and(
          eq(precisionsChantier.chantierId, chantierId),
          eq(precisionsChantier.entrepriseId, ctx.entrepriseId)
        )
      )
      .orderBy(precisionsChantier.responduAt)
  );
}

/**
 * Enregistre les réponses, en une seule transaction.
 *
 * **Tout ou rien, et ce n'est pas de la coquetterie.** L'agent reprend sa chaîne
 * dès que plus aucune question ne reste : si une réponse sur trois se perdait,
 * il chiffrerait un arbre dont il croit connaître la technique et dont il ignore
 * le diamètre — précisément le devis faux que l'arrêt existe pour empêcher.
 *
 * Une réponse déjà donnée est **écrasée** : il a le droit de se corriger, et
 * l'ancienne valeur n'a aucune valeur probante (rien n'est encore parti au
 * client à ce stade — l'envoi est un arrêt plus loin).
 */
export async function enregistrerPrecisions(
  ctx: Ctx,
  chantierId: string,
  reponses: Precision[]
): Promise<number> {
  const propres = reponses.filter((r) => r.valeur.trim() !== "");
  if (propres.length === 0) return 0;

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (const r of propres) {
      await tx
        .insert(precisionsChantier)
        .values({
          entrepriseId: ctx.entrepriseId,
          chantierId,
          sujet: r.sujet,
          libellePrestation: r.libellePrestation,
          valeur: r.valeur.trim(),
          lisible: r.lisible.trim(),
        })
        .onConflictDoUpdate({
          target: [precisionsChantier.chantierId, precisionsChantier.sujet],
          set: { valeur: r.valeur.trim(), lisible: r.lisible.trim(), responduAt: new Date() },
        });
    }
    return propres.length;
  });
}
