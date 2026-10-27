import assert from "node:assert/strict";
import { ibanMasque, recapitulatifDuCompte, type EntreprisePourRecap } from "../src/lib/recapitulatif-compte";

/**
 * TOUT EST PRÊT — la fin de la porte dit ce qui est rempli, et ce qui manque.
 *
 * **Le défaut qu'elle tient** (capture du 26 octobre 2026) : la fin disait
 * « Vos réglages sont remplis » sur un compte sans médiateur, que Mon
 * entreprise disait manquant et obligatoire juste après. Ce récapitulatif est
 * lu sur l'entreprise enregistrée : il ne peut plus dire autre chose qu'elle.
 */

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

const COMPLETE: EntreprisePourRecap = {
  nom: "Jardins Démo",
  formeJuridique: "SARL",
  siret: "12345678900012",
  adresse: "12 rue des Tilleuls, 49000 Angers",
  capitalSocial: "5000.00",
  villeRcs: "Angers",
  regimeTva: "assujettie",
  numeroTva: "FR32123456789",
  periodiciteTva: "mensuelle",
  telephone: "02 41 00 00 00",
  email: "lucas@jardins-demo.fr",
  iban: "FR7630006000011234567890189",
  moyensPaiement: "virement, chèque",
  assureurDecennale: "Assureur de démonstration",
  adresseAssureurDecennale: "1 rue de l’Exemple, 44000 Nantes",
  couvertureDecennale: "France métropolitaine",
  attestationDeposee: true,
  mediateurNom: "Médiateur de démonstration",
  mediateurCoordonnees: "1 place de la Médiation, Nantes",
  nombreEquipes: 2,
};
const LUI = { prenom: "Lucas", nom: "Bernard", email: "lucas@jardins-demo.fr" };
const ligne = (r: ReturnType<typeof recapitulatifDuCompte>, paquet: string) => {
  const l = r.lignes.find((x) => x.paquet === paquet);
  assert.ok(l, `paquet absent : ${paquet}`);
  return l;
};

test("tout rempli : aucune phrase de manque, aucune ligne en or", () => {
  const r = recapitulatifDuCompte(COMPLETE, LUI);
  assert.equal(r.phrase, null);
  assert.ok(r.lignes.every((l) => l.manque === null));
  assert.equal(ligne(r, "Votre équipe").valeur, "2 chantiers par jour");
});

test("SANS MÉDIATEUR, LA FIN LE DIT — le défaut du 26 octobre 2026", () => {
  const r = recapitulatifDuCompte({ ...COMPLETE, mediateurNom: null, mediateurCoordonnees: null }, LUI);
  assert.equal(r.phrase, "Il manque le médiateur.");
  assert.ok(ligne(r, "Médiateur de la consommation").manque);
});

test("une décennale absente n'est pas un manque ; une décennale commencée, si", () => {
  const aucune = recapitulatifDuCompte(
    { ...COMPLETE, assureurDecennale: null, adresseAssureurDecennale: null, couvertureDecennale: null, attestationDeposee: false },
    LUI
  );
  assert.equal(aucune.phrase, null);
  assert.equal(ligne(aucune, "Assurance décennale").valeur, "Aucune");
  const commencee = recapitulatifDuCompte({ ...COMPLETE, attestationDeposee: false }, LUI);
  assert.equal(commencee.phrase, "Il manque l’attestation.");
});

test("une franchise n'a pas de numéro de TVA à réclamer", () => {
  const r = recapitulatifDuCompte({ ...COMPLETE, regimeTva: "franchise", numeroTva: null }, LUI);
  assert.equal(r.phrase, null);
  assert.equal(ligne(r, "Votre TVA").valeur, "Franchise, sans TVA");
});

test("une micro-entreprise n'a ni capital ni RCS à réclamer", () => {
  const r = recapitulatifDuCompte({ ...COMPLETE, formeJuridique: "Micro-entreprise", capitalSocial: null, villeRcs: null }, LUI);
  assert.equal(r.phrase, null);
});

test("trois manques nommés au plus, comme partout", () => {
  const r = recapitulatifDuCompte(
    { ...COMPLETE, siret: null, adresse: null, telephone: null, iban: null, mediateurNom: null },
    LUI
  );
  assert.equal(r.phrase, "Il manque le SIRET, l’adresse et le téléphone, et 2 autres.");
});

test("l'IBAN se reconnaît sans se recopier", () => {
  assert.equal(ibanMasque("FR76 3000 6000 0112 3456 7890 189"), "FR76 3000 … 189");
});

console.log(`\n${passed} réussis, ${failed} échoués`);
if (failed > 0) process.exit(1);
