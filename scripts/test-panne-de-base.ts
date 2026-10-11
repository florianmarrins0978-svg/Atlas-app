import assert from "node:assert/strict";
import { causeDeLaPanne, codeSqlDe, messageSansLesValeurs, phraseDeLaPanne } from "../src/lib/panne-de-base";

/**
 * CE QUE LA BASE A REFUSÉ, DIT EN FRANÇAIS — la règle, sans base ni navigateur.
 *
 * **Le cas qui a fait naître ce module, le 13 septembre 2026 :** son écran
 * « Une erreur · Référence : 3285538552 » après seize questions. L'insertion de
 * la ligne d'essai butait sur une contrainte qu'une migration non appliquée
 * devait élargir — `23514`, le tout premier cas ci-dessous.
 */

/** Ce que l'écran de création de compte annonce — le premier appelant. */
const COMPTE = "Votre compte n’a pas pu être créé";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Ce que la base a refusé ===\n");

cas("la contrainte qu'une migration devait élargir — le cas du 13 septembre", () => {
  const erreur = Object.assign(new Error('new row for relation "abonnements" violates check constraint'), {
    code: "23514",
  });
  assert.equal(causeDeLaPanne(erreur), "decalage-code-base");
});

cas("une table, une colonne, un droit qui manquent disent tous la même chose", () => {
  for (const code of ["42P01", "42703", "42883", "3F000", "42501", "23502", "22P02"]) {
    assert.equal(causeDeLaPanne(Object.assign(new Error("x"), { code })), "decalage-code-base", code);
  }
});

cas("UNE PANNE ORDINAIRE N'EST PAS UN RETARD — sinon l'avertissement parle à tort", () => {
  // Un réseau coupé, une adresse déjà prise, une panne sans code : rien de tout
  // cela ne se répare en rallumant l'espace, et le dire enverrait chercher au
  // mauvais endroit (`CLAUDE.md` §5 : une erreur qui accuse à tort coûte plus
  // cher que pas d'erreur du tout).
  assert.equal(causeDeLaPanne(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), "inconnue");
  assert.equal(causeDeLaPanne(Object.assign(new Error("x"), { code: "23505" })), "inconnue");
  assert.equal(causeDeLaPanne(new Error("sans code")), "inconnue");
  assert.equal(causeDeLaPanne(undefined), "inconnue");
  assert.equal(causeDeLaPanne("une chaîne"), "inconnue");
});

cas("LE CODE SE TROUVE SOUS L'ENVELOPPE — c'est là que Drizzle le range", () => {
  // Drizzle relance sa propre erreur (« Failed query: … ») en gardant
  // l'originale dans `cause`. Sans la descente, tout refus de la base se
  // lirait « inconnue » et le message juste ne sortirait jamais.
  const dessous = Object.assign(new Error("violates check constraint"), { code: "23514" });
  const dessus = Object.assign(new Error("Failed query: insert into abonnements"), { cause: dessous });
  assert.equal(codeSqlDe(dessus), "23514");
  assert.equal(causeDeLaPanne(dessus), "decalage-code-base");
});

cas("une chaîne d'enveloppes sans fin ne fait pas tourner la lecture en rond", () => {
  const boucle: { cause?: unknown } = {};
  boucle.cause = boucle;
  assert.equal(codeSqlDe(boucle), null);
});

cas("SUR SON BANC, LE GESTE EST SÛR — jamais reconstruire, jamais supprimer", () => {
  const phrase = phraseDeLaPanne("decalage-code-base", true, null, COMPTE);
  // `CLAUDE.md` §4 septies : on ne lui propose JAMAIS un geste qui peut effacer
  // ses chantiers. Rallumer un espace ne touche à aucune donnée.
  for (const interdit of ["reconstru", "supprim", "rebuild", "seed", "amorc", "efface", "vider"]) {
    assert.ok(!phrase.toLowerCase().includes(interdit), `le geste proposé contient « ${interdit} » : ${phrase}`);
  }
  assert.ok(/rallumez/i.test(phrase), `le geste sûr n'est pas nommé : ${phrase}`);
});

