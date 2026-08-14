// Le téléphone et la forme juridique — les deux règles pures de la saisie
// d'identité, éprouvées sans base ni navigateur.
//
// **Demandes du patron, le 14 août 2026** (planche
// `maquettes/atlas-identite-saisie.html`) : un téléphone avec drapeau,
// indicatif et espacement automatique ; une forme juridique qui se choisit.
//
// CE QUE CETTE SUITE TIENT, ET QUI SE CASSERAIT SANS ELLE :
//
//   · l'espacement suit LE PAYS. Écrire un numéro belge à la française le rend
//     méconnaissable à son propriétaire ;
//   · le zéro national disparaît devant l'indicatif. « +33 06 79 … » est
//     injoignable depuis l'étranger, et c'est la faute la plus fréquente ;
//   · un numéro INCOMPLET s'espace quand même — sinon rien n'apparaît avant le
//     dernier chiffre, et le patron croit que ça ne marche pas ;
//   · ce qui est déjà en base se relit sans être abîmé ;
//   · une forme tapée à la main (« Sas ») retrouve son entrée dans la liste.

import assert from "node:assert/strict";
import {
  PAYS_TELEPHONE,
  PAYS_PAR_DEFAUT,
  paysParCode,
  analyserTelephone,
  formaterNational,
  composerTelephone,
  afficherTelephone,
} from "../src/lib/telephone";
import { FORMES_JURIDIQUES, FORME_AUTRE, formeConnue } from "../src/lib/formes-juridiques";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le téléphone et la forme juridique ===\n");

// ── L'espacement ─────────────────────────────────────────────────────────
essai("un numéro français se pose 06 79 98 45 14", () => {
  assert.equal(formaterNational(PAYS_PAR_DEFAUT, "679984514"), "06 79 98 45 14");
});

essai("et il s'espace AVANT d'être complet", () => {
  assert.equal(formaterNational(PAYS_PAR_DEFAUT, "6799"), "06 79 9");
  assert.equal(formaterNational(PAYS_PAR_DEFAUT, "6"), "06");
});

essai("un champ vide reste vide — on n'écrit pas un zéro tout seul", () => {
  assert.equal(formaterNational(PAYS_PAR_DEFAUT, ""), "");
});

// L'espacement français n'est pas universel. Un numéro belge écrit à la
// française serait méconnaissable à celui qui le possède.
essai("chaque pays garde SA découpe", () => {
  assert.equal(formaterNational(paysParCode("BE"), "471123456"), "0471 12 34 56");
  assert.equal(formaterNational(paysParCode("PT"), "912345678"), "912 345 678");
});

essai("ce qui dépasse la découpe reste écrit, jamais tronqué", () => {
  const trop = formaterNational(PAYS_PAR_DEFAUT, "67998451499");
  assert.ok(trop.replace(/\D/g, "").endsWith("99"), `chiffres perdus : ${trop}`);
});

// ── Ce qui part en base ──────────────────────────────────────────────────
essai("la France s'écrit au format national, sans indicatif", () => {
  assert.equal(composerTelephone(PAYS_PAR_DEFAUT, "679984514"), "06 79 98 45 14");
});

// LA FAUTE LA PLUS FRÉQUENTE, et elle rend le numéro injoignable.
essai("ailleurs, l'indicatif remplace le zéro — jamais « +32 0471 »", () => {
  const belge = composerTelephone(paysParCode("BE"), "471123456");
  assert.match(belge, /^\+32 /);
  assert.ok(!/\+32 0/.test(belge), `zéro national gardé : ${belge}`);
});

// ── Ce qui est DÉJÀ en base se relit ─────────────────────────────────────
essai("un numéro déjà rangé se relit sans être abîmé", () => {
  const { pays, affiche } = afficherTelephone("02 40 00 00 00");
  assert.equal(pays.code, "FR");
  assert.equal(affiche, "02 40 00 00 00");
});

essai("un numéro étranger retrouve son pays", () => {
  const { pays } = analyserTelephone("+32 471 12 34 56");
  assert.equal(pays.code, "BE");
});

// L'INDICATIF LE PLUS LONG GAGNE : « +33 » et « +352 » se ressemblent, et
// comparer dans l'ordre de la liste ferait lire un Luxembourgeois en Français.
essai("+352 n'est pas lu comme +33", () => {
  assert.equal(analyserTelephone("+352 26 12 34 56").pays.code, "LU");
});

essai("un aller-retour ne change pas le numéro", () => {
  for (const p of PAYS_TELEPHONE) {
    const range = composerTelephone(p, "123456789");
    const relu = analyserTelephone(range);
    assert.equal(relu.pays.code, p.code, `${p.nom} : pays perdu (${range})`);
    assert.equal(relu.national.replace(/\D/g, ""), "123456789", `${p.nom} : chiffres perdus (${range})`);
  }
});

essai("un champ vide ou absent ne fabrique rien", () => {
  assert.equal(afficherTelephone(null).affiche, "");
  assert.equal(afficherTelephone("").affiche, "");
  assert.equal(composerTelephone(PAYS_PAR_DEFAUT, ""), "");
});

essai("la France ouvre la liste des pays", () => {
  assert.equal(PAYS_TELEPHONE[0].code, "FR");
  assert.ok(PAYS_TELEPHONE.every((p) => /^\+\d+$/.test(p.indicatif)));
  assert.ok(PAYS_TELEPHONE.every((p) => p.drapeau.length > 0));
});

// ── Les formes juridiques ────────────────────────────────────────────────
essai("la liste couvre les formes du bâtiment", () => {
  const sigles = FORMES_JURIDIQUES.map((f) => f.sigle);
  for (const attendu of ["EI", "EURL", "SARL", "SASU", "SAS"]) {
    assert.ok(sigles.includes(attendu), `« ${attendu} » manque`);
  }
});

// « EURL » ne se retient pas : sans son nom, il faudrait chercher ailleurs.
essai("chaque sigle porte ce qu'il veut dire", () => {
  for (const f of FORMES_JURIDIQUES) {
    assert.ok(f.nom.length > 8, `« ${f.sigle} » n'explique rien`);
  }
});

// LA BASE CONTIENT DÉJÀ CE QU'IL A TAPÉ : « Sas », « S.A.S ». Les traiter en
// formes inconnues lui ferait croire que sa saisie a été perdue.
essai("une forme tapée à la main retrouve son entrée", () => {
  assert.equal(formeConnue("Sas")?.sigle, "SAS");
  assert.equal(formeConnue("s.a.s")?.sigle, "SAS");
  assert.equal(formeConnue(" sasu ")?.sigle, "SASU");
});

essai("et ce qui n'y est pas reste inconnu, sans être écrasé", () => {
  assert.equal(formeConnue("GAEC"), null);
  assert.equal(formeConnue(""), null);
  assert.equal(formeConnue(null), null);
});

essai("« Autre » n'est pas une entrée de la liste, c'est une issue", () => {
  assert.equal(formeConnue(FORME_AUTRE), null);
  assert.ok(!FORMES_JURIDIQUES.some((f) => f.sigle === FORME_AUTRE));
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Téléphone et formes juridiques — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
