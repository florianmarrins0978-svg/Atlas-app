import assert from "node:assert/strict";
import { datesHorsFenetre, motifDatesRefusees } from "../src/lib/dates-envoi";

/* =========================================================================
   LES DATES QU'UN ENVOI REFUSE — et la phrase qui nomme le bon coupable.

   **Deux défauts se tenaient l'un derrière l'autre, et le second cachait le
   premier** (`src/app/chantiers/[id]/export/actions.ts`, 3 septembre 2026).

   L'action figeait le devis — statut « envoyé », PDF archivé, numéro consommé,
   document immuable — **puis** créait le lien du client. Quand la seconde
   moitié refusait une date, la première avait déjà eu lieu : le devis était
   parti pour l'application et n'existait nulle part pour le client.

   Et le refus mentait sur la cause. Il disait « Une des dates proposées n'est
   plus libre », alors que l'occupation d'une journée ne refuse plus rien depuis
   sa règle du 23 août 2026 — *« si l'utilisateur juge qu'il peut rajouter un
   chantier, il doit pouvoir le faire quand même »*. Le seul motif restant est
   la FENÊTRE. Le patron cherchait donc une autre date libre pour un jour qui
   n'avait jamais été pris.

   Cette suite tient les deux moitiés de la réparation : la règle est unique
   (l'action et le dépôt l'appellent tous les deux), et elle sait dire LEQUEL
   des deux bords a été franchi — les gestes qui les réparent sont opposés.

   Fonction pure, éprouvée sans base ni navigateur (`CLAUDE.md` §3).
   ========================================================================= */

let passed = 0;
let failed = 0;

function test(nom: string, verifier: () => void) {
  try {
    verifier();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Sa fenêtre à lui : d'aujourd'hui à dix-huit mois (`fenetrePatron`).
const HORIZON = { debut: "2026-09-03", fin: "2028-03-03" };

console.log("=== Les dates d'un envoi : ce qui est refusé, et pourquoi ===\n");

test("une date dans la fenêtre passe", () => {
  assert.deepEqual(datesHorsFenetre(["2026-09-10", "2027-01-04"], HORIZON), []);
});

test("aujourd'hui passe — c'est LUI qui choisit", () => {
  // Sa règle du 31 août 2026 : « si l'utilisateur veut choisir le 1ᵉʳ septembre
  // il doit pouvoir ! ». La borne basse est le passé, pas un délai de courtoisie.
  assert.deepEqual(datesHorsFenetre([HORIZON.debut], HORIZON), []);
});

test("le dernier jour de la fenêtre passe", () => {
  assert.deepEqual(datesHorsFenetre([HORIZON.fin], HORIZON), []);
});

test("UNE DATE PASSÉE EST NOMMÉE COMME TELLE — plus « hors fenêtre »", () => {
  assert.deepEqual(datesHorsFenetre(["2026-08-04"], HORIZON), [
    { date: "2026-08-04", motif: "passee" },
  ]);
});

test("au-delà de dix-huit mois, l'autre motif", () => {
  assert.deepEqual(datesHorsFenetre(["2028-06-01"], HORIZON), [
    { date: "2028-06-01", motif: "trop_loin" },
  ]);
});

test("sur deux dates, seule la fautive ressort", () => {
  const refus = datesHorsFenetre(["2026-09-10", "2026-08-04"], HORIZON);
  assert.equal(refus.length, 1);
  assert.equal(refus[0]!.date, "2026-08-04");
});

test("LA PHRASE N'ACCUSE PLUS UNE JOURNÉE PRISE — c'était le défaut", () => {
  /**
   * *« Une des dates proposées n'est plus libre. Choisissez-en une autre. »*
   *
   * Le mot « libre » envoyait chercher au mauvais endroit : la journée n'avait
   * jamais été prise, elle était dans le passé. Une erreur qui accuse à tort
   * coûte plus cher que pas d'erreur du tout (`AGENTS.md`).
   *
   * **Contre l'ancienne phrase, ce contrôle rougit.**
   */
  const phrase = motifDatesRefusees(datesHorsFenetre(["2026-08-04"], HORIZON));
  assert.ok(!/libre/.test(phrase), `la phrase parle encore de disponibilité : « ${phrase} »`);
  assert.ok(/passée/.test(phrase), `la phrase ne dit pas que la date est passée : « ${phrase} »`);
  // Et elle dit le geste qui débloque (`CLAUDE.md`, tout refus nomme sa sortie).
  assert.ok(/venir/.test(phrase), `la phrase ne dit pas quoi faire : « ${phrase} »`);
});

test("les deux bords ne se disent pas de la même façon", () => {
  // Avancer ou reculer : une phrase unique ne pouvait dire ni l'un ni l'autre.
  const passee = motifDatesRefusees(datesHorsFenetre(["2026-08-04"], HORIZON));
  const loin = motifDatesRefusees(datesHorsFenetre(["2028-06-01"], HORIZON));
  assert.notEqual(passee, loin);
  assert.ok(/proche/.test(loin), `la phrase du lointain ne dit pas quoi faire : « ${loin} »`);
});

test("sans refus, aucune phrase", () => {
  assert.equal(motifDatesRefusees([]), "");
});

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} test(s) réussi(s), ${failed} échoué(s).`);
process.exit(failed === 0 ? 0 : 1);
