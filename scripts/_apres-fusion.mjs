/**
 * UN LOT DÉJÀ ÉPROUVÉ, REPOSÉ SUR UN `main` QUI A AVANCÉ — ce qu'on rejoue.
 *
 * **Sa règle du 17 septembre 2026 :** *« Rejoue juste ce qui a bougé ! »* —
 * devant une troisième batterie de cinquante minutes pour un lot dont la
 * deuxième venait de rendre un verdict sans rouge nouveau, et que `main` avait
 * seulement dépassé de neuf commits pendant qu'elle mesurait.
 *
 * Ce qui rend la règle SÛRE, et pourquoi chaque condition est là :
 *
 *   1. **le lot n'a pas changé d'une ligne** — son diff contre sa base est
 *      identique à celui que la batterie a mesuré. Sinon ce n'est plus le
 *      même lot, et rien de ce qui a été mesuré ne vaut ;
 *   2. **ce que `main` a apporté a déjà passé SON garde-fou** — chaque commit
 *      arrivé sur `main` y est entré par une batterie ou un niveau 2 ; ce qui
 *      n'a jamais été mesuré, c'est la RENCONTRE des deux ;
 *   3. **la rencontre se rejoue là où elle a lieu** : les suites base (elles
 *      sont rapides et voient une règle qui bouge), les suites navigateur des
 *      écrans du lot et des écrans que `main` a touchés, et les suites que
 *      `main` a ajoutées ou modifiées — celles-là n'existaient pas quand le
 *      lot a été mesuré.
 *
 * **Ce qui reste une batterie entière** : un lot qui a changé, un verdict
 * d'avant ce mécanisme (sans commit), un verdict qui portait un rouge nouveau.
 * Le complément ne SAIT rejouer que ce qui se nomme.
 */

/** Le diff d'un lot, débarrassé de ce qui change sans que le lot change. */
export function empreinteDuDiff(diff) {
  return String(diff ?? "")
    .split("\n")
    // `index abc..def` porte les identifiants d'objets : ils changent avec la
    // base, pas avec le contenu. Tout le reste — fichiers, contexte, lignes
    // ajoutées et retirées — doit être identique.
    .filter((l) => !/^index [0-9a-f]+\.\.[0-9a-f]+/.test(l))
    .join("\n");
}

export function lotInchange(diffAvant, diffApres) {
  return empreinteDuDiff(diffAvant) === empreinteDuDiff(diffApres);
}

/**
 * Les suites navigateur à rejouer : celles des écrans du lot, celles des
 * écrans que `main` a touchés, et les suites que `main` a apportées.
 *
 * @param {{ suitesDuLot: string[], suitesDuDelta: string[], fichiersDuDelta: string[] }} p
 */
export function suitesDuComplement({ suitesDuLot, suitesDuDelta, fichiersDuDelta }) {
  const apportees = fichiersDuDelta
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /^scripts\/test-.*-e2e\.ts$/.test(f))
    .map((f) => f.slice("scripts/".length));
  return [...new Set([...suitesDuLot, ...suitesDuDelta, ...apportees])].sort();
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
