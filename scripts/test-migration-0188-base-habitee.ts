import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * LA MIGRATION 0188 SUR UNE BASE QUI A DÉJÀ VÉCU.
 *
 * Elle réécrit des libellés existants (ses réponses quittent le nom du
 * travail, `ARCHITECTURE.md` §594), donc elle s'éprouve sur une base HABITÉE,
 * sous FORCE RLS, et sous le rôle qui migre, sans BYPASSRLS
 * (`.claude/rules/migrations.md`, la leçon de 0087).
 *
 * Dans un schéma à part, tables réduites à ce que 0188 lit et écrit, RLS
 * forcée comme en vrai, deux entreprises :
 *
 *   A. elle s'applique ;
 *   B. ses réponses quittent le nom, dans CHAQUE entreprise, sous les deux
 *      formes (« (…) » et, d'avant le 28 octobre, « — … ») ;
 *   C. le nom latin entre parenthèses reste, seules ses réponses partent ;
 *   D. ce qui n'est pas une de ses réponses reste : la quantité recollée, une
 *      parenthèse tapée, un tiret dicté, un chantier sans réponses ;
 *   E. sans la boucle par entreprise, la même écriture ne toucherait RIEN :
 *      la suite sait échouer, c'est la RLS qui la rend vraie.
 *
 *   npx tsx scripts/test-migration-0188-base-habitee.ts
 */

const FICHIER = path.join(__dirname, "..", "drizzle", "0188_reponses_hors_du_nom.sql");
const SCHEMA = `epreuve_0188_${process.pid}`;
const E1 = "11111111-1111-1111-1111-111111111111";
const E2 = "22222222-2222-2222-2222-222222222222";
const C1 = "aaaaaaaa-1111-1111-1111-111111111111";
const C1B = "aaaaaaaa-2222-1111-1111-111111111111";
const C2 = "bbbbbbbb-1111-1111-1111-111111111111";

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

const isolation = (table: string) => `
  ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "${table}_isolation" ON "${table}"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
`;

/** Les tables telles que 0187 les laisse, réduites à ce que 0188 touche, RLS forcée. */
const TABLES_EN_0187 = `
  CREATE TABLE "entreprises" ("id" uuid PRIMARY KEY);
  CREATE TABLE "prestations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "chantier_id" uuid NOT NULL,
    "libelle" text NOT NULL DEFAULT '',
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE "precisions_chantier" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "chantier_id" uuid NOT NULL,
    "libelle_prestation" text NOT NULL,
    "lisible" text NOT NULL
  );
  ${isolation("prestations")}
  ${isolation("precisions_chantier")}
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
  const prestation = (e: string, chantier: string, libelle: string) =>
    dans(e, `INSERT INTO "prestations" ("entreprise_id", "chantier_id", "libelle") VALUES ($1, $2, $3)`, [e, chantier, libelle]);
  const reponse = (e: string, chantier: string, nom: string, lisible: string) =>
    dans(e, `INSERT INTO "precisions_chantier" ("entreprise_id", "chantier_id", "libelle_prestation", "lisible") VALUES ($1, $2, $3, $4)`, [
      e,
      chantier,
      nom,
      lisible,
    ]);
  const libelles = async (e: string, chantier: string) =>
    (await dans(e, `SELECT "libelle" FROM "prestations" WHERE "chantier_id" = $1 ORDER BY "libelle"`, [chantier])).rows.map(
      (r) => r.libelle as string
    );

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLES_EN_0187);
    await client.query(`INSERT INTO "entreprises" ("id") VALUES ($1), ($2)`, [E1, E2]);

    // Entreprise 1, son chêne de la capture du 18 novembre, avec et sans le
    // nom latin, une haie à la quantité recollée, un tilleul au nom latin.
    await prestation(E1, C1, "Abattage d'un chêne (abattage entre 10 et 20 m, ⌀ 80 cm)");
    await reponse(E1, C1, "Abattage d'un chêne", "abattage entre 10 et 20 m");
    await reponse(E1, C1, "Abattage d'un chêne", "⌀ 80 cm");
    await prestation(E1, C1, "Abattage d'un hêtre (Fagus sylvatica) (⌀ 60 cm)");
    await reponse(E1, C1, "Abattage d'un hêtre (Fagus sylvatica)", "⌀ 60 cm");
    await prestation(E1, C1, "Haie (tout genre) (800 ml)");
    await reponse(E1, C1, "Haie (tout genre)", "50 ml");
    await prestation(E1, C1, "Abattage d'un tilleul (Tilia)");
    await reponse(E1, C1, "Abattage d'un tilleul", "⌀ 55 cm");
    // Un chantier sans réponses : rien à retirer, même une parenthèse.
    await prestation(E1, C1B, "Taille (sévère)");
    // Entreprise 2 : la forme d'avant le 28 octobre, et un tiret DICTÉ.
    await prestation(E2, C2, "Érable — démontage avec rétention, ⌀ 45 cm");
    await reponse(E2, C2, "Érable", "démontage avec rétention");
    await reponse(E2, C2, "Érable", "⌀ 45 cm");
    await prestation(E2, C2, "Frêne — démontage en rétention");
    await reponse(E2, C2, "Frêne", "⌀ 30 cm");

    console.log("=== 0188 sur une base qui a déjà vécu ===");

    await cas("E. sans la boucle par entreprise, la même écriture ne toucherait rien", async () => {
      const r = await client.query(`UPDATE "prestations" SET "libelle" = "libelle" WHERE "libelle" LIKE '%(%'`);
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

    const e1 = await libelles(E1, C1);
    const e2 = await libelles(E2, C2);

    await cas("B. ses réponses quittent le nom, dans chaque entreprise, sous les deux formes", async () => {
      assert.ok(e1.includes("Abattage d'un chêne"), `son chêne : ${e1.join(" | ")}`);
      assert.ok(e2.includes("Érable"), `la seconde entreprise n'a pas été parcourue, ou la forme au tiret : ${e2.join(" | ")}`);
    });

    await cas("C. le nom latin reste, seules ses réponses partent", async () => {
      assert.ok(e1.includes("Abattage d'un hêtre (Fagus sylvatica)"), e1.join(" | "));
    });

    await cas("D. ce qui n'est pas une de ses réponses reste", async () => {
      assert.ok(e1.includes("Haie (tout genre) (800 ml)"), "la quantité recollée est partie");
      assert.ok(e1.includes("Abattage d'un tilleul (Tilia)"), "le nom latin a été pris pour une réponse");
      assert.deepEqual(await libelles(E1, C1B), ["Taille (sévère)"], "un chantier sans réponses a perdu sa parenthèse");
      assert.ok(e2.includes("Frêne — démontage en rétention"), "un tiret dicté a été coupé");
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0188 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
