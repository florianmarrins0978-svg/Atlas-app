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

import { estLaLigneDeSonEquipe } from "@/lib/feuille-main-oeuvre";

/** `mainDoeuvre` et `unite` : de quoi reconnaître la ligne de son équipe, même renommée. */
export type LigneDetail = { libelle: string; montant: string; mainDoeuvre?: boolean | null; unite?: string | null };

/** La ligne qu'on s'apprête à poser : un tarif n'a que son nom, une ligne proposée dit aussi ce qu'elle est. */
export type LigneVisee = { libelle: string | null; mainDoeuvre?: boolean | null; unite?: string | null };

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
export function ligneDejaAuDetail(vise: LigneVisee, lignes: readonly LigneDetail[]): LigneDetail | null {
  // **La main d'œuvre de son équipe se reconnaît à ce qu'elle est, pas à son
  // nom** (19 novembre 2026). Il renomme sa ligne au doigt, « Main d’œuvre de
  // l’équipe » ; comparée au libellé, la dictée rejouée posait alors une
  // seconde ligne de son équipe à côté, et la même main d'œuvre comptait deux
  // fois. Une seule par devis, quel que soit son nom (`estLaLigneDeSonEquipe`).
  if (estLaLigneDeSonEquipe(vise)) {
    const sienne = lignes.find(estLaLigneDeSonEquipe);
    if (sienne) return sienne;
  }
  const libelle = vise.libelle;
  if (!libelle) return null;
  const cible = normaliser(libelle);
  if (!cible) return null;
  return lignes.find((l) => normaliser(l.libelle) === cible) ?? null;
}
