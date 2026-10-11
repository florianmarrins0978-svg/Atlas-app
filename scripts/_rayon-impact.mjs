/**
 * LE RAYON D'IMPACT — combien de points d'entrée un fichier peut atteindre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa décision du 14 septembre 2026.** La règle d'avant lisait le CHEMIN :
 * tout ce qui vivait dans `src/` valait batterie complète. Elle se trompait
 * dans les deux sens — 339 fichiers sur 697 n'atteignent qu'un seul point
 * d'entrée, et à l'inverse `src/lib/civilite.ts` en atteint 64 sans figurer
 * sur aucune liste de « fichiers centraux ».
 *
 * **Ce qui remplace le chemin, c'est le graphe d'imports inversé.** Il se
 * calcule, il ne se déclare pas : une session ne peut donc pas s'accorder un
 * niveau plus bas que ce que son lot touche vraiment.
 *
 * **UN POINT D'ENTRÉE N'EST PAS UNE CATÉGORIE À ÉNUMÉRER.** C'est un fichier
 * que personne n'importe : le routeur Next, un cron ou un script l'appelle
 * depuis l'extérieur du code. Une liste d'« entrypoints » aurait pourri comme
 * la liste de fichiers centraux ; cette définition-ci accueille toute seule le
 * générateur PDF ou le cron ajouté demain.
 *
 * **CE QU'IL NE VOIT PAS, et qui remonte donc le niveau ailleurs**
 * (`_niveau-de-risque.mjs`, motif « indéterminable ») :
 *   · un `fetch("/api/…")` — aucun lien d'import, donc aucun rayon ;
 *   · un `import()` dynamique dont le chemin est une variable ;
 *   · ce qui n'est pas du `.ts`/`.tsx` — une feuille de style, une image.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const IGNORÉS = new Set(["node_modules", ".git", ".next", "dist", "coverage"]);

/**
 * Les fichiers de `src/`, lus SUR LE DISQUE et non dans l'index de git.
 *
 * Un fichier neuf pas encore enregistré est du code que le lot ajoute : ne pas
 * le voir le ferait passer pour « indéterminable », donc niveau 3, et le lot
 * le plus banal — une page neuve — serait le plus cher à livrer.
 */
function fichiersDeSrc(racine) {
  const trouvés = [];
  const parcourir = (dossier) => {
    let entrées;
    try {
      entrées = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrée of entrées) {
      if (IGNORÉS.has(entrée.name)) continue;
      const complet = path.join(dossier, entrée.name);
      if (entrée.isDirectory()) parcourir(complet);
      else if (/\.(ts|tsx)$/.test(entrée.name)) {
        trouvés.push(path.relative(racine, complet).split(path.sep).join("/"));
      }
    }
  };
  parcourir(path.join(racine, "src"));
  return trouvés;
}

/** Le chemin visé par un import, ou `null` s'il sort de `src/`. */
function résoudre(depuis, spec, existe) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(depuis), spec));
  else return null;
  for (const suffixe of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existe.has(base + suffixe)) return base + suffixe;
  }
  return null;
}

/**
 * Le graphe du dépôt, construit une fois et interrogé ensuite.
 *
 * Il coûte moins d'une seconde sur 697 fichiers, et il n'est construit que
 * lorsqu'une poussée vers `main` se présente : un déclencheur doit rendre la
 * main tout de suite (`CLAUDE.md` §1 bis).
 */
export function construireLeGraphe(racine) {
  const fichiers = fichiersDeSrc(racine);
  const existe = new Set(fichiers);
  const importéPar = new Map();
  // **Le sens DESCENDANT, et il manquait.** « Qui dépend de ce fichier »
  // décidait du rayon ; « de quoi ce fichier dépend » décide d'autre chose —
  // si ce que `main` vient d'apporter touche vraiment ce que le lot emploie
  // (sa règle du 17 septembre 2026, `_apres-fusion.mjs`).
  const importe = new Map();

  for (const f of fichiers) {
    let source;
    try {
      source = readFileSync(path.join(racine, f), "utf8");
    } catch {
      continue;
    }
    for (const m of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
      const cible = résoudre(f, m[1], existe);
      if (!cible) continue;
      if (!importéPar.has(cible)) importéPar.set(cible, new Set());
      importéPar.get(cible).add(f);
      if (!importe.has(f)) importe.set(f, new Set());
      importe.get(f).add(cible);
    }
  }

  const estPointDentrée = (f) => existe.has(f) && !importéPar.get(f)?.size;

  /** Tout ce qui, de proche en proche, finit par dépendre de ce fichier. */
  const cône = (départ) => {
    const vus = new Set([départ]);
    const pile = [départ];
    while (pile.length) {
      for (const parent of importéPar.get(pile.pop()) ?? []) {
        if (!vus.has(parent)) {
          vus.add(parent);
          pile.push(parent);
        }
      }
    }
    return vus;
  };

  /** Tout ce dont ce fichier dépend, de proche en proche — lui compris. */
  const socle = (départ) => {
    const vus = new Set([départ]);
    const pile = [départ];
    while (pile.length) {
      for (const cible of importe.get(pile.pop()) ?? []) {
        if (!vus.has(cible)) {
          vus.add(cible);
          pile.push(cible);
        }
      }
    }
    return vus;
  };

  return {
    connaît: (f) => existe.has(f),
    /**
     * CE QUE CES FICHIERS TOUCHENT OU EMPLOIENT, ET CE QUI LES EMPLOIE.
     *
     * Les deux sens, et c'est délibéré : un lot casse par ce qu'il emploie —
     * une règle qui change sous lui — comme par ce qui l'emploie — un appelant
     * dont la signature ne correspond plus. La rencontre a lieu aux deux bouts.
     */
    entourage: (fichiers) => {
      const tout = new Set();
      for (const f of fichiers) {
        if (!existe.has(f)) continue;
        for (const x of socle(f)) tout.add(x);
        for (const x of cône(f)) tout.add(x);
      }
      return tout;
    },
    estPointDentrée,
    /** Les points d'entrée qu'un fichier peut atteindre — lui compris s'il en est un. */
    pointsAtteints: (f) => (existe.has(f) ? [...cône(f)].filter(estPointDentrée) : []),
    /** Combien il en atteint. C'est LE nombre sur lequel le niveau se décide. */
    rayon: (f) => (existe.has(f) ? [...cône(f)].filter(estPointDentrée).length : 0),
  };
}

/**
 * L'adresse par laquelle le patron atteint un écran.
 *
 * Coupée au premier segment variable : `clients/[id]/page.tsx` rend
 * `/clients`, parce que c'est ce qu'une suite navigateur écrit dans son
 * `goto` — l'identifiant, lui, est fabriqué à l'exécution.
 */
export function routeDeLEcran(fichier) {
  if (!/^src\/app\/.*\/(page|layout)\.tsx$/.test(fichier) && fichier !== "src/app/page.tsx") return null;
  const segments = fichier
    .replace(/^src\/app/, "")
    .replace(/\/(page|layout)\.tsx$/, "")
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s)); // les groupes de routes ne s'affichent pas
  const variable = segments.findIndex((s) => s.startsWith("["));
  const gardés = variable === -1 ? segments : segments.slice(0, variable);
  return "/" + gardés.join("/");
}
