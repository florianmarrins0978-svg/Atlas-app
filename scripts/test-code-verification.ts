// LE CODE DE VÉRIFICATION — les règles, éprouvées sans base et sans navigateur.
//
// Sa demande du 14 septembre 2026 : *« il faut mettre une sécurité avec un
// numéro envoyé par email à rentrer pour pouvoir valider son compte »*. Ce que
// cette suite fixe, c'est ce qui rend ce code SÛR : il expire, il ne se devine
// pas en cinq essais, il ne se renvoie pas à volonté — et l'empreinte gardée
// en base ne permet pas de le retrouver.
import assert from "node:assert/strict";
import {
  DELAI_ENTRE_ENVOIS_MS,
  ENVOIS_MAX,
  ESSAIS_MAX,
  FENETRE_ENVOIS_MS,
  LONGUEUR_CODE,
  VALIDITE_CODE_MS,
  codeNormalise,
  empreintesEgales,
  verdictDeRenvoi,
  verdictDuCode,
} from "../src/lib/code-verification";
import { empreinteDeLaSaisie, empreinteDuCode, tirerUnCode } from "../src/server/empreinte-du-code";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs += 1;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${e instanceof Error ? e.message : e}`);
  }
}

const ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "un-secret-de-session-pour-la-suite";
const T0 = new Date("2026-09-14T10:00:00Z");
const dans = (ms: number) => new Date(T0.getTime() + ms);

function ligne(code: string, extra: Partial<{ expireLe: Date; essais: number; envois: number; dernierEnvoi: Date; creeLe: Date }> = {}) {
  return {
    empreinte: empreinteDuCode(code, ID, SECRET),
    expireLe: dans(VALIDITE_CODE_MS),
    essais: 0,
    envois: 1,
    dernierEnvoi: T0,
    creeLe: T0,
    ...extra,
  };
}

console.log("=== Le code de vérification ===\n");

essai("un code tiré fait six chiffres, zéros de tête compris, et deux tirages diffèrent", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const c = tirerUnCode();
    assert.match(c, new RegExp(`^\\d{${LONGUEUR_CODE}}$`), `« ${c} » n'a pas la forme d'un code`);
    codes.add(c);
  }
  assert.ok(codes.size > 150, "deux cents tirages ne devraient pas se répéter autant");
});

essai("la saisie tolère les espaces, et refuse tout ce qui n'est pas six chiffres", () => {
  assert.equal(codeNormalise(" 123 456 "), "123456");
  assert.equal(codeNormalise("12345"), null);
  assert.equal(codeNormalise("1234567"), null);
  assert.equal(codeNormalise("12a456"), null);
  assert.equal(codeNormalise(""), null);
});

essai("l'empreinte ne se retrouve pas sans le secret, et change avec le compte", () => {
  const a = empreinteDuCode("123456", ID, SECRET);
  assert.notEqual(a, "123456");
  assert.notEqual(a, empreinteDuCode("123456", ID, "un-autre-secret"));
  assert.notEqual(a, empreinteDuCode("123456", "22222222-2222-4222-8222-222222222222", SECRET));
  assert.equal(a, empreinteDuCode("123456", ID, SECRET), "la même entrée doit donner la même empreinte");
  assert.equal(empreinteDeLaSaisie("12 34 56", ID, SECRET), a);
  assert.equal(empreinteDeLaSaisie("abc", ID, SECRET), null);
});

essai("la comparaison d'empreintes sait dire non — sinon elle ne prouve rien", () => {
  assert.equal(empreintesEgales("abcd", "abcd"), true);
  assert.equal(empreintesEgales("abcd", "abce"), false);
  assert.equal(empreintesEgales("abcd", "abc"), false);
});

essai("le bon code passe, le mauvais est refusé sans tuer le code", () => {
  const l = ligne("004213");
  assert.deepEqual(verdictDuCode(l, empreinteDeLaSaisie("004213", ID, SECRET), T0), { ok: true });
  const faux = verdictDuCode(l, empreinteDeLaSaisie("004214", ID, SECRET), T0);
  assert.equal(faux.ok, false);
  if (!faux.ok) assert.equal(faux.codeMort, false);
});

essai("un code expiré est mort, même s'il est juste", () => {
  const v = verdictDuCode(ligne("004213"), empreinteDeLaSaisie("004213", ID, SECRET), dans(VALIDITE_CODE_MS + 1));
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.codeMort, true);
    assert.match(v.refus, /expiré/);
  }
});

essai("le cinquième essai raté tue le code, et le sixième ne passe plus même juste", () => {
  const avantDernier = verdictDuCode(ligne("004213", { essais: ESSAIS_MAX - 2 }), empreinteDeLaSaisie("000000", ID, SECRET), T0);
  assert.equal(avantDernier.ok, false);
  if (!avantDernier.ok) assert.equal(avantDernier.codeMort, false, "il reste un essai : le code vit encore");

  const dernier = verdictDuCode(ligne("004213", { essais: ESSAIS_MAX - 1 }), empreinteDeLaSaisie("000000", ID, SECRET), T0);
  assert.equal(dernier.ok, false);
  if (!dernier.ok) assert.equal(dernier.codeMort, true, "le dernier essai raté doit tuer le code");

  const apres = verdictDuCode(ligne("004213", { essais: ESSAIS_MAX }), empreinteDeLaSaisie("004213", ID, SECRET), T0);
  assert.equal(apres.ok, false, "un code mort ne se rouvre pas avec la bonne réponse");
});

essai("une saisie qui n'a pas la forme d'un code est refusée sans compter comme un essai mortel", () => {
  const v = verdictDuCode(ligne("004213"), null, T0);
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.codeMort, false);
    assert.match(v.refus, /6 chiffres/);
  }
});

essai("le refus d'un mauvais code ne dit pas combien d'essais il reste", () => {
  const v = verdictDuCode(ligne("004213", { essais: 1 }), empreinteDeLaSaisie("000000", ID, SECRET), T0);
  assert.equal(v.ok, false);
  if (!v.ok) assert.doesNotMatch(v.refus, /\d/, "le refus ne doit porter aucun chiffre");
});

essai("« Renvoyer » : pas deux fois en trente secondes", () => {
  const v = verdictDeRenvoi(ligne("004213"), dans(DELAI_ENTRE_ENVOIS_MS - 1));
  assert.equal(v.ok, false);
  const apres = verdictDeRenvoi(ligne("004213"), dans(DELAI_ENTRE_ENVOIS_MS));
  assert.equal(apres.ok, true);
  if (apres.ok) assert.equal(apres.nouvelleFenetre, false);
});

essai("« Renvoyer » : trois par quart d'heure, puis refus, puis la fenêtre repart", () => {
  const plein = ligne("004213", { envois: ENVOIS_MAX, dernierEnvoi: dans(2 * 60 * 1000) });
  const refus = verdictDeRenvoi(plein, dans(5 * 60 * 1000));
  assert.equal(refus.ok, false);
  if (!refus.ok) assert.match(refus.refus, /quart d’heure/);

  const plusTard = verdictDeRenvoi(plein, dans(FENETRE_ENVOIS_MS));
  assert.equal(plusTard.ok, true);
  if (plusTard.ok) assert.equal(plusTard.nouvelleFenetre, true, "passé le quart d'heure, le compte repart");
});


console.log("");
console.log(`Le code de vérification — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
