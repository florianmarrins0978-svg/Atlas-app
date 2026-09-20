import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CODE_NON_MESURABLE,
  outilManquant,
  outilRepond,
  raisonDuSilence,
} from "./_outil-requis";
import { bilanDuJournal, phraseDeCompte } from "./_bilan-suites.mjs";

/**
 * UNE SUITE QUI NE PEUT PAS MESURER SE TAIT — et ce silence se prouve.
 *
 * **Sa colère du 20 septembre 2026**, deux jours après la première alerte :
 * dix-neuf suites d'outillage rouges sur son PC Windows, ~30 min de
 * comparaison par lot, et une modif bloquée deux jours.
 *
 * **Ce que cette suite défend, et qui compte plus que le mécanisme :** que le
 * silence reste RARE et NOMMÉ. Un « non mesurable » facile à obtenir devient
 * la liste d'exemptions qu'on a refusée, écrite autrement — et l'on perdrait
 * la protection sans s'en apercevoir.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Ce qu'on ne peut pas mesurer ici se dit, sans rougir ===\n");

cas("un outil présent ne fait rien taire — le cas de toutes les machines Linux", () => {
  assert.equal(outilManquant(["node"]), null);
});

cas("un outil absent est NOMMÉ, et c'est le premier qui manque", () => {
  assert.equal(outilManquant(["node", "ceci-nexiste-pas-du-tout"]), "ceci-nexiste-pas-du-tout");
});

cas("ENOENT seul dit l'absence — un outil qui répond en erreur EXISTE", () => {
  // `gh --version` rend un code non nul quand il n'est pas connecté : il est
  // pourtant là. Lire le code de retour ferait taire des suites qui peuvent
  // parfaitement mesurer — le silence deviendrait la règle.
  assert.equal(outilRepond("git", () => ({ })), true, "aucune erreur : l'outil est là");
  assert.equal(
    outilRepond("git", () => ({ error: Object.assign(new Error("boum"), { code: "EACCES" }) })),
    true,
    "une erreur qui n'est pas ENOENT ne prouve aucune absence"
  );
  assert.equal(
    outilRepond("git", () => ({ error: Object.assign(new Error("x"), { code: "ENOENT" }) })),
    false
  );
});

cas("la raison nomme l'outil, pour qu'elle cesse d'être vraie un jour", () => {
  assert.match(raisonDuSilence("bash"), /« bash »/);
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CONTRÔLE VU ROUGE : une vraie suite, sur une machine à qui l'on retire
 * l'outil. Sans ce cas, on ne saurait que le mécanisme se DÉCLARE — jamais
 * qu'il fonctionne de bout en bout, du `process.exit` au bilan relu.
 */
cas("une suite privée de son outil se tait, sort du compte, et n'est pas un rouge", () => {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-muette-"));
  const suite = path.join(dossier, "test-faussaire.ts");
  writeFileSync(
    suite,
    `import { exigerLesOutils } from ${JSON.stringify(path.resolve("scripts/_outil-requis.ts"))};\n` +
      `exigerLesOutils("ceci-nexiste-pas-du-tout");\n` +
      `console.log("  ✓ ceci ne doit JAMAIS s'écrire");\n`
  );
  const r = spawnSync(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), suite], {
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, CODE_NON_MESURABLE, `code rendu : ${r.status}\n${r.stderr}`);
  assert.doesNotMatch(r.stdout, /JAMAIS/, "le corps de la suite a tourné quand même");

  // Relu par le bilan, comme le fera la batterie : ni vert, ni rouge.
  const journal = `${r.stdout}\n${phraseDeCompte(0, 1, 1)}`;
  assert.deepEqual(bilanDuJournal(journal), {
    rouges: [],
    nonMesurables: ["test-faussaire.ts"],
    complet: true,
  });
});

cas("la même suite, avec son outil présent, mesure comme avant", () => {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-parlante-"));
  const suite = path.join(dossier, "test-honnete.ts");
  writeFileSync(
    suite,
    `import { exigerLesOutils } from ${JSON.stringify(path.resolve("scripts/_outil-requis.ts"))};\n` +
      `exigerLesOutils("node");\n` +
      `console.log("  ✓ mesuré");\n`
  );
  const r = spawnSync(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), suite], {
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /mesuré/);
});

/**
 * **LE SILENCE DOIT RESTER RARE — et c'est ce cas-ci qui le tient.**
 *
 * La tentation, en découvrant le mécanisme, est de déclarer un outil « au cas
 * où » : la suite se tait alors sur une machine où elle POUVAIT mesurer, et
 * l'exemption a commencé — la liste qu'on a refusée, écrite autrement.
 *
 * **La question se pose au FICHIER, pas à la machine.** Une première version
 * vérifiait qu'aucune suite ne se tait ici : ce poste n'a pas `gh`, donc elle
 * rougissait sur un silence parfaitement justifié — et elle n'aurait rien dit
 * d'une sur-déclaration sur une machine qui a tout. Un outil déclaré doit être
 * un outil APPELÉ : cela se lit partout, et c'est la seule sur-déclaration
 * possible.
 */
cas("un outil déclaré est un outil que la suite appelle vraiment", () => {
  const fautes: string[] = [];
  for (const f of readdirSync("scripts")) {
    if (!/^test-.*\.(ts|mts)$/.test(f)) continue;
    if (f === path.basename(__filename ?? "")) continue;
    const texte = readFileSync(path.join("scripts", f), "utf8");
    for (const m of texte.matchAll(/exigerLesOutils\(([^)]*)\)/g)) {
      for (const n of m[1].matchAll(/"([^"]+)"/g)) {
        const outil = n[1];
        // Toutes les mentions de l'outil, moins celle de la déclaration
        // elle-même : il doit en rester au moins une, sinon il n'est pas appelé.
        const mentions = [...texte.matchAll(new RegExp(`"${outil}"`, "g"))].length;
        if (mentions <= 1) fautes.push(`${f} déclare « ${outil} » sans jamais l'appeler`);
      }
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n      "));
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} L'outil qui manque se dit — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
