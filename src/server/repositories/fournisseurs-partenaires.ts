import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { demandesEnvoyees, devisRecus, margesAchat, prixAchat, societesAchat, type LigneDemandeEnvoyee } from "../db/schema";
import type { Ctx } from "./context";
import type { PrixAchatCandidat, RubriqueAchat } from "@/lib/prix-achat";

/**
 * Ses fournisseurs et ses partenaires (migration 0132). Les règles — la marge
 * qui vaut, l'ordre des prix, la recherche — vivent dans `src/lib/prix-achat.ts` ;
 * ici, on lit et on écrit, toujours sous `withEntreprise`.
 */

export type SocieteEnBase = typeof societesAchat.$inferSelect;
export type PrixAchatEnBase = typeof prixAchat.$inferSelect;
export type DevisRecuEnBase = typeof devisRecus.$inferSelect;
export type DemandeEnBase = typeof demandesEnvoyees.$inferSelect;

export type SocieteComplete = SocieteEnBase & {
  prix: PrixAchatEnBase[];
  devis: DevisRecuEnBase[];
  demandes: DemandeEnBase[];
};

/** Les sociétés d'une rubrique, avec ce que chacune porte. */
export async function listerSocietes(ctx: Ctx, rubrique: RubriqueAchat): Promise<SocieteComplete[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const societes = await tx
      .select()
      .from(societesAchat)
      .where(and(eq(societesAchat.rubrique, rubrique), isNull(societesAchat.deletedAt)))
      .orderBy(asc(societesAchat.createdAt));
    if (societes.length === 0) return [];
    const ids = societes.map((s) => s.id);
    // L'une après l'autre : une transaction n'a qu'une connexion, et trois
    // requêtes lancées ensemble s'y bousculent (pg le refusera en version 9).
    const prix = await tx.select().from(prixAchat).where(and(inArray(prixAchat.societeId, ids), isNull(prixAchat.deletedAt))).orderBy(desc(prixAchat.createdAt));
    const devis = await tx.select().from(devisRecus).where(and(inArray(devisRecus.societeId, ids), isNull(devisRecus.deletedAt))).orderBy(desc(devisRecus.createdAt));
    const demandes = await tx.select().from(demandesEnvoyees).where(inArray(demandesEnvoyees.societeId, ids)).orderBy(desc(demandesEnvoyees.envoyeeLe));
    return societes.map((s) => ({
      ...s,
      prix: prix.filter((p) => p.societeId === s.id),
      devis: devis.filter((d) => d.societeId === s.id),
      demandes: demandes.filter((d) => d.societeId === s.id),
    }));
  });
}

export async function getSociete(ctx: Ctx, id: string): Promise<SocieteEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [s] = await tx
      .select()
      .from(societesAchat)
      .where(and(eq(societesAchat.id, id), isNull(societesAchat.deletedAt)));
    return s;
  });
}

export async function creerSociete(ctx: Ctx, rubrique: RubriqueAchat, nom: string): Promise<SocieteEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [s] = await tx
      .insert(societesAchat)
      .values({ entrepriseId: ctx.entrepriseId, rubrique, nom, createdBy: ctx.utilisateurId })
      .returning();
    return s;
  });
}

/** `undefined` si la société n'existe pas, ou plus, pour cette entreprise. */
export async function reglerMargeSociete(ctx: Ctx, id: string, marge: string | null): Promise<SocieteEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [s] = await tx
      .update(societesAchat)
      .set({ marge, updatedAt: new Date() })
      .where(and(eq(societesAchat.id, id), isNull(societesAchat.deletedAt)))
      .returning();
    return s;
  });
}

export type MargesGenerales = { materiel: string | null; mainOeuvre: string | null };

export async function lireMarges(ctx: Ctx): Promise<MargesGenerales> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [m] = await tx.select().from(margesAchat);
    return { materiel: m?.materiel ?? null, mainOeuvre: m?.mainOeuvre ?? null };
  });
}

export async function reglerMarge(ctx: Ctx, laquelle: keyof MargesGenerales, marge: string | null): Promise<MargesGenerales> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [m] = await tx
      .insert(margesAchat)
      .values({ entrepriseId: ctx.entrepriseId, [laquelle]: marge })
      .onConflictDoUpdate({ target: margesAchat.entrepriseId, set: { [laquelle]: marge, updatedAt: new Date() } })
      .returning();
    return { materiel: m.materiel, mainOeuvre: m.mainOeuvre };
  });
}

export async function ajouterPrixAchat(
  ctx: Ctx,
  societeId: string,
  ligne: { nom: string; reference?: string | null; unite: string; prixHt: string; source: string; releveLe?: string; devisRecuId?: string | null }
): Promise<PrixAchatEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .insert(prixAchat)
      .values({ entrepriseId: ctx.entrepriseId, societeId, createdBy: ctx.utilisateurId, ...ligne })
      .returning();
    return p;
  });
}

export async function retirerPrixAchat(ctx: Ctx, id: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const r = await tx
      .update(prixAchat)
      .set({ deletedAt: new Date() })
      .where(and(eq(prixAchat.id, id), isNull(prixAchat.deletedAt)))
      .returning({ id: prixAchat.id });
    return r.length === 1;
  });
}

export async function ajouterDevisRecu(
  ctx: Ctx,
  societeId: string,
  devis: { nom: string; fichierCle: string; fichierNom: string | null; nature: "photo" | "pdf" }
): Promise<DevisRecuEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .insert(devisRecus)
      .values({ entrepriseId: ctx.entrepriseId, societeId, createdBy: ctx.utilisateurId, ...devis })
      .returning();
    return d;
  });
}

export async function getDevisRecu(ctx: Ctx, id: string): Promise<DevisRecuEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .select()
      .from(devisRecus)
      .where(and(eq(devisRecus.id, id), isNull(devisRecus.deletedAt)));
    return d;
  });
}

/** Une liste partie chez un fournisseur, gardée avec sa date. */
export async function enregistrerDemande(
  ctx: Ctx,
  societeId: string,
  demande: { titre: string; origine: "devis" | "arrosage"; lignes: LigneDemandeEnvoyee[] }
): Promise<DemandeEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .insert(demandesEnvoyees)
      .values({ entrepriseId: ctx.entrepriseId, societeId, createdBy: ctx.utilisateurId, ...demande })
      .returning();
    return d;
  });
}

const jourFrancais = (iso: string) => iso.split("-").reverse().join("/");

/** Tous ses prix d'achat, prêts à être rapprochés d'une ligne dictée. */
export async function prixAchatCandidats(ctx: Ctx): Promise<PrixAchatCandidat[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ p: prixAchat, s: societesAchat })
      .from(prixAchat)
      .innerJoin(societesAchat, eq(prixAchat.societeId, societesAchat.id))
      .where(and(isNull(prixAchat.deletedAt), isNull(societesAchat.deletedAt)));
    return lignes.map(({ p, s }) => ({
      id: p.id,
      nom: p.nom,
      unite: p.unite,
      prixHt: p.prixHt,
      releveLe: jourFrancais(p.releveLe),
      societeNom: s.nom,
      rubrique: s.rubrique,
      margePropre: s.marge,
    }));
  });
}
