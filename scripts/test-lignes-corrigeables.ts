import assert from "node:assert/strict";
import {
  factureNeeSansDevis,
  ligneSeCorrige,
} from "../src/lib/lignes-corrigeables";

// ═══════════════════════════════════════════════════════════════════════════
// QUELLES LIGNES D'UNE FACTURE SE CORRIGENT — la règle, sans base ni écran
// ═══════════════════════════════════════════════════════════════════════════
//
// **Pourquoi cette suite existe séparément de celle de la base.** Cette règle
// est appelée à DEUX endroits qui ne se ressemblent pas : l'écran, pour
// dessiner un champ plutôt qu'un texte, et le dépôt, dans le WHERE de ses
// écritures. C'est le genre de règle qu'on aurait écrite deux fois, et dont on
// n'aurait corrigé qu'une (`CLAUDE.md` §3). Une suite qui la tient toute seule
// dit ce qu'elle promet, sans qu'il faille monter une base pour l'apprendre.
//
// **Le cas qui compte, et c'est celui qui a failli être manqué :** une facture
// née d'un devis garde ses lignes de devis INTOUCHABLES même après le
// 10 septembre 2026. L'élargissement ne vaut que pour les factures directes ;
// s'il débordait, le prix que le client a accepté redeviendrait réécrivable, et
// personne ne le verrait avant qu'un client compare son devis à sa facture.

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

const NEE_DU_DEVIS = { devisId: "d4c1f0e2-0000-4000-8000-000000000001" };
const DIRECTE = { devisId: null };

const DU_DEVIS = { supplement: false };
const SUPPLEMENT = { supplement: true };
/** Les factures d'avant la migration 0082 : la colonne n'existait pas. */
const AVANT_LA_COLONNE = { supplement: null };

test("une facture sans devis se reconnaît à son devis NUL, et à rien d'autre", () => {
  assert.equal(factureNeeSansDevis(DIRECTE), true);
  assert.equal(factureNeeSansDevis(NEE_DU_DEVIS), false);
});

test("née d'un devis : SEUL le supplément se corrige", () => {
  assert.equal(ligneSeCorrige(NEE_DU_DEVIS, SUPPLEMENT), true, "le supplément doit rester saisissable");
  assert.equal(
    ligneSeCorrige(NEE_DU_DEVIS, DU_DEVIS),
    false,
    "une ligne du devis est redevenue modifiable : c'est le prix que le client a accepté"
  );
});

test("née d'un devis : une ligne d'AVANT la colonne reste protégée", () => {
  // `null` veut dire « on ne l'a jamais marquée », pas « c'est un supplément ».
  // Une facture d'avant la migration 0082 ne porte que des lignes de devis :
  // les rendre saisissables ouvrirait rétroactivement toutes les anciennes.
  assert.equal(ligneSeCorrige(NEE_DU_DEVIS, AVANT_LA_COLONNE), false);
});

test("faite sans devis : TOUT se corrige, y compris les lignes ordinaires", () => {
  assert.equal(
    ligneSeCorrige(DIRECTE, DU_DEVIS),
    true,
    "sur une facture directe, une ligne ordinaire doit se saisir — sinon elle est irremplissable"
  );
  assert.equal(ligneSeCorrige(DIRECTE, SUPPLEMENT), true);
  assert.equal(ligneSeCorrige(DIRECTE, AVANT_LA_COLONNE), true);
});

console.log(
  `\n${failed === 0 ? "✅" : "❌"} Lignes corrigeables — ${passed} réussi(s), ${failed} échec(s).`
);
process.exit(failed === 0 ? 0 : 1);
