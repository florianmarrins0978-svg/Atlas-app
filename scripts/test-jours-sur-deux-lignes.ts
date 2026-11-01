/* =======================================================================
   Les jours d'une proposition, sur deux lignes (la page du devis du client).

   La planche du 31 octobre 2026 pose deux dates côte à côte : le jour de la
   semaine dessus, la date dessous. La règle du mois est celle de
   `joursEnToutesLettres` (sa règle du 18 septembre 2026) : un seul mois
   s'écrit une fois, deux mois s'écrivent chacun.
   ======================================================================= */
import assert from "node:assert/strict";
import { joursSurDeuxLignes, joursEnToutesLettres } from "../src/lib/jour";

const EN_2026 = new Date(Date.UTC(2026, 9, 31));
let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Les jours sur deux lignes ===\n");

cas("un jour : le jour de la semaine, puis la date", () => {
  assert.deepEqual(joursSurDeuxLignes(["2026-11-18"], EN_2026), { jours: "Mercredi", dates: "18 novembre" });
});
cas("deux jours du même mois : le mois une seule fois", () => {
  assert.deepEqual(joursSurDeuxLignes(["2026-11-19", "2026-11-18"], EN_2026), { jours: "Mercredi et jeudi", dates: "18 et 19 novembre" });
});
cas("à cheval sur deux mois : chacun son mois, et le 1er en ordinal", () => {
  assert.deepEqual(joursSurDeuxLignes(["2026-09-29", "2026-10-01"], EN_2026), { jours: "Mardi et jeudi", dates: "29 septembre et 1er octobre" });
});
cas("quatre jours : des virgules, puis « et »", () => {
  assert.deepEqual(joursSurDeuxLignes(["2026-09-18", "2026-09-21", "2026-09-22", "2026-09-23"], EN_2026), {
    jours: "Vendredi, lundi, mardi et mercredi",
    dates: "18, 21, 22 et 23 septembre",
  });
});
cas("une autre année se dit, comme dans la phrase entière", () => {
  assert.deepEqual(joursSurDeuxLignes(["2027-01-05"], EN_2026), { jours: "Mardi", dates: "5 janvier 2027" });
  assert.match(joursEnToutesLettres(["2027-01-05"], EN_2026), /2027/);
});
cas("rien à écrire ne rend pas de mots inventés", () => {
  assert.deepEqual(joursSurDeuxLignes([], EN_2026), { jours: "", dates: "" });
});
cas("les deux lignes disent les mêmes jours que la phrase entière", () => {
  const jours = ["2026-11-18", "2026-11-19"];
  const { jours: semaine, dates } = joursSurDeuxLignes(jours, EN_2026);
  const phrase = joursEnToutesLettres(jours, EN_2026);
  for (const mot of [...semaine.toLowerCase().split(/,? et |, /), "18", "19", "novembre"]) assert.ok(phrase.includes(mot), `« ${mot} » manque à « ${phrase} »`);
  assert.ok(dates.endsWith("novembre"));
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les jours sur deux lignes : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;
