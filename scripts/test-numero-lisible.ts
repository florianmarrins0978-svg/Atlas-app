import assert from "node:assert/strict";
import { numeroLisible, destinataireLisible } from "../src/lib/numero-lisible";

// **Un numéro qu'on ne peut pas relire ne sert à rien.**
//
// Cette ligne est la dernière chose que le patron voit avant d'ouvrir sa
// messagerie : c'est là, et nulle part ailleurs, qu'il peut s'apercevoir qu'il
// s'adresse au mauvais client. Elle affichait « Au 0679984514 » — dix chiffres
// collés, qui se vérifient chiffre par chiffre ou pas du tout.
//
// Ce que cette suite tient surtout, c'est le REFUS de grouper : un numéro
// étranger découpé par deux aurait l'apparence d'un numéro français normal tout
// en étant faux. Sur une ligne dont l'unique rôle est la vérification, c'est le
// pire résultat possible — pire que de ne rien faire.

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

console.log("=== Un numéro qui se relit d'un coup d'œil ===");

cas("dix chiffres français : groupés par deux", () => {
  assert.equal(numeroLisible("0679984514"), "06 79 98 45 14");
  assert.equal(numeroLisible("0123456789"), "01 23 45 67 89");
});

cas("déjà espacé, ou pointé : on regroupe pareil", () => {
  assert.equal(numeroLisible("06 79 98 45 14"), "06 79 98 45 14");
  assert.equal(numeroLisible("06.79.98.45.14"), "06 79 98 45 14");
  assert.equal(numeroLisible("06-79-98-45-14"), "06 79 98 45 14");
});

cas("ce qui n'est PAS un numéro français ressort intact", () => {
  // Chacun de ces cas, groupé par deux, donnerait quelque chose qui a l'air
  // juste et qui ne l'est pas. C'est le cœur de la fonction.
  assert.equal(numeroLisible("+33679984514"), "+33679984514", "Un indicatif international");
  assert.equal(numeroLisible("0041791234567"), "0041791234567", "Un numéro suisse");
  assert.equal(numeroLisible("1234"), "1234", "Un poste interne");
  assert.equal(numeroLisible("06799845"), "06799845", "Une saisie incomplète");
  assert.equal(numeroLisible("06799845140"), "06799845140", "Un chiffre de trop");
  assert.equal(numeroLisible("9679984514"), "9679984514", "Ne commence pas par zéro");
  assert.equal(numeroLisible("06 79 98 45 1A"), "06 79 98 45 1A", "Une lettre au milieu");
});

cas("le vide et les blancs ne fabriquent rien", () => {
  assert.equal(numeroLisible(""), "");
  assert.equal(numeroLisible("   "), "");
});

cas("une adresse e-mail n'est JAMAIS groupée", () => {
  // Le garde-fou de l'aiguillage : le jour où un e-mail ne contient que des
  // chiffres et un zéro devant, il ne doit pas partir en paires.
  assert.equal(destinataireLisible("email", " client@exemple.fr "), "client@exemple.fr");
  assert.equal(destinataireLisible("sms", "0679984514"), "06 79 98 45 14");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Numéro lisible — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
