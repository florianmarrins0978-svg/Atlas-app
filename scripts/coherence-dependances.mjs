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
    // **On ne conclut que sur ce qu'on sait.** Une version illisible — paquet
    // absent, `package.json` inattendu — n'est pas une incohérence : c'est une
    // ignorance, et réinstaller « au cas où » ferait perdre des minutes à
    // chaque démarrage.
    if (!exigee || !installee) continue;
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