cas("hors du banc, on n'envoie chercher aucun remède qui n'existe pas", () => {
  const phrase = phraseDeLaPanne("decalage-code-base", false, null, COMPTE);
  assert.ok(!/codespaces/i.test(phrase), `on parle du banc à quelqu'un qui n'en a pas : ${phrase}`);
  assert.ok(phrase.length > 0);
});

cas("une panne inconnue ne promet pas une mise à jour qu'on n'a pas constatée", () => {
  const phrase = phraseDeLaPanne("inconnue", true, null, COMPTE);
  assert.ok(!/pas à jour/.test(phrase), `on affirme un retard qu'on ignore : ${phrase}`);
  assert.ok(/Réessayez/.test(phrase));
});

cas("SUR LE BANC, LE CODE DE LA BASE SE LIT SUR LA CAPTURE", () => {
  // Ce qui a coûté la soirée du 13 septembre : sa capture ne portait qu'un
  // numéro qui ne menait à rien, et le journal est sur SA machine. Celui-ci
  // nomme ce que la base a refusé — et il ne sort jamais du banc.
  assert.ok(phraseDeLaPanne("decalage-code-base", true, "23514", COMPTE).includes("(base : 23514)"));
  assert.ok(phraseDeLaPanne("inconnue", true, "57P01", COMPTE).includes("(base : 57P01)"));
  assert.ok(!phraseDeLaPanne("decalage-code-base", false, "23514", COMPTE).includes("23514"), "un client n'a que faire d'un code SQL");
  assert.ok(!phraseDeLaPanne("inconnue", false, "23514", COMPTE).includes("23514"));
  // Sans code, aucune parenthèse vide ne traîne à l'écran.
  assert.ok(!phraseDeLaPanne("inconnue", true, null, COMPTE).includes("(base"));
});

cas("CHAQUE ÉCRAN DIT CE QUI A ÉCHOUÉ CHEZ LUI — 17 septembre 2026", () => {
  // La phrase portait « Votre compte n'a pas pu être créé » en dur. Branchée
  // telle quelle sur les règlements, elle aurait annoncé au patron que son
  // COMPTE n'avait pas pu être créé alors qu'il notait un paiement de 495,00 €.
  const reglement = "Ce règlement n’a pas pu être enregistré";
  assert.ok(phraseDeLaPanne("inconnue", false, null, reglement).startsWith(reglement));
  assert.ok(!/compte/i.test(phraseDeLaPanne("inconnue", false, null, reglement)));
  assert.ok(!/compte/i.test(phraseDeLaPanne("decalage-code-base", false, null, reglement)));
  // Sur le banc, le décalage se dit de la même façon pour tout le monde : c'est
  // l'espace qui est en retard, pas le geste qu'on vient de faire.
  assert.ok(/rallumez/i.test(phraseDeLaPanne("decalage-code-base", true, null, reglement)));
});

cas("LA SAISIE NE PART PAS DANS LE JOURNAL — Drizzle recopie tout ce qu'il envoie", () => {
  // Sa vraie forme, relevée sur le parcours reproduit le 13 septembre.
  const message =
    'Failed query: insert into "entreprises" ("nom", "siret", "iban") values ($1, $2, $3)\n' +
    "params: Perret Paysage,12345678901234,FR7630001007941234567890185";
  const journal = messageSansLesValeurs(message);
  assert.ok(journal.includes("insert into"), "la requête, qui dit ce qui a échoué, doit rester");
  assert.ok(!journal.includes("FR7630001007941234567890185"), "l'IBAN est parti dans le journal");
  assert.ok(!journal.includes("12345678901234"), "le SIRET est parti dans le journal");
  // La rédaction de `logger.ts` travaille sur les clés : elle ne verrait rien
  // de tout cela passer à l'intérieur d'une chaîne.
  assert.ok(!/params/i.test(journal));
});

cas("un message long est borné — un journal ne sert que s'il se lit", () => {
  assert.ok(messageSansLesValeurs("x".repeat(900)).length <= 301);
  assert.equal(messageSansLesValeurs("  court  "), "court");
});

console.log(`\nCe que la base a refusé — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
