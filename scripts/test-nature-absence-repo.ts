// La nature d'une absence, en base (migration 0165) : écrite, relue, gardée
// par les morceaux d'une période, et refusée quand elle n'existe pas.
//
// **Ce que le contrôle défend.** Le geste d'un jour du planning coupe une
// semaine notée dans Équipe en morceaux (`absenceDuJour`) : si les morceaux
// perdaient leur nature, une semaine de congé deviendrait quatre jours « sans
// motif » le jour où il dit qu'un mercredi était une maladie, et le comptable
// recevrait des trous.

import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as absencesRepo from "../src/server/repositories/absences-equipe";
import { nettoyerBase } from "./_test-db";

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

const LUNDI = "2027-03-01";
const MERCREDI = "2027-03-03";
const VENDREDI = "2027-03-05";

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Nature d'absence" },
    { email: "nature-absence@test.local", nom: "N" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  /** La nature de chaque jour de la semaine, pour un rang, lue en base. */
  const naturesDeLaSemaine = async (rang: number) => {
    const lignes = (await absencesRepo.absencesSurLaFenetre(A, LUNDI, VENDREDI)).filter((a) => a.rang === rang);
    return ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05"].map(
      (j) => lignes.find((a) => a.premierJour <= j && j <= a.dernierJour)?.nature ?? null
    );
  };

  await test("Une semaine notée « congé » se relit congé, jour après jour", async () => {
    const a = await absencesRepo.noterAbsenceEquipe(A, {
      rang: 2,
      premierJour: LUNDI,
      dernierJour: VENDREDI,
      motif: "Vacances au ski",
      nature: "conge",
    });
    assert.equal(a?.nature, "conge");
    assert.deepEqual(await naturesDeLaSemaine(2), ["conge", "conge", "conge", "conge", "conge"]);
  });

  await test("Un mercredi dit « maladie » au planning garde le congé des quatre autres jours", async () => {
    await absencesRepo.absenceDuJour(A, { rang: 2, jour: MERCREDI, moment: "journee", nature: "maladie" });
    assert.deepEqual(await naturesDeLaSemaine(2), ["conge", "conge", "maladie", "conge", "conge"]);
  });

  await test("La note libre reste à côté, et elle ne change pas de place", async () => {
    const lignes = (await absencesRepo.listerAbsencesEquipe(A)).filter((a) => a.rang === 2);
    assert.ok(lignes.some((a) => a.motif === "Vacances au ski" && a.nature === "conge"), "la note a quitté le congé");
  });

  await test("Une nature inconnue n'est pas écrite : l'absence se note sans", async () => {
    const a = await absencesRepo.noterAbsenceEquipe(A, {
      rang: 3,
      premierJour: LUNDI,
      dernierJour: LUNDI,
      motif: null,
      nature: "vacances",
    });
    assert.ok(a, "l'absence n'a pas été posée");
    assert.equal(a?.nature, null);
  });

  await test("Une absence notée sans nature reste sans nature, rien ne s'invente", async () => {
    const a = await absencesRepo.noterAbsenceEquipe(A, { rang: 4, premierJour: LUNDI, dernierJour: MERCREDI, motif: null });
    assert.equal(a?.nature, null);
    assert.deepEqual(await naturesDeLaSemaine(4), [null, null, null, null, null]);
  });

  await pool.end();
  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
