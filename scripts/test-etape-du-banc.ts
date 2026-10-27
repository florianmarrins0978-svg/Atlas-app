import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ETAPES, lireEtape, noterEtape } from "./etape-du-banc.mjs";

// **27 octobre 2026 : « Serveur : ABSENT », toute une journée, sans dire où.**
// La fiche ne publie pas le journal (dépôt public). Le banc note donc son étape,
// dans une liste fermée, et la fiche la dit.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const dossier = mkdtempSync(path.join(tmpdir(), "atlas-etape-"));
const chemin = path.join(dossier, "etape.json");
const RACINE = path.join(__dirname, "..");

cas("une étape notée se relit, avec son âge", () => {
  noterEtape("clé de l'espace", { chemin, maintenant: 0 });
  assert.deepEqual(lireEtape({ chemin, maintenant: 12 * 60_000 }), { etape: "clé de l'espace", minutes: 12 });
});

cas("un mot hors de la liste ne s'écrit pas, et ne se relit pas", () => {
  assert.throws(() => noterEtape("AUTH_SECRET=abc", { chemin }));
  writeFileSync(chemin, JSON.stringify({ etape: "AUTH_SECRET=abc", depuis: 0 }));
  assert.equal(lireEtape({ chemin }), null, "un mot inventé partirait sur la fiche publique");
});

cas("un fichier absent ou illisible ne fait rien affirmer", () => {
  rmSync(chemin, { force: true });
  assert.equal(lireEtape({ chemin }), null);
  writeFileSync(chemin, "{pas du json");
  assert.equal(lireEtape({ chemin }), null);
});

cas("le banc note chaque étape AVANT de s'y engager", () => {
  const banc = readFileSync(path.join(RACINE, "scripts", "banc.mjs"), "utf8");
  const ordre = (a: string, b: string) => {
    const ia = banc.indexOf(a);
    const ib = banc.indexOf(b);
    assert.ok(ia >= 0 && ib >= 0 && ia < ib, `« ${a} » doit précéder « ${b} »`);
  };
  ordre('noterEtape("dépendances")', "await reinstallerSiDesaccordees()");
  ordre(`noterEtape("clé de l'espace")`, '"scripts/secret-de-l-espace.ts"');
  ordre("let serveur = modeDeveloppement", 'noterEtape("serveur lancé")');
  for (const etape of ETAPES) assert.ok(banc.includes(`noterEtape(${JSON.stringify(etape)})`) || banc.includes(`noterEtape("${etape}")`), `étape jamais notée : ${etape}`);
});

cas("la fiche dit l'étape du banc", () => {
  noterEtape("clé de l'espace", { chemin, maintenant: Date.now() - 7 * 60_000 });
  // Le diagnostic sort en 1 quand il relève un souci (ici, rien sur le port) :
  // c'est sa sortie qu'on lit, pas son code.
  const { stdout: sortie } = spawnSync(process.execPath, [path.join(RACINE, "scripts", "diagnostiquer-espace.mjs")], {
    cwd: RACINE,
    encoding: "utf8",
    env: { ...process.env, ATLAS_ETAPE_BANC: chemin, PORT: "39998" },
  });
  assert.match(sortie, /Banc\s+: étape « clé de l'espace », depuis 7 min/);
});

rmSync(dossier, { recursive: true, force: true });
console.log(`\n${echecs === 0 ? "✅" : "❌"} L'étape du banc — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
