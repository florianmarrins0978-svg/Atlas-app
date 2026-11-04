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

// **`verifierTypeAudio` et `MESSAGE_TYPE_AUDIO_INVALIDE` ont été RETIRÉS le
// 26 août 2026, avec le lot Audio.** Ils décidaient sur la chaîne que le
// navigateur envoie — laquelle ne prouve rien, et commandait indirectement
// l'extension de rangement, donc le type qu'Atlas annonçait plus tard.
//
// Ce qui décide désormais vit dans `src/lib/signature-audio.ts` : le format se
// lit dans les octets, et le serveur en déduit le type et l'extension. La porte
// unique est `src/server/audio-entrant.ts`.
//
// **`TYPES_AUDIO_AUTORISES` et `ACCEPT_AUDIO` sont partis le 3 novembre 2026**
// avec l'écran Note vocale : ils ne servaient plus qu'à l'attribut `accept` de
// son « Ajouter un fichier audio », un confort d'interface qui ne protégeait
// rien. Aucun écran ne choisit plus un fichier audio ; le micro envoie ce que
// le navigateur enregistre, et la porte commune le reconnaît.
