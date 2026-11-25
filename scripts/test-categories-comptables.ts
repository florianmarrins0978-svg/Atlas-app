import assert from "node:assert/strict";
import {
  CLES_COMPTA,
  avisSurLeNumero,
  categorieDeLaLigneComptable,
  categorieProposee,
  categoriesDuSens,
  compteSuggere,
  familleDe,
  intituleDuCompte,
  lireNumeroDeCompte,
  lireNumerosChoisis,
  numeroDuCompte,
  situationDe,
} from "../src/lib/categories-comptables";

// LES CATÉGORIES DU COMPTABLE ET LEURS NUMÉROS — ses choix du 24 novembre 2026
// (`appli/soignee/comptable-trois-fichiers.html`). Ce que la suite défend :
//   · chaque numéro proposé est lisible par un logiciel comptable, et porte
//     l'intitulé du plan comptable qui part dans le FEC ;
//   · deux catégories de cotisations, 431 et 646 (sa réponse du même soir) ;
//   · le salaire au 421, jamais au 641 (compté deux fois sinon) ;
//   · la forme de l'entreprise décide du compte de son argent à lui ;
//   · rien ne se devine : un virement à un fournisseur va « À classer » ;
//   · un choix qui ne va pas au sens de la ligne ne compte pas.

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

const EI = situationDe({ formeJuridique: "EI" });
const SARL = situationDe({ formeJuridique: "SARL" });
const ligne = (l: Partial<Parameters<typeof categorieProposee>[0]>) => ({
  sens: "sortie" as const,
  justification: null,
  motif: null,
  natureDuTicket: null,
  factureEmise: false,
  ...l,
});

test("chaque numéro proposé se lit par un logiciel comptable et porte son intitulé", () => {
  for (const s of [EI, SARL]) {
    for (const cle of CLES_COMPTA) {
      const n = compteSuggere(cle, s);
      assert.ok(lireNumeroDeCompte(n).ok, `${cle} : ${n} illisible`);
      assert.ok(intituleDuCompte(n), `${cle} : ${n} n'a pas d'intitulé pour le FEC`);
    }
  }
});

test("deux catégories de cotisations : les salariés au 431, le patron au 646", () => {
  assert.equal(compteSuggere("cotisationsSalaries", EI), "431");
  assert.equal(compteSuggere("cotisationsPatron", EI), "646");
  assert.equal(familleDe("cotisationsSalaries"), familleDe("cotisationsPatron"));
});

test("le virement d'un salaire va au 421, jamais au 641", () => {
  assert.equal(compteSuggere("salaires", EI), "421");
  assert.equal(categorieProposee(ligne({ justification: "motif", motif: "salaire" })), "salaires");
});

test("l'argent du patron : 108 en entreprise individuelle, 4551 en société", () => {
  assert.equal(compteSuggere("prelevement", EI), "108");
  assert.equal(compteSuggere("prelevement", SARL), "4551");
  assert.equal(compteSuggere("apport", situationDe({ formeJuridique: "Micro-entreprise" })), "108");
  // Une forme tapée à la main est une société (`formeADuCapital`) : jamais devinée en EI.
  assert.equal(compteSuggere("prelevement", situationDe({ formeJuridique: "GAEC" })), "4551");
});

test("ce que la pièce dit se range seul, le reste va « À classer »", () => {
  assert.equal(categorieProposee(ligne({ justification: "ticket", natureDuTicket: "carburant" })), "carburant");
  assert.equal(categorieProposee(ligne({ justification: "ticket", natureDuTicket: "materiel" })), "materiaux");
  assert.equal(categorieProposee(ligne({ justification: "motif", motif: "loyer" })), "loyer");
  assert.equal(categorieProposee(ligne({ justification: "motif", motif: "pret" })), "emprunt");
  assert.equal(categorieProposee(ligne({ justification: "motif", motif: "fournisseur" })), "aClasser");
  assert.equal(categorieProposee(ligne({ justification: "facture" })), "aClasser");
  assert.equal(categorieProposee(ligne({ justification: "ticket_perdu" })), "aClasser");
  assert.equal(categorieProposee(ligne({ sens: "entree", factureEmise: true })), "clients");
  assert.equal(categorieProposee(ligne({ sens: "entree", justification: "facture_hors_atlas" })), "clients");
  assert.equal(categorieProposee(ligne({ sens: "entree", justification: "motif", motif: "aide" })), "aide");
});

test("son choix compte, sauf s'il ne va pas au sens de la ligne", () => {
  assert.equal(categorieDeLaLigneComptable({ ...ligne({ justification: "facture" }), choisie: "location" }), "location");
  assert.equal(categorieDeLaLigneComptable({ ...ligne({ justification: "facture" }), choisie: "aide" }), "aClasser");
  // Un paiement de client reste au client : sa facture le range.
  assert.equal(categorieDeLaLigneComptable({ ...ligne({ sens: "entree", factureEmise: true }), choisie: "apport" }), "clients");
  assert.ok(categoriesDuSens("sortie").includes("impotSalaires"));
  assert.ok(!categoriesDuSens("sortie").includes("clients"));
  assert.ok(categoriesDuSens("entree").every((c) => familleDe(c) === "entrees"));
});

test("un numéro tapé se relit, et ses refus se disent", () => {
  assert.deepEqual(lireNumeroDeCompte(" 60 614 "), { ok: true, numero: "60614" });
  assert.equal(lireNumeroDeCompte("60").ok, false);
  assert.equal(lireNumeroDeCompte("6061A").ok, false);
  assert.equal(lireNumeroDeCompte("12345678901").ok, false);
  assert.equal(avisSurLeNumero("carburant", "60622", EI), null);
  assert.match(avisSurLeNumero("carburant", "4011", EI) ?? "", /classe 6/);
});

test("les numéros gardés en base se relisent sans rien croire", () => {
  const lus = lireNumerosChoisis({ carburant: "60614", inconnue: "601", repas: "62x", salaires: 421 });
  assert.deepEqual(lus, { carburant: "60614" });
  assert.equal(numeroDuCompte("carburant", EI, lus), "60614");
  assert.equal(numeroDuCompte("repas", EI, lus), "6256");
  assert.deepEqual(lireNumerosChoisis(null), {});
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
