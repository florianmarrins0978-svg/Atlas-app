import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as absencesRepo from "../src/server/repositories/absences-equipe";
import * as equipesRepo from "../src/server/repositories/equipes";
import { nettoyerBase } from "./_test-db";

/**
 * Jouer une requête brute DANS le contexte d'isolation d'une entreprise.
 *
 * **Sans cela, on n'éprouve pas ce qu'on croit.** Le premier jet posait ses
 * `INSERT` directement sur le pool : la RLS les refusait avant que la
 * contrainte n'ait son mot à dire, la suite passait au vert, et son message
 * accusait `absences_equipe_ordre_ck` — qui n'avait jamais parlé. Une erreur
 * qui envoie chercher au mauvais endroit coûte plus cher que pas d'erreur du
 * tout (`AGENTS.md`).
 */
async function dansLEntreprise(entrepriseId: string, sql: string, valeurs: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.entreprise_id', $1, true)", [entrepriseId]);
    const r = await client.query(sql, valeurs);
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Les absences d'équipe, en base — et l'isolation qui les sépare.
//
// *Le patron, le 14 août 2026 : « une équipe qui doit partir en déplacement
// pour cinq jours ».*
//
// **Ce que cette suite tient, et qu'aucune règle pure ne peut dire :** que
// l'écriture atterrit dans la bonne entreprise, que la RLS empêche l'autre de
// la lire OU de la retirer, et que la contrainte de la base refuse une absence
// à l'envers même si le code changeait. Une absence inversée n'occuperait aucun
// jour et rendrait la capacité fausse **en silence** — le pire des défauts,
// celui qui ne se voit qu'au moment où un client retient une date impossible.
//
// **À jouer sous `atlas_app`.** Sous `postgres`, la RLS est TRAVERSÉE et les
// quatre contrôles d'isolation passent sans rien éprouver (`CLAUDE.md` §5).

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

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Absences A" },
    { email: "absences-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Absences B" },
    { email: "absences-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  let idChezA = "";

  await test("Noter une absence : elle s'enregistre avec ses deux bornes", async () => {
    const a = await absencesRepo.noterAbsenceEquipe(A, {
      rang: 2,
      premierJour: "2026-09-08",
      dernierJour: "2026-09-12",
      motif: "Déplacement Lyon",
    });
    assert.ok(a, "aucune absence rendue");
    assert.equal(a.premierJour, "2026-09-08");
    assert.equal(a.dernierJour, "2026-09-12");
    assert.equal(a.rang, 2);
    assert.equal(a.motif, "Déplacement Lyon");
    idChezA = a.id;
  });

  await test("L'équipe est créée au besoin : noter une absence n'exige pas de l'avoir nommée", async () => {
    // L'écran montre des lignes qui n'existent pas encore en base — le patron
    // peut noter l'absence de la troisième équipe sans l'avoir jamais nommée.
    const a = await absencesRepo.noterAbsenceEquipe(A, {
      rang: 5,
      premierJour: "2026-10-01",
      dernierJour: "2026-10-02",
      motif: null,
    });
    assert.ok(a);
    assert.equal(a.nom, null, "un nom a été inventé");
    const equipes = await equipesRepo.listerEquipes(A);
    assert.ok(equipes.some((e) => e.rang === 5), "la ligne d'équipe n'a pas été posée");
  });

  await test("Un motif vide devient NULL, jamais une chaîne vide", async () => {
    // Sans cela, la base porterait deux façons de dire « pas de motif », et
    // l'écran devrait connaître les deux.
    const a = await absencesRepo.noterAbsenceEquipe(A, {
      rang: 1,
      premierJour: "2026-11-03",
      dernierJour: "2026-11-03",
      motif: "   ",
    });
    assert.equal(a?.motif, null);
  });

  await test("Un rang absurde est refusé, et RENDU — jamais levé", async () => {
    // Un refus attendu se rend en valeur : le message d'une exception levée par
    // une action serveur n'atteint jamais l'écran du patron (`AGENTS.md`).
    assert.equal(await absencesRepo.noterAbsenceEquipe(A, { rang: 0, premierJour: "2026-09-08", dernierJour: "2026-09-09", motif: null }), null);
    assert.equal(await absencesRepo.noterAbsenceEquipe(A, { rang: -3, premierJour: "2026-09-08", dernierJour: "2026-09-09", motif: null }), null);
  });

  await test("La liste rend le rang et le nom de l'équipe, pas seulement un identifiant", async () => {
    await equipesRepo.nommerEquipe(A, 2, "Paul");
    const liste = await absencesRepo.listerAbsencesEquipe(A);
    const paul = liste.find((a) => a.id === idChezA);
    assert.ok(paul, "l'absence a disparu de la liste");
    assert.equal(paul.nom, "Paul", "le nom de l'équipe ne remonte pas");
  });

  await test("Une absence terminée sort de la liste, sans être perdue", async () => {
    await absencesRepo.noterAbsenceEquipe(A, {
      rang: 1,
      premierJour: "2020-01-06",
      dernierJour: "2020-01-10",
      motif: "Vieux déplacement",
    });
    const encours = await absencesRepo.listerAbsencesEquipe(A, "2026-08-14");
    assert.ok(
      !encours.some((a) => a.motif === "Vieux déplacement"),
      "une absence de 2020 encombre encore la liste"
    );
    const toutes = await absencesRepo.listerAbsencesEquipe(A);
    assert.ok(
      toutes.some((a) => a.motif === "Vieux déplacement"),
      "l'absence passée a été perdue, alors qu'elle est seulement masquée"
    );
  });

  await test("La fenêtre ne rend que ce qui la croise", async () => {
    const dedans = await absencesRepo.absencesSurLaFenetre(A, "2026-09-01", "2026-09-30");
    assert.ok(dedans.some((a) => a.premierJour === "2026-09-08"), "le déplacement de septembre manque");
    assert.ok(!dedans.some((a) => a.premierJour === "2020-01-06"), "une absence de 2020 traverse la fenêtre");

    // Croisement, pas inclusion : une absence commencée avant la fenêtre et
    // finie dedans compte tout autant.
    const acheval = await absencesRepo.absencesSurLaFenetre(A, "2026-09-10", "2026-09-11");
    assert.ok(acheval.some((a) => a.premierJour === "2026-09-08"), "une absence à cheval est ignorée");
  });

  await test("Isolation : B ne voit AUCUNE absence de A", async () => {
    const liste = await absencesRepo.listerAbsencesEquipe(B);
    assert.equal(liste.length, 0, `B voit ${liste.length} absence(s) de A`);
    const fenetre = await absencesRepo.absencesSurLaFenetre(B, "2026-01-01", "2027-01-01");
    assert.equal(fenetre.length, 0, "la fenêtre de B rend des absences de A");
  });

  await test("Isolation : B ne peut pas retirer une absence de A", async () => {
    const r = await absencesRepo.retirerAbsenceEquipe(B, idChezA);
    assert.equal(r, undefined, "B a pu retirer une absence qui n'est pas la sienne");
    const chezA = await absencesRepo.listerAbsencesEquipe(A);
    assert.ok(chezA.some((a) => a.id === idChezA), "l'absence de A a disparu malgré tout");
  });

  await test("Retirer une absence : elle sort de la liste, et une seule fois", async () => {
    const r = await absencesRepo.retirerAbsenceEquipe(A, idChezA);
    assert.ok(r, "le retrait n'a rien rendu");
    const liste = await absencesRepo.listerAbsencesEquipe(A);
    assert.ok(!liste.some((a) => a.id === idChezA), "l'absence retirée est encore là");

    // Deux fois : `undefined` veut dire « rien n'a bougé », et l'écran doit
    // alors remettre la ligne plutôt que la faire disparaître à tort.
    assert.equal(await absencesRepo.retirerAbsenceEquipe(A, idChezA), undefined);
  });

  await test("La BASE refuse une absence à l'envers, même si le code changeait", async () => {
    // La règle pure la refuse déjà, et l'action serveur la rejoue. Cette
    // contrainte est la troisième ligne : une absence inversée n'occuperait
    // aucun jour et rendrait la capacité fausse sans que rien ne le dise.
    const [equipe] = await equipesRepo.listerEquipes(A);
    assert.ok(equipe, "aucune équipe pour l'essai");
    await assert.rejects(
      dansLEntreprise(
        entA.id,
        `INSERT INTO absences_equipe (entreprise_id, equipe_id, premier_jour, dernier_jour)
         VALUES ($1, $2, '2026-09-12', '2026-09-08')`,
        [entA.id, equipe.id]
      ),
      /absences_equipe_ordre_ck/,
      "la base a accepté une absence qui finit avant de commencer — ou l'a refusée pour un AUTRE motif que sa contrainte d'ordre"
    );

    // **Et elle accepte la même, dans le bon sens.** Sans ce second contrôle,
    // une politique qui refuserait TOUT passerait pour une contrainte qui
    // marche.
    await dansLEntreprise(
      entA.id,
      `INSERT INTO absences_equipe (entreprise_id, equipe_id, premier_jour, dernier_jour)
       VALUES ($1, $2, '2026-12-01', '2026-12-05')`,
      [entA.id, equipe.id]
    );
  });

  await test("Retirer une équipe emporte ses absences, plutôt que de les laisser orphelines", async () => {
    // `CASCADE` et non `SET NULL` : une absence sans équipe retirerait de la
    // capacité sans que rien à l'écran ne dise laquelle.
    const avant = await absencesRepo.listerAbsencesEquipe(A);
    const cible = avant.find((a) => a.rang === 5);
    assert.ok(cible, "l'absence de l'équipe 5 manque");
    const efface = await dansLEntreprise(entA.id, `DELETE FROM equipes WHERE id = $1`, [cible.equipeId]);
    assert.equal(efface.rowCount, 1, "l'équipe n'a pas été retirée : le contrôle ne prouverait rien");
    const apres = await absencesRepo.listerAbsencesEquipe(A);
    assert.ok(!apres.some((a) => a.id === cible.id), "une absence orpheline a survécu à son équipe");
  });

  await pool.end();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
