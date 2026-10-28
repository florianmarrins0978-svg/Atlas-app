import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as absencesRepo from "../src/server/repositories/absences-equipe";
import { creneauxOccupesParAbsence } from "../src/lib/absences-equipe";
import { nettoyerBase } from "./_test-db";

// Le geste d'UN jour, sur le planning, ne touche qu'à ce jour.
//
// **Le défaut, trouvé le 27 octobre 2026 en relisant sa planche « Salarié
// absent ».** Une semaine d'absence notée dans Réglages, Équipe se lit aussi
// sur le planning, jour par jour. Y toucher « Julien, annuler » un mercredi
// appelait `retirerAbsenceEquipe` sur la ligne entière : la semaine disparaissait
// d'un appui, sans un mot, et ses dates redevenaient proposables au client.
//
// **Ce que la suite tient** : rendre Julien présent un jour, ou le dire absent
// un matin seulement, garde les autres jours de sa période ; et le tout se fait
// sous `atlas_app`, donc sous la RLS (`CLAUDE.md` §5).

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

/** Les demi-journées où la personne manque, lues en base, triées. */
async function demiJourneesAbsentes(ctx: Parameters<typeof absencesRepo.absencesSurLaFenetre>[0], rang: number) {
  const lignes = await absencesRepo.absencesSurLaFenetre(ctx, LUNDI, VENDREDI);
  return lignes
    .filter((a) => a.rang === rang)
    .flatMap((a) => creneauxOccupesParAbsence(a).map((c) => `${c.jour} ${c.moment}`))
    .sort();
}

const semaine = (sauf: string[] = []) =>
  ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05"]
    .flatMap((j) => [`${j} matin`, `${j} apres_midi`])
    .filter((c) => !sauf.includes(c))
    .sort();

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Absence d'un jour" },
    { email: "absence-jour@test.local", nom: "A" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  const poserLaSemaine = async (rang: number) => {
    const a = await absencesRepo.noterAbsenceEquipe(A, { rang, premierJour: LUNDI, dernierJour: VENDREDI, motif: "Congés" });
    assert.ok(a, "la semaine d'absence n'a pas été posée");
  };

  await test("Rendre Julien présent le mercredi garde ses quatre autres jours", async () => {
    await poserLaSemaine(2);
    await absencesRepo.absenceDuJour(A, { rang: 2, jour: MERCREDI, moment: null });
    assert.deepEqual(
      await demiJourneesAbsentes(A, 2),
      semaine(["2027-03-03 matin", "2027-03-03 apres_midi"]),
      "la semaine n'a pas survécu au geste d'un seul jour"
    );
  });

  await test("Le dire absent le matin seulement, au milieu de la semaine, rend l'après-midi", async () => {
    await poserLaSemaine(3);
    await absencesRepo.absenceDuJour(A, { rang: 3, jour: MERCREDI, moment: "matin" });
    assert.deepEqual(await demiJourneesAbsentes(A, 3), semaine(["2027-03-03 apres_midi"]));
  });

  await test("Le premier et le dernier jour se rendent aussi sans toucher au reste", async () => {
    await poserLaSemaine(4);
    await absencesRepo.absenceDuJour(A, { rang: 4, jour: LUNDI, moment: null });
    await absencesRepo.absenceDuJour(A, { rang: 4, jour: VENDREDI, moment: "apres_midi" });
    assert.deepEqual(
      await demiJourneesAbsentes(A, 4),
      semaine(["2027-03-01 matin", "2027-03-01 apres_midi", "2027-03-05 matin"])
    );
  });

  await test("Un jour sans absence se ferme, puis se rouvre", async () => {
    await absencesRepo.absenceDuJour(A, { rang: 5, jour: MERCREDI, moment: "journee" });
    assert.deepEqual(await demiJourneesAbsentes(A, 5), ["2027-03-03 apres_midi", "2027-03-03 matin"].sort());
    await absencesRepo.absenceDuJour(A, { rang: 5, jour: MERCREDI, moment: null });
    assert.deepEqual(await demiJourneesAbsentes(A, 5), []);
  });

  await test("Les autres salariés ne bougent pas", async () => {
    assert.deepEqual(await demiJourneesAbsentes(A, 2), semaine(["2027-03-03 matin", "2027-03-03 apres_midi"]));
  });

  await test("Les deux morceaux d'une semaine coupée gardent son motif", async () => {
    const lignes = (await absencesRepo.listerAbsencesEquipe(A)).filter((a) => a.rang === 2);
    assert.equal(lignes.length, 2, `${lignes.length} ligne(s) au lieu des deux morceaux`);
    assert.ok(lignes.every((a) => a.motif === "Congés"), "un morceau a perdu le motif de la période");
  });

  await test("Isolation : une autre entreprise ne touche pas à ces absences", async () => {
    const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Voisine" },
      { email: "absence-jour-b@test.local", nom: "B" }
    );
    const B = { entrepriseId: entB.id, utilisateurId: userB };
    const r = await absencesRepo.absenceDuJour(B, { rang: 2, jour: LUNDI, moment: null });
    assert.deepEqual(r?.retirees ?? [], [], "B a retiré une ligne qui n'est pas la sienne");
    assert.deepEqual(await demiJourneesAbsentes(A, 2), semaine(["2027-03-03 matin", "2027-03-03 apres_midi"]));
  });

  await test("Un rang absurde est refusé et rendu, jamais levé", async () => {
    assert.equal(await absencesRepo.absenceDuJour(A, { rang: 0, jour: LUNDI, moment: "journee" }), null);
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
