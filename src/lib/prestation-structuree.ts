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
// ici le défaut qu'on répare. Ce que le modèle propose comme nature est
// **vérifié** contre le référentiel : une taxonomie inventée en base
// contaminerait le regroupement des lignes de devis.

import type { LigneExtraite } from "../server/ai/schemas/extraction";
import { diametreLu, hauteurLue } from "./mesures-arbre";
import { nature } from "./natures-prestation";

export type PrestationStructuree = {
  /** En chiffres, prête pour une colonne numérique. `null` s'il n'a rien dit. */
  quantite: string | null;
  /** Son mot à lui, à la lettre. `null` s'il n'a rien dit. */
  unite: string | null;
  /**
   * La nature métier, **validée contre le référentiel**.
   *
   * Ce que le modèle rend est proposé, jamais cru sur parole : une nature qui
   * n'existe pas dans `natures-prestation.ts` vaut `null`. Sans ce filtre, une
   * taxonomie inventée s'installerait en base, et le regroupement des lignes de
   * devis avec elle.
   */
  nature: string | null;
  /** L'espèce, telle qu'elle a été prononcée. `null` si elle ne l'a pas été. */
  espece: string | null;
  /**
   * Les mesures qu'il a DICTÉES, rangées en colonne.
   *
   * **Ajouté le 30 août 2026, et c'est la correction d'un trou de la chaîne
   * réelle** — pas un embellissement. Voir le commentaire de
   * `mesuresDeLaDictee` plus bas : jusqu'ici, `diametreCm` n'était jamais
   * créé nulle part, et Atlas lui redemandait un diamètre qu'il venait de
   * prononcer.
   *
   * `null` quand la dictée n'en porte aucune — jamais un objet vide, qui
   * ferait croire à une mesure connue valant zéro.
   */
  caracteristiques: Record<string, number> | null;
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
 * **La nature et l'espèce viennent du MODÈLE depuis le 27 août 2026**, parce
 * que c'est lui qui a la dictée sous les yeux — pas d'un motif appliqué au
 * libellé, qui serait une septième lecture de texte métier. La nature est
 * ensuite vérifiée contre le référentiel ; l'espèce est recopiée telle quelle,
 * et le contrat lui interdit de la déduire.
 *
 * **Ce que cette fonction ne remplit toujours PAS** : `methode`. Elle arrive
 * d'ailleurs, et sûrement — des réponses du patron à l'arrêt d'avant-chiffrage
 * (`precisions_chantier`).
 *
 * `caracteristiques`, en revanche, se remplit ICI depuis le 30 août 2026 —
 * voir `mesuresDeLaDictee` juste en dessous.
 */
export function structureDeLaPrestation(ligne: LigneExtraite): PrestationStructuree {
  const quantite = quantiteLue(ligne.quantite);
  const unite = ligne.unite?.trim() || null;
  const ensemble = quantite !== null && unite !== null;
  // **Ce que le modèle propose comme nature est VÉRIFIÉ, jamais cru.** Le
  // référentiel est une liste fermée ; ce qui n'y figure pas vaut « on ne sait
  // pas », et le travail garde sa propre ligne (`lignes-vendables.ts`).
  const naturePropose = ligne.nature?.trim().toLowerCase() || null;
  return {
    quantite: ensemble ? quantite : null,
    unite: ensemble ? unite : null,
    nature: nature(naturePropose)?.cle ?? null,
    espece: ligne.espece?.trim() || null,
    caracteristiques: mesuresDeLaDictee(ligne),
    aConfirmer: ligne.aConfirmer,
  };
}

/**
 * Les mesures que la dictée porte, lues sur le texte que le modèle a rendu.
 *
 * ─── LE DÉFAUT QUE CECI CORRIGE, et il faut le connaître avant d'y toucher ──
 *
 * **Le 30 août 2026, sur un vrai test téléphone**, le patron dicte « démontage
 * d'un érable de 40 centimètres au pied » et « dessouchage de deux souches de
 * 60 » — puis Atlas lui redemande, à l'écran, quel diamètre fait le tronc et
 * quel diamètre fait la souche. Il venait de les prononcer.
 *
 * En remontant la chaîne réelle, `diametreCm` ne se perdait nulle part : **il
 * n'était jamais créé.**
 *
 * | étape | ce qu'elle fait de la mesure |
 * |---|---|
 * | transcription | « souches de 60 » est bien là |
 * | JSON du modèle | **aucun champ pour une mesure** — le contrat n'en a pas |
 * | `libelleAvecQuantite` | ne garde que la quantité : « Dessouchage (2 souche) » |
 * | `ajouterPrestation` | écrit le libellé et la structure — la `description` du modèle n'est pas persistée |
 * | colonnes | `caracteristiques` restait **toujours NULL** à ce stade |
 * | `questionsAvantChiffrage` | ne trouve ni colonne ni texte, donc **elle demande** |
 *
 * Le seul écrivain de `caracteristiques` était `structureDepuisPrecisions` —
 * c'est-à-dire **ses réponses aux questions dont il se plaint**. La boucle se
 * refermait sur elle-même : la seule façon d'avoir le diamètre en base était
 * qu'il le saisisse, donc qu'on le lui demande.
 *
 * ─── POURQUOI ICI, ET PAS AILLEURS ─────────────────────────────────────────
 *
 * C'est le dernier endroit où la matière existe encore. `ligne.description`
 * vit dans le JSON du modèle et **meurt à l'insertion** : la lire plus tard,
 * dans `questions-chiffrage.ts`, serait la chercher là où elle n'est plus.
 * Corriger l'écran aurait laissé le trou intact — et le prix avec, puisque le
 * chiffrage lit la même colonne.
 *
 * ─── CE QUE CELA NE FAIT PAS ───────────────────────────────────────────────
 *
 * **Aucune valeur n'est devinée.** On relit le texte du modèle avec le même
 * vocabulaire que le chiffrage (`mesures-arbre.ts`), qui porte déjà ses
 * conventions métier — « souche de 60 », « 40 au pied », l'unité facultative.
 * Ce qui ne s'y lit pas ne s'écrit pas : la question se pose alors, comme
 * avant.
 *
 * **Aucun prix ne change de règle.** Le diamètre entre dans la colonne que le
 * chiffrage lisait déjà ; le résultat est celui qu'il aurait obtenu en tapant
 * « 60 » dans la question. On lui épargne la frappe, pas l'arbitrage.
 */
function mesuresDeLaDictee(ligne: LigneExtraite): Record<string, number> | null {
  // **Le libellé ET la description.** Le modèle range volontiers la mesure
  // dans l'une ou dans l'autre, et rien dans le contrat ne l'oblige à choisir.
  // N'en lire qu'une, c'est perdre la moitié des dictées.
  const texte = [ligne.libelle, ligne.description ?? ""].join(" ");
  const mesures: Record<string, number> = {};
  const diametre = diametreLu(texte);
  if (diametre !== null) mesures.diametreCm = diametre;
  const hauteur = hauteurLue(texte);
  if (hauteur !== null) mesures.hauteurM = hauteur;
  // `null` plutôt qu'un objet vide : `{}` en base se relit comme « on a
  // regardé et il n'y a rien », alors que NULL dit « on ne sait pas ». La
  // nuance compte le jour où une autre source viendra compléter la ligne.
  return Object.keys(mesures).length > 0 ? mesures : null;
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

// =========================================================================
// Relire la quantité écrite DANS un libellé — son geste à lui
// =========================================================================
//
// **Ce n'est pas une base de données, c'est une SAISIE.** Le libellé n'est plus
// la source des données métier (§4 du brief du 27 août 2026) ; mais quand
// l'artisan corrige « Haie (800 ml) » en « Haie (80 ml) » sur son écran, il
// vient de dire quelque chose, et l'ignorer serait pire que tout : le prix ne
// suivrait pas, et il ne comprendrait pas pourquoi.
//
// C'est exactement ce dont il se plaignait, à l'envers : avant, sa correction
// du texte ne changeait rien parce que le prix venait de la colonne ; refuser
// de la lire maintenant reproduirait le même mur.

/** Le format qu'écrit `libelleAvecQuantite` : « Haie (tout genre) (800 ml) ». */
const QUANTITE_ECRITE = /\((\d+(?:[.,]\d+)?)\s*([^)\d]{1,12})\)\s*$/;

/**
 * La quantité et l'unité qu'un libellé porte entre parenthèses, ou `null`.
 *
 * Ne devine rien : sans parenthèse finale au format attendu, il n'y a pas de
 * quantité, et une prestation dont le nom contient un chiffre — « Taille 3 » —
 * n'en produit pas.
 */
export function quantiteDuLibelle(libelle: string): { quantite: string; unite: string } | null {
  const trouve = QUANTITE_ECRITE.exec(libelle.trim());
  if (!trouve) return null;
  const quantite = quantiteLue(trouve[1]);
  const unite = trouve[2].trim();
  if (!quantite || !unite) return null;
  return { quantite, unite };
}
