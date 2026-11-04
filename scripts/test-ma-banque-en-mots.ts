import assert from "node:assert/strict";
import {
  compteDuReleve,
  echeanceDeLAccord,
  etatDeLaLecture,
  lignesDAvant,
  nomDuVirement,
  quandLaBanqueAEteLue,
  situationDeLaBanque,
} from "../src/lib/ma-banque-en-mots";
import { accordEnMots } from "../src/lib/accord-bancaire";

// Ma banque soignée, sa planche du 1er novembre 2026 (« code ça ») : ce qui
// s'écrit à côté de chaque pastille, le nom d'un virement, le compte du relevé.
// Règles pures, éprouvées sans base ni banque.

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

// 1er novembre 2026, 20 h 30 à Paris (heure d'hiver : UTC+1).
const MAINTENANT = new Date("2026-11-01T19:30:00Z");

test("lue aujourd'hui : le jour et l'heure de l'atelier, pas l'heure du serveur", () => {
  assert.deepEqual(quandLaBanqueAEteLue(new Date("2026-11-01T19:24:00Z"), MAINTENANT), { jour: "aujourd'hui", heure: "20 h 24" });
});

test("une heure du matin s'écrit sans zéro devant, les minutes avec", () => {
  assert.equal(quandLaBanqueAEteLue(new Date("2026-11-01T07:05:00Z"), MAINTENANT).heure, "8 h 05");
});

test("lue à 23 h 50 la veille, relue à 0 h 10 : « hier », compté en jours de Paris", () => {
  const minuitDix = new Date("2026-11-01T23:10:00Z"); // 2 novembre, 0 h 10 à Paris
  assert.equal(quandLaBanqueAEteLue(new Date("2026-11-01T22:50:00Z"), minuitDix).jour, "hier");
});

test("plus ancienne : la date, sans « hier »", () => {
  assert.equal(quandLaBanqueAEteLue(new Date("2026-10-28T09:00:00Z"), MAINTENANT).jour, "le 28 octobre");
});

test("l'échéance de l'accord tient sur la ligne de la pastille", () => {
  const a = (jours: number) => accordEnMots(new Date(MAINTENANT.getTime() + jours * 86400_000), MAINTENANT);
  assert.equal(echeanceDeLAccord(a(5)), "dans 5 jours");
  assert.equal(echeanceDeLAccord(a(1)), "demain");
  assert.equal(echeanceDeLAccord(a(0)), null);
  assert.equal(echeanceDeLAccord(a(-3)), null);
});

test("un payeur nommé passe avant le libellé, qui reste dessous", () => {
  assert.deepEqual(nomDuVirement("M. et Mme Roux", "VIR SEPA M ET MME ROUX FACTURE F2026 000031"), {
    nom: "M. et Mme Roux",
    libelleDessous: "VIR SEPA M ET MME ROUX FACTURE F2026 000031",
  });
});

test("sans payeur : le libellé devient le nom, sans « VIR INST » ni « VIR SEPA », et ne se redit pas", () => {
  assert.deepEqual(nomDuVirement(null, "VIR INST DUPONT ENTRETIEN HAIE OCTOBRE"), { nom: "DUPONT ENTRETIEN HAIE OCTOBRE", libelleDessous: null });
  assert.equal(nomDuVirement(null, "VIR SEPA DURAND").nom, "DURAND");
  assert.equal(nomDuVirement("  ", "VIR MUTUALITE SOCIALE AGRICO VIR NORM").nom, "MUTUALITE SOCIALE AGRICO VIR NORM");
});

test("rien ne s'invente : un libellé sans « VIR » reste tel quel, un libellé vide dit « Sans nom »", () => {
  assert.equal(nomDuVirement(null, "REMISE CHEQUE 0012").nom, "REMISE CHEQUE 0012");
  assert.equal(nomDuVirement(null, "VIRGINIE MARTIN").nom, "VIRGINIE MARTIN");
  assert.equal(nomDuVirement(null, "VIR").nom, "VIR");
  assert.equal(nomDuVirement(null, "  ").nom, "Sans nom");
});

