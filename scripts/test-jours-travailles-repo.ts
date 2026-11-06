// Les jours travaillés, en base (migrations 0166 et 0167) : le calcul relu sur
// les absences notées, la correction écrite et défaite, le cloisonnement entre
// deux entreprises, et le réglage des zones.
//
// **Ce que le contrôle défend.** Le chiffre corrigé part chez le comptable et
// sert à la paie : une correction perdue, ou lue chez une autre entreprise,
// ferait payer un salarié sur le mauvais nombre de jours.

import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as absencesRepo from "../src/server/repositories/absences-equipe";
import * as joursRepo from "../src/server/repositories/jours-travailles";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { MODELES } from "../src/lib/zones-deplacement";
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

// Novembre 2026 : vingt jours ouvrés, l'Armistice un mercredi.
const MOIS = "2026-11";

async function main() {
  await nettoyerBase();
  const a = await entreprisesRepo.creerEntreprise({ nom: "Entreprise Jours A" }, { email: "jours-a@test.local", nom: "A" });
  const b = await entreprisesRepo.creerEntreprise({ nom: "Entreprise Jours B" }, { email: "jours-b@test.local", nom: "B" });
  const A = { entrepriseId: a.entreprise.id, utilisateurId: a.utilisateurId };
  const B = { entrepriseId: b.entreprise.id, utilisateurId: b.utilisateurId };
  await entreprisesRepo.mettreAJourEntreprise(A, { nombreSalaries: 2 });
  await entreprisesRepo.mettreAJourEntreprise(B, { nombreSalaries: 2 });

  const salarie = async (ctx: typeof A, rang: number) => (await joursRepo.moisDesSalaries(ctx, MOIS)).salaries.find((s) => s.rang === rang)!;

  await test("Sans absence, chaque salarié compte les vingt jours ouvrés de novembre", async () => {
    const lu = await joursRepo.moisDesSalaries(A, MOIS);
    assert.equal(lu.ouvres, 20);
    assert.deepEqual(lu.salaries.map((s) => s.compte.calcul), [20, 20]);
    assert.equal(lu.reglage, null, "jamais réglé : l'écran doit pouvoir inviter");
  });

  await test("Un congé noté retire ses jours, et sa nature se lit", async () => {
    await absencesRepo.noterAbsenceEquipe(A, { rang: 2, premierJour: "2026-11-23", dernierJour: "2026-11-24", motif: null, nature: "conge" });
    const s = await salarie(A, 2);
    assert.equal(s.compte.calcul, 18);
    assert.equal(s.compte.absences[0]?.nature, "conge");
  });

  await test("Le chiffre corrigé et son motif s'écrivent, et le calcul reste à côté", async () => {
    assert.equal(await joursRepo.corrigerLeMois(A, { rang: 2, mois: MOIS, jours: 15, motif: "maladie" }), true);
    const s = await salarie(A, 2);
    assert.equal(s.saisi, 15);
    assert.equal(s.motif, "maladie");
    assert.equal(s.compte.calcul, 18);
  });

  await test("Un motif qui ne va pas dans le sens de l'écart n'est pas gardé", async () => {
    await joursRepo.corrigerLeMois(A, { rang: 2, mois: MOIS, motif: "samedi" });
    assert.equal((await salarie(A, 2)).motif, null);
  });

  await test("Un chiffre qui n'est pas une demi-journée est refusé, rien ne s'écrit", async () => {
    assert.equal(await joursRepo.corrigerLeMois(A, { rang: 2, mois: MOIS, jours: 15.3 }), false);
    assert.equal((await salarie(A, 2)).saisi, 15);
  });

  await test("L'autre entreprise ne voit rien de cette correction", async () => {
    // Lu sous la RLS de B, comme l'écran : une requête nue sur la table ne
    // verrait rien des deux côtés, et le contrôle serait vert sur du vide.
    assert.equal((await salarie(B, 2)).saisi, null);
    assert.equal(((await exporterEntreprise(B)).tables.jours_travailles_corriges as unknown[]).length, 0);
  });

  await test("Remettre le chiffre du calcul efface la ligne : une absence notée ensuite le changera", async () => {
    assert.equal(((await exporterEntreprise(A)).tables.jours_travailles_corriges as unknown[]).length, 1, "la correction n'était pas en base");
    await joursRepo.corrigerLeMois(A, { rang: 2, mois: MOIS, jours: 18, motif: null });
    assert.equal(((await exporterEntreprise(A)).tables.jours_travailles_corriges as unknown[]).length, 0);
    await absencesRepo.noterAbsenceEquipe(A, { rang: 2, premierJour: "2026-11-02", dernierJour: "2026-11-02", motif: null, nature: "maladie" });
    assert.equal((await salarie(A, 2)).compte.calcul, 17);
  });

  await test("Les zones réglées paraissent, et la teinte se change seule", async () => {
    await joursRepo.ecrireReglageZones(A, { convention: "paysage", zones: MODELES.paysage.zones, teinte: "turquoise", depart: null });
    assert.equal(await joursRepo.changerLaTeinte(A, "violet"), true);
    assert.equal(await joursRepo.changerLaTeinte(A, "fuchsia"), false);
    const lu = await joursRepo.moisDesSalaries(A, MOIS);
    assert.equal(lu.reglage?.teinte, "violet");
    assert.equal(lu.reglage?.zones.length, 4);
    // Le siège n'est pas situé : un jour de chantier n'a pas de zone, mais un
    // jour au dépôt compte en zone 1.
    assert.ok(lu.salaries[0].zones, "les zones doivent se compter");
    assert.equal(lu.salaries[0].zones?.parZone[0], 20);
    assert.equal((await joursRepo.moisDesSalaries(B, MOIS)).reglage, null, "le réglage de A a fui chez B");
  });

  await test("La sauvegarde de l'entreprise emporte ses corrections", async () => {
    await joursRepo.corrigerLeMois(A, { rang: 1, mois: MOIS, jours: 21, motif: "samedi" });
    const e = await exporterEntreprise(A);
    const lignes = e.tables.jours_travailles_corriges as { rang: number; jours: string }[];
    assert.equal(lignes.length, 1);
    assert.equal(Number(lignes[0].jours), 21);
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
