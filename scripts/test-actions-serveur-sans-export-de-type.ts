import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// **Un fichier « use server » ne réexporte JAMAIS un type.**
//
// Payé le 21 août 2026, et cher : `src/app/planning/actions.ts` portait un
// innocent `export type { FeuilleDuChantier };`, écrit pour que l'écran prenne
// son type là où il prend ses actions. Le chargeur d'actions de Next réécrit ce
// module en une liste d'exports de VALEURS — une par action, sous son
// identifiant. Le nom exporté « type » y survit sous forme de référence à une
// chose que TypeScript vient d'effacer, et le module meurt à son évaluation :
//
//     ⨯ ReferenceError: FeuilleDuChantier is not defined
//       at .next-internal/server/app/planning/page/actions.js (server actions loader)
//
// **Toutes les actions de l'écran répondent alors 500**, pas seulement celle qui
// rend ce type : le module entier est mort. Poser une date, désigner une équipe,
// déplacer un chantier, retirer — plus rien n'atteignait la base.
//
// **Et rien ne le disait.** `tsc --noEmit` est vert, `eslint` est vert : le code
// SOURCE est juste, c'est la réécriture qui ne l'est pas. Seule une suite
// navigateur l'a vu, et encore : le geste « réussissait » à l'écran, sans un
// mot, parce qu'une action serveur ne rend pas son erreur au patron
// (`AGENTS.md`). C'est en allant lire le journal du serveur qu'on l'a trouvé —
// deux heures après.
//
// **Ce contrôle coûte une seconde et rend cette panne impossible.** Le type se
// prend à sa source, avec `import type`, qui s'efface à la compilation : c'est
// déjà ce que font `Notifications.tsx`, `PrixClient.tsx` et cinq autres écrans.

const RACINE = "src";

/**
 * Un export de TYPE, sous ses deux orthographes.
 *
 * `export type { X }` et `export { type X }` — Next tombe sur les deux, et
 * n'écrire que la première laisserait la seconde passer un jour de fatigue.
 * `export type X = …` (une DÉFINITION) n'est pas concerné : elle disparaît
 * entièrement, elle ne laisse aucun nom à réexporter.
 */
const REEXPORT_DE_TYPE = /^\s*export\s*(?:type\s*\{|\{[^}]*\btype\s)/gm;

/** Le fichier se déclare-t-il « use server » ? Sur ses premières lignes seulement. */
function estActionServeur(source: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*\n|\s*\n)*["']use server["']/.test(source);
}

/**
 * Retirer commentaires et chaînes avant de chercher.
 *
 * Sans quoi ce commentaire-ci — qui cite le motif interdit pour l'expliquer —
 * ferait rougir le contrôle sur lui-même. Un contrôle qui se dénonce lui-même
 * s'apprend à être ignoré (`CLAUDE.md` §1 bis).
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[^\n]*?\/\/[^\n]*$/gm, (l) => (/^\s*\/\//.test(l) ? "" : l.replace(/\/\/.*$/, "")));
}

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (/\.tsx?$/.test(nom)) trouves.push(chemin);
  }
  return trouves;
}

function main() {
  console.log("=== Aucun export de type dans un fichier « use server » ===\n");

  const coupables: string[] = [];
  let regardes = 0;
  for (const chemin of fichiers(RACINE)) {
    const source = readFileSync(chemin, "utf8");
    if (!estActionServeur(source)) continue;
    regardes++;
    for (const m of sansCommentaires(source).matchAll(REEXPORT_DE_TYPE)) {
      coupables.push(`${chemin} → ${m[0].trim()}`);
    }
  }

  // **Zéro fichier regardé ne prouve rien** — c'est la règle des mesures nulles
  // (`CLAUDE.md` §5). Si `estActionServeur` cessait un jour de reconnaître la
  // directive, ce contrôle rendrait un vert imperturbable sur une application
  // entièrement cassée.
  assert.ok(
    regardes >= 5,
    `seulement ${regardes} fichier(s) « use server » reconnu(s) : le contrôle ne mesure plus rien`
  );
  console.log(`  ✓ ${regardes} fichiers « use server » regardés`);

  assert.deepEqual(
    coupables,
    [],
    "Un fichier « use server » réexporte un type. Le module d'actions mourra à " +
      "son évaluation (« ReferenceError: … is not defined ») et TOUTES les " +
      "actions de l'écran répondront 500, pendant que le typecheck restera " +
      "vert. Le type se prend à sa source, avec `import type`.\n  " +
      coupables.join("\n  ")
  );
  console.log("  ✓ aucun ne réexporte de type");

  // ─── Le contrôle sait-il rougir ? ──────────────────────────────────────
  //
  // Confronté à la faute même du 21 août, et à sa variante. Un contrôle qui n'a
  // jamais échoué ne prouve rien (`AGENTS.md`).
  for (const faute of [
    '"use server";\nimport type { X } from "@/server/x";\nexport type { X };\n',
    '"use server";\nexport { type X, faire } from "./x";\n',
    '// un mot\n"use server";\nexport type {\n  X,\n} from "./x";\n',
  ]) {
    assert.ok(estActionServeur(faute), `« use server » non reconnu dans :\n${faute}`);
    assert.ok(
      [...sansCommentaires(faute).matchAll(REEXPORT_DE_TYPE)].length > 0,
      `le motif laisse passer la faute :\n${faute}`
    );
  }
  console.log("  ✓ il rougit sur la faute du 21 août, et sur ses variantes");

  // Et il ne rougit pas sur ce qui est légitime : une DÉFINITION de type
  // exportée (elle s'efface tout entière), un export de valeur, ou la faute
  // écrite dans un fichier qui n'est pas une action serveur.
  const permis = '"use server";\nexport type EtatPose = { jour: string | null };\nexport { faire };\n';
  assert.equal(
    [...sansCommentaires(permis).matchAll(REEXPORT_DE_TYPE)].length,
    0,
    "le motif dénonce une définition de type : il deviendrait rouge quoi qu'on fasse"
  );
  assert.equal(
    estActionServeur('"use client";\nexport type { X } from "./x";\n'),
    false,
    "un fichier « use client » est pris pour une action serveur : le contrôle déborde"
  );
  console.log("  ✓ il laisse tranquille une définition de type, et les écrans clients");

  console.log("\n✅ Actions serveur — 0 échec.");
}

main();
