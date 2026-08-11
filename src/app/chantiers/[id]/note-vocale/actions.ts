"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { enregistrerNoteVocale, supprimerNoteVocale } from "@/server/repositories/notes-vocales";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier, verifierTypeAudio } from "@/server/upload-limits";
import { logger } from "@/server/logger";
import { lancerTranscription } from "@/server/ai/services/transcription-service";
import { completerNoteVocale } from "@/server/ai/services/complement-note-service";

function extensionPour(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("aac")) return ".aac";
  if (mimeType.includes("flac")) return ".flac";
  return ".audio";
}

/**
 * Ce que l'enregistrement d'une note peut donner.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce n'est plus une exception.** Le 11 août 2026, le patron envoie
 * une capture de son téléphone : *« Impossible d'enregistrer la note pour
 * l'instant. Réessayez. »* Et personne — ni lui, ni le journal du serveur, ni
 * moi — ne pouvait dire pourquoi. Les quatre refus possibles (aucun fichier,
 * fichier trop lourd, format non pris en charge, cadence dépassée) portaient
 * chacun leur phrase, et l'écran les jetait toutes dans un `catch {}` pour
 * afficher la même formule creuse.
 *
 * Deux choses le rendaient inévitable :
 *
 *   1. **`catch {}` sans variable.** Le message n'était même pas lu.
 *   2. **Une exception ne traverse pas la version bâtie.** Next.js remplace en
 *      production le message d'une action serveur par un identifiant opaque —
 *      c'est une protection, pas un défaut. L'écran de l'import de fichier
 *      montrait `err.message` en croyant bien faire : chez le patron, il ne
 *      pouvait afficher qu'un digest. Le banc sert une version bâtie ; il était
 *      donc dans ce cas.
 *
 * La documentation de Next.js le dit en toutes lettres — « avoid using
 * try/catch blocks and throw errors. Instead, model expected errors as return
 * values » (`node_modules/next/dist/docs/01-app/01-getting-started/
 * 10-error-handling.md`). Un refus ATTENDU est donc une valeur de retour, qui
 * traverse la version bâtie intacte. Restent les pannes IMPRÉVUES — stockage,
 * base — qui continuent de lever : elles sont des anomalies, pas des réponses.
 */
export type ResultatNoteVocale =
  | { ok: true; storageKey: string | null; dureeSecondes: number | null }
  | { ok: false; raison: string };

