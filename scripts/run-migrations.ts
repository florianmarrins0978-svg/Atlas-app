import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { VERSIONS_DOCUMENTS, empreinteContenu } from "../src/server/documents-legaux/versions";

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

    await publierDocumentsLegaux(pool);
  } finally {
    await pool.end();
  }
}

// Publication des versions de documents légaux (voir docs/RGPD.md §8).
//
// Rattachée au runner de migrations, et non au jeu de données de démonstration :
// ces textes doivent exister en production, où aucun seed n'est joué. C'est
// aussi le seul endroit qui dispose du rôle propriétaire — l'application n'a
// que SELECT sur documents_legaux, précisément pour qu'une version publiée ne
// puisse jamais être réécrite depuis une requête applicative.
//
// Idempotent : une version déjà publiée n'est jamais modifiée. Corriger un
// texte impose d'ajouter une version dans versions.ts, ce qui redemandera son
// acceptation aux artisans — c'est voulu.
async function publierDocumentsLegaux(pool: Pool) {
  let publies = 0;
  for (const v of VERSIONS_DOCUMENTS) {
    const { rowCount } = await pool.query(
      `INSERT INTO documents_legaux (type, version, titre, contenu, empreinte, acceptation_requise)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (type, version) DO NOTHING`,
      [v.type, v.version, v.titre, v.contenu, empreinteContenu(v.contenu), v.acceptationRequise]
    );
    if (rowCount) publies++;
  }
  console.log(
    `${publies} document(s) légal(aux) publié(s) (${VERSIONS_DOCUMENTS.length - publies} déjà à jour).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
