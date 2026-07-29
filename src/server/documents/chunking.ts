// Découpage simple par phrases, regroupées jusqu'à une taille maximale.
// Aucune dépendance, aucun découpage sémantique complexe (MVP).
export function decouperTexte(texte: string, tailleMax = 400): string[] {
  const nettoye = texte.trim();
  if (!nettoye) return [];

  const phrases = nettoye.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  const fragments: string[] = [];
  let courant = "";

  for (const phrase of phrases) {
    if (courant.length > 0 && courant.length + phrase.length + 1 > tailleMax) {
      fragments.push(courant.trim());
      courant = phrase;
    } else {
      courant = courant.length > 0 ? `${courant} ${phrase}` : phrase;
    }
  }
  if (courant.trim()) fragments.push(courant.trim());

  return fragments;
}
