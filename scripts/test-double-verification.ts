// La double vérification : les règles pures, sans base ni navigateur.
//
// **Ce que cette suite protège.** Le code à six chiffres est calculé de deux
// côtés : par l'appli d'authentification de l'artisan, et par Atlas. Un écart
// d'un seul chiffre, et personne n'entre plus jamais par mot de passe. Les
// valeurs de référence ne sont donc pas les nôtres : ce sont celles de la
// norme (RFC 6238, annexe B), que toutes les applis du marché respectent.

import assert from "node:assert/strict";
import {
  ALPHABET_SECOURS,
  base32Decode,
  base32Encode,
  codeSecoursDepuis,
  codeTotp,
  doubleVerificationObligatoire,
  ecrireCodeSecours,
  normaliserCodeSecours,
  pasDeTemps,
  uriOtpauth,
  verifierCodeTotp,
} from "../src/lib/double-verification";

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

console.log("=== Le code de l'appli d'authentification ===\n");

// RFC 6238, annexe B, SHA1 : la clé est « 12345678901234567890 » en ASCII. La
// norme donne huit chiffres ; les applis en affichent six, les six derniers.
const SECRET_RFC = Buffer.from("12345678901234567890", "ascii");
const VECTEURS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

essai("les six vecteurs de la norme tombent juste", () => {
  for (const [secondes, attendu] of VECTEURS) {
    assert.equal(codeTotp(SECRET_RFC, pasDeTemps(secondes * 1000)), attendu, `à ${secondes} s`);
  }
});

essai("un code s'accepte avec ou sans espace au milieu", () => {
  const maintenant = 1111111111 * 1000;
  assert.equal(verifierCodeTotp(SECRET_RFC, "050 471", maintenant, null).ok, true);
  assert.equal(verifierCodeTotp(SECRET_RFC, "050471", maintenant, null).ok, true);
});

// Trente secondes d'écart entre deux horloges arrivent : le téléphone n'est
// pas à l'heure du serveur à la seconde près. Au-delà, c'est un vieux code.
essai("le code d'avant et celui d'après passent, pas celui d'il y a une minute", () => {
  const pas = pasDeTemps(1111111111 * 1000);
  const maintenant = 1111111111 * 1000;
  assert.equal(verifierCodeTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas - 1), maintenant, null).ok, true);
  assert.equal(verifierCodeTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas + 1), maintenant, null).ok, true);
  assert.equal(verifierCodeTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas - 2), maintenant, null).ok, false);
});

// Un code lu par-dessus l'épaule ne doit pas servir une seconde fois, même
// dans ses trente secondes.
essai("un code déjà servi ne rouvre pas", () => {
  const maintenant = 1111111111 * 1000;
  const r = verifierCodeTotp(SECRET_RFC, "050471", maintenant, null);
  assert.equal(r.ok, true);
  assert.equal(verifierCodeTotp(SECRET_RFC, "050471", maintenant, r.ok ? r.pas : null).ok, false);
});

essai("une saisie qui n'est pas six chiffres est refusée sans calcul", () => {
  const maintenant = 1111111111 * 1000;
  for (const s of ["", "05047", "0504711", "abcdef", "050-471x"]) {
    assert.equal(verifierCodeTotp(SECRET_RFC, s, maintenant, null).ok, false, s);
  }
});

console.log("");

essai("la clé s'écrit en base32 et se relit à l'identique", () => {
  // RFC 4648 : « foobar » donne « MZXW6YTBOI ».
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.deepEqual(base32Decode("MZXW6YTBOI"), Buffer.from("foobar"));
  // Recopiée à la main, elle arrive en minuscules et avec des espaces.
  assert.deepEqual(base32Decode("mzxw 6ytb oi"), Buffer.from("foobar"));
  assert.equal(base32Decode("MZXW1"), null);
});

essai("l'adresse otpauth porte la clé, l'émetteur et le compte", () => {
  const u = new URL(uriOtpauth("MZXW6YTBOI", "anne@exemple.fr"));
  assert.equal(u.protocol, "otpauth:");
  assert.equal(u.host, "totp");
  assert.equal(decodeURIComponent(u.pathname), "/Atlas:anne@exemple.fr");
  assert.equal(u.searchParams.get("secret"), "MZXW6YTBOI");
  assert.equal(u.searchParams.get("issuer"), "Atlas");
  assert.equal(u.searchParams.get("digits"), "6");
  assert.equal(u.searchParams.get("period"), "30");
});

console.log("");
console.log("=== Les codes de secours ===\n");

essai("un code de secours s'écrit XXXX-XXXX, sans lettre qu'on confond", () => {
  const c = codeSecoursDepuis(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.match(ecrireCodeSecours(c), /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  for (const confus of ["0", "1", "I", "O"]) assert.ok(!ALPHABET_SECOURS.includes(confus), confus);
});

// Il le recopie de son papier : minuscules, sans tiret, avec un espace.
essai("il se relit comme on le tape", () => {
  const c = codeSecoursDepuis(new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2]));
  const ecrit = ecrireCodeSecours(c);
  assert.equal(normaliserCodeSecours(ecrit), c);
  assert.equal(normaliserCodeSecours(ecrit.toLowerCase().replace("-", " ")), c);
  assert.equal(normaliserCodeSecours("ABCD-EFG"), null);
});

console.log("");
console.log("=== Qui est obligé ===\n");

// Sa réponse du 30 septembre 2026, la A de la planche : obligatoire pour ceux
// qui voient l'IBAN et l'export, facultative pour les autres.
essai("le patron et la facturation, en production réelle", () => {
  assert.equal(doubleVerificationObligatoire("proprietaire", true), true);
  assert.equal(doubleVerificationObligatoire("facturation", true), true);
  assert.equal(doubleVerificationObligatoire("commercial", true), false);
  assert.equal(doubleVerificationObligatoire("salarie", true), false);
});

// Sur le banc d'essai et dans la batterie, personne n'est forcé : la batterie
// entre en patron dans cent cinquante suites, et son banc garde ses comptes.
essai("hors production réelle, personne n'est forcé", () => {
  assert.equal(doubleVerificationObligatoire("proprietaire", false), false);
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("La double vérification, ses règles — 0 échec(s).");
