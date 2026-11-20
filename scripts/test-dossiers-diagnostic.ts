/**
 * Les règles du rangement d'un diagnostic dans un dossier, sans base ni écran
 * (`src/lib/dossiers-diagnostic.ts`, sa demande du 20 novembre 2026).
 *
 *   npx tsx scripts/test-dossiers-diagnostic.ts
 */
import assert from "node:assert/strict";
import {
  jourEnMots,
  ligneDuDiagnostic,
  lireNomDeDossier,
  lireNote,
  NOM_DE_DOSSIER_MAX,
  nomDuDiagnostic,
  NOTE_MAX,
  phraseRangee,
  situationDuDossier,
} from "../src/lib/dossiers-diagnostic";

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const MAINTENANT = new Date("2026-11-20T15:00:00Z");

console.log("\n=== Le nom d'un dossier ===");
cas("les espaces en trop disparaissent", () => {
  assert.deepEqual(lireNomDeDossier("  Mes   observations "), { ok: true, nom: "Mes observations" });
});
cas("un nom vide est refusé, pas rangé sous un nom inventé", () => {
  assert.deepEqual(lireNomDeDossier("   "), { ok: false, refus: "nom_vide" });
});
cas("la longueur est celle de la base", () => {
  assert.equal(lireNomDeDossier("a".repeat(NOM_DE_DOSSIER_MAX)).ok, true);
  assert.deepEqual(lireNomDeDossier("a".repeat(NOM_DE_DOSSIER_MAX + 1)), { ok: false, refus: "nom_trop_long" });
});

console.log("\n=== La note ===");
cas("une note vide se range comme absente", () => {
  assert.deepEqual(lireNote("  \n "), { ok: true, note: null });
  assert.deepEqual(lireNote(null), { ok: true, note: null });
});
cas("ses retours à la ligne restent", () => {
  assert.deepEqual(lireNote(" Gros chêne.\nCôté portail. "), { ok: true, note: "Gros chêne.\nCôté portail." });
});
cas("une note trop longue est refusée, jamais coupée en silence", () => {
  assert.deepEqual(lireNote("x".repeat(NOTE_MAX + 1)), { ok: false, refus: "note_trop_longue" });
});

console.log("\n=== Les phrases de l'écran ===");
cas("le jour de l'année en cours se dit sans l'année", () => {
  assert.equal(jourEnMots(new Date("2026-11-12T09:00:00Z"), MAINTENANT), "12 novembre");
});
cas("un autre jour d'une autre année porte son année", () => {
  assert.equal(jourEnMots(new Date("2025-06-03T09:00:00Z"), MAINTENANT), "3 juin 2025");
});
cas("le jour se lit à l'heure de Paris", () => {
  // 23 h 30 à Paris le 31 décembre, 22 h 30 en temps universel.
  assert.equal(jourEnMots(new Date("2025-12-31T22:30:00Z"), MAINTENANT), "31 décembre 2025");
  assert.equal(jourEnMots(new Date("2025-12-31T23:30:00Z"), MAINTENANT), "1er janvier");
});
cas("rangée avec sa date", () => {
  assert.equal(
    phraseRangee("Terrasse bois", new Date("2026-11-12T09:00:00Z"), MAINTENANT),
    "Rangée dans Terrasse bois, le 12 novembre."
  );
});
cas("un rattachement d'avant la migration 0189 n'invente pas de date", () => {
  assert.equal(phraseRangee("Terrasse bois", null, MAINTENANT), "Rangée dans Terrasse bois.");
});
cas("la ligne d'un dossier, comme sur la planche", () => {
  assert.equal(
    situationDuDossier("chantier", 2, new Date("2026-11-12T09:00:00Z"), MAINTENANT),
    "Chantier, 2 photos, la dernière le 12 novembre."
  );
  assert.equal(situationDuDossier("chantier", 1, new Date("2026-11-12T09:00:00Z"), MAINTENANT), "Chantier, 1 photo.");
  assert.equal(situationDuDossier("dossier", 4, null, MAINTENANT), "Mon dossier, 4 photos.");
});
cas("la ligne d'un diagnostic : le jour, puis le début de la note", () => {
  assert.equal(
    ligneDuDiagnostic(new Date("2026-11-12T09:00:00Z"), "Gros chêne côté portail.", MAINTENANT),
    "Le 12 novembre. Gros chêne côté portail."
  );
  assert.equal(ligneDuDiagnostic(new Date("2026-11-03T09:00:00Z"), null, MAINTENANT), "Le 3 novembre.");
});
cas("une note longue se coupe au mot, jamais au milieu", () => {
  const ligne = ligneDuDiagnostic(new Date("2026-11-12T09:00:00Z"), "feutre blanc ".repeat(20), MAINTENANT, 30);
  assert.match(ligne, /^Le 12 novembre\. feutre blanc feutre blanc…$/);
});
cas("le nom d'un diagnostic qui n'a pas conclu n'est jamais deviné", () => {
  assert.equal(nomDuDiagnostic("rendu", "Oïdium du chêne"), "Oïdium du chêne");
  assert.equal(nomDuDiagnostic("inconclusif", "Oïdium du chêne"), "Sans conclusion");
  assert.equal(nomDuDiagnostic("rendu", null), "Diagnostic");
  assert.equal(nomDuDiagnostic("en_analyse", null), "Analyse en cours");
});

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Le rangement d'un diagnostic tient ses règles.");
