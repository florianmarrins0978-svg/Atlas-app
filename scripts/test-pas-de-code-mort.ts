/* =======================================================================
   PAS DE CODE MORT — ce qui ne sert plus se supprime.

   **Sa règle du 8 septembre 2026 :** *« je ne veux pas de code mort, si
   ça ne sert plus on le supprime proprement. »*

   **Pourquoi ce n'est pas du rangement.** Un fichier que plus rien
   n'importe continue d'être lu : par la session qui cherche d'où vient
   un défaut, par le développeur qu'il paiera un jour pour reprendre
   l'application. Les deux perdent le même temps — et pire, ils peuvent
   corriger LÀ, dans le fichier mort, et croire avoir réparé. Le 8
   septembre, six fichiers étaient dans ce cas, dont un qui écrivait
   lui-même « dessinée, jamais importée ».

   **Ce qu'il mesure :** un fichier de `src/` que rien n'importe, nulle
   part — ni l'application, ni les scripts, ni les suites. Les entrées du
   cadre Next (`page`, `layout`, `route`…) n'ont pas d'import : c'est le
   framework qui les appelle, et elles sont exclues nommément.

   **Ce qu'il ne sait pas voir, et il faut le dire :** une fonction morte
   à l'intérieur d'un fichier vivant, une branche de code jamais prise.
   Celles-là restent au jugement — le lint attrape les variables non
   employées, le reste se voit en lisant.

   **La liste des exceptions est VIDE, et doit le rester.** Elle n'existe
   que pour être regardée : une exception qui s'ajoute est une dette qui
   commence.
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..");

/** Les entrées que le cadre Next appelle lui-même : jamais importées. */
const ENTREES_DU_CADRE =
  /^src[/\\](app[/\\].*[/\\]?(page|layout|route|loading|error|global-error|not-found|template|default|icon|apple-icon|opengraph-image|sitemap|robots)\.(ts|tsx)|middleware\.ts|instrumentation\.ts|auth\.ts)$/;

/**
 * Ce qui vit hors de `src/` et peut pourtant tenir un fichier en vie :
 * une commande npm (`db:seed`), un flux CI. On les lit plutôt que de
 * les supposer.
 */
const AILLEURS = ["package.json", ".github/workflows/ci.yml", ".github/workflows/pages.yml"];

/** Aucune. Et c'est le but. */
const TOLERES: { fichier: string; pourquoi: string }[] = [];

function fichiersDe(dossier: string, filtre: RegExp): string[] {
  const sortie: string[] = [];
  const marcher = (d: string) => {
    for (const entree of readdirSync(d)) {
      const complet = path.join(d, entree);
      if (statSync(complet).isDirectory()) marcher(complet);
      else if (filtre.test(complet)) sortie.push(path.relative(RACINE, complet));
    }
  };
  marcher(path.join(RACINE, dossier));
  return sortie;
}

/**
 * Le cœur, isolé pour être ÉPROUVÉ sans dépôt : sans lui, un jour où
 * tout est propre, cette suite rendrait un vert qui n'aurait rien
 * mesuré (`CLAUDE.md` §5).
 */
