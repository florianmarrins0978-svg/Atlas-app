const MOTS_NOMBRES: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
};

// Extrait le premier nombre (chiffre ou mot français) d'un texte libre comme
// "2 jours" ou "deux hommes". Retourne null si rien n'est trouvé — jamais une
// valeur inventée par défaut.
export function parseNombreFrancais(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const matchChiffre = texte.match(/\d+/);
  if (matchChiffre) return parseInt(matchChiffre[0], 10);

  const texteMinuscule = texte.toLowerCase();
  for (const [mot, valeur] of Object.entries(MOTS_NOMBRES)) {
    if (new RegExp(`\\b${mot}\\b`).test(texteMinuscule)) return valeur;
  }
  return null;
}
