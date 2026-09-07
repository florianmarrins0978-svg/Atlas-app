// **Quand `node_modules` ne correspond plus au verrou, la construction meurt
// sans un mot — et le banc ne sait pas se réparer.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **Sa panne du 29 août 2026 au soir.** Sa fiche publiait le relevé de l'échec,
// et il tient en cinq lignes :
//
//     code: 1
//     memoire: Mem: 7.8Gi  used 2.1Gi  available 5.7Gi
//     dit:
//     ▲ Next.js 16.3.3 (Turbopack)
//     - Environments: .env.local
//
// Deux choses s'y lisent, et la seconde a échappé à trois hypothèses :
//
//   1. **la mémoire n'y est pour rien** — 5,7 Go disponibles ;
//   2. **il exécute Next 16.3.3**, alors que `package.json` ET
//      `package-lock.json` épinglent **16.3.2**, tous deux à la version exacte,
//      sans accent circonflexe. Ses `node_modules` ne correspondent donc pas à
//      son verrou.
//
// Next.js embarque des binaires natifs (Turbopack, compilé en Rust) livrés dans
// des paquets `@next/swc-*` versionnés à l'identique. Un JavaScript de 16.3.3
// devant des binaires de 16.3.2 — ou l'inverse — meurt à l'instant où il charge
// le compilateur : **après l'en-tête, avant la moindre ligne de diagnostic.**
// C'est exactement ce que sa sortie montre.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Pourquoi son banc ne s'en sortait pas tout seul.**
//
// `banc.mjs` sait réinstaller les dépendances, mais à une seule condition :
//
//     /Cannot find module|MODULE_NOT_FOUND/i.test(sortie)
//
// Un paquet ABSENT le déclenche ; un paquet PRÉSENT MAIS DÉSACCORDÉ, non — il
// ne produit aucun message. La seule réparation possible était donc précisément
// celle que rien ne pouvait déclencher, et le veilleur retentait indéfiniment
// la même construction condamnée. Trois fois à dix minutes, puis toutes les
// demi-heures, sans fin.
//
// **C'est la troisième fois que ce dépôt paie une construction qui tombe pour
// une raison qu'aucun message ne dit** (22 août : `./detect-typo` ; 25 août :
// `@swc/helpers`). Les deux premières laissaient au moins une trace. Celle-ci
// n'en laisse aucune : elle se détecte donc AVANT de bâtir, en comparant deux
// nombres.

/**
 * La version exacte exigée pour un paquet, ou `null` si elle ne l'est pas.
 *
 * **Seules les versions ÉPINGLÉES sont comparables.** `^16.3.2` autorise
 * délibérément 16.3.3, et s'en plaindre ferait réinstaller à chaque démarrage
 * un espace parfaitement sain — un garde-fou qui parle à tort s'apprend à être
 * ignoré (`CLAUDE.md` §1 bis).
 *
 * @param {unknown} paquet Le contenu de `package.json`, déjà analysé.
 * @param {string} nom
 * @returns {string | null}
 */
export function versionEpinglee(paquet, nom) {
  if (typeof paquet !== "object" || paquet === null) return null;
  const deps = { ...(paquet.dependencies ?? {}), ...(paquet.devDependencies ?? {}) };
  const brut = deps[nom];
  if (typeof brut !== "string") return null;
  // Épinglée = trois nombres et rien d'autre. Tout le reste est un intervalle.
  return /^\d+\.\d+\.\d+$/.test(brut.trim()) ? brut.trim() : null;
}

/**
 * Faut-il réinstaller avant de bâtir ?
 *
 * @param {{ nom: string, exigee: string | null, installee: string | null }[]} paquets
 * @returns {{ incoherent: boolean, motif: string | null }} `motif` est écrit
 *   pour le patron : ce qui ne va pas, et ce que le banc va en faire. Pas de
 *   jargon — il lit ça sur un téléphone entre deux chantiers.
 */
export function dependancesIncoherentes(paquets) {
  const ecarts = [];
  for (const { nom, exigee, installee } of paquets) {
    // **On ne conclut que sur ce qu'on sait.** Un paquet que le projet
    // n'épingle pas ne se compare à rien : `^16.3.2` autorise délibérément
    // 16.3.3, et s'en plaindre ferait réinstaller un espace parfaitement sain.
    if (!exigee) continue;

    // **UN PAQUET ÉPINGLÉ ET ABSENT N'EST PAS UNE IGNORANCE — 31 août 2026.**
    //
    // Cette ligne rendait « pas d'incohérence » sur un `node_modules/next`
    // introuvable, au motif qu'on ne peut pas comparer ce qu'on ne lit pas.
    // C'était vrai et sans conséquence tant qu'un paquet absent se signalait
    // plus tard par « Cannot find module ». Sa panne de midi a montré l'autre
    // chemin : `npx next build` TÉLÉCHARGE la dernière version publiée et la
    // lance, si bien que le paquet manquant ne se plaint jamais — c'est un
    // Next étranger qui échoue, sur un message que rien ne reconnaissait.
    //
    // Le projet ÉPINGLE ce paquet : ne pas le trouver n'est pas une ignorance,
    // c'est le défaut lui-même. On réinstalle avant de bâtir.
    if (!installee) {
      ecarts.push(`${nom} ABSENT alors que le projet exige ${exigee}`);
      continue;
    }

    if (exigee !== installee) ecarts.push(`${nom} ${installee} au lieu de ${exigee}`);
  }

  if (ecarts.length === 0) return { incoherent: false, motif: null };

  return {
    incoherent: true,
    motif:
      `Les dépendances installées ne correspondent plus à celles du projet (${ecarts.join(", ")}). ` +
      "La construction échouerait sans rien dire. Réinstallation avant de bâtir.",
  };
}

