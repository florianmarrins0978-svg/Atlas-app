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
//
// ─── Deux ajouts du 27 août 2026 ────────────────────────────────────────────
//
// **1. La QUANTITÉ dictée est une mesure, et elle ne l'était pas.** 800 « ml »
// sur une haie SONT la longueur qui fait son prix. La colonne existait depuis
// le lot B et n'atteignait aucun calcul : le chiffrage relisait « (800 ml) »
// dans le libellé, si bien que corriger la colonne ne changeait rien au prix.
// La traduction se fait par `caracteristiqueDeLaQuantite`, qui refuse dès que
// l'unité ne concorde pas — 800 m² de haie ne sont pas une longueur.
//
// **2. Une correction de l'artisan TRANCHE au lieu de bloquer.** Le refus
// ci-dessus existe parce qu'on ne savait pas qui avait écrit quoi. Depuis que
// `prestations.corrige_par_humain` le dit (migration 0070), une valeur qu'il a
// posée lui-même l'emporte sur un libellé que personne n'a mis à jour. C'est sa
// demande : ne plus avoir à réécrire « (800 ml) » en « (80 ml) » dans le texte
// pour que le prix suive.

import type { Caracteristiques } from "./prestation-structuree";
import { diametreLu, hauteurLue, longueurHaieLue, tonnageLu } from "./mesures-arbre";
import { lireCaracteristiques } from "./prestation-structuree";
import { caracteristiqueDeLaQuantite } from "./natures-prestation";

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

function resoudre(
  structure: number | undefined,
  texte: number | null,
  /** La structure a-t-elle été posée par l'artisan lui-même ? */
  faitFoi: boolean
): MesureResolue {
  if (structure !== undefined && texte !== null && !memeMesure(structure, texte)) {
    // **Sauf quand c'est LUI qui a tranché.** Une valeur qu'il a corrigée à la
    // main n'entre pas en concurrence avec un libellé que personne n'a mis à
    // jour : refuser de chiffrer reviendrait à ignorer sa correction, ce qui
    // est exactement ce dont il se plaignait — devoir réécrire « (800 ml) » en
    // « (80 ml) » dans le texte pour que le prix suive.
    if (!faitFoi) return { valeur: null, origine: "contradiction", structure, libelle: texte };
  }
  if (structure !== undefined) return { valeur: structure, origine: "structure" };
  if (texte !== null) return { valeur: texte, origine: "libelle" };
  return { valeur: null, origine: "aucune" };
}

/**
 * Une prestation, réduite à ce qui porte une mesure.
 *
 * **Pourquoi ce n'est plus un simple objet de caractéristiques.** La quantité
 * dictée vivait dans `prestations.quantite` depuis le lot B et n'atteignait
 * AUCUN calcul : le chiffrage relisait « (800 ml) » dans le libellé. Corriger
 * la colonne ne changeait donc rien au prix — elle était décorative.
 */
export type SourceMesures = {
  caracteristiques?: unknown;
  quantite?: string | null;
  unite?: string | null;
  nature?: string | null;
  /** L'artisan a posé ces valeurs lui-même : elles tranchent (migration 0070). */
  corrigeParHumain?: boolean | null;
  libelle?: string;
  id?: string;
};

const CLES_SOURCE = ["caracteristiques", "quantite", "unite", "nature", "corrigeParHumain", "libelle", "id"];

/**
 * Accepte les deux formes d'entrée, et les distingue sans ambiguïté.
 *
 * Un objet qui porte l'une des clés d'une prestation EST une prestation ; tout
 * le reste est un objet de caractéristiques brut, comme avant. C'est ce qui
 * permet aux appelants de migrer un par un plutôt que d'un coup.
 */
function lireSource(brut: unknown): { mesures: Caracteristiques; faitFoi: boolean } {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return { mesures: {}, faitFoi: false };
  const objet = brut as Record<string, unknown>;
  if (!CLES_SOURCE.some((c) => c in objet)) return { mesures: lireCaracteristiques(brut), faitFoi: false };

  const s = brut as SourceMesures;
  // **Ses réponses à l'arrêt d'abord, la quantité dictée ensuite.** C'est la
  // priorité qui vaut partout ailleurs : il a pu corriger au moment qui coûte
  // de l'argent ce que la transcription avait mal entendu.
  const mesures: Caracteristiques = {
    ...(caracteristiqueDeLaQuantite(s.nature, s.quantite, s.unite) ?? {}),
    ...lireCaracteristiques(s.caracteristiques),
  };
  return { mesures, faitFoi: s.corrigeParHumain === true };
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
  const sources = structurees.map(lireSource);
  const premiere = (cle: keyof Caracteristiques): { valeur?: number; faitFoi: boolean } => {
    const trouvee = sources.find((s) => s.mesures[cle] !== undefined);
    return { valeur: trouvee?.mesures[cle], faitFoi: trouvee?.faitFoi ?? false };
  };

  const premierTexte = (lire: (t: string) => number | null): number | null =>
    textes.map(lire).find((v): v is number => v !== null) ?? null;

  const pour = (cle: keyof Caracteristiques, lire: (t: string) => number | null): MesureResolue => {
    const { valeur, faitFoi } = premiere(cle);
    return resoudre(valeur, premierTexte(lire), faitFoi);
  };

  return {
    diametreCm: pour("diametreCm", diametreLu),
    hauteurM: pour("hauteurM", hauteurLue),
    longueurMl: pour("longueurMl", longueurHaieLue),
    tonnageT: pour("tonnageT", tonnageLu),
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
