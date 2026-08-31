// LE VOCABULAIRE PART AVANT L'ÉCOUTE.
//
// **Sa colère du 28 août 2026 :** *« je lui ai dit désherbage mais il comprend
// mal, il m'énerve »* — la dictée écrivait « herbages ».
//
// Atlas connaissait pourtant son vocabulaire, mais ne s'en servait qu'APRÈS,
// pour relire le texte. Une connaissance qui arrive après le mot mal entendu
// n'a jamais servi à rien.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { construireIndiceDictee, MAX_MOTS_INDICE, MOTS_DU_METIER } from "../src/lib/vocabulaire-dictee";
import { indicePourDictee } from "../src/server/ai/indice-dictee";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMot, listerCartes } from "../src/server/repositories/mots-catalogue";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const pg = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("=== Le vocabulaire de la dictée ===\n");

  await test("LE MOT QU'IL A DIT Y EST — « désherbage », celui qui l'a énervé", async () => {
    const indice = construireIndiceDictee();
    assert.match(indice, /désherbage/i, "le mot de sa colère du 28 août n'est pas soufflé");
  });

  await test("SES MOTS PASSENT DEVANT le fond de langue", async () => {
    // Quand la place manque, c'est le fond de langue qu'on sacrifie — jamais ce
    // qu'il a pris la peine d'apprendre à Atlas.
    const indice = construireIndiceDictee(["Rabattage de charmille"]);
    const sien = indice.indexOf("Rabattage de charmille");
    const commun = indice.indexOf("désherbage");
    assert.ok(sien >= 0, "son mot n'est pas dans l'indice");
    assert.ok(sien < commun, "son mot passe APRÈS le fond de langue : il sautera le premier");
  });

  await test("Un mot dit deux fois n'occupe pas deux places", async () => {
    const indice = construireIndiceDictee(["désherbage", "Désherbage", "  désherbage  "]);
    assert.equal((indice.match(/désherbage/gi) ?? []).length, 1);
  });

  await test("L'INDICE EST BORNÉ — les services le tronquent par la fin, sans prévenir", async () => {
    const beaucoup = Array.from({ length: 500 }, (_, i) => `motalui${i}`);
    const indice = construireIndiceDictee(beaucoup);
    const compte = indice.split(", ").length;
    assert.ok(compte <= MAX_MOTS_INDICE, `${compte} mots soufflés au lieu de ${MAX_MOTS_INDICE} au plus`);
    // Et ce sont bien les SIENS qui restent.
    assert.match(indice, /motalui0/);
    assert.doesNotMatch(indice, new RegExp(MOTS_DU_METIER[MOTS_DU_METIER.length - 1]));
  });

  await test("SANS RIEN À LUI, l'indice existe quand même", async () => {
    // Sa première dictée doit marcher avant qu'il ait tapé le moindre mot dans
    // les Réglages : sinon la fonctionnalité ne sert qu'à qui l'a déjà nourrie.
    assert.ok(construireIndiceDictee([]).length > 50);
  });

  await test("EN BASE : ses mots à lui remontent dans l'indice", async () => {
    const marque = `Vocab-${randomUUID().slice(0, 8)}`;
    const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
      { nom: marque },
      { email: `${marque.toLowerCase()}@essai.local`, nom: "Patron" }
    );
    const ctx = { entrepriseId: entreprise.id, utilisateurId };

    const cartes = await listerCartes(ctx, "prestation");
    assert.ok(cartes.length > 0, "aucune entrée de prestation : rien à quoi accrocher un mot");
    const ajout = await ajouterMot(ctx, { entreeId: cartes[0].id, famille: "prestation", mot: "rabattage sévère" });
    assert.equal(ajout.ok, true, "le mot n'a pas pu être ajouté");

    const indice = await indicePourDictee(ctx);
    assert.match(indice, /rabattage sévère/i, "le mot qu'il a appris à Atlas n'arrive pas au transcripteur");
    // Et le fond de langue est toujours là derrière.
    assert.match(indice, /désherbage/i);
  });

  await pg.end();
  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main();
