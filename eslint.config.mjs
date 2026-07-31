import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // appli/ est un projet distinct (HTML/JS statique navigateur + scripts
    // Node, sans React ni TypeScript) : les règles Next.js n'y ont pas de sens
    // et rejetteraient par exemple le `require()` de sa batterie de tests.
    // Il a son propre outillage, décrit dans appli/README.md.
    "appli/**",
  ]),
]);

export default eslintConfig;
