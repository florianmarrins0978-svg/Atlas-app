/**
 * CE QUE L'IA A LU SUR UN PAPIER DE VÉHICULE — carte grise, assurance ou
 * procès-verbal de contrôle technique. Sa demande du 14 octobre 2026 :
 * *« que l'appli enregistre toute seule les infos au bon endroit lorsqu'on
 * joint les photos des documents ou le PDF »*.
 *
 * Le patron de `attestation-lue.ts` : la réponse du modèle se relit ici, en
 * fonction pure éprouvée sans clé (`scripts/test-vehicules.ts`) ; l'appel au
 * fournisseur vit dans `src/server/ai/services/lire-document-vehicule.ts`.
 *
 * **Rien ne se devine** : une valeur absente, illisible ou mal formée vaut
 * `null`, et la case reste vide à l'écran (`docs/AGENT.md` §3). Une date qui
 * n'existe pas ne passe pas : elle poserait un rappel sur un jour faux.
 */

import { aLaFormeDUnePlaque, estJourReel, type LectureDocumentVehicule, type NatureDocumentVehicule } from "./vehicules";

const NATURES: Record<string, NatureDocumentVehicule> = {
  carte_grise: "carte_grise",
  assurance: "assurance",
  controle_technique: "controle_technique",
};

/**
 * Le texte du modèle, transformé en lecture, ou `null` s'il n'en rend aucune.
 * `nature: null` veut dire « ce n'est aucun des trois papiers » : l'écran le
 * demande alors au patron.
 */
export function lireReponseDocumentVehicule(texte: string): LectureDocumentVehicule | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    // Une réponse qui n'est pas du JSON ne dit rien du papier : `null`, et
    // l'écran demande ce que c'est plutôt que de le supposer.
    return null;
  }
  const chaine = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const p = v.replace(/\s+/g, " ").trim();
    return p === "" || p.toLowerCase() === "null" ? null : p.slice(0, 120);
  };
  const date = (v: unknown): string | null => {
    const d = chaine(v);
    return d !== null && estJourReel(d) ? d : null;
  };
  const poids = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : NaN;
    return Number.isInteger(n) && n >= 500 && n <= 44000 ? n : null;
  };
  // Ce qui n'a pas la forme d'une plaque n'en est pas une : comparé à la vraie,
  // il ferait refuser le papier comme celui d'un autre véhicule.
  const plaque = (v: unknown): string | null => {
    const p = chaine(v);
    return p !== null && aLaFormeDUnePlaque(p) ? p : null;
  };
  const nature = typeof brut.nature === "string" ? NATURES[brut.nature] ?? null : null;
  return {
    nature,
    plaque: plaque(brut.plaque),
    modele: chaine(brut.marque_modele),
    ptacKg: poids(brut.ptac_kg),
    genre: chaine(brut.genre),
    assureur: chaine(brut.assureur),
    numeroContrat: chaine(brut.numero_contrat),
    assistance: chaine(brut.telephone_assistance),
    controleTechniqueAvant: date(brut.controle_technique_avant),
    pollutionAvant: date(brut.controle_pollution_avant),
    contreVisiteAvant: date(brut.contre_visite_avant),
  };
}
