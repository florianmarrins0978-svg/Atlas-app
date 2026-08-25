import { PASTILLES } from "./message-client";

// DÉCOUPER SON MESSAGE EN MORCEAUX — le texte qu'il ÉCRIT, et les pastilles
// qu'Atlas remplit tout seul (« les mots en doré », sa demande du 25 août 2026).
//
// **Une seule règle de découpe, partagée** entre l'éditeur (qui verrouille les
// pastilles) et l'aperçu (qui les colore) : deux découpes finiraient par
// diverger, et l'écran montrerait autre chose que ce qu'il enregistre
// (`CLAUDE.md` §3). La concaténation des morceaux redonne EXACTEMENT le modèle.

export type SegmentMessage =
  /** Ce qu'il a écrit, modifiable. */
  | { type: "texte"; valeur: string }
  /** Une pastille — remplie par Atlas, jamais modifiable (« en doré »). */
  | { type: "jeton"; valeur: string };

/** Le modèle, coupé sur ses pastilles. Les morceaux vides sont écartés. */
export function segmentsDuModele(modele: string): SegmentMessage[] {
  return modele
    .split(/(\[client\]|\[document\]|\[lien\]|\[entreprise\])/)
    .filter((bout) => bout !== "")
    .map((bout) =>
      (PASTILLES as readonly string[]).includes(bout)
        ? { type: "jeton", valeur: bout }
        : { type: "texte", valeur: bout }
    );
}
