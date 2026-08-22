// Le contrôle de types ignore-t-il les fichiers de travail du serveur de
// développement ?
//
// **Ce contrôle existe à cause d'une panne chez le patron, le 11 août 2026 au
// soir.** Son espace affichait :
//
//     Failed to type check.
//     .next/dev/types/validator.ts:116:39
//     Type error: Cannot find module '.../chantiers/[id]/photos/page.js'
//
// Le fichier existait, et la construction passait ici. La cause est une COURSE,
// pas un défaut de code : `npm run banc` sert la version de développement — qui
// écrit dans `.next/dev/` — PENDANT qu'il bâtit la version rapide. Le contrôle
// de types lisait donc les fichiers de travail d'un autre processus, en train
// d'être réécrits. Le message accusait le code alors que rien n'était cassé.
//
// **Pourquoi un test et pas seulement un commentaire :** `next build` RÉÉCRIT
// `tsconfig.json` et y remet `.next/dev/types/**/*.ts` de lui-même. Constaté
// dans la même heure. La réparation ne tient donc pas sur la liste `include`,
// qui se fait remettre en place, mais sur `exclude` — que Next ne touche pas, et
// qui l'emporte. Sans ce contrôle, la prochaine construction rouvrirait la
// panne en silence, et elle ne se reverrait que chez le patron.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le contrôle de types ignore les restes du développement ===");

// `tsconfig.json` porte des commentaires (TypeScript les accepte) : on les
// retire avant de lire le JSON, plutôt que d'interdire d'en écrire.
const brut = readFileSync("tsconfig.json", "utf8");
const sansCommentaires = brut.replace(/^\s*\/\/.*$/gm, "");
const config = JSON.parse(sansCommentaires) as {
  include?: string[];
  exclude?: string[];
};

cas("les dossiers de travail du serveur de développement sont exclus", () => {
  const exclus = config.exclude ?? [];
  assert.ok(
    exclus.includes(".next/dev"),
    "`.next/dev` n'est plus dans `exclude` : le contrôle de types va relire les " +
      "fichiers que le serveur de développement est en train d'écrire, et la " +
      "construction du banc échouera par intermittence sur une route parfaitement " +
      "valable. C'est la panne du 11 août 2026 au soir."
  );
});

cas("l'exclusion couvre aussi le dossier de la version bâtie", () => {
  const exclus = config.exclude ?? [];
  assert.ok(
    exclus.includes(".next-batie/dev"),
    "`.next-batie/dev` manque à `exclude` : le banc bâtit dans `.next-batie`, et " +
      "un serveur de développement y déposerait les mêmes restes."
  );
});

cas("les types engendrés par la CONSTRUCTION restent vérifiés", () => {
  // On ne remplace pas un trou par un autre : ce qui valide les routes, ce sont
  // les types engendrés par la construction elle-même. Ils ne bougent pas
  // pendant qu'on les lit, et ils doivent rester dans la liste.
  const inclus = config.include ?? [];
  assert.ok(
    inclus.some((m) => m.startsWith(".next/types/")),
    "`.next/types` a disparu de `include` : plus rien ne vérifie la forme des routes"
  );
  assert.ok(
    inclus.some((m) => m.startsWith(".next-batie/types/")),
    "`.next-batie/types` a disparu de `include` : la version bâtie n'est plus vérifiée"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} tsconfig, restes du développement — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
