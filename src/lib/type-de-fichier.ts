/**
 * Le type d'un fichier rangé — **déduit de sa clé, jamais du navigateur**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER RÉPARE.** Audit du 23 août 2026, constat M1. La route qui
 * sert les fichiers (`/api/fichiers/[...key]`) renvoyait le type MIME **tel que
 * le navigateur l'avait déclaré au dépôt** :
 *
 *     headers: { "Content-Type": mimeType }   // mimeType = fichier.type, du client
 *
 * Annoncer `image/svg+xml` faisait donc servir un document SVG depuis notre
 * propre domaine — et un SVG est un document, pas une image : il peut porter du
 * script, qui s'exécute avec la session de l'artisan.
 *
 * **`X-Content-Type-Options: nosniff` ne ferme PAS ce trou**, contrairement à
 * ce qu'on pourrait croire, et cette phrase est là pour éviter qu'on le croie
 * une seconde fois. `nosniff` interdit au navigateur de *deviner* un type autre
 * que celui annoncé ; ici personne ne devine, on annonce. Et la politique de
 * sécurité du contenu autorise l'inline (`next.config.ts`), donc elle ne
 * rattrape rien non plus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi l'EXTENSION fait foi, et pourquoi c'est sûr.**
 *
 * Les clés de stockage sont fabriquées par le serveur, jamais par le client :
 * `enregistrerObjet` compose `dossier/<uuid><extension>`, et l'extension sort
 * d'une correspondance écrite dans le code. Un client ne peut donc pas la
 * choisir. Ce que ce fichier lit est déjà une liste blanche — il ne fait que
 * refuser d'inventer au-delà.
 *
 * **Une extension inconnue rend `application/octet-stream`** : le navigateur
 * propose alors de télécharger plutôt que d'afficher. C'est le défaut sûr, et
 * il vaut mieux qu'un fichier qui s'ouvre mal qu'un fichier qui s'exécute.
 *
 * Éprouvé sans base ni réseau — `scripts/test-type-de-fichier.ts`.
 */

/** Ce que le serveur sait poser comme extension, et ce que ça vaut. */
const TYPES: Record<string, string> = {
  // Images — celles que les écrans acceptent (`src/lib/exif.ts`).
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  // Les photos d'iPhone qui ne se sont pas transcodées : rangées, donc
  // servies. Ce sont des images, elles ne portent aucun script.
  ".heic": "image/heic",
  ".heif": "image/heif",
  // Audio — les dictées (`src/server/services/note-vocale-entrante.ts`).
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
};

/**
 * Le type sûr à servir pour cette clé de stockage.
 *
 * **Ne rend JAMAIS `image/svg+xml`, ni `text/html`, ni rien d'exécutable** —
 * c'est toute la raison d'être de cette fonction, et une suite le tient.
 */
export function typeDepuisCle(cle: string): string {
  const point = cle.lastIndexOf(".");
  if (point < 0) return "application/octet-stream";
  const extension = cle.slice(point).toLowerCase();
  return TYPES[extension] ?? "application/octet-stream";
}
