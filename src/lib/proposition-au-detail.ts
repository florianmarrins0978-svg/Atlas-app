// La proposition de prix est-elle DÉJÀ dans le détail du devis ?
//
// **Le défaut que cette fonction ferme, et ce qu'il a coûté.** Le bouton
// « Ajouter au détail » ne se souvenait de rien : son état vivait dans le
// navigateur. Un retour arrière, un rechargement, un onglet rouvert — et
// l'écran réaffichait « Ajouter au détail » alors que la ligne était déjà là.
// Le patron a touché une seconde fois, et son devis est passé de 1 674 € à
// 3 348 € HT, soit 4 017,60 € TTC : le chiffre exact qu'il a photographié.
//
// L'application ne s'était pas trompée ; elle avait *invité* l'erreur, puis
// l'avait exécutée sans un mot. C'est pire qu'un calcul faux, parce que rien
// ne le signale : le total paraît simplement plus élevé que prévu, et ce total
// part au client.
//
// **Une seule règle, pour l'écran et pour le serveur** (`CLAUDE.md` §3). L'écran
// grise le bouton ; le serveur refuse quand même — une page restée ouverte, un
// second appui pendant que le premier voyage, et l'écran ne protège plus rien.

export type LigneDetail = { libelle: string; montant: string };

/** Comparaison sur le libellé seul, volontairement. */
function normaliser(libelle: string): string {
  return libelle.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Renvoie la ligne du détail qui porte déjà ce libellé, ou `null`.
 *
 * **Pourquoi le libellé et non le montant.** Le tarif de l'entreprise peut avoir
 * changé entre deux affichages : comparer les montants laisserait alors passer
 * un doublon au centime près différent — exactement le cas où le patron ne
 * verrait rien. Deux lignes portant la même prestation sont un doublon, quel
 * que soit leur prix.
 *
 * Un libellé vide ne rapproche rien : une ligne encore anonyme (ajoutée à la
 * main, pas encore nommée) ne doit pas bloquer une proposition.
 */
export function ligneDejaAuDetail(
  libelle: string | null,
  lignes: readonly LigneDetail[]
): LigneDetail | null {
  if (!libelle) return null;
  const cible = normaliser(libelle);
  if (!cible) return null;
  return lignes.find((l) => normaliser(l.libelle) === cible) ?? null;
}
