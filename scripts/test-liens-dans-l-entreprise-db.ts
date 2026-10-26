// UN LIEN ENTRE DEUX TABLES NE TRAVERSE JAMAIS DEUX ENTREPRISES.
//
// **Audit du 25 octobre 2026, E10.** Une clé étrangère se vérifie hors de la
// RLS : sans entreprise dans le lien, un retour d'intervention écrit chez A
// pouvait viser un chantier de B, et la base l'acceptait. La migration 0149
// double chaque lien d'une clé composite (l'identifiant ET l'entreprise).
//
// Deux contrôles : le geste lui-même, sous `atlas_app`, refusé ; et le
// catalogue de la base, pour que la PROCHAINE table qui oublierait la paire soit
// refusée ici avant d'arriver chez lui.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";

const SUPER = new Pool({
  connectionString: (() => {
    const u = new URL(process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test");
    u.pathname = new URL(process.env.DATABASE_URL ?? "postgresql://x@localhost/atlas_test").pathname;
    return u.toString();
  })(),
});

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const LIENS_SANS_ENTREPRISE = `
        SELECT c.conrelid::regclass AS enfant, c.conname AS lien
          FROM pg_constraint c
         WHERE c.contype = 'f'
           AND c.confrelid <> 'entreprises'::regclass
           AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'entreprise_id' AND NOT attisdropped)
           AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'entreprise_id' AND NOT attisdropped)
           AND NOT EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id')
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint s
              WHERE s.contype = 'f' AND s.conrelid = c.conrelid AND s.confrelid = c.confrelid
                AND c.conkey <@ s.conkey
                AND EXISTS (SELECT 1 FROM unnest(s.conkey) k JOIN pg_attribute a ON a.attrelid = s.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id'))
         ORDER BY 1, 2`;

async function sousA<T>(entrepriseId: string, fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    return await fn(c);
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}

async function main() {
  console.log("=== Les liens ne traversent pas les entreprises ===\n");
  const marque = Date.now();
  const A = await entreprisesRepo.creerEntreprise({ nom: `Liens A ${marque}` }, { email: `liens-a-${marque}@test.local`, nom: "A" });
  const B = await entreprisesRepo.creerEntreprise({ nom: `Liens B ${marque}` }, { email: `liens-b-${marque}@test.local`, nom: "B" });
  const chantier = async (e: string) =>
    (await SUPER.query(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1, 'Chantier') RETURNING id`, [e])).rows[0].id as string;
  const chezA = await chantier(A.entreprise.id);
  const chezB = await chantier(B.entreprise.id);

  try {
    await essai("un retour écrit chez A vers un chantier de A passe", async () => {
      await sousA(A.entreprise.id, (c) =>
        c.query(`INSERT INTO retours_intervention (entreprise_id, chantier_id) VALUES ($1, $2)`, [A.entreprise.id, chezA])
      );
    });

    await essai("le même retour vers un chantier de B est REFUSÉ par la base", async () => {
      await assert.rejects(
        sousA(A.entreprise.id, (c) =>
          c.query(`INSERT INTO retours_intervention (entreprise_id, chantier_id) VALUES ($1, $2)`, [A.entreprise.id, chezB])
        ),
        /violates foreign key constraint "retours_intervention_chantier_id_meme_entreprise"/,
        "UN RETOUR DE A A PU VISER UN CHANTIER DE B"
      );
    });

    await essai("aucun lien entre deux tables d'entreprise n'oublie l'entreprise", async () => {
      // Chaque clé étrangère qui relie deux tables portant `entreprise_id` doit
      // avoir une sœur composite qui l'inclut, sur les mêmes colonnes.
      const { rows } = await SUPER.query(LIENS_SANS_ENTREPRISE);
      assert.deepEqual(
        rows.map((r) => `${r.enfant}.${r.lien}`),
        [],
        "Ces liens n'ont pas leur clé composite : ajouter, dans une migration, FOREIGN KEY (colonne, entreprise_id) REFERENCES parent (id, entreprise_id) NOT VALID (modèle : drizzle/0149)"
      );
    });

    await essai("le contrôle du catalogue sait échouer : la clé composite retirée, le lien est dénoncé", async () => {
      const c = await SUPER.connect();
      try {
        await c.query("BEGIN");
        await c.query(`ALTER TABLE retours_intervention DROP CONSTRAINT retours_intervention_chantier_id_meme_entreprise`);
        const { rows } = await c.query(LIENS_SANS_ENTREPRISE);
        assert.deepEqual(rows.map((r) => String(r.lien)), ["retours_intervention_chantier_id_fkey"]);
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    });
  } finally {
    for (const e of [A.entreprise.id, B.entreprise.id]) await SUPER.query(`DELETE FROM chantiers WHERE entreprise_id = $1`, [e]);
    await SUPER.end();
    await pool.end();
  }

  console.log(`\nLes liens dans l'entreprise — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
