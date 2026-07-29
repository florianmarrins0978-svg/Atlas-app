export const MOTS_MATERIEL = /plaque|sac|rail|montant|m²|kg|litre|carrelage|colle|joint|enduit|vis|profil/i;
export const MOTS_AMBIGUS = /environ|peut[- ]être|je pense|sans doute|à confirmer/i;
const NOMBRE = "(?:\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";
export const REGEX_DUREE = new RegExp(`${NOMBRE}\\s*(?:à\\s*${NOMBRE}\\s*)?jours?`, "i");
export const REGEX_EQUIPE = new RegExp(`${NOMBRE}\\s*(?:hommes?|ouvriers?|gars|personnes?)`, "i");

export type AnalyseDemande = {
  prestations: string[];
  materiel: string[];
  ambiguites: string[];
  dureeTexte: string | null;
  equipeTexte: string | null;
};

// Segmente un texte libre (demande client, e-mail collé, transcription) en
// éléments exploitables. Reste volontairement simple (découpage par
// ponctuation + mots-clés génériques) : la reconnaissance métier réelle des
// prestations/matériels vient du catalogue (RechercherPrestation), pas d'ici.
export function analyserDemandeTexte(texte: string): AnalyseDemande {
  const segments = texte
    .split(/[,.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const dureeMatch = texte.match(REGEX_DUREE);
  const equipeMatch = texte.match(REGEX_EQUIPE);

  const prestations: string[] = [];
  const materiel: string[] = [];
  const ambiguites: string[] = [];

  for (const segment of segments) {
    const segMin = segment.toLowerCase();
    if (MOTS_AMBIGUS.test(segment)) {
      ambiguites.push(segment);
      continue;
    }
    if (dureeMatch && segment.includes(dureeMatch[0])) continue;
    if (equipeMatch && segment.includes(equipeMatch[0])) continue;
    if (MOTS_MATERIEL.test(segMin)) materiel.push(segment);
    else prestations.push(segment);
  }

  return {
    prestations,
    materiel,
    ambiguites,
    dureeTexte: dureeMatch?.[0] ?? null,
    equipeTexte: equipeMatch?.[0] ?? null,
  };
}
