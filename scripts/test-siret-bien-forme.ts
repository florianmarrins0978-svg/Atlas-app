import assert from "node:assert/strict";
import { siretBienForme, sirenDeLEssai } from "../src/lib/siren";
import { QUESTIONS, refusDe } from "../src/lib/creation-compte";

// ═══════════════════════════════════════════════════════════════════════════
// UN SIRET QUI PEUT EXISTER — sa question du 23 novembre 2026 : « il n'y a pas
// moyen de tricher, de taper un numéro au pif ? ». La clé de Luhn du SIREN et
// du SIRET ; La Poste à part. Règle pure, sans base.
// ═══════════════════════════════════════════════════════════════════════════

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Un SIRET qui peut exister ===\n");

cas("un SIRET à la clé juste passe, avec ou sans espaces", () => {
  assert.equal(siretBienForme("123 456 782 00010"), true);
  assert.equal(siretBienForme("12345678200127"), true);
  assert.equal(siretBienForme("732 829 320 00074"), true);
});

cas("un numéro tapé au hasard est refusé (le contrôle sait échouer)", () => {
  assert.equal(siretBienForme("123 456 789 00012"), false, "le SIRET de démonstration n'a pas de clé juste");
  assert.equal(siretBienForme("12345678901234"), false);
  assert.equal(siretBienForme("98765432100018"), false);
});

cas("un SIREN faux suffit à refuser, même si le SIRET entier tombe juste", () => {
  // 123456789 : SIREN sans clé juste ; 12345678900015 a pourtant une clé de
  // Luhn juste sur ses quatorze chiffres.
  assert.equal(siretBienForme("12345678900015"), false);
});

cas("treize ou quinze chiffres, ou rien : refusé", () => {
  assert.equal(siretBienForme("1234567820001"), false);
  assert.equal(siretBienForme("123456782000100"), false);
  assert.equal(siretBienForme(""), false);
  assert.equal(siretBienForme(null), false);
});

cas("La Poste suit sa propre clé : son siège celle de Luhn, ses bureaux la somme multiple de 5", () => {
  assert.equal(siretBienForme("356 000 000 00048"), true, "le siège de La Poste");
  assert.equal(siretBienForme("356 000 000 00051"), true, "une somme de 20");
  assert.equal(siretBienForme("356 000 000 00049"), false);
});

cas("le SIREN de l'essai : les neuf chiffres, et rien d'un numéro qui ne peut pas exister", () => {
  assert.equal(sirenDeLEssai("123 456 782 00010"), "123456782");
  assert.equal(sirenDeLEssai("123 456 782 00127"), "123456782", "un autre établissement, le même SIREN");
  assert.equal(sirenDeLEssai("123 456 789 00012"), null);
  assert.equal(sirenDeLEssai(""), null);
});

cas("la porte refuse un SIRET qui ne peut pas exister, et laisse passer un SIRET vide", () => {
  const q = QUESTIONS.find((x) => x.id === "siret");
  assert.ok(q, "la question du SIRET a disparu : rien n'a été éprouvé");
  assert.equal(refusDe(q, { siret: "123 456 789 00012" }), "Ce SIRET n'existe pas. Vérifiez les 14 chiffres.");
  assert.equal(refusDe(q, { siret: "123 456 782 00010" }), null);
  assert.equal(refusDe(q, { siret: "" }), null);
});

console.log(`\nUn SIRET qui peut exister — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
