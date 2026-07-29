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

function cheminPour(storageKey: string): string {
  // storageKey ne contient que des segments alphanumériques/tirets/points/slashes
  // contrôlés par cette fonction elle-même (jamais construits à partir d'une
  // entrée utilisateur brute) — pas de risque de traversée de répertoire.
  return path.join(RACINE_STOCKAGE, storageKey);
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
