import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Décision technique documentée : aucun accès réseau vers un stockage objet
// réel (Cloudflare R2, Vercel Blob, S3) n'est possible dans cet environnement
// de développement (domaines non accessibles). Implémentation locale sur
// disque, derrière la même interface que celle prévue dans l'architecture
// (storage_key / mime_type / taille_octets / checksum, URL générée à la
// demande côté serveur) — remplaçable par un vrai bucket sans toucher aux
// repositories ni aux écrans.

const RACINE_STOCKAGE = path.join(process.cwd(), ".storage");

export type ObjetStocke = {
  storageKey: string;
  tailleOctets: number;
  checksum: string;
};

/**
 * Le chemin d'une clé — **et il ne sort JAMAIS de `.storage`.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le commentaire qui vivait ici affirmait le contraire de la réalité**, et
 * c'est ce qui empêchait de s'en apercevoir (audit du 23 août 2026). Il
 * disait : *« storageKey ne contient que des segments alphanumériques […]
 * jamais construits à partir d'une entrée utilisateur brute — pas de risque de
 * traversée de répertoire »*.
 *
 * Or le dossier passé à `enregistrerObjet` porte un `chantierId` venu d'une
 * action serveur, et `path.join` **résout les `..`** : une clé
 * `../../../../tmp/x` sortait de `.storage`. L'adaptateur S3, lui, assainit
 * depuis toujours (`s3-storage.ts`) — deux implémentations du même contrat, une
 * seule prudente, et c'est la faible qui servait sur le banc.
 *
 * **La vérification est faite APRÈS résolution, pas avant.** Chercher `..` dans
 * la chaîne se contourne (encodages, séparateurs mêlés) ; comparer le chemin
 * résolu à la racine ne se contourne pas. C'est la seule façon qui tienne.
 *
 * **Lève plutôt que de rendre un chemin de repli** : un repli silencieux
 * rangerait le fichier ailleurs que là où la base croit qu'il est, et l'on ne
 * s'en apercevrait qu'en tentant de le relire — des semaines plus tard.
 */
function cheminPour(storageKey: string): string {
  const chemin = path.resolve(RACINE_STOCKAGE, storageKey);
  const racine = path.resolve(RACINE_STOCKAGE);
  if (chemin !== racine && !chemin.startsWith(racine + path.sep)) {
    throw new Error("Clé de stockage hors du dossier de stockage — refusée.");
  }
  return chemin;
}

// mimeType : imposé par le contrat partagé avec l'adaptateur S3
// (src/server/storage/s3-storage.ts), où il sert de Content-Type réel envoyé
// au fournisseur objet. Le dispatcher (src/server/storage/index.ts) assigne
// indifféremment l'une ou l'autre implémentation à enregistrerObjet : les
// deux signatures doivent rester identiques pour que ce remplacement reste
// transparent pour tous les appelants. Le stockage local sur disque n'a pas
// de notion de Content-Type (aucun fichier de métadonnées n'existe dans ce
// contrat — le mimeType réel est déjà persisté séparément par les
// repositories appelants, ex. photos/notes vocales) : l'utiliser ici
// nécessiterait d'inventer une fonctionnalité absente du contrat actuel,
// hors périmètre d'une correction de lint.
export async function enregistrerObjet(
  dossier: string,
  octets: Buffer,
  extension: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mimeType?: string
): Promise<ObjetStocke> {
  const storageKey = `${dossier}/${randomUUID()}${extension}`;
  const chemin = cheminPour(storageKey);
  await mkdir(path.dirname(chemin), { recursive: true });
  await writeFile(chemin, octets);
  const checksum = createHash("sha256").update(octets).digest("hex");
  return { storageKey, tailleOctets: octets.length, checksum };
}

export async function lireObjet(storageKey: string): Promise<Buffer> {
  return readFile(cheminPour(storageKey));
}

// Idempotent : supprimer une clé déjà absente n'est jamais une erreur.
export async function supprimerObjet(storageKey: string): Promise<void> {
  try {
    await unlink(cheminPour(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
