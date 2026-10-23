import assert from "node:assert/strict";
import {
  detailDeLaLigneLue,
  lignesDuTableau,
  lireReponseDevisFournisseur,
  rapprocherDuPrix,
  sourceDeLaFactureLue,
  sourceDuDevisLu,
  typeDuFichierRecu,
} from "../src/lib/devis-fournisseur-lu";
import { lireTableau } from "../src/lib/import-tarifs";

// La relecture d'un devis reçu (`src/lib/devis-fournisseur-lu.ts`) : rien ne se
// devine, une ligne sans prix lisible n'est pas proposée.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

test("les lignes lues, leur unité, et la remise de la ligne déduite", () => {
  const lu = lireReponseDevisFournisseur(
    'Voici : {"lignes":[{"designation":"Turbine 3504","reference":"RA3504","quantite":"9","unite":"U","prix_unitaire_ht":"12,40","remise_pourcent":"10"},' +
      '{"designation":"Sac de ciment 35 kg","reference":null,"quantite":"3","unite":"sac","prix_unitaire_ht":"8.00","remise_pourcent":null}]}',
    "fournisseur"
  );
  assert.deepEqual(lu, {
    lignes: [
      { designation: "Turbine 3504", reference: "RA3504", quantite: "9", unite: "pièce", prixHt: "11.16" },
      { designation: "Sac de ciment 35 kg", reference: null, quantite: "3", unite: "sac", prixHt: "8.00" },
    ],
    ecartees: 0,
    totalHt: null,
    totalTtc: null,
  });
});

test("une ligne sans prix ou sans désignation est écartée, jamais complétée", () => {
  const lu = lireReponseDevisFournisseur(
    '{"lignes":[{"designation":"Coude","prix_unitaire_ht":null},{"designation":null,"prix_unitaire_ht":"3"},{"designation":"Té","prix_unitaire_ht":"abc"}]}',
    "fournisseur"
  );
  assert.deepEqual(lu, { lignes: [], ecartees: 3, totalHt: null, totalTtc: null });
});

test("une unité qui n'est pas de la rubrique prend la première de la rubrique", () => {
  const lu = lireReponseDevisFournisseur('{"lignes":[{"designation":"Pose","unite":"sac","prix_unitaire_ht":"40"}]}', "partenaire");
  assert.equal(lu?.lignes[0].unite, "heure");
});

test("une réponse illisible ne rend rien", () => {
  assert.equal(lireReponseDevisFournisseur("pas de JSON", "fournisseur"), null);
  assert.equal(lireReponseDevisFournisseur("{pas: du json}", "fournisseur"), null);
  assert.equal(lireReponseDevisFournisseur('{"autre":1}', "fournisseur"), null);
});

test("la source d'un prix lu nomme le devis et sa date", () => {
  assert.equal(sourceDuDevisLu("Haie Durand", "2026-10-12"), "Lu sur le devis « Haie Durand » du 12/10/2026");
});

// ── Les factures, 23 octobre 2026 ──────────────────────────────────────────

test("les totaux imprimés d'une facture se lisent, et jamais ne se calculent", () => {
  const lu = lireReponseDevisFournisseur('{"lignes":[{"designation":"Sable","prix_unitaire_ht":"41,20"}],"total_ht":"486,22 €","total_ttc":"583,46"}', "fournisseur");
  assert.deepEqual([lu?.totalHt, lu?.totalTtc], ["486.22", "583.46"]);
  const sans = lireReponseDevisFournisseur('{"lignes":[{"designation":"Sable","prix_unitaire_ht":"41,20"}],"total_ttc":"illisible"}', "fournisseur");
  assert.deepEqual([sans?.totalHt, sans?.totalTtc], [null, null]);
});

test("un fichier Excel ou CSV donne ses lignes par la règle des tarifs", () => {
  const lu = lignesDuTableau(
    lireTableau([
      ["Désignation", "Unité", "Prix HT"],
      ["Ciment CEM II 35 kg", "sac", "9,85"],
      ["Gravier 6/10", "palette", "52,00"],
      ["TOTAL", "", ""],
    ]),
    "fournisseur"
  );
  assert.deepEqual(lu.lignes, [
    { designation: "Ciment CEM II 35 kg", reference: null, quantite: null, unite: "sac", prixHt: "9.85" },
    { designation: "Gravier 6/10", reference: null, quantite: null, unite: "palette", prixHt: "52.00" },
  ]);
  assert.equal(lu.ecartees, 1, "la ligne de total, sans montant, est écartée et comptée");
  assert.deepEqual([lu.totalHt, lu.totalTtc], [null, null], "un tableur n'a pas de total qu'on sache désigner");
});

const connus = [
  { id: "1", nom: "Sable 0/4 lavé", reference: "SAB04", unite: "sac", prixHt: "38.50" },
  { id: "2", nom: "Bordure P1 grise", reference: null, unite: "pièce", prixHt: "4.20" },
  { id: "3", nom: "Gravier", reference: null, unite: "palette", prixHt: "50.00" },
];

test("une ligne de facture retrouve son prix par la référence d'abord", () => {
  const r = rapprocherDuPrix({ designation: "Sable lavé 0-4 (autre libellé)", reference: "sab 04", unite: "sac", prixHt: "41.20" }, connus);
  assert.equal(r.etat, "plus cher");
  assert.equal(r.etat !== "nouveau" && r.ancien.id, "1");
  assert.equal(detailDeLaLigneLue("SAB04", r, "fournisseur"), "réf. SAB04, plus cher");
});

test("sans référence, le même nom sans accents ni casse, dans la même unité", () => {
  const r = rapprocherDuPrix({ designation: "BORDURE p1 GRISE", reference: null, unite: "pièce", prixHt: "4.20" }, connus);
  assert.equal(r.etat, "inchange");
  assert.equal(detailDeLaLigneLue(null, r, "fournisseur"), "Prix inchangé");
  const moins = rapprocherDuPrix({ designation: "Gravier", reference: null, unite: "palette", prixHt: "48" }, connus);
  assert.equal(moins.etat, "moins cher");
});

test("un sac et une palette du même produit sont deux prix", () => {
  const r = rapprocherDuPrix({ designation: "Gravier", reference: null, unite: "sac", prixHt: "6.00" }, connus);
  assert.equal(r.etat, "nouveau");
  assert.equal(detailDeLaLigneLue(null, r, "fournisseur"), "Nouvelle fourniture");
  assert.equal(detailDeLaLigneLue(null, r, "partenaire"), "Nouvelle prestation");
});

test("la source d'un prix lu sur une facture nomme la facture et sa date", () => {
  assert.equal(sourceDeLaFactureLue("Point P octobre", "2026-10-23"), "Lu sur la facture « Point P octobre » du 23/10/2026");
});

test("un tableur reçu se télécharge, une photo ou un PDF s'ouvrent, le reste ne se sert pas", () => {
  assert.deepEqual(typeDuFichierRecu("a/b.pdf"), { type: "application/pdf", joint: false });
  assert.deepEqual(typeDuFichierRecu("a/b.jpg"), { type: "image/jpeg", joint: false });
  assert.equal(typeDuFichierRecu("a/b.xlsx")?.joint, true);
  assert.equal(typeDuFichierRecu("a/b.csv")?.joint, true);
  assert.equal(typeDuFichierRecu("a/b.html"), null);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
