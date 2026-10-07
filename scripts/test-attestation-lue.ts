import assert from "node:assert/strict";
import { lireReponseAttestation, remarquesSurLAttestation, type AttestationLue } from "../src/lib/attestation-lue";
import { manquesDuDevis, rappelsDeLaFacture, rappelsDuDevis, type EmetteurAVerifier } from "../src/lib/mentions-manquantes";

/**
 * CE QUE L'IA LIT SUR L'ATTESTATION — sa demande du 7 octobre 2026, après
 * qu'une photo quelconque a été acceptée comme attestation : la lecture se
 * RAPPELLE, et ne bloque jamais (*« jamais de blocage »*).
 *
 * L'appel au fournisseur n'est pas éprouvé ici (aucune clé) ; ce qui l'est,
 * c'est la lecture de sa réponse et ce que l'écran en dit.
 */

let ok = 0;
function cas(nom: string, fn: () => void) {
  fn();
  ok++;
  console.log(`  ✓ ${nom}`);
}

const JOUR = "2026-10-07";
const VRAIE: AttestationLue = { estAttestationDecennale: true, assureur: "AXA France IARD", finValidite: "2026-12-31" };

console.log("— La réponse du modèle —");

cas("un objet entouré de prose se lit", () => {
  assert.deepEqual(
    lireReponseAttestation('Voici : {"est_attestation_decennale": true, "assureur": "AXA France IARD", "fin_validite": "2026-12-31"} merci'),
    VRAIE
  );
});

cas("une réponse sans verdict ne vaut jamais « pas une attestation »", () => {
  assert.equal(lireReponseAttestation("Je ne sais pas."), null);
  assert.equal(lireReponseAttestation('{"assureur": "AXA"}'), null);
  assert.equal(lireReponseAttestation('{"est_attestation_decennale": "peut-être"}'), null);
});

cas("une date qui n'existe pas ne se lit pas", () => {
  const lue = lireReponseAttestation('{"est_attestation_decennale": true, "assureur": null, "fin_validite": "2026-02-31"}');
  assert.equal(lue?.finValidite, null);
  const mal = lireReponseAttestation('{"est_attestation_decennale": true, "fin_validite": "31/12/2026"}');
  assert.equal(mal?.finValidite, null);
});

console.log("— Ce que l'écran en dit —");

cas("sa photo quelconque : elle ne ressemble pas à une attestation", () => {
  const photo = { estAttestationDecennale: false, assureur: null, finValidite: null };
  assert.deepEqual(remarquesSurLAttestation(photo, "Axa", JOUR).map((r) => r.cle), ["decennale-attestation-douteuse"]);
});

cas("une vraie attestation d'Axa, saisie « Axa », valide : rien à redire", () => {
  assert.deepEqual(remarquesSurLAttestation(VRAIE, "Axa", JOUR), []);
});

cas("une attestation expirée le dit, avec sa date", () => {
  const r = remarquesSurLAttestation({ ...VRAIE, finValidite: "2025-12-31" }, "Axa", JOUR);
  assert.deepEqual(r.map((x) => x.libelle), ["Votre attestation décennale a expiré le 31 décembre 2025"]);
  assert.deepEqual(remarquesSurLAttestation({ ...VRAIE, finValidite: JOUR }, "Axa", JOUR), [], "valide jusqu'au soir de sa date");
});

cas("un autre assureur que celui saisi se nomme", () => {
  const r = remarquesSurLAttestation({ ...VRAIE, assureur: "MAAF Assurances" }, "Axa", JOUR);
  assert.deepEqual(r.map((x) => x.libelle), ["Votre attestation est au nom de MAAF Assurances, et vous avez saisi Axa"]);
});

cas("rien de lu, ou un nom illisible : on se tait", () => {
  assert.deepEqual(remarquesSurLAttestation(null, "Axa", JOUR), []);
  assert.deepEqual(remarquesSurLAttestation({ ...VRAIE, assureur: null, finValidite: null }, "Axa", JOUR), []);
});

console.log("— Un rappel, jamais un blocage —");

const EMETTEUR: EmetteurAVerifier = {
  nom: "Atelier Démo",
  adresse: "10 rue des Artisans, Nantes",
  siret: "123 456 789 00012",
  formeJuridique: "EI",
  capitalSocial: null,
  villeRcs: null,
  mediateurNom: "Médiateur",
  assureurDecennale: "Axa",
  regimeTva: "assujettie",
  numeroTva: "FR12123456789",
  telephone: "02 40 00 00 00",
  email: "contact@atelier-demo.fr",
  adresseAssureurDecennale: "1 rue de l'Exemple, Nantes",
  attestationDecennale: true,
  attestationLue: { estAttestationDecennale: false, assureur: null, finValidite: null },
};
const CLIENT = { nom: "Bernard", adresse: "Rezé", adresseChantier: null };

cas("sa photo quelconque se rappelle au devis et à la facture, et le devis part", () => {
  assert.deepEqual(rappelsDuDevis(EMETTEUR, "", JOUR).map((x) => x.cle), ["decennale-attestation-douteuse"]);
  assert.deepEqual(rappelsDeLaFacture(EMETTEUR, JOUR).map((x) => x.cle), ["decennale-attestation-douteuse"]);
  assert.deepEqual(manquesDuDevis(EMETTEUR, CLIENT, ""), [], "la lecture ne bloque jamais");
});

console.log(`\n${ok} vérifications vertes.`);
