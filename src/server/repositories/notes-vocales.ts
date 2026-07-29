import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { notesVocales, fichiersAPurger } from "../db/schema";
import type { Ctx } from "./context";

type FichierAudio = {
  storageKey: string;
  mimeType: string;
  tailleOctets: number;
  nomOriginal?: string;
  checksum: string;
  dureeSecondes?: number;
};

export async function getNoteVocale(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx.select().from(notesVocales).where(eq(notesVocales.chantierId, chantierId)).limit(1);
    return rows[0] ?? null;
  });
}

// Séquence de remplacement sécurisée (voir docs/ARCHITECTURE_DONNEES_v2.1_corrections.md
// correction 7) : l'appelant a déjà déposé le NOUVEAU fichier sous une nouvelle
// storage_key et vérifié son checksum AVANT d'appeler cette fonction. Ici, en une
// seule transaction : la ligne est mise à jour vers la nouvelle clé, et l'ancienne
// clé est mise en file de purge différée — jamais supprimée immédiatement. Si
// cette transaction échoue (exception, rollback), l'ancienne clé reste la valeur
// active en base : aucune perte possible de la dernière version valide.
export async function enregistrerNoteVocale(ctx: Ctx, chantierId: string, fichier: FichierAudio) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx.select().from(notesVocales).where(eq(notesVocales.chantierId, chantierId)).limit(1);

    if (existante) {
      const [row] = await tx
        .update(notesVocales)
        .set({
          ...fichier,
          transcription: null,
          transcriptionStatut: "non_demandee",
          transcriptionErreur: null,
          updatedAt: new Date(),
        })
        .where(eq(notesVocales.id, existante.id))
        .returning();
      await tx.insert(fichiersAPurger).values({ storageKey: existante.storageKey });
      return row;
    }

    const [row] = await tx
      .insert(notesVocales)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, ...fichier })
      .returning();
    return row;
  });
}

// Suppression réelle et complète (pas un remplacement) : retire la note et met
// son fichier en file de purge différée — jamais de suppression physique
// immédiate, même ici.
export async function supprimerNoteVocale(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx.select().from(notesVocales).where(eq(notesVocales.chantierId, chantierId)).limit(1);
    if (!existante) return null;
    await tx.delete(notesVocales).where(eq(notesVocales.id, existante.id));
    await tx.insert(fichiersAPurger).values({ storageKey: existante.storageKey });
    return existante;
  });
}

// --- États de transcription (lot IA-01) -----------------------------------
// non_demandee -> en_cours -> reussie | echouee. Jamais de transcription
// inventée en cas d'échec : le champ `transcription` ne change que sur succès.

export async function marquerTranscriptionEnCours(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(notesVocales)
      .set({ transcriptionStatut: "en_cours", transcriptionErreur: null, updatedAt: new Date() })
      .where(eq(notesVocales.chantierId, chantierId))
      .returning();
    return row;
  });
}

export async function enregistrerSuccesTranscription(ctx: Ctx, chantierId: string, texte: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(notesVocales)
      .set({ transcription: texte, transcriptionStatut: "reussie", transcriptionErreur: null, updatedAt: new Date() })
      .where(eq(notesVocales.chantierId, chantierId))
      .returning();
    return row;
  });
}

export async function enregistrerEchecTranscription(ctx: Ctx, chantierId: string, erreur: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(notesVocales)
      .set({ transcriptionStatut: "echouee", transcriptionErreur: erreur, updatedAt: new Date() })
      .where(eq(notesVocales.chantierId, chantierId))
      .returning();
    return row;
  });
}
