import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * **LA MIGRATION 0154 S'APPLIQUE-T-ELLE SUR UNE BASE QUI A DÉJÀ VÉCU ?**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 0154 n'écrit aucune ligne, mais elle REMPLACE la borne de `envois_pieces`
 * (`attendues` passe de 2 000 à 20 000) et retire le `NOT NULL` du fichier
 * d'une pièce importée. Une contrainte ajoutée se vérifie sur TOUTES les
 * lignes, RLS ou pas (`.claude/rules/migrations.md`) : c'est la panne de 0087,
 * et l'on ne la rejoue pas.
 *
 * Elle joue le VRAI fichier, sur les deux tables reconstituées dans l'état où
 * 0136 les laisse, sous FORCE ROW LEVEL SECURITY, peuplées comme l'ancien code
 * les peuple : un envoi à la borne d'avant (2 000), des pièces à chaque statut.
 * Le modèle est `test-migration-0150-base-habitee.ts`.
 * ───────────────────────────────────────────────────────────────────────────
 */

const RACINE = path.join(__dirname, "..");
const FICHIER_0154 = path.join(RACINE, "drizzle", "0154_pieces_importees_d_un_tableau.sql");
const SCHEMA = `epreuve_0154_${process.pid}`;
const ENTREPRISE = "33333333-3333-3333-3333-333333333333";

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

/** Les deux tables telles que 0136 les crée, sans les clés étrangères que 0154 ne touche pas. */
const TABLES_EN_0136 = `
  CREATE TABLE "envois_pieces" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "nom" text NOT NULL CHECK (length(btrim("nom")) > 0),
    "attendues" integer NOT NULL CHECK ("attendues" > 0 AND "attendues" <= 2000),
    "clients_crees" uuid[] NOT NULL DEFAULT '{}',
    "range_le" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE "pieces_importees" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "envoi_id" uuid NOT NULL,
    "empreinte" text NOT NULL CHECK ("empreinte" ~ '^[0-9a-f]{64}$'),
    "fichier_cle" text NOT NULL,
    "statut" text NOT NULL DEFAULT 'a_lire'
      CHECK ("statut" IN ('a_lire', 'en_lecture', 'lue', 'a_verifier', 'rangee')),
    "genre" text CHECK ("genre" IN ('devis', 'facture')),
    "numero" text,
    "nom_lu" text,
    "client_id" uuid
  );
  ALTER TABLE "envois_pieces" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "envois_pieces" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "envois_pieces_isolation" ON "envois_pieces"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  ALTER TABLE "pieces_importees" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "pieces_importees" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "pieces_importees_isolation" ON "pieces_importees"
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

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES_EN_0136);

    // ─── LA BASE HABITÉE, posée sous le contexte de son entreprise, qui est
    // rendu ensuite : un script de migration n'en pose aucun.
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ENTREPRISE]);
    const { rows: envois } = await client.query<{ id: string }>(
      `INSERT INTO "envois_pieces" ("entreprise_id", "nom", "attendues", "range_le") VALUES
        ($1, 'Années 2016 à 2025.zip', 2000, now()),
        ($1, 'Facture Martins.pdf', 1, NULL)
       RETURNING "id"`,
      [ENTREPRISE]
    );
    await client.query(
      `INSERT INTO "pieces_importees" ("entreprise_id", "envoi_id", "empreinte", "fichier_cle", "statut", "genre", "numero")
       SELECT $1, $2, md5(g::text) || md5(g::text || 'x'), 'entreprises/x/import/' || g || '.pdf',
              (ARRAY['a_lire', 'en_lecture', 'lue', 'a_verifier', 'rangee'])[1 + g % 5], 'facture', 'F' || g
         FROM generate_series(1, 25) g`,
      [ENTREPRISE, envois[0].id]
    );
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);

    const sql0154 = readFileSync(FICHIER_0154, "utf8");
    console.log("=== 0154 sur une base qui a déjà vécu ===");

    await cas("elle s'applique : aucune ligne existante ne viole la borne relevée", async () => {
      await client.query("BEGIN");
      try {
        await client.query(sql0154);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`la migration refuse de s'appliquer, et celles qui la suivent resteront derrière elle : ${(e as Error).message}`);
      }
    });

    const relire = () => client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ENTREPRISE]);

    await cas("les deux envois et les 25 pièces sont TOUJOURS là, fichiers compris", async () => {
      await relire();
      const { rows } = await client.query<{ envois: number; pieces: number; fichiers: number; vides: number }>(
        `SELECT (SELECT count(*)::int FROM "envois_pieces") AS envois,
                (SELECT count(*)::int FROM "pieces_importees") AS pieces,
                (SELECT count("fichier_cle")::int FROM "pieces_importees") AS fichiers,
                (SELECT count(*)::int FROM "envois_pieces" WHERE "cases_completees" = '[]'::jsonb) AS vides`
      );
      assert.deepEqual(rows[0], { envois: 2, pieces: 25, fichiers: 25, vides: 2 });
    });

    await cas("une ligne de tableau entre sans fichier, avec son titre et son chantier", async () => {
      await relire();
      await client.query(
        `INSERT INTO "pieces_importees" ("entreprise_id", "envoi_id", "empreinte", "statut", "genre", "numero", "nom_lu", "objet", "adresse_chantier")
         VALUES ($1, $2, repeat('a', 64), 'rangee', 'devis', 'D2025-0244', 'SCI Les Hêtres', 'Entretien des espaces verts', '12 rue de la Paix, 44000 Nantes')`,
        [ENTREPRISE, envois[1].id]
      );
    });

    await cas("un envoi de dix ans de tableau passe, et la borne refuse toujours l'absurde", async () => {
      await relire();
      await client.query(`UPDATE "envois_pieces" SET "attendues" = 5120 WHERE "id" = $1`, [envois[1].id]);
      await assert.rejects(
        client.query(`UPDATE "envois_pieces" SET "attendues" = 20001 WHERE "id" = $1`, [envois[1].id]),
        /envois_pieces_attendues_check/,
        "la borne ne borne plus rien"
      );
      await assert.rejects(
        client.query(`UPDATE "pieces_importees" SET "objet" = repeat('x', 201) WHERE "numero" = 'D2025-0244'`),
        /objet_check/,
        "un titre de 201 caractères entre"
      );
    });

    await cas("LA GARDE RLS EST INTACTE sur les deux tables", async () => {
      const { rows } = await client.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
          WHERE relname IN ('envois_pieces', 'pieces_importees') AND relnamespace = $1::regnamespace ORDER BY relname`,
        [SCHEMA]
      );
      assert.equal(rows.length, 2);
      for (const r of rows) assert.ok(r.relrowsecurity && r.relforcerowsecurity, `${r.relname} a perdu sa garde`);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0154 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