test("le relevé se compte par sens, en centimes justes", () => {
  const c = compteDuReleve([
    { sens: "entree", montant: "1240.00" },
    { sens: "sortie", montant: "86.40" },
    { sens: "sortie", montant: "54.90" },
    { sens: "sortie", montant: "0.10" },
    { sens: "sortie", montant: "0.20" },
  ]);
  assert.deepEqual(c, { entrees: 1, centimesEntrees: 124000, sorties: 4, centimesSorties: 14160 });
});

test("un relevé vide compte zéro, sans planter", () => {
  assert.deepEqual(compteDuReleve([]), { entrees: 0, centimesEntrees: 0, sorties: 0, centimesSorties: 0 });
});

test("la ligne du sommaire : la banque, et le jour de sa lecture", () => {
  assert.equal(situationDeLaBanque("Crédit Mutuel", new Date("2026-11-01T19:24:00Z"), MAINTENANT), "Crédit Mutuel, lue aujourd'hui");
  assert.equal(situationDeLaBanque("Crédit Mutuel", null, MAINTENANT), "Crédit Mutuel");
  assert.equal(situationDeLaBanque(null, null, MAINTENANT), "Votre banque");
});

test("les lignes d'avant : la date en clair, l'année seulement si ce n'est pas la nôtre", () => {
  assert.equal(lignesDAvant("2026-08-03", MAINTENANT), "Votre banque ne donne pas les lignes d'avant le 3 août.");
  assert.equal(lignesDAvant("2024-11-02", MAINTENANT), "Votre banque ne donne pas les lignes d'avant le 2 novembre 2024.");
});

test("ni point médian ni tiret dans ce qui s'affiche", () => {
  const phrases = [
    quandLaBanqueAEteLue(new Date("2026-10-28T09:00:00Z"), MAINTENANT).jour,
    situationDeLaBanque("Crédit Mutuel", new Date("2026-11-01T19:24:00Z"), MAINTENANT),
    lignesDAvant("2024-11-02", MAINTENANT),
  ];
  for (const p of phrases) assert.ok(!/[·—–]/.test(p), `« ${p} »`);
});

// LE CAS QUI A MENTI, le 1er novembre au soir, en éprouvant l'écran codé :
// l'accueil tente la lecture et échoue ; rouverte dans la demi-heure, Ma banque
// ne relit pas (`lireLaBanque` rend « pas lue, rien à dire ») et affichait
// « Lue » à l'heure de la TENTATIVE. Le refus gardé en base doit primer.
const LU = new Date("2026-11-01T19:24:00Z");
test("rouverte dans la demi-heure après un refus : « Pas lue », pas « Lue »", () => {
  assert.deepEqual(etatDeLaLecture({ luLe: LU, refusDeCetteLecture: null, refusGarde: "Enable Banking ne répond pas. Réessayez dans un moment.", accordTermine: false }, MAINTENANT), {
    ton: "rouge",
    etat: "Pas lue",
    quand: "à 20 h 24",
    raison: "Enable Banking ne répond pas. Réessayez dans un moment.",
  });
});

test("le refus de la lecture en cours passe avant celui gardé", () => {
  assert.equal(etatDeLaLecture({ luLe: LU, refusDeCetteLecture: "neuf", refusGarde: "ancien", accordTermine: false }, MAINTENANT)?.raison, "neuf");
});

test("lue sans refus : « Lue », le jour et l'heure", () => {
  assert.deepEqual(etatDeLaLecture({ luLe: LU, refusDeCetteLecture: null, refusGarde: null, accordTermine: false }, MAINTENANT), {
    ton: "vert",
    etat: "Lue",
    quand: "aujourd'hui à 20 h 24",
    raison: null,
  });
});

test("un refus d'un autre jour se date en entier", () => {
  assert.equal(etatDeLaLecture({ luLe: new Date("2026-10-28T09:00:00Z"), refusDeCetteLecture: null, refusGarde: "x", accordTermine: false }, MAINTENANT)?.quand, "le 28 octobre à 10 h 00");
});

test("accord terminé : la pastille de l'accord parle seule, pas de « Pas lue » en double", () => {
  assert.equal(etatDeLaLecture({ luLe: LU, refusDeCetteLecture: "L'accord donné à votre banque est terminé.", refusGarde: null, accordTermine: true }, MAINTENANT), null);
});

test("jamais lue : rien à côté du nom", () => {
  assert.equal(etatDeLaLecture({ luLe: null, refusDeCetteLecture: null, refusGarde: null, accordTermine: false }, MAINTENANT), null);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
