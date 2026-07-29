import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const dossierMigrations = path.join(__dirname, "..", "drizzle");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        nom text PRIMARY KEY,
        appliquee_a timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await pool.query("SELECT nom FROM _migrations");
    const dejaAppliquees = new Set(rows.map((r) => r.nom as string));

    const fichiers = readdirSync(dossierMigrations)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let nombreAppliquees = 0;
    for (const fichier of fichiers) {
      if (dejaAppliquees.has(fichier)) continue;

      console.log(`Application de ${fichier}...`);
      const sql = readFileSync(path.join(dossierMigrations, fichier), "utf-8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (nom) VALUES ($1)", [fichier]);
        await client.query("COMMIT");
        nombreAppliquees++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Échec de la migration ${fichier} — annulée intégralement.`);
        throw err;
      } finally {
        client.release();
      }
    }

    console.log(`${nombreAppliquees} migration(s) appliquée(s) (${fichiers.length - nombreAppliquees} déjà à jour).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
