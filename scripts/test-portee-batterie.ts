/**
 * FAUT-IL REJOUER LES 484 SUITES ? — la règle, éprouvée sans rien monter.
 *
 * **Ce qu'elle défend, et ce que ça a coûté :** une heure, le 10 septembre
 * 2026, à rejouer trois fois vingt minutes de batterie pour trois fichiers de
 * suites. Sa question : *« tu faisais tourner une batterie pour pousser
 * quoi ? »*
 *
 * **Et ce qu'elle ne doit JAMAIS faire** — la moitié qui compte le plus : une
 * ligne de `src/`, une migration, un fichier inconnu, et l'on rejoue tout.
 * Un garde-fou qui laisse passer une régression est pire qu'aucun garde-fou.
 */
import assert from "node:assert/strict";
import { porteeDuLot, phraseDuRefusDePortee } from "./_portee-batterie";

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

console.log("=== Faut-il rejouer la batterie entière ? ===\n");

// ─── Les deux seuls refus ───────────────────────────────────────────────────

test("rien n'a bougé : il n'y a rien à mesurer", () => {
  assert.equal(porteeDuLot([]).quoi, "rien");
});

test("UNE suite a changé : on joue cette suite, pas les 484", () => {
  const p = porteeDuLot(["scripts/test-porte-e2e.ts"]);
  assert.equal(p.quoi, "suites");
  assert.deepEqual(p.quoi === "suites" ? p.suites : [], ["scripts/test-porte-e2e.ts"]);
});

test("plusieurs suites, et rien d'autre : on les joue toutes les trois, dans l'ordre", () => {
  const p = porteeDuLot([
    "scripts/test-porte-bienvenue.ts",
    "scripts/test-face-id-e2e.ts",
    "scripts/test-accueil-en-tete.ts",
  ]);
  assert.equal(p.quoi, "suites");
  assert.deepEqual(p.quoi === "suites" ? p.suites : [], [
    "scripts/test-accueil-en-tete.ts",
    "scripts/test-face-id-e2e.ts",
    "scripts/test-porte-bienvenue.ts",
  ]);
});

test("les chemins de Windows comptent comme les autres", () => {
  assert.equal(porteeDuLot(["scripts\\test-porte-e2e.ts"]).quoi, "suites");
});

// **Trouvé en regardant le refus, pas par un test — 10 septembre 2026.** Le
// premier jet rendait le chemin de la machine tel quel : « npx tsx
// scripts\test-x.ts » ne se recopie pas dans un terminal, la barre inversée
// y échappe la lettre suivante. Une commande qu'on donne se parcourt soi-même
// (`AGENTS.md`).
test("LA COMMANDE PROPOSÉE EST COPIABLE — jamais une barre inversée", () => {
  const p = porteeDuLot(["scripts\\test-porte-e2e.ts"]);
  assert.deepEqual(p.quoi === "suites" ? p.suites : [], ["scripts/test-porte-e2e.ts"]);
  const phrase = phraseDuRefusDePortee(p, "✅", "à l'instant");
  assert.ok(!phrase.includes("\\"), `une barre inversée traîne dans : ${phrase}`);
});

test("une suite en .mts est une suite elle aussi", () => {
  assert.equal(porteeDuLot(["scripts/test-porte-tient-en-une-page.mts"]).quoi, "suites");
});

// ─── ET SURTOUT : ce qui doit rejouer TOUT ─────────────────────────────────
//
// C'est la moitié qui protège. Un garde-fou qui laisse passer une régression
// coûte infiniment plus cher que vingt minutes.

test("UNE SEULE ligne de `src/` et l'on rejoue tout", () => {
  assert.equal(porteeDuLot(["src/app/login/page.tsx"]).quoi, "complete");
});

test("une suite ET un écran : c'est l'écran qui commande", () => {
  assert.equal(
    porteeDuLot(["scripts/test-porte-e2e.ts", "src/app/login/page.tsx"]).quoi,
    "complete"
  );
});

test("UNE MIGRATION rejoue tout — elle change la base sous toutes les suites", () => {
  assert.equal(porteeDuLot(["drizzle/0085_quelque_chose.sql"]).quoi, "complete");
});

test("une pièce partagée rejoue tout", () => {
  assert.equal(porteeDuLot(["src/app/globals.css"]).quoi, "complete");
  assert.equal(porteeDuLot(["src/lib/design-tokens.ts"]).quoi, "complete");
});

test("l'OUTILLAGE des suites rejoue tout — il les porte toutes", () => {
  assert.equal(porteeDuLot(["scripts/_atelier.ts"]).quoi, "complete");
  assert.equal(porteeDuLot(["scripts/run-e2e-tests.ts"]).quoi, "complete");
  assert.equal(porteeDuLot(["scripts/verifier-avant-livraison.ts"]).quoi, "complete");
});

test("un fichier qu'on ne reconnaît pas rejoue tout — le doute tranche vers la mesure", () => {
  assert.equal(porteeDuLot(["quelque-chose-de-neuf.ts"]).quoi, "complete");
  assert.equal(porteeDuLot(["scripts/capture-porte.mts"]).quoi, "complete");
});

test("un fichier NOMMÉ comme une suite mais rangé ailleurs ne compte pas", () => {
  assert.equal(porteeDuLot(["src/lib/test-quelque-chose.ts"]).quoi, "complete");
  assert.equal(porteeDuLot(["scripts/sous-dossier/test-x.ts"]).quoi, "complete");
});

// ─── Ce que le refus DIT ────────────────────────────────────────────────────

test("le refus donne la commande exacte à jouer, jamais « rejoue ce qu'il faut »", () => {
  const p = porteeDuLot(["scripts/test-porte-e2e.ts"]);
  const phrase = phraseDuRefusDePortee(p, "✅ Batterie complète au vert.", "il y a 4 minutes");
  assert.match(phrase, /npx tsx scripts\/test-porte-e2e\.ts/);
  assert.match(phrase, /--forcer/, "sans porte de sortie, le garde-fou se fera contourner");
  assert.match(phrase, /il y a 4 minutes/, "sans la date, on ne sait pas de quel verdict on parle");
  assert.match(phrase, /Batterie complète au vert/, "le verdict précédent doit être relu, pas résumé");
});

console.log(`\n${reussis} réussis, ${echoues} échoués`);
process.exit(echoues > 0 ? 1 : 0);
