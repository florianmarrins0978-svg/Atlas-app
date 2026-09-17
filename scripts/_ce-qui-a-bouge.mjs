/**
 * QU'EST-CE QUI A BOUGÉ DEPUIS LE VERDICT, ET QUE FAUT-IL REJOUER ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa colère du 17 septembre 2026, à 23 h :** *« ça recommence et c'est ça à
 * chaque fois ! »* — une batterie à 158 suites vertes sur 159, un rouge de
 * documentation corrigé en trois secondes, et cinquante minutes à repayer.
 *
 * Les décisions vivent ICI, en fonctions pures, et non dans le script qui les
 * applique : c'est la seule façon de les mettre en rouge sans attendre une
 * mesure d'une heure, et un script d'entrée ne s'importe pas
 * (`test-scripts-entree-non-importes.ts`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Ce que l'empreinte d'un verdict sait relever — le reste se lit dans git. */
const INDEXE_PAR_LEMPREINTE = /^(src|scripts|drizzle)\/.*\.(ts|tsx|js|mjs|mts|sql|css)$/;

/**
 * CE QUI A BOUGÉ, par deux lectures qui ne se recouvrent pas.
 *
 * **Ce n'est pas deux façons de répondre à la même question** (`CLAUDE.md` §3),
 * c'est une question découpée là où chaque outil sait répondre :
 *
 *   · l'empreinte compare des CONTENUS et couvre le code — elle seule voit
 *     juste sur un fichier mesuré sans être enregistré, et sur un fichier
 *     qu'une fusion a réécrit à l'identique ;
 *   · git couvre ce que l'empreinte n'indexe pas — un `.md`, `docs/`,
 *     `.claude/` —, et c'est précisément là que vivait son rouge de
 *     documentation.
 *
 * Ce que l'empreinte indexe est donc RETIRÉ de ce que git rapporte : sans
 * cela, une fusion ferait passer pour « bougé » un fichier identique, et l'on
 * remettrait le défaut qu'on vient de retirer du garde-fou.
 *
 * @param {string[]} parLeContenu  ce que `fichiersRemues` a trouvé
 * @param {string[]} parGit        ce que git rapporte comme changé
 */
export function ceQuiABouge(parLeContenu, parGit) {
  const dehors = parGit
    .map((c) => String(c).replace(/\\/g, "/").trim())
    .filter(Boolean)
    .filter((c) => !INDEXE_PAR_LEMPREINTE.test(c));
  return [...new Set([...parLeContenu.map((c) => String(c).replace(/\\/g, "/")), ...dehors])].sort();
}

/** Une suite navigateur se reconnaît à son nom, ici comme dans le moteur. */
const EST_E2E = /-e2e\.ts$/;

/**
 * CE QU'IL FAUT REJOUER — et la règle tient en une phrase : *ce qui était
 * rouge, plus ce que ce qui a bougé peut casser.*
 *
 * **Les étapes hors suites sont le cœur du rattrapage.** Types, Lint, Mémoire
 * du dépôt, Construction : elles n'ont pas de « rouge connu », donc une seule
 * ferme la fusion — et rien ne savait en rejouer une seule. C'est ce mur-là
 * qui coûtait cinquante minutes pour une ligne de documentation.
 *
 * **Les suites base se rejouent EN ENTIER ou pas du tout**, et c'est délibéré :
 * elles vident la base entre elles, et n'en jouer qu'une laisserait les autres
 * mesurées sur un jeu de données qu'elles n'ont pas posé (`CLAUDE.md` §5).
 *
 * @param {{ bouge: string[], rougesAvant?: string[], horsSuitesAvant?: string[], suitesDesEcrans?: string[] }} p
 * @returns {{ etapes: string[], navigateur: string[] }}
 */
export function aRejouer({ bouge, rougesAvant = [], horsSuitesAvant = [], suitesDesEcrans = [] }) {
  // Une minute, et c'est là qu'une correction se dénonce d'abord.
  const etapes = ["Types", "Lint"];
  for (const nom of horsSuitesAvant) {
    const propre = nom.replace(/ \(bilan incomplet\)$/, "");
    if (!etapes.includes(propre)) etapes.push(propre);
  }

  const navigateur = [...new Set([...suitesDesEcrans, ...rougesAvant.filter((r) => EST_E2E.test(r))])].sort();

  const toucheLeFond = bouge.some((f) =>
    /^(src\/(lib|server)\/|drizzle\/|scripts\/test-)/.test(String(f).replace(/\\/g, "/"))
  );
  const baseRouge = rougesAvant.some((r) => !EST_E2E.test(r));
  if (toucheLeFond || baseRouge) {
    for (const nom of ["Atelier", "Suites base de données"]) {
      if (!etapes.includes(nom)) etapes.push(nom);
    }
  }
  if (etapes.includes("Suites base de données") && navigateur.length && !etapes.includes("Données de démonstration")) {
    // `npm test` vide la base : sans réamorçage, les suites navigateur
    // accuseraient le produit d'un compte de démonstration disparu.
    etapes.push("Données de démonstration");
  }
  if (navigateur.length && !etapes.includes("Suites navigateur")) etapes.push("Suites navigateur");
  return { etapes, navigateur };
}

/**
 * Le verdict d'après : ce qui a été rejoué prend sa nouvelle valeur, ce qui ne
 * l'a pas été garde la sienne.
 *
 * **Un rouge dont on ne sait rien de neuf reste rouge** — ne pas savoir n'est
 * jamais vert (`.claude/rules/testing.md`).
 *
 * @param {{ horsSuitesAvant?: string[], etapesRejouees?: string[], tombees?: string[] }} p
 */
export function horsSuitesApres({ horsSuitesAvant = [], etapesRejouees = [], tombees = [] }) {
  const rejouees = new Set(etapesRejouees);
  const gardes = horsSuitesAvant.filter((n) => !rejouees.has(n.replace(/ \(bilan incomplet\)$/, "")));
  return [...new Set([...gardes, ...tombees])];
}
