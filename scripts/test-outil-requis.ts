import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CODE_NON_MESURABLE,
  MECANISMES_POSIX,
  mecanismeManquant,
  outilManquant,
  outilRepond,
  raisonDuSilence,
  raisonDuSilenceSysteme,
  type MecanismePosix,
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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LE SYSTÈME QUI MANQUE — mesuré sur son PC le 20 septembre 2026.
 *
 * `bash` et `gh` y répondent ; six suites tombaient quand même, sur des groupes
 * de processus, des scripts `#!/bin/sh` et un `PATH` séparé par `:` — trois
 * choses que Windows n'a pas. Même règle que pour un outil : déclaré, nommé,
 * et interrogé sur la MACHINE (`exigerUnSystemePosix`).
 */
console.log("\n=== Le système qui manque se dit, lui aussi ===\n");

cas("sur Linux, aucun mécanisme POSIX ne manque — rien ne se tait", () => {
  assert.equal(mecanismeManquant(["groupes de processus"], "linux"), null);
  assert.equal(mecanismeManquant(["groupes de processus", "PATH séparé par « : »"], "darwin"), null);
});

cas("sur win32, le PREMIER mécanisme déclaré est nommé — le contrôle vu rouge", () => {
  assert.equal(
    mecanismeManquant(["scripts exécutables par leur première ligne", "groupes de processus"], "win32"),
    "scripts exécutables par leur première ligne"
  );
  assert.match(raisonDuSilenceSysteme("groupes de processus", "win32"), /groupes de processus.*win32/);
});

cas("un mécanisme INCONNU est refusé — le silence ne s'invente pas", () => {
  assert.throws(
    () => mecanismeManquant(["le vent" as MecanismePosix], "linux"),
    /n'est pas un mécanisme connu/
  );
});

cas("un mécanisme déclaré laisse sa trace dans le code de la suite", () => {
  // La même garde que pour un outil : déclarer « groupes de processus » sans
  // jamais faire `process.kill(-pid)` serait une exemption déguisée.
  const fautes: string[] = [];
  for (const f of readdirSync("scripts")) {
    if (!/^test-.*\.(ts|mts)$/.test(f)) continue;
    if (f === path.basename(__filename ?? "")) continue;
    const texte = readFileSync(path.join("scripts", f), "utf8");
    for (const m of texte.matchAll(/exigerUnSystemePosix\(([^)]*)\)/g)) {
      for (const n of m[1].matchAll(/"([^"]+)"/g)) {
        const mecanisme = n[1] as MecanismePosix;
        const trace = MECANISMES_POSIX[mecanisme];
        if (!trace) {
          fautes.push(`${f} déclare « ${mecanisme} », qui n'existe pas`);
          continue;
        }
        if (!trace.test(texte)) fautes.push(`${f} déclare « ${mecanisme} » sans jamais l'employer`);
      }
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n      "));
});

cas("une suite qui tue un groupe de processus le DÉCLARE — sinon Windows garde un orphelin", () => {
  // L'autre sens de la garde précédente, et il a un prix concret : pendant la
  // mesure du 20 septembre 2026, chaque suite de cette espèce jouée sans
  // déclaration a laissé sur son PC un veilleur d'essai que `process.kill(-pid)`
  // n'avait pas tué, à publier dans un dossier temporaire toutes les deux
  // secondes. On ne lit que le code : un commentaire qui cite le geste ne
  // lance rien.
  const estCommentaire = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
  const fautes: string[] = [];
  for (const f of readdirSync("scripts")) {
    if (!/^test-.*\.(ts|mts)$/.test(f)) continue;
    if (f === path.basename(__filename ?? "")) continue;
    const code = readFileSync(path.join("scripts", f), "utf8").split("\n").filter((l) => !estCommentaire(l)).join("\n");
    if (!MECANISMES_POSIX["groupes de processus"].test(code)) continue;
    if (!/exigerUnSystemePosix\([^)]*"groupes de processus"/.test(code)) {
      fautes.push(`${f} fait process.kill(-pid) sans déclarer « groupes de processus »`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n      "));
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} L'outil qui manque se dit — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
