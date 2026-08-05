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
    // **Les deux sens de l'invariant `montant = quantité × prix unitaire`.**
    //
    // De bas en haut : un montant modifié seul (écran Prix, où c'est le seul
    // champ) donne quantité 1 et prix unitaire égal au montant.
    //
    // De haut en bas : une quantité ou un prix unitaire modifié (le devis
    // écrit à la main) recalcule le montant. **Ce sens manquait** — trois
    // tilleuls à 250 € donnaient un montant resté à 0,00 €, donc un devis à
    // zéro alors que l'écran affichait 750 €. Une ligne dont le total ne
    // correspond pas à son détail ne se rattrape que par un avoir.
    const patch: typeof data = { ...data };
    if (data.montant !== undefined && data.prixUnitaire === undefined && data.quantite === undefined) {
      patch.prixUnitaire = data.montant;
      patch.quantite = "1";
    } else if (data.montant === undefined && (data.prixUnitaire !== undefined || data.quantite !== undefined)) {
      const [avant] = await tx.select().from(lignesPrix).where(eq(lignesPrix.id, id)).limit(1);
      if (avant) {
        const q = new Decimal(patch.quantite ?? avant.quantite);
        const pu = new Decimal(patch.prixUnitaire ?? avant.prixUnitaire);
        patch.montant = q.times(pu).toFixed(2);
      }
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
