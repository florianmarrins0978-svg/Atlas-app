import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * UN GESTE QUI S'ÉTEINT DOIT SE RALLUMER — même quand ça rate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa panne du 13 septembre 2026 :** *« j'ai fait une dictée, ça n'a pas
 * fonctionné, et impossible de recommencer »*, sous un message qui disait
 * « Réessayez ».
 *
 * `DevisDepuisDictee.valider()` posait son drapeau à l'entrée — `setEnvoi(true)`,
 * qui éteint le bouton — et ne le rendait que sur le chemin qui réussit. Un
 * appel qui tombe laissait donc l'écran **éteint pour toujours** : l'unique
 * geste de la page invitait à refaire ce qu'il empêchait. Il ne restait qu'à
 * recharger, ce que personne ne devine.
 *
 * **Ce n'est pas un oubli isolé, c'est une forme.** Elle revient partout où un
 * écran attend le serveur : poser le drapeau, appeler, le rendre — et oublier
 * qu'entre les deux, ça peut refuser. D'où ce contrôle, qui lit les écrans et
 * refuse la forme, pas le cas.
 *
 * **La règle : le drapeau se rend sur TOUS les chemins.** Un `finally` est le
 * plus sûr — ni un refus, ni une exception, ni un retour anticipé ne le
 * contourne — mais le rendre dans le `catch` suffit quand le succès quitte
 * l'écran. Ce qui est refusé, c'est de ne le rendre nulle part.
 *
 * Ni base, ni réseau, ni navigateur.
 */

const ECRANS = path.join(__dirname, "..", "src", "app");
const COMPOSANTS = path.join(__dirname, "..", "src", "components");

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

function fichiers(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) trouves.push(...fichiers(complet));
    else if (entree.endsWith(".tsx")) trouves.push(complet);
  }
  return trouves;
}

/**
 * Les drapeaux posés avant un `await` et rendus hors d'un `finally`.
 *
 * **L'heuristique est volontairement étroite**, parce qu'un contrôle qui parle
 * à tort s'apprend à être ignoré (`CLAUDE.md` §1 bis) : on ne retient que le
 * cas où le même drapeau est posé à `true` juste avant un `try`, et **rendu
 * nulle part** dans ce qui suit — ni en `finally`, ni dans le `catch`.
 *
 * Sa première version exigeait le `finally` : elle accusait
 * `InformationsClient`, qui rend pourtant son bouton dans son `catch` et
 * quitte l'écran quand ça passe. Un contrôle juste sur la forme et faux sur le
 * fond aurait fait corriger du code sain — et appris à l'ignorer.
 *
 * Les autres façons de se bloquer restent au jugement, en lisant.
 */
export function gestesQuiPeuventResterEteints(source: string): string[] {
  const coupables: string[] = [];
  // `setQuelqueChose(true);` puis, dans les lignes qui suivent, un `try {`.
  for (const m of source.matchAll(/(set[A-ZÉÈ][\w]*)\(true\);\s*\n\s*try\s*\{/g)) {
    const drapeau = m[1];
    const depuis = m.index ?? 0;
    // Le corps du `try`, borné par la fonction suivante — assez pour voir s'il
    // porte un `finally`, sans prétendre analyser le langage.
    const bloc = source.slice(depuis, depuis + 4000);
    const finBloc = bloc.search(/\n\s{0,4}(async )?function |\n\}\n/);
    const corps = finBloc > 0 ? bloc.slice(0, finBloc) : bloc;
    // Rendu quelque part — `finally`, `catch`, ou sur le chemin d'erreur : le
    // geste revient. Rendu nulle part : l'écran reste éteint.
    if (!corps.includes(`${drapeau}(false)`)) coupables.push(drapeau);
  }
  return coupables;
}

console.log("=== Un geste qui s'éteint doit se rallumer, même quand ça rate ===\n");

const lus = [...fichiers(ECRANS), ...fichiers(COMPOSANTS)];

cas("il y a bien des écrans à lire — sinon ce contrôle ne mesure rien", () => {
  assert.ok(lus.length > 50, `seulement ${lus.length} écran(s) lus`);
});

cas("l'heuristique reconnaît la forme qui a coûté sa soirée", () => {
  // **Un contrôle doit savoir échouer** (`AGENTS.md`) : on lui montre le code
  // d'avant, et il doit le nommer.
  const avant = `
    async function valider() {
      setEnvoi(true);
      try {
        await action();
      } catch {
        onEchec("raté");
      }
    }
  `;
  assert.deepEqual(gestesQuiPeuventResterEteints(avant), ["setEnvoi"]);

  const parFinally = avant.replace(
    'onEchec("raté");\n      }',
    'onEchec("raté");\n      } finally {\n        setEnvoi(false);\n      }'
  );
  assert.deepEqual(gestesQuiPeuventResterEteints(parFinally), []);

  // Rendu dans le `catch` : le geste revient aussi, et c'est ce que fait
  // `InformationsClient` — accuser celui-là ferait corriger du code sain.
  const parLeCatch = avant.replace('onEchec("raté");', 'setEnvoi(false);');
  assert.deepEqual(gestesQuiPeuventResterEteints(parLeCatch), []);
});

cas("aucun écran ne peut rester éteint après un refus", () => {
  const coupables: string[] = [];
  for (const fichier of lus) {
    for (const drapeau of gestesQuiPeuventResterEteints(readFileSync(fichier, "utf8"))) {
      coupables.push(`${path.relative(path.join(__dirname, ".."), fichier)} → ${drapeau}`);
    }
  }
  assert.deepEqual(
    coupables,
    [],
    "un geste s'éteint sans être rendu : après un refus, l'écran invite à " +
      "réessayer et l'en empêche —\n      " +
      coupables.join("\n      ")
  );
});

console.log(echecs === 0 ? "\n✅ Aucun geste ne peut rester éteint." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
