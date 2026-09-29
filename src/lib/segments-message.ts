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

const DECOUPE = new RegExp(`(${PASTILLES.map((p) => p.replace(/[[\]]/g, "\\$&")).join("|")})`);

/** Le modèle, coupé sur ses pastilles. Les morceaux vides sont écartés. */
export function segmentsDuModele(modele: string): SegmentMessage[] {
  return modele
    // **La découpe se DÉDUIT de `PASTILLES`, elle ne se recopie plus.** Le
    // 7 septembre 2026, `[numero]` et `[echeance]` ont failli s'afficher en
    // clair faute d'avoir été recopiés ici ; le 29 septembre, `[autre-date]` et
    // `[validite]` entraient à leur tour. Une seule liste, une seule vérité.
    .split(DECOUPE)
    .filter((bout) => bout !== "")
    .map((bout) =>
      (PASTILLES as readonly string[]).includes(bout)
        ? { type: "jeton", valeur: bout }
        : { type: "texte", valeur: bout }
    );
}
