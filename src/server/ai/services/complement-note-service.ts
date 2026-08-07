import type { Ctx } from "../../repositories/context";
import { getNoteVocale, enregistrerSuccesTranscription } from "../../repositories/notes-vocales";
import { lancerTranscription } from "./transcription-service";
import { getFournisseurTranscription } from "../providers/transcription/fabrique";

/**
 * Reprendre une note vocale qu'on a arrêtée trop tôt.
 *
 * Le patron, le 7 août 2026 : *« sans faire exprès j'ai mis fin à ma note
 * vocale mais j'avais encore des choses à dire, il faut que je puisse
 * réappuyer et que ça relance la même note vocale si j'ai oublié quelque
 * chose. »*
 *
 * Aujourd'hui, la seule issue était « Remplacer la note » — c'est-à-dire tout
 * refaire. Sur un chantier, après avoir décrit un arbre pendant trente-quatre
 * secondes, recommencer parce qu'on a oublié une phrase est une punition.
 *
 * **Le complément s'ajoute à la TRANSCRIPTION, pas au fichier audio.** Ce
 * choix mérite son explication, parce qu'il n'est pas le plus évident :
 *
 * - deux enregistrements produits séparément ne se recollent pas de façon
 *   fiable. Chacun porte ses propres en-têtes ; le fichier obtenu se lit
 *   parfois, souvent à moitié, et selon le téléphone. Un enregistrement à
 *   moitié lisible serait pire que pas de reprise du tout — il donnerait
 *   l'illusion d'avoir tout gardé ;
 * - **ce qui sert réellement, c'est le texte.** C'est lui qui devient le
 *   devis. Un complément recollé au texte arrive exactement là où il compte,
 *   sans dépendre d'un format de fichier.
 *
 * L'écran le dit en toutes lettres : le complément s'ajoute à la suite de ce
 * qui a déjà été dit. On ne laisse pas croire qu'un seul enregistrement
 * continu a été reconstitué.
 */
export type ResultatComplement =
  | { ok: true; transcription: string }
  | { ok: false; raison: "aucune_note" | "transcription" | "vide" };

export async function completerNoteVocale(
  ctx: Ctx,
  chantierId: string,
  octets: Buffer,
  mimeType: string
): Promise<ResultatComplement> {
  const note = await getNoteVocale(ctx, chantierId);
  if (!note) return { ok: false, raison: "aucune_note" };

  // La première partie n'a pas encore été transcrite — c'est le cas le plus
  // fréquent, puisqu'on reprend justement avant d'avoir lancé quoi que ce
  // soit. On la transcrit d'abord, sans quoi le complément deviendrait la
  // totalité de la note et effacerait ce qui avait été dit.
  let debut = (note.transcription ?? "").trim();
  if (!debut) {
    const apres = await lancerTranscription(ctx, chantierId);
    debut = (apres?.transcription ?? "").trim();
    if (!debut) return { ok: false, raison: "transcription" };
  }

  const fournisseur = getFournisseurTranscription();
  const suite = await fournisseur.transcrire(octets, mimeType);
  if (!suite.succes) return { ok: false, raison: "transcription" };

  const ajout = suite.texte.trim();
  if (!ajout) return { ok: false, raison: "vide" };

  // Un espace, pas un saut de ligne : c'est la même dictée qui continue, et le
  // texte est relu par un modèle qui n'a que faire de la mise en page.
  const complete = `${debut} ${ajout}`;
  await enregistrerSuccesTranscription(ctx, chantierId, complete);
  return { ok: true, transcription: complete };
}
