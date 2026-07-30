import assert from "node:assert";
import { Pool, type QueryResult } from "pg";
import { nettoyerBase } from "./_test-db";

// Suite de tests de la couche de données, exécutée directement contre
// PostgreSQL (atlas_test) — indépendante de Drizzle, pour tester les mécanismes
// eux-mêmes (CHECK, FK composites, RLS, triggers), pas une couche d'abstraction.
//
// Lancer : DATABASE_URL=postgresql://atlas_owner:...@127.0.0.1:5432/atlas_test npx tsx scripts/db-tests.ts

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function assertRejects(promise: Promise<unknown>, motifAttendu?: RegExp) {
  try {
    await promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (motifAttendu && !motifAttendu.test(message)) {
      throw new Error(`Rejeté mais avec un message inattendu: ${message}`);
    }
    return;
  }
  throw new Error("Attendu : rejet, obtenu : succès");
}

async function nettoyer() {
  await nettoyerBase();
}

// Crée une entreprise + utilisateur + adhésion, retourne leurs id.
async function creerEntrepriseComplete(nom: string) {
  const { rows: eRows } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = eRows[0].id as string;
  const { rows: uRows } = await pool.query(
    `INSERT INTO users (email, nom) VALUES ($1, $2) RETURNING id`,
    [`${nom.toLowerCase().replace(/\s/g, "-")}@test.local`, nom]
  );
  const utilisateurId = uRows[0].id as string;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`, [
      entrepriseId,
      utilisateurId,
    ]);
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId };
}

// Exécute fn dans une transaction avec le contexte RLS fixé sur entrepriseId (ou aucun si null).
async function avecContexte<T>(entrepriseId: string | null, fn: (query: (text: string, params?: unknown[]) => Promise<QueryResult>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (entrepriseId) {
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    }
    const result = await fn((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  await nettoyer();

  // ===================================================================
  // 1. INTÉGRITÉ — contraintes CHECK et clés étrangères composites
  // ===================================================================

  const { entrepriseId: A } = await creerEntrepriseComplete("Entreprise A");
  const { entrepriseId: B } = await creerEntrepriseComplete("Entreprise B");

  await test("CHECK : un tarif négatif est rejeté", async () => {
    await assertRejects(
      avecContexte(A, (q) => q(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1,'Test',-10)`, [A])),
      /tarifs_prix_non_negatif/
    );
  });

  await test("CHECK : un taux de TVA négatif est rejeté", async () => {
    await assertRejects(
      avecContexte(A, (q) =>
        q(
          `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Chantier X') RETURNING id`,
          [A]
        ).then(async (r) => {
          const chantierId = r.rows[0].id;
          return q(
            `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version, entreprise_nom, date_emission, taux_tva, total_ht, total_tva, total_ttc)
             VALUES ($1,$2,'X-1',1,'E',now(),-5,100,20,120)`,
            [A, chantierId]
          );
        })
      ),
      /devis_taux_tva_non_negatif/
    );
  });

  await test("CHECK : total_ttc doit être exactement total_ht + total_tva", async () => {
    await assertRejects(
      avecContexte(A, (q) =>
        q(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Chantier Y') RETURNING id`, [A]).then((r) =>
          q(
            `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version, entreprise_nom, date_emission, taux_tva, total_ht, total_tva, total_ttc)
             VALUES ($1,$2,'Y-1',1,'E',now(),20,100,20,999)`,
            [A, r.rows[0].id]
          )
        )
      ),
      /devis_total_ttc_coherent/
    );
  });

  await test("FK composite : un chantier ne peut pas référencer un client d'une autre entreprise", async () => {
    const { rows } = await avecContexte(B, (q) => q(`INSERT INTO clients (entreprise_id, nom) VALUES ($1,'Client B') RETURNING id`, [B]));
    const clientDeB = rows[0].id;
    await assertRejects(
      avecContexte(A, (q) =>
        q(`INSERT INTO chantiers (entreprise_id, client_id, nom) VALUES ($1,$2,'Chantier avec client étranger')`, [A, clientDeB])
      )
    );
  });

  await test("FK composite : une photo ne peut pas porter un entreprise_id différent de son chantier", async () => {
    const { rows } = await avecContexte(A, (q) => q(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Chantier Z') RETURNING id`, [A]));
    const chantierDeA = rows[0].id;
    // Tente d'insérer une photo prétendant appartenir à B mais pointant sur un chantier de A.
    await assertRejects(
      avecContexte(null, (q) =>
        q(
          `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','image/jpeg',10,'c')`,
          [B, chantierDeA]
        )
      )
    );
  });

  // ===================================================================
  // 2. ISOLATION — lecture, écriture, fail-closed
  // ===================================================================

  await avecContexte(A, (q) => q(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Visible par A seulement')`, [A]));
  await avecContexte(B, (q) => q(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Visible par B seulement')`, [B]));

  await test("Isolation lecture : le contexte A ne voit aucun chantier de B", async () => {
    const { rows } = await avecContexte(A, (q) => q(`SELECT nom FROM chantiers`));
    assert.ok(rows.every((r: { nom: string }) => r.nom !== "Visible par B seulement"), "Une ligne de B a fuité vers A");
    assert.ok(rows.some((r: { nom: string }) => r.nom === "Visible par A seulement"), "A ne voit même pas ses propres données");
  });

  await test("Isolation écriture (WITH CHECK) : impossible d'insérer un tarif pour B sous le contexte A", async () => {
    await assertRejects(avecContexte(A, (q) => q(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1,'Fuite',10)`, [B])));
  });

  await test("Isolation mise à jour : impossible de transférer une ligne existante vers une autre entreprise", async () => {
    const { rows } = await avecContexte(A, (q) => q(`SELECT id FROM tarifs LIMIT 1`));
    if (rows.length === 0) {
      await avecContexte(A, (q) => q(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1,'T',10)`, [A]));
    }
    const { rows: r2 } = await avecContexte(A, (q) => q(`SELECT id FROM tarifs LIMIT 1`));
    await assertRejects(avecContexte(A, (q) => q(`UPDATE tarifs SET entreprise_id = $1 WHERE id = $2`, [B, r2[0].id])));
  });

  await test("Fail-closed : sans contexte défini, aucune ligne n'est visible (pas d'erreur, 0 résultat)", async () => {
    const { rows } = await avecContexte(null, (q) => q(`SELECT * FROM chantiers`));
    assert.equal(rows.length, 0, "Des lignes sont visibles sans contexte d'entreprise — RLS ne fail-close pas");
  });

  await test("Fail-closed : sans contexte défini, une insertion est rejetée (WITH CHECK échoue sur NULL)", async () => {
    await assertRejects(avecContexte(null, (q) => q(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1,'Sans contexte',10)`, [A])));
  });

  await test("Rôle applicatif atlas_app : NOBYPASSRLS confirmé", async () => {
    const { rows } = await pool.query(`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'atlas_app'`);
    assert.equal(rows[0].rolbypassrls, false, "atlas_app ne doit jamais avoir BYPASSRLS");
  });

  // ===================================================================
  // 3. CONCURRENCE — numérotation des devis
  // ===================================================================

  await test("Concurrence : deux générations simultanées de numéro de devis ne produisent jamais de doublon", async () => {
    async function attribuer(): Promise<number> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A]);
        const { rows } = await client.query(
          `UPDATE entreprise_compteurs SET prochain_numero_devis = prochain_numero_devis + 1
           WHERE entreprise_id = $1 RETURNING prochain_numero_devis - 1 AS numero`,
          [A]
        );
        await client.query("COMMIT");
        return rows[0].numero;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    const [n1, n2] = await Promise.all([attribuer(), attribuer()]);
    assert.notEqual(n1, n2, `Deux numéros identiques attribués en concurrence : ${n1} et ${n2}`);
  });

  // ===================================================================
  // 4. IMMUABILITÉ DES DEVIS ENVOYÉS
  // ===================================================================

  const { rows: chRows } = await avecContexte(A, (q) => q(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Chantier devis') RETURNING id`, [A]));
  const chantierDevisId = chRows[0].id;

  const { rows: devisRows } = await avecContexte(A, (q) =>
    q(
      `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version, statut, entreprise_nom, date_emission, taux_tva, total_ht, total_tva, total_ttc)
       VALUES ($1,$2,'IMM-1',1,'brouillon','E',now(),20,100,20,120) RETURNING id`,
      [A, chantierDevisId]
    )
  );
  const devisId = devisRows[0].id;

  await avecContexte(A, (q) =>
    q(`INSERT INTO lignes_devis (entreprise_id, devis_id, libelle, prix_unitaire, montant) VALUES ($1,$2,'Ligne test',100,100)`, [A, devisId])
  );

  await test("Transition brouillon → envoyé autorisée", async () => {
    await avecContexte(A, (q) => q(`UPDATE devis SET statut = 'envoye', envoye_le = now() WHERE id = $1`, [devisId]));
    const { rows } = await avecContexte(A, (q) => q(`SELECT statut FROM devis WHERE id = $1`, [devisId]));
    assert.equal(rows[0].statut, "envoye");
  });

  await test("Immuabilité : impossible de modifier un devis envoyé", async () => {
    await assertRejects(
      avecContexte(A, (q) => q(`UPDATE devis SET total_ht = 999 WHERE id = $1`, [devisId])),
      /immuable/
    );
  });

  await test("Immuabilité : impossible de supprimer un devis envoyé", async () => {
    await assertRejects(
      avecContexte(A, (q) => q(`DELETE FROM devis WHERE id = $1`, [devisId])),
      /supprimé/
    );
  });

  await test("Immuabilité : impossible de modifier une ligne d'un devis envoyé", async () => {
    const { rows } = await avecContexte(A, (q) => q(`SELECT id FROM lignes_devis WHERE devis_id = $1`, [devisId]));
    await assertRejects(
      avecContexte(A, (q) => q(`UPDATE lignes_devis SET montant = 1 WHERE id = $1`, [rows[0].id])),
      /devis envoyé/
    );
  });

  await test("Immuabilité : impossible d'ajouter une ligne à un devis envoyé", async () => {
    await assertRejects(
      avecContexte(A, (q) =>
        q(`INSERT INTO lignes_devis (entreprise_id, devis_id, libelle, prix_unitaire, montant) VALUES ($1,$2,'Nouvelle',1,1)`, [A, devisId])
      ),
      /devis envoyé/
    );
  });

  await test("Immuabilité : impossible de supprimer une ligne d'un devis envoyé", async () => {
    const { rows } = await avecContexte(A, (q) => q(`SELECT id FROM lignes_devis WHERE devis_id = $1`, [devisId]));
    await assertRejects(
      avecContexte(A, (q) => q(`DELETE FROM lignes_devis WHERE id = $1`, [rows[0].id])),
      /devis envoyé/
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
