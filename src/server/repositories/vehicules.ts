import { and, asc, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { vehicules } from "../db/schema";
import type { Ctx } from "./context";
import {
  CHAMP_DU_CONTROLE,
  CHAMP_VU_DU_CONTROLE,
  estControleVehicule,
  refusDuVu,
  type NatureDocumentVehicule,
} from "@/lib/vehicules";

/**
 * Les véhicules de l'entreprise (migration 0131). Les règles — seuils des
 * rappels, ce qu'un papier remplit, ce qu'une case accepte — sont dans
 * `src/lib/vehicules.ts` ; ici, on lit et on écrit, toujours sous
 * `withEntreprise`.
 */

export type VehiculeEnBase = typeof vehicules.$inferSelect;

/** Les colonnes où vit chaque papier. */
export const COLONNES_DU_DOCUMENT = {
  carte_grise: { cle: "carteGriseCle", le: "carteGriseLe" },
  assurance: { cle: "assuranceCle", le: "assuranceLe" },
  controle_technique: { cle: "controleCle", le: "controleLe" },
} as const satisfies Record<NatureDocumentVehicule, { cle: keyof VehiculeEnBase; le: keyof VehiculeEnBase }>;

/** Les papiers déposés sur un véhicule, dans l'ordre de la liste. */
export function documentsDuVehicule(v: VehiculeEnBase): { nature: NatureDocumentVehicule; le: Date }[] {
  return (Object.keys(COLONNES_DU_DOCUMENT) as NatureDocumentVehicule[]).flatMap((nature) => {
    const c = COLONNES_DU_DOCUMENT[nature];
    const le = v[c.le] as Date | null;
    return v[c.cle] && le ? [{ nature, le }] : [];
  });
}

export async function listerVehicules(ctx: Ctx): Promise<VehiculeEnBase[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(vehicules).where(isNull(vehicules.deletedAt)).orderBy(asc(vehicules.createdAt))
  );
}

export async function getVehicule(ctx: Ctx, id: string): Promise<VehiculeEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx
      .select()
      .from(vehicules)
      .where(and(eq(vehicules.id, id), isNull(vehicules.deletedAt)));
    return v;
  });
}

export async function creerVehicule(ctx: Ctx, nom: string): Promise<VehiculeEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx
      .insert(vehicules)
      .values({ entrepriseId: ctx.entrepriseId, nom, createdBy: ctx.utilisateurId })
      .returning();
    return v;
  });
}

/** `undefined` si le véhicule n'existe pas, ou plus, pour cette entreprise. */
export async function mettreAJourVehicule(
  ctx: Ctx,
  id: string,
  modifications: Partial<Omit<VehiculeEnBase, "id" | "entrepriseId" | "createdAt" | "createdBy" | "deletedAt">>
): Promise<VehiculeEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx
      .update(vehicules)
      .set({ ...modifications, updatedAt: new Date() })
      .where(and(eq(vehicules.id, id), isNull(vehicules.deletedAt)))
      .returning();
    return v;
  });
}

/** Un véhicule vendu sort de la liste ; sa ligne et ses papiers restent pour l'export. */
export async function retirerVehicule(ctx: Ctx, id: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const retires = await tx
      .update(vehicules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vehicules.id, id), isNull(vehicules.deletedAt)))
      .returning({ id: vehicules.id });
    return retires.length === 1;
  });
}

/**
 * « J'ai vu » sur le rappel d'un contrôle — sa demande du 3 novembre 2026
 * (migration 0159). Retient la date limite vue, pour cette échéance seule.
 *
 * **La règle est rejouée ici, sur la ligne verrouillée** (`refusDuVu`) : l'écran
 * a pu être ouvert la veille de l'échéance, ou la date changée par un
 * procès-verbal entre l'affichage et le geste. `jour` est celui de l'atelier
 * (`jourIso`), comme pour l'accueil qui a montré la carte.
 */
export async function marquerRappelVehiculeVu(
  ctx: Ctx,
  vehiculeId: string,
  controle: string,
  avant: string,
  jour: string
): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (!estControleVehicule(controle)) return { ok: false, raison: "Ce rappel ne se range pas. Rechargez l’écran." };
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx
      .select()
      .from(vehicules)
      .where(and(eq(vehicules.id, vehiculeId), isNull(vehicules.deletedAt)))
      .for("update");
    if (!v) return { ok: false as const, raison: "Ce véhicule n’existe plus. Rechargez l’écran." };
    const refus = refusDuVu(v[CHAMP_DU_CONTROLE[controle]], avant, controle, jour);
    if (refus) return { ok: false as const, raison: refus };
    await tx
      .update(vehicules)
      .set({ [CHAMP_VU_DU_CONTROLE[controle]]: avant })
      .where(eq(vehicules.id, vehiculeId));
    return { ok: true as const };
  });
}
