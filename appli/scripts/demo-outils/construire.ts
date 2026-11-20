/**
 * CONSTRUIRE LES DÉMONSTRATIONS DES OUTILS, à partir du code de l'appli.
 *
 *   npx tsx appli/scripts/demo-outils/construire.ts
 *
 * Écrit appli/vente/demo/<outil>.html, .js et .css. Chaque page fait tourner
 * les VRAIS écrans (src/app, src/components, src/lib) dans un navigateur, sans
 * serveur : le code est compilé tel quel, la feuille de style est celle de
 * l'appli (Tailwind compilé depuis src/app/globals.css, sur les classes que le
 * code emploie, comme le fait scripts/capture-plan-arrosage.ts), la charte est
 * « Origine », celle d'un compte neuf.
 *
 * **Ce qui est remplacé, et rien d'autre :**
 *   · chaque fichier qui commence par « use server » devient, export par
 *     export, ce que bouchons.ts lui donne (un refus en clair sinon) ;
 *   · next/link, next/image et next/navigation deviennent next.tsx.
 * Un module du serveur qu'un écran importerait pour de vrai (une base, une
 * clé) ferait échouer la construction : c'est voulu, la démonstration ne doit
 * rien embarquer de cela.
 *
 * À relancer quand l'écran change dans l'appli, sans quoi le site montrerait
 * une version d'avant.
 */
import { build, type Plugin } from "esbuild";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CHARTES, CHARTE_PAR_DEFAUT, variablesCharte } from "../../../src/lib/chartes";

// En .ts (CommonJS sous tsx), comme scripts/capture-plan-arrosage.ts : le
// calcul d'arrosage est un module CommonJS.
const ICI = __dirname;
const RACINE = join(ICI, "../../..");
const SORTIE = join(RACINE, "appli/vente/demo");

const OUTILS: { nom: string; titre: string }[] = [{ nom: "arrosage", titre: "Plan d’arrosage" }];

/**
 * Les photos des pièces, que l'appli sert depuis public/ à la racine de son
 * domaine. Le site est publié sous /Atlas-app/ : on vise les mêmes photos,
 * déjà publiées dans appli/ (mêmes fichiers que public/).
 */
const PHOTOS: [string, string][] = [
  ['"/arrosage-photos/', '"../../arrosage-photos/'],
  ["`/arrosage-photos/", "`../../arrosage-photos/"],
  ['"/arrosage-robinet-photos/', '"../../arrosage-robinet-photos/'],
  // src/lib/arrosage/photos.ts : un fichier rangé dans un sous-dossier.
  ["`/${fichier}`", "`../../${fichier}`"],
];


const remplacer: Plugin = {
  name: "demonstration",
  setup(b) {
    const next = join(ICI, "next.tsx");
    const virtuels: Record<string, string> = {
      "next/link": `export { default } from ${JSON.stringify(next)};`,
      "next/image": `export { Image as default } from ${JSON.stringify(next)};`,
      "next/navigation": `export * from ${JSON.stringify(next)};`,
    };
    b.onResolve({ filter: /^next\/(link|image|navigation)$/ }, (a) => ({ path: a.path, namespace: "next-demo" }));
    b.onLoad({ filter: /.*/, namespace: "next-demo" }, (a) => ({ contents: virtuels[a.path], loader: "tsx", resolveDir: ICI }));

    b.onLoad({ filter: /[\\/]src[\\/].*\.tsx?$/ }, (a) => {
      const texte = readFileSync(a.path, "utf8");
      if (!/^\s*["']use server["']/.test(texte)) {
        if (!PHOTOS.some(([de]) => texte.includes(de))) return undefined;
        let contents = texte;
        for (const [de, vers] of PHOTOS) contents = contents.split(de).join(vers);
        return { contents, loader: a.path.endsWith("x") ? "tsx" : "ts" };
      }
      const fichier = relative(RACINE, a.path).replace(/\\/g, "/");
      const noms = Array.from(texte.matchAll(/export\s+async\s+function\s+(\w+)/g), (m) => m[1]);
      const contents =
        `import { bouchon } from ${JSON.stringify(join(ICI, "bouchons.ts"))};\n` +
        noms.map((n) => `export const ${n} = bouchon(${JSON.stringify(fichier)}, ${JSON.stringify(n)});`).join("\n");
      return { contents, loader: "ts", resolveDir: ICI };
    });
  },
};

/**
 * Tailwind compilé depuis la feuille de l'appli, sur les classes que src/
 * emploie, lues par le même lecteur que la construction de l'appli
 * (@tailwindcss/oxide). Une première version les cherchait dans le code
 * compilé : les classes posées dans un gabarit `${...}` lui échappaient, et
 * la barre d'onglets se dessinait en haut de l'écran, sans ses styles.
 */
async function feuilleDeStyle(): Promise<string> {
  const source = readFileSync(join(RACINE, "src/app/globals.css"), "utf8");
  const compilateur = await compile(source, { base: join(RACINE, "src/app"), onDependency: () => undefined });
  const candidats = new Scanner({ sources: [{ base: join(RACINE, "src"), pattern: "**/*", negated: false }] }).scan();
  return compilateur.build(candidats);
}


const charte = CHARTES.find((c) => c.nom === CHARTE_PAR_DEFAUT) ?? CHARTES[0];
const variables = Object.entries(variablesCharte(charte)).map(([k, v]) => `${k}: ${v}`).join("; ");

async function construire() {
 mkdirSync(SORTIE, { recursive: true });
 const css = await feuilleDeStyle();
 for (const outil of OUTILS) {
  const r = await build({
    entryPoints: [join(ICI, `${outil.nom}.tsx`)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2020", "safari15"],
    minify: true,
    jsx: "automatic",
    tsconfig: join(RACINE, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [remplacer],
    logLevel: "warning",
  });
  const code = r.outputFiles[0].text;
  writeFileSync(join(SORTIE, `${outil.nom}.js`), code);
  writeFileSync(join(SORTIE, `${outil.nom}.css`), css);
  writeFileSync(
    join(SORTIE, `${outil.nom}.html`),
    `<!doctype html>
<html lang="fr" translate="no" style="${variables}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${outil.titre}, démonstration de Cause</title>
<link rel="stylesheet" href="${outil.nom}.css">
</head>
<body class="font-body antialiased">
<!-- Construit par appli/scripts/demo-outils/construire.ts : ne pas retoucher à la main. -->
<div id="racine"></div>
<script src="${outil.nom}.js"></script>
</body>
</html>
`
  );
  console.log(`✓ ${outil.nom} : ${(code.length / 1024).toFixed(0)} Ko de code`);
}
}

construire().catch((e) => {
  console.error(e);
  process.exit(1);
});
