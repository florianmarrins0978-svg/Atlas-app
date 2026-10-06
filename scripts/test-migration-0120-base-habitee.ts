import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";

/**
 * **LA MIGRATION 0120 SUR UNE BASE QUI A DÉJÀ VÉCU** (`.claude/rules/migrations.md`).
 *
 * Elle rend au texte d'origine les entreprises qui en gardaient une COPIE de
 * l'ancien : sur une base vide, elle ne touche rien et serait verte par
 * construction. Ici, quatre entreprises comme il en existe pour de bon :
 *
 * | ce qui est rangé | ce qui doit en sortir |
 * |---|---|
 * | la copie exacte de l'ancien texte | `NULL`, donc le texte corrigé |
 * | l'ancien texte retouché d'une virgule | **inchangé** : c'est le sien |
 * | `NULL` (jamais réglé) | `NULL` |
 * | `''` (il l'a effacé) | `''` : il ne veut rien imprimer |
 *
 * Elle joue le VRAI fichier, dans un schéma à part, sur `entreprises` réduite
 * aux colonnes que 0120 lit. `entreprises` n'est pas sous RLS : rien à poser.
 */

const FICHIER = path.join(__dirname, "..", "drizzle", "0120_conditions_generales_corrigees.sql");
const SCHEMA = `epreuve_0120_${process.pid}`;

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

/** L'ancien texte, lu dans la migration elle-même : le code ne le porte plus. */
function ancienTexte(sql: string): string {
  const m = sql.match(/WHERE "conditions_generales" = '((?:[^']|'')*)';/);
  if (!m) throw new Error("la migration ne porte plus l'ancien texte qu'elle compare");
  return m[1]!.replace(/''/g, "'");
}

async function main() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Ni DATABASE_ADMIN_URL ni DATABASE_URL : impossible de mesurer quoi que ce soit.");
    process.exit(1);
  }
  const sql = readFileSync(FICHIER, "utf8");
  const ancien = ancienTexte(sql);
  const retouche = ancien.replace("1. Commande.", "1. Commande,");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(`CREATE TABLE "entreprises" ("id" serial PRIMARY KEY, "conditions_generales" text)`);
    await client.query(
      `INSERT INTO "entreprises" ("id", "conditions_generales") VALUES (1, $1), (2, $2), (3, NULL), (4, '')`,
      [ancien, retouche]
    );

    await cas("l'ancien texte n'est plus celui du code : sinon la migration ne prouverait rien", async () => {
      assert.notEqual(ancien, TEXTE_ORIGINE_CONDITIONS_GENERALES);
      assert.ok(ancien.includes("aucune réclamation sur l’aspect des travaux"), "ce n'est pas l'ancien texte");
    });

    await client.query(sql);
    const { rows } = await client.query<{ id: number; conditions_generales: string | null }>(
      `SELECT "id", "conditions_generales" FROM "entreprises" ORDER BY "id"`
    );
    const lu = new Map(rows.map((r) => [r.id, r.conditions_generales]));

    await cas("la copie exacte revient au texte d'origine, donc au texte corrigé", async () => {
      assert.equal(lu.get(1), null);
    });
    await cas("un texte retouché reste le sien, d'une virgule près", async () => {
      assert.equal(lu.get(2), retouche);
    });
    await cas("jamais réglé reste jamais réglé, effacé reste effacé", async () => {
      assert.equal(lu.get(3), null);
      assert.equal(lu.get(4), "");
    });
    await cas("rejouée, elle ne change plus rien", async () => {
      await client.query(sql);
      const { rows: apres } = await client.query(`SELECT "id", "conditions_generales" FROM "entreprises" ORDER BY "id"`);
      assert.deepEqual(apres, rows);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    client.release();
    await pool.end();
  }
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Migration 0120 sur une base habitée : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
