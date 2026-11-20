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
 *     export, ce que bouchons/<outil>.ts lui donne (un refus en clair
 *     sinon) ; les modules de src/server/ de même, sauf SERVEUR_GARDE ;
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
import { validerLot } from "../../../src/lib/import-fiches-phyto";

// En .ts (CommonJS sous tsx), comme scripts/capture-plan-arrosage.ts : le
// calcul d'arrosage est un module CommonJS.
const ICI = __dirname;
const RACINE = join(ICI, "../../..");
const SORTIE = join(RACINE, "appli/vente/demo");

const OUTILS: { nom: string; titre: string }[] = [
  { nom: "arrosage", titre: "Plan d’arrosage" },
  { nom: "diagnostic", titre: "Diagnostic végétal" },
  { nom: "fiches", titre: "Fiche de chantier" },
];

/**
 * Les modules du serveur que la démonstration fait tourner POUR DE VRAI :
 * ceux qui ne touchent ni base ni clé, et dont l'écran a besoin pour être
 * le même. Le résultat d'un diagnostic se compose avec la fonction même du
 * moteur, qui lit sa fiche par un dépôt, lui remplacé.
 */
const SERVEUR_GARDE = new Set(["src/server/diagnostic/moteur.ts"]);

/**
 * Hors du serveur, ce qui ferait quitter la démonstration : ouvrir la
 * messagerie de l'artisan (sms:, mailto:). Remplacé comme un module du
 * serveur ; la fiche dit alors, à côté du téléphone, ce qui s'ouvrirait.
 */
const AUSSI_REMPLACES = new Set(["src/lib/ouvrir-messagerie.ts"]);

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
  // Les photos de référence d'une fiche, servies par une route de l'appli :
  // ici, l'identifiant de l'image EST son chemin (bouchons/diagnostic.ts).
  ["`/api/phyto/image/${image.id}`", "image.id"],
];


const remplacer = (outil: string): Plugin => ({
  name: "demonstration",
  setup(b) {
    const next = join(ICI, "next.tsx");
    const virtuels: Record<string, string> = {
      "next/link": `export { default } from ${JSON.stringify(next)};`,
      "next/image": `export { Image as default } from ${JSON.stringify(next)};`,
      "next/navigation": `export * from ${JSON.stringify(next)};`,
      "next/headers": `export async function headers() { return new Headers(); }`,
    };
    b.onResolve({ filter: /^next\/(link|image|navigation|headers)$/ }, (a) => ({ path: a.path, namespace: "next-demo" }));
    b.onLoad({ filter: /.*/, namespace: "next-demo" }, (a) => ({ contents: virtuels[a.path], loader: "tsx", resolveDir: ICI }));

    // **Une fiche de la bibliothèque, lue ICI par la fonction de l'import
    // (`validerLot`), et la page ne reçoit que le résultat.** Une fiche que
    // l'import refuserait fait échouer la construction, au lieu d'une page
    // qui casse chez le visiteur ; et l'outil d'import (ses messages, zod)
    // n'entre pas dans la page. Ses notes de rédaction (les clés « _… »)
    // n'y entrent pas non plus. Trois de ses textes affichés coupent leur
    // phrase d'un tiret (« INRAE — Ephytia ») que sa règle du 22 septembre
    // 2026 refuse à l'écran : le garde-fou de main l'a vu le 20 novembre. Sur
    // le site, le tiret devient une virgule. La donnée de donnees/phyto/,
    // elle, n'est pas touchée : TODO.md.
    b.onLoad({ filter: /[\\/]donnees[\\/]phyto[\\/]fiches[\\/].*\.json$/ }, (a) => {
      const nettoyer = (v: unknown): unknown => {
        if (typeof v === "string") return v.replace(/\s+[—–]\s+/g, ", ");
        if (Array.isArray(v)) return v.map(nettoyer);
        if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("_")).map(([k, x]) => [k, nettoyer(x)]));
        return v;
      };
      const verdict = validerLot(JSON.parse(readFileSync(a.path, "utf8")), { autoriserFixtures: false, codesConnus: new Set<string>() });
      if (!verdict.ok) throw new Error(`${relative(RACINE, a.path)} ne passe plus l’import : ${JSON.stringify(verdict.problemes)}`);
      return { contents: JSON.stringify(nettoyer(verdict.lot)), loader: "json" };
    });

    b.onLoad({ filter: /[\\/]src[\\/].*\.tsx?$/ }, (a) => {
      const texte = readFileSync(a.path, "utf8");
      const fichier = relative(RACINE, a.path).replace(/\\/g, "/");
      const action = /^\s*["']use server["']/.test(texte);
      const serveur = (fichier.startsWith("src/server/") && !SERVEUR_GARDE.has(fichier)) || AUSSI_REMPLACES.has(fichier);
      if (!action && !serveur) {
        if (!PHOTOS.some(([de]) => texte.includes(de))) return undefined;
        let contents = texte;
        for (const [de, vers] of PHOTOS) contents = contents.split(de).join(vers);
        return { contents, loader: a.path.endsWith("x") ? "tsx" : "ts" };
      }
      // Une action, ou un module du serveur (une base, une clé, un journal) :
      // chaque export devient ce que bouchons/<outil>.ts lui donne. Les types
      // s'effacent d'eux-mêmes à la compilation.
      const fonctions = Array.from(texte.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g), (m) => m[1]);
      const constantes = Array.from(texte.matchAll(/export\s+const\s+(\w+)/g), (m) => m[1]);
      // **Résolus à l'appel, jamais au chargement** : un bouchon peut se
      // servir d'un module de l'appli (le moteur du diagnostic) qui importe
      // lui-même des modules remplacés. Lus au chargement, ils trouvaient
      // le fichier des bouchons pas encore exécuté (« bouchon is not a
      // function »).
      const f = JSON.stringify(fichier);
      const contents =
        `import { bouchon, constante } from ${JSON.stringify(join(ICI, "bouchons", `${outil}.ts`))};\n` +
        fonctions.map((n) => `export const ${n} = (...a) => bouchon(${f}, ${JSON.stringify(n)}, ${action})(...a);`).join("\n") + "\n" +
        constantes
          .map((n) => {
            const v = `constante(${f}, ${JSON.stringify(n)})`;
            return `export const ${n} = new Proxy(function () {}, { get: (_c, k) => Reflect.get(Object(${v}), k), apply: (_c, t, a) => Reflect.apply(${v}, t, a) });`;
          })
          .join("\n");
      return { contents, loader: "ts", resolveDir: ICI };
    });
  },
});

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
    // DEMO_LISIBLE=1 : le code non réduit, pour lire une erreur.
    minify: !process.env.DEMO_LISIBLE,
    jsx: "automatic",
    tsconfig: join(RACINE, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [remplacer(outil.nom)],
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
