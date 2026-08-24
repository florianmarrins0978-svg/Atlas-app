import { createHash } from "node:crypto";
import {
  MESSAGE_HEIC_REFUSE,
  MESSAGE_PHOTO_ILLISIBLE,
  MESSAGE_PHOTO_REFUSEE,
  estHeic,
  extensionPhoto,
  photoAcceptee,
  retirerMetadonnees,
} from "../lib/exif";
import { verifierTailleFichier } from "./upload-limits";
import { logger } from "./logger";

/**
 * LA porte d'entrée de toute image d'utilisateur — **et il n'y en a qu'une**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA PROPRIÉTÉ QUE CE FICHIER GARANTIT, et c'est la seule qui compte :**
 *
 * > Une image d'utilisateur n'est **jamais** rangée ni envoyée à un fournisseur
 * > d'IA tant qu'Atlas n'en détient pas une version dont il peut garantir le
 * > nettoyage.
 *
 * Autrement dit : **si le nettoyage échoue, on refuse.** L'original ne part
 * nulle part.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CELA REVIENT SUR, ET POURQUOI — 24 août 2026.**
 *
 * Le matin même, la règle était l'inverse : *« un échec de nettoyage ne refuse
 * JAMAIS la photo — on range sans nettoyer plutôt que de perdre le cliché »*.
 * Elle venait d'un vrai principe du patron — un outil qui refuse la photo qu'on
 * vient de prendre est pire que le risque qu'il évite — et elle protégeait
 * l'artisan sur son chantier.
 *
 * **Elle laissait pourtant passer exactement ce qu'on prétendait fermer.** Un
 * fichier qu'on ne sait pas lire est rangé **avec ses métadonnées** : les
 * coordonnées GPS du domicile d'un client, dans une base qu'on n'a jamais
 * choisi de remplir de cela. Le geste de l'artisan était sauvé ; la donnée de
 * son client, non.
 *
 * **Et la protection ne tenait à rien de solide.** Elle reposait sur l'idée
 * qu'iOS transcode en JPEG parce que l'attribut `accept` de l'écran ne propose
 * pas le HEIC. C'est vrai d'un iPhone honnête, et ce n'est pas une frontière :
 * qui poste directement au serveur ne regarde aucun attribut d'écran.
 *
 * **Ce que le revirement coûte, dit franchement :** un artisan dont le
 * téléphone envoie un HEIC brut lit un refus. Ce que le refus lui donne, c'est
 * le geste exact qui le règle une fois pour toutes (`MESSAGE_HEIC_REFUSE`), et
 * non un « format non pris en charge » devant lequel il n'a rien à faire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UN BÉNÉFICE QUI N'ÉTAIT PAS CHERCHÉ : la validation du contenu réel.**
 *
 * `retirerMetadonnees` vérifie la signature du fichier avant de le découper. Un
 * SVG annoncé `image/jpeg` — le vecteur du constat M2 — n'a pas la signature
 * d'un JPEG : il échoue au nettoyage, donc il est refusé **ici**. On ne fait
 * plus confiance au type déclaré par le navigateur pour autre chose que
 * choisir quel nettoyeur essayer.
 */

export type PhotoEntrante = {
  /** Les octets NETTOYÉS — jamais l'original. */
  octets: Buffer;
  /** Le type retenu, normalisé (sans paramètre, en minuscules). */
  mimeType: string;
  /** L'extension à poser sur la clé de stockage, qui décidera du type servi. */
  extension: string;
  checksum: string;
  /** Les blocs retirés — pour le journal, jamais pour l'écran. */
  retires: string[];
  /**
   * Le nom que le navigateur a donné au fichier, **borné**.
   *
   * Il sert à décrire la photo à l'assistant (`documents/ingestion.ts`) et n'est
   * jamais posé sur le disque : la clé de stockage est un identifiant tiré par
   * le serveur. Une chaîne venue du client n'a pas à être longue.
   */
  nomOriginal?: string;
};

export type ResultatPhotoEntrante =
  | { ok: true; photo: PhotoEntrante }
  | { ok: false; raison: string };

/**
 * Vérifier, nettoyer, et ne rendre que ce qui est propre.
 *
 * @param quoi  D'où vient la photo — pour le journal seulement. Jamais à l'écran.
 */
export async function preparerPhotoEntrante(
  fichier: unknown,
  quoi: string,
  /**
   * Une borne PLUS SERRÉE que celle du téléversement ordinaire, quand le chemin
   * la mérite.
   *
   * Le croquis d'arrosage part chez un fournisseur de vision : sa borne à 8 Mo
   * ne protège pas la mémoire du serveur (15 Mo suffiraient), elle **borne une
   * facture** et évite un appel qui tombe. La perdre en passant par la porte
   * commune serait un relâchement silencieux.
   */
  bornePlusSerree?: { octets: number; message: string }
): Promise<ResultatPhotoEntrante> {
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, raison: "Aucune photo reçue." };
  }

  // La taille AVANT de lire les octets : `fichier.size` est connu sans que rien
  // ne passe en mémoire.
  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return { ok: false, raison: taille.message };
  if (bornePlusSerree && fichier.size > bornePlusSerree.octets) {
    return { ok: false, raison: bornePlusSerree.message };
  }

  const mimeType = fichier.type.split(";")[0].trim().toLowerCase();

  // **Le HEIC a son propre refus**, avant le refus générique : « ce n'est pas
  // une photo » serait faux — c'en est une —, et ne dirait pas quoi faire.
  // **Le HEIC a son propre refus**, avant le refus générique : « ce n'est pas
  // une photo » serait faux — c'en est une —, et ne dirait pas quoi faire.
  if (estHeic(mimeType)) {
    logger.info("Photo refusée : HEIC brut", { quoi });
    return { ok: false, raison: MESSAGE_HEIC_REFUSE };
  }
  if (!photoAcceptee(mimeType)) {
    logger.info("Photo refusée : format hors liste", { quoi, type: mimeType || "aucun" });
    return { ok: false, raison: MESSAGE_PHOTO_REFUSEE };
  }

  const brut = new Uint8Array(await fichier.arrayBuffer());
  const nettoye = retirerMetadonnees(brut, mimeType);

  /**
   * **LE REFUS QUI TIENT TOUTE LA PROPRIÉTÉ.** Ne jamais transformer ce `return`
   * en « on range quand même » : c'est précisément le défaut du 24 août au
   * matin, et il rangeait des coordonnées GPS.
   */
  if (!nettoye.nettoye) {
    logger.warn("Photo refusée : nettoyage impossible — l'original n'est PAS conservé", {
      quoi,
      type: mimeType,
    });
    return { ok: false, raison: MESSAGE_PHOTO_ILLISIBLE };
  }

  const octets = Buffer.from(nettoye.octets);
  if (nettoye.retires.length > 0) {
    logger.info("Métadonnées retirées d'une photo", { quoi, blocs: nettoye.retires });
  }

  return {
    ok: true,
    photo: {
      octets,
      mimeType,
      extension: extensionPhoto(mimeType),
      checksum: createHash("sha256").update(octets).digest("hex"),
      retires: nettoye.retires,
      nomOriginal: fichier.name ? fichier.name.slice(0, 120) : undefined,
    },
  };
}
