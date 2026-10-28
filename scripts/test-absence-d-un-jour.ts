import assert from "node:assert/strict";
import { gesteDuJour, momentDuJour, phraseDeLaPeriode, resteAutourDuJour } from "../src/lib/absences-equipe";

// La règle pure du geste d'un jour (`src/lib/absences-equipe.ts`), sans base.
// Le défaut qu'elle corrige : retirer un jour d'une semaine d'absence effaçait
// la semaine (27 octobre 2026). La suite base `test-absence-d-un-jour-repo.ts`
// tient le même geste sous la RLS.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${(e as Error).message}`);
  }
}

const semaine = { id: "s", equipeId: "e", premierJour: "2027-03-01", dernierJour: "2027-03-05", premierDemi: "matin", dernierDemi: "apres_midi" };

cas("au milieu, la période se coupe en deux morceaux de journées entières", () => {
  assert.deepEqual(resteAutourDuJour(semaine, "2027-03-03"), [
    { premierJour: "2027-03-01", dernierJour: "2027-03-02", premierDemi: "matin", dernierDemi: "apres_midi" },
    { premierJour: "2027-03-04", dernierJour: "2027-03-05", premierDemi: "matin", dernierDemi: "apres_midi" },
  ]);
});

cas("au premier et au dernier jour, il ne reste qu'un morceau", () => {
  assert.equal(resteAutourDuJour(semaine, "2027-03-01").length, 1);
  assert.equal(resteAutourDuJour(semaine, "2027-03-01")[0].premierJour, "2027-03-02");
  assert.equal(resteAutourDuJour(semaine, "2027-03-05")[0].dernierJour, "2027-03-04");
});

cas("un seul jour retiré à lui-même ne laisse rien", () => {
  assert.deepEqual(resteAutourDuJour({ ...semaine, dernierJour: "2027-03-01" }, "2027-03-01"), []);
});

cas("les bornes de demi-journée se gardent aux deux bouts", () => {
  const jeudiLundi = { ...semaine, premierJour: "2027-03-04", dernierJour: "2027-03-08", premierDemi: "apres_midi", dernierDemi: "matin" };
  const reste = resteAutourDuJour(jeudiLundi, "2027-03-06");
  assert.equal(reste[0].premierDemi, "apres_midi");
  assert.equal(reste[0].dernierDemi, "apres_midi");
  assert.equal(reste[1].premierDemi, "matin");
  assert.equal(reste[1].dernierDemi, "matin");
});

cas("le moment d'un jour se lit sur ce jour, pas sur la ligne", () => {
  const jeudiLundi = { ...semaine, premierJour: "2027-03-04", dernierJour: "2027-03-08", premierDemi: "apres_midi", dernierDemi: "matin" };
  assert.equal(momentDuJour(jeudiLundi, "2027-03-04"), "apres_midi");
  assert.equal(momentDuJour(jeudiLundi, "2027-03-06"), "journee");
  assert.equal(momentDuJour(jeudiLundi, "2027-03-08"), "matin");
  assert.equal(momentDuJour(jeudiLundi, "2027-03-09"), null);
});

cas("le geste retire la ligne qui touche le jour, et repose le reste avec le jour choisi", () => {
  const autre = { ...semaine, id: "autre", premierJour: "2027-04-01", dernierJour: "2027-04-02" };
  const g = gesteDuJour([semaine, autre], "2027-03-03", "matin");
  assert.deepEqual(g.aRetirer, ["s"], "une ligne qui ne touche pas le jour a été retirée");
  assert.equal(g.aPoser.length, 3);
  assert.deepEqual(g.aPoser[2], { premierJour: "2027-03-03", dernierJour: "2027-03-03", premierDemi: "matin", dernierDemi: "matin", depuis: null });
  assert.equal(g.aPoser[0].depuis?.id, "s", "un morceau a perdu la ligne d'où il vient, donc son motif");
});

cas("présent un jour sans absence : rien ne bouge", () => {
  assert.deepEqual(gesteDuJour([semaine], "2027-03-10", null), { aRetirer: [], aPoser: [] });
});

cas("la feuille dit la période entière, puis ce qu'il en reste autour du jour", () => {
  const conges = { ...semaine, premierJour: "2027-03-08", dernierJour: "2027-03-12" };
  assert.equal(phraseDeLaPeriode([conges], "2027-03-10"), "Du 8 au 12 mars");
  const coupee = gesteDuJour([conges], "2027-03-10", null).aPoser;
  assert.equal(phraseDeLaPeriode(coupee, "2027-03-10"), "Absent du 8 au 9 mars, et du 11 au 12 mars");
  const matin = gesteDuJour([conges], "2027-03-10", "matin").aPoser;
  assert.equal(phraseDeLaPeriode(matin, "2027-03-10"), "Absent aussi du 8 au 9 mars, et du 11 au 12 mars");
  assert.equal(phraseDeLaPeriode([], "2027-03-10"), null);
});

if (echecs > 0) {
  console.error(`\n❌ Le geste d'un jour : ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Le geste d'un jour ne touche qu'à ce jour.");
