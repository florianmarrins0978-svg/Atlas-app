import assert from "node:assert/strict";
import { _reinitialiserEnvPourTests } from "../src/server/env";

// **Le devis du patron ne partait pas, et voici pourquoi.**
//
// Le 12 août 2026, sur la feuille d'envoi, à la place de son devis :
//
//     Stockage local sélectionné en production — configuration refusée
//
// Sa configuration était juste. `src/server/storage/index.ts` ne regardait que
// `NODE_ENV === "production"` — or **le banc d'essai sert une version BÂTIE**,
// et `next start` impose `NODE_ENV=production` sans que rien ne soit déployé.
//
// `src/server/env.ts` connaît cette distinction depuis le 10 août
// (`exigencesDeDeploiement = exigencesDeProduction && !bancDEssai`). La seconde
// barrière, elle, l'ignorait : elle se croyait redondante et était devenue plus
// stricte que la première. C'est le défaut que `CLAUDE.md` §3 nomme — « jamais
// de règle dupliquée, deux implémentations finissent toujours par diverger ».
//
// Cette suite tient les DEUX bouts, et c'est tout son intérêt : le banc doit
// pouvoir stocker, un déploiement réel ne le doit pas. Relâcher le second pour
// réparer le premier aurait fait partir des devis dont le PDF disparaît au
// redéploiement suivant — un envoi refusé vaut mieux qu'un document perdu.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/**
 * Joue un environnement donné, puis remet exactement celui d'avant.
 *
 * Les modules sont réimportés à chaque fois : `getEnv()` mémoïse, et
 * `choisi()` lit la configuration au premier usage. Sans cette remise à zéro,
 * le second cas relirait la décision du premier — et deux contrôles verts ne
 * prouveraient qu'une chose.
 */
async function avec(variables: Record<string, string | undefined>, fn: (m: typeof import("../src/server/storage")) => Promise<void> | void) {
  const avant: Record<string, string | undefined> = {};
  for (const [nom, valeur] of Object.entries(variables)) {
    avant[nom] = process.env[nom];
    if (valeur === undefined) delete process.env[nom];
    else process.env[nom] = valeur;
  }
  _reinitialiserEnvPourTests();
  try {
    const m = await import(`../src/server/storage/index?${Date.now()}${Math.round(performance.now())}`);
    await fn(m as typeof import("../src/server/storage"));
  } finally {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[nom];
      else process.env[nom] = valeur;
    }
    _reinitialiserEnvPourTests();
  }
}

/**
 * Ce que fait l'application au moment d'envoyer : elle touche au stockage.
 *
 * **Le refus de configuration est SYNCHRONE** — `choisi()` lève avant même de
 * rendre une promesse. Un fichier absent, lui, rejette la promesse. On ne
 * regarde donc que le premier, et l'on éteint proprement la seconde : une
 * promesse rejetée sans preneur fait tomber le processus, et le contrôle
 * mourrait sur un fichier qui n'a jamais eu à exister.
 */
function tenter(m: typeof import("../src/server/storage")): string | null {
  try {
    const p = m.lireObjet("devis/essai.pdf") as unknown;
    if (p && typeof (p as Promise<unknown>).catch === "function") {
      (p as Promise<unknown>).catch(() => {});
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function main() {
  console.log("=== Le stockage du banc d'essai ===\n");

  // Le cas du patron, mot pour mot : version bâtie, profil banc, stockage local.
  await avec(
    { NODE_ENV: "production", ATLAS_PROFIL: "banc", STORAGE_PROVIDER: undefined },
    (m) => {
      const refus = tenter(m);
      test("sur le banc, une version bâtie peut stocker en local", () => {
        assert.ok(
          !refus?.includes("configuration refusée"),
          `Le banc refuse de stocker : « ${refus} ». C'est le défaut du 12 août — le devis du patron ne partait pas.`
        );
      });
    }
  );

  // **Et l'autre bout, qui ne se relâche pas.** La configuration est ici
  // valide de bout en bout — fournisseurs d'IA et clés posés — pour que le
  // SEUL manque soit le stockage. Sans cette précaution, le refus viendrait
  // d'ailleurs (« LLM_PROVIDER vaut dev en production ») et l'on croirait
  // éprouver le stockage en éprouvant autre chose : un contrôle vert qui ne
  // regarde pas ce qu'il annonce.
  await avec(
    {
      NODE_ENV: "production",
      ATLAS_PROFIL: undefined,
      STORAGE_PROVIDER: undefined,
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-essai-jamais-appelee",
      TRANSCRIPTION_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-essai-jamais-appelee",
    },
    (m) => {
      const refus = tenter(m);
      test("un déploiement réel refuse toujours le stockage local", () => {
        assert.ok(
          refus && /STORAGE_PROVIDER|configuration refusée/.test(refus),
          `Le stockage local passe en production (refus lu : « ${refus ?? "aucun"} »). Un devis envoyé perdrait son PDF au redéploiement suivant.`
        );
      });
    }
  );

  await avec(
    { NODE_ENV: "development", ATLAS_PROFIL: undefined, STORAGE_PROVIDER: undefined },
    (m) => {
      test("en développement, rien ne s'y oppose", () => {
        assert.equal(tenter(m)?.includes("configuration refusée") ?? false, false);
      });
    }
  );

  console.log(`\n${failed === 0 ? "✅" : "❌"} Stockage du banc — ${failed} échec(s).`);
  if (failed > 0) process.exit(1);
  void passed;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
