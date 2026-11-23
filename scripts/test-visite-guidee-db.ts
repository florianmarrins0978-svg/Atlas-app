import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { carteVisiteAMontrer, marquerCarteVisiteVue } from "../src/server/repositories/visite-guidee";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE « LA VISITE GUIDÉE » DE L'ACCUEIL, UNE SEULE FOIS PAR COMPTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa décision du 23 novembre 2026 (migration 0194) : *« une seule fois au
// premier accueil ; et qu'il puisse, s'il ne veut pas la faire, enlever le
// bouton »*. Ce que la suite défend, sans aucun libellé d'écran :
//   · un compte neuf la voit ;
//   · suivie ou refusée une fois, plus jamais, et la première date reste ;
//   · la marquer pour un compte n'éteint pas celle d'un AUTRE ;
//   · elle passe par `atlas_app`, le rôle de l'appli, qui n'a sur `users` que
//     les colonnes qu'on lui donne (migration 0064).

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
    { nom: `Atelier Visite ${suffixe}` },
    { email: `visite-${suffixe}-${Date.now()}@t.test` }
  );
  return utilisateurId;
}

async function main() {
  await nettoyerBase();
  const patron = await compte("a");
  const voisin = await compte("b");

  await test("un compte neuf la voit", async () => {
    assert.equal(await carteVisiteAMontrer(patron), true);
  });

  await test("suivie ou refusée une fois, elle ne revient plus, et la première date reste", async () => {
    const premiere = new Date("2026-11-23T08:00:00Z");
    await marquerCarteVisiteVue(patron, premiere);
    assert.equal(await carteVisiteAMontrer(patron), false);
    await marquerCarteVisiteVue(patron, new Date("2026-11-24T08:00:00Z"));
    const [ligne] = await db.select({ vueLe: users.visiteGuideeVueLe }).from(users).where(eq(users.id, patron));
    assert.equal(ligne.vueLe?.toISOString(), premiere.toISOString());
  });

  await test("la marquer n'éteint pas celle d'un autre compte", async () => {
    assert.equal(await carteVisiteAMontrer(voisin), true);
  });

  await test("un compte inconnu ne la voit pas, et rien ne plante", async () => {
    assert.equal(await carteVisiteAMontrer("00000000-0000-4000-8000-000000000000"), false);
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
