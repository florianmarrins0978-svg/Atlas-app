import assert from "node:assert/strict";
import { receptionEnMots } from "../src/lib/reception-facture";

// Les deux dates de la réception, MISES EN MOTS — sa demande du 9 septembre 2026.
//
// **Pourquoi une suite pure pour une phrase.** Elle se relira le jour d'un
// litige, et elle doit dire exactement la même chose partout où elle apparaît.
// Une règle d'affichage écrite dans l'écran ne s'éprouve qu'en montant un
// navigateur, et elle se recopie au deuxième écran qui en a besoin
// (`CLAUDE.md` §3).
//
// **Le fuseau est le vrai sujet.** Une heure mise en mots par le téléphone
// changerait selon l'appareil qui la lit : la même ouverture s'afficherait à
// 14 h 12 chez lui et à 12 h 12 ailleurs. Une preuve qui change d'heure selon
// qui la regarde ne prouve rien — d'où les deux contrôles qui partent d'un
// instant UTC et attendent l'heure de l'atelier.

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

test("rien d'ouvert, rien de confirmé : les deux se taisent", () => {
  // **Un contrôle qui mesure zéro ne mesure rien** : si ce cas rendait déjà une
  // phrase, tous les autres seraient verts sans rien prouver. Et à l'écran,
  // c'est ce cas-là qui doit écrire « Pas encore ouverte » — l'information
  // qu'il cherche quand un client prétend n'avoir rien reçu.
  const r = receptionEnMots({ ouverteLe: null, accuseLe: null });
  assert.equal(r.ouverte, null);
  assert.equal(r.confirmee, null);
});

test("l'ouverture porte le jour ET l'heure, à l'heure de l'atelier", () => {
  // 12 h 12 UTC, un 9 septembre : l'été, Paris est à UTC+2.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-09T12:12:00Z"), accuseLe: null });
  assert.equal(r.ouverte, "le 9 septembre à 14 h 12");
  assert.equal(r.confirmee, null, "une facture ouverte mais non cochée s'annonce confirmée");
});

test("l'heure d'HIVER n'est pas décalée de la même heure", () => {
  // Un `+2` figé se tromperait la moitié de l'année, et l'erreur ne se voit
  // qu'un jour sur trente. En janvier, Paris est à UTC+1.
  const r = receptionEnMots({ ouverteLe: new Date("2026-01-15T12:12:00Z"), accuseLe: null });
  assert.equal(r.ouverte, "le 15 janvier à 13 h 12");
});

test("le jour bascule à l'heure de l'atelier, pas à Greenwich", () => {
  // 23 h 30 UTC le 8, c'est déjà 1 h 30 le 9 chez lui. Le jour compté en UTC
  // ferait dire « le 8 septembre » à une ouverture du 9 — le même défaut que
  // `jourIso` a corrigé le 25 août 2026, et qu'il avait relevé lui-même.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-08T23:30:00Z"), accuseLe: null });
  assert.equal(r.ouverte, "le 9 septembre à 1 h 30");
});

test("la confirmation ne porte que le jour", () => {
  // L'heure d'ouverture situe le geste dans la journée : c'est elle qu'on
  // oppose à « je ne l'ai jamais reçue ». La confirmation est déjà un aveu — la
  // minute n'y ajoute rien, et deux heures côte à côte sur la même ligne se
  // lisent comme deux événements distincts.
  const r = receptionEnMots({
    ouverteLe: new Date("2026-09-09T12:12:00Z"),
    accuseLe: new Date("2026-09-09T12:14:00Z"),
  });
  assert.equal(r.confirmee, "le 9 septembre");
  assert.ok(!/h/.test(r.confirmee!), "la confirmation porte une heure dont personne n'a besoin");
});

test("le premier du mois s'écrit « 1er », comme partout ailleurs", () => {
  // La règle vient de `jourEtMois` : elle n'est pas recopiée ici, et ce
  // contrôle le prouve. Le jour où elle change, cette suite le dira.
  const r = receptionEnMots({ ouverteLe: new Date("2026-09-01T08:00:00Z"), accuseLe: null });
  assert.equal(r.ouverte, "le 1er septembre à 10 h 00");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
