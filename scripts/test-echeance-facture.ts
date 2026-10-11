import assert from "node:assert/strict";
import {
  datesDeLaFactureQuiPart,
  validerEcheance,
  ECHEANCE_MAX_JOURS,
} from "../src/lib/echeance-facture";

// L'échéance d'une facture, modifiable — sa demande du 25 août 2026. Ici vivent
// les pièges de la SAISIE : une date à l'envers, un an de travers, un mois qui
// n'existe pas. La règle est pure, éprouvée sans base.

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

const EMISSION = "2026-08-25";

console.log("=== Une échéance de facture recevable ===\n");

cas("une échéance à trente jours passe", () => {
  const r = validerEcheance(EMISSION, "2026-09-24");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.iso, "2026-09-24");
});

cas("le comptant — échéance = émission — est permis (délai zéro)", () => {
  const r = validerEcheance(EMISSION, EMISSION);
  assert.equal(r.ok, true);
});

cas("une échéance AVANT la facture est refusée", () => {
  const r = validerEcheance(EMISSION, "2026-08-24");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.raison, /précéder/i);
});

cas("pile un an après, c'est encore bon", () => {
  const unAn = new Date(Date.parse(`${EMISSION}T00:00:00Z`) + ECHEANCE_MAX_JOURS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  assert.equal(validerEcheance(EMISSION, unAn).ok, true);
});

cas("au-delà d'un an, c'est l'année mal tapée : refusée", () => {
  const r = validerEcheance(EMISSION, "2027-08-26");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.raison, /an/i);
});

cas("un format qui n'est pas une date est refusé", () => {
  assert.equal(validerEcheance(EMISSION, "").ok, false);
  assert.equal(validerEcheance(EMISSION, "bientôt").ok, false);
  assert.equal(validerEcheance(EMISSION, "24/09/2026").ok, false);
});

cas("un mois qui n'existe pas ne se faufile pas par le format", () => {
  // « 2026-13-40 » a la bonne FORME mais n'est pas une date : Date.parse le sait.
  const r = validerEcheance(EMISSION, "2026-13-40");
  assert.equal(r.ok, false);
});

console.log("\n=== La date d'une facture qui part ===\n");

cas("la facture prend le jour de l'envoi, et le délai accordé reste entier", () => {
  // Son cas du 22 septembre 2026 : brouillon posé la veille, envoi le lendemain.
  assert.deepEqual(
    datesDeLaFactureQuiPart("2026-09-22", {
      dateEmission: "2026-09-21",
      dateEcheance: "2026-10-21",
    }),
    { dateEmission: "2026-09-22", dateEcheance: "2026-10-22" }
  );
});

cas("un brouillon envoyé le jour même ne bouge pas", () => {
  assert.deepEqual(
    datesDeLaFactureQuiPart("2026-09-21", {
      dateEmission: "2026-09-21",
      dateEcheance: "2026-10-21",
    }),
    { dateEmission: "2026-09-21", dateEcheance: "2026-10-21" }
  );
});

cas("un brouillon oublié trois semaines emporte son échéance avec lui", () => {
  assert.deepEqual(
    datesDeLaFactureQuiPart("2026-10-12", {
      dateEmission: "2026-09-21",
      dateEcheance: "2026-10-21",
    }),
    { dateEmission: "2026-10-12", dateEcheance: "2026-11-11" }
  );
});

cas("le décalage franchit les mois et les années sans se tromper de longueur", () => {
  // 31 décembre → 1er janvier : un jour, et l'échéance de février suit.
  assert.deepEqual(
    datesDeLaFactureQuiPart("2027-01-01", {
      dateEmission: "2026-12-31",
      dateEcheance: "2027-01-30",
    }),
    { dateEmission: "2027-01-01", dateEcheance: "2027-01-31" }
  );
});

cas("le comptant reste comptant : échéance = facture", () => {
  const r = datesDeLaFactureQuiPart("2026-09-22", {
    dateEmission: "2026-09-21",
    dateEcheance: "2026-09-21",
  });
  assert.deepEqual(r, { dateEmission: "2026-09-22", dateEcheance: "2026-09-22" });
});

cas("une facture sans échéance n'en reçoit pas une au passage", () => {
  assert.deepEqual(
    datesDeLaFactureQuiPart("2026-09-22", { dateEmission: "2026-09-21", dateEcheance: null }),
    { dateEmission: "2026-09-22", dateEcheance: null }
  );
});

cas("une date illisible ne s'invente pas : la pièce est rendue telle quelle", () => {
  assert.deepEqual(
    datesDeLaFactureQuiPart("bientôt", { dateEmission: "2026-09-21", dateEcheance: "2026-10-21" }),
    { dateEmission: "2026-09-21", dateEcheance: "2026-10-21" }
  );
  // L'échéance illisible n'emporte pas la date de la facture avec elle.
  assert.deepEqual(
    datesDeLaFactureQuiPart("2026-09-22", { dateEmission: "2026-09-21", dateEcheance: "un jour" }),
    { dateEmission: "2026-09-22", dateEcheance: "un jour" }
  );
});

cas("l'échéance décalée reste recevable pour la nouvelle date de facture", () => {
  const r = datesDeLaFactureQuiPart("2026-09-22", {
    dateEmission: "2026-09-21",
    dateEcheance: "2026-10-21",
  });
  assert.equal(validerEcheance(r.dateEmission, r.dateEcheance!).ok, true);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Échéance de facture — 0 échec(s).");
