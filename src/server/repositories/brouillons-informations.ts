import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { brouillonsInformations } from "../db/schema";
import { PropositionExtractionSchema, type PropositionExtraction, type LectureDictee } from "../ai/schemas/extraction";
import type { Ctx } from "./context";

export type Brouillon = {
  id: string;
  chantierId: string;
  contenu: PropositionExtraction;
  statut: "brouillon" | "confirme";
  modifieParHumain: boolean;
  /** Comprise par un modèle, ou recopiée mot à mot — voir LectureDictee. */
  lecture: LectureDictee;
  sourceTranscription: string | null;
  confirmeAt: Date | null;
  updatedAt: Date;
};

// Le contenu stocké est revalidé à la lecture : une ligne écrite par une
// version antérieure du schéma ne doit jamais ressortir sous une forme
// inattendue. En cas d'écart, on renvoie ce qui est récupérable plutôt que de
// faire échouer l'écran — mais jamais de données inventées.
function versBrouillon(row: typeof brouillonsInformations.$inferSelect): Brouillon {
  const analyse = PropositionExtractionSchema.safeParse(row.contenu);
  return {
    id: row.id,
    chantierId: row.chantierId,
    contenu: analyse.success ? analyse.data : PropositionExtractionSchema.parse({}),
    statut: row.statut,
    modifieParHumain: row.modifieParHumain,
    lecture: row.lecture,
    sourceTranscription: row.sourceTranscription,
    confirmeAt: row.confirmeAt,
    updatedAt: row.updatedAt,
  };
}

export async function getBrouillon(ctx: Ctx, chantierId: string): Promise<Brouillon | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(brouillonsInformations)
      .where(eq(brouillonsInformations.chantierId, chantierId))
      .limit(1);
    return rows[0] ? versBrouillon(rows[0]) : null;
  });
}

// Écrit le résultat d'une génération. Remet `modifie_par_humain` à false : le
// contenu redevient une proposition de la machine, que le patron n'a pas encore
// touchée. L'appelant est responsable d'avoir vérifié qu'aucune correction
// humaine n'est écrasée (voir brouillon-service.ts) — ce dépôt ne fait
// qu'exécuter une décision déjà prise.
export async function enregistrerGeneration(
  ctx: Ctx,
  chantierId: string,
  contenu: PropositionExtraction,
  sourceTranscription: string | null,
  lecture: LectureDictee = "modele"
): Promise<Brouillon> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existant] = await tx
      .select()
      .from(brouillonsInformations)
      .where(eq(brouillonsInformations.chantierId, chantierId))
      .limit(1);

    if (existant) {
      const [row] = await tx
        .update(brouillonsInformations)
        .set({
          contenu,
          sourceTranscription,
          lecture,
          statut: "brouillon",
          modifieParHumain: false,
          confirmeAt: null,
          updatedAt: new Date(),
        })
        .where(eq(brouillonsInformations.id, existant.id))
        .returning();
      return versBrouillon(row);
    }

    const [row] = await tx
      .insert(brouillonsInformations)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, contenu, sourceTranscription, lecture })
      .returning();
    return versBrouillon(row);
  });
}

// Correction humaine : marque définitivement le brouillon comme retouché. Ce
// drapeau ne redevient false que par une génération explicitement acceptée.
export async function enregistrerCorrectionHumaine(
  ctx: Ctx,
  chantierId: string,
  contenu: PropositionExtraction
): Promise<Brouillon | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(brouillonsInformations)
      .set({ contenu, modifieParHumain: true, statut: "brouillon", confirmeAt: null, updatedAt: new Date() })
      .where(eq(brouillonsInformations.chantierId, chantierId))
      .returning();
    return row ? versBrouillon(row) : null;
  });
}

export async function marquerConfirme(ctx: Ctx, chantierId: string): Promise<Brouillon | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const maintenant = new Date();
    const [row] = await tx
      .update(brouillonsInformations)
      .set({ statut: "confirme", confirmeAt: maintenant, updatedAt: maintenant })
      .where(eq(brouillonsInformations.chantierId, chantierId))
      .returning();
    return row ? versBrouillon(row) : null;
  });
}

export async function supprimerBrouillon(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(brouillonsInformations).where(eq(brouillonsInformations.chantierId, chantierId));
  });
}
