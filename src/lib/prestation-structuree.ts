// **Ce que la dictée dit, rangé dans des champs plutôt que collé à un nom.**
//
// Le modèle rend déjà `{ libelle, description, quantite, unite, aConfirmer }`,
// et il le rend BIEN : sur la dictée du 26 août 2026, il avait parfaitement lu
// « 800 » et « ml ». C'est la suite qui perdait tout — `libelleAvecQuantite`
// recollait la mesure au nom, faute d'une colonne où la poser, et la ligne du
// devis repartait à `quantité = 1`.
//
// Ce module fait la traduction, et **rien d'autre** : du JSON du modèle vers
// les colonnes de la table. Il ne devine aucune valeur absente, ne normalise
// aucune unité, et ne déduit aucune nature d'un libellé — ce serait recopier
// ici le défaut qu'on répare.

import type { LigneExtraite } from "../server/ai/schemas/extraction";

export type PrestationStructuree = {
  /** En chiffres, prête pour une colonne numérique. `null` s'il n'a rien dit. */
  quantite: string | null;
  /** Son mot à lui, à la lettre. `null` s'il n'a rien dit. */
  unite: string | null;
  /** Le doute signalé par le modèle. Jamais `null` ici : le modèle a répondu. */
  aConfirmer: boolean;
};

/**
 * Un nombre écrit par un modèle, ou rien.
 *
 * **La virgule est acceptée** — « 12,5 » — parce qu'un artisan l'écrit ainsi et
 * qu'un modèle recopie ce qu'il entend. Le point aussi.
 *
 * **Ce qui ne se lit pas ne se devine pas.** « environ vingt », « à mesurer »,
 * « beaucoup » rendent `null` plutôt qu'une valeur plausible : une quantité
 * fausse se multiplie par un prix, et le produit du calcul part chez un client.
 */
export function quantiteLue(brut: string | null): string | null {
  if (!brut) return null;
  const trouve = brut.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!trouve) return null;
  const valeur = Number(trouve[0].replace(",", "."));
  // Zéro et les négatifs ne sont pas des quantités : la base les refuse
  // (`prestations_quantite_positive`), et mieux vaut ne rien écrire que de
  // faire échouer l'enregistrement d'une dictée pour une mesure aberrante.
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return valeur.toFixed(2);
}

/**
 * Les champs structurés d'une ligne extraite — tels qu'ils entrent en base.
 *
 * **La quantité et l'unité entrent ENSEMBLE ou pas du tout**, et la base le
 * fait respecter (`prestations_quantite_avec_unite`). « 800 » tout seul se
 * lirait 800 mètres, 800 m² ou 800 heures selon qui regarde — c'est exactement
 * l'ambiguïté qui a produit le devis du 26 août.
 *
 * **Ce que cette fonction ne remplit PAS**, et il faut le savoir en la lisant :
 * ni `nature`, ni `espece`, ni `methode`, ni `caracteristiques`. Le contrat
 * d'extraction ne les demande pas au modèle — les déduire du libellé serait
 * inventer. La méthode et les mesures arrivent d'ailleurs, et sûrement : des
 * réponses du patron à l'arrêt d'avant-chiffrage (`precisions_chantier`).
 */
export function structureDeLaPrestation(ligne: LigneExtraite): PrestationStructuree {
  const quantite = quantiteLue(ligne.quantite);
  const unite = ligne.unite?.trim() || null;
  const ensemble = quantite !== null && unite !== null;
  return {
    quantite: ensemble ? quantite : null,
    unite: ensemble ? unite : null,
    aConfirmer: ligne.aConfirmer,
  };
}

/**
 * Ce que ses réponses à l'arrêt d'avant-chiffrage disent d'une prestation.
 *
 * **Une source sûre, et la seule aujourd'hui pour la méthode et les mesures.**
 * Le contrat d'extraction ne demande ni technique ni diamètre au modèle ; le
 * patron, lui, les a saisis lui-même à l'arrêt qui vaut de l'argent, et ils
 * vivent dans `precisions_chantier`. Les recopier ici, c'est déplacer une
 * donnée déjà certaine — pas en fabriquer une.
 *
 * Les sujets sont ceux que produit `questions-chiffrage.ts`, `<sujet>#<rang>` :
 * `abattage.technique`, `abattage.diametre`, `fendage.hauteur`,
 * `fendage.diametre`, `haie.longueur`. **Ils sont persistés** — les renommer
 * reposerait au patron des questions déjà répondues.
 */
