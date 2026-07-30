// Valeur unique, réutilisée à la fois ici (validation applicative) et
// documentée dans next.config.ts (limite de Next.js pour les Server
// Actions) — ne jamais dupliquer un nombre différent entre les deux.
export const LIMITE_TELEVERSEMENT_OCTETS = 15 * 1024 * 1024; // 15 Mo

export const MESSAGE_FICHIER_TROP_VOLUMINEUX =
  "Le fichier dépasse la taille maximale autorisée (15 Mo). Réduisez sa taille ou choisissez un autre fichier.";

// Vérifie la taille AVANT toute lecture du contenu (fichier.size est déjà
// connu sans lire les octets) — jamais de mise en mémoire d'un fichier
// surdimensionné avant de le rejeter.
export function verifierTailleFichier(fichier: File): { ok: true } | { ok: false; message: string } {
  if (fichier.size > LIMITE_TELEVERSEMENT_OCTETS) {
    return { ok: false, message: MESSAGE_FICHIER_TROP_VOLUMINEUX };
  }
  return { ok: true };
}

// Types audio acceptés — liste blanche : tout ce qui n'y figure pas est refusé.
// Couvre ce que produisent les navigateurs (webm/ogg/mp4 selon la plateforme)
// et les formats qu'un artisan peut importer depuis son téléphone.
export const TYPES_AUDIO_AUTORISES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/flac",
];

// Attribut `accept` de l'input fichier — dérivé de la même liste, pour ne
// jamais proposer côté navigateur un format que le serveur refusera.
export const ACCEPT_AUDIO = TYPES_AUDIO_AUTORISES.join(",");

export const MESSAGE_TYPE_AUDIO_INVALIDE =
  "Ce fichier n'est pas un audio pris en charge. Formats acceptés : webm, ogg, m4a, mp3, wav, aac, flac.";

// Le type déclaré par le navigateur peut porter des paramètres
// (« audio/webm;codecs=opus ») : seule la partie type/sous-type est comparée.
// Un type vide est refusé — on ne devine jamais le format d'un fichier.
export function verifierTypeAudio(mimeType: string): { ok: true } | { ok: false; message: string } {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (!TYPES_AUDIO_AUTORISES.includes(base)) {
    return { ok: false, message: MESSAGE_TYPE_AUDIO_INVALIDE };
  }
  return { ok: true };
}
