import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, mouvementsEntre, type MouvementEnBase } from "../src/server/repositories/banque";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 1 — chaque ligne du relevé, gardée (migration 0142)
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`**, comme en production : un défaut
// d'isolation ne se voit pas au navigateur, dont le serveur traverse la RLS
// (`CLAUDE.md` §5).
//
// **Ce qu'elle défend** :
//   · les deux sens se rangent, et lire deux fois ne double aucune ligne ;
//   · les lignes se relisent par période, dans l'ordre du relevé ;
//   · une autre entreprise ne voit aucune ligne, et ne peut en écrire aucune
//     chez la première ;
//   · un montant nul ou un sens inconnu est refusé par la base elle-même.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier Relevé ${suffixe}` },
    { email: `releve-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

const sortie = (o: Partial<MouvementEnBase> = {}): MouvementEnBase => ({
  cle: "c1:TOTAL-1",
  date: "2026-10-14",
  montant: "62.40",
  sens: "sortie",
  contrepartie: "TOTALENERGIES",
  libelle: "CB TOTALENERGIES ST JEAN",
  ...o,
});
const entree = (o: Partial<MouvementEnBase> = {}): MouvementEnBase => ({
  cle: "c1:LALA-1",
  date: "2026-10-21",
  montant: "1200.00",
  sens: "entree",
  contrepartie: "LALA",
  libelle: "VIR LALA FACTURE F2026-28",
  ...o,
});

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");

  await test("les deux sens se rangent", async () => {
    assert.equal(await ajouterMouvements(ctx, [sortie(), entree()]), 2);
    const lignes = await mouvementsEntre(ctx, "2026-10-01", "2026-10-31");
    assert.deepEqual(lignes.map((l) => l.sens).sort(), ["entree", "sortie"]);
    const s = lignes.find((l) => l.sens === "sortie");
    assert.equal(s?.contrepartie, "TOTALENERGIES");
    assert.equal(Number(s?.montant), 62.4);
  });

  await test("lire deux fois la banque ne double aucune ligne", async () => {
    assert.equal(await ajouterMouvements(ctx, [sortie(), entree()]), 0);
    assert.equal((await mouvementsEntre(ctx, "2026-10-01", "2026-10-31")).length, 2);
  });

  await test("une ligne nouvelle parmi des connues compte seule", async () => {
    const n = await ajouterMouvements(ctx, [sortie(), sortie({ cle: "c1:POINTP-1", date: "2026-10-12", montant: "318.90", contrepartie: "POINT P" })]);
    assert.equal(n, 1);
  });

  await test("la période se relit bornes comprises, dans l'ordre du relevé", async () => {
    await ajouterMouvements(ctx, [sortie({ cle: "c1:SEPT", date: "2026-09-30" }), sortie({ cle: "c1:NOV", date: "2026-11-01" })]);
    const octobre = await mouvementsEntre(ctx, "2026-10-01", "2026-10-31");
    assert.deepEqual(octobre.map((l) => l.date), ["2026-10-12", "2026-10-14", "2026-10-21"]);
    assert.equal((await mouvementsEntre(ctx, "2026-10-14", "2026-10-14")).length, 1);
  });

  await test("une autre entreprise ne voit aucune ligne", async () => {
    assert.equal((await mouvementsEntre(autre, "2000-01-01", "2100-01-01")).length, 0);
  });

  await test("la même clé chez une autre entreprise est une autre ligne, et ne touche pas la première", async () => {
    assert.equal(await ajouterMouvements(autre, [sortie()]), 1);
    assert.equal((await mouvementsEntre(autre, "2000-01-01", "2100-01-01")).length, 1);
    assert.equal((await mouvementsEntre(ctx, "2000-01-01", "2100-01-01")).length, 5);
  });

  await test("la base refuse un montant nul", async () => {
    await assert.rejects(() => ajouterMouvements(ctx, [sortie({ cle: "c1:ZERO", montant: "0.00" })]));
  });

  await test("la base refuse un sens inconnu", async () => {
    await assert.rejects(() => ajouterMouvements(ctx, [sortie({ cle: "c1:SENS", sens: "virement" as "sortie" })]));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
