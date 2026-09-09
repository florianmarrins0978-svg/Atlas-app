import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * LE VERROU DE LA BATTERIE, CONFRONTÉ AUX DEUX ÉTATS QU'IL DOIT DISTINGUER.
 *
 * **Un contrôle qui n'a jamais échoué ne prouve rien** (`AGENTS.md`). Celui-ci
 * montre donc autant de gestes à REFUSER que de gestes à LAISSER PASSER, et il
 * joue le déclencheur avec son vrai contrat — le JSON de `PreToolUse` sur
 * l'entrée standard, la décision sur la sortie.
 *
 * **Ce qu'il défend, et qui n'est pas un détail d'outillage :** trois verdicts
 * de dix minutes ont été jetés le 9 septembre 2026 parce qu'une session voisine
 * écrivait pendant la mesure. Le patron l'a dit en majuscules — *« JE NE VEUX
 * PLUS DE PROBLÈME SUR LA BATTERIE »*.
 */

const RACINE = path.resolve(import.meta.dirname, "..");
const VERROU = path.join(RACINE, ".atlas-batterie-en-cours.json");
const GARDE = path.join(RACINE, "scripts", "garde-batterie.mjs");

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/** Le déclencheur, joué comme Claude le joue : du JSON entre, du JSON sort. */
function demander(outil: string, entree: Record<string, unknown>): { refuse: boolean; raison: string } {
  const sortie = execFileSync("node", [GARDE], {
    input: JSON.stringify({ tool_name: outil, tool_input: entree }),
    encoding: "utf8",
  });
  const rep = JSON.parse(sortie || "{}");
  const d = rep?.hookSpecificOutput;
  return { refuse: d?.permissionDecision === "deny", raison: d?.permissionDecisionReason ?? "" };
}

/** Un verrou posé à la main, avec le signe de vie qu'on veut lui donner. */
function poserVerrou(ageDuSigneMs = 0) {
  writeFileSync(
    VERROU,
    JSON.stringify({
      // Notre propre processus : il est vivant, par construction.
      pid: process.pid,
      quoi: "batterie d'essai",
      debut: Date.now() - 120_000,
      dernierSigne: Date.now() - ageDuSigneMs,
    }),
    "utf8"
  );
}

const sauvegarde = existsSync(VERROU) ? readFileSync(VERROU, "utf8") : null;
function rendre() {
  if (existsSync(VERROU)) unlinkSync(VERROU);
  if (sauvegarde !== null) writeFileSync(VERROU, sauvegarde, "utf8");
}

try {
  // ─── 1. SANS VERROU, RIEN NE CHANGE ──────────────────────────────────────
  if (existsSync(VERROU)) unlinkSync(VERROU);
  test("sans batterie en cours, écrire un fichier passe", () => {
    assert.equal(demander("Write", { file_path: "src/x.ts", content: "x" }).refuse, false);
  });
  test("sans batterie en cours, un commit passe", () => {
    assert.equal(demander("Bash", { command: "git commit -m 'x'" }).refuse, false);
  });

  // ─── 2. AVEC UN VERROU FRAIS, CE QUI ÉCRIT EST REFUSÉ ────────────────────
  poserVerrou(0);
  test("pendant une batterie, écrire un fichier est REFUSÉ", () => {
    const r = demander("Write", { file_path: "src/x.ts", content: "x" });
    assert.ok(r.refuse, "le garde a laissé écrire pendant une mesure");
    assert.match(r.raison, /batterie tourne/, "le refus n'explique pas pourquoi");
  });
  test("pendant une batterie, modifier un fichier est REFUSÉ", () => {
    assert.ok(demander("Edit", { file_path: "src/x.ts", old_string: "a", new_string: "b" }).refuse);
  });
  for (const commande of [
    "git commit -m 'x'",
    "git checkout -- src/x.ts",
    "git merge origin/main",
    "git -C . add .",
    "npm install",
    "rm -rf artifacts",
    "sed -i 's/a/b/' src/x.ts",
    "echo x > src/x.ts",
    "Set-Content -Path src/x.ts -Value x",
  ]) {
    test(`pendant une batterie, « ${commande} » est REFUSÉ`, () => {
      assert.ok(demander("Bash", { command: commande }).refuse, "geste d'écriture laissé passer");
    });
  }

  // ─── 3. …ET CE QUI LIT PASSE ─────────────────────────────────────────────
  //
  // **C'est la moitié qui rend le verrou tenable.** Pendant dix minutes, la
  // seule chose utile est de LIRE — le journal, l'avancement. Un verrou qui
  // interdirait cela se ferait contourner dès le deuxième jour.
  for (const commande of [
    "git status --porcelain",
    "git log --oneline -5",
    "git diff --stat",
    "cat scripts/verrou-batterie.mjs",
    "grep -n batterie scripts/verrou-batterie.mjs",
    "npx tsc --noEmit",
    "curl -s -o /dev/null -w '%{http_code}' https://exemple.test",
    "node -e \"console.log(1)\" 2>&1",
  ]) {
    test(`pendant une batterie, « ${commande} » passe`, () => {
      assert.equal(demander("Bash", { command: commande }).refuse, false, "lecture refusée à tort");
    });
  }
  test("pendant une batterie, écrire dans le dossier de travail temporaire passe", () => {
    assert.equal(demander("Bash", { command: "echo x > /tmp/atlas/essai.log" }).refuse, false);
  });
  test("le verrou peut TOUJOURS se rendre, sans quoi un dossier gelé le resterait", () => {
    assert.equal(
      demander("Bash", { command: "node scripts/verrou-batterie.mjs rendre --force" }).refuse,
      false
    );
  });

  // ─── 4. UN VERROU MUET NE VAUT PLUS RIEN ─────────────────────────────────
  //
  // Une batterie tuée — c'est arrivé trois fois le 9 septembre — laisserait
  // sinon le dossier gelé jusqu'au lendemain.
  poserVerrou(200_000);
  test("un verrou sans signe de vie depuis trois minutes ne bloque plus", () => {
    assert.equal(demander("Write", { file_path: "src/x.ts", content: "x" }).refuse, false);
  });

  // ─── 5. UN VERROU DONT LE PROCESSUS EST MORT NON PLUS ────────────────────
  writeFileSync(
    VERROU,
    JSON.stringify({ pid: 2_147_483_600, quoi: "batterie morte", debut: Date.now(), dernierSigne: Date.now() }),
    "utf8"
  );
  test("un verrou dont le processus a disparu ne bloque plus", () => {
    assert.equal(demander("Write", { file_path: "src/x.ts", content: "x" }).refuse, false);
  });

  // ─── 6. ET UN FICHIER ABÎMÉ NE GÈLE PAS LE DOSSIER ───────────────────────
  writeFileSync(VERROU, "{ ceci n'est pas du JSON", "utf8");
  test("un verrou illisible ne bloque pas : le doute profite au travail", () => {
    assert.equal(demander("Write", { file_path: "src/x.ts", content: "x" }).refuse, false);
  });
} finally {
  rendre();
}

console.log(`\n${failed === 0 ? "✅" : "❌"} Le verrou de la batterie — ${passed} réussi(s), ${failed} échec(s).`);
process.exit(failed === 0 ? 0 : 1);