export function structureDepuisPrecisions(
  precisions: readonly { sujet: string; valeur: string }[]
): { methode: string | null; caracteristiques: Record<string, number> | null } {
  let methode: string | null = null;
  const mesures: Record<string, number> = {};

  for (const p of precisions) {
    const sujet = p.sujet.split("#")[0];
    if (sujet === "abattage.technique") {
      methode = p.valeur;
      continue;
    }
    const valeur = Number(String(p.valeur).replace(",", "."));
    if (!Number.isFinite(valeur) || valeur <= 0) continue;
    // Le nom de la mesure, jamais celui de la question : c'est le diamètre de
    // l'arbre, qu'il ait été demandé pour l'abattage ou pour la fente.
    if (sujet.endsWith(".diametre")) mesures.diametreCm = valeur;
    else if (sujet.endsWith(".hauteur")) mesures.hauteurM = valeur;
    else if (sujet.endsWith(".longueur")) mesures.longueurMl = valeur;
  }

  return {
    methode,
    // Un objet vide dirait « on a regardé, il n'y a rien à mesurer ». NULL dit
    // « on ne sait pas », et c'est ce qui est vrai.
    caracteristiques: Object.keys(mesures).length > 0 ? mesures : null,
  };
}

// =========================================================================
// Les caractéristiques : un contrat central, pas des clés qui s'accumulent
// =========================================================================
//
// **Pourquoi des clés typées plutôt que `{ valeur, unite }` par mesure.**
// L'inspection du dépôt le tranche : chaque caractéristique n'a qu'UNE unité
// canonique, partout, et les tranches de la grille sont écrites dans cette
// unité-là — les diamètres en centimètres (« 40 à 50 cm »), les hauteurs en
// mètres (« 15 à 20 m »), la haie au mètre linéaire, les grumes à la tonne.
// Porter l'unité à côté de chaque valeur ajouterait un point de conversion là
// où il n'y a rien à convertir, et une conversion silencieuse est exactement ce
// qu'on ne veut pas.
//
// **Ce qui rend ce choix réversible :** l'unité est dans le NOM de la clé, et
// une seule fonction lit ces objets. Le jour où une mesure aura deux unités,
// c'est ici qu'on le verra, et nulle part ailleurs.

/** Les mesures qui gouvernent un prix, chacune dans son unité canonique. */
export type Caracteristiques = {
  /** Diamètre du tronc, en centimètres — l'unité des tranches de la grille. */
  diametreCm?: number;
  /** Hauteur de l'arbre, en mètres. */
  hauteurM?: number;
  /** Longueur de haie, en mètres linéaires. */
  longueurMl?: number;
  /** Poids des grumes, en tonnes. */
  tonnageT?: number;
};

const MESURES_CONNUES = ["diametreCm", "hauteurM", "longueurMl", "tonnageT"] as const;

/**
 * Relit un objet de caractéristiques venu de la base, et refuse ce qui n'en est
 * pas une.
 *
 * **Une seule porte d'entrée, et c'est tout l'intérêt.** Un JSONB accepte
 * n'importe quoi ; sans ce filtre, une clé inventée par un appelant pressé
 * vivrait en base sans que rien ne s'en aperçoive, et une valeur négative
 * traverserait jusqu'au calcul d'un prix. Ce qui n'est pas reconnu est ignoré,
 * jamais converti ni deviné.
 */
export function lireCaracteristiques(brut: unknown): Caracteristiques {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const source = brut as Record<string, unknown>;
  const propres: Caracteristiques = {};
  for (const cle of MESURES_CONNUES) {
    const valeur = Number(source[cle]);
    // Zéro et les négatifs ne sont pas des mesures : un tronc de 0 cm n'existe
    // pas, et le laisser passer désignerait une case de grille au hasard.
    if (Number.isFinite(valeur) && valeur > 0) propres[cle] = valeur;
  }
  return propres;
}
