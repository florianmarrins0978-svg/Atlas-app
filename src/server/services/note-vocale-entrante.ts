import { getCurrentCtx } from "@/server/session-ctx";
import { enregistrerNoteVocale } from "@/server/repositories/notes-vocales";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerAudioEntrant } from "@/server/audio-entrant";
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

// `extensionPour(mimeType)` vivait ici. Elle est morte le 26 août 2026 avec le
// lot Audio : elle déduisait l'extension de la chaîne envoyée par le téléphone,
// et c'est précisément ce que ce lot ferme. Son repli `.audio` — inatteignable,
// et inconnu de `typeDepuisCle` — est parti avec elle.

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
  const dureeSecondes = Number(formData.get("dureeSecondes") ?? 0) || undefined;

  let etape: EtapeNote = "session";
  try {
    const ctx = await getCurrentCtx();

    etape = "cadence";
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) {
      return { ok: false, raison: limite.message };
    }

    // **LA PORTE COMMUNE — taille, lecture, vide, puis le FORMAT lu dans les
    // octets** (`src/server/audio-entrant.ts`). Elle vient APRÈS la cadence :
    // c'est elle qui empêche de la faire travailler en rafale.
    etape = "lecture";
    const audio = await preparerAudioEntrant(fichier);
    if (!audio.ok) return { ok: false, raison: audio.message };

    etape = "stockage";
    // L'extension vient du format RÉEL, jamais de ce que le téléphone annonce.
    const objet = await enregistrerObjet(`chantiers/${chantierId}/notes`, audio.octets, audio.extension);

    etape = "base";
    const note = await enregistrerNoteVocale(ctx, chantierId, {
      storageKey: objet.storageKey,
      // Le type retenu est celui du format reconnu : c'est lui qui repartira
      // chez le fournisseur de transcription, et lui qui décrit le fichier.
      mimeType: audio.mime,
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
      // Ce que le TÉLÉPHONE a annoncé, et non le format retenu : à cet endroit,
      // la panne peut être survenue avant qu'un format soit reconnu. Journaliser
      // une valeur qu'on n'a peut-être pas enverrait chercher au mauvais endroit.
      typeAnnonce: fichier.type || "aucun",
      tailleOctets: fichier.size,
      motif: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: messageDePanne(etape, err) };
  }
}
