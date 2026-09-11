import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decider, commandeQuiTouche, FICHIER } from "./garde-regles-du-patron.mjs";

/**
 * LE GARDE-FOU DES RÈGLES DU PATRON SAIT REFUSER — ET SAIT LAISSER PASSER.
 *
 * Un garde-fou qui parle à tort s'apprend à être ignoré (`CLAUDE.md` §1 bis) :
 * autant de gestes à laisser passer qu'à refuser, et le déclencheur joué avec
 * son vrai contrat (JSON sur l'entrée standard), pas seulement sa fonction.
 *
 * Et la suite qu'il protège doit exister et porter son repère d'ajout : sans
 * lui, plus aucune règle ne pourrait s'ajouter, et le garde-fou aurait fermé la
 * porte qu'il devait seulement surveiller.
 */

const GARDE = path.join(import.meta.dirname, "garde-regles-du-patron.mjs");
const CHEMIN = `scripts/${FICHIER}`;

let passed = 0;
let failed = 0;
function test(nom: string, corps: () => void) {
  try {
    corps();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n=== Le garde-fou des règles du patron ===\n");

// ─── Ce qui doit être REFUSÉ ───────────────────────────────────────────────
const A_REFUSER: [string, Record<string, unknown>, string][] = [
  ["Write", { file_path: CHEMIN, content: "" }, "écraser la suite entière"],
  ["Write", { file_path: `C:\\Users\\x\\atlas-app\\${CHEMIN.replace("/", "\\")}`, content: "" }, "l'écraser par un chemin Windows absolu"],
  ["Edit", { file_path: CHEMIN, old_string: `regle("18 août 2026", "…", () => {`, new_string: "" }, "toucher l'en-tête d'une règle"],
  ["Edit", { file_path: CHEMIN, old_string: `exige(z.points.length === 7, "…");`, new_string: `exige(z.points.length === 12, "…");` }, "changer un chiffre attendu — le geste exact du 24 août"],
  ["MultiEdit", { file_path: CHEMIN, edits: [{ old_string: "console.log", new_string: "console.log" }, { old_string: "exige(a", new_string: "" }] }, "une édition multiple dont l'une touche une règle"],
  ["Edit", { file_path: CHEMIN, old_string: "// ── LA PROCHAINE RÈGLE S'AJOUTE ICI, sous ce repère — jamais au-dessus ──────", new_string: "" }, "retirer le repère d'ajout"],
  ["Bash", { command: `sed -i 's/=== 7/=== 12/' ${CHEMIN}` }, "corriger le chiffre par sed"],
  ["Bash", { command: `echo '' > ${CHEMIN}` }, "vider le fichier par redirection"],
  ["Bash", { command: `rm ${CHEMIN}` }, "le supprimer"],
  ["Bash", { command: `git checkout HEAD~3 -- ${CHEMIN}` }, "le remettre à une version d'avant"],
  ["Bash", { command: `git restore ${CHEMIN}` }, "idem, par restore"],
  ["Bash", { command: `git rm ${CHEMIN}` }, "le retirer du dépôt"],
  ["PowerShell", { command: `Set-Content ${CHEMIN} ''` }, "l'écraser depuis PowerShell"],
];

// ─── Ce qui doit PASSER ────────────────────────────────────────────────────
const A_LAISSER: [string, Record<string, unknown>, string][] = [
  ["Edit", { file_path: CHEMIN, old_string: "// ── LA PROCHAINE RÈGLE S'AJOUTE ICI, sous ce repère — jamais au-dessus ──────", new_string: `regle("12 septembre 2026", "…", () => {});\n\n// ── LA PROCHAINE RÈGLE S'AJOUTE ICI, sous ce repère — jamais au-dessus ──────` }, "ajouter une règle sous le repère"],
  ["Edit", { file_path: CHEMIN, old_string: "console.log(`\\n=== Les règles", new_string: "console.log(`\\n=== Les règles" }, "toucher une ligne qui n'est pas une règle"],
  ["Write", { file_path: "scripts/test-regles-du-patron-voisin.ts", content: "" }, "écrire un AUTRE fichier au nom proche"],
  ["Write", { file_path: "src/lib/arrosage/pieces.ts", content: "" }, "écrire n'importe quel autre fichier"],
  ["Edit", { file_path: "scripts/test-arrosage-calcul.ts", old_string: "exige(", new_string: "exige(" }, "éditer une autre suite, même avec le mot exige("],
  ["Bash", { command: `cat ${CHEMIN}` }, "lire la suite"],
  ["Bash", { command: `npx tsx ${CHEMIN}` }, "la jouer"],
  ["Bash", { command: `git diff ${CHEMIN}` }, "regarder ce qui a changé"],
  ["Bash", { command: `grep -n regle ${CHEMIN}` }, "y chercher"],
  ["Bash", { command: `git add ${CHEMIN} && git commit -m "Ajouter une règle du patron"` }, "l'enregistrer"],
  ["Bash", { command: `sed -i 's/a/b/' scripts/test-arrosage-calcul.ts` }, "un sed sur un autre fichier"],
  ["Bash", { command: `git commit -m "on ne fait jamais sed -i sur test-regles-du-patron.ts"` }, "le nom du fichier dans un message de commit"],
  ["Bash", { command: `sed -i '5562s/§327/§333/' TODO.md && npx tsx scripts/${FICHIER}` }, "un sed sur un AUTRE fichier, puis jouer la suite — refusé à tort le 11 septembre"],
  ["Bash", { command: `rm -f scripts/_tmp.ts; npx tsx scripts/${FICHIER}` }, "un rm ailleurs, puis jouer la suite"],
];

for (const [outil, entree, quoi] of A_REFUSER) {
  test(`refuse : ${quoi}`, () => {
    assert.notEqual(decider(outil, entree), null, "laissé passer");
  });
}
for (const [outil, entree, quoi] of A_LAISSER) {
  test(`laisse : ${quoi}`, () => {
    assert.equal(decider(outil, entree), null, `refusé à tort : ${decider(outil, entree)}`);
  });
}

test("le message de commit n'est pas pris pour un geste", () => {
  assert.equal(commandeQuiTouche(`git commit -m "sed -i sur ${FICHIER}, jamais"`), false);
});

// ─── Le vrai contrat : JSON sur l'entrée standard ──────────────────────────
function declencheur(outil: string, entree: Record<string, unknown>) {
  const sortie = execFileSync("node", [GARDE], {
    input: JSON.stringify({ tool_name: outil, tool_input: entree }),
    encoding: "utf8",
  });
  const lu = JSON.parse(sortie) as { hookSpecificOutput?: { permissionDecision?: string } };
  return lu.hookSpecificOutput?.permissionDecision === "deny";
}
test("le déclencheur refuse pour de bon un Write sur la suite", () => {
  assert.equal(declencheur("Write", { file_path: CHEMIN, content: "" }), true);
});
test("et laisse passer pour de bon un Write ailleurs", () => {
  assert.equal(declencheur("Write", { file_path: "TODO.md", content: "" }), false);
});
test("une entrée illisible ne bloque personne", () => {
  const sortie = execFileSync("node", [GARDE], { input: "{pas du json", encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  assert.equal(sortie, "{}");
});

// ─── La suite protégée existe, et sa porte d'ajout est ouverte ─────────────
test("la suite des règles porte son repère d'ajout", () => {
  const texte = readFileSync(path.join(import.meta.dirname, FICHIER), "utf8");
  assert.ok(texte.includes("LA PROCHAINE RÈGLE S'AJOUTE ICI"), "le repère a disparu : plus aucune règle ne peut s'ajouter");
  assert.ok((texte.match(/^regle\(/gm) ?? []).length >= 10, "la suite ne porte plus ses règles");
});

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
