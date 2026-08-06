import assert from "node:assert";
import { pool } from "../src/server/db/client";
import { AccesRefuseError } from "../src/server/db/with-entreprise";
import { leconsComparables, retenirLecon } from "../src/server/repositories/lecons-prix";
import { ajouterLignePrix, modifierLignePrix, supprimerLignePrix } from "../src/server/repositories/lignes-prix";
import { rappelDePrix } from "../src/lib/lecons-prix";
import { nettoyerBase } from "./_test-db";

// La mémoire des corrections, éprouvée contre la base.
//
// Trois promesses, et la troisième est la plus facile à perdre de vue :
//
// 1. **Elle retient sa décision**, pas les chiffres qu'il a tapés en chemin.
// 2. **Elle ne rapproche jamais deux prix qui diffèrent** — 600 € contre
//    1 400 € sur le même chêne.
// 3. **Elle n'empêche jamais d'écrire un devis.** Une ligne dont on ne sait
//    rien tirer doit s'enregistrer quand même : l'apprentissage ne gêne pas le
//    travail.

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

async function creerEntrepriseComplete(nom: string) {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/\s/g, "-")}@test.local`,
    nom,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`,
      [entrepriseId, utilisateurId]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId };
}

async function creerChantier(ctx: { entrepriseId: string }, nom: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ctx.entrepriseId]);
    const { rows } = await client.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`,
      [ctx.entrepriseId, nom]
    );
    return rows[0].id as string;
  } finally {
    client.release();
  }
}

const CHENE_RETENTION = "Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm";
const CHENE_AU_PIED = "Abattage d'un chêne mort — abattage au pied, ⌀ 70 cm";

async function main() {
  await nettoyerBase();
  const A = await creerEntrepriseComplete("Lecons A");
  const B = await creerEntrepriseComplete("Lecons B");

  await test("ce qu'il retient devient une leçon", async () => {
    const chantier = await creerChantier(A, "Chantier 1");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_RETENTION, "1400.00");
    assert.equal(await retenirLecon(A, ligne.id), true);

    const lecons = await leconsComparables(A, CHENE_RETENTION);
    assert.equal(lecons.length, 1);
    assert.equal(lecons[0]!.prix, "1400.00");
    assert.equal(lecons[0]!.libelle, CHENE_RETENTION);
  });

  await test("ses chiffres tapés en chemin ne polluent pas la mémoire", async () => {
    // Il tape 1, puis 14, puis 140, puis 1400 — un enregistrement par champ
    // quitté. Compter chacun ferait une moyenne de valeurs qui n'ont jamais été
    // des décisions.
    const chantier = await creerChantier(A, "Chantier 2");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_RETENTION, "1.00");
    for (const etape of ["1.00", "14.00", "140.00", "1400.00"]) {
      await modifierLignePrix(A, ligne.id, { montant: etape });
      await retenirLecon(A, ligne.id);
    }
    const surCeChantier = (await leconsComparables(A, CHENE_RETENTION)).filter(
      (l) => l.prix === "1400.00"
    );
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM lecons_prix WHERE ligne_prix_id = $1`,
      [ligne.id]
    );
    assert.equal(rows[0].n, 1, "chaque frappe a laissé une ligne dans la mémoire");
    assert.ok(surCeChantier.length >= 1, "sa décision finale n'a pas été retenue");
  });

  await test("DEUX TECHNIQUES NE SE RAPPROCHENT PAS — 800 € d'écart", async () => {
    const chantier = await creerChantier(A, "Chantier 3");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_AU_PIED, "600.00");
    await retenirLecon(A, ligne.id);

    const pourRetention = await leconsComparables(A, CHENE_RETENTION);
    assert.ok(
      pourRetention.every((l) => l.prix !== "600.00"),
      "un abattage au pied est rappelé pour un démontage avec rétention"
    );
    const pourAuPied = await leconsComparables(A, CHENE_AU_PIED);
    assert.ok(pourAuPied.some((l) => l.prix === "600.00"), "sa propre leçon ne se retrouve pas");
  });

  await test("le chantier en cours ne se rappelle pas son propre prix", async () => {
    // Afficher « la dernière fois : 1 400 € » juste sous une ligne à 1 400 €
    // n'apprend rien et donne l'impression d'un agent qui radote.
    const chantier = await creerChantier(A, "Chantier 4");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_RETENTION, "1500.00");
    await retenirLecon(A, ligne.id);
    const vues = await leconsComparables(A, CHENE_RETENTION, { chantierExclu: chantier });
    assert.ok(vues.every((l) => l.prix !== "1500.00"), "le chantier en cours se cite lui-même");
  });

  await test("une ligne sans métier reconnaissable n'apprend rien — et s'enregistre quand même", async () => {
    // La promesse qui compte : l'apprentissage ne gêne jamais le travail.
    const chantier = await creerChantier(A, "Chantier 5");
    const ligne = await ajouterLignePrix(A, chantier, "Déplacement", "80.00");
    assert.equal(await retenirLecon(A, ligne.id), false, "« Déplacement » ne devrait rien apprendre");
    const { rows } = await pool.query(`SELECT montant FROM lignes_prix WHERE id = $1`, [ligne.id]);
    assert.equal(rows[0].montant, "80.00", "la ligne du patron n'a pas survécu à l'échec de la leçon");
  });

  await test("un prix nul n'est pas une décision", async () => {
    const chantier = await creerChantier(A, "Chantier 6");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_RETENTION, "0.00");
    assert.equal(await retenirLecon(A, ligne.id), false);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM lecons_prix WHERE ligne_prix_id=$1`, [
      ligne.id,
    ]);
    assert.equal(rows[0].n, 0, "une ligne vide a été retenue : le rappel dira « 0 € »");
  });

  await test("un prix effacé cesse d'être une leçon", async () => {
    const chantier = await creerChantier(A, "Chantier 7");
    const ligne = await ajouterLignePrix(A, chantier, CHENE_RETENTION, "1300.00");
    await retenirLecon(A, ligne.id);
    await supprimerLignePrix(A, ligne.id);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM lecons_prix WHERE ligne_prix_id=$1`, [
      ligne.id,
    ]);
    assert.equal(rows[0].n, 0, "une leçon survit à la ligne que le patron a retirée");
  });

  await test("ISOLATION : B ne voit rien de ce que A a appris", async () => {
    const vues = await leconsComparables(B, CHENE_RETENTION);
    assert.deepEqual(vues, [], "les prix de A sont visibles depuis B — c'est son barème qui fuit");
  });

  await test("ISOLATION : un utilisateur étranger est refusé", async () => {
    await assert.rejects(
      () => leconsComparables({ utilisateurId: B.utilisateurId, entrepriseId: A.entrepriseId }, CHENE_RETENTION),
      AccesRefuseError
    );
  });

  await test("le rappel bâti sur la vraie mémoire dit d'où il vient", async () => {
    // Le bout en bout : ce qu'il a retenu ressort en une phrase qu'il peut
    // vérifier d'un coup d'œil.
    const lecons = await leconsComparables(A, CHENE_RETENTION);
    const rappel = rappelDePrix(lecons);
    assert.ok(rappel, "aucun rappel alors que la mémoire porte des leçons");
    assert.match(rappel.phrase, /dernière fois/i);
    assert.match(rappel.prix, /^\d+0$/, `le prix rappelé n'est pas rond : ${rappel.prix}`);
  });

  console.log(`\n${passed} réussis, ${failed} échoués.`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

void main();
