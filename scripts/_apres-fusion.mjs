/**
 * UN LOT DÉJÀ ÉPROUVÉ, REPOSÉ SUR UN `main` QUI A AVANCÉ — ce qu'on rejoue.
 *
 * **Sa règle du 17 septembre 2026 :** *« Chaque lot doit prouver SON propre
 * travail. Le fait que main change parce qu'une autre session a fusionné ne
 * doit jamais, à lui seul, provoquer une nouvelle batterie complète. […] Si
 * les changements arrivés de main sont sans rapport avec le lot : aucun
 * nouveau test lourd. S'ils touchent réellement une dépendance utilisée par le
 * lot : rejoue uniquement les tests ciblés concernés. »*
 *
 * Ce qui rend la règle SÛRE, et pourquoi chaque condition est là :
 *
 *   1. **ce qui a bougé se lit par le CONTENU** — l'empreinte du verdict, et
 *      git pour ce qu'elle n'indexe pas (`_ce-qui-a-bouge.mjs`). Comparer des
 *      diffs texte, comme le faisait la première version, refusait dès qu'une
 *      ligne voisine bougeait — donc au moment même où l'on corrigeait un
 *      rouge, et c'est la boucle du 17 septembre 2026 au soir ;
 *   2. **ce que `main` a apporté a déjà passé SON garde-fou** — chaque commit
 *      arrivé sur `main` y est entré par son propre contrôle ; ce qui n'a
 *      jamais été mesuré, c'est la RENCONTRE des deux ;
 *   3. **la rencontre se MESURE, elle ne se suppose pas** (`rencontreReelle`).
 *      Elle n'a lieu que là où ce que `main` a touché croise ce que le lot
 *      touche, emploie, ou ce qui l'emploie — le graphe d'imports le dit, dans
 *      les deux sens. Vide : rien à rejouer, le verdict vaut tel quel. Non
 *      vide : les suites de CES fichiers-là, et elles seules.
 *
 * **CE QUI A ÉTÉ RETIRÉ, parce que c'était la cascade qu'il refuse.** La
 * première version rejouait, à chaque avancée de `main` : toutes les suites du
 * dépôt, les écrans du lot, les écrans touchés par `main`, et les suites
 * apportées par `main` — sans jamais demander si les deux se rencontraient.
 * Deux sessions dans le même grand domaine se relançaient l'une l'autre
 * indéfiniment.
 *
 * **Ce qui reste une batterie entière** : un lot qui a changé, un verdict
 * d'avant ce mécanisme (sans commit), un verdict qui portait un rouge nouveau,
 * et une rencontre qui atteint elle-même le niveau 3 — une migration arrivée
 * de `main` sous un lot qui touche la base, par exemple. Le complément ne SAIT
 * rejouer que ce qui se nomme.
 */

/**
 * LA RENCONTRE RÉELLE entre ce que `main` a apporté et ce que le lot occupe.
 *
 * **Ce n'est pas « main a bougé »**, c'est « main a bougé LÀ OÙ le lot vit ».
 * Le graphe d'imports le dit dans les deux sens : ce que le lot emploie — une
 * règle qui change sous lui — et ce qui l'emploie — un appelant dont la
 * signature ne correspond plus.
 *
 * **Ce qui n'est dans aucun des deux sens ne se rejoue pas.** Une fiche client
 * et un plan d'arrosage ne se rencontrent nulle part : les faire s'attendre,
 * c'est la cascade de batteries qu'il a fait supprimer.
 *
 * **Hors de `src/`, on ne conclut pas à la légère** : une migration, un
 * réglage de construction, un fichier d'outillage n'ont pas d'arête dans le
 * graphe. Ils entrent donc dans la rencontre dès qu'ils arrivent — c'est le
 * côté sûr, et c'est exactement ce que le PLANCHER dit déjà du niveau.
 *
 * @param {{ fichiersDuLot: string[], fichiersDuDelta: string[], graphe: { entourage: (f: string[]) => Set<string> } }} p
 * @returns {{ fichiers: string[], sansRapport: boolean }}
 */
export function rencontreReelle({ fichiersDuLot, fichiersDuDelta, graphe }) {
  const entourage = graphe.entourage(fichiersDuLot);
  const fichiers = fichiersDuDelta.filter((f) => {
    const chemin = f.replace(/\\/g, "/");
    // Ce que le graphe ne sait pas lire ne se déclare jamais « sans rapport ».
    if (!/^src\/.*\.(ts|tsx)$/.test(chemin)) return !chemin.startsWith("docs/") && !chemin.startsWith("appli/") && !chemin.endsWith(".md");
    return entourage.has(chemin);
  });
  return { fichiers: [...new Set(fichiers)].sort(), sansRapport: fichiers.length === 0 };
}

/**
 * Les suites navigateur à rejouer : celles des écrans que la RENCONTRE touche,
 * et les suites que `main` a apportées si elles y tombent.
 *
 * @param {{ suitesDeLaRencontre: string[], fichiersDeLaRencontre: string[] }} p
 */
export function suitesDuComplement({ suitesDeLaRencontre, fichiersDeLaRencontre }) {
  const apportees = fichiersDeLaRencontre
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /^scripts\/test-.*-e2e\.ts$/.test(f))
    .map((f) => f.slice("scripts/".length));
  return [...new Set([...suitesDeLaRencontre, ...apportees])].sort();
}

/**
 * Les rouges du verdict complété : ceux du verdict d'avant, moins les suites
 * rejouées (leur sort vient d'être remesuré), plus ceux mesurés maintenant.
 *
 * Une suite rejouée verte sort de la liste ; une suite non rejouée garde son
 * rouge d'avant — on ne sait rien de neuf sur elle, et « on ne sait pas »
 * n'est jamais « vert ».
 */
export function rougesApresComplement({ rougesAvant, suitesRejouees, rougesMesures }) {
  const rejouees = new Set(suitesRejouees);
  const gardes = (rougesAvant ?? []).filter((r) => !rejouees.has(r));
  return [...new Set([...gardes, ...rougesMesures])].sort();
}
