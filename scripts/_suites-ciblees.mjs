/**
 * QUELLES SUITES NAVIGATEUR ÉPROUVENT CES ÉCRANS-LÀ ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce qui rend le niveau 2 acceptable sur du produit — 14 septembre 2026.**
 * Types et lint ne parcourent rien : c'est exactement ce qui a laissé passer
 * « Invalid Server Actions request. », vingt allers-retours avec les voyants
 * au vert. Un lot qui touche un écran doit donc voir CET écran s'ouvrir dans
 * un vrai navigateur — pas les cent cinquante et un autres.
 *
 * **La correspondance se DÉRIVE, elle ne s'écrit pas.** Les suites citent leur
 * adresse en clair (`goto("/clients/…")`) : on la cherche chez elles. Une
 * table tenue à la main aurait vieilli au premier écran renommé, et son oubli
 * aurait été muet.
 *
 * **Et un écran que personne n'éprouve remonte le lot en niveau 3** : il n'y a
 * alors rien à jouer qui le regarde, et une mesure impossible n'est jamais un
 * vert (`CLAUDE.md` §5).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Les suites navigateur du dépôt, avec leur texte — lu une fois. */
function suitesDuDepot(racine) {
  const dossier = path.join(racine, "scripts");
  let noms;
  try {
    noms = readdirSync(dossier).filter((n) => /^test-.*-e2e\.(ts|mts)$/.test(n));
  } catch {
    return [];
  }
  return noms.map((nom) => {
    let texte = "";
    try {
      texte = readFileSync(path.join(dossier, nom), "utf8");
    } catch {
      /* une suite illisible ne couvre rien : elle ne compte pas. */
    }
    return { motif: nom.replace(/^test-/, "").replace(/-e2e\.(ts|mts)$/, ""), texte };
  });
}

/** Les suites qui ouvrent cette adresse — par ce qu'elles écrivent, pas par une table. */
export function suitesDeLaRoute(racine, route, suites = suitesDuDepot(racine)) {
  return suites.filter((s) => s.texte.includes(`"${route}`) || s.texte.includes(`'${route}`)).map((s) => s.motif);
}

/** Les motifs à passer à `test:e2e -- --seulement`, pour un lot entier. */
export function suitesDesRoutes(racine, routes) {
  const suites = suitesDuDepot(racine);
  const retenues = new Set();
  for (const route of routes) for (const m of suitesDeLaRoute(racine, route, suites)) retenues.add(m);
  return [...retenues].sort();
}

/** Les écrans du lot que RIEN n'ouvre — ceux qui interdisent un niveau 2. */
export function routesSansSuite(racine, routes) {
  const suites = suitesDuDepot(racine);
  return routes.filter((route) => suitesDeLaRoute(racine, route, suites).length === 0);
}
