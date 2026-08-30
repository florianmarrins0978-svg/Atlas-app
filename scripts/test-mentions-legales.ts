import assert from "node:assert/strict";
import { formeADuCapital } from "../src/lib/formes-juridiques";
import { lignesMentionsLegales } from "../src/lib/mentions-legales";
import { sirenDepuisSiret } from "../src/lib/siren";
import { enEuros } from "../src/lib/euros";

// Sa demande du 30 août 2026 : pouvoir ajouter, s'il le veut, le capital et la
// forme juridique de sa société sur le devis — puis, le même jour, la ville
// d'immatriculation au RCS (migration 0071). La forme juridique existait déjà
// depuis la migration 0039 (`formeJuridique`) et ne s'imprimait NULLE PART :
// cette suite protège que la nouvelle impression, elle, respecte ce qu'il a
// tranché sur les maquettes `appli/capital-et-forme-juridique.html`.

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

console.log("\n— formeADuCapital : qui a un capital, et qui n'en a pas —");

cas("une EI n'a pas de capital", () => {
  assert.equal(formeADuCapital("EI"), false);
});

cas("une micro-entreprise n'a pas de capital", () => {
  assert.equal(formeADuCapital("Micro-entreprise"), false);
});

cas("une SASU a un capital", () => {
  assert.equal(formeADuCapital("SASU"), true);
});

cas("les huit sociétés de la liste ont toutes un capital", () => {
  for (const sigle of ["EURL", "SARL", "SASU", "SAS", "SA", "SNC", "SCOP", "SCI"]) {
    assert.equal(formeADuCapital(sigle), true, `${sigle} devrait avoir un capital`);
  }
});

cas("la casse et les points ne changent rien — « Sas » reste une SAS", () => {
  assert.equal(formeADuCapital("Sas"), true);
  assert.equal(formeADuCapital("S.A.S"), true);
});

cas("une forme libre (« Autre », GAEC, société civile…) répond OUI, faute de savoir", () => {
  assert.equal(formeADuCapital("GAEC"), true);
  assert.equal(formeADuCapital("Société civile de moyens"), true);
});

cas("rien de choisi ne fait apparaître ni capital ni RCS", () => {
  assert.equal(formeADuCapital(""), false);
  assert.equal(formeADuCapital(null), false);
  assert.equal(formeADuCapital(undefined), false);
});

console.log("\n— sirenDepuisSiret : jamais une seconde saisie —");

cas("le SIREN, ce sont les neuf premiers chiffres, groupés par trois", () => {
  assert.equal(sirenDepuisSiret("12345678900012"), "123 456 789");
});

cas("un SIRET déjà espacé se lit pareil", () => {
  assert.equal(sirenDepuisSiret("123 456 789 00012"), "123 456 789");
});

cas("un SIRET trop court ne rend rien", () => {
  assert.equal(sirenDepuisSiret("12345"), null);
  assert.equal(sirenDepuisSiret(""), null);
  assert.equal(sirenDepuisSiret(null), null);
});

console.log("\n— lignesMentionsLegales : ce qui s'imprime pour de vrai —");

const SIRET = "123 456 789 00012";

cas("« aucune » retire tout, même si tout est rempli", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "SASU",
      capitalSocial: "1000.00",
      villeRcs: "Versailles",
      siret: SIRET,
      position: "aucune",
    }),
    []
  );
});

cas("une EI ne montre rien, même « sous_nom »", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "EI",
      capitalSocial: "1000.00",
      villeRcs: "Versailles",
      siret: SIRET,
      position: "sous_nom",
    }),
    []
  );
});

cas("aucune forme choisie ne montre rien", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "",
      capitalSocial: null,
      villeRcs: null,
      siret: SIRET,
      position: "sous_nom",
    }),
    []
  );
});

cas("forme seule, sans capital ni ville : une ligne, le sigle nu", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "SASU",
      capitalSocial: null,
      villeRcs: null,
      siret: SIRET,
      position: "sous_nom",
    }),
    ["SASU"]
  );
});

cas("forme + capital : « SASU au capital de … »", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "SASU",
      capitalSocial: "1000.00",
      villeRcs: null,
      siret: SIRET,
      position: "sous_nom",
    }),
    [`SASU au capital de ${enEuros("1000.00")}`]
  );
});

cas("les trois mentions ensemble : deux lignes, le RCS avec le SIREN", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "SASU",
      capitalSocial: "1000.00",
      villeRcs: "Versailles",
      siret: SIRET,
      position: "sous_nom",
    }),
    [`SASU au capital de ${enEuros("1000.00")}`, "RCS Versailles 123 456 789"]
  );
});

cas("une ville de RCS sans SIRET connu ne fait pas une mention à moitié", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "SASU",
      capitalSocial: null,
      villeRcs: "Versailles",
      siret: null,
      position: "sous_nom",
    }),
    ["SASU"]
  );
});

cas("« sous_nom » et « bas » rendent les MÊMES lignes — seul l'emplacement diffère", () => {
  const donnees = {
    formeJuridique: "SASU",
    capitalSocial: "1000.00",
    villeRcs: "Versailles",
    siret: SIRET,
    position: "sous_nom" as const,
  };
  assert.deepEqual(
    lignesMentionsLegales(donnees),
    lignesMentionsLegales({ ...donnees, position: "bas" })
  );
});

cas("une forme libre (« GAEC ») imprime comme une forme connue", () => {
  assert.deepEqual(
    lignesMentionsLegales({
      formeJuridique: "GAEC des Trois Chênes",
      capitalSocial: "5000.00",
      villeRcs: null,
      siret: SIRET,
      position: "sous_nom",
    }),
    [`GAEC des Trois Chênes au capital de ${enEuros("5000.00")}`]
  );
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
