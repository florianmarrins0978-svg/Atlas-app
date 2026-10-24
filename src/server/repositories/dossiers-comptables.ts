import { asc, desc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { bilansComptables, dossiersComptables } from "../db/schema";
import { periodeDuDossierEnCours } from "@/lib/pour-mon-comptable";
import type { Ctx } from "./context";

/**
 * POUR MON COMPTABLE, LOT 3 — les dossiers arrêtés et les bilans (migration
 * 0144). L'application ne peut ni réécrire ni effacer un dossier : la base ne
 * lui donne que SELECT et INSERT.
 */

/** Le jour de fin du dernier dossier arrêté, ou rien. */
export async function dernierAu(ctx: Ctx): Promise<string | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx.select({ au: dossiersComptables.au }).from(dossiersComptables).orderBy(desc(dossiersComptables.au)).limit(1);
    return d?.au ?? null;
  });
}

/** La période du dossier en cours : du lendemain du dernier arrêt jusqu'à aujourd'hui. */
export async function dossierEnCours(ctx: Ctx, maintenant: Date): Promise<{ du: string; au: string; premier: boolean }> {
  const fin = await dernierAu(ctx);
  return { ...periodeDuDossierEnCours(maintenant, fin), premier: fin === null };
}

export type DossierRange = {
  id: string;
  du: string;
  au: string;
  tailleOctets: number;
  gardeJusquAu: string;
  arreteLe: Date;
  bilans: { id: string; fichierNom: string | null; nature: "photo" | "pdf"; ajouteLe: Date }[];
};

/** Les dossiers rangés, le plus récent d'abord, avec leurs bilans. */
export async function listerDossiers(ctx: Ctx): Promise<DossierRange[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const dossiers = await tx.select().from(dossiersComptables).orderBy(desc(dossiersComptables.au));
    const bilans = await tx.select().from(bilansComptables).orderBy(asc(bilansComptables.ajouteLe));
    return dossiers.map((d) => ({
      id: d.id,
      du: d.du,
      au: d.au,
      tailleOctets: d.tailleOctets,
      gardeJusquAu: d.gardeJusquAu,
      arreteLe: d.arreteLe,
      bilans: bilans
        .filter((b) => b.dossierId === d.id)
        .map((b) => ({ id: b.id, fichierNom: b.fichierNom, nature: b.nature, ajouteLe: b.ajouteLe })),
    }));
  });
}

/**
 * Range un dossier arrêté. **Refusé si un autre dossier commence le même
 * jour** (l'index unique) : deux appuis rapprochés ne rangent jamais deux
 * dossiers pour la même période.
 */
export async function rangerDossier(
  ctx: Ctx,
  d: { du: string; au: string; fichierCle: string; tailleOctets: number; empreinte: string; gardeJusquAu: string }
): Promise<{ ok: true; id: string } | { ok: false; raison: string }> {
  try {
    return await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [r] = await tx
        .insert(dossiersComptables)
        .values({ ...d, entrepriseId: ctx.entrepriseId, arretePar: ctx.utilisateurId })
        .returning({ id: dossiersComptables.id });
      return { ok: true as const, id: r.id };
    });
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if ((e?.cause?.code ?? e?.code) === "23505") return { ok: false, raison: "Ce dossier est déjà rangé." };
    throw err;
  }
}

/** Le fichier d'un dossier de l'entreprise, ou rien. */
export async function fichierDuDossier(ctx: Ctx, id: string): Promise<{ cle: string; du: string; au: string } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .select({ cle: dossiersComptables.fichierCle, du: dossiersComptables.du, au: dossiersComptables.au })
      .from(dossiersComptables)
      .where(eq(dossiersComptables.id, id))
      .limit(1);
    return d ?? null;
  });
}

export async function ajouterBilan(
  ctx: Ctx,
  b: { dossierId: string; fichierCle: string; fichierNom: string | null; nature: "photo" | "pdf"; tailleOctets: number; empreinte: string }
): Promise<{ ok: true; id: string } | { ok: false; raison: string }> {
  try {
    return await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [r] = await tx
        .insert(bilansComptables)
        .values({ ...b, entrepriseId: ctx.entrepriseId, ajoutePar: ctx.utilisateurId })
        .returning({ id: bilansComptables.id });
      return { ok: true as const, id: r.id };
    });
  } catch (err) {
    // La clé double refuse le dossier d'une autre entreprise : un refus attendu.
    const e = err as { code?: string; cause?: { code?: string } };
    if ((e?.cause?.code ?? e?.code) === "23503") return { ok: false, raison: "Ce dossier n'existe pas." };
    throw err;
  }
}

export async function fichierDuBilan(ctx: Ctx, id: string): Promise<{ cle: string; nature: "photo" | "pdf"; nom: string | null } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [b] = await tx
      .select({ cle: bilansComptables.fichierCle, nature: bilansComptables.nature, nom: bilansComptables.fichierNom })
      .from(bilansComptables)
      .where(eq(bilansComptables.id, id))
      .limit(1);
    return b ?? null;
  });
}

/** Retirer un bilan ajouté par erreur. Rend sa clé de stockage, pour effacer le fichier. */
export async function retirerBilan(ctx: Ctx, id: string): Promise<string | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [b] = await tx.delete(bilansComptables).where(eq(bilansComptables.id, id)).returning({ cle: bilansComptables.fichierCle });
    return b?.cle ?? null;
  });
}
