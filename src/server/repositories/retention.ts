import { eq, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  audiosAPurger,
  fichiersAPurger,
  notesVocales,
  photosDiagnostic,
  photosDiagnosticAPurger,
} from "../db/schema";

// Application des durées de conservation — voir docs/RGPD.md §4.
//
// Opération d'exploitation, déclenchée par le planificateur, qui traverse
// toutes les entreprises. Jamais appelée depuis une requête d'utilisateur.
//
// Elle travaille depuis la file `audios_a_purger`, alimentée au moment où la
// transcription réussit. Un balayage direct de `notes_vocales` ne renverrait
// rien : cette table est cloisonnée par entreprise, et le planificateur n'a le
// contexte d'aucune. Le piège est qu'il ne renverrait rien *silencieusement* —
// la purge paraîtrait fonctionner sans jamais rien purger.

export type RapportRetention = {
  audiosPurges: number;
};

export type RapportPhotosDiagnostic = {
  photosPurgees: number;
};

/**
 * Purge l'audio des notes dont la transcription est acquise depuis assez
 * longtemps pour qu'on n'ait plus à y revenir.
 *
 * L'objet de stockage n'est pas détruit ici mais **mis en file de purge** :
 * c'est la mécanique déjà en place pour les fichiers orphelins, et elle a une
 * vertu — une transaction annulée ne laisse jamais un fichier effacé face à
 * une ligne encore vivante.
 *
 * La note vocale survit à son audio, avec sa transcription : on efface
 * l'enregistrement, jamais le travail qu'il a produit.
 */
export async function purgerAudiosTranscrits(
  maintenant: Date = new Date()
): Promise<RapportRetention> {
  return db.transaction(async (tx) => {
    const echues = await tx
      .select()
      .from(audiosAPurger)
      .where(lte(audiosAPurger.purgerLe, maintenant));

    let purges = 0;
    for (const entree of echues) {
      // Le contexte vient de la file, donc du serveur — jamais d'une entrée
      // d'utilisateur. L'isolation reste entière : on ne la contourne pas, on
      // adopte successivement celle de chaque entreprise concernée.
      await tx.execute(
        sql`SELECT set_config('app.entreprise_id', ${entree.entrepriseId}, true)`
      );

      const [note] = await tx
        .update(notesVocales)
        .set({ storageKey: null, audioPurgeLe: maintenant })
        .where(eq(notesVocales.id, entree.noteId))
        .returning({ id: notesVocales.id });

      // La note a pu disparaître entre la mise en file et l'échéance. La clé de
      // stockage doit alors être purgée quand même : elle a été mise en file
      // par la suppression de la note, et la doublonner ici ne ferait
      // qu'échouer sur un objet déjà retiré.
      if (note) {
        await tx.insert(fichiersAPurger).values({ storageKey: entree.storageKey });
        purges++;
      }

      await tx.delete(audiosAPurger).where(eq(audiosAPurger.id, entree.id));
    }

    return { audiosPurges: purges };
  });
}

/**
 * Purge les photos de diagnostic arrivées à échéance.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Même mécanique que la purge des audios, et pour les mêmes raisons.** Un
 * balayage direct de `photos_diagnostic` ne renverrait rien : la table est
 * cloisonnée par entreprise et le planificateur n'a le contexte d'aucune. Le
 * piège est qu'il ne renverrait rien *silencieusement* — la purge paraîtrait
 * fonctionner sans jamais rien purger. On adopte donc successivement le
 * contexte de chaque entreprise concernée, depuis la file : l'isolation n'est
 * pas contournée, elle est empruntée.
 *
 * **L'échéance vient d'une politique CONFIGURABLE** (`src/lib/retention-
 * diagnostic.ts`), calculée au moment où la photo est rangée — jamais gravée
 * dans le code. Une photo rattachée à un chantier suit la règle du dossier
 * chantier, qui peut différer et qui, par défaut, ne purge pas.
 *
 * **Le diagnostic survit à sa photo** : il garde son nom de problème, sa date,
 * sa fiche et sa traçabilité. C'est tout ce qui sert — et c'est tout ce qu'on
 * garde du jardin de quelqu'un.
 */
export async function purgerPhotosDiagnostic(
  maintenant: Date = new Date()
): Promise<RapportPhotosDiagnostic> {
  return db.transaction(async (tx) => {
    const echues = await tx
      .select()
      .from(photosDiagnosticAPurger)
      .where(lte(photosDiagnosticAPurger.purgerLe, maintenant));

    let purgees = 0;
    for (const entree of echues) {
      // Le contexte vient de la file, donc du serveur — jamais d'une entrée
      // d'utilisateur.
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entree.entrepriseId}, true)`);

      const [photo] = await tx
        .update(photosDiagnostic)
        .set({ storageKey: null, purgeeLe: maintenant })
        .where(eq(photosDiagnostic.id, entree.photoId))
        .returning({ id: photosDiagnostic.id });

      // La photo a pu disparaître entre la mise en file et l'échéance (le
      // diagnostic supprimé, le chantier supprimé). La clé de stockage doit
      // alors être purgée quand même — mais sans doublonner l'objet.
      if (photo) {
        await tx.insert(fichiersAPurger).values({ storageKey: entree.storageKey });
        purgees++;
      }

      await tx.delete(photosDiagnosticAPurger).where(eq(photosDiagnosticAPurger.id, entree.id));
    }

    return { photosPurgees: purgees };
  });
}
