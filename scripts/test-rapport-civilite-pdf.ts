import assert from "node:assert";
import { composerRapportEntretienPdf } from "../src/server/pdf/rapport-entretien-pdf";
import type { RapportPublic } from "../src/server/repositories/passages-entretien";

/**
 * LE RETOUR D'INTERVENTION DIT « MME » À UNE CLIENTE — sa demande du
 * 19 novembre 2026, « il faut corriger ça ».
 *
 * Vu le 17 novembre sur le vrai PDF : Mme Lefèvre recevait un retour
 * d'intervention adressé à « Mr. Lefèvre ». Le rapport figeait le nom à
 * l'envoi, jamais la civilité ; le PDF retombait alors sur la civilité par
 * défaut d'`avecCivilite`.
 *
 *   A. une cliente : « Mme Lefèvre », jamais « Mr. » ;
 *   B. une entreprise ou une mairie : le nom seul ;
 *   C. un client : « Mr. Bernard », comme avant.
 *
 * **Vue rouge sur le code d'avant** : A lisait « Mr. Lefèvre ».
 */

const BASE: RapportPublic = {
  jour: "2026-11-17",
  minutes: 135,
  observations: null,
  clientNom: "Lefèvre",
  clientCivilite: "mme",
  entrepriseNom: "Perret Paysage",
  faites: [{ famille: "Pelouse", libelle: "Tonte et ébarbage" }],
  signature: null,
};

async function blocClient(rapport: RapportPublic): Promise<string> {
  const { trace } = await composerRapportEntretienPdf({
    rapport,
    entrepriseAdresse: null,
    entrepriseSiret: null,
    entrepriseTelephone: null,
    entrepriseEmail: null,
    entrepriseIban: null,
    clientAdresse: null,
    clientTelephone: null,
  });
  return trace.textes.map((t) => t.contenu).join(" ").replace(/\s+/g, " ");
}

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== La civilité du client sur le retour d'intervention ===\n");

async function main() {
  await essai("A. une cliente : « Mme Lefèvre », jamais « Mr. »", async () => {
    const lu = await blocClient(BASE);
    assert.ok(lu.includes("Mme Lefèvre"), `« Mme Lefèvre » manque : ${lu.slice(0, 300)}`);
    assert.ok(!lu.includes("Mr. Lefèvre"), "La cliente est appelée « Mr. ».");
  });

  await essai("B. une entreprise : le nom seul", async () => {
    const lu = await blocClient({ ...BASE, clientNom: "Mairie de Buchelay", clientCivilite: "public" });
    assert.ok(lu.includes("Mairie de Buchelay"), "Le nom de la mairie manque.");
    assert.ok(!lu.includes("Mr. Mairie"), "La mairie est appelée « Mr. ».");
  });

  await essai("C. un client : « Mr. Bernard », comme avant", async () => {
    const lu = await blocClient({ ...BASE, clientNom: "Bernard", clientCivilite: "mr" });
    assert.ok(lu.includes("Mr. Bernard"), `« Mr. Bernard » manque : ${lu.slice(0, 300)}`);
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le retour d'intervention appelle chacun comme sa fiche.");
  process.exit(echecs ? 1 : 0);
}

main();
