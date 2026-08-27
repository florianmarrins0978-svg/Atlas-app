import { verifierTailleFichier } from "@/server/upload-limits";
import {
  decrireAudioEntrant,
  type FormatAudio,
} from "@/lib/signature-audio";

/**
 * LA PORTE UNIQUE PAR LAQUELLE UN AUDIO ENTRE DANS ATLAS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QU'ELLE REMPLACE, ET POURQUOI.**
 *
 * Avant, quatre chemins faisaient chacun la même chose : vérifier la taille,
 * croire `fichier.type`, lire les octets, et déduire l'extension de ce même
 * `fichier.type`. La chaîne envoyée par le téléphone décidait donc de
 * l'extension rangée — et cette extension décide plus tard, via
 * `typeDepuisCle`, du `Content-Type` qu'Atlas annonce au navigateur.
 *
 * **Le navigateur commandait, indirectement, ce qu'Atlas dirait plus tard.**
 * Il ne commande plus rien : le format se lit dans les octets
 * (`src/lib/signature-audio.ts`), et c'est lui qui donne le type et l'extension.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **L'ORDRE DES GARDES EST LA MOITIÉ DE LA PROTECTION.**
 *
 *   1. la TAILLE d'abord — `fichier.size` est connu sans lire un octet ;
 *   2. la lecture ensuite, une seule fois, partagée avec l'appelant ;
 *   3. un enregistrement vide est refusé avec sa phrase à lui ;
 *   4. le FORMAT, lu dans les octets ;
 *   5. et alors seulement le type et l'extension, choisis par le SERVEUR.
 *
 * Rien n'est lu avant la borne de taille. Et la cadence
 * (`LIMITES.televersementFichier`) reste posée par l'appelant AVANT cet appel :
 * c'est elle qui empêche de faire travailler cette porte en rafale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **FORMAT INCONNU → REFUS.** Décision du patron, le 26 août 2026, contre ce
 * qui avait été proposé : *« je préfère conserver le point Audio ouvert plutôt
 * que déclarer sécurisé un chemin qui continue à faire confiance au MIME pour
 * les cas difficiles »*.
 *
 * **Et si un format légitime venait à être refusé chez lui, la marche à suivre
 * est écrite et ne se négocie pas : on n'ouvre pas de repli sur `fichier.type`,
 * on élargit `signature-audio.ts`.**
 */
export type AudioEntrant =
  | {
      ok: true;
      octets: Buffer;
      format: FormatAudio;
      /** Le type que le SERVEUR retient — jamais celui du navigateur. */
      mime: string;
      /** L'extension de rangement, qui décidera du type servi plus tard. */
      extension: string;
    }
  | { ok: false; message: string };

export const MESSAGE_ENREGISTREMENT_VIDE =
  "L'enregistrement est vide — le micro n'a rien capté. Réessayez en parlant après l'appui.";

export async function preparerAudioEntrant(fichier: File): Promise<AudioEntrant> {
  // 1. La taille, avant toute lecture.
  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return { ok: false, message: taille.message };

  // 2. Une seule lecture, rendue à l'appelant : la relire coûterait le double
  //    de mémoire sur un fichier de 15 Mo.
  const octets = Buffer.from(await fichier.arrayBuffer());

  // 3. **Un enregistrement vide n'est pas un enregistrement.** Sur certains
  //    téléphones, le micro rend zéro octet sans se plaindre. Sa phrase à lui,
  //    parce qu'elle dit quoi faire — « ce n'est pas un format reconnu » serait
  //    exact et inutile.
  if (octets.byteLength === 0) return { ok: false, message: MESSAGE_ENREGISTREMENT_VIDE };

  // 4 et 5. Le format, puis ce qu'on en retient.
  const decrit = decrireAudioEntrant(octets, fichier.type ?? "");
  if (!decrit.ok) return { ok: false, message: decrit.message };

  return {
    ok: true,
    octets,
    format: decrit.format,
    mime: decrit.mime,
    extension: decrit.extension,
  };
}
