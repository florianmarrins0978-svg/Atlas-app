import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * LA MIGRATION 0186 SUR UNE BASE QUI A DÉJÀ VÉCU.
 *
 * Elle écrit sur `entreprise_compteurs`, sous FORCE RLS, avec le rôle qui
 * migre, sans BYPASSRLS (`.claude/rules/migrations.md`, la leçon de 0087).
 * Dans un schéma à part, la table réduite à ce que 0186 touche, RLS forcée
 * comme en vrai, trois entreprises :
 *
 *   A. elle s'applique ;
 *   B. une entreprise née sans compteur le reçoit, au numéro 1 ;
 *   C. TOUTES celles qui n'en avaient pas le reçoivent, pas seulement la première ;
 *   D. une entreprise qui avait déjà le sien garde ses numéros, à l'unité près ;
 *   E. sans la boucle par entreprise, la même écriture serait refusée :
 *      la suite sait échouer, c'est la RLS qui la rend vraie.
 *
 *   npx tsx scripts/test-migration-0186-base-habitee.ts
 */

const FICHIER = path.join(__dirname, "..", "drizzle", "0186_compteur_des_comptes_inscrits.sql");
const SCHEMA = `epreuve_0186_${process.pid}`;
const AVEC = "11111111-1111-1111-1111-111111111111";
const SANS_1 = "22222222-2222-2222-2222-222222222222";
const SANS_2 = "33333333-3333-3333-3333-333333333333";

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

/** Les deux tables telles que 0185 les laisse, réduites à ce que 0186 touche. */
const TABLES = `
  CREATE TABLE "entreprises" ("id" uuid PRIMARY KEY);
  CREATE TABLE "entreprise_compteurs" (
    "entreprise_id" uuid PRIMARY KEY NOT NULL,
    "prochain_numero_devis" integer DEFAULT 1 NOT NULL,
    "prochain_numero_facture" integer DEFAULT 1 NOT NULL,
    "prochain_numero_avoir" integer DEFAULT 1 NOT NULL
  );
  ALTER TABLE "entreprise_compteurs" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "entreprise_compteurs" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "compteurs_isolation" ON "entreprise_compteurs"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
`;

async function main() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Ni DATABASE_ADMIN_URL ni DATABASE_URL : impossible de mesurer quoi que ce soit.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  const compteurDe = async (entreprise: string) => {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entreprise]);
    const { rows } = await client.query(`SELECT * FROM "entreprise_compteurs" WHERE "entreprise_id" = $1`, [entreprise]);
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);
    return rows[0] ?? null;
  };

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES);
    await client.query(`INSERT INTO "entreprises" ("id") VALUES ($1), ($2), ($3)`, [AVEC, SANS_1, SANS_2]);
    // L'entreprise qui a déjà travaillé : 41 devis, 17 factures, 2 avoirs.
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [AVEC]);
    await client.query(
      `INSERT INTO "entreprise_compteurs" VALUES ($1, 42, 18, 3)`,
      [AVEC]
    );
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);

    console.log("=== 0186 sur une base qui a déjà vécu ===");

    await cas("E. sans la boucle par entreprise, la même écriture serait refusée", async () => {
      await assert.rejects(
        client.query(`INSERT INTO "entreprise_compteurs" ("entreprise_id") VALUES ($1)`, [SANS_1]),
        /row-level security/,
        "une écriture sans contexte est passée : la RLS de l'épreuve ne mord pas, elle ne prouve rien"
      );
    });

    await cas("A. elle s'applique", async () => {
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(FICHIER, "utf8"));
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`la migration refuse de s'appliquer : ${(e as Error).message}`);
      }
    });

    await cas("B. une entreprise née sans compteur le reçoit, au numéro 1", async () => {
      const c = await compteurDe(SANS_1);
      assert.ok(c, "toujours pas de compteur : son premier devis tombera encore");
      assert.equal(c.prochain_numero_devis, 1);
      assert.equal(c.prochain_numero_facture, 1);
      assert.equal(c.prochain_numero_avoir, 1);
    });

    await cas("C. toutes celles qui n'en avaient pas le reçoivent", async () => {
      assert.ok(await compteurDe(SANS_2), "la seconde entreprise sans compteur a été oubliée");
    });

    await cas("D. une entreprise qui avait le sien garde ses numéros", async () => {
      const c = await compteurDe(AVEC);
      assert.deepEqual(
        [c?.prochain_numero_devis, c?.prochain_numero_facture, c?.prochain_numero_avoir],
        [42, 18, 3],
        "ses numéros ont été remis à zéro : deux devis porteraient le même numéro"
      );
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0186 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
