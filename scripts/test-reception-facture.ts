import assert from "node:assert/strict";
import { receptionEnMots } from "../src/lib/reception-facture";

// La trace de réception d'une facture, MISE EN MOTS — sa demande du
// 9 septembre 2026, raccourcie par lui le 11 septembre.
//
// **Pourquoi une suite pure pour une phrase.** Deux écrans la montrent — les
// impayés et le dossier du client —, et elle doit dire exactement la même chose
// aux deux endroits. Une règle d'affichage écrite dans l'écran ne s'éprouve
// qu'en montant un navigateur, et elle se recopie au deuxième écran qui en a
// besoin (`CLAUDE.md` §3).
//
// **Le fuseau reste le vrai sujet**, même sans heure affichée : une ouverture à
// 23 h 30 UTC est déjà le lendemain chez lui, et c'est SON jour qui doit
// s'écrire.

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

test("rien d'ouvert, rien de confirmé : la ligne le dit, et n'a pas de date", () => {
  // **Un contrôle qui mesure zéro ne mesure rien** : si ce cas rendait déjà une
  // date, tous les autres seraient verts sans rien prouver. Et à l'écran, c'est
  // ce cas-là qui doit écrire « Pas encore ouverte » — l'information qu'il
  // cherche quand un client prétend n'avoir rien reçu.
  const r = receptionEnMots({ ouverteLe: null, accuseLe: null }, "2026-09-11");
  assert.equal(r.avant, "Pas encore ouverte.");
  assert.equal(r.date, null);
});

test("ouverte sans case cochée : « Ouverte 11/09 », et AUCUNE heure", () => {
  // Sa demande du 11 septembre 2026 : *« l'heure tu supprimes »*. Elle prenait
  // la largeur d'une ligne de téléphone pour un repère qu'il survole.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-11T15:57:00Z"), accuseLe: null }, "2026-09-11");
  assert.equal(r.avant, "Ouverte ");
  assert.equal(r.date, "11/09");
  assert.ok(!/ h /.test(r.avant + r.date), "l'heure est revenue dans la ligne");
});

test("case cochée : la confirmation SEULE, l'ouverture disparaît", () => {
  // *« Si il coche la case, marque seulement réception confirmée le 11/09, pas
  // besoin d'avoir les deux infos »* — et il a raison : cocher suppose d'avoir
  // ouvert. Les deux dates côte à côte disaient deux fois la même chose.
  const r = receptionEnMots(
    { ouverteLe: new Date("2026-09-10T12:12:00Z"), accuseLe: new Date("2026-09-11T09:00:00Z") },
    "2026-09-11"
  );
  assert.equal(r.avant, "Réception confirmée le ");
  assert.equal(r.date, "11/09", "c'est le jour de la CONFIRMATION qui s'écrit, pas celui de l'ouverture");
  assert.ok(!/[Oo]uverte/.test(r.avant), "l'ouverture s'écrit encore alors qu'elle est confirmée");
});

test("le jour bascule à l'heure de l'atelier, pas à Greenwich", () => {
  // 23 h 30 UTC le 8, c'est déjà 1 h 30 le 9 chez lui. Le jour compté en UTC
  // ferait dire « 08/09 » à une ouverture du 9 — le même défaut que `jourIso` a
  // corrigé le 25 août 2026, et qu'il avait relevé lui-même.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-08T23:30:00Z"), accuseLe: null }, "2026-09-09");
  assert.equal(r.date, "09/09");
});

test("une facture de l'an dernier porte son année", () => {
  // « 11/09 » sur une facture de l'an dernier désignerait deux jours à un an
  // d'écart — et c'est précisément une vieille impayée qu'on vient regarder.
  const r = receptionEnMots({ ouverteLe: new Date("2025-11-04T10:00:00Z"), accuseLe: null }, "2026-09-11");
  assert.equal(r.date, "04/11/2025");
});

test("le jour et le mois gardent leur zéro : « 01/09 », jamais « 1/9 »", () => {
  // Une date en chiffres se lit en bloc : les colonnes doivent tomber au même
  // endroit d'une ligne à l'autre, comme sur tous les montants de l'écran.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-01T08:00:00Z"), accuseLe: null }, "2026-09-11");
  assert.equal(r.date, "01/09");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