export async function enregistrerNoteVocaleAction(
  chantierId: string,
  formData: FormData
): Promise<ResultatNoteVocale> {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    return { ok: false, raison: "Aucun son n'est arrivé jusqu'au serveur." };
  }
  const validationTaille = verifierTailleFichier(fichier);
  if (!validationTaille.ok) {
    return { ok: false, raison: validationTaille.message };
  }
  // Contrôle serveur du format : l'écran filtre déjà via `accept`, mais cet
  // attribut n'est qu'un confort d'interface et ne protège rien.
  const validationType = verifierTypeAudio(fichier.type);
  if (!validationType.ok) {
    // **Le type refusé est NOMMÉ.** Sans lui, un format que le téléphone du
    // patron produit et que la liste blanche ignore reste introuvable : le
    // message dirait « format non pris en charge » sans jamais dire lequel, et
    // il faudrait le lui demander. Une erreur doit désigner le bon coupable.
    return {
      ok: false,
      raison: `${validationType.message} (le téléphone a envoyé « ${fichier.type || "aucun type"} »)`,
    };
  }
  const dureeSecondes = Number(formData.get("dureeSecondes") ?? 0) || undefined;

  const ctx = await getCurrentCtx();

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) {
    return { ok: false, raison: limite.message };
  }

  // **Un enregistrement vide n'est pas un enregistrement.** Sur certains
  // téléphones, le micro rend zéro octet sans se plaindre ; l'accepter, c'est
  // poser une note muette qu'aucune transcription ne pourra lire, et laisser
  // croire que la dictée a été prise.
  const octets = Buffer.from(await fichier.arrayBuffer());
  if (octets.byteLength === 0) {
    return {
      ok: false,
      raison: "L'enregistrement est vide — le micro n'a rien capté. Réessayez en parlant après l'appui.",
    };
  }

  const mimeType = fichier.type || "audio/webm";

  // Le stockage et la base peuvent tomber : ce sont des anomalies, pas des
  // réponses. On lève encore — mais on ÉCRIT d'abord, parce qu'en production le
  // message ne parviendra pas jusqu'à l'écran, et que sans cette ligne il ne
  // resterait de la panne aucune trace nulle part. C'est exactement ce qui a
  // manqué le 11 août 2026.
  try {
    const objet = await enregistrerObjet(`chantiers/${chantierId}/notes`, octets, extensionPour(mimeType));

    const note = await enregistrerNoteVocale(ctx, chantierId, {
      storageKey: objet.storageKey,
      mimeType,
      tailleOctets: objet.tailleOctets,
      nomOriginal: fichier.name || undefined,
      checksum: objet.checksum,
      dureeSecondes,
    });

    return { ok: true, storageKey: note.storageKey, dureeSecondes: note.dureeSecondes };
  } catch (err) {
    logger.error("Note vocale : l'enregistrement a échoué", {
      chantierId,
      mimeType,
      tailleOctets: octets.byteLength,
      motif: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function supprimerNoteVocaleAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await supprimerNoteVocale(ctx, chantierId);
}

// Simple déclencheur — toute la logique métier vit dans le service
// (src/server/ai/services/transcription-service.ts), réutilisable demain
// depuis un upload, une file de traitement, un cron, un webhook ou l'assistant
// conversationnel, sans aucune modification de cette logique.
export async function lancerTranscriptionAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return lancerTranscription(ctx, chantierId);
}

/**
 * Ajouter à une note vocale qu'on a arrêtée trop tôt.
 *
 * Le patron, le 7 août 2026 : « sans faire exprès j'ai mis fin à ma note vocale
 * mais j'avais encore des choses à dire ». La seule issue était « Remplacer la
 * note » — tout refaire. Le complément s'ajoute désormais à la suite ; le
 * pourquoi de ce choix vit dans `complement-note-service.ts`.
 */
export async function completerNoteVocaleAction(chantierId: string, formData: FormData) {
  // Mêmes refus qu'à l'enregistrement, rendus plutôt que levés pour la même
  // raison : voir `ResultatNoteVocale` ci-dessus.
  //
  // **Mais ils ne peuvent pas emprunter le champ `raison` du service.** Celui-ci
  // y met des CODES — « aucune_note », « transcription », « vide » — que l'écran
  // traduit en phrases. Y glisser une phrase toute faite la ferait comparer à
  // « vide », échouer, et retomber sur le libellé générique : le refus
  // redeviendrait muet, ce qu'on est précisément en train de réparer. Les refus
  // d'entrée portent donc leur texte dans `detail`, que l'écran affiche tel quel.
  const refus = (detail: string) => ({ ok: false as const, raison: "refuse" as const, detail });

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) return refus("Aucun son n'est arrivé jusqu'au serveur.");

  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return refus(taille.message);
  const type = verifierTypeAudio(fichier.type);
  if (!type.ok) {
    return refus(`${type.message} (le téléphone a envoyé « ${fichier.type || "aucun type"} »)`);
  }

  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return refus(limite.message);

  const octets = Buffer.from(await fichier.arrayBuffer());
  if (octets.byteLength === 0) {
    return refus("L'enregistrement est vide — le micro n'a rien capté. Réessayez en parlant après l'appui.");
  }

  // **Le service rend DÉJÀ un résultat, pas une exception** — `ResultatComplement`,
  // avec ses propres raisons (« aucune_note », « transcription », « vide ») que
  // l'écran traduit. On le rend tel quel : l'envelopper dans un second `ok`
  // ferait passer un `{ ok: false }` du service pour une réussite.
  try {
    return await completerNoteVocale(ctx, chantierId, octets, fichier.type || "audio/webm");
  } catch (err) {
    logger.error("Note vocale : le complément a échoué", {
      chantierId,
      mimeType: fichier.type,
      tailleOctets: octets.byteLength,
      motif: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
