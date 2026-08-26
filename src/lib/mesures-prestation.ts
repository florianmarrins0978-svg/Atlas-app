// **Deux sources pour la même mesure, et personne ne tranche en silence.**
//
// Depuis le lot B, une prestation neuve porte ses mesures dans des colonnes
// (`caracteristiques`) **et** dans son libellé (« ⌀ 45 cm »). C'est voulu le
// temps de la transition : quatre moteurs relisent encore le texte, et le leur
// retirer avant qu'ils sachent lire les colonnes ferait perdre à une haie son
// prix au mètre linéaire.
//
// Mais deux représentations peuvent se contredire. Ce module dit laquelle vaut,
// et **refuse de choisir quand elles divergent**.
//
// ─── Pourquoi le refus, plutôt que « la structure gagne » ───────────────────
//
// Le seul cas où elles divergent aujourd'hui, c'est un libellé **retouché à la
// main** : `modifierPrestation` réécrit le texte et ne touche pas aux colonnes,
// qui restent alors sur la valeur d'origine.
//
// Faire gagner la structure, ce serait **ignorer une correction humaine** — le
// patron corrige « (800 ml) » en « (80 ml) » et rien ne change. Faire gagner le
// texte, ce serait rendre les colonnes décoratives. Les deux sont des
// arbitrages silencieux, et un chiffre faux sur un devis ne se rattrape pas.
//
// On refuse donc la mesure, **et on dit laquelle des deux valeurs on a vues.**
// Le chiffrage retombe alors sur son chemin habituel — la case n'est pas
// trouvée, la ligne s'écrit sans prix, et l'écran nomme ce qui manque. C'est le
// mécanisme qui existe déjà pour une mesure absente ; on ne fabrique rien de
// neuf, on lui donne une raison de plus.

import type { Caracteristiques } from "./prestation-structuree";
import { diametreLu, hauteurLue, longueurHaieLue, tonnageLu } from "./mesures-arbre";
import { lireCaracteristiques } from "./prestation-structuree";

export type MesureResolue =
  /** Une valeur sûre, et d'où elle vient. */
  | { valeur: number; origine: "structure" | "libelle" }
  /** Aucune des deux sources ne la porte. */
  | { valeur: null; origine: "aucune" }
  /** Les deux la portent, et pas la même. On ne choisit pas. */
  | { valeur: null; origine: "contradiction"; structure: number; libelle: number };

/**
 * Deux mesures sont-elles la même ?
 *
 * **Une tolérance, parce que les deux chemins n'arrondissent pas pareil.** La
 * colonne est un `numeric(10,2)` — 45 y devient 45.00 — quand le libellé porte
 * « ⌀ 45 cm ». Sans marge, chaque prestation neuve se déclarerait en
 * contradiction avec elle-même, et le chiffrage s'arrêterait partout.
 *
 * Un centième d'unité : assez pour absorber l'écriture décimale, trop peu pour
 * confondre deux mesures qu'un artisan distingue.
 */
function memeMesure(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function resoudre(structure: number | undefined, texte: number | null): MesureResolue {
  if (structure !== undefined && texte !== null) {
    return memeMesure(structure, texte)
      ? { valeur: structure, origine: "structure" }
      : { valeur: null, origine: "contradiction", structure, libelle: texte };
  }
  if (structure !== undefined) return { valeur: structure, origine: "structure" };
  if (texte !== null) return { valeur: texte, origine: "libelle" };
  return { valeur: null, origine: "aucune" };
}

export type MesuresResolues = {
  diametreCm: MesureResolue;
  hauteurM: MesureResolue;
  longueurMl: MesureResolue;
  tonnageT: MesureResolue;
};

/**
 * Ce qu'on sait des mesures d'un chantier, structure et texte confrontés.
 *
 * @param structurees Les `caracteristiques` des prestations concernées, telles
 *   qu'elles sortent de la base. La première valeur trouvée l'emporte — comme
 *   `mesuresArbre` le fait depuis toujours pour le texte, et pour la même
 *   raison : sur un chantier à deux arbres, aucune des deux lectures ne sait
 *   les distinguer. **Ce n'est pas réglé ici** ; ce le sera quand le chiffrage
 *   travaillera prestation par prestation.
 * @param textes Les libellés et les lignes de la dictée, dans l'ordre où le
 *   chiffrage les lit aujourd'hui — ses réponses d'abord.
 */
export function mesuresResolues(
  structurees: readonly unknown[],
  textes: readonly string[]
): MesuresResolues {
  const propres: Caracteristiques[] = structurees.map(lireCaracteristiques);
  const premiere = (cle: keyof Caracteristiques): number | undefined =>
    propres.map((c) => c[cle]).find((v): v is number => v !== undefined);

  const premierTexte = (lire: (t: string) => number | null): number | null =>
    textes.map(lire).find((v): v is number => v !== null) ?? null;

  return {
    diametreCm: resoudre(premiere("diametreCm"), premierTexte(diametreLu)),
    hauteurM: resoudre(premiere("hauteurM"), premierTexte(hauteurLue)),
    longueurMl: resoudre(premiere("longueurMl"), premierTexte(longueurHaieLue)),
    tonnageT: resoudre(premiere("tonnageT"), premierTexte(tonnageLu)),
  };
}

/** Ce que le patron doit lire quand deux sources se contredisent. */
export function reserveDeContradiction(nom: string, m: MesureResolue): string | null {
  if (m.origine !== "contradiction") return null;
  return (
    `« ${nom} » : la dictée dit ${m.structure} et le libellé dit ${m.libelle}. ` +
    "Le prix n'a pas été calculé sur une valeur incertaine — corrigez celle qui est bonne."
  );
}
