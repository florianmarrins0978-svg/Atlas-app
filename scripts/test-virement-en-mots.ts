import assert from "node:assert/strict";
import { questionsDesVirements, questionsParFacture, type VirementAQuestionner } from "../src/lib/virement-en-mots";
import { accordEnMots, PREVENIR_JOURS_AVANT } from "../src/lib/accord-bancaire";
import type { FactureARapprocher } from "../src/lib/rapprochement-bancaire";

// Un virement reçu mis en mots, pour l'accueil ET pour Ma TVA — ses choix du
// 23 octobre 2026. Une seule mise en mots pour les deux écrans : c'est ce qui
// fait qu'ils disent la même chose du même virement.
//
// Ni point médian ni tiret dans ce qui s'affiche (sa règle du 22 septembre) :
// un contrôle le vérifie sur chaque phrase rendue.

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

const LALA: FactureARapprocher = { id: "f28", numero: "F2026-000028", clientNom: "Lala", reste: "120.00", dateEmission: "2026-10-20" };
const MARTINS: FactureARapprocher = { id: "f25", numero: "F2026-000025", clientNom: "Martins", reste: "120.00", dateEmission: "2026-10-08" };
const FRED: FactureARapprocher = { id: "f20", numero: "F2026-000020", clientNom: "Frédéric Durand", reste: "780.00", dateEmission: "2026-09-27" };
const v = (id: string, libelle: string, montant: string, etat: VirementAQuestionner["etat"] = "nouveau", payeur: string | null = null): VirementAQuestionner => ({
  id,
  date: "2026-10-21",
  montant,
  payeur,
  libelle,
  etat,
});

function sansTypographieDeRapport(texte: string) {
  assert.ok(!/[·—]/.test(texte), `« ${texte} » porte un point médian ou un tiret`);
}

test("le numéro écrit sur le virement : la question le dit, et nomme la facture", () => {
  const [q] = questionsDesVirements([v("v1", "VIR F2026-000028", "120.00")], [LALA, MARTINS]);
  assert.equal(q.raison, "Le numéro de la facture est écrit sur le virement.");
  assert.equal(q.question, "C'est la facture F2026-000028 ?");
  assert.equal(q.oui, "Oui");
  assert.deepEqual(q.choix.map((c) => c.factureId), ["f28"]);
  assert.equal(q.qui, "Sans nom");
  for (const t of [q.raison, q.question, q.quandEtLibelle]) sansTypographieDeRapport(t);
});

test("un acompte : « Oui, une partie », et ce que la facture attend encore", () => {
  const [q] = questionsDesVirements([v("v1", "VIR F2026000020 ACOMPTE", "400.00")], [FRED]);
  assert.equal(q.oui, "Oui, une partie");
  assert.match(q.question, /^Une partie de la facture F2026-000020, qui attend 780,00/);
});

test("deux factures du même montant : la liste des deux", () => {
  const [q] = questionsDesVirements([v("v1", "VIREMENT SEPA RECU", "120.00")], [LALA, MARTINS]);
  assert.equal(q.genre, "plusieurs");
  assert.equal(q.choix.length, 2);
  assert.match(q.question, /^2 factures font 120,00/);
});

test("un virement sans facture possible ne devient PAS une question", () => {
  // Son salaire et la MSA arrivent aussi sur le compte : une carte pour chacun
  // noierait les vrais paiements.
  assert.equal(questionsDesVirements([v("v1", "VIR SALAIRE SEPTEMBRE", "1650.00")], [LALA]).length, 0);
});

test("un virement déjà répondu, oui ou non, ne redevient pas une question", () => {
  assert.equal(questionsDesVirements([v("v1", "VIR F2026-000028", "120.00", "confirme")], [LALA]).length, 0);
  assert.equal(questionsDesVirements([v("v1", "VIR F2026-000028", "120.00", "ecarte")], [LALA]).length, 0);
});

test("Ma TVA : la question sur la ligne parle de CETTE facture", () => {
  const qs = questionsDesVirements([v("v1", "VIR F2026-000028", "120.00", "nouveau", "M LALA")], [LALA]);
  const parFacture = questionsParFacture(qs);
  assert.equal(parFacture.f28?.question, "Ce virement paie-t-il cette facture ?");
  assert.match(parFacture.f28?.vu ?? "", /^Vu sur votre banque le 21 octobre, VIR F2026-000028, 120,00/);
  sansTypographieDeRapport(parFacture.f28?.vu ?? "");
});

test("Ma TVA : deux factures pareilles, la question est posée sur les DEUX lignes", () => {
  const parFacture = questionsParFacture(questionsDesVirements([v("v1", "VIREMENT SEPA RECU", "120.00")], [LALA, MARTINS]));
  assert.ok(parFacture.f28 && parFacture.f25, "une des deux lignes n'a pas sa question");
  assert.equal(parFacture.f28.virementId, parFacture.f25.virementId);
});

test("l'accord bancaire : prévenu sept jours avant, pas huit", () => {
  const maintenant = new Date("2026-10-23T10:00:00Z");
  const dans = (jours: number) => new Date(maintenant.getTime() + jours * 24 * 3600 * 1000);
  assert.equal(PREVENIR_JOURS_AVANT, 7);
  assert.equal(accordEnMots(dans(8), maintenant).bientot, false);
  assert.equal(accordEnMots(dans(7), maintenant).bientot, true);
  assert.equal(accordEnMots(dans(7), maintenant).titre, "Votre accord bancaire se termine dans 7 jours");
  assert.equal(accordEnMots(dans(1), maintenant).titre, "Votre accord bancaire se termine demain");
  assert.equal(accordEnMots(dans(-1), maintenant).titre, "L'accord avec votre banque est terminé");
  for (const j of [8, 7, 1, -1]) {
    const a = accordEnMots(dans(j), maintenant);
    for (const t of [a.titre, a.echeance, a.consequence]) sansTypographieDeRapport(t);
  }
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
