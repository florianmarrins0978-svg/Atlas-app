import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { aideNoteDevisAMontrer, marquerAideNoteDevisVue } from "../src/server/repositories/aide-note-devis";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// LA FENÊTRE « TA NOTE : TON CLIENT LA LIRA ICI », UNE SEULE FOIS PAR COMPTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa décision du 4 novembre 2026 (migration 0159) : *« seulement pour le
// premier devis de chaque utilisateur ; ensuite la fenêtre ne revient plus
// jamais »*. Ce que la suite défend, sans aucun libellé d'écran :
//   · un compte neuf la voit ;
//   · vue une fois, plus jamais, et la première date reste ;
//   · la voir n'éteint pas celle d'un AUTRE compte, de la même entreprise
//     ni d'une autre : c'est par personne, pas par entreprise.

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

async function compte(suffixe: string): Promise<string> {
  const { utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier Note ${suffixe}` },
    { email: `note-${suffixe}-${Date.now()}@t.test` }
  );
  return utilisateurId;
}

async function main() {
  await nettoyerBase();
  const patron = await compte("a");
  const voisin = await compte("b");

  await test("un compte neuf la voit", async () => {
    assert.equal(await aideNoteDevisAMontrer(patron), true);
  });

  await test("vue une fois, elle ne revient plus jamais, et la première date reste", async () => {
    const premiere = new Date("2026-11-04T08:00:00Z");
    await marquerAideNoteDevisVue(patron, premiere);
    assert.equal(await aideNoteDevisAMontrer(patron), false);
    await marquerAideNoteDevisVue(patron, new Date("2026-11-05T08:00:00Z"));
    const [ligne] = await db.select({ vueLe: users.aideNoteDevisVueLe }).from(users).where(eq(users.id, patron));
    assert.equal(ligne.vueLe?.toISOString(), premiere.toISOString());
  });

  await test("la voir n'éteint pas celle d'un autre compte", async () => {
    assert.equal(await aideNoteDevisAMontrer(voisin), true);
  });

  await test("un compte inconnu ne la voit pas, et rien ne plante", async () => {
    assert.equal(await aideNoteDevisAMontrer("00000000-0000-4000-8000-000000000000"), false);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
