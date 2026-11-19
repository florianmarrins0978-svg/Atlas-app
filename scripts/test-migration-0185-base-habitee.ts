import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * LA MIGRATION 0185 SUR UNE BASE QUI A DÉJÀ VÉCU.
 *
 * Elle réécrit des lignes existantes (la civilité des rapports déjà partis),
 * donc elle s'éprouve sur une base HABITÉE, sous FORCE RLS, et sous le rôle
 * qui migre, sans BYPASSRLS (`.claude/rules/migrations.md`, la leçon de 0087).
 *
 * Dans un schéma à part, tables réduites à ce que 0185 lit et écrit, RLS
 * forcée comme en vrai, deux entreprises :
 *
 *   A. elle s'applique ;
 *   B. un rapport parti reçoit la civilité de son client, dans CHAQUE entreprise ;
 *   C. une fiche pas encore partie n'est pas touchée (elle la figera à l'envoi) ;
 *   D. un client sans civilité, ou un rapport sans client, reste NULL :
 *      rien ne s'invente ;
 *   E. sans la boucle par entreprise, la même écriture ne toucherait RIEN :
 *      la suite sait échouer, c'est la RLS qui la rend vraie.
 *
 *   npx tsx scripts/test-migration-0185-base-habitee.ts
 */

const FICHIER = path.join(__dirname, "..", "drizzle", "0185_rapport_garde_la_civilite.sql");
const SCHEMA = `epreuve_0185_${process.pid}`;
const E1 = "11111111-1111-1111-1111-111111111111";
const E2 = "22222222-2222-2222-2222-222222222222";

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

/** Les tables telles que 0184 les laisse, réduites à ce que 0185 touche, RLS forcée. */
const TABLES_EN_0184 = `
  CREATE TABLE "entreprises" ("id" uuid PRIMARY KEY);
  CREATE TABLE "clients" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "nom" text NOT NULL,
    "civilite" text
  );
  CREATE TABLE "passages_entretien" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "client_id" uuid,
    "client_nom" text,
    "envoye_le" timestamptz
  );
  ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "clients_isolation" ON "clients"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  ALTER TABLE "passages_entretien" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "passages_entretien" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "passages_isolation" ON "passages_entretien"
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

  const dans = async (entreprise: string, requete: string, valeurs: unknown[] = []) => {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entreprise]);
    const r = await client.query(requete, valeurs);
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);
    return r;
  };
  const civiliteDe = async (entreprise: string, nom: string) =>
    (await dans(entreprise, `SELECT "client_civilite" FROM "passages_entretien" WHERE "client_nom" = $1`, [nom])).rows[0]
      ?.client_civilite ?? null;

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES_EN_0184);
    await client.query(`INSERT INTO "entreprises" ("id") VALUES ($1), ($2)`, [E1, E2]);

    // L'entreprise 1 : une cliente servie, une fiche pas encore partie, un
    // client sans civilité, un rapport sans client.
    await dans(E1, `
      WITH c AS (
        INSERT INTO "clients" ("entreprise_id", "nom", "civilite") VALUES
          ('${E1}', 'Lefèvre', 'mme'), ('${E1}', 'Sansnom', NULL)
        RETURNING "id", "nom"
      )
      INSERT INTO "passages_entretien" ("entreprise_id", "client_id", "client_nom", "envoye_le")
      SELECT '${E1}', c."id", c."nom", now() FROM c
    `);
    await dans(E1, `
      INSERT INTO "passages_entretien" ("entreprise_id", "client_id", "client_nom", "envoye_le")
      SELECT '${E1}', "id", 'Lefèvre en cours', NULL FROM "clients" WHERE "nom" = 'Lefèvre'
    `);
    await dans(E1, `INSERT INTO "passages_entretien" ("entreprise_id", "client_id", "client_nom", "envoye_le")
                    VALUES ('${E1}', NULL, 'Orphelin', now())`);
    // L'entreprise 2 : une mairie servie.
    await dans(E2, `
      WITH c AS (INSERT INTO "clients" ("entreprise_id", "nom", "civilite") VALUES ('${E2}', 'Mairie', 'public') RETURNING "id", "nom")
      INSERT INTO "passages_entretien" ("entreprise_id", "client_id", "client_nom", "envoye_le")
      SELECT '${E2}', c."id", c."nom", now() FROM c
    `);

    console.log("=== 0185 sur une base qui a déjà vécu ===");

    await cas("E. sans la boucle par entreprise, la même écriture ne toucherait rien", async () => {
      await client.query(`ALTER TABLE "passages_entretien" ADD COLUMN IF NOT EXISTS "client_civilite" text`);
      const r = await client.query(`
        UPDATE "passages_entretien" p SET "client_civilite" = c."civilite"
        FROM "clients" c WHERE c."id" = p."client_id" AND p."envoye_le" IS NOT NULL`);
      assert.equal(r.rowCount, 0, `${r.rowCount} ligne(s) vue(s) sans contexte : la RLS de l'épreuve ne mord pas, elle ne prouve rien`);
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

    await cas("B. un rapport parti reçoit la civilité de son client, dans chaque entreprise", async () => {
      assert.equal(await civiliteDe(E1, "Lefèvre"), "mme", "la cliente n'a pas reçu « mme » : son PDF dirait encore « Mr. »");
      assert.equal(await civiliteDe(E2, "Mairie"), "public", "la seconde entreprise n'a pas été parcourue");
    });

    await cas("C. une fiche pas encore partie n'est pas touchée", async () => {
      assert.equal(await civiliteDe(E1, "Lefèvre en cours"), null);
    });

    await cas("D. un client sans civilité, ou un rapport sans client, reste vide", async () => {
      assert.equal(await civiliteDe(E1, "Sansnom"), null, "une civilité a été inventée");
      assert.equal(await civiliteDe(E1, "Orphelin"), null, "une civilité a été inventée");
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0185 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
