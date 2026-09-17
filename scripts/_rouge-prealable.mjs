/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CE ROUGE ÉTAIT-IL DÉJÀ LÀ SUR `main` ? — la question, et rien d'autre
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa règle du 17 septembre 2026, après une journée entière perdue :**
 *
 *   « Je ne veux plus qu'un lot soit bloqué par un rouge provenant d'une autre
 *     session, ni qu'une batterie complète soit relancée sur main uniquement
 *     pour établir un état de référence. Le garde doit répondre à une seule
 *     question : ce lot introduit-il une NOUVELLE régression ? »
 *
 * **CE QUE CELA REMPLACE, et pourquoi c'était contre-productif.** Le mécanisme
 * du 16 septembre comparait le verdict d'un lot à un **état global de `main`**,
 * mesuré par une batterie entière jouée sur un arbre propre. Tant que cette
 * mesure n'existait pas sur la machine, un verdict rouge fermait la porte —
 * même quand le rouge tombait dans une zone du produit que le lot ne touche
 * pas. Le seul remède coûtait trente à cinquante minutes, et il fallait le
 * repayer à chaque `main` qui avance. Ce jour-là, un lot du planning prêt
 * depuis le matin est resté bloqué par la porte du devis de l'accueil, cassée
 * par une autre session.
 *
 * **CE QUI LE REMPLACE : une comparaison CIBLÉE, et seulement des rouges.**
 * On ne mesure plus `main` en entier. Pour chaque suite rouge — celles-là
 * seules —, on la rejoue sur une copie propre du commit de `main` qui sert de
 * base au lot. Trois réponses, et trois seulement :
 *
 * | les deux côtés, à conditions égales | ce que ça vaut |
 * |---|---|
 * | le même sort | **pas causé par ce lot** — il ne le bloque pas |
 * | verte sur `main`, rouge ici | **nouvelle régression** — la fusion est refusée |
 * | l'un des deux illisible | **bloqué, sur ce cas-là seulement** |
 *
 * **Ce que ce fichier ne fait pas, et c'est délibéré :** il ne lance rien, ne
 * lit aucun dépôt, ne touche pas au disque. Il ne porte que la décision, pour
 * qu'elle s'éprouve sans git et sans navigateur — c'est la couche la plus
 * basse (`CLAUDE.md` §4 sexies).
 */

/**
 * CE QUE LA COMPARAISON REND, une fois la suite rejouée DES DEUX CÔTÉS.
 *
 * **Les deux côtés, dos à dos, et c'est ce qui manquait.** Mesurer `main` seul
 * ne dit rien : une suite peut rougir chez l'un et passer chez l'autre pour une
 * raison qui n'est dans aucun des deux diffs — l'état que la base a gardé du
 * contrôle précédent. Le 17 septembre 2026, `test-accueil-vide-porte-e2e` a été
 * déclarée « verte sur main, donc cassée par ce lot » parce que la copie venait
 * d'amorcer sa base, quand le lot mesurait après cent cinquante suites. Rejouée
 * sur `main` dans le MÊME état, elle tombait à l'identique.
 *
 * **La question ne porte que sur le DIFF**, et le diff est la seule différence
 * entre les deux arbres : à conditions égales, un résultat identique des deux
 * côtés n'est pas causé par lui.
 */
export const SUR_MAIN = {
  /** Le même sort des deux côtés : ce n'est pas ce lot qui le cause. */
  PAREIL: "pareil",
  /** Verte sur main, rouge ici : la régression. */
  CASSE_PAR_LE_LOT: "casse-par-le-lot",
  /** L'un des deux n'a rien rendu de lisible. */
  INDETERMINE: "indetermine",
};

/**
 * LA DÉCISION, à partir des rouges du lot et de ce que `main` en dit.
 *
 * @param {string[]} rouges      les suites rouges du verdict du lot
 * @param {Record<string, string>} surMain  suite → `SUR_MAIN.*`
 * @returns {{ ok: boolean, raison: string, toleres: string[], bloquants: string[], manquants: string[] }}
 */
export function decisionSurLesRouges(rouges, surMain = {}) {
  const listes = { toleres: [], bloquants: [], manquants: [] };
  for (const suite of rouges) {
    const dit = surMain[suite];
    if (dit === SUR_MAIN.PAREIL) listes.toleres.push(suite);
    else if (dit === SUR_MAIN.CASSE_PAR_LE_LOT) listes.bloquants.push(suite);
    // **Une réponse absente vaut « indéterminé »**, et se bloque comme lui :
    // ne pas savoir n'est jamais « c'était déjà rouge » (`CLAUDE.md` §5).
    else listes.manquants.push(suite);
  }

  if (listes.bloquants.length > 0) {
    return {
      ok: false,
      raison:
        `${listes.bloquants.length} régression(s) NOUVELLE(s) — verte(s) sur main, ` +
        `rouge(s) avec ce lot, à conditions égales : ${listes.bloquants.join(", ")}`,
      ...listes,
    };
  }
  if (listes.manquants.length > 0) {
    return {
      ok: false,
      raison:
        `${listes.manquants.length} rouge(s) dont on ne sait pas s'ils viennent de ce lot : ` +
        listes.manquants.join(", "),
      ...listes,
    };
  }
  return { ok: true, raison: "", ...listes };
}

/**
 * CE QU'IL RESTE À REJOUER SUR LA BASE DE `main`.
 *
 * **On ne rejoue que ce qu'on ne sait pas déjà**, et seulement pour CETTE
 * base : une réponse enregistrée sur un autre commit de `main` ne dit rien de
 * celui-ci — entre les deux, quelqu'un a pu casser ou réparer la suite.
 *
 * @param {string[]} rouges
 * @param {{ base?: string, suites?: Record<string, string> } | null} connues
 * @param {string} base  le commit de `main` qui sert de base au lot
 */
export function resteARejouer(rouges, connues, base) {
  if (!connues || connues.base !== base) return [...rouges];
  const su = connues.suites ?? {};
  return rouges.filter((s) => su[s] !== SUR_MAIN.PAREIL && su[s] !== SUR_MAIN.CASSE_PAR_LE_LOT);
}

/**
 * CE QUE LE LOT SAIT DÉJÀ, pour cette base — le reste est à mesurer.
 *
 * @param {{ base?: string, suites?: Record<string, string> } | null} connues
 * @param {string} base
 */
export function surMainPourCetteBase(connues, base) {
  if (!connues || connues.base !== base) return {};
  return { ...(connues.suites ?? {}) };
}
