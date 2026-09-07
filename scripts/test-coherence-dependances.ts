import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// **Sa panne du 29 août 2026 au soir, et le contrôle qui l'empêche de revenir.**
//
// Sa fiche publiait le relevé de l'échec, et il tient en cinq lignes :
//
//     code: 1
//     memoire: Mem: 7.8Gi  used 2.1Gi  available 5.7Gi
//     dit:
//     ▲ Next.js 16.3.3 (Turbopack)
//     - Environments: .env.local
//
// **La mémoire n'y était pour rien** — 5,7 Go libres. Il exécutait Next 16.3.3
// alors que le projet épingle 16.3.2, dans `package.json` comme dans le verrou.
// Next embarque des binaires natifs versionnés à l'identique : le compilateur
// meurt à leur chargement, après l'en-tête, sans un mot.
//
// **Et son banc ne pouvait pas s'en sortir** : sa réinstallation automatique
// exige `Cannot find module` dans la sortie. Un paquet ABSENT la déclenche ; un
// paquet PRÉSENT MAIS DÉSACCORDÉ, non. Le veilleur retentait la même
// construction condamnée, indéfiniment.

import {
  versionEpinglee,
  dependancesIncoherentes,
  constructionMuette,
  arbreIncomplet,
} from "./coherence-dependances.mjs";

