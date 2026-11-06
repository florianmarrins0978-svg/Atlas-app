import { and, asc, eq, isNotNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, lignesPrix } from "../db/schema";
import type { Ctx } from "./context";
import { ligneApresSaReponse, type ReponseGrille } from "../../lib/hausse-du-devis";

/**
 * Le devis repris par « Dernier devis » : sa réponse au tarif du jour, et la
 * hausse (migration 0106, ses décisions du 26 septembre 2026).
 *
 * **Tout se recalcule depuis la base de chaque ligne, dans une seule
 * transaction.** Changer la réponse ou le taux réécrit le prix de TOUTES les
 * lignes reprises à partir de `prixAncien` (ou `prixGrille` s'il a dit oui) :
 * rien ne s'empile, et un prix affiché est toujours celui que la règle donne.
 * Une ligne retouchée à la main n'a plus de `prixAncien` : elle n'est pas lue.
 *
 * **La main d'œuvre répartie suit, depuis ses propres bases** (sa décision du
 * 6 novembre 2026) : « Mettre à jour » ne vise que le travail, sauf quand son
 * prix du jour par homme a bougé (`ligneApresSaReponse`).
 *
 * Rend les lignes réécrites, pour que l'écran les pose sans se recharger.
 */
export async function appliquerLaReprise(
  ctx: Ctx,
  chantierId: string,
  choix: { reponse?: ReponseGrille; hausse?: number }
): Promise<{
  reponse: ReponseGrille;
  hausse: number;
  lignes: { id: string; prixUnitaire: string; montant: string; partMainDoeuvre: string | null }[];
}> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const patch: { repriseGrille?: "oui" | "non" | null; hausseReprise?: string | null } = {};
    if (choix.reponse !== undefined) patch.repriseGrille = choix.reponse;
    if (choix.hausse !== undefined) patch.hausseReprise = choix.hausse > 0 ? String(choix.hausse) : null;

    const [chantier] = await tx
      .update(chantiers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning({ repriseGrille: chantiers.repriseGrille, hausseReprise: chantiers.hausseReprise });
    // La RLS ne rend rien pour un chantier d'une autre entreprise : rien ne
    // s'écrit, et l'écran ne reçoit aucune ligne.
    if (!chantier) return { reponse: null, hausse: 0, lignes: [] };

    const reponse = chantier.repriseGrille ?? null;
    const hausse = chantier.hausseReprise === null ? 0 : Number(chantier.hausseReprise);

    const reprises = await tx
      .select()
      .from(lignesPrix)
      .where(and(eq(lignesPrix.chantierId, chantierId), isNotNull(lignesPrix.prixAncien)))
      .orderBy(asc(lignesPrix.ordre));

    const ecrites: { id: string; prixUnitaire: string; montant: string; partMainDoeuvre: string | null }[] = [];
    for (const l of reprises) {
      if (l.prixAncien === null) continue;
      const apres = ligneApresSaReponse(
        {
          quantite: l.quantite,
          prixAncien: l.prixAncien,
          prixGrille: l.prixGrille,
          partAncienne: l.partAncienne,
          partGrille: l.partGrille,
        },
        reponse,
        hausse
      );
      const partMainDoeuvre = apres.partMainDoeuvre;
      await tx
        .update(lignesPrix)
        .set({ prixUnitaire: apres.prixUnitaire, montant: apres.montant, partMainDoeuvre, updatedAt: new Date() })
        .where(eq(lignesPrix.id, l.id));
      ecrites.push({ id: l.id, prixUnitaire: apres.prixUnitaire, montant: apres.montant, partMainDoeuvre });
    }
    return { reponse, hausse, lignes: ecrites };
  });
}