/**
 * L'ARBRE DES DÉPENDANCES EST-IL COMPLET ? — on le DEMANDE, on ne le devine pas.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Trois fois le même piège, et la troisième a coûté une matinée.**
 *
 * `banc.mjs` savait se réparer quand une construction échouait faute d'un
 * paquet — mais à condition de RECONNAÎTRE la phrase :
 *
 *   | quand | ce que l'outil a dit | ce qu'on cherchait |
 *   |---|---|---|
 *   | 22 août 2026 | `Cannot find module` | rien : ajouté ce jour-là |
 *   | 31 août 2026 | `Could not find the Next.js package` | ne correspondait pas |
 *   | 3 septembre 2026 | `Module not found` (Turbopack) | ne correspondait toujours pas |
 *
 * À chaque fois, la même conséquence : le veilleur retentait indéfiniment une
 * construction condamnée, et le patron restait devant une application morte.
 * Sa fiche du 3 septembre le montre au mot près — `module-not-found`, sur
 * `@apm-js-collab/tracing-hooks`, un paquet que `npm ci` n'avait pas posé.
 *
 * **On cesse donc d'énumérer les formulations d'autrui.** La question n'a
 * jamais été « quel message a-t-il écrit », mais « le dossier des dépendances
 * est-il entier ». npm sait y répondre, en une seconde, et il NOMME ce qui
 * manque. Un fournisseur peut changer ses phrases à chaque version ; il ne
 * change pas la réponse à cette question-là.
 *
 * Le lanceur est injecté : c'est ce qui permet d'éprouver les deux réponses
 * sans casser l'arbre de la machine qui joue la suite.
 *
 * @param {(commande: string, args: string[]) => Promise<{ code: number, sortie: string }>} jouer
 *   Le lanceur du banc, injecté : `banc.mjs` en a déjà un, et deux façons de
 *   jouer une commande finiraient par diverger (`CLAUDE.md` §3).
 * @returns {Promise<{ incomplet: boolean, motif: string | null }>}
 */
export async function arbreIncomplet(jouer) {
  let resultat;
  try {
    resultat = await jouer("npm", ["ls", "--silent"]);
  } catch {
    // **Une mesure impossible n'est pas un échec** (`CLAUDE.md` §5) : si npm ne
    // peut pas répondre, on ne conclut PAS que l'arbre est cassé — on
    // réinstallerait à tort, et un remède qui parle à tort s'apprend à être
    // ignoré.
    return { incomplet: false, motif: null };
  }
  if (resultat.code === 0) return { incomplet: false, motif: null };

  // **« EXTRANEOUS » N'EST PAS « MANQUANT », et les confondre ferait
  // réinstaller à tort.** npm rend un code non nul dès qu'il a quoi que ce soit
  // à signaler, y compris des paquets EN TROP — ce qui arrive banalement après
  // un changement de branche, et n'empêche aucune construction. Un garde-fou
  // qui parle à tort s'apprend à être ignoré (`CLAUDE.md` §1 bis), et
  // celui-ci coûterait plusieurs minutes de réinstallation à chaque démarrage.
  //
  // On ne retient donc que ce qui MANQUE ou qui est cassé — la seule chose qui
  // condamne une construction.
  const details = String(resultat.sortie ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /UNMET DEPENDENCY|missing:|invalid:/i.test(l))
    .slice(0, 4);

  if (details.length === 0) return { incomplet: false, motif: null };

  return {
    incomplet: true,
    motif:
      "Le dossier des dépendances est incomplet — npm le dit" +
      (details.length ? ` : ${details.join(" ; ")}` : "") +
      ". La construction ne peut pas aboutir dans cet état.",
  };
}

/**
 * Une construction est-elle morte SANS RIEN DIRE ?
 *
 * Le second filet, pour ce que la comparaison de versions ne verra pas : un
 * binaire natif corrompu, un paquet à demi installé, un `node_modules` amputé.
 * Le symptôme est le même — la mort juste après l'en-tête — et il est
 * reconnaissable : un échec qui n'a produit presque aucune sortie.
 *
 * **Le seuil ne se devine pas.** Sa construction du 29 août a rendu deux
 * lignes : le logo de Next et la liste des fichiers d'environnement. Une vraie
 * erreur de compilation en écrit des dizaines — une trace d'appel seule en fait
 * déjà plus. On reste donc bas, pour ne jamais réinstaller devant une erreur
 * qui, elle, s'explique.
 *
 * @param {{ code: number, sortie: string }} resultat
 */
export function constructionMuette({ code, sortie }) {
  if (code === 0) return false;
  const lignes = String(sortie ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // Le logo, la ligne des environnements, et rien de plus.
  if (lignes.length > 4) return false;
  // Une sortie courte QUI PARLE d'une erreur n'est pas muette : elle a dit ce
  // qu'elle avait à dire, et réinstaller ne la réparera pas.
  return !lignes.some((l) => /error|erreur|failed|échec|cannot|invalid/i.test(l));
}
