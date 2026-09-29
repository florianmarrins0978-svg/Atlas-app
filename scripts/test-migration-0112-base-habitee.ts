import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * **LA MIGRATION 0112 VOIT-ELLE LES LIGNES D'UNE BASE QUI A DÉJÀ VÉCU ?**
 *
 * Sa règle du 29 septembre 2026 : « arbre » ne reste pas dans la case Unité.
 * La ligne de sa capture était DÉJÀ en base ; le code corrigé n'y touche pas,
 * la migration si. Les trois tables vivent sous FORCE ROW LEVEL SECURITY, et le
 * rôle qui migre n'a pas BYPASSRLS : un UPDATE nu passerait dans le vide sans
 * un mot (`.claude/rules/migrations.md`, modèle : `test-migration-0087-…`).
 *
 * Joue le VRAI fichier, sur les tables reconstituées avec leur RLS, peuplées
 * sous le contexte de leur entreprise, comme l'application les pose.
 */

const FICHIER = path.join(__dirname, "..", "drizzle", "0112_unite_de_ligne_rangee_seule.sql");
const SCHEMA = `epreuve_0112_${process.pid}`;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const rls = (t: string) => `
  ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "${t}_isolation" ON "${t}"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);`;

const TABLES = `
  CREATE TABLE "entreprises" ("id" uuid PRIMARY KEY);
  CREATE TABLE "lignes_prix" ("id" serial PRIMARY KEY, "entreprise_id" uuid NOT NULL, "unite" text,
    "updated_at" timestamptz NOT NULL DEFAULT now());
  CREATE TABLE "devis" ("id" serial PRIMARY KEY, "entreprise_id" uuid NOT NULL, "statut" text NOT NULL);
  CREATE TABLE "lignes_devis" ("id" serial PRIMARY KEY, "entreprise_id" uuid NOT NULL, "devis_id" int NOT NULL, "unite" text);
  CREATE TABLE "factures" ("id" serial PRIMARY KEY, "entreprise_id" uuid NOT NULL, "statut" text NOT NULL);
  CREATE TABLE "lignes_facture" ("id" serial PRIMARY KEY, "entreprise_id" uuid NOT NULL, "facture_id" int NOT NULL, "unite" text);
  ${["lignes_prix", "devis", "lignes_devis", "factures", "lignes_facture"].map(rls).join("\n")}
`;

async function main() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Ni DATABASE_ADMIN_URL ni DATABASE_URL : impossible de mesurer quoi que ce soit.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  const E = "11111111-1111-1111-1111-111111111111";

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES);
    await client.query(`INSERT INTO entreprises VALUES ($1)`, [E]);

    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [E]);
    for (const sql of [
      `INSERT INTO lignes_prix (entreprise_id, unite) VALUES
         ($1, 'arbre'), ($1, 'ml'), ($1, ' m2 '), ($1, 'Heures'), ($1, NULL), ($1, 'souche')`,
      `INSERT INTO devis (id, entreprise_id, statut) VALUES (1, $1, 'brouillon'), (2, $1, 'envoye')`,
      `INSERT INTO lignes_devis (entreprise_id, devis_id, unite) VALUES ($1, 1, 'arbre'), ($1, 2, 'arbre')`,
      `INSERT INTO factures (id, entreprise_id, statut) VALUES (1, $1, 'brouillon'), (2, $1, 'emise')`,
      `INSERT INTO lignes_facture (entreprise_id, facture_id, unite) VALUES ($1, 1, 'plante'), ($1, 2, 'passage')`,
    ]) {
      await client.query(sql, [E]);
    }
    // Le contexte est RENDU : un script de migration n'en pose aucun.
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);
    const visibles = await client.query(`SELECT count(*)::int AS n FROM lignes_prix`);
    assert.equal(visibles.rows[0].n, 0, "sans contexte, le rôle qui migre voit les lignes : la RLS n'est pas éprouvée");

    await client.query("BEGIN");
    try {
      await client.query(readFileSync(FICHIER, "utf8"));
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [E]);
    const lire = async (sql: string) => (await client.query(sql)).rows.map((r) => r.unite);

    await cas("les lignes de travail : « arbre » et « souche » partent, la rangée reste, les formes dites s'y ramènent", async () => {
      assert.deepEqual(await lire(`SELECT unite FROM lignes_prix ORDER BY id`), [null, "ml", "m²", "h", null, null]);
    });
    await cas("un devis en brouillon est repris, un devis envoyé ne bouge pas", async () => {
      assert.deepEqual(await lire(`SELECT unite FROM lignes_devis ORDER BY id`), [null, "arbre"]);
    });
    await cas("une facture en brouillon est reprise, une facture émise ne bouge pas", async () => {
      assert.deepEqual(await lire(`SELECT unite FROM lignes_facture ORDER BY id`), [null, "passage"]);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  if (echecs > 0) {
    console.error(`\n❌ ${echecs} cas en échec`);
    process.exit(1);
  }
  console.log("\n✅ 0112 voit les lignes d'une base habitée");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
