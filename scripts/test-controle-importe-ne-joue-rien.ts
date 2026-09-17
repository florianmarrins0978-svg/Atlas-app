import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * UN SCRIPT QUI S'EXÉCUTE AU CHARGEMENT NE S'IMPORTE PAS — 17 septembre 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce que ça a coûté le jour même.** `verifier-apres-fusion.ts` — le contrôle
 * qui tient la place de la batterie quand `main` avance sous un lot éprouvé —
 * importait `lireLesReponses` depuis `verifier-rouge-prealable.ts`. Or ce
 * fichier appelle `main()` au niveau du module : l'import le JOUAIT, et son
 * `process.exit(0)` terminait le processus **avant que le complément ait
 * exécuté une seule ligne**.
 *
 * Le journal rendu était mot pour mot celui de l'autre script, et le code de
 * sortie valait 0. **Un contrôle qui rend vert sans avoir mesuré** : le pire
 * état que ce dépôt connaisse (`CLAUDE.md` §5, « un contrôle qui mesure ZÉRO
 * ne mesure rien — et il est pire qu'absent »). Il l'aurait rendu à chaque lot
 * qui suit, sans que personne le voie.
 *
 * **La réponse existait déjà dans le dépôt**, avec sa raison écrite :
 * `verifier-chaine-dictee.mts` porte ce garde depuis qu'une suite qui
 * l'importait déclenchait un appel de modèle. Une seule façon de faire
 * (`CLAUDE.md` §3) — c'est celle-là qu'on exige ici.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce que ce contrôle tient, et qui vaut pour le prochain : **tout fichier de
 * `scripts/` qui s'exécute au chargement — `verifier-*`, `run-*`, `test-*` —
 * et qu'un autre script IMPORTE doit porter un garde de point d'entrée.** Les
 * aides, elles, portent un `_` : elles n'exécutent rien et s'importent
 * librement.
 */

const DOSSIER = path.join(__dirname);

/** Les préfixes du dépôt pour ce qui se LANCE, par opposition aux aides `_`. */
const EXECUTABLES = /^(verifier|run|test)-/;

/** `import … from "./x"` — le nom du script importé, sans extension. */
const IMPORTS = /(?:from|import)\s+"\.\/([A-Za-z0-9._-]+)"/g;

/**
 * Le garde du dépôt : `process.argv[1]` porte le fichier LANCÉ, jamais celui
 * qu'on importe. Reconnu aussi sous ses autres formes usuelles, pour ne pas
 * imposer une écriture unique là où seul l'effet compte.
 */
const GARDE = /process\.argv\[1\]|require\.main\s*===\s*module|import\.meta\.main/;

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Un exécutable importé ne joue rien au chargement ===\n");

const fichiers = readdirSync(DOSSIER).filter((f) => /\.(ts|mts|mjs)$/.test(f));
const source = new Map(fichiers.map((f) => [f, readFileSync(path.join(DOSSIER, f), "utf8")]));

/** Qui importe quoi : le nom écrit peut omettre l'extension, ou en porter une autre. */
function resoudre(nomEcrit: string): string | null {
  const nu = nomEcrit.replace(/\.(ts|mts|mjs|js)$/, "");
  return fichiers.find((f) => f.replace(/\.(ts|mts|mjs)$/, "") === nu) ?? null;
}

const importesParUnScript = new Map<string, string[]>();
for (const [fichier, texte] of source) {
  for (const trouve of texte.matchAll(IMPORTS)) {
    const cible = resoudre(trouve[1]);
    if (!cible || cible === fichier) continue;
    importesParUnScript.set(cible, [...(importesParUnScript.get(cible) ?? []), fichier]);
  }
}

cas("aucun exécutable importé ne s'exécute au chargement", () => {
  const fautifs: string[] = [];
  for (const [cible, importeurs] of importesParUnScript) {
    if (!EXECUTABLES.test(cible)) continue;
    const texte = source.get(cible) ?? "";
    if (GARDE.test(texte)) continue;
    fautifs.push(`${cible} — importé par ${importeurs.join(", ")}`);
  }
  assert.deepEqual(
    fautifs,
    [],
    "un script qui se joue au chargement est importé ailleurs : l'import le JOUE, et son " +
      "process.exit termine l'appelant avant qu'il ait mesuré quoi que ce soit —\n      " +
      fautifs.join("\n      ")
  );
});

cas("et le contrôle sait ce qu'il cherche : le garde existant est reconnu", () => {
  // Sans ce cas, une expression cassée rendrait « aucun fautif » sur tout le
  // dossier — un vert qui ne mesure rien (`CLAUDE.md` §5).
  const temoin = source.get("verifier-chaine-dictee.mts");
  assert.ok(temoin, "le témoin du dépôt a disparu : ce contrôle ne prouve plus rien");
  assert.ok(GARDE.test(temoin), "le garde de verifier-chaine-dictee.mts n'est plus reconnu");
});

cas("les aides en « _ » ne sont jamais concernées : elles n'exécutent rien", () => {
  const aides = [...importesParUnScript.keys()].filter((f) => f.startsWith("_"));
  assert.ok(aides.length > 0, "aucune aide importée : la lecture des imports ne marche pas");
});

console.log(`\nUn exécutable importé ne joue rien — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
