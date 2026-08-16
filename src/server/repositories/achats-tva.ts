import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { achatsTva } from "../db/schema";
import type { Ctx } from "./context";
import type { SaisieAchat } from "@/lib/achat-tva";

/**
 * Les achats du patron, et la TVA qu'il peut déduire.
 *
 * **Tout passe par `withEntreprise`** — une requête hors de ce cadre ne rend
 * rien, silencieusement (`CLAUDE.md` §3). Sur cette table plus qu'ailleurs :
 * les tickets d'un artisan disent où il fait le plein et ce qu'il achète.
 */

export type AchatTva = {
  id: string;
  dateAchat: string;
  fournisseur: string;
  totalTtc: string | null;
  tauxTva: string | null;
  tvaDeductible: string;
  photoCle: string | null;
  saisie: SaisieAchat;
};

/**
 * Les achats d'une période, du plus récent au plus ancien.
 *
 * Bornes **incluses** des deux côtés, comme `periodeTva` les rend : un achat du
 * 31 août appartient à août. Un intervalle ouvert à droite perdrait le dernier
 * jour de chaque mois — soit douze jours par an, et personne ne s'en
 * apercevrait avant de comparer avec le comptable.
 */
export async function listerAchatsTva(ctx: Ctx, debut: string, fin: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: achatsTva.id,
        dateAchat: achatsTva.dateAchat,
        fournisseur: achatsTva.fournisseur,
        totalTtc: achatsTva.totalTtc,
        tauxTva: achatsTva.tauxTva,
        tvaDeductible: achatsTva.tvaDeductible,
        photoCle: achatsTva.photoCle,
        saisie: achatsTva.saisie,
      })
      .from(achatsTva)
      .where(
        and(
          isNull(achatsTva.deletedAt),
          gte(achatsTva.dateAchat, debut),
          lte(achatsTva.dateAchat, fin)
        )
      )
      .orderBy(desc(achatsTva.dateAchat), desc(achatsTva.createdAt))
  );
}

/**
 * Le total déductible d'une période, compté par la base.
 *
 * **En SQL et non en additionnant la liste en JavaScript** : les montants sont
 * des `numeric`, et les rendre en chaînes pour les recoller en nombres
 * flottants réintroduirait précisément l'erreur d'arrondi que `numeric` évite.
 * `COALESCE` parce qu'une période sans achat doit rendre zéro, pas `null` —
 * l'écran soustrairait alors `null` et afficherait « NaN ».
 */
export async function totalTvaDeductible(ctx: Ctx, debut: string, fin: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(${achatsTva.tvaDeductible}), 0)::text`,
      })
      .from(achatsTva)
      .where(
        and(
          isNull(achatsTva.deletedAt),
          gte(achatsTva.dateAchat, debut),
          lte(achatsTva.dateAchat, fin)
        )
      );
    return Number(row?.total ?? 0);
  });
}

export async function creerAchatTva(
  ctx: Ctx,
  data: {
    dateAchat: string;
    fournisseur: string;
    totalTtc?: number | null;
    tauxTva?: number | null;
    tvaDeductible: number;
    photoCle?: string | null;
    saisie: SaisieAchat;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(achatsTva)
      .values({
        entrepriseId: ctx.entrepriseId,
        dateAchat: data.dateAchat,
        fournisseur: data.fournisseur.trim(),
        // Les `numeric` se posent en chaînes : un nombre flottant recollé par
        // le pilote perdrait des centimes sur les grands montants.
        totalTtc: data.totalTtc === null || data.totalTtc === undefined ? null : data.totalTtc.toFixed(2),
        tauxTva: data.tauxTva === null || data.tauxTva === undefined ? null : data.tauxTva.toFixed(2),
        tvaDeductible: data.tvaDeductible.toFixed(2),
        photoCle: data.photoCle ?? null,
        saisie: data.saisie,
        createdBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

/**
 * Retrait réversible — la ligne reste, marquée.
 *
 * Rend `undefined` quand rien n'a bougé : c'est ce que voit une autre
 * entreprise qui tenterait le geste, la RLS filtrant sans lever d'exception.
 * L'écran doit pouvoir remettre la ligne plutôt que la faire disparaître à
 * tort (`ARCHITECTURE.md` §48).
 */
export async function supprimerAchatTva(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(achatsTva)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(achatsTva.id, id), isNull(achatsTva.deletedAt)))
      .returning();
    return row;
  });
}
