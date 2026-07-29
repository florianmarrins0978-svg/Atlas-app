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
