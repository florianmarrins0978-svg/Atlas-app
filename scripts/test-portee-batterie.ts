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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { porteeDuLot, phraseDuRefusDePortee, refusApresUnRouge } from "./_portee-batterie";
import { empreinteDesSources, fichiersRemues } from "./_empreinte-des-sources.mjs";

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

// **Trouvé en regardant le refus, pas par un test — 10 septembre 2026.** Le
// premier jet rendait le chemin de la machine tel quel : « npx tsx
// scripts\test-x.ts » ne se recopie pas dans un terminal, la barre inversée
// y échappe la lettre suivante. Une commande qu'on donne se parcourt soi-même
// (`AGENTS.md`).
//
// **La règle a changé d'étage le 20 septembre 2026, pas de sens.** Elle vivait
// ici, dans une normalisation de `porteeDuLot` ; elle vit désormais à la
// source, dans l'empreinte, qui écrit ses chemins comme git — et la couche
// d'ici est partie avec (`CLAUDE.md` §4 quater). Ce contrôle suit donc le
// vrai chemin : un arbre lu par l'empreinte, sur CETTE machine, et la commande
// qu'on en tire. Sous Windows il mesure ; ailleurs il ne peut que passer.
test("LA COMMANDE PROPOSÉE EST COPIABLE — jamais une barre inversée", () => {
  const racine = mkdtempSync(path.join(tmpdir(), "atlas-portee-"));
  try {
    mkdirSync(path.join(racine, "scripts"));
    const avant = empreinteDesSources(racine);
    writeFileSync(path.join(racine, "scripts", "test-porte-e2e.ts"), "// une suite\n");
    const remues = fichiersRemues(avant, empreinteDesSources(racine));
    assert.deepEqual(remues, ["scripts/test-porte-e2e.ts"], "l'empreinte n'écrit pas ses chemins comme git");
    const p = porteeDuLot(remues);
    assert.deepEqual(p.quoi === "suites" ? p.suites : [], ["scripts/test-porte-e2e.ts"]);
    const phrase = phraseDuRefusDePortee(p, "✅", "à l'instant");
    assert.ok(!phrase.includes("\\"), `une barre inversée traîne dans : ${phrase}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
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


// ─── SA QUESTION DU 17 SEPTEMBRE 2026 ──────────────────────────────────────
//
// *« Les autres sessions ont déjà l'info, ou je dois leur dire à chaque
// fois ? »* — non : la batterie refuse elle-même. Une session qui relance ne
// passe par aucun garde-fou, et une consigne en prose s'oublie au bout de trois
// heures (`CLAUDE.md` §1 bis).

test("un verdict ROUGE et une correction bornée : on renvoie au rattrapage", () => {
  const refus = refusApresUnRouge({ rougesHorsSuites: ["Mémoire du dépôt"], niveauDeCeQuiABouge: 1 });
  assert.ok(refus, "CINQUANTE MINUTES pour une ligne de documentation : c'est la boucle du 17 septembre");
  assert.match(refus!, /verifier-ce-qui-a-bouge/);
  assert.match(refus!, /Mémoire du dépôt/);
  assert.match(refus!, /--forcer/, "le refus n'offre aucune porte de sortie");
});

test("une suite rouge compte autant qu'une étape rouge", () => {
  assert.ok(refusApresUnRouge({ rouges: ["test-planning-e2e.ts"], niveauDeCeQuiABouge: 2 }));
});

test("un verdict VERT ne renvoie nulle part — ce n'est pas son cas", () => {
  assert.equal(refusApresUnRouge({ niveauDeCeQuiABouge: 1 }), null);
});

test("ce qui a bougé atteint le NIVEAU 3 : la batterie part, et c'est le côté sûr", () => {
  assert.equal(
    refusApresUnRouge({ rougesHorsSuites: ["Construction"], niveauDeCeQuiABouge: 3 }),
    null,
    "une migration arrivée sous un verdict rouge doit faire repartir la batterie"
  );
});

console.log(`\n${reussis} réussis, ${echoues} échoués`);
process.exit(echoues > 0 ? 1 : 0);
