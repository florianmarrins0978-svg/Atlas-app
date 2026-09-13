/**
 * LA TRACE DU DERNIER VERDICT — et surtout : ce qui arrive quand elle ment.
 *
 * **Ce que cette suite défend.** `_portee-batterie.ts` peut faire REFUSER une
 * batterie. Tout ce qui la nourrit doit donc tomber du bon côté quand il
 * casse : absent, illisible, écrit par une version d'avant — dans les trois
 * cas on repart pour une mesure complète, jamais sur un refus.
 *
 * Un garde-fou qui tombe en panne du côté du refus est pire que pas de
 * garde-fou : il bloque celui qui arrive, et personne ne sait pourquoi.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  cheminDuVerdict,
  ecrireDernierVerdict,
  ilYA,
  lireDernierVerdict,
} from "./_dernier-verdict";

let reussis = 0;
let echoues = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

const bac = mkdtempSync(path.join(tmpdir(), "atlas-verdict-"));

console.log("=== La trace du dernier verdict ===\n");

test("ce qu'on écrit se relit à l'identique — empreinte comprise", () => {
  const empreinte = new Map([["src/a.ts", { date: 12, empreinte: "abc" }]]);
  ecrireDernierVerdict(bac, { quand: 1_700_000_000_000, verdict: "✅ vert", vert: true, empreinte });
  const relu = lireDernierVerdict(bac);
  assert.ok(relu);
  assert.equal(relu.verdict, "✅ vert");
  assert.equal(relu.vert, true);
  assert.equal(relu.quand, 1_700_000_000_000);
  assert.deepEqual([...relu.empreinte], [["src/a.ts", { date: 12, empreinte: "abc" }]]);
});

// ─── LES TROIS PANNES, ET ELLES DOIVENT TOUTES MENER À LA MESURE ───────────

test("PAS DE TRACE : on mesure — celui qui arrive n'est pas bloqué", () => {
  const vide = mkdtempSync(path.join(tmpdir(), "atlas-verdict-vide-"));
  assert.equal(lireDernierVerdict(vide), null);
  rmSync(vide, { recursive: true, force: true });
});

test("TRACE ILLISIBLE : on mesure, on ne refuse pas", () => {
  writeFileSync(cheminDuVerdict(bac), "{ ceci n'est pas du JSON");
  assert.equal(lireDernierVerdict(bac), null);
});

test("TRACE D'UNE VERSION D'AVANT : on mesure", () => {
  writeFileSync(cheminDuVerdict(bac), JSON.stringify({ verdict: "vert" }));
  assert.equal(lireDernierVerdict(bac), null);
  writeFileSync(cheminDuVerdict(bac), JSON.stringify({ quand: 1, verdict: "v", empreinte: {} }));
  assert.equal(lireDernierVerdict(bac), null, "une empreinte qui n'est pas une liste ne se lit pas");
});

test("UN ROUGE NE RETIENT PAS : une trace rouge, ou sans « vert », se lit comme à mesurer", () => {
  // Un rouge sur un arbre inchangé accuse souvent la machine ; la batterie
  // suivante doit pouvoir le vérifier sans qu'on la force.
  writeFileSync(cheminDuVerdict(bac), JSON.stringify({ quand: 1, verdict: "❌ 3 étapes", empreinte: [] }));
  assert.equal(lireDernierVerdict(bac)?.vert, false);
  ecrireDernierVerdict(bac, { quand: 2, verdict: "❌ 1 étape", vert: false, empreinte: new Map() });
  assert.equal(lireDernierVerdict(bac)?.vert, false);
});

test("un dossier où l'on ne peut pas écrire ne fait PAS tomber la batterie", () => {
  // Écrire est un agrément : au pire la prochaine batterie repart en entier.
  ecrireDernierVerdict(path.join(bac, "nulle-part", "du-tout"), {
    quand: 1,
    verdict: "v",
    vert: true,
    empreinte: new Map(),
  });
});

// ─── Ce que le patron lit ───────────────────────────────────────────────────

test("l'âge se dit en français, pas en millisecondes", () => {
  const t = 1_700_000_000_000;
  assert.equal(ilYA(t, t + 10_000), "à l'instant");
  assert.equal(ilYA(t, t + 60_000), "il y a 1 minute");
  assert.equal(ilYA(t, t + 4 * 60_000), "il y a 4 minutes");
  assert.equal(ilYA(t, t + 60 * 60_000), "il y a 1 heure");
  assert.equal(ilYA(t, t + 3 * 60 * 60_000), "il y a 3 heures");
});

rmSync(bac, { recursive: true, force: true });

console.log(`\n${reussis} réussis, ${echoues} échoués`);
process.exit(echoues > 0 ? 1 : 0);
