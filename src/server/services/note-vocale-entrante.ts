import { getCurrentCtx } from "@/server/session-ctx";
import { enregistrerNoteVocale } from "@/server/repositories/notes-vocales";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier, verifierTypeAudio } from "@/server/upload-limits";
import { logger } from "@/server/logger";
import { messageDePanne, type EtapeNote } from "@/lib/panne-note-vocale";

/**
 * Recevoir un enregistrement et le ranger — **écrit une seule fois**, pour les
 * trois endroits qui en envoient un : l'anneau de la fiche, l'écran de dictée,
 * et l'import d'un fichier déjà présent sur le téléphone.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction a quitté l'action serveur, le 12 août 2026.**
 *
 * Le patron a signalé trois fois de suite que sa note ne partait pas, avec la
 * même phrase : *« L'enregistrement n'a pas pu être transmis — la connexion a
 * été interrompue. »* Rendre les refus bavards n'y a rien changé, parce que le
 * refus n'était pas au bout : **l'appel lui-même n'aboutissait pas.**
 *
 * La cause tient à ce qu'est une action serveur : elle n'a pas d'adresse, elle
 * a un **identifiant fabriqué à la construction** et inscrit dans la page. Son
 * banc d'essai se reconstruit — c'est même son fonctionnement normal, il se met
 * à jour tout seul. Une page restée ouverte avant une reconstruction appelle
 * alors un identifiant que le nouveau serveur ne connaît plus, et l'appel
 * échoue. Le serveur va très bien ; c'est la page qui a vieilli.
 *
 * Cela explique tout ce qui rendait le défaut insaisissable :
 *
 *   - **il ne se reproduisait jamais ici.** Les suites ouvrent une page et
 *     agissent dans la seconde : l'identifiant est toujours frais ;
 *   - **le reste de l'application marchait.** Naviguer recharge la page, donc
 *     les identifiants. Or la fiche du chantier est justement l'écran où l'on
 *     STATIONNE — on l'ouvre, on regarde, puis on dicte ;
 *   - **aucun message de refus n'apparaissait**, puisque rien n'atteignait le
 *     serveur pour être refusé.
 *
 * Une **URL**, elle, ne vieillit pas. La réception passe donc par une route
 * (`src/app/api/notes-vocales/[chantierId]/route.ts`), et cette fonction porte
 * ce qu'elle fait — pour que les trois écrans en héritent au lieu de recopier
 * la règle chacun de son côté (`CLAUDE.md` §3).
 *
 * Trois bénéfices qui ne dépendent pas de l'hypothèse ci-dessus, et qui
 * justifieraient le changement à eux seuls :
 *
 *   1. le client reçoit un vrai code HTTP — 413, 401, 500 se distinguent, là où
 *      une action ne rend qu'un échec sans nature ;
 *   2. la limite de corps des actions serveur (15 Mo) ne s'applique plus ;
 *   3. l'envoi survit à une reconstruction du serveur.
 */
export type ResultatNoteVocale =
  | { ok: true; storageKey: string | null; dureeSecondes: number | null }
  | { ok: false; raison: string };

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
 * Ne lève jamais : toute panne devient une raison lisible qui **nomme le
 * maillon**. Une exception ne parviendrait de toute façon pas jusqu'à l'écran
 * du patron, et sa phrase de secours accuserait le réseau à tort.
 */
export async function recevoirNoteVocale(
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
    // patron produit et que la liste blanche ignore reste introuvable.
    return {
      ok: false,
      raison: `${validationType.message} (le téléphone a envoyé « ${fichier.type || "aucun type"} »)`,
    };
  }
  const dureeSecondes = Number(formData.get("dureeSecondes") ?? 0) || undefined;
  const mimeType = fichier.type || "audio/webm";

  let etape: EtapeNote = "session";
  try {
    const ctx = await getCurrentCtx();

    etape = "cadence";
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) {
      return { ok: false, raison: limite.message };
    }

    // **Un enregistrement vide n'est pas un enregistrement.** Sur certains
    // téléphones, le micro rend zéro octet sans se plaindre ; l'accepter, c'est
    // poser une note muette qu'aucune transcription ne pourra lire.
    etape = "lecture";
    const octets = Buffer.from(await fichier.arrayBuffer());
    if (octets.byteLength === 0) {
      return {
        ok: false,
        raison: "L'enregistrement est vide — le micro n'a rien capté. Réessayez en parlant après l'appui.",
      };
    }

    etape = "stockage";
    const objet = await enregistrerObjet(`chantiers/${chantierId}/notes`, octets, extensionPour(mimeType));

    etape = "base";
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
    // Le détail complet reste au journal — l'écran reçoit une phrase choisie.
    // Le 11 août, une erreur de base non traduite a affiché la requête SQL
    // entière, noms de tables et identifiant d'entreprise compris.
    logger.error("Note vocale : l'enregistrement a échoué", {
      chantierId,
      etape,
      mimeType,
      tailleOctets: fichier.size,
      motif: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: messageDePanne(etape, err) };
  }
}
