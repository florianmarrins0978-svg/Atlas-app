import assert from "node:assert";
import { horsPerimetre, REPONSE_HORS_PERIMETRE } from "../src/lib/perimetre-assistant";

/**
 * L'assistant ne parle que d'Atlas — et il faut le PROUVER, pas l'espérer.
 *
 * **Sa demande du 26 août 2026 :** *« si on lui demande est-ce que le CGR de
 * Mantes est ouvert, il ne doit pas y répondre. Mais toutes les questions ou
 * les gestes pour l'appli, il doit pouvoir le faire. »*
 *
 * **Les deux moitiés comptent autant.** Une suite qui n'éprouverait que le
 * refus laisserait passer un filtre qui refuse TOUT — et l'on ne s'en
 * apercevrait qu'à l'usage, sur une vraie question restée sans réponse. La
 * seconde moitié de cette suite est donc la plus importante : les faux
 * positifs.
 */

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

/** Ce qui doit être refusé — sa question du 26 août en tête. */
const DEHORS = [
  "est-ce que le CGR de Mantes est ouvert ?",
  "le cinéma de Mantes passe quoi ce soir ?",
  "quel temps fait-il demain ?",
  "est-ce qu'il va pleuvoir demain ?",
  "donne-moi une recette de tarte aux pommes",
  "qui est le président de la République ?",
  "traduis bonjour en anglais",
  "raconte-moi une blague",
  "écris-moi une fonction python",
  "quel est le résultat du match ?",
  "quels sont les horaires d'ouverture ?",
  "j'ai mal à la tête, quel médicament prendre ?",
];

/**
 * Ce qui doit PASSER — et chacun est un piège réel.
 *
 * « Combien de temps a pris le chantier » porte le mot « temps » ; « un
 * chantier au cinéma » porte le mot « cinéma » ; « la facture de l'hôtel »
 * porte « hotel ». Les refuser serait exactement le défaut que ce fichier
 * cherche à éviter.
 */
const DEDANS = [
  "comment je supprime un chantier ?",
  "combien de temps a pris le chantier de Bernard ?",
  "j'ai un chantier au cinéma de Mantes, planifie-le lundi",
  "la facture de l'hôtel des Voyageurs est partie ?",
  "crée un tarif élagage à 450 €",
  "corrige le téléphone de Bernard",
  "quel est le prix de la tonte chez Durand ?",
  "prépare la facture du chantier terminé",
  "où je vois ma TVA ?",
  "note sur le chantier : le client est absent le matin",
  "mets le mode sombre",
  "bonjour",
];

function main() {
  test("Sa question du 26 août est refusée, mot pour mot", () => {
    const v = horsPerimetre("est-ce que le CGR de Mantes est ouvert ?");
    assert.equal(v.dehors, true);
  });

  test("Tout ce qui est franchement dehors est refusé", () => {
    const passes = DEHORS.filter((q) => !horsPerimetre(q).dehors);
    assert.deepEqual(passes, [], `Ces questions auraient dû être refusées :\n  ${passes.join("\n  ")}`);
  });

  test("RIEN de ce qui touche à Atlas n'est refusé — c'est le plus important", () => {
    const refuses = DEDANS.filter((q) => horsPerimetre(q).dehors);
    assert.deepEqual(
      refuses,
      [],
      `Un garde-fou qui parle à tort s'apprend à être ignoré. Refusées à tort :\n  ${refuses.join("\n  ")}`
    );
  });

  test("Un mot d'Atlas suffit à garder la question, même à côté d'un mot du dehors", () => {
    // La règle des DEUX conditions, prise à l'endroit où elle se joue.
    assert.equal(horsPerimetre("le cinéma de Mantes").dehors, true);
    assert.equal(horsPerimetre("le chantier du cinéma de Mantes").dehors, false);
  });

  test("Une question vide ne se fait pas refuser", () => {
    assert.equal(horsPerimetre("").dehors, false);
    assert.equal(horsPerimetre("   ").dehors, false);
  });

  test("Le refus tient en une phrase, sans excuse ni porte entrouverte", () => {
    assert.ok(REPONSE_HORS_PERIMETRE.length < 60, "Le moins de mots possible — sa règle du 25 août");
    assert.ok(!/désolé|desole|mais je|toutefois|cependant/i.test(REPONSE_HORS_PERIMETRE));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main();
