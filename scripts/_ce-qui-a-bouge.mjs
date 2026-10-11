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
  return [...new Set([...parLeContenu, ...dehors])].sort();
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
 * **`graviteVenueDeMain`** force les suites du fond : quand `main` apporte du
 * code d'argent ou de sécurité, ce n'est pas la batterie entière qu'il faut
 * (il l'a déjà jouée), c'est `npm test` — là où vivent les règles métier,
 * l'isolation et la RLS (`ARCHITECTURE.md` §382).
 *
 * **`plancherVenuDeMain`** — le gabarit racine, une migration, la
 * configuration : ce que `main` apporte et qui change le SOL. Il ne fait pas
 * repartir la batterie (`main` l'a déjà prouvé contre toute l'application) ; il
 * fait remesurer **le lot sur ce nouveau sol** — ses écrans, ses règles, la
 * construction, la connexion (`ARCHITECTURE.md` §387).
 *
 * @param {{ bouge: string[], rougesAvant?: string[], horsSuitesAvant?: string[], suitesDesEcrans?: string[], graviteVenueDeMain?: boolean, plancherVenuDeMain?: string[], routesDuLot?: string[] }} p
 * @returns {{ etapes: string[], navigateur: string[] }}
 */
export function aRejouer({
  bouge,
  rougesAvant = [],
  horsSuitesAvant = [],
  suitesDesEcrans = [],
  graviteVenueDeMain = false,
  plancherVenuDeMain = [],
  routesDuLot = [],
}) {
  // Une minute, et c'est là qu'une correction se dénonce d'abord.
  const etapes = ["Types", "Lint"];
  for (const nom of horsSuitesAvant) {
    const propre = nom.replace(/ \(bilan incomplet\)$/, "");
    if (!etapes.includes(propre)) etapes.push(propre);
  }

  // **Le sol a changé : les écrans DU LOT se rejouent dessus.** Ils ne sont pas
  // forcément dans la rencontre — un gabarit racine n'a pas d'arête d'import
  // vers eux —, et c'est précisément pour cela qu'ils s'ajoutent ici.
  const surLeNouveauSol = plancherVenuDeMain.length > 0 ? routesDuLot : [];
  const navigateur = [
    ...new Set([...suitesDesEcrans, ...surLeNouveauSol, ...rougesAvant.filter((r) => EST_E2E.test(r))]),
  ].sort();

  const toucheLeFond = bouge.some((f) =>
    /^(src\/(lib|server)\/|drizzle\/|scripts\/test-)/.test(String(f).replace(/\\/g, "/"))
  );
  const baseRouge = rougesAvant.some((r) => !EST_E2E.test(r));
  // Une migration ou l'accès à la base changent les DONNÉES sous les règles.
  const solDeLaBase = plancherVenuDeMain.some((f) => /^(drizzle\/|src\/server\/db\/)/.test(String(f).replace(/\\/g, "/")));
  if (toucheLeFond || baseRouge || graviteVenueDeMain || solDeLaBase) {
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

  if (plancherVenuDeMain.length > 0) {
    // Seule la construction voit une erreur qui n'existe qu'à la construction
    // (`CLAUDE.md` §5, le mode lent du 16 août) : un réglage de bâti venu de
    // `main` la remet en jeu, et elle coûte deux minutes.
    const solDuBati = plancherVenuDeMain.some((f) =>
      /^(package(-lock)?\.json|next\.config\.|tsconfig|drizzle\.config\.)/.test(String(f).replace(/\\/g, "/"))
    );
    if (solDuBati && !etapes.includes("Construction")) etapes.splice(2, 0, "Construction");
    // **La connexion derrière un proxy, toujours** : c'est le défaut qui a coûté
    // vingt allers-retours au patron, il ne se voit nulle part ailleurs, et il
    // coûte une minute. Un middleware ou un gabarit venus de `main` le remettent
    // en jeu.
    if (!etapes.includes("Connexion derrière un proxy")) etapes.push("Connexion derrière un proxy");
  }
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

/**
 * CE QUE LA RENCONTRE DOIT À CHACUN — et ce n'est pas la même dette.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa capture du 18 septembre 2026, à 00 h 27 :** *« ça continue »*. Une
 * session : *« main a apporté 30 commits, dont du code qui touche l'argent
 * (devis, acomptes). La rencontre atteint le niveau 3 → batterie entière. »*
 *
 * **C'était une erreur de catégorie, et elle est à moi.** `evaluerLeLot`
 * répond à UNE question : *quel risque ce lot INTRODUIT-il ?* Appliquée aux
 * fichiers que `main` apporte, elle répond à une question à laquelle `main` a
 * déjà répondu — chacun de ces commits est passé par son propre garde-fou, au
 * niveau que sa gravité exigeait. Redemander la batterie ici, c'est faire
 * repayer à un lot la mesure d'un autre.
 *
 * **Ce qui n'a jamais été mesuré, c'est la rencontre**, et elle se rejoue par
 * des suites : celles du fond (`npm test` — les règles métier, l'isolation, la
 * RLS) et celles des écrans atteints.
 *
 * **CE QUI GARDE SON POUVOIR, et c'est le seul cas :** le PLANCHER. Une
 * migration change les DONNÉES sous toutes les suites, un gabarit racine porte
 * tous les écrans, l'accès à la base porte toutes les requêtes. Ceux-là ne se
 * mesurent pas par une suite ciblée — c'est déjà ce que le dépôt écrit depuis
 * le 17 septembre : *« une migration arrivée de main sous un lot qui touche la
 * base »* vaut la batterie entière.
 *
 * **Et la gravité de `main` n'est pas ignorée pour autant** : elle force les
 * suites du fond, là où vivent les règles d'argent et l'isolation. Elle change
 * ce qu'on rejoue, pas si l'on rejoue tout.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @param {{ fichiers: string[], fichiersDuLot: string[] }} p
 * @returns {{ duLot: string[], venuDeMain: string[] }}
 */
export function partagerLaRencontre({ fichiers, fichiersDuLot }) {
  const duLot = new Set(fichiersDuLot.map((f) => String(f).replace(/\\/g, "/")));
  const propres = fichiers.map((f) => String(f).replace(/\\/g, "/"));
  return {
    duLot: propres.filter((f) => duLot.has(f)),
    venuDeMain: propres.filter((f) => !duLot.has(f)),
  };
}

/**
 * LA BATTERIE ENTIÈRE EST-ELLE DUE ? — deux causes, et deux seulement.
 *
 * @param {{ niveauDuLot: number }} p
 * @returns {string | null} la raison, ou `null` si le rattrapage suffit
 */
export function batterieDue({ niveauDuLot }) {
  // **LA BATTERIE ENTIÈRE PROUVE UN LOT, JAMAIS UNE RENCONTRE** — 18 septembre
  // 2026. Ce que `main` apporte a déjà été prouvé par `main` contre toute
  // l'application, plancher compris ; ce qui n'a jamais été mesuré, c'est le
  // LOT sur ce nouveau sol, et cela se rejoue (`aRejouer`). Il ne reste donc
  // qu'une cause, et c'est celle du §5 : le risque propre du lot.
  return niveauDuLot >= 3 ? "ce que le lot a changé atteint le niveau 3" : null;
}
