// **Retrouver une prestation déjà écrite, et l'enrichir sans jamais l'écraser.**
//
// ─── Le doublon qu'on répare, et il était mesurable ─────────────────────────
//
// Le patron rejoue souvent la dictée — un second appui, un retour arrière, une
// correction. Jusqu'ici, `confirmerBrouillon` reconnaissait une prestation déjà
// présente par **l'égalité exacte de son libellé**. Or ses réponses à l'arrêt
// d'avant-chiffrage ALLONGENT ce libellé :
//
//     « Abattage d'un érable »
//         devient
//     « Abattage d'un érable — démontage avec rétention, ⌀ 45 cm »
//
// Au rejeu suivant, le libellé recalculé ne correspondait plus, et une SECONDE
// prestation était créée. Vérifié en base le 27 août 2026 : deux lignes pour un
// seul arbre. C'est le défaut du 3 août sous un troisième visage — celui que
// `confirmerBrouillon` existe précisément pour empêcher.
//
// ─── Ce que ce module fait, et ce qu'il refuse de faire ─────────────────────
//
// Il reconnaît la MÊME prestation, et il dit ce qu'on a le droit d'y ajouter.
//
// **Aucun rapprochement approximatif.** Pas de distance d'édition, pas de « ça
// se ressemble ». Deux formes seulement : le libellé identique, ou le libellé
// identique **suivi du tiret d'enrichissement**. Tout le reste est une autre
// prestation, et une fusion sur une ressemblance ferait disparaître un travail
// que l'artisan facturerait.
//
// **On ne remplace jamais une valeur déjà posée.** Un champ vide se remplit ;
// un champ rempli ne bouge pas, même si la nouvelle extraction dit autre chose.
// C'est ce qui protège une correction humaine sans avoir à savoir qui l'a
// écrite — et le dépôt ne le sait pas, faute de colonne de provenance.

import { libelleEnrichi } from "./questions-chiffrage";

/** Une prestation déjà en base, réduite à ce qui sert au rapprochement. */
export type PrestationExistante = {
  id: string;
  libelle: string;
  quantite?: string | null;
  unite?: string | null;
  aConfirmer?: boolean | null;
};

/**
 * La prestation déjà écrite qui correspond à ce libellé, ou `null`.
 *
 * **Le séparateur reconnu est celui de `libelleEnrichi`**, et il n'est pas
 * recopié ici : deux écritures du même tiret finiraient par diverger, et le
 * rapprochement cesserait de fonctionner sans qu'aucune erreur ne le dise.
 */
export function prestationCorrespondante(
  libelle: string,
  existantes: readonly PrestationExistante[]
): PrestationExistante | null {
  const cherche = libelle.trim().toLowerCase();
  if (!cherche) return null;

  // Le préfixe d'enrichissement, demandé à la source qui l'écrit.
  const avecTiret = libelleEnrichi(libelle, ["·"]).trim().toLowerCase();
  const prefixe = avecTiret.slice(0, avecTiret.length - 1); // « … — »

  return (
    existantes.find((p) => {
      const actuel = p.libelle.trim().toLowerCase();
      return actuel === cherche || actuel.startsWith(prefixe);
    }) ?? null
  );
}

export type Enrichissement = {
  /** Les champs à poser — uniquement ceux qui étaient vides. */
  aPoser: { quantite?: string; unite?: string; aConfirmer?: boolean };
  /** Ce que la nouvelle lecture dit et qui contredit ce qui est déjà là. */
  contradictions: string[];
};

/**
 * Ce qu'une nouvelle extraction a le droit d'ajouter à une prestation existante.
 *
 * Quatre cas, et un seul écrit quelque chose :
 *
 * | Champ existant | Nouvelle valeur | Résultat |
 * |---|---|---|
 * | vide | connue | **posée** |
 * | identique | identique | rien à faire |
 * | rempli | différente | **contradiction** — rien n'est écrit, et on le dit |
 * | quelconque | inconnue | rien |
 *
 * **La quantité et l'unité vont ensemble**, parce que la base l'exige et parce
 * qu'une mesure sans son unité ne veut rien dire. Poser l'une sans l'autre
 * ferait échouer l'écriture de toute la dictée.
 */
export function enrichissementPossible(
  existante: PrestationExistante,
  nouvelle: { quantite: string | null; unite: string | null; aConfirmer: boolean }
): Enrichissement {
  const aPoser: Enrichissement["aPoser"] = {};
  const contradictions: string[] = [];

  const quantiteVide = existante.quantite === null || existante.quantite === undefined;
  const uniteVide = existante.unite === null || existante.unite === undefined;

  if (nouvelle.quantite !== null && nouvelle.unite !== null) {
    if (quantiteVide && uniteVide) {
      aPoser.quantite = nouvelle.quantite;
      aPoser.unite = nouvelle.unite;
    } else {
      const memeQuantite = Number(existante.quantite) === Number(nouvelle.quantite);
      const memeUnite = (existante.unite ?? "").trim() === nouvelle.unite.trim();
      if (!memeQuantite || !memeUnite) {
        contradictions.push(
          `« ${existante.libelle} » porte déjà ${existante.quantite ?? "—"} ${existante.unite ?? ""}`.trim() +
            ` et la dictée dit ${nouvelle.quantite} ${nouvelle.unite}. Rien n'a été modifié.`
        );
      }
    }
  }

  if (existante.aConfirmer === null || existante.aConfirmer === undefined) {
    aPoser.aConfirmer = nouvelle.aConfirmer;
  }

  return { aPoser, contradictions };
}
