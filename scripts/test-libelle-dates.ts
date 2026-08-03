import assert from "node:assert/strict";
import { libelleAutreDate } from "../src/lib/libelle-dates";

// Le libellé du « je propose une autre date », sur la page du client.
//
// Il était écrit « Aucune des deux » en dur. Or le patron choisit **une ou
// deux** dates au moment d'envoyer (arrêt 1, `docs/AGENT.md`) : avec une seule
// date, son client lisait « Aucune des deux » en face d'une seule ligne.
//
// C'est la seule page que le client voit, et elle porte le sérieux du patron.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le libellé s'accorde au nombre de dates proposées ===");

cas("une seule date : on ne dit pas « des deux »", () => {
  const l = libelleAutreDate(1);
  assert.ok(!l.includes("deux"), `« ${l} » parle de deux dates alors qu'il n'y en a qu'une.`);
  assert.match(l, /propose/, "Le libellé doit rester une proposition du client.");
});

cas("deux dates : « Aucune des deux »", () => {
  assert.match(libelleAutreDate(2), /Aucune des deux/, "Le cas à deux dates a perdu sa formule.");
});

cas("au-delà de deux : la formule reste juste", () => {
  const l = libelleAutreDate(3);
  assert.ok(!l.includes("des deux"), `« ${l} » parle de deux dates alors qu'il y en a trois.`);
});

cas("aucune date proposée : le client peut quand même en donner une", () => {
  const l = libelleAutreDate(0);
  assert.ok(!l.includes("Aucune des"), `« ${l} » renvoie à des dates qui n'existent pas.`);
  assert.match(l, /propose/, "Sans date proposée, le client doit pouvoir en suggérer une.");
});

cas("aucun cas ne rend un libellé vide", () => {
  for (const n of [0, 1, 2, 3, 7]) {
    assert.ok(libelleAutreDate(n).trim().length > 0, `Libellé vide pour ${n} date(s).`);
  }
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles du libellé sont passés.");
