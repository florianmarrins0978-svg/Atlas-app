import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * SORTIR D'ATLAS NE FABRIQUE JAMAIS UNE ADRESSE ABSOLUE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa capture du 10 septembre 2026 : « Safari ne peut pas ouvrir la page »,
 * sur `localhost`.** Il venait de se déconnecter depuis son téléphone — où
 * `localhost` désigne le téléphone.
 *
 * **La chaîne exacte, et elle n'a rien d'évident.** `signOut({ redirectTo })`
 * ne redirige pas vers ce qu'on lui donne : `createActionURL`
 * (`@auth/core/lib/utils/env.js`) fabrique une adresse ABSOLUE à partir de
 * `AUTH_URL` ou, à défaut, de l'en-tête `x-forwarded-host` — et
 * `alignerHoteSurOrigine` (`src/middleware.ts`) réécrit délibérément cet
 * en-tête sur l'`Origin` du navigateur, qui vaut `localhost:3000` derrière le
 * mandataire d'un espace de travail. Sans cet alignement, Next.js refuserait
 * toute action serveur : c'est « Invalid Server Actions request. », payé vingt
 * échanges le 24 août 2026. **On ne défait donc pas l'alignement pour réparer
 * la sortie** — on cesse de laisser Auth.js deviner l'hôte.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CE CONTRÔLE LIT LE CODE AU LIEU D'OUVRIR UN NAVIGATEUR.** Il a été
 * tenté, et il ne pouvait pas marcher : la seule suite qui pose un hôte
 * étranger (`verifier-connexion.mjs`) le pose sur CHAQUE requête, ressources
 * comprises — la page ne s'hydrate alors pas, et aucune feuille ne s'ouvre. Et
 * sur un hôte ordinaire, le défaut est invisible : l'hôte deviné se trouve être
 * le bon. Un contrôle qui ne peut rougir que chez le patron ne défend rien.
 *
 * Ce qui est fixé ici est donc le MÉCANISME, pas un libellé (`CLAUDE.md`
 * §5 bis) : **aucune sortie ne laisse Auth.js composer l'adresse d'arrivée.**
 * Si le geste change de nom, d'écran ou de fichier demain, ce contrôle défend
 * toujours la même chose.
 *
 * **Il sait échouer** : remettre `signOut({ redirectTo: "/login" })` le fait
 * rougir immédiatement — c'est le code d'avant, et c'est ce qu'il attrape.
 */

const RACINE = path.join(__dirname, "..", "src");

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = path.join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(entree)) trouves.push(chemin);
  }
  return trouves;
}

/** Les commentaires CITENT le geste interdit pour expliquer pourquoi il l'est. */
function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

let echecs = 0;
function essai(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Sortir d'Atlas ne devine aucun hôte ===");

essai("aucun `signOut` ne confie la redirection à Auth.js", () => {
  const coupables: string[] = [];
  for (const f of fichiers(RACINE)) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    // `redirectTo` fait rendre à Auth.js une adresse absolue ; `redirect` laissé
    // à sa valeur par défaut (vraie) fait la même chose en silence.
    for (const appel of code.match(/signOut\s*\(([^)]*)\)/g) ?? []) {
      if (/redirectTo/.test(appel) || !/redirect\s*:\s*false/.test(appel)) {
        coupables.push(`${path.relative(path.join(__dirname, ".."), f)} : ${appel.trim()}`);
      }
    }
  }
  assert.deepEqual(
    coupables,
    [],
    "une sortie laisse Auth.js composer l'adresse d'arrivée :\n      " +
      coupables.join("\n      ") +
      "\n    Elle sera ABSOLUE, bâtie sur `x-forwarded-host` — donc `localhost` derrière" +
      "\n    le mandataire de son espace, et morte sur son téléphone." +
      "\n    Écrire : await signOut({ redirect: false }); redirect(\"/login\");"
  );
});

essai("et la sortie redirige bel et bien, sinon l'écran reste figé", () => {
  // Le revers exact du correctif : `redirect: false` sans redirection à nous
  // efface le cookie et laisse l'écran en place, chaque geste ensuite refusé —
  // le piège du cookie mort payé une soirée le 10 août 2026.
  const code = sansCommentaires(
    readFileSync(path.join(RACINE, "app", "login", "actions.ts"), "utf8")
  );
  const corps = code.slice(code.indexOf("export async function deconnexionAction"));
  const fin = corps.indexOf("\n}");
  assert.match(
    corps.slice(0, fin),
    /redirect\(\s*["'`]\/[^"'`]*["'`]\s*\)/,
    "la déconnexion n'emmène nulle part : le cookie part, l'écran reste."
  );
});

essai("le chemin d'arrivée est RELATIF — c'est ce qui le rend infaillible", () => {
  const code = sansCommentaires(
    readFileSync(path.join(RACINE, "app", "login", "actions.ts"), "utf8")
  );
  const corps = code.slice(code.indexOf("export async function deconnexionAction"));
  const fin = corps.indexOf("\n}");
  assert.doesNotMatch(
    corps.slice(0, fin),
    /redirect\(\s*["'`]https?:/,
    "une adresse écrite en dur y est revenue : elle vaudra pour un espace, pas pour le suivant."
  );
});

console.log(
  echecs === 0
    ? "\n✅ Aucune sortie ne devine d'hôte — 0 échec(s)."
    : `\n❌ La sortie d'Atlas — ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