let echecs = 0;
// **UN CAS ASYNCHRONE DOIT ÊTRE ATTENDU, SINON IL EST TOUJOURS VERT.**
//
// Écrit le 3 septembre 2026, après m'être fait prendre par ma propre règle :
// les quatre cas neufs de la section 4 bis interrogent un npm simulé, donc
// rendent une promesse. `verifier` ne l'attendait pas : la promesse rejetée
// partait en rejet non intercepté, le cas s'affichait ✅, et les quatre
// passaient au vert CONTRE LE CODE D'AVANT — qui n'a même pas la fonction
// qu'ils prétendent éprouver. Un contrôle qui ne sait pas échouer ne prouve
// rien (`CLAUDE.md` §5), et celui-là ne prouvait rien quatre fois.
const enCours: Promise<void>[] = [];
function verifier(intitule: string, fn: () => void | Promise<void>) {
  const rate = (e: unknown) => {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(e as Error).message}`);
  };
  try {
    const rendu = fn();
    if (rendu instanceof Promise) {
      enCours.push(rendu.then(() => console.log(`✅ ${intitule}`), rate));
      return;
    }
    console.log(`✅ ${intitule}`);
  } catch (e) {
    rate(e);
  }
}

// --- 1. Son cas, avec ses chiffres ---------------------------------------

verifier("SON désaccord est vu : Next 16.3.3 installé, 16.3.2 exigé", () => {
  const { incoherent, motif } = dependancesIncoherentes([
    { nom: "next", exigee: "16.3.2", installee: "16.3.3" },
  ]);
  assert.equal(incoherent, true, "c'est exactement ce qui tuait sa construction");
  assert.match(motif ?? "", /16\.3\.3/, "la version fautive doit être nommée");
  assert.match(motif ?? "", /16\.3\.2/, "celle qu'on attend aussi");
});

verifier("des versions accordées ne déclenchent RIEN", () => {
  const { incoherent, motif } = dependancesIncoherentes([
    { nom: "next", exigee: "16.3.2", installee: "16.3.2" },
    { nom: "eslint-config-next", exigee: "16.3.2", installee: "16.3.2" },
  ]);
  assert.equal(incoherent, false, "réinstaller un espace sain coûterait des minutes à chaque démarrage");
  assert.equal(motif, null);
});

// --- 2. On ne conclut que sur ce qu'on SAIT ------------------------------

verifier("un intervalle de versions n'est pas une incohérence", () => {
  // `^16.3.2` autorise délibérément 16.3.3 : s'en plaindre ferait réinstaller
  // en boucle un projet parfaitement normal.
  assert.equal(versionEpinglee({ dependencies: { next: "^16.3.2" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: "~16.3.2" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: ">=16" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: "16.3.2" } }, "next"), "16.3.2");
});

verifier("une version épinglée se lit aussi dans devDependencies", () => {
  assert.equal(versionEpinglee({ devDependencies: { "eslint-config-next": "16.3.2" } }, "eslint-config-next"), "16.3.2");
});

verifier("un paquet que le projet N'ÉPINGLE PAS n'accuse personne", () => {
  assert.equal(dependancesIncoherentes([{ nom: "next", exigee: null, installee: "16.3.3" }]).incoherent, false);
  assert.equal(versionEpinglee(null, "next"), null);
  assert.equal(versionEpinglee({}, "next"), null);
});

verifier("SA PANNE DE MIDI : un paquet ÉPINGLÉ et ABSENT se répare, il ne s'ignore plus", () => {
  // **Ce contrôle disait l'inverse jusqu'au 31 août 2026**, et il avait ses
  // raisons : on ne compare pas ce qu'on ne lit pas. Sa panne de midi les a
  // périmées — `node_modules/next` manquait, `npx next build` est allé
  // télécharger 16.3.3 depuis le registre et l'a lancé, et ce Next étranger a
  // échoué sur « Could not find the Next.js package ». Le paquet absent ne
  // s'est jamais plaint : rien ne réparait, et le veilleur retentait la même
  // construction condamnée toute la matinée.
  const { incoherent, motif } = dependancesIncoherentes([
    { nom: "next", exigee: "16.3.2", installee: null },
  ]);
  assert.equal(incoherent, true, "un paquet épinglé et introuvable ne déclenche pas la réinstallation");
  assert.match(motif ?? "", /ABSENT/, "le motif ne dit pas que le paquet manque — le patron lit ça sur un téléphone");
});

// --- 3. Le second filet : une construction morte sans rien dire ----------

verifier("SA sortie du 29 août est reconnue comme muette", () => {
  const sortie = "▲ Next.js 16.3.3 (Turbopack)\n- Environments: .env.local";
  assert.equal(constructionMuette({ code: 1, sortie }), true);
});

verifier("une VRAIE erreur de compilation n'est pas muette", () => {
  const sortie = "▲ Next.js 16.3.2\nType error: Property 'libelle' does not exist.";
  assert.equal(
    constructionMuette({ code: 1, sortie }),
    false,
    "réinstaller ne répare pas une faute de frappe — et ferait perdre des minutes"
  );
});

verifier("une sortie courte QUI PARLE d'une erreur n'est pas muette", () => {
  assert.equal(constructionMuette({ code: 1, sortie: "Error: something" }), false);
  assert.equal(constructionMuette({ code: 1, sortie: "Cannot find module 'x'" }), false);
  assert.equal(constructionMuette({ code: 1, sortie: "Échec de la compilation" }), false);
});

verifier("une construction RÉUSSIE n'est jamais muette", () => {
  assert.equal(constructionMuette({ code: 0, sortie: "" }), false, "un succès ne se réinstalle pas");
});

verifier("une sortie longue n'est pas muette, même sans mot d'erreur", () => {
  const longue = Array.from({ length: 12 }, (_, i) => `ligne ${i}`).join("\n");
  assert.equal(constructionMuette({ code: 1, sortie: longue }), false);
});

// --- 4. Est-ce BRANCHÉ ? -------------------------------------------------
//
// Une règle juste que personne n'appelle ne répare rien : ce dépôt l'a déjà
// payé (le rappel `avancer` de `prechauffer.mjs`, jamais passé pendant cinq
// jours). Ces contrôles lisent le banc.
const BANC = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");

verifier("le banc vérifie les dépendances AVANT de bâtir", () => {
  const garde = BANC.indexOf("await reinstallerSiDesaccordees()");
  const build = BANC.indexOf('jouerEnRetenant(process.execPath, [NEXT, "build"]');
  assert.ok(garde > 0, "la vérification a disparu de banc.mjs");
  assert.ok(build > 0, "garde-fou de lecture : la construction a changé de forme");
  assert.ok(
    garde < build,
    "vérifier APRÈS la construction ne sert à rien : elle est déjà morte, et sans rien dire"
  );
});

verifier("SA PANNE DE MIDI : le banc n'appelle JAMAIS `npx` pour lancer Next", () => {
  // **`npx` ne se contente pas d'échouer quand le paquet manque : il le
  // TÉLÉCHARGE.** Le 31 août 2026, `node_modules/next` manquait sur son espace ;
  // `npx next build` a donc installé next@16.3.3 depuis le registre et l'a
  // lancé, alors que le projet épingle 16.3.2. Ce Next étranger ne trouvait pas
  // le paquet du projet, la construction tombait, et le banc restait en mode
  // développement — « elle est super lente ».
  //
  // Reproduit ici en écartant le paquet : « npm warn exec The following package
  // was not found and will be installed: next@16.3.3 », puis son erreur mot
  // pour mot.
  assert.ok(
    !/["']npx["']/.test(BANC),
    "banc.mjs appelle encore npx : un node_modules amputé fera silencieusement " +
      "tourner un Next venu du registre, et sa version ne sera plus celle du projet"
  );
  assert.match(
    BANC,
    /const NEXT = "node_modules\/next\/dist\/bin\/next"/,
    "le binaire du projet n'est plus désigné par son chemin"
  );
});

// Un faux npm : casser l'arbre de la machine qui joue la suite serait un remède
// pire que le mal.
const npmQuiRepond = (code: number, sortie: string) => async () => ({ code, sortie });

verifier("un `next` absent déclenche la réinstallation, quelle que soit la phrase", async () => {
  // **CE CAS EXIGEAIT UNE PHRASE, ET LA PHRASE A CHANGÉ — 3 septembre 2026.**
  //
  // Il fixait la présence de « Could not find the Next.js package » dans
  // `banc.mjs` : le message que Turbopack rendait le 31 août quand
  // `node_modules/next` manquait. C'était fixer la MÉCANIQUE, pas la règle
  // (`CLAUDE.md` §5 bis) — et l'énumération a laissé passer une troisième
  // formulation deux jours plus tard.
  //
  // Ce qui doit tenir : un `next` absent de l'arbre déclenche la réparation.
  // Par quel mot l'outil s'en plaint ne regarde plus personne.
  const r = await arbreIncomplet(npmQuiRepond(1, "atlas-mvp@0.1.0\n+-- UNMET DEPENDENCY next@16.3.2"));
  assert.equal(r.incomplet, true, "un `next` absent ne déclenche plus rien : le banc resterait condamné");
  assert.match(r.motif ?? "", /next/, "le motif doit nommer le paquet, sinon il n'aide pas à comprendre");
});

verifier("une construction muette déclenche aussi la réinstallation", () => {
  assert.match(
    BANC,
    /const morteSansRienDire = constructionMuette\(/,
    "le second filet a disparu : un node_modules abîmé sans écart de version ne serait plus rattrapé"
  );
  // **Trois signaux, et chacun voit ce que les deux autres ne voient pas :**
  // un paquet mutilé (le message de Node), un paquet absent (`npm ls`), une
  // construction morte sans un mot. Calculer l'un sans l'employer ne sert à
  // personne — c'est leur emploi qu'on fixe, pas leur ordre.
  assert.match(
    BANC,
    /if \(dependanceManquante \|\| incomplet \|\| morteSansRienDire\)/,
    "un des trois filets est calculé mais pas utilisé — il ne sert alors à personne"
  );
});

// --- 4 bis. ON DEMANDE À NPM, ON NE LIT PLUS SES PHRASES -----------------
//
// **Trois fois le même piège, et la troisième a coûté une matinée au patron.**
// La réparation ne se déclenchait que si l'on RECONNAISSAIT le message :
//
//   | quand | ce que l'outil a dit |
//   |---|---|
//   | 22 août 2026 | `Cannot find module` |
//   | 31 août 2026 | `Could not find the Next.js package` |
//   | 3 septembre 2026 | `Module not found` (Turbopack) |
//
// À chaque fois, la même conséquence : le veilleur retentait indéfiniment une
// construction condamnée. Le 3 septembre, il a vu « Internal Server Error »
// pendant des heures — `instrumentation.ts` ne pouvait plus charger Sentry,
// dont une dépendance manquait.
//
// La question n'a jamais été « quel message », mais « le dossier est-il
// entier ». On l'éprouve avec un faux npm : casser l'arbre de la machine qui
// joue la suite serait un remède pire que le mal.

verifier("npm content : on ne réinstalle rien", async () => {
  const r = await arbreIncomplet(npmQuiRepond(0, "atlas-mvp@0.1.0 /workspaces/Atlas-app\n+-- next@16.3.2"));
  assert.equal(r.incomplet, false, "un arbre sain ne doit JAMAIS déclencher de réinstallation");
});

verifier("des paquets EN TROP ne sont pas des paquets manquants", async () => {
  // npm rend un code non nul dès qu'il a quoi que ce soit à signaler, y compris
  // « extraneous » — banal après un changement de branche, et sans conséquence
  // sur une construction. S'en servir coûterait plusieurs minutes de
  // réinstallation à chaque démarrage, pour rien : un garde-fou qui parle à
  // tort s'apprend à être ignoré.
  const r = await arbreIncomplet(
    npmQuiRepond(1, "atlas-mvp@0.1.0\n+-- @emnapi/core@1.10.0 extraneous\n+-- @img/sharp-wasm32@0.35.3 extraneous")
  );
  assert.equal(r.incomplet, false, "des paquets en trop feraient réinstaller un espace parfaitement sain");
});

verifier("un paquet MANQUANT est vu, et NOMMÉ", async () => {
  // Le cas exact du 3 septembre : Sentry absent, `instrumentation.ts` incapable
  // de se charger, et chaque écran en « Internal Server Error ».
  const r = await arbreIncomplet(
    npmQuiRepond(1, "atlas-mvp@0.1.0\n+-- UNMET DEPENDENCY @sentry/nextjs@^10.68.0\n+-- next@16.3.2")
  );
  assert.equal(r.incomplet, true, "un paquet déclaré et absent doit déclencher la réparation");
  assert.match(
    r.motif ?? "",
    /@sentry\/nextjs/,
    "le motif doit NOMMER ce qui manque : « quelque chose ne va pas » n'aide personne"
  );
});

verifier("npm muet : on ne conclut RIEN", async () => {
  // Une mesure impossible n'est pas un échec (`CLAUDE.md` §5). Conclure « arbre
  // cassé » parce que npm n'a pas pu répondre ferait réinstaller à tort.
  const r = await arbreIncomplet(async () => {
    throw new Error("npm introuvable");
  });
  assert.equal(r.incomplet, false, "un npm qui ne répond pas ne prouve pas que l'arbre est cassé");
});

verifier("le banc n'énumère plus les formulations des outils", () => {
  const code = BANC.split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
  assert.doesNotMatch(
    code,
    /Could not find the Next\\.js package/,
    "une phrase d'outil est encore énumérée : la quatrième formulation passera au travers comme les trois premières"
  );
  assert.match(
    code,
    /arbreIncomplet\(/,
    "le banc ne pose plus la question à npm : il est revenu à deviner d'après les messages"
  );
});

// --- 5. Le projet lui-même est-il cohérent ? -----------------------------

verifier("le dépôt épingle bien Next, sinon ce contrôle ne protège rien", () => {
  const paquet = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(
    versionEpinglee(paquet, "next"),
    "Next n'est plus épinglé à une version exacte : la comparaison ne peut plus rien voir, " +
      "et la panne du 29 août redeviendrait invisible"
  );
});

// Les cas asynchrones se terminent ICI : le verdict ne peut pas être rendu
// avant eux, sinon il compterait des échecs qui ne sont pas encore arrivés.
void (async () => {
  await Promise.all(enCours);
  console.log(
    echecs === 0
      ? "\n✅ Cohérence des dépendances : toutes les vérifications passent.\n"
      : `\n❌ ${echecs} vérification(s) en échec.\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
})();
