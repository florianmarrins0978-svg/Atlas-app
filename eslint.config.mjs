import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Les globales réellement offertes par Node, lues sur Node lui-même.
//
// Les énumérer à la main, c'est se condamner à un faux positif le jour où un
// script emploie `structuredClone` ou `fetch` — et un contrôle qui accuse à
// tort coûte plus cher que pas de contrôle du tout. `globalThis` du processus
// qui joue ESLint EST l'environnement de ces scripts : la liste ne peut pas
// dériver. Aucune dépendance nouvelle non plus, et c'est délibéré : un
// `import "globals"` reposerait sur une dépendance transitive d'ESLint.
const GLOBALES_NODE = Object.fromEntries(
  [
    ...Object.getOwnPropertyNames(globalThis),
    // Absents de `globalThis` car injectés par module : CommonJS les a.
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
  ].map((nom) => [nom, "readonly"])
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // **Un nom inventé doit arrêter la livraison.**
  //
  // Le 10 août 2026, `scripts/banc.mjs` lisait une variable `bati` qui
  // n'existait pas. Types au vert, lint au vert : rien ne pouvait le voir,
  // parce que `no-undef` est éteint par défaut pour ces fichiers et que
  // TypeScript, qui joue ce rôle ailleurs, ne les regarde pas. La panne
  // n'apparaissait qu'à l'exécution — et pas n'importe où : APRÈS la
  // construction, une fois le banc annoncé prêt. Le patron perdait son
  // application au moment précis où elle venait d'arriver.
  //
  // Restreint aux fichiers JavaScript : sur du TypeScript, `no-undef` est
  // redondant avec le compilateur et connu pour ses faux positifs.
  {
    files: ["**/*.mjs", "**/*.cjs", "**/*.js"],
    languageOptions: { globals: GLOBALES_NODE },
    rules: { "no-undef": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Le dossier que le banc bâtit à côté du dossier de développement
    // (`scripts/banc.mjs`, `ATLAS_DIST_DIR`). Il n'est PAS couvert par
    // `.next/**`, et personne ne s'en apercevait tant qu'on ne lançait pas le
    // banc : une fois `npm run banc` joué, `npm run lint` recrachait
    // 1 271 erreurs venues de code généré. Un contrôle noyé ne se lit plus.
    ".next-batie/**",
    // Le même piège, une seconde fois : le serveur au profil « banc » monté par
    // `scripts/test-bandeau-banc-e2e.ts` a besoin de son propre dossier — Next.js
    // 16 refuse deux serveurs de développement dans un même répertoire. Sans
    // cette ligne, `npm run lint` passait de zéro à 1 116 erreurs dès que cette
    // suite avait tourné une fois, toutes venues de code généré.
    ".next-banc-essai/**",
    // **Et une TROISIÈME fois, le 16 août 2026.** La batterie bâtit désormais
    // (`verifier-avant-livraison.ts`, étape « Construction »), parce qu'une
    // panne qui n'existe qu'à la construction traversait sinon tous les
    // contrôles au vert. Elle bâtit dans son propre dossier pour ne pas écraser
    // le `.next` d'un serveur qui tourne — et ce dossier doit donc être écarté
    // ici, sans quoi le lint de la batterie SUIVANTE recracherait des milliers
    // d'erreurs venues de code généré. Constaté sur-le-champ : 1 478.
    //
    // Trois fois le même piège : `scripts/test-verrou-construction.ts` vérifie
    // maintenant que tout dossier de construction employé par la batterie est
    // écarté ici, pour qu'il n'y ait pas de quatrième.
    ".next-verification/**",
    // appli/ est un projet distinct (HTML/JS statique navigateur + scripts
    // Node, sans React ni TypeScript) : les règles Next.js n'y ont pas de sens
    // et rejetteraient par exemple le `require()` de sa batterie de tests.
    // Il a son propre outillage, décrit dans appli/README.md.
    "appli/**",
  ]),
]);

export default eslintConfig;
