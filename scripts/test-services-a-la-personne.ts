import assert from "node:assert/strict";
import {
  caseParDefaut,
  caseRetenue,
  ceQuiManqueALaDeclaration,
  compterLActiviteACote,
  creditDImpot,
  laCaseExiste,
  libelleNumeroIntervenant,
  mentionServicesALaPersonne,
  mentionSurLePapier,
  numeroSapSaisi,
  numeroSapValide,
  phraseDuCompte,
  phraseSousLaCase,
  refusDeLaDateDeDeclaration,
  refusDuNumeroSap,
  saisieServicesALaPersonneLue,
} from "../src/lib/services-a-la-personne";

/**
 * LE CRÉDIT D'IMPÔT DE SES CLIENTS, LOT 1 : les règles pures.
 *
 * Planche `appli/soignee/credit-d-impot.html` (8 novembre 2026). Ce que cette
 * suite défend : **rien ne s'imprime qui ne soit vrai.** Une mention sans
 * numéro, une case cochée pour une entreprise, un crédit d'un centime de trop
 * partent chez un client et y restent. Chaque règle a son cas qui la fait
 * rougir si on la relâche.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n— Le numéro de déclaration —");

cas("SAP et neuf chiffres, ou SIR et quatorze : les deux formes valides", () => {
  assert.equal(numeroSapValide("SAP123456789"), true);
  assert.equal(numeroSapValide("SIR85048465000017"), true);
});

cas("une lettre, un chiffre de trop ou de moins : refusé", () => {
  for (const faux of ["SAP12345678", "SAP1234567890", "SAX123456789", "SIR8504846500001", "123456789", ""]) {
    assert.equal(numeroSapValide(faux), false, `« ${faux} » passe pour valide`);
  }
  assert.equal(numeroSapValide(null), false);
});

cas("la saisie tolère espaces et minuscules, et se range en capitales collées", () => {
  assert.equal(numeroSapSaisi(" sap 123 456 789 "), "SAP123456789");
  assert.equal(numeroSapSaisi("Sap 123 456 789"), "SAP123456789");
  assert.equal(refusDuNumeroSap("sap 123 456 789"), null);
});

cas("une case vide n'est pas refusée : elle efface", () => {
  assert.equal(refusDuNumeroSap(""), null);
  assert.equal(refusDuNumeroSap("   "), null);
});

cas("un numéro faux se refuse avec une phrase qui dit la forme", () => {
  const refus = refusDuNumeroSap("SAP 12 34");
  assert.ok(refus && refus.includes("SAP") && refus.includes("SIR"), `refus : ${refus}`);
});

console.log("\n— La date de la déclaration —");

cas("un jour réel, passé : accepté ; vide : efface", () => {
  assert.equal(refusDeLaDateDeDeclaration("2024-03-12", "2026-11-08"), null);
  assert.equal(refusDeLaDateDeDeclaration("2026-11-08", "2026-11-08"), null);
  assert.equal(refusDeLaDateDeDeclaration("", "2026-11-08"), null);
});

cas("le 30 février, une date illisible, demain : refusés", () => {
  assert.ok(refusDeLaDateDeDeclaration("2024-02-30", "2026-11-08"));
  assert.ok(refusDeLaDateDeDeclaration("12 mars 2024", "2026-11-08"));
  assert.ok(refusDeLaDateDeDeclaration("2026-11-09", "2026-11-08"));
});

console.log("\n— La saisie de Mon entreprise, relue au serveur —");

cas("la saisie se range : numéro normalisé, vides en NULL, champs absents non touchés", () => {
  const r = saisieServicesALaPersonneLue({ numero: "sap 123456789", declareeLe: "" }, "2026-11-08");
  assert.deepEqual(r, { ok: true, valeurs: { numero: "SAP123456789", declareeLe: null } });
  const vide = saisieServicesALaPersonneLue({ numero: "" }, "2026-11-08");
  assert.deepEqual(vide, { ok: true, valeurs: { numero: null } });
});

cas("un interrupteur qui reçoit autre chose qu'un booléen se refuse", () => {
  const r = saisieServicesALaPersonneLue({ declaree: "oui" as unknown as boolean }, "2026-11-08");
  assert.equal(r.ok, false);
});

cas("le serveur refuse ce que l'écran refuse (la même fonction)", () => {
  const r = saisieServicesALaPersonneLue({ numero: "SAP12" }, "2026-11-08");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.raison, refusDuNumeroSap("SAP12"));
});

cas("ce qui manque : rien quand elle est éteinte, le numéro et le logo sinon", () => {
  assert.deepEqual(ceQuiManqueALaDeclaration({ declaree: false, numero: null, logoDepose: false }), { numero: false, logo: false });
  assert.deepEqual(ceQuiManqueALaDeclaration({ declaree: true, numero: null, logoDepose: false }), { numero: true, logo: true });
  assert.deepEqual(ceQuiManqueALaDeclaration({ declaree: true, numero: "SAP123456789", logoDepose: true }), { numero: false, logo: false });
});

console.log("\n— La case du devis —");

const DECLAREE = { declaree: true, clientNom: "Lambert", clientCivilite: "mr" as const };

cas("elle existe pour une entreprise déclarée et un client particulier", () => {
  assert.equal(laCaseExiste(DECLAREE), true);
  assert.equal(laCaseExiste({ ...DECLAREE, clientCivilite: "mme" }), true);
});

cas("pas déclarée : pas de case, même pour un particulier", () => {
  assert.equal(laCaseExiste({ ...DECLAREE, declaree: false }), false);
});

cas("un client Entreprise ou Public : pas de case", () => {
  assert.equal(laCaseExiste({ ...DECLAREE, clientCivilite: "entreprise" }), false);
  assert.equal(laCaseExiste({ ...DECLAREE, clientCivilite: "public" }), false);
  // Sans pastille, le nom tranche, comme dans les listes de clients.
  assert.equal(laCaseExiste({ declaree: true, clientNom: "Mairie de Rezé", clientCivilite: null }), false);
  assert.equal(laCaseExiste({ declaree: true, clientNom: "Jardins Martin SARL", clientCivilite: null }), false);
});

cas("devis neuf : cochée sans activité à côté, décochée avec", () => {
  assert.equal(caseParDefaut({ ...DECLAREE, activiteACote: false }), true);
  assert.equal(caseParDefaut({ ...DECLAREE, activiteACote: true }), false);
  assert.equal(caseParDefaut({ ...DECLAREE, declaree: false, activiteACote: false }), false);
  assert.equal(caseParDefaut({ ...DECLAREE, clientCivilite: "entreprise", activiteACote: false }), false);
});

cas("une case cochée ne compte plus si la case n'existe plus", () => {
  assert.equal(caseRetenue(true, DECLAREE), true);
  assert.equal(caseRetenue(false, DECLAREE), false);
  assert.equal(caseRetenue(true, { ...DECLAREE, declaree: false }), false);
  assert.equal(caseRetenue(true, { ...DECLAREE, clientCivilite: "entreprise" }), false);
});

console.log("\n— Ce que le client récupère —");

cas("la moitié du TTC : 504,00 € donne 252,00 €", () => {
  assert.equal(creditDImpot("504.00"), "252.00");
});

cas("un centime impair s'arrondit vers le bas, jamais vers le haut", () => {
  assert.equal(creditDImpot("100.01"), "50.00");
  assert.equal(creditDImpot("0.03"), "0.01");
});

cas("un total négatif ne promet rien", () => {
  assert.equal(creditDImpot("-10.00"), "0.00");
});

cas("la ligne sous la case, avec la civilité, et « Devis normal » décochée", () => {
  const coche = phraseSousLaCase({ coche: true, genre: "devis", clientNom: "Lambert", clientCivilite: "mr", totalTtc: "504.00" });
  assert.equal(coche.replace(/ /g, " "), "Mr. Lambert récupère 252,00 € sur ses impôts");
  assert.equal(phraseSousLaCase({ coche: false, genre: "devis", clientNom: "Lambert", totalTtc: "504.00" }), "Devis normal");
  assert.equal(phraseSousLaCase({ coche: false, genre: "facture", clientNom: "Lambert", totalTtc: "504.00" }), "Facture normale");
});

cas("sans nom, « Votre client » plutôt qu'une phrase qui commence par un blanc", () => {
  const p = phraseSousLaCase({ coche: true, genre: "facture", clientNom: "", totalTtc: "10.00" });
  assert.ok(p.startsWith("Votre client récupère"), p);
});

console.log("\n— La mention du papier —");

cas("la mention exacte, la date en toutes lettres", () => {
  assert.equal(
    mentionServicesALaPersonne("SAP123456789", "2024-03-12"),
    "Prestation de services à la personne ouvrant droit au crédit d'impôt de l'article 199 sexdecies " +
      "du code général des impôts. Déclaration SAP123456789 du 12 mars 2024."
  );
});

cas("le premier du mois s'écrit « 1er »", () => {
  assert.ok(mentionServicesALaPersonne("SAP123456789", "2024-03-01").endsWith("du 1er mars 2024."));
});

cas("sans date, la phrase s'arrête au numéro, sans « du » orphelin", () => {
  assert.ok(mentionServicesALaPersonne("SAP123456789", null).endsWith("Déclaration SAP123456789."));
});

const PAPIER = { ...DECLAREE, coche: true, numero: "SAP123456789", declareeLe: "2024-03-12" };

cas("cochée, déclarée, particulier, numéro valide : la mention s'imprime", () => {
  assert.ok(mentionSurLePapier(PAPIER)?.includes("SAP123456789"));
});

cas("décochée, éteinte, entreprise, ou sans numéro valide : RIEN", () => {
  assert.equal(mentionSurLePapier({ ...PAPIER, coche: false }), null);
  assert.equal(mentionSurLePapier({ ...PAPIER, declaree: false }), null);
  assert.equal(mentionSurLePapier({ ...PAPIER, clientCivilite: "entreprise" }), null);
  assert.equal(mentionSurLePapier({ ...PAPIER, numero: null }), null);
  assert.equal(mentionSurLePapier({ ...PAPIER, numero: "SAP12" }), null);
});

console.log("\n— L'activité à côté —");

cas("la planche : 6 120 € sur 34 000 €, soit 18 %, la jauge aux trois cinquièmes", () => {
  const c = compterLActiviteACote({
    annee: 2026,
    factures: { toutes: "34000.00", horsSap: "6120.00" },
    avoirs: { tous: "0", horsSap: "0" },
  });
  assert.equal(c.pourcent, 18);
  assert.equal(c.jauge, 60);
  assert.equal(c.depasse, false);
  assert.equal(phraseDuCompte(c).replace(/ /g, " "), "6 120 € sur 34 000 € cette année");
});

cas("les avoirs se déduisent chacun de son côté", () => {
  const c = compterLActiviteACote({
    annee: 2026,
    factures: { toutes: "10000.00", horsSap: "4000.00" },
    avoirs: { tous: "2000.00", horsSap: "1600.00" },
  });
  // hors : 4 000 − 1 600 = 2 400 ; tout : 10 000 − 2 000 = 8 000 ; 30 % pile.
  assert.equal(c.horsSapCentimes, 240_000);
  assert.equal(c.totalCentimes, 800_000);
  assert.equal(c.pourcent, 30);
  assert.equal(c.depasse, false, "30 % pile n'est pas un dépassement");
});

cas("un centime au-delà de 30 % : dépassé, et le chiffre écrit le dit (31 %)", () => {
  const c = compterLActiviteACote({
    annee: 2026,
    factures: { toutes: "10000.00", horsSap: "3000.01" },
    avoirs: { tous: "0", horsSap: "0" },
  });
  assert.equal(c.depasse, true);
  assert.equal(c.pourcent, 31);
  assert.equal(c.jauge, 100);
});

cas("aucune facture dans l'année : 0 %, sans division par zéro", () => {
  const c = compterLActiviteACote({ annee: 2026, factures: { toutes: "0", horsSap: "0" }, avoirs: { tous: "0", horsSap: "0" } });
  assert.equal(c.pourcent, 0);
  assert.equal(c.depasse, false);
});

cas("un avoir plus gros que l'année ne rend pas une part négative", () => {
  const c = compterLActiviteACote({
    annee: 2026,
    factures: { toutes: "100.00", horsSap: "0" },
    avoirs: { tous: "500.00", horsSap: "0" },
  });
  assert.equal(c.totalCentimes, 0);
  assert.equal(c.pourcent, 0);
});

console.log("\n— Le numéro d'intervenant —");

cas("« n° 0 » pour le patron, « n° 3 » pour un salarié", () => {
  assert.equal(libelleNumeroIntervenant(0), "n° 0");
  assert.equal(libelleNumeroIntervenant(3), "n° 3");
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nToutes les règles des services à la personne tiennent.");
