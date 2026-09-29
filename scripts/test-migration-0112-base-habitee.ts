import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { MODELE_FOURNI } from "../src/lib/prestations-entretien";

/**
 * **LA MIGRATION 0112 SUR UNE BASE QUI A DÉJÀ VÉCU** (`.claude/rules/migrations.md`).
 *
 * Sa demande du 29 septembre 2026 : *« mon modèle doit déjà être là par
 * défaut »*. Les comptes neufs le reçoivent à leur création
 * (`creerEntreprise`) ; 0112 le pose sur les comptes d'avant dont la fiche est
 * VIDE, et sur eux seuls. Une fiche composée ne se touche pas : ce qu'il y a
 * retiré, il l'a retiré, et le bouton « Remettre le modèle Atlas » est là pour
 * le ramener s'il le veut.
 *
 * **Le piège, et c'est lui que cette suite fait rougir.** `prestations_entretien`
 * est sous FORCE RLS et `atlas_owner` n'a pas BYPASSRLS : sans contexte, il ne
 * voit AUCUNE ligne. Un « s'il n'y a rien » écrit sans contexte croit toutes
 * les fiches vides, et pose le modèle PAR-DESSUS les fiches composées.
 *
 * Joue le VRAI fichier, sur les deux tables reconstituées dans un schéma à
 * part, avec leur RLS, peuplées comme l'application les peuple.
 */
const FICHIER = path.join(__dirname, "..", "drizzle", "0112_modele_de_fiche_d_office.sql");
const SCHEMA = `epreuve_0112_${process.pid}`;
const VIDE = "11111111-1111-1111-1111-111111111111";
const COMPOSEE = "22222222-2222-2222-2222-222222222222";
const UNE_LIGNE = "33333333-3333-3333-3333-333333333333";

const TABLES = `
  CREATE TABLE "entreprises" ("id" uuid PRIMARY KEY);
  CREATE TABLE "prestations_entretien" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
    "famille" text NOT NULL,
    "libelle" text NOT NULL,
    "ordre" integer NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX "prestations_entretien_libelle_uk" ON "prestations_entretien" ("entreprise_id", lower("libelle"));
  ALTER TABLE "prestations_entretien" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "prestations_entretien" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "prestations_entretien_isolation" ON "prestations_entretien"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
`;

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

async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error("❌ DATABASE_ADMIN_URL absente : la migration se joue sous le rôle qui migre, et lui seul.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  const lignesDe = async (entreprise: string) => {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entreprise]);
    const { rows } = await client.query<{ famille: string; libelle: string }>(
      `SELECT famille, libelle FROM prestations_entretien ORDER BY ordre, libelle`
    );
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);
    return rows;
  };
  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES);
    await client.query(`INSERT INTO entreprises (id) VALUES ($1), ($2), ($3)`, [VIDE, COMPOSEE, UNE_LIGNE]);
    // Posées comme l'application les pose : sous le contexte de leur entreprise.
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [COMPOSEE]);
    await client.query(
      `INSERT INTO prestations_entretien (entreprise_id, famille, libelle, ordre) VALUES
        ($1, 'Pelouse', 'Tonte et ébarbage', 10), ($1, 'Arrosage', 'Réglage des arroseurs', 20)`,
      [COMPOSEE]
    );
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [UNE_LIGNE]);
    await client.query(
      `INSERT INTO prestations_entretien (entreprise_id, famille, libelle, ordre) VALUES ($1, 'Haies', 'Taille', 10)`,
      [UNE_LIGNE]
    );
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);

    const migration = readFileSync(FICHIER, "utf8");
    console.log("=== 0112 sur une base qui a déjà vécu ===");

    await cas("elle s'applique", async () => {
      await client.query("BEGIN");
      try {
        await client.query(migration);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`elle refuse de s'appliquer : ${(e as Error).message}`);
      }
    });

    await cas("la fiche VIDE reçoit le modèle entier, dans son ordre", async () => {
      const l = await lignesDe(VIDE);
      assert.deepEqual(
        l.map((x) => [x.famille, x.libelle]),
        MODELE_FOURNI.map((m) => [m.famille, m.libelle])
      );
    });

    await cas("une fiche composée ne reçoit RIEN", async () => {
      assert.deepEqual(
        (await lignesDe(COMPOSEE)).map((x) => x.libelle),
        ["Tonte et ébarbage", "Réglage des arroseurs"]
      );
    });

    await cas("une fiche d'une seule ligne ne reçoit rien non plus", async () => {
      assert.deepEqual((await lignesDe(UNE_LIGNE)).map((x) => x.libelle), ["Taille"]);
    });

    await cas("rejouée, elle n'ajoute rien", async () => {
      await client.query(migration);
      assert.equal((await lignesDe(VIDE)).length, MODELE_FOURNI.length);
      assert.equal((await lignesDe(COMPOSEE)).length, 2);
    });
  } finally {
    await client.query(`SET search_path TO public`);
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    client.release();
    await pool.end();
  }
  if (echecs > 0) {
    console.error(`\n❌ 0112 sur base habitée : ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ 0112 sur base habitée : tout est juste.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
