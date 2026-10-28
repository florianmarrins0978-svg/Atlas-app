import assert from "node:assert/strict";
import { courrielDuRetour, etatDuRetour, lignesAReprendre, lireLeRenvoi, messageAuComptable } from "../src/lib/retour-comptable";

// ═══════════════════════════════════════════════════════════════════════════
// RENVOYER À CORRIGER — la règle pure (sa planche du 27 octobre 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce que la suite défend :
//   · le mot et l'adresse du comptable se relisent au serveur ;
//   · Mes dossiers montre la demande tant qu'un rejet reste, puis « Tout est
//     corrigé » tant que le comptable n'a pas revu ;
//   · une attestation signée après le renvoi le clôt ;
//   · l'avis au patron ne porte rien du dossier, ni le mot du comptable.

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

test("le mot et l'adresse se relisent, et rien d'écrit reste rien", () => {
  assert.deepEqual(lireLeRenvoi({ message: "  Deux lignes   à reprendre. ", email: " claire@cabinet.fr " }), { ok: true, valeur: { message: "Deux lignes à reprendre.", email: "claire@cabinet.fr" } });
  assert.deepEqual(lireLeRenvoi({ message: "   ", email: "" }), { ok: true, valeur: { message: null, email: null } });
  assert.deepEqual(lireLeRenvoi({ message: null, email: "claire@" }), { ok: false, raison: "Cette adresse e-mail n'est pas lisible." });
  assert.equal(lireLeRenvoi({ message: "x".repeat(5000), email: null }).ok && (lireLeRenvoi({ message: "x".repeat(5000), email: null }) as { valeur: { message: string } }).valeur.message.length, 1000);
});

test("une ligne ne s'écrit pas « 1 lignes »", () => {
  assert.equal(lignesAReprendre(1), "1 ligne à reprendre.");
  assert.equal(lignesAReprendre(3), "3 lignes à reprendre.");
});

const RENVOI = new Date("2026-10-27T18:00:00Z");

test("la demande tient tant qu'un rejet reste, puis « Tout est corrigé » tant qu'il n'a pas revu", () => {
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: null, rejets: 2, corrigees: 0 }), "demande");
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: null, rejets: 1, corrigees: 1 }), "demande");
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: null, rejets: 0, corrigees: 2 }), "corrige");
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: null, rejets: 0, corrigees: 0 }), null);
  assert.equal(etatDuRetour({ renvoyeLe: null, attestationSigneeLe: null, rejets: 2, corrigees: 0 }), null);
});

test("une attestation signée après le renvoi le clôt, une d'avant non", () => {
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: new Date("2026-10-28T09:00:00Z"), rejets: 1, corrigees: 0 }), null);
  assert.equal(etatDuRetour({ renvoyeLe: RENVOI, attestationSigneeLe: new Date("2026-10-20T09:00:00Z"), rejets: 1, corrigees: 0 }), "demande");
});

test("l'avis au patron ne porte rien du dossier", () => {
  const m = courrielDuRetour({ du: "2026-01-01", au: "2026-10-27", rejetees: 2 });
  assert.equal(m.objet, "Votre comptable demande une correction");
  assert.match(m.texte, /2 lignes à reprendre/);
  assert.doesNotMatch(m.texte, /€|\d+,\d\d/);
});

test("le message au comptable vient de la messagerie du patron, sans le lien", () => {
  const m = messageAuComptable({ du: "2026-01-01", au: "2026-10-27" });
  assert.equal(m.objet, "Dossier justifié corrigé");
  assert.match(m.corps, /même lien/);
  assert.doesNotMatch(m.corps, /https?:/);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
