// À quel hôte Atlas fait-il confiance — et l'écart qui a vécu deux semaines.
//
// **CE QUE CETTE SUITE PROTÈGE.** Audit du 23 août 2026, constat M7.
// `src/auth.config.ts` calculait `trustHost` avec soin et son commentaire
// promettait que « une vraie mise en production retrouve le refus entier ».
// `src/auth.ts` écrasait la valeur trois lignes plus bas par un
// `trustHost: true` inconditionnel. En production, Atlas faisait donc confiance
// à l'hôte annoncé — pendant que le dépôt affirmait le contraire.
//
// Deux moitiés ici, et il faut les deux :
//
//   1. la RÈGLE rend ce qu'elle doit rendre ;
//   2. **plus personne ne l'écrase** — c'est le dernier contrôle, et c'est
//      celui qui rougirait sur l'ancien code.
//
// Éprouvée sans serveur : ce sont des règles pures.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faireConfianceALHote } from "../src/lib/confiance-hote";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== La confiance dans l'hôte annoncé ===\n");

essai("hors production : oui — c'est un serveur de développement", () => {
  for (const nodeEnv of ["development", "test", undefined]) {
    assert.equal(
      faireConfianceALHote({ nodeEnv, bancDEssai: false, authTrustHost: undefined }),
      true,
      `refusé en « ${nodeEnv} »`
    );
  }
});

// Sans cela, le banc d'essai ne laisse plus entrer personne : il sert une
// version BÂTIE derrière un mandataire, et Auth.js répond « UntrustedHost ».
// C'est la journée perdue du 9 août 2026.
essai("banc d'essai déclaré : oui, même en production bâtie", () => {
  assert.equal(faireConfianceALHote({ nodeEnv: "production", bancDEssai: true, authTrustHost: undefined }), true);
});

essai("PRODUCTION RÉELLE : non par défaut — c'est le défaut qui manquait", () => {
  assert.equal(faireConfianceALHote({ nodeEnv: "production", bancDEssai: false, authTrustHost: undefined }), false);
  assert.equal(faireConfianceALHote({ nodeEnv: "production", bancDEssai: false, authTrustHost: "" }), false);
  assert.equal(faireConfianceALHote({ nodeEnv: "production", bancDEssai: false, authTrustHost: "non" }), false);
  assert.equal(faireConfianceALHote({ nodeEnv: "production", bancDEssai: false, authTrustHost: "0" }), false);
});

essai("production + déclaration explicite : oui — la décision se prend", () => {
  for (const valeur of ["1", "true", "TRUE", " oui ", "True"]) {
    assert.equal(
      faireConfianceALHote({ nodeEnv: "production", bancDEssai: false, authTrustHost: valeur }),
      true,
      `« ${valeur} » n'a pas été compris comme un oui`
    );
  }
});

// ─── La moitié qui rougirait sur l'ancien code ──────────────────────────────
//
// **Une règle juste qu'on écrase ne protège rien.** C'était exactement le
// défaut : la valeur était calculée, puis remplacée. Ce contrôle relit les
// fichiers réels — c'est le seul moyen d'attraper une seconde définition.

/**
 * Le code d'un fichier, ses commentaires retirés.
 *
 * **Indispensable ici, et le premier jet s'y est fait prendre :** les deux
 * fichiers RACONTENT le défaut dans leurs commentaires — « `trustHost: true`,
 * sans condition » — pour qu'on ne le refasse pas. Chercher cette chaîne dans
 * le fichier entier fait donc rougir le contrôle sur la documentation qui
 * l'explique. Ce qu'on cherche est une affectation réelle.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

essai("src/auth.ts ne pose PLUS de trustHost — la règle ne se contredit plus", () => {
  assert.ok(
    !/trustHost\s*:/.test(codeSeul("src/auth.ts")),
    "src/auth.ts pose à nouveau trustHost : la valeur d'auth.config.ts serait écrasée"
  );
});

essai("la règle est appelée une seule fois, depuis auth.config.ts", () => {
  const config = codeSeul("src/auth.config.ts");
  assert.match(config, /faireConfianceALHote\(/, "auth.config.ts n'utilise plus la règle commune");
  assert.ok(
    !/trustHost:\s*(true|false)\b/.test(config),
    "auth.config.ts fige trustHost au lieu d'appeler la règle"
  );
});

console.log("");
console.log(`La confiance dans l'hôte — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
