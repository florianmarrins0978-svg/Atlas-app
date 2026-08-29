import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// UNE DÉPENDANCE MANQUANTE SE RÉPARE, ELLE NE S'ATTEND PAS.
//
// **Sa plainte du 25 août 2026 : « l'application est en mode lent, et elle
// crash ».** Sa fiche donnait la cause au mot près — un paquet absent de ses
// `node_modules` :
//
//     Error: Cannot find module
//     '/workspaces/Atlas-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs'
//
// La construction tombe, le banc reste en développement (lent), et le même
// paquet manquant fait tomber les écrans à l'exécution. Une cause, deux
// symptômes.
//
// **Ce que ce contrôle défend :** que le banc RÉPARE au lieu d'attendre. Le
// veilleur retentait indéfiniment la même construction — contre un fichier
// absent, insister ne répare rien.
//
// ─── POURQUOI IL LIT UN TEXTE PLUTÔT QUE DE CONSTRUIRE ──────────────────────
//
// Éprouver la vraie réparation demanderait de casser `node_modules` puis de
// laisser tourner une construction complète : plusieurs minutes, et un
// environnement mutilé qu'un échec en cours de route laisserait en l'état pour
// toutes les suites suivantes. Ce qui se mesure ici est donc la RECONNAISSANCE
// du défaut — la partie qui s'est trompée deux fois — sur les messages réels,
// ceux de ses deux pannes, recopiés de sa fiche.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`      ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

console.log("\n=== Une dépendance manquante se répare ===\n");

const BANC = readFileSync("scripts/banc.mjs", "utf8");

/**
 * La reconnaissance, extraite du banc et jouée telle quelle.
 *
 * **On n'en écrit pas une copie ici.** Une seconde expression régulière
 * divergerait de celle du banc, et le contrôle finirait par éprouver une règle
 * que le produit n'applique plus (`CLAUDE.md` §3).
 */
function reconnaissanceDuBanc(): (sortie: string, code: number) => boolean {
  const debut = BANC.indexOf("const dependanceManquante =");
  assert.notEqual(
    debut,
    -1,
    "scripts/banc.mjs ne reconnaît plus une dépendance manquante : la construction retombera indéfiniment sans rien tenter."
  );
  const fin = BANC.indexOf(";", debut);
  const expression = BANC.slice(debut, fin + 1).replace("const dependanceManquante =", "");
  return new Function("sortie", "code", `return (${expression.trim().replace(/;$/, "")});`) as (
    sortie: string,
    code: number
  ) => boolean;
}

// **L'absence de la reconnaissance est un CAS, pas un plantage.** Le premier
// jet appelait l'extraction au niveau du fichier : renommer la constante dans
// le banc faisait mourir le script sur une pile d'appels, sans nommer ce qui
// manquait. Un contrôle doit accuser le bon coupable, même quand ce qu'il
// mesure a disparu (`AGENTS.md`).
let reconnait: (sortie: string, code: number) => boolean = () => false;
cas("le banc reconnaît encore une dépendance manquante", () => {
  reconnait = reconnaissanceDuBanc();
});

// ─── LES DEUX PANNES RÉELLES, RECOPIÉES DE SES FICHES ───────────────────────
const PANNE_25_AOUT = `
Error: Cannot find module '/workspaces/Atlas-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs'. Please verify that the package.json has a valid "main" entry
    at tryPackage (node:internal/modules/cjs/loader:516:19)
  code: 'MODULE_NOT_FOUND',
  requestPath: '@swc/helpers/_/_interop_require_default'
`;

const PANNE_22_AOUT = `
Error: Cannot find module './detect-typo'
Require stack:
- /workspaces/Atlas-app/node_modules/next/dist/lib/index.js
  code: 'MODULE_NOT_FOUND'
`;

cas("la panne du 25 août — @swc/helpers absent — est reconnue", () => {
  assert.equal(
    reconnait(PANNE_25_AOUT, 1),
    true,
    "le banc ne verrait pas le paquet manquant de sa fiche : il resterait en mode lent indéfiniment."
  );
});

cas("celle du 22 août — next mutilé — l'est aussi", () => {
  assert.equal(
    reconnait(PANNE_22_AOUT, 1),
    true,
    "le banc ne verrait pas la panne qui a éteint son espace une soirée entière."
  );
});

