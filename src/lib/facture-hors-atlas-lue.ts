import { lirePrixHt } from "./prix-achat";

/**
 * CE QUE L'IA A LU SUR UNE FACTURE FAITE HORS D'ATLAS — celle qu'il a faite à
 * un client sur papier ou dans un autre logiciel, photographiée ou jointe en
 * PDF pour le virement reçu qui la paie (sa demande du 25 octobre 2026).
 *
 * Le patron de `devis-fournisseur-lu.ts` : la réponse du modèle se relit ici,
 * en fonction pure éprouvée sans clé (`scripts/test-facture-hors-atlas-lue.ts`) ;
 * l'appel vit dans `src/server/ai/services/lire-facture-hors-atlas.ts`.
 *
 * **Le total se recopie, il ne se devine pas** : illisible, absent ou nul, il
 * reste vide, et l'écran le fait taper. C'est lui qu'on compare à la ligne.
 */
export type FactureHorsAtlasLue = { totalTtc: string | null; numero: string | null };

const chaine = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Le texte du modèle, relu, ou `null` s'il ne rend aucun objet. */
export function lireReponseFactureHorsAtlas(texte: string): FactureHorsAtlasLue | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let brut: { total_ttc?: unknown; numero?: unknown };
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return null;
  }
  const t = chaine(brut.total_ttc);
  const total = t === null ? null : lirePrixHt(t.replace(/€/g, ""));
  return { totalTtc: total !== null && Number(total) > 0 ? total : null, numero: chaine(brut.numero)?.slice(0, 40) ?? null };
}
