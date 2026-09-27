import assert from "node:assert/strict";
import {
  datesDuMois,
  duMois,
  fenetreDuMois,
  finDuMois,
  groupesDesPassages,
  moisDuPassage,
  type EnvoiDesDates,
} from "../src/lib/dates-du-mois";

// Les dates du mois d'un contrat, sans base ni réseau (planche 130, sa demande
// du 27 septembre 2026). Les passages sont ceux de la planche : deux tontes et
// une taille en octobre chez Mme Costa.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

const C = "contrat-costa";
const passage = (id: string, cle: string, jour: string | null) => ({
  id,
  contratEntretienId: C,
  contratPassage: cle,
  datePlanifiee: jour,
});
const OCTOBRE = [
  passage("t1", "0-2026-10-1", "2026-10-06"),
  passage("t2", "0-2026-10-2", "2026-10-20"),
  passage("h1", "1-2026-10-1", null),
];
const posé = (liste: typeof OCTOBRE, id: string, jour: string) =>
  liste.map((p) => (p.id === id ? { ...p, datePlanifiee: jour } : p));

cas("le mois d'un passage se lit sur sa clé, au 1er", () => {
  assert.equal(moisDuPassage("0-2026-10-2"), "2026-10-01");
  assert.equal(moisDuPassage("n'importe quoi"), null);
});

cas("le bouton dit « d'octobre », « de novembre »", () => {
  assert.equal(duMois("2026-10-01"), "d'octobre");
  assert.equal(duMois("2026-11-01"), "de novembre");
  assert.equal(duMois("2027-08-01"), "d'août");
});

cas("le mois entier, à partir de demain", () => {
  assert.equal(finDuMois("2026-02-01"), "2026-02-28");
  assert.deepEqual(fenetreDuMois("2026-10-01", "2026-09-20"), { debut: "2026-10-01", fin: "2026-10-31" });
  assert.deepEqual(fenetreDuMois("2026-10-01", "2026-10-12"), { debut: "2026-10-13", fin: "2026-10-31" });
  assert.equal(fenetreDuMois("2026-10-01", "2026-10-31"), null);
});

cas("un chantier sans contrat n'entre dans aucun groupe", () => {
  const g = groupesDesPassages([...OCTOBRE, { id: "x", datePlanifiee: "2026-10-02" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].passages.length, 3);
});

cas("tant qu'une date manque, rien n'est à envoyer", () => {
  const r = datesDuMois(OCTOBRE, [], "2026-09-21");
  assert.equal(r.aEnvoyer.length, 0);
  assert.equal(r.enAttente.length, 0);
});

cas("la DERNIÈRE date posée ouvre l'envoi, sans autre geste", () => {
  const r = datesDuMois(posé(OCTOBRE, "h1", "2026-10-14"), [], "2026-09-21");
  assert.equal(r.aEnvoyer.length, 1);
  assert.deepEqual(r.aEnvoyer[0].passages.map((p) => p.id), ["t1", "h1", "t2"]);
});

cas("envoyé sans réponse : en attente du client, plus à envoyer", () => {
  const envoi: EnvoiDesDates = { contratEntretienId: C, mois: "2026-10-01", envoyeLe: "2026-09-21T08:00:00Z", reponduLe: null };
  const r = datesDuMois(posé(OCTOBRE, "h1", "2026-10-14"), [envoi], "2026-09-22");
  assert.equal(r.aEnvoyer.length, 0);
  assert.equal(r.enAttente.length, 1);
  assert.equal(r.enAttente[0].envoyeLe, "2026-09-21T08:00:00Z");
});

cas("validé : ni à envoyer, ni en attente", () => {
  const envoi: EnvoiDesDates = { contratEntretienId: C, mois: "2026-10-01", envoyeLe: "2026-09-21T08:00:00Z", reponduLe: "2026-09-22T10:00:00Z" };
  const r = datesDuMois(posé(OCTOBRE, "h1", "2026-10-14"), [envoi], "2026-09-22");
  assert.equal(r.aEnvoyer.length + r.enAttente.length, 0);
});

cas("sans réponse, la date tient : l'attente cesse au dernier jour passé, sans bascule", () => {
  const envoi: EnvoiDesDates = { contratEntretienId: C, mois: "2026-10-01", envoyeLe: "2026-09-21T08:00:00Z", reponduLe: null };
  const tous = posé(OCTOBRE, "h1", "2026-10-14");
  assert.equal(datesDuMois(tous, [envoi], "2026-10-20").enAttente.length, 1);
  assert.equal(datesDuMois(tous, [envoi], "2026-10-21").enAttente.length, 0);
  assert.equal(datesDuMois(tous, [], "2026-10-21").aEnvoyer.length, 0);
});

cas("deux mois du même contrat font deux envois", () => {
  const nov = [passage("t3", "0-2026-11-1", "2026-11-03")];
  const r = datesDuMois([...posé(OCTOBRE, "h1", "2026-10-14"), ...nov], [], "2026-09-21");
  assert.deepEqual(r.aEnvoyer.map((g) => g.mois), ["2026-10-01", "2026-11-01"]);
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\n✅ Les dates du mois se groupent et s'envoient juste.");
