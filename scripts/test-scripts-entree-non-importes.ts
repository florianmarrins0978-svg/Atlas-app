import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * ─── UN SCRIPT D'ENTRÉE NE S'IMPORTE PAS ────────────────────────────────────
 *
 * **La panne du 17 septembre 2026, trouvée en jouant l'outil, pas en le
 * lisant.** `verifier-apres-fusion.ts` importait une fonction de
 * `verifier-rouge-prealable.ts` — un script d'ENTRÉE, qui appelle `main()` à sa
 * dernière ligne. L'import exécutait donc ce `main()`, qui écrivait
 * « ✅ aucune suite rouge : rien à comparer » puis `process.exit(0)` : le
 * complément n'a **jamais joué une ligne de son propre travail**, et il rendait
 * un vert qu'on pouvait prendre pour un verdict de fusion.
 *
 * C'est le pire des défauts d'outillage : il ne tombe pas, il approuve.
 *
 * **Ce que ce contrôle tient :** aucun script de `scripts/` n'importe un script
 * qui s'exécute tout seul. Ce qui se partage vit dans un module sans effet de
 * bord (`_…mjs` / `_….ts`), et c'est déjà la convention du dossier.
 */

const DOSSIER = path.join(__dirname);

/**
 * Un script s'exécute tout seul quand il appelle son `main()` au chargement.
 *
 * **L'appel doit être en COLONNE ZÉRO**, et cette précision a été payée tout de
 * suite : `ouvrir-session.mjs` et `preparer-sessions.mjs` gardent déjà le leur
 * derrière `if (import.meta.url === …)` — un `main()` INDENTÉ, donc, qui ne
 * part pas à l'import. Une première version les accusait tous les deux ; un
 * contrôle qui accuse à tort coûte plus cher que pas de contrôle (`AGENTS.md`).
 */
function sExecuteSeul(source: string): boolean {
  return /^(await\s+|void\s+)?main\(\)\s*;?\s*$/m.test(source);
}

/** Les chemins qu'un fichier importe, ramenés à un nom de fichier de `scripts/`. */
function importsLocaux(source: string): string[] {
  const noms: string[] = [];
  for (const m of source.matchAll(/from\s+"\.\/([^"]+)"/g)) noms.push(m[1]);
  for (const m of source.matchAll(/import\(\s*"\.\/([^"]+)"\s*\)/g)) noms.push(m[1]);
  return noms;
}

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Un script d'entrée ne s'importe pas ===\n");

essai("le contrôle SAIT échouer — un couple fabriqué est reconnu", () => {
  const coin = mkdtempSync(path.join(tmpdir(), "atlas-entree-"));
  writeFileSync(path.join(coin, "entree.ts"), "export function util() {}\nasync function main() {}\nmain();\n");
  writeFileSync(path.join(coin, "importeur.ts"), 'import { util } from "./entree";\nutil();\n');
  const entree = readFileSync(path.join(coin, "entree.ts"), "utf8");
  const importeur = readFileSync(path.join(coin, "importeur.ts"), "utf8");
  assert.ok(sExecuteSeul(entree), "un `main()` en dernière ligne n'est pas reconnu");
  assert.ok(importsLocaux(importeur).includes("entree"), "l'import local n'est pas lu");
});

essai("un `main()` gardé par `import.meta.url` ne compte PAS", () => {
  const garde = [
    "async function main() {}",
    'if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {',
    "  main();",
    "}",
  ].join("\n");
  assert.ok(!sExecuteSeul(garde), "un appel gardé est pris pour un départ à l'import");
});

essai("aucun script du dépôt n'importe un script qui s'exécute seul", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => /\.(ts|mts|mjs)$/.test(f));
  const sources = new Map<string, string>();
  for (const f of fichiers) sources.set(f, readFileSync(path.join(DOSSIER, f), "utf8"));

  const seuls = new Set(
    [...sources.entries()].filter(([, s]) => sExecuteSeul(s)).map(([f]) => f.replace(/\.(ts|mts|mjs)$/, ""))
  );

  const fautes: string[] = [];
  for (const [fichier, source] of sources) {
    for (const cible of importsLocaux(source)) {
      const sansExtension = cible.replace(/\.(ts|mts|mjs|js)$/, "");
      if (seuls.has(sansExtension)) fautes.push(`${fichier} importe ${cible}`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    `un import exécute le script importé, et son verdict remplace celui qu'on attendait :\n      ${fautes.join("\n      ")}`
  );
});

console.log("");
if (echecs > 0) {
  console.log(`${echecs} échec(s).`);
  process.exit(1);
}
console.log("✅ Aucun script d'entrée n'est importé.");
