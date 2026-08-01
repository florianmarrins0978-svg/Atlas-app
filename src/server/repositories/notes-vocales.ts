import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { notesVocales, fichiersAPurger, audiosAPurger } from "../db/schema";
import type { Ctx } from "./context";
import { RETENTION } from "../retention";

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
      // L'audio précédent a pu déjà être purgé après transcription : il n'y a
      // alors plus rien à mettre en file, et l'y pousser créerait une entrée
      // pointant vers un objet inexistant.
      if (existante.storageKey) {
        await tx.insert(fichiersAPurger).values({ storageKey: existante.storageKey });
      }
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
    // Rien à mettre en file si l'audio a déjà été purgé après transcription.
    if (existante.storageKey) {
      await tx.insert(fichiersAPurger).values({ storageKey: existante.storageKey });
    }
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

    // Le texte obtenu, l'audio n'a plus de raison de vivre indéfiniment : on
    // programme sa purge (docs/RGPD.md §4). Le faire ICI plutôt que par un
    // balayage ultérieur est la seule façon de rester dans le contexte de
    // l'entreprise — le planificateur, lui, n'en a aucun.
    //
    // Le délai laisse le temps de reprendre une transcription contestée depuis
    // sa source. `onConflictDoUpdate` couvre la retranscription : l'échéance
    // repart de la dernière réussite, jamais de la première.
    if (row?.storageKey) {
      await tx
        .insert(audiosAPurger)
        .values({
          noteId: row.id,
          entrepriseId: ctx.entrepriseId,
          storageKey: row.storageKey,
          purgerLe: new Date(Date.now() + RETENTION.audioApresTranscriptionJours * 86_400_000),
        })
        .onConflictDoUpdate({
          target: audiosAPurger.noteId,
          set: {
            storageKey: row.storageKey,
            purgerLe: new Date(Date.now() + RETENTION.audioApresTranscriptionJours * 86_400_000),
          },
        });
    }

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
