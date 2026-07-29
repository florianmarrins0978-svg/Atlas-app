import { asc, eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import { lignesPrix } from "../db/schema";
import type { Ctx } from "./context";

export async function listerLignesPrix(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantierId)).orderBy(asc(lignesPrix.ordre))
  );
}

// L'écran Prix validé n'édite qu'un seul champ de montant par ligne (pas de
// saisie séparée quantité/prix unitaire dans l'interface actuelle). Le modèle,
// lui, porte déjà quantite/prixUnitaire/unite (aligné sur lignes_devis) pour
// permettre un futur écran plus détaillé sans nouvelle migration. Tant qu'aucune
// interface ne les édite séparément, l'invariant maintenu est :
// quantite = 1, prixUnitaire = montant.
export async function ajouterLignePrix(
  ctx: Ctx,
  chantierId: string,
  libelle: string,
  montant: string,
  options?: { quantite?: string; prixUnitaire?: string; unite?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantierId));
    const [row] = await tx
      .insert(lignesPrix)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        libelle,
        montant,
        quantite: options?.quantite ?? "1",
        prixUnitaire: options?.prixUnitaire ?? montant,
        unite: options?.unite,
        ordre: existantes.length,
      })
      .returning();
    return row;
  });
}

export async function modifierLignePrix(
  ctx: Ctx,
  id: string,
  data: { libelle?: string; montant?: string; quantite?: string; prixUnitaire?: string; unite?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // Si le montant change sans que quantite/prixUnitaire soient fournis
    // explicitement, on maintient l'invariant quantite=1 / prixUnitaire=montant
    // (seul champ éditable dans l'interface actuelle).
    const patch: typeof data = { ...data };
    if (data.montant !== undefined && data.prixUnitaire === undefined && data.quantite === undefined) {
      patch.prixUnitaire = data.montant;
      patch.quantite = "1";
    }
    const [row] = await tx
      .update(lignesPrix)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(lignesPrix.id, id))
      .returning();
    return row;
  });
}

export async function supprimerLignePrix(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(lignesPrix).where(eq(lignesPrix.id, id));
  });
}

export async function reordonnerLignesPrix(ctx: Ctx, chantierId: string, idsEnOrdre: string[]) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (let i = 0; i < idsEnOrdre.length; i++) {
      await tx
        .update(lignesPrix)
        .set({ ordre: i, updatedAt: new Date() })
        .where(eq(lignesPrix.id, idsEnOrdre[i]));
    }
  });
}

// Total exact en Decimal — jamais de somme via `number`/parseFloat. Retourne une
// chaîne décimale à 2 décimales ; la conversion en nombre n'intervient qu'au tout
// dernier moment, côté affichage (Intl.NumberFormat), jamais pendant le calcul.
export async function totalLignesPrix(ctx: Ctx, chantierId: string): Promise<string> {
  const lignes = await listerLignesPrix(ctx, chantierId);
  const total = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
  return total.toFixed(2);
}