export function orphelins(
  fichiers: string[],
  contenus: Map<string, string>,
  entree: RegExp = ENTREES_DU_CADRE
): string[] {
  // **On RÉSOUT les imports au lieu de chercher un nom dans un texte.**
  // La première version comparait des bouts de chemin : elle a accusé 155
  // fichiers bien vivants, tous importés par « ./actions » ou « ./Client ».
  // Un contrôle qui accuse à tort ne se corrige pas, il s'éteint — et l'on
  // aurait perdu la règle le jour même où elle a été posée.
  const vivants = new Set<string>();
  const SPECIFICATEURS = /(?:from|import|require)\s*\(?\s*["'`]([^"'`]+)["'`]/g;

  const candidats = (base: string) => [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    base,
  ];

  for (const [source, contenu] of contenus) {
    for (const trouve of contenu.matchAll(SPECIFICATEURS)) {
      const cible = trouve[1];
      let base: string | null = null;
      if (cible.startsWith("@/")) base = path.posix.join("src", cible.slice(2));
      else if (cible.startsWith(".")) base = path.posix.join(path.posix.dirname(source.split(path.sep).join("/")), cible);
      if (!base) continue;
      for (const c of candidats(base.replace(/\.(js|jsx)$/, ""))) vivants.add(c);
    }
    // Une commande npm ou un flux CI nomme un fichier par son CHEMIN, pas par
    // un import : `tsx src/server/db/seed.ts`. Sans cela, la graine de la base
    // passerait pour morte.
    for (const chemin of contenu.matchAll(/src\/[A-Za-z0-9_./\-]+\.(?:ts|tsx)/g)) vivants.add(chemin[0]);
  }

  const morts: string[] = [];
  for (const fichier of fichiers) {
    const normalise = fichier.split(path.sep).join("/");
    if (entree.test(fichier)) continue;
    if (normalise.endsWith(".d.ts")) continue;
    if (TOLERES.some((t) => t.fichier === normalise)) continue;
    if (!vivants.has(normalise)) morts.push(normalise);
  }
  return morts;
}

console.log("=== Pas de code mort ===\n");

// ── 1. Le détecteur sait reconnaître un orphelin, et ne pas accuser à tort ──
const FAUX = new Map<string, string>([
  ["src/lib/vivant.ts", "export const a = 1;"],
  ["src/lib/mort.ts", "export const b = 2;"],
  ["src/app/ecran/page.tsx", 'import { a } from "@/lib/vivant";'],
]);
const trouvesFaux = orphelins([...FAUX.keys()], FAUX);
assert.deepEqual(trouvesFaux, ["src/lib/mort.ts"], `attendu mort.ts seul, obtenu ${trouvesFaux.join(", ")}`);
console.log("  ok    un fichier que rien n'importe est vu, un fichier importé ne l'est pas");

const AVEC_ENTREE = new Map<string, string>([["src/app/ecran/page.tsx", "export default function E() {}"]]);
assert.deepEqual(
  orphelins([...AVEC_ENTREE.keys()], AVEC_ENTREE),
  [],
  "une page du cadre Next n'est jamais importée : l'accuser rendrait le contrôle inutilisable"
);
console.log("  ok    les entrées du cadre Next ne sont pas accusées");

// ── 2. Le dépôt lui-même ────────────────────────────────────────────────
const fichiers = fichiersDe("src", /\.(ts|tsx)$/);
const contenus = new Map<string, string>();
for (const f of [...fichiers, ...fichiersDe("scripts", /\.(ts|tsx|mts|mjs)$/), ...AILLEURS]) {
  try {
    contenus.set(f, readFileSync(path.join(RACINE, f), "utf8"));
  } catch {
    // Un flux CI absent d'une fourche ne doit pas faire échouer la mesure ;
    // il n'est là que pour ÉVITER une fausse accusation, jamais pour en
    // porter une.
  }
}
console.log(`\n  ${fichiers.length} fichiers sous src/, ${contenus.size} textes lus pour y chercher leurs imports.`);
assert.ok(fichiers.length > 100, "trop peu de fichiers lus : la mesure n'a pas eu lieu");

const morts = orphelins(fichiers, contenus);
if (morts.length > 0) {
  console.error("\n❌ Fichier(s) que plus rien n'importe :\n");
  for (const m of morts) console.error(`   ${m}`);
  console.error("\n   S'ils ne servent plus, les SUPPRIMER (CLAUDE.md §4 quinquies) —");
  console.error("   l'historique git les garde. S'ils servent par un chemin que ce");
  console.error("   contrôle ne voit pas, l'écrire dans TOLERES avec la raison.");
  process.exit(1);
}

console.log("\n✅ Aucun fichier mort sous src/.");
