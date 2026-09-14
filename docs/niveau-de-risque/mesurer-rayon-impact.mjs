/* =========================================================================
   CE QUI PRODUIT LES CHIFFRES DE CE DOSSIER — rien d'autre.

   Pourquoi il vit ici, dans `docs/`, et non dans `scripts/` : il n'éprouve
   rien et la batterie ne l'appelle pas. Il existe pour qu'un chiffre cité
   dans une planche puisse être REJOUÉ plutôt que cru sur parole. Le jour où
   le garde-fou calculera ce rayon pour de bon, ce calcul vivra dans
   `scripts/` — et celui-ci disparaîtra, sans quoi deux façons de mesurer la
   même chose finiraient par se contredire (`CLAUDE.md` §3).

   Ce qu'il ne voit PAS, et qu'aucun chiffre d'ici ne doit laisser croire :
     · un `fetch("/api/…")` — aucun lien d'import, donc aucun rayon ;
     · un `import()` dynamique dont le chemin est une variable ;
     · ce qui n'est importé que depuis `scripts/` — seul `src/` est parcouru,
       donc un fichier appelé de là paraît n'être importé par personne.

     node docs/niveau-de-risque/mesurer-rayon-impact.mjs
   ========================================================================= */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const fichiers = execSync("git ls-files src", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((f) => /\.(ts|tsx)$/.test(f));
const existe = new Set(fichiers);

/** Le chemin visé par un import, ou `null` s'il sort de `src/`. */
function resoudre(depuis, spec) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(depuis), spec));
  else return null;
  for (const suffixe of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existe.has(base + suffixe)) return base + suffixe;
  }
  return null;
}

const inverse = new Map(); // un fichier → ceux qui l'importent
const direct = new Map(); //  un fichier → ce qu'il importe
for (const f of fichiers) {
  direct.set(f, new Set());
  for (const m of readFileSync(f, "utf8").matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const cible = resoudre(f, m[1]);
    if (!cible) continue;
    direct.get(f).add(cible);
    if (!inverse.has(cible)) inverse.set(cible, new Set());
    inverse.get(cible).add(f);
  }
}

/**
 * Une RACINE est un fichier que personne n'importe : le routeur Next, un cron
 * ou un script l'appelle depuis l'extérieur du code. C'est la surface de
 * l'application — et c'est une propriété du graphe, jamais une liste à tenir.
 */
const estRacine = (f) => !inverse.get(f)?.size;
const racines = fichiers.filter(estRacine);

/** Tout ce qui, de proche en proche, finit par dépendre de ce fichier. */
function cone(depart) {
  const vus = new Set([depart]);
  const pile = [depart];
  while (pile.length) {
    const courant = pile.pop();
    for (const parent of inverse.get(courant) ?? []) {
      if (!vus.has(parent)) {
        vus.add(parent);
        pile.push(parent);
      }
    }
  }
  return vus;
}

/** Le RAYON : combien de racines ce fichier peut atteindre. */
export const rayon = (f) => [...cone(f)].filter(estRacine).length;

if (process.argv[1]?.endsWith("mesurer-rayon-impact.mjs")) {
  console.log(`fichiers de src/ : ${fichiers.length} · racines : ${racines.length}`);

  const familles = {};
  for (const r of racines) {
    let famille;
    if (/\/(page|layout|not-found|error|loading|template)\.tsx?$/.test(r)) famille = "écran (page, gabarit)";
    else if (/\/route\.tsx?$/.test(r)) famille = "route API";
    else if (/^src\/server\//.test(r)) famille = "entrée serveur (cron, amorçage…)";
    else if (/^src\/lib\//.test(r)) famille = "lib que personne n'importe";
    else famille = "autre (middleware, types)";
    (familles[famille] ??= []).push(r);
  }
  console.log("\n— De quoi la surface est faite —");
  for (const [famille, liste] of Object.entries(familles).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(liste.length).padStart(3)}  ${famille}`);
    if (liste.length <= 6) for (const f of liste) console.log(`         ${f}`);
  }

  console.log("\n— Répartition du rayon —");
  const tous = fichiers.map((f) => ({ f, n: rayon(f) }));
  for (const [bas, haut] of [[1, 2], [2, 3], [3, 5], [5, 10], [10, 20], [20, Infinity]]) {
    const compte = tous.filter((s) => s.n >= bas && s.n < haut).length;
    console.log(`  ${bas}${haut === Infinity ? "+" : "–" + (haut - 1)} racines : ${compte} fichiers`);
  }

  console.log("\n— Les plus étendus —");
  for (const s of tous.sort((a, b) => b.n - a.n).slice(0, 8)) console.log(`  ${String(s.n).padStart(3)}  ${s.f}`);

  const vise = process.argv.slice(2);
  for (const cible of vise) {
    if (!existe.has(cible)) {
      console.log(`\n(absent de src/) ${cible}`);
      continue;
    }
    console.log(`\n— ${cible} : rayon ${rayon(cible)} —`);
    for (const d of direct.get(cible) ?? []) console.log(`  importe → ${d}  (rayon ${rayon(d)})`);
  }
}