// ─── ET IL NE RÉINSTALLE PAS À TORT ─────────────────────────────────────────
//
// **Un contrôle qui parle trop s'apprend à être ignoré.** Réinstaller les
// dépendances coûte plusieurs minutes : le faire sur une erreur de types
// retarderait le patron sans rien réparer.
cas("une erreur de TYPES ne déclenche aucune réinstallation", () => {
  const typage = `
Failed to compile.
./src/app/page.tsx:12:5
Type error: Property 'nom' does not exist on type 'Chantier'.
`;
  assert.equal(reconnait(typage, 1), false, "une erreur de types ferait réinstaller pour rien");
});

cas("un module manquant DANS SON CODE à lui n'est pas une dépendance", () => {
  // `@/lib/…` absent, c'est un import cassé du dépôt — aucune réinstallation
  // ne le ramènera, et prétendre le contraire enverrait chercher au mauvais
  // endroit (`AGENTS.md`).
  const importCasse = `
Module not found: Can't resolve '@/lib/planning-jour-inexistant'
  12 | import { occupationDemi } from "@/lib/planning-jour-inexistant";
`;
  assert.equal(
    reconnait(importCasse, 1),
    false,
    "un import cassé du dépôt ferait réinstaller les dépendances pour rien"
  );
});

cas("un module absent HORS de node_modules ne fait pas réinstaller", () => {
  // **Ce cas défend la clause `/node_modules/`, et il a été ajouté parce que la
  // retirer ne faisait rougir personne.** Un script du dépôt qu'on a renommé
  // sans corriger son appelant donne exactement cette erreur : réinstaller les
  // dépendances n'y changerait rien, et ferait chercher au mauvais endroit.
  const scriptDuDepot = `
Error: Cannot find module '/workspaces/Atlas-app/scripts/rapporter-espace.mjs'
    at Function._resolveFilename (node:internal/modules/cjs/loader:1225:15)
  code: 'MODULE_NOT_FOUND'
`;
  assert.equal(
    reconnait(scriptDuDepot, 1),
    false,
    "un fichier du dépôt manquant ferait réinstaller les dépendances : la réparation viserait à côté"
  );
});

cas("une construction RÉUSSIE ne réinstalle jamais", () => {
  assert.equal(
    reconnait(PANNE_25_AOUT, 0),
    false,
    "le banc réinstallerait après une construction qui a marché"
  );
});

// ─── LA RÉPARATION EXISTE, ET ELLE NE BOUCLE PAS ────────────────────────────
/**
 * Où commence le bloc de réinstallation, quelles que soient ses conditions.
 *
 * **Ce repère cherchait `if (dependanceManquante) {` au caractère près**, et il
 * a rougi le 29 août 2026 quand une seconde condition s'y est ajoutée
 * (`|| morteSansRienDire`, pour la construction qui meurt sans un mot —
 * `ARCHITECTURE.md` §204). Le code était juste ; c'est le contrôle qui figeait
 * une FORME au lieu de défendre une RÈGLE (`CLAUDE.md` §5 bis).
 *
 * Ce qui compte, et que les deux cas ci-dessous vérifient toujours : une fois
 * le défaut reconnu, on réinstalle, puis on rebâtit. Le nombre de raisons qui
 * mènent là ne les regarde pas.
 */
function debutDuBlocDeReinstallation(): number {
  const trouve = BANC.search(/if \(dependanceManquante[^)]*\) \{/);
  assert.notEqual(trouve, -1, "le bloc de réinstallation a disparu de banc.mjs");
  return trouve;
}

cas("la réinstallation est bien lancée, et le banc reconstruit après", () => {
  const apres = BANC.slice(debutDuBlocDeReinstallation());
  assert.ok(
    /jouerEnRetenant\("npm", \[\s*"install"/.test(apres.replace(/\s+/g, " ")),
    "rien ne réinstalle : le banc reconnaît le défaut et n'en fait rien."
  );
  assert.ok(
    apres.indexOf('jouerEnRetenant("npx", ["next", "build"]') !== -1,
    "la construction n'est pas retentée après la réinstallation : elle n'aura servi à rien."
  );
});

cas("`npm install`, jamais `npm ci` — le serveur de développement sert pendant ce temps", () => {
  const debut = debutDuBlocDeReinstallation();
  const apres = BANC.slice(debut, BANC.indexOf("if (code === 0) {", debut));
  assert.ok(
    !/"ci"/.test(apres),
    "`npm ci` efface node_modules : il couperait le serveur qui sert le patron pendant la réparation."
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Une dépendance manquante — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
