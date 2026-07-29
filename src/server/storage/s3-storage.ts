import { randomUUID, createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "../env";
import type { ObjetStocke } from "./local-storage";

// Même contrat que local-storage.ts (storageKey / tailleOctets / checksum) —
// interchangeable sans modifier aucun appelant. Jamais d'accès public par
// défaut : ce module ne configure aucune politique de bucket public ; l'accès
// en lecture passe par lireObjet() (server-mediated), jamais par une URL
// publique directe.
function client(): S3Client {
  const config = getEnv().s3;
  if (!config) {
    throw new Error("Stockage S3 sélectionné mais non configuré (STORAGE_S3_* manquants).");
  }
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    // Nécessaire pour la plupart des fournisseurs S3-compatibles hors AWS
    // (ex. Cloudflare R2) qui n'implémentent pas le style d'adressage virtual-host.
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

// storageKey construite exclusivement à partir de segments contrôlés par
// cette fonction elle-même (dossier fourni par l'appelant + uuid généré ici)
// — jamais à partir d'une entrée utilisateur brute : aucun risque de
// traversée de chemin (".." ou "/" injectés).
function construireCle(dossier: string, extension: string): string {
  const dossierSur = dossier.replace(/[^a-zA-Z0-9_-]/g, "_");
  const extensionSure = extension.replace(/[^a-zA-Z0-9.]/g, "");
  return `${dossierSur}/${randomUUID()}${extensionSure}`;
}

export async function enregistrerObjet(
  dossier: string,
  octets: Buffer,
  extension: string,
  mimeType = "application/octet-stream"
): Promise<ObjetStocke> {
  const storageKey = construireCle(dossier, extension);
  const config = getEnv().s3!;
  await client().send(
    new PutObjectCommand({ Bucket: config.bucket, Key: storageKey, Body: octets, ContentType: mimeType })
  );
  const checksum = createHash("sha256").update(octets).digest("hex");
  return { storageKey, tailleOctets: octets.length, checksum };
}

export async function lireObjet(storageKey: string): Promise<Buffer> {
  const config = getEnv().s3!;
  const reponse = await client().send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }));
  const octets = await reponse.Body?.transformToByteArray();
  if (!octets) throw new Error(`Objet introuvable : ${storageKey}`);
  return Buffer.from(octets);
}

// Idempotent : S3 ne signale pas d'erreur pour la suppression d'une clé déjà
// absente (comportement déjà cohérent avec le stockage local).
export async function supprimerObjet(storageKey: string): Promise<void> {
  const config = getEnv().s3!;
  await client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
}
